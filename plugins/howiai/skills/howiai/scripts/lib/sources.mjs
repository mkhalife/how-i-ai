// One parser per source. Each returns { found, path, sessions: Session[], notes: string[] }.
// A Session follows references/data-schema.md section 1.
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  home, os, walk, readJsonl, readJson, fileTimes, toISO, fromEpoch, trim, cleanPrompt, isHarnessOnly,
  mostCommon, uniq, sha, minutesBetween,
} from './util.mjs';
import { readZipText } from './zip.mjs';

const FIRST_MESSAGE_CHARS = 2000;
const CONTEXT_CHARS = 600;

function surfaceFromEntrypoint(ep) {
  const e = String(ep || '').toLowerCase();
  if (e.includes('remote')) return 'cloud';
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
  return uniq(tools.filter((t) => /^mcp__/.test(t)).map((t) => t.split('__')[1]));
}

function baseSession(o) {
  return {
    id: o.id, source: o.source, surface: o.surface || 'cli', started_at: o.started_at, ended_at: o.ended_at || o.started_at,
    duration_minutes: minutesBetween(o.started_at, o.ended_at || o.started_at),
    title: trim(o.title, 200) || null,
    first_message: trim(o.first_message, FIRST_MESSAGE_CHARS) || '',
    first_message_chars: (o.first_message || '').length,
    context: trim(o.context, CONTEXT_CHARS) || '',
    messages_user: o.messages_user || 0, messages_assistant: o.messages_assistant || 0,
    tools: uniq(o.tools || []).filter((t) => !/^mcp__/.test(t)), connectors: uniq([...(o.connectors || []), ...connectorsFromTools(o.tools || [])]),
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
  for (const file of walk(projects, { filter: (p, n) => n.endsWith('.jsonl') && !n.startsWith('agent-') })) {
    const s = parseClaudeCodeTranscript(file);
    if (s) out.sessions.push(s);
  }
  return out;
}

export function parseClaudeCodeTranscript(file, overrides = {}) {
  const recs = readJsonl(file);
  if (!recs.length) return null;
  const main = recs.filter((r) => !r.isSidechain);
  const users = main.filter((r) => r.type === 'user' && r.message);
  const assistants = main.filter((r) => r.type === 'assistant' && r.message);
  const humanTurns = users.filter((r) => !r.isMeta && !r.isCompactSummary && !(Array.isArray(r.message.content) && r.message.content.every((b) => b.type === 'tool_result')));
  const promptTexts = humanTurns.map((r) => cleanPrompt(textOf(r.message.content))).filter((t) => !isHarnessOnly(t));
  if (!promptTexts.length) return null; // no human words in this file
  const times = main.map((r) => r.timestamp).filter(Boolean).sort();
  const first = humanTurns[0] || users[0] || main[0];
  const sessionId = first?.sessionId || recs.find((r) => r.sessionId)?.sessionId || basename(file, '.jsonl');
  const title = recs.find((r) => r.type === 'custom-title')?.customTitle || recs.find((r) => r.type === 'ai-title')?.aiTitle || recs.find((r) => r.type === 'summary')?.summary || null;
  const toolNames = assistants.flatMap((r) => (Array.isArray(r.message.content) ? r.message.content : []).filter((b) => b.type === 'tool_use').map((b) => b.name));
  const originKind = first?.origin?.kind || first?.turnOrigin || 'human';
  const trigger = /human|user/i.test(originKind) ? 'human' : String(originKind);
  const assistantIds = uniq(assistants.map((r) => r.message.id || r.uuid));
  // resumed: a gap of more than 4 hours between two human turns
  let resumed = false;
  for (let i = 1; i < humanTurns.length; i++) if (new Date(humanTurns[i].timestamp) - new Date(humanTurns[i - 1].timestamp) > 4 * 3600e3) { resumed = true; break; }
  const context = [promptTexts[1] ? 'Next: ' + trim(promptTexts[1], 300) : null, toolNames.length ? 'Tools: ' + uniq(toolNames).slice(0, 12).join(', ') : null, first?.gitBranch ? 'Branch: ' + first.gitBranch : null].filter(Boolean).join(' | ');
  return baseSession({
    id: 's_claude-code_' + sessionId, source: overrides.source || 'claude-code', surface: overrides.surface || surfaceFromEntrypoint(first?.entrypoint),
    started_at: toISO(times[0]), ended_at: toISO(times[times.length - 1]), title, first_message: promptTexts[0], context,
    messages_user: promptTexts.length, messages_assistant: assistantIds.length, tools: toolNames,
    model: mostCommon(assistants.map((r) => r.message.model)), mode: trigger !== 'human' ? 'routine' : (toolNames.length ? 'agentic' : 'chat'),
    trigger, project: first?.cwd || null, resumed,
  });
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
    for (const file of walk(dir, { maxDepth: 6, filter: (p, n) => /^local_.*\.json$/i.test(n) })) {
      const s = parseDesktopStateFile(file);
      if (s && !seen.has(s.id)) { seen.add(s.id); out.sessions.push(s); }
    }
    // Transcripts written inside session working directories in Claude Code format.
    for (const file of walk(dir, { maxDepth: 8, filter: (p, n) => n.endsWith('.jsonl') && n !== 'audit.jsonl' && !n.startsWith('agent-') })) {
      const s = parseClaudeCodeTranscript(file, { source: 'claude-cowork', surface: 'cowork' });
      if (s && !seen.has(s.id)) { seen.add(s.id); out.sessions.push(s); }
    }
    if (!out.sessions.length) out.notes.push(`Found ${dir} but could not parse any session. Run: node scripts/howiai.mjs inspect "<one local_*.json file>" and adapt lib/sources.mjs parseDesktopStateFile.`);
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

export function parseDesktopStateFile(file) {
  const obj = readJson(file, null);
  if (!obj || typeof obj !== 'object') return null;
  const id = pickKey(obj, ['id', 'uuid', 'sessionId', 'session_id']) || basename(file, '.json').replace(/^local_/, '');
  const times = fileTimes(file);
  const created = pickKey(obj, ['createdAt', 'created_at', 'startedAt', 'started_at', 'timestamp', 'created']);
  const updated = pickKey(obj, ['updatedAt', 'updated_at', 'lastActivityAt', 'endedAt', 'ended_at', 'modified']);
  const started_at = toISO(typeof created === 'number' ? fromEpoch(created) : created) || toISO(times?.birthtime) || toISO(times?.mtime);
  const ended_at = toISO(typeof updated === 'number' ? fromEpoch(updated) : updated) || toISO(times?.mtime) || started_at;
  const kindStr = JSON.stringify([pickKey(obj, ['mode', 'type', 'sessionType', 'session_type', 'kind', 'surface', 'product']), obj.isCowork, obj.cowork]).toLowerCase();
  const isCowork = /cowork|agent|task/.test(kindStr) && !/chat/.test(kindStr);
  const msgs = findMessages(obj) || [];
  const humans = msgs.filter((m) => /user|human/.test(roleOf(m)));
  const assistants = msgs.filter((m) => /assistant|ai|claude|model/.test(roleOf(m)));
  const texts = humans.map((m) => cleanPrompt(msgText(m))).filter((t) => !isHarnessOnly(t));
  const title = pickKey(obj, ['title', 'name', 'summary', 'subject']);
  const first = texts[0] || (title ? String(title) : '');
  if (!first) return null;
  const toolNames = [];
  const audit = join(dirname(file), String(id), 'audit.jsonl');
  if (existsSync(audit)) for (const r of readJsonl(audit)) { const t = pickKey(r, ['tool', 'toolName', 'tool_name', 'name']); if (typeof t === 'string' && /tool|invoc|call/i.test(JSON.stringify(r).slice(0, 200))) toolNames.push(t); }
  const scheduled = /schedul|routine|recurring/.test(JSON.stringify([obj.scheduled, obj.schedule, obj.trigger, obj.source, obj.origin]).toLowerCase());
  return baseSession({
    id: 's_claude-desktop_' + id, source: isCowork ? 'claude-cowork' : 'claude-desktop', surface: isCowork ? 'cowork' : 'desktop',
    started_at, ended_at, title, first_message: first,
    context: [texts[1] ? 'Next: ' + trim(texts[1], 300) : null, toolNames.length ? 'Tools: ' + uniq(toolNames).slice(0, 12).join(', ') : null].filter(Boolean).join(' | '),
    messages_user: texts.length || (title ? 1 : 0), messages_assistant: assistants.length, tools: toolNames,
    model: pickKey(obj, ['model', 'modelId', 'model_id']), mode: scheduled ? 'routine' : (isCowork ? 'agentic' : 'chat'), trigger: scheduled ? 'scheduled' : 'human',
    project: pickKey(obj, ['cwd', 'folder', 'workingDirectory', 'projectId']),
  });
}

// ---------- Codex CLI / app ----------
export function codex({ codexHome } = {}) {
  const root = codexHome || process.env.CODEX_HOME || join(home(), '.codex');
  const dirs = [join(root, 'sessions'), join(root, 'archived_sessions')].filter((d) => existsSync(d));
  const out = { source: 'codex', found: dirs.length > 0, path: dirs[0] || join(root, 'sessions'), sessions: [], notes: [] };
  const seen = new Set();
  for (const dir of dirs) for (const file of walk(dir, { maxDepth: 6, filter: (p, n) => n.endsWith('.jsonl') })) {
    const s = parseCodexRollout(file);
    if (s && !seen.has(s.id)) { seen.add(s.id); out.sessions.push(s); }
  }
  return out;
}

export function parseCodexRollout(file) {
  const recs = readJsonl(file);
  if (!recs.length) return null;
  const meta = recs.find((r) => r.type === 'session_meta')?.payload || {};
  const id = meta.id || meta.session_id || basename(file, '.jsonl').replace(/^rollout-/, '');
  const times = recs.map((r) => r.timestamp).filter(Boolean).sort();
  const userEvents = recs.filter((r) => r.type === 'event_msg' && r.payload && r.payload.type === 'user_message').map((r) => r.payload.message);
  const userItems = recs.filter((r) => r.type === 'response_item' && r.payload && r.payload.type === 'message' && r.payload.role === 'user')
    .map((r) => (Array.isArray(r.payload.content) ? r.payload.content.map((c) => c.text || '').join('\n') : String(r.payload.content || '')));
  const prompts = (userEvents.length ? userEvents : userItems).map((t) => cleanPrompt(t)).filter((t) => !isHarnessOnly(t) && !/^<(environment_context|user_instructions|permissions instructions|turn_aborted)/i.test(t) && !/^# AGENTS\.md/i.test(t));
  if (!prompts.length) return null;
  const assistants = recs.filter((r) => (r.type === 'event_msg' && r.payload?.type === 'agent_message') || (r.type === 'response_item' && r.payload?.type === 'message' && r.payload.role === 'assistant'));
  const tools = recs.filter((r) => r.type === 'response_item' && r.payload && /^(function_call|custom_tool_call|local_shell_call|mcp_tool_call|web_search_call)$/.test(r.payload.type))
    .map((r) => r.payload.name || r.payload.type.replace(/_call$/, ''));
  const connectors = uniq(recs.filter((r) => r.type === 'response_item' && r.payload?.type === 'mcp_tool_call').map((r) => r.payload.server).filter(Boolean));
  const model = mostCommon(recs.filter((r) => r.type === 'turn_context').map((r) => r.payload?.model)) || meta.model || null;
  const cwd = meta.cwd || recs.find((r) => r.type === 'turn_context')?.payload?.cwd || null;
  const originator = String(meta.originator || meta.source || '').toLowerCase();
  const surface = /vscode|ide/.test(originator) ? 'ide' : /app|desktop|gui/.test(originator) ? 'desktop' : 'cli';
  return baseSession({
    id: 's_codex_' + id, source: 'codex', surface, started_at: toISO(meta.timestamp || times[0]), ended_at: toISO(times[times.length - 1] || meta.timestamp),
    title: null, first_message: prompts[0], context: [prompts[1] ? 'Next: ' + trim(prompts[1], 300) : null, tools.length ? 'Tools: ' + uniq(tools).slice(0, 12).join(', ') : null].filter(Boolean).join(' | '),
    messages_user: prompts.length, messages_assistant: assistants.length, tools, connectors, model,
    mode: tools.length ? 'agentic' : 'chat', trigger: 'human', project: cwd,
  });
}

// Codex cloud tasks via the official CLI, when installed.
export function codexCloud() {
  const out = { source: 'codex', found: false, path: 'codex cloud list --json', sessions: [], notes: [] };
  let cursor = null;
  for (let page = 0; page < 10; page++) {
    let text;
    try {
      const args = ['cloud', 'list', '--json', '--limit', '20', ...(cursor ? ['--cursor', cursor] : [])];
      text = execFileSync('codex', args, { encoding: 'utf8', timeout: 20000, stdio: ['ignore', 'pipe', 'ignore'] });
    } catch (e) {
      if (page === 0) { out.notes.push('codex CLI not available or not signed in; cloud tasks skipped'); return out; }
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

// ---------- Gemini CLI (optional extra) ----------
export function geminiCli() {
  const root = join(home(), '.gemini', 'tmp');
  const out = { source: 'gemini-cli', found: existsSync(root), path: root, sessions: [], notes: [] };
  if (!out.found) return out;
  for (const file of walk(root, { maxDepth: 4, filter: (p, n) => /chats/.test(p) && /\.jsonl?$/.test(n) })) {
    let recs = file.endsWith('.jsonl') ? readJsonl(file) : (() => { const j = readJson(file, null); return j ? (Array.isArray(j.messages) ? j.messages : Array.isArray(j) ? j : []) : []; })();
    const users = recs.filter((r) => /^(user|human)$/i.test(r.type || r.role || ''));
    const texts = users.map((r) => cleanPrompt(typeof r.content === 'string' ? r.content : Array.isArray(r.content) ? r.content.map((p) => p.text || '').join('\n') : r.text || '')).filter((t) => !isHarnessOnly(t));
    if (!texts.length) continue;
    const meta = recs.find((r) => r.type === 'session_metadata') || {};
    const times = recs.map((r) => r.timestamp).filter(Boolean).sort();
    const t = fileTimes(file);
    out.sessions.push(baseSession({
      id: 's_gemini_' + (meta.sessionId || meta.id || basename(file).replace(/\.\w+$/, '')), source: 'gemini-cli', surface: 'cli',
      started_at: toISO(times[0] || meta.startTime || t?.birthtime), ended_at: toISO(times[times.length - 1] || t?.mtime), title: null, first_message: texts[0],
      context: texts[1] ? 'Next: ' + trim(texts[1], 300) : '', messages_user: texts.length, messages_assistant: recs.filter((r) => /^(gemini|assistant|model)$/i.test(r.type || r.role || '')).length,
      tools: uniq(recs.flatMap((r) => (r.toolCalls || r.tool_calls || []).map((c) => c.name)).filter(Boolean)), model: meta.model || null, mode: 'agentic', trigger: 'human', project: dirname(dirname(file)),
    }));
  }
  return out;
}
