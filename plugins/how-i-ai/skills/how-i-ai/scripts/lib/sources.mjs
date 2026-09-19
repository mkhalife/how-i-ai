// One parser per source. Each returns { found, path, sessions: Session[], notes: string[] }.
// A Session follows references/data-schema.md section 1.
import { existsSync, readdirSync, statSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, basename, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  home, os, walk, readJsonl, readJson, fileTimes, toISO, fromEpoch, trim, cleanPrompt, isHarnessOnly,
  mostCommon, uniq, sha, minutesBetween, localDate,
} from './util.mjs';
import { readZipText } from './zip.mjs';

const FIRST_MESSAGE_CHARS = 2000;
const CONTEXT_CHARS = 600;

// Sub-agent types that ship with Claude Code. Anything else is a custom agent the person (or a plugin) defined.
export const BUILTIN_AGENTS = new Set(['general-purpose', 'explore', 'plan', 'claude', 'fork', 'statusline-setup', 'claude-code-guide', 'output-style-setup']);
// Slash commands that are product features, not skills.
const BUILTIN_COMMANDS = new Set(['clear', 'compact', 'help', 'login', 'logout', 'model', 'resume', 'status', 'cost', 'config', 'doctor', 'exit', 'quit', 'mcp', 'memory', 'permissions', 'plugin', 'plugins', 'reload-plugins', 'schedule', 'web-setup', 'teleport', 'mobile', 'agents', 'bug', 'release-notes', 'terminal-setup', 'vim', 'theme', 'hooks', 'ide', 'install-github-app', 'export', 'rename', 'context', 'usage', 'stats', 'rewind', 'add-dir', 'privacy-settings', 'upgrade', 'pr-comments', 'passes', 'tasks', 'fast', 'effort', 'branch', 'chrome', 'desktop', 'remote-control', 'remote-env', 'skills', 'share', 'copy', 'insights', 'diff', 'output-style', 'sandbox', 'stop', 'voice', 'btw', 'color', 'keybindings', 'feedback', 'advisor', 'extra-usage', 'goals', 'heapdump', 'history', 'ultraplan', 'ultrareview', 'assistant', 'launch']);

function skillsAndAgents(users, assistants) {
  const skills = [], agents = [];
  for (const r of assistants) for (const b of (Array.isArray(r.message.content) ? r.message.content : [])) {
    if (b.type !== 'tool_use') continue;
    if (b.name === 'Skill' && b.input && b.input.skill) skills.push(String(b.input.skill).replace(/^\//, ''));
    // subagent_type is optional on the Agent tool; omitted means the general-purpose agent.
    if ((b.name === 'Agent' || b.name === 'Task') && b.input) agents.push(String(b.input.subagent_type || 'general-purpose'));
  }
  for (const r of users) {
    const t = textOf(r.message.content); // slash commands arrive as a string or as text blocks
    const m = t.match(/<command-name>\s*\/?([^<\s]+)\s*<\/command-name>/);
    if (m && !BUILTIN_COMMANDS.has(m[1].toLowerCase())) skills.push(m[1]);
  }
  return { skills: uniq(skills), agents: uniq(agents) };
}

// Desktop sessions stay open for days, so first-to-last timestamp is not time spent. Sum the gaps between
// consecutive records and drop any gap longer than 15 minutes (the person walked away).
function activeMinutes(times) {
  let ms = 0;
  for (let i = 1; i < times.length; i++) { const gap = new Date(times[i]) - new Date(times[i - 1]); if (gap > 0 && gap <= 15 * 60e3) ms += gap; }
  return Math.round(ms / 6000) / 10;
}

// claude.ai connectors show up in tool names as mcp__<uuid>__tool. The desktop app's state files list uuid → name.
let connectorNameCache = null;
function connectorNames() {
  if (connectorNameCache) return connectorNameCache;
  connectorNameCache = new Map();
  for (const root of claudeDesktopRoots()) for (const sub of ['claude-code-sessions', 'local-agent-mode-sessions'])
    for (const file of walk(join(root, sub), { maxDepth: 3, filter: (p, n) => /^local_.*\.json$/i.test(n) }))
      for (const c of readJson(file, {})?.remoteMcpServersConfig || []) if (c && c.uuid && c.name) connectorNameCache.set(String(c.uuid), String(c.name));
  return connectorNameCache;
}

function surfaceFromEntrypoint(ep) {
  const e = String(ep || '').toLowerCase();
  if (e.includes('remote')) return 'cloud';
  if (e.includes('local-agent')) return 'cowork';
  if (e.includes('desktop')) return 'desktop';
  if (e.includes('vscode') || e.includes('jetbrains') || e.includes('ide')) return 'ide';
  if (e.includes('sdk')) return 'sdk';
  return 'cli';
}

function textOf(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.filter((b) => b && b.type === 'text' && typeof b.text === 'string').map((b) => b.text).join('\n');
  return '';
}

function connectorsFromTools(tools) {
  const names = connectorNames();
  return uniq(tools.filter((t) => /^mcp__/.test(t)).map((t) => t.split('__')[1]).map((c) => names.get(c) || c));
}

function baseSession(o) {
  return {
    id: o.id, source: o.source, surface: o.surface || 'cli', started_at: o.started_at, ended_at: o.ended_at || o.started_at,
    duration_minutes: o.active_minutes != null ? o.active_minutes : minutesBetween(o.started_at, o.ended_at || o.started_at),
    title: trim(o.title, 200) || null,
    first_message: trim(o.first_message, FIRST_MESSAGE_CHARS) || '',
    first_message_chars: (o.first_message || '').length,
    context: trim(o.context, CONTEXT_CHARS) || '',
    messages_user: o.messages_user || 0, messages_assistant: o.messages_assistant || 0,
    tools: uniq(o.tools || []).filter((t) => !/^mcp__/.test(t)), connectors: uniq([...(o.connectors || []), ...connectorsFromTools(o.tools || [])]),
    skills: uniq(o.skills || []), agents: uniq(o.agents || []),
    model: o.model || null, mode: o.mode || 'chat', trigger: o.trigger || 'human',
    project_hash: o.project ? sha(o.project) : null, resumed: !!o.resumed, classification: null,
  };
}

// ---------- Claude Code (local transcripts; also Desktop "Code" tab and teleported cloud sessions) ----------
export function claudeCode({ configDir } = {}) {
  const root = configDir || process.env.CLAUDE_CONFIG_DIR || join(home(), '.claude');
  const projects = join(root, 'projects');
  const out = { source: 'claude-code', found: existsSync(projects), path: projects, sessions: [], notes: [] };
  if (!out.found) return out;
  const scheduled = desktopScheduledCodeSessions();
  const byFirstUuid = new Map();
  for (const file of walk(projects, { filter: (p, n) => n.endsWith('.jsonl') && !n.startsWith('agent-') })) {
    const s = parseClaudeCodeTranscript(file, scheduled.has(basename(file, '.jsonl')) ? { scheduled: true } : {});
    if (!s) continue;
    // Resuming can write a second transcript: new sessionId on every record, same message uuids. Same conversation,
    // so keep the copy that ran longest.
    const twin = s.firstUuid ? byFirstUuid.get(s.firstUuid) : null;
    if (twin && new Date(twin.ended_at) >= new Date(s.ended_at)) continue;
    if (twin) out.sessions.splice(out.sessions.indexOf(twin), 1);
    if (s.firstUuid) byFirstUuid.set(s.firstUuid, s);
    out.sessions.push(s);
  }
  return out;
}

// The desktop app's Code tab keeps one local_<uuid>.json per session under claude-code-sessions/<account>/<org>/.
// The transcript itself is in ~/.claude/projects (file name = cliSessionId), so nothing is counted from here;
// the state file is only consulted for scheduledTaskId, because a scheduled run's origin.kind is "human".
function desktopScheduledCodeSessions() {
  const ids = new Set();
  for (const root of claudeDesktopRoots()) for (const file of walk(join(root, 'claude-code-sessions'), { maxDepth: 3, filter: (p, n) => /^local_.*\.json$/i.test(n) })) {
    const st = readJson(file, null);
    if (st && st.scheduledTaskId && st.cliSessionId) ids.add(String(st.cliSessionId));
  }
  return ids;
}

export function parseClaudeCodeTranscript(file, overrides = {}) {
  const recs = readJsonl(file);
  if (!recs.length) return null;
  // A forked session starts with a replay of its parent's records (parent sessionId), so the last record names this
  // file's session, and only its own records count: otherwise every fork repeats the parent's first message.
  const sessionId = [...recs].reverse().find((r) => r.sessionId)?.sessionId || basename(file, '.jsonl');
  const forked = recs.some((r) => r.sessionId && r.sessionId !== sessionId);
  const main = recs.filter((r) => !r.isSidechain && (!forked || !r.sessionId || r.sessionId === sessionId));
  const users = main.filter((r) => r.type === 'user' && r.message);
  const assistants = main.filter((r) => r.type === 'assistant' && r.message);
  // Background-task and CI notifications are user-role records too; they are not the person's words.
  const turns = users.filter((r) => !r.isMeta && !r.isCompactSummary && r.origin?.kind !== 'task-notification' && !(Array.isArray(r.message.content) && r.message.content.every((b) => b.type === 'tool_result')))
    .map((r) => ({ r, raw: textOf(r.message.content) })).map((t) => ({ ...t, text: cleanPrompt(t.raw) })).filter((t) => !isHarnessOnly(t.text)); // judge the cleaned text: a real prompt can arrive behind a <system-reminder> block
  const humanTurns = turns.map((t) => t.r);
  const promptTexts = turns.map((t) => t.text);
  if (!promptTexts.length) return null; // no human words in this file
  const times = main.map((r) => r.timestamp).filter(Boolean).sort();
  const first = humanTurns[0];
  const title = recs.find((r) => r.type === 'custom-title')?.customTitle || recs.find((r) => r.type === 'ai-title')?.aiTitle || recs.find((r) => r.type === 'summary')?.summary || null;
  const toolNames = assistants.flatMap((r) => (Array.isArray(r.message.content) ? r.message.content : []).filter((b) => b.type === 'tool_use').map((b) => b.name));
  const { skills, agents } = skillsAndAgents(users, assistants);
  // Headless pings: scripts and apps check that `claude -p` answers with a one-word prompt. Not a person using AI.
  if (surfaceFromEntrypoint(first?.entrypoint) === 'sdk' && promptTexts.length === 1 && promptTexts[0].length < 12 && !toolNames.length) return null;
  const originKind = first?.origin?.kind || first?.turnOrigin || 'human';
  // Desktop scheduled tasks run with origin.kind "human"; the <scheduled-task> wrapper (or the state file) is the tell.
  const scheduled = overrides.scheduled || /^\s*<scheduled-task[\s>]/.test(turns[0].raw);
  const trigger = scheduled ? 'scheduled' : /human|user/i.test(originKind) ? 'human' : String(originKind);
  const assistantIds = uniq(assistants.map((r) => r.message.id || r.uuid));
  // resumed: a gap of more than 4 hours between two human turns
  let resumed = false;
  for (let i = 1; i < humanTurns.length; i++) if (new Date(humanTurns[i].timestamp) - new Date(humanTurns[i - 1].timestamp) > 4 * 3600e3) { resumed = true; break; }
  const context = [promptTexts[1] ? 'Next: ' + trim(promptTexts[1], 300) : null, toolNames.length ? 'Tools: ' + uniq(toolNames).slice(0, 12).join(', ') : null, skills.length ? 'Skills: ' + skills.join(', ') : null, agents.length ? 'Agents: ' + agents.join(', ') : null, first?.gitBranch ? 'Branch: ' + first.gitBranch : null].filter(Boolean).join(' | ');
  return Object.defineProperty(baseSession({
    id: 's_claude-code_' + sessionId, source: overrides.source || 'claude-code', surface: overrides.surface || surfaceFromEntrypoint(first?.entrypoint),
    started_at: toISO(times[0]), ended_at: toISO(times[times.length - 1]), title, first_message: promptTexts[0], context,
    messages_user: promptTexts.length, messages_assistant: assistantIds.length, tools: toolNames, skills, agents,
    model: mostCommon(assistants.map((r) => r.message.model)), mode: trigger !== 'human' ? 'routine' : (toolNames.length ? 'agentic' : 'chat'),
    trigger, project: first?.cwd || null, resumed, active_minutes: activeMinutes(times),
  }), 'firstUuid', { value: forked ? null : first?.uuid || null, enumerable: false }); // not serialized
}

// ---------- Claude Desktop (Chat + Cowork sessions stored locally by the desktop app) ----------
export function claudeDesktopRoots() {
  const h = home(); const p = os();
  const roots = [];
  if (p === 'darwin') roots.push(join(h, 'Library', 'Application Support', 'Claude'), join(h, 'Library', 'Application Support', 'Claude-3p'));
  else if (p === 'win32') {
    for (const base of [process.env.LOCALAPPDATA, process.env.APPDATA, join(h, 'AppData', 'Local'), join(h, 'AppData', 'Roaming')]) if (base) roots.push(join(base, 'Claude'), join(base, 'Claude-3p'));
  } else roots.push(join(h, '.config', 'Claude'), join(h, '.config', 'Claude-3p'));
  return uniq(roots).filter((r) => existsSync(r));
}

export function claudeDesktop() {
  const roots = claudeDesktopRoots();
  const out = { source: 'claude-desktop', found: false, path: roots[0] || null, sessions: [], notes: [] };
  for (const root of roots) {
    const dir = join(root, 'local-agent-mode-sessions');
    if (!existsSync(dir)) continue;
    out.found = true; out.path = dir;
    const seen = new Set();
    const consumed = new Set(); // transcripts already merged into a state-file session
    for (const file of walk(dir, { maxDepth: 6, filter: (p, n) => /^local_.*\.json$/i.test(n) })) {
      const s = parseDesktopStateFile(file, consumed);
      if (s && !seen.has(s.id)) { seen.add(s.id); out.sessions.push(s); }
    }
    // Orphan transcripts (state file gone) inside session working directories, in Claude Code format.
    for (const file of walk(dir, { maxDepth: 8, filter: (p, n) => n.endsWith('.jsonl') && n !== 'audit.jsonl' && !n.startsWith('agent-') })) {
      if (consumed.has(file)) continue;
      const s = parseClaudeCodeTranscript(file, { source: 'claude-cowork', surface: 'cowork' });
      if (s && !seen.has(s.id)) { seen.add(s.id); out.sessions.push(s); }
    }
    if (!out.sessions.length) out.notes.push(`Found ${dir} but could not parse any session. Run: node scripts/how-i-ai.mjs inspect "<one local_*.json file>" and adapt lib/sources.mjs parseDesktopStateFile.`);
  }
  return out;
}

// Tolerant reader for local_<uuid>.json. The format is undocumented, so look for the usual suspects.
function pickKey(obj, keys) { for (const k of keys) if (obj && obj[k] != null && obj[k] !== '') return obj[k]; return null; }
function findMessages(obj, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 4) return null;
  for (const k of ['messages', 'chat_messages', 'transcript', 'turns', 'events', 'history', 'items']) {
    if (Array.isArray(obj[k]) && obj[k].length && typeof obj[k][0] === 'object') return obj[k];
  }
  for (const v of Object.values(obj)) { const r = findMessages(v, depth + 1); if (r) return r; }
  return null;
}
function roleOf(m) { return String(pickKey(m, ['role', 'sender', 'author', 'type', 'kind']) || (m.author && m.author.role) || '').toLowerCase(); }
function msgText(m) {
  const c = pickKey(m, ['text', 'content', 'message', 'prompt', 'display', 'body']);
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) return c.map((b) => (typeof b === 'string' ? b : b && (b.text || b.content || ''))).filter(Boolean).join('\n');
  if (c && typeof c === 'object') return msgText(c);
  return '';
}

// Verified on macOS (Claude Desktop, September 2026). local-agent-mode-sessions/<account>/<org>/ holds Cowork
// sessions only; Chat conversations are not written there. Per session:
//   local_<uuid>.json   metadata, no messages: sessionId ("local_<uuid>"), cliSessionId, title, initialMessage,
//                       createdAt / lastActivityAt (epoch ms), model, cwd, isArchived, processName, vmProcessName
//   local_<uuid>/       working dir: audit.jsonl, outputs/, uploads/, and a private Claude Code config dir with the
//                       transcript at .claude/projects/<encoded-cwd>/<cliSessionId>.jsonl (sub-agents under
//                       <cliSessionId>/subagents/agent-*.jsonl)
// audit.jsonl is the SDK message stream: type user|assistant|system|result|rate_limit_event, session_id,
// parent_tool_use_id (set on sub-agent records), isReplay, isSynthetic, message.content[] with tool_use blocks (tool name in .name).
// Never read from the state file: systemPrompt, accountName, emailAddress.
function coworkTranscript(workDir, cliSessionId) {
  if (!cliSessionId) return null;
  const projects = join(workDir, '.claude', 'projects');
  for (const f of walk(projects, { maxDepth: 1, filter: (p, n) => n === cliSessionId + '.jsonl' })) return f;
  return null;
}

function readAudit(file) {
  // isReplay marks the echo of a record already written; isSynthetic marks skill text injected as a user turn.
  const recs = readJsonl(file).filter((r) => r && r.message && !r.parent_tool_use_id && !r.isReplay && !r.isSynthetic);
  const users = recs.filter((r) => r.type === 'user'), assistants = recs.filter((r) => r.type === 'assistant');
  const prompts = users.filter((r) => !(Array.isArray(r.message.content) && r.message.content.every((b) => b.type === 'tool_result')))
    .map((r) => textOf(r.message.content)).filter((t) => !isHarnessOnly(t)).map((t) => cleanPrompt(t)).filter((t) => !isHarnessOnly(t));
  const tools = assistants.flatMap((r) => (Array.isArray(r.message.content) ? r.message.content : []).filter((b) => b.type === 'tool_use').map((b) => b.name));
  const times = recs.map((r) => r.timestamp).filter(Boolean).sort();
  return { prompts, tools, ...skillsAndAgents(users, assistants), assistants: uniq(assistants.map((r) => r.message.id || r.uuid)).length, model: mostCommon(assistants.map((r) => r.message.model)), last: times[times.length - 1] || null };
}

export function parseDesktopStateFile(file, consumed = new Set()) {
  const obj = readJson(file, null);
  if (!obj || typeof obj !== 'object') return null;
  const id = pickKey(obj, ['sessionId', 'id', 'uuid', 'session_id']) || basename(file, '.json');
  const times = fileTimes(file);
  const created = pickKey(obj, ['createdAt', 'created_at', 'startedAt', 'started_at', 'timestamp', 'created']);
  const updated = pickKey(obj, ['lastActivityAt', 'updatedAt', 'updated_at', 'endedAt', 'ended_at', 'modified']);
  const started_at = toISO(typeof created === 'number' ? fromEpoch(created) : created) || toISO(times?.birthtime) || toISO(times?.mtime);
  let ended_at = toISO(typeof updated === 'number' ? fromEpoch(updated) : updated) || toISO(times?.mtime) || started_at;
  const kindStr = JSON.stringify([pickKey(obj, ['mode', 'type', 'sessionType', 'session_type', 'kind', 'surface', 'product']), obj.isCowork, obj.cowork]).toLowerCase();
  // Real Cowork state files carry no mode key; the agent-process keys are the tell.
  const isCowork = !/chat/.test(kindStr) && (/cowork|agent|task/.test(kindStr) || obj.cliSessionId != null || obj.vmProcessName != null || obj.processName != null);
  const scheduled = obj.scheduledTaskId != null || /schedul|routine|recurring/.test(JSON.stringify([obj.scheduled, obj.schedule, obj.trigger, obj.source, obj.origin]).toLowerCase());
  const title = pickKey(obj, ['title', 'name', 'summary', 'subject']);
  const source = isCowork ? 'claude-cowork' : 'claude-desktop', surface = isCowork ? 'cowork' : 'desktop';
  const sid = 's_claude-desktop_' + String(id).replace(/^local_/, '');
  const workDir = [file.replace(/\.json$/i, ''), join(dirname(file), String(id))].find((d) => existsSync(d)) || file.replace(/\.json$/i, '');

  // 1. Transcript in the working directory (Claude Code shape): best source for messages, tools, skills, agents.
  const transcript = coworkTranscript(workDir, obj.cliSessionId);
  if (transcript) {
    const s = parseClaudeCodeTranscript(transcript, { source, surface, scheduled });
    if (s) {
      consumed.add(transcript);
      if (new Date(s.ended_at) > new Date(ended_at)) ended_at = s.ended_at;
      return { ...s, id: sid, title: trim(title, 200) || s.title, started_at: started_at || s.started_at, ended_at, model: s.model || obj.model || null };
    }
  }

  // 2. No transcript (cleaned up, or an older build): state-file fields plus audit.jsonl.
  const auditFile = join(workDir, 'audit.jsonl');
  const audit = existsSync(auditFile) ? readAudit(auditFile) : { prompts: [], tools: [], skills: [], agents: [], assistants: 0, model: null, last: null };
  if (!audit.tools.length && existsSync(auditFile)) for (const r of readJsonl(auditFile)) { const t = pickKey(r, ['tool', 'toolName', 'tool_name', 'name']); if (typeof t === 'string' && /tool|invoc|call/i.test(JSON.stringify(r).slice(0, 200))) audit.tools.push(t); }
  const msgs = findMessages(obj) || [];
  const humans = msgs.filter((m) => /user|human/.test(roleOf(m)));
  const assistants = msgs.filter((m) => /assistant|ai|claude|model/.test(roleOf(m)));
  let texts = humans.map((m) => cleanPrompt(msgText(m))).filter((t) => !isHarnessOnly(t));
  if (!texts.length) texts = audit.prompts;
  const initial = cleanPrompt(typeof obj.initialMessage === 'string' ? obj.initialMessage : '');
  if (!texts.length && initial && !isHarnessOnly(initial)) texts = [initial];
  const first = texts[0] || (title ? String(title) : '');
  if (!first) return null;
  if (audit.last && new Date(audit.last) > new Date(ended_at)) ended_at = toISO(audit.last);
  return baseSession({
    id: sid, source, surface, started_at, ended_at, title, first_message: first,
    context: [texts[1] ? 'Next: ' + trim(texts[1], 300) : null, audit.tools.length ? 'Tools: ' + uniq(audit.tools).slice(0, 12).join(', ') : null, audit.skills.length ? 'Skills: ' + audit.skills.join(', ') : null, audit.agents.length ? 'Agents: ' + audit.agents.join(', ') : null].filter(Boolean).join(' | '),
    messages_user: texts.length || (title ? 1 : 0), messages_assistant: assistants.length || audit.assistants, tools: audit.tools, skills: audit.skills, agents: audit.agents,
    model: pickKey(obj, ['model', 'modelId', 'model_id']) || audit.model, mode: scheduled ? 'routine' : (isCowork ? 'agentic' : 'chat'), trigger: scheduled ? 'scheduled' : 'human',
    project: pickKey(obj, ['cwd', 'folder', 'workingDirectory', 'projectId']),
  });
}

// ---------- Codex CLI / app ----------
export function codex({ codexHome } = {}) {
  const root = codexHome || process.env.CODEX_HOME || join(home(), '.codex');
  const dirs = [join(root, 'sessions'), join(root, 'archived_sessions')].filter((d) => existsSync(d));
  const out = { source: 'codex', found: dirs.length > 0, path: dirs[0] || join(root, 'sessions'), sessions: [], notes: [] };
  const seen = new Set();
  // session_index.jsonl: one { id, thread_name, updated_at } line per thread. Only source of a title.
  const names = new Map(readJsonl(join(root, 'session_index.jsonl')).filter((r) => r && r.id && r.thread_name).map((r) => [String(r.id), String(r.thread_name)]));
  for (const dir of dirs) for (const file of walk(dir, { maxDepth: 6, filter: (p, n) => n.endsWith('.jsonl') })) {
    const s = parseCodexRollout(file);
    if (s && !seen.has(s.id)) { seen.add(s.id); if (!s.title) s.title = trim(names.get(s.id.replace(/^s_codex_/, '')), 200) || null; out.sessions.push(s); }
  }
  return out;
}

export function parseCodexRollout(file) {
  const recs = readJsonl(file);
  if (!recs.length) return null;
  const meta = recs.find((r) => r.type === 'session_meta')?.payload || {};
  const id = meta.id || meta.session_id || basename(file, '.jsonl').replace(/^rollout-/, '');
  const times = recs.map((r) => r.timestamp).filter(Boolean).sort();
  // The person's prompt, by build: CLI writes event_msg/user_message { message }; the desktop app (0.155, Sept 2026)
  // writes event_msg/item_completed { item: { type: 'UserMessage', content: [{ type: 'text', text }] } } and no user_message.
  const items = recs.filter((r) => r.type === 'event_msg' && r.payload && r.payload.type === 'item_completed' && r.payload.item).map((r) => r.payload.item);
  const itemText = (it) => (Array.isArray(it.content) ? it.content.map((c) => (c && typeof c.text === 'string' ? c.text : '')).filter(Boolean).join('\n') : String(it.content || ''));
  const userEvents = [
    ...recs.filter((r) => r.type === 'event_msg' && r.payload && r.payload.type === 'user_message').map((r) => r.payload.message),
    ...items.filter((it) => it.type === 'UserMessage').map(itemText),
  ];
  // Fallback: user-role response_items. Injected context shares the role, one content item each (<environment_context>,
  // <recommended_plugins>, ...), so judge items one by one; content_item_kinds names the real one 'user.text' when present.
  const userItems = recs.filter((r) => r.type === 'response_item' && r.payload && r.payload.type === 'message' && r.payload.role === 'user').map((r) => {
    const kinds = r.payload.internal_chat_message_metadata_passthrough?.content_item_kinds;
    const parts = Array.isArray(r.payload.content) ? r.payload.content.map((c) => c.text || '') : [String(r.payload.content || '')];
    return parts.filter((t, i) => (Array.isArray(kinds) && kinds[i] ? kinds[i] === 'user.text' : !/^\s*<[a-z_][\w -]*>/i.test(t))).join('\n');
  });
  const prompts = (userEvents.length ? userEvents : userItems).map((t) => cleanPrompt(t)).filter((t) => !isHarnessOnly(t) && !/^<(environment_context|user_instructions|permissions instructions|turn_aborted)/i.test(t) && !/^# AGENTS\.md/i.test(t));
  if (!prompts.length) return null;
  const assistantItems = recs.filter((r) => r.type === 'response_item' && r.payload?.type === 'message' && r.payload.role === 'assistant');
  const assistants = assistantItems.length ? assistantItems : [...recs.filter((r) => r.type === 'event_msg' && r.payload?.type === 'agent_message'), ...items.filter((it) => it.type === 'AgentMessage')];
  // Desktop builds route shell and MCP calls through one custom_tool_call named "exec"; the MCP server and tool only
  // show up on the item_completed McpToolCall item { server, tool }.
  const mcpItems = items.filter((it) => it.type === 'McpToolCall' && it.server);
  const tools = [...recs.filter((r) => r.type === 'response_item' && r.payload && /^(function_call|custom_tool_call|local_shell_call|mcp_tool_call|web_search_call)$/.test(r.payload.type))
    .map((r) => r.payload.name || r.payload.type.replace(/_call$/, '')), ...mcpItems.map((it) => `mcp__${it.server}__${it.tool || 'call'}`)];
  const connectors = uniq([...recs.filter((r) => r.type === 'response_item' && r.payload?.type === 'mcp_tool_call').map((r) => r.payload.server), ...mcpItems.map((it) => it.server)].filter(Boolean));
  const model = mostCommon(recs.filter((r) => r.type === 'turn_context').map((r) => r.payload?.model)) || meta.model || null;
  const cwd = meta.cwd || recs.find((r) => r.type === 'turn_context')?.payload?.cwd || null;
  // originator wins over source: the desktop app reports source "vscode" with originator "Codex Desktop" / "codex_work_desktop".
  const originator = String(meta.originator || meta.source || '').toLowerCase();
  const surface = /app|desktop|gui/.test(originator) ? 'desktop' : /vscode|ide/.test(originator) ? 'ide' : 'cli';
  return baseSession({
    id: 's_codex_' + id, source: 'codex', surface, started_at: toISO(meta.timestamp || times[0]), ended_at: toISO(times[times.length - 1] || meta.timestamp),
    title: null, first_message: prompts[0], context: [prompts[1] ? 'Next: ' + trim(prompts[1], 300) : null, tools.length ? 'Tools: ' + uniq(tools).slice(0, 12).join(', ') : null].filter(Boolean).join(' | '),
    messages_user: prompts.length, messages_assistant: assistants.length, tools, connectors, model,
    mode: tools.length ? 'agentic' : 'chat', trigger: 'human', project: cwd,
  });
}

// Where a codex binary can be. The ChatGPT desktop app ships one inside its bundle and does not put it on PATH
// (verified on macOS: ChatGPT.app/Contents/Resources/codex). The Windows locations are unverified guesses at the
// same layout; a wrong guess just falls through.
export function codexBinaries() {
  const h = home(); const p = os(); const list = [];
  if (process.env.HOW_I_AI_CODEX_BIN) list.push(process.env.HOW_I_AI_CODEX_BIN);
  if (process.env.CODEX_CLI_PATH) list.push(process.env.CODEX_CLI_PATH);
  list.push(p === 'win32' ? 'codex.exe' : 'codex'); // on PATH
  if (p === 'darwin') for (const apps of ['/Applications', join(h, 'Applications')]) for (const app of ['ChatGPT.app', 'Codex.app']) list.push(join(apps, app, 'Contents', 'Resources', 'codex'));
  if (p === 'win32') {
    const la = process.env.LOCALAPPDATA || join(h, 'AppData', 'Local');
    for (const name of ['ChatGPT', 'Codex']) list.push(join(la, 'Programs', name, 'resources', 'codex.exe'), join(la, name, 'resources', 'codex.exe'));
    const wa = join(process.env.ProgramFiles || 'C:\\Program Files', 'WindowsApps');
    try { for (const d of readdirSync(wa)) if (/^OpenAI\.(ChatGPT|Codex)/i.test(d)) list.push(join(wa, d, 'app', 'resources', 'codex.exe')); } catch { /* WindowsApps is not listable without elevation */ }
  }
  return uniq(list).filter((b) => !/[\\/]/.test(b) || existsSync(b));
}

// Codex cloud tasks via the official CLI: on PATH, or the copy inside the ChatGPT desktop app.
export function codexCloud() {
  const out = { source: 'codex', found: false, path: 'codex cloud list --json', sessions: [], notes: [] };
  let bin = null;
  for (const b of codexBinaries()) { try { execFileSync(b, ['--version'], { encoding: 'utf8', timeout: 10000, stdio: ['ignore', 'pipe', 'ignore'] }); bin = b; break; } catch { /* next candidate */ } }
  if (!bin) { out.notes.push('codex CLI not found on PATH or inside the ChatGPT app; cloud tasks skipped'); return out; }
  // `codex cloud` writes an error.log with the account id into its working directory. Give it a throwaway one.
  const scratch = mkdtempSync(join(tmpdir(), 'how-i-ai-codex-'));
  try { return codexCloudList(bin, scratch, out); } finally { rmSync(scratch, { recursive: true, force: true }); }
}

function codexCloudList(bin, cwd, out) {
  let cursor = null;
  for (let page = 0; page < 10; page++) {
    let text;
    try {
      const args = ['cloud', 'list', '--json', '--limit', '20', ...(cursor ? ['--cursor', cursor] : [])];
      text = execFileSync(bin, args, { cwd, encoding: 'utf8', timeout: 30000, stdio: ['ignore', 'pipe', 'ignore'] });
    } catch (e) {
      if (page === 0) { out.notes.push('codex CLI found but `cloud list` failed (not signed in?); cloud tasks skipped'); return out; }
      break;
    }
    out.found = true;
    let data; try { data = JSON.parse(text); } catch { break; }
    const tasks = Array.isArray(data) ? data : data.tasks || [];
    for (const t of tasks) {
      const started = toISO(t.created_at || t.updated_at); if (!started) continue;
      out.sessions.push(baseSession({
        id: 's_codex-cloud_' + t.id, source: 'codex', surface: 'cloud', started_at: started, ended_at: toISO(t.updated_at) || started,
        title: t.title || null, first_message: t.title || t.summary || '', context: t.summary ? trim(t.summary, 300) : '',
        messages_user: 1, messages_assistant: 1, tools: [], model: null, mode: 'agentic', trigger: t.is_review ? 'review' : 'human', project: t.environment_label || null,
      }));
    }
    cursor = data.cursor; if (!cursor || !tasks.length) break;
  }
  return out;
}

// ---------- Claude Code cloud sessions (list exported by Claude from inside a cloud session) ----------
export function claudeCloud(file) {
  const out = { source: 'claude-code', found: false, path: file || null, sessions: [], notes: [] };
  if (!file || !existsSync(file)) return out;
  const data = readJson(file, null);
  const list = Array.isArray(data) ? data : data?.ccr?.data || data?.data || data?.sessions || [];
  out.found = true;
  for (const s of list) {
    if (!s || !s.id) continue;
    if (String(s.environment_kind || '').includes('bridge')) continue; // Remote Control mirror of a local session, already counted
    const started = toISO(s.created_at); if (!started) continue;
    const originStr = String(s.origin || '').toLowerCase();
    const isRoutine = /routine|schedul|trigger/.test(originStr) || (s.tags || []).some((t) => /routine|schedule/.test(String(t)));
    out.sessions.push(baseSession({
      id: 's_claude-cloud_' + s.id, source: 'claude-code', surface: 'cloud', started_at: started, ended_at: toISO(s.updated_at) || started,
      title: s.title || null, first_message: s.title || '', context: 'Cloud session; only the title is available locally',
      messages_user: 1, messages_assistant: 1, tools: [], model: s.session_context?.model || s.configured_model || null,
      mode: isRoutine ? 'routine' : 'agentic', trigger: isRoutine ? 'routine' : 'human',
      project: s.session_context?.sources?.[0]?.git_repository?.url || null,
    }));
  }
  return out;
}

// ---------- Exports dropped in the inbox (ChatGPT and claude.ai data exports) ----------
export function exportsInbox(inbox) {
  const results = [];
  if (!existsSync(inbox)) return results;
  const candidates = [];
  for (const name of readdirSync(inbox)) {
    const p = join(inbox, name);
    let st; try { st = statSync(p); } catch { continue; }
    if (st.isFile() && /\.zip$/i.test(name)) candidates.push({ kind: 'zip', path: p });
    else if (st.isFile() && /^conversations\.json$/i.test(name)) candidates.push({ kind: 'json', path: p });
    else if (st.isDirectory()) { const c = join(p, 'conversations.json'); if (existsSync(c)) candidates.push({ kind: 'json', path: c }); }
  }
  for (const c of candidates) {
    let text = null;
    try { text = c.kind === 'zip' ? readZipText(c.path, (n) => /(^|\/)conversations\.json$/i.test(n)) : readJson(c.path) && null; } catch (e) { results.push({ source: 'export', found: true, path: c.path, sessions: [], notes: ['could not read: ' + e.message] }); continue; }
    let data;
    try { data = c.kind === 'zip' ? JSON.parse(text) : readJson(c.path); } catch (e) { results.push({ source: 'export', found: true, path: c.path, sessions: [], notes: ['conversations.json is not valid JSON: ' + e.message] }); continue; }
    if (!Array.isArray(data)) { results.push({ source: 'export', found: true, path: c.path, sessions: [], notes: ['conversations.json is not an array'] }); continue; }
    if (data.length && data[0].mapping) results.push({ ...parseChatGPTExport(data), path: c.path });
    else if (data.length && (data[0].chat_messages || data[0].uuid)) results.push({ ...parseClaudeExport(data), path: c.path });
    else results.push({ source: 'export', found: true, path: c.path, sessions: [], notes: ['unrecognized conversations.json shape'] });
  }
  return results;
}

export function parseChatGPTExport(convs) {
  const out = { source: 'chatgpt-export', found: true, path: null, sessions: [], notes: [] };
  for (const c of convs) {
    const nodes = Object.values(c.mapping || {}).map((n) => n && n.message).filter(Boolean);
    const visible = nodes.filter((m) => !(m.metadata && m.metadata.is_visually_hidden_from_conversation));
    const byTime = (a, b) => (a.create_time || 0) - (b.create_time || 0);
    const users = visible.filter((m) => m.author?.role === 'user').sort(byTime);
    const assistants = visible.filter((m) => m.author?.role === 'assistant');
    const partsText = (m) => (m.content?.parts || []).filter((p) => typeof p === 'string').join('\n') || (typeof m.content?.text === 'string' ? m.content.text : '');
    const prompts = users.map((m) => cleanPrompt(partsText(m))).filter((t) => !isHarnessOnly(t));
    if (!prompts.length) continue;
    const toolAuthors = uniq(nodes.filter((m) => m.author?.role === 'tool').map((m) => m.author.name).filter(Boolean));
    const contentTools = uniq(nodes.filter((m) => m.author?.role === 'assistant' && m.content?.content_type === 'code').map(() => 'python'));
    const tools = uniq([...toolAuthors, ...contentTools].map((t) => String(t).replace(/^dalle\.text2im$/, 'image')));
    const model = mostCommon(assistants.map((m) => m.metadata?.model_slug)) || c.default_model_slug || null;
    const started = fromEpoch(c.create_time) || fromEpoch(users[0].create_time);
    const ended = fromEpoch(c.update_time) || started;
    const ctx = [prompts[1] ? 'Next: ' + trim(prompts[1], 300) : null, c.gizmo_id ? 'Custom GPT' : null, tools.length ? 'Tools: ' + tools.slice(0, 8).join(', ') : null].filter(Boolean).join(' | ');
    out.sessions.push(baseSession({
      id: 's_chatgpt_' + (c.id || c.conversation_id || sha(c.title + c.create_time)), source: 'chatgpt-export', surface: c.gizmo_id ? 'gpt' : 'export',
      started_at: toISO(started), ended_at: toISO(ended), title: c.title, first_message: prompts[0], context: ctx,
      messages_user: prompts.length, messages_assistant: assistants.length, tools, model, mode: 'chat', trigger: 'human',
    }));
  }
  return out;
}

export function parseClaudeExport(convs) {
  const out = { source: 'claude-export', found: true, path: null, sessions: [], notes: [] };
  for (const c of convs) {
    const msgs = (c.chat_messages || []).slice().sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const humans = msgs.filter((m) => m.sender === 'human');
    const assistants = msgs.filter((m) => m.sender === 'assistant');
    const textOfMsg = (m) => (typeof m.text === 'string' && m.text) || (Array.isArray(m.content) ? m.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n') : '');
    const prompts = humans.map((m) => cleanPrompt(textOfMsg(m))).filter((t) => !isHarnessOnly(t));
    if (!prompts.length) continue;
    const tools = uniq(msgs.flatMap((m) => (Array.isArray(m.content) ? m.content : []).filter((b) => b.type === 'tool_use').map((b) => b.name)).filter(Boolean));
    out.sessions.push(baseSession({
      id: 's_claude-export_' + (c.uuid || sha(c.name + c.created_at)), source: 'claude-export', surface: 'export',
      started_at: toISO(c.created_at) || toISO(humans[0].created_at), ended_at: toISO(c.updated_at) || toISO(c.created_at),
      title: c.name || null, first_message: prompts[0],
      context: [prompts[1] ? 'Next: ' + trim(prompts[1], 300) : null, tools.length ? 'Tools: ' + tools.slice(0, 8).join(', ') : null].filter(Boolean).join(' | '),
      messages_user: prompts.length, messages_assistant: assistants.length, tools, model: c.model || null, mode: 'chat', trigger: 'human',
    }));
  }
  return out;
}

// ---------- ChatGPT conversations listed from inside the ChatGPT desktop app ----------
// Only an agent hosted by the ChatGPT app has the app's list_threads / read_thread tools (the bundled CLI does not:
// they need a pipe the app hands its own agents). That agent follows PROMPT-chatgpt-app.md and writes what it read to
// <inbox>/chatgpt-app-threads.json in the shape below; this turns it into sessions. Same id space as the ChatGPT
// export, so a conversation present in both is counted once.
//   { "source": "chatgpt-app", "exported_at": ISO, "threads": [ { "id", "kind": "chatgpt", "title", "created_at",
//     "updated_at", "first_message", "second_message", "messages_user", "messages_assistant", "model", "tools": [] } ] }
export function chatgptAppThreads(inbox) {
  const file = join(inbox, 'chatgpt-app-threads.json');
  const out = { source: 'chatgpt-app', found: existsSync(file), path: file, sessions: [], notes: [] };
  if (!out.found) return out;
  const data = readJson(file, null);
  const threads = Array.isArray(data) ? data : data?.threads;
  if (!Array.isArray(threads)) { out.notes.push('chatgpt-app-threads.json has no threads array; see PROMPT-chatgpt-app.md for the shape'); return out; }
  const when = (v) => toISO(typeof v === 'number' || /^\d+(\.\d+)?$/.test(String(v ?? '')) ? fromEpoch(v) : v);
  for (const t of threads) {
    if (!t || (t.kind && t.kind !== 'chatgpt')) continue; // kind "codex" threads are the rollout files, already read
    const id = pickKey(t, ['id', 'threadId', 'thread_id', 'conversation_id']);
    const first = cleanPrompt(pickKey(t, ['first_message', 'firstMessage']) || '');
    const title = pickKey(t, ['title', 'name']);
    const started = when(pickKey(t, ['created_at', 'createdAt', 'create_time'])) || when(pickKey(t, ['updated_at', 'updatedAt', 'update_time']));
    if (!id || !started || (!first && !title)) continue;
    const second = cleanPrompt(pickKey(t, ['second_message', 'secondMessage']) || '');
    const tools = Array.isArray(t.tools) ? t.tools.map(String) : [];
    out.sessions.push(baseSession({
      id: 's_chatgpt_' + id, source: 'chatgpt-app', surface: 'desktop', started_at: started, ended_at: when(pickKey(t, ['updated_at', 'updatedAt', 'update_time'])) || started,
      title, first_message: first || String(title), context: [second ? 'Next: ' + trim(second, 300) : null, tools.length ? 'Tools: ' + tools.slice(0, 8).join(', ') : null, first ? null : 'Only the title is available'].filter(Boolean).join(' | '),
      messages_user: Number(t.messages_user) || 1, messages_assistant: Number(t.messages_assistant) || (first ? 1 : 0), tools, model: t.model || null, mode: 'chat', trigger: 'human',
    }));
  }
  return out;
}

// ---------- ChatGPT desktop app: presence and cache size only ----------
// Message bodies are encrypted on macOS (Keychain key scoped to OpenAI's Team ID) and volatile
// on Windows (a Chromium IndexedDB write-ahead log wiped on logout). We never try to read them.
// What we report: the app is installed, how many conversation bundles its cache holds, and when
// it was last written. The official export is the route for content.
// The merged ChatGPT/Codex app keeps a thread catalog in $CODEX_HOME/sqlite/codex-dev.db. Table local_thread_catalog has
// one row per thread the app has listed: source_kind "chatgpt" for ChatGPT conversations, "vscode" for local Codex
// threads (those are the rollout files), with source_updated_at in epoch seconds. It holds titles, never message
// bodies, and only the conversations the app has shown, so it is a signal, not history. Only count and max(updated)
// are queried; display_title is never selected. Needs node:sqlite (Node 22.5+); older Node just skips it.
function chatgptCatalogSignal() {
  const db = join(process.env.CODEX_HOME || join(home(), '.codex'), 'sqlite', 'codex-dev.db');
  if (!existsSync(db) || typeof process.getBuiltinModule !== 'function') return null;
  let conn;
  try {
    const sqlite = process.getBuiltinModule('node:sqlite');
    if (!sqlite) return null;
    conn = new sqlite.DatabaseSync(db, { readOnly: true });
    const row = conn.prepare("SELECT count(*) AS n, max(source_updated_at) AS last FROM local_thread_catalog WHERE source_kind = 'chatgpt'").get();
    return row && row.n ? { count: Number(row.n), last: fromEpoch(row.last) } : null;
  } catch { return null; } finally { try { conn?.close(); } catch { /* already closed */ } }
}

export function chatgptDesktop() {
  const h = home(); const p = os();
  const roots = [];
  if (p === 'darwin') roots.push(join(h, 'Library', 'Application Support', 'com.openai.chat'), join(h, 'Library', 'Application Support', 'Codex'));
  else if (p === 'win32') {
    const la = process.env.LOCALAPPDATA || join(h, 'AppData', 'Local');
    const pk = join(la, 'Packages');
    try { for (const d of readdirSync(pk)) if (/^OpenAI\.ChatGPT-Desktop_/i.test(d)) roots.push(join(pk, d, 'LocalCache', 'Roaming', 'ChatGPT')); } catch { /* no packages dir */ }
    roots.push(join(process.env.APPDATA || join(h, 'AppData', 'Roaming'), 'OpenAI', 'ChatGPT'), join(la, 'OpenAI', 'ChatGPT'));
  }
  const out = { source: 'chatgpt-desktop', found: false, path: null, sessions: [], notes: [], signal: null };
  for (const root of roots) {
    if (!existsSync(root)) continue;
    out.found = true; out.path = root;
    let bundles = 0, files = 0, last = 0;
    try {
      for (const d of readdirSync(root)) {
        if (!/^conversations-v\d+-/i.test(d)) continue;
        bundles++;
        for (const f of walk(join(root, d), { maxDepth: 2, filter: (fp, n) => n.endsWith('.data') })) { files++; const t = fileTimes(f); if (t && t.mtime > last) last = t.mtime; }
      }
      if (!bundles) { // Windows layout: IndexedDB folder only
        const idb = join(root, 'IndexedDB');
        if (existsSync(idb)) for (const f of walk(idb, { maxDepth: 3 })) { const t = fileTimes(f); if (t && t.mtime > last) last = t.mtime; }
      }
      if (!last) { // Merged ChatGPT/Codex app (bundle com.openai.codex): a plain Chromium profile, no conversation cache.
        // stat only, never opened: these are touched whenever the app runs.
        for (const f of ['Local State', join('Default', 'Preferences'), join('Default', 'Network Persistent State'), 'Default']) { const t = fileTimes(join(root, f)); if (t && t.mtime > last) last = t.mtime; }
      }
    } catch { /* unreadable */ }
    const catalog = files ? null : chatgptCatalogSignal();
    if (catalog) { files = catalog.count; if (catalog.last && catalog.last > last) last = catalog.last; }
    out.signal = { installed: true, layout: bundles ? 'conversation-cache' : existsSync(join(root, 'IndexedDB')) ? 'indexeddb' : 'chromium-profile', cached_conversations: files || null, last_activity: last ? toISO(last) : null };
    out.notes.push(`ChatGPT desktop app found${files ? ` with ${files} ${catalog ? 'catalogued conversation(s)' : 'cached conversation file(s)'}` : ''}${last ? `, last active ${localDate(toISO(last))}` : ''}. Its cache is encrypted or partial, so request the export for content.`);
    break;
  }
  return out;
}
