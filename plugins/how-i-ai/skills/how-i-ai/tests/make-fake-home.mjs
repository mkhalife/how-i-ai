#!/usr/bin/env node
// Builds a fake home directory with synthetic session files for every source,
// in either the macOS or Windows layout, so the pipeline can be tested end to end.
//   node tests/make-fake-home.mjs <dir> [darwin|win32]
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateRawSync } from 'node:zlib';

const [dir, plat = 'darwin'] = process.argv.slice(2);
if (!dir) { console.error('usage: make-fake-home.mjs <dir> [darwin|win32]'); process.exit(2); }
const D = (p) => { mkdirSync(p, { recursive: true }); return p; };
const now = Date.now();
const daysAgo = (d, h = 10) => new Date(now - d * 86400e3 - (10 - h) * 3600e3);
const iso = (d) => d.toISOString();

// ---- Claude Code ----
const projects = D(join(dir, '.claude', 'projects', '-Users-me-work-app'));
function ccSession(id, start, prompt, tools, opts = {}) {
  const lines = [...(opts.parentLines || [])]; // a forked session starts with its parent's records, parent sessionId and all
  const t0 = start.getTime();
  const dir = opts.dir || projects;
  lines.push({ type: 'ai-title', aiTitle: opts.title || 'Session ' + id, sessionId: id });
  lines.push({ parentUuid: null, isSidechain: false, type: 'user', message: { role: 'user', content: prompt }, uuid: id + '-1', timestamp: iso(new Date(t0)), origin: { kind: opts.origin || 'human' }, entrypoint: opts.entrypoint || 'cli', cwd: '/Users/me/work/app', sessionId: id, version: '2.1.270', gitBranch: 'main' });
  let i = 2;
  for (const tool of tools) {
    // subagent_type is optional on the real Agent tool (omitted = general-purpose)
    const input = tool === 'Skill' ? { skill: opts.skill || 'code-review' } : tool === 'Agent' ? { ...(opts.agent ? { subagent_type: opts.agent } : {}), description: 'x', prompt: 'x' } : {};
    lines.push({ isSidechain: false, type: 'assistant', message: { id: 'msg_' + id + i, role: 'assistant', model: 'claude-opus-4-1', content: [{ type: 'tool_use', id: 'tu' + i, name: tool, input }] }, uuid: id + '-' + i, timestamp: iso(new Date(t0 + i * 60e3)), cwd: '/Users/me/work/app', sessionId: id });
    lines.push({ isSidechain: false, type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tu' + i, content: 'ok' }] }, uuid: id + '-' + (i + 1), timestamp: iso(new Date(t0 + i * 60e3 + 5e3)), cwd: '/Users/me/work/app', sessionId: id });
    i += 2;
  }
  lines.push({ isSidechain: false, type: 'assistant', message: { id: 'msg_' + id + 'z', role: 'assistant', model: 'claude-opus-4-1', content: [{ type: 'text', text: 'Done.' }] }, uuid: id + '-z', timestamp: iso(new Date(t0 + i * 60e3)), cwd: '/Users/me/work/app', sessionId: id });
  if (opts.second) lines.push({ isSidechain: false, type: 'user', message: { role: 'user', content: opts.second }, uuid: id + '-s', timestamp: iso(new Date(t0 + (i + 1) * 60e3)), cwd: '/Users/me/work/app', sessionId: id });
  // Background-task notifications are user-role records with origin.kind "task-notification"; not a human turn.
  if (opts.notification) lines.push({ isSidechain: false, type: 'user', message: { role: 'user', content: '<task-notification>\n<task-id>t1</task-id>\n<status>completed</status>\n<summary>Agent finished</summary>\n</task-notification>' }, origin: { kind: 'task-notification' }, promptSource: 'system', uuid: id + '-n', timestamp: iso(new Date(t0 + (i + 2) * 60e3)), cwd: '/Users/me/work/app', sessionId: id });
  writeFileSync(join(dir, id + '.jsonl'), lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
  return lines;
}
// slash command as text blocks (seen on real data next to the plain-string shape)
ccSession('aaaa-1', daysAgo(2, 9), 'Add a feature flag for the new checkout flow and write tests for it', ['Read', 'Edit', 'Bash', 'Skill', 'Agent', 'mcp__github__create_pull_request'], { title: 'Checkout feature flag', second: [{ type: 'text', text: '<command-name>/simplify</command-name>\n<command-message>simplify</command-message>' }], skill: 'code-review', agent: 'evidence-researcher', notification: true });
ccSession('aaaa-2', daysAgo(5, 14), '<command-name>/clear</command-name>', [], {});
ccSession('aaaa-3', daysAgo(5, 15), 'Why does this test pass locally but fail in CI? Here is the log: ...', ['Bash', 'Grep'], { entrypoint: 'desktop' });
ccSession('aaaa-4', daysAgo(1, 7), 'Nightly: review open PRs and summarize', ['Bash', 'mcp__github__list_pull_requests'], { origin: 'routine', entrypoint: 'remote_web' });
ccSession('aaaa-5', daysAgo(45, 11), 'Old session outside the window', ['Read'], {});
ccSession('aaaa-6', daysAgo(3, 22), 'Explain how OAuth refresh tokens work, I am a designer', [], { title: 'OAuth explained' });
// Desktop scheduled task: origin.kind is "human"; the <scheduled-task> wrapper and the state file's scheduledTaskId are the tell.
ccSession('aaaa-7', daysAgo(1, 6), '<scheduled-task name="morning-brief" file="/Users/me/.claude/scheduled-tasks/morning-brief/SKILL.md">\nSummarize what changed in the repo since yesterday\n</scheduled-task>', ['Bash', 'Agent'], { entrypoint: 'claude-desktop' });
// Fork: the file is named for the new session and replays the parent's records first.
const parentLines = ccSession('aaaa-8', daysAgo(4, 9), 'Sketch two approaches for the billing migration', ['Read']);
ccSession('aaaa-9', daysAgo(4, 10), 'Go with the second approach and draft the plan', ['Write'], { parentLines });
// Resume copy: same conversation re-stamped with a new sessionId, message uuids unchanged; the longer copy wins.
{
  const orig = ccSession('aaaa-11', daysAgo(6, 9), 'Draft the quarterly investor update from these notes', ['Read', 'Write']);
  const copy = orig.map((l) => ({ ...l, sessionId: 'aaaa-12' }));
  copy.push({ isSidechain: false, type: 'user', message: { role: 'user', content: 'Tighten the intro' }, uuid: 'aaaa-12-more', timestamp: iso(daysAgo(5, 9)), cwd: '/Users/me/work/app', sessionId: 'aaaa-12' });
  writeFileSync(join(projects, 'aaaa-12.jsonl'), copy.map((l) => JSON.stringify(l)).join('\n') + '\n');
}
// headless connectivity ping (entrypoint sdk-cli, one word, no tools): not a session
ccSession('aaaa-10', daysAgo(3, 8), 'Hello', [], { entrypoint: 'sdk-cli' });
// sidechain file must be ignored
writeFileSync(join(projects, 'agent-xyz.jsonl'), JSON.stringify({ isSidechain: true, type: 'user', message: { role: 'user', content: 'subagent prompt' }, timestamp: iso(daysAgo(2)), sessionId: 'aaaa-1' }) + '\n');

// ---- Claude Desktop (Chat + Cowork) ----
const appData = plat === 'win32' ? join(dir, 'AppData', 'Local', 'Claude') : join(dir, 'Library', 'Application Support', 'Claude');
const lam = D(join(appData, 'local-agent-mode-sessions', 'acct_123', 'org_456'));
// Unverified guess at a Chat state file (messages inline). Real machines so far hold only Cowork sessions here;
// kept so the tolerant fallback stays covered.
function legacyDesktopSession(id, start, kind, title, prompts) {
  const state = { id, title, createdAt: iso(start), updatedAt: iso(new Date(start.getTime() + 20 * 60e3)), sessionType: kind, messages: prompts.flatMap((p, i) => [{ role: 'user', content: p, createdAt: iso(new Date(start.getTime() + i * 120e3)) }, { role: 'assistant', content: [{ type: 'text', text: 'Sure.' }] }]) };
  writeFileSync(join(lam, `local_${id}.json`), JSON.stringify(state, null, 1));
}
// Real Cowork shape (macOS, September 2026): metadata-only state file; transcript in the working dir's own
// .claude/projects as Claude Code JSONL named <cliSessionId>.jsonl; audit.jsonl is the SDK message stream.
function coworkSession(id, start, title, prompt, tools, { transcript = true, skill = null } = {}) {
  const sessionId = `local_${id}`, cli = `cli-${id}`, wd = D(join(lam, sessionId)), cwd = join(wd, 'outputs');
  const t0 = start.getTime();
  const state = { sessionId, processName: 'brave-tender-newton', cliSessionId: cli, cwd, userSelectedFolders: [], createdAt: t0, lastActivityAt: t0 + 20 * 60e3, model: 'claude-sonnet-4-6', isArchived: false, title, vmProcessName: 'brave-tender-newton', hostLoopMode: true, initialMessage: prompt, slashCommands: [], enabledMcpTools: {}, remoteMcpServersConfig: [{ uuid: '11111111-2222-4333-8444-555555555555', name: 'Google Drive', tools: [] }], egressAllowedDomains: [], memoryEnabled: true, skillsEnabled: true, pluginsEnabled: true, systemPrompt: 'never read this', accountName: 'Test Person', emailAddress: 'test.person@example.com' };
  writeFileSync(join(lam, `${sessionId}.json`), JSON.stringify(state, null, 1));
  D(join(wd, 'outputs')); D(join(wd, 'uploads'));
  const stamp = (r, ms) => ({ ...r, session_id: cli, timestamp: iso(new Date(t0 + ms)), _audit_timestamp: iso(new Date(t0 + ms)), _audit_hmac: 'x'.repeat(64) });
  const audit = [
    stamp({ type: 'user', uuid: 'u0', parent_tool_use_id: null, client_platform: 'desktop_app', message: { role: 'user', content: prompt } }, 0),
    stamp({ type: 'user', uuid: 'u0', parent_tool_use_id: null, isReplay: true, message: { role: 'user', content: prompt } }, 1),
    stamp({ type: 'system', subtype: 'init', cwd, tools: tools, mcp_servers: [], model: 'claude-sonnet-4-6', permissionMode: 'default', slash_commands: [], agents: [], skills: [], plugins: [], uuid: 's0' }, 2),
    ...tools.flatMap((t, i) => [
      stamp({ type: 'assistant', uuid: 'a' + i, parent_tool_use_id: null, request_id: 'req', message: { model: 'claude-sonnet-4-6', id: 'msg_' + id + i, type: 'message', role: 'assistant', content: [{ type: 'tool_use', id: 'tu' + i, name: t, input: t === 'Skill' ? { skill } : {}, caller: { type: 'direct' } }] } }, (i + 1) * 60e3),
      stamp({ type: 'user', uuid: 'r' + i, parent_tool_use_id: null, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tu' + i, content: 'ok' }] } }, (i + 1) * 60e3 + 5e3),
    ]),
    ...(skill ? [stamp({ type: 'user', uuid: 'syn', parent_tool_use_id: null, isSynthetic: true, message: { role: 'user', content: [{ type: 'text', text: 'Base directory for this skill: ...' }] } }, 30e3)] : []),
    stamp({ type: 'assistant', uuid: 'sub', parent_tool_use_id: 'tu0', message: { model: 'claude-haiku-4-5', id: 'msg_sub', role: 'assistant', content: [{ type: 'tool_use', id: 'tus', name: 'SubagentOnlyTool', input: {} }] } }, 90e3),
    stamp({ type: 'result', subtype: 'success', is_error: false, num_turns: tools.length + 1, result: 'Done.', origin: { kind: 'human' }, uuid: 'res' }, 19 * 60e3),
  ];
  writeFileSync(join(wd, 'audit.jsonl'), audit.map((l) => JSON.stringify(l)).join('\n') + '\n');
  if (transcript) {
    const enc = D(join(wd, '.claude', 'projects', '-sessions-' + id + '-outputs'));
    ccSession(cli, start, prompt, tools, { dir: enc, entrypoint: 'local-agent', skill, title: 'ai title, state title wins' });
    D(join(enc, cli, 'subagents')); writeFileSync(join(enc, cli, 'subagents', 'agent-a1.jsonl'), JSON.stringify({ isSidechain: true, type: 'user', message: { role: 'user', content: 'subagent prompt' }, timestamp: iso(start), sessionId: cli }) + '\n');
  }
}
legacyDesktopSession('d1', daysAgo(4, 11), 'chat', 'Critique onboarding screens', ['Critique these onboarding screens for clarity and hierarchy', 'Now check contrast against WCAG AA']);
// claude.ai connectors are mcp__<uuid>__tool in transcripts; remoteMcpServersConfig in the state file maps uuid → name
coworkSession('d2', daysAgo(6, 16), 'Interview synthesis', 'Read the 12 interview transcripts in this folder and cluster them into themes', ['Read', 'Write', 'Skill', 'mcp__11111111-2222-4333-8444-555555555555__search_files'], { skill: 'research-synthesis' });
// transcript already cleaned up: state file + audit.jsonl only
coworkSession('d3', daysAgo(0, 8), 'Birthday party', "Help me plan my 6 year old's birthday party for 12 kids on a $300 budget", ['WebSearch', 'Write'], { transcript: false });
writeFileSync(join(lam, 'scheduled-tasks.json'), JSON.stringify({ scheduledTasks: [], recordedSkips: {} }));

// Desktop "Code" tab: state files only; transcripts are the ~/.claude/projects files above, so nothing here may be counted twice.
const ccs = D(join(appData, 'claude-code-sessions', 'acct_123', 'org_456'));
writeFileSync(join(ccs, 'local_code3.json'), JSON.stringify({ sessionId: 'local_code3', cliSessionId: 'aaaa-3', cwd: '/Users/me/work/app', originCwd: '/Users/me/work/app', createdAt: daysAgo(5, 15).getTime(), lastActivityAt: daysAgo(5, 16).getTime(), model: 'claude-opus-4-1', isArchived: false, title: 'CI failure', titleSource: 'auto', permissionMode: 'default' }));
writeFileSync(join(ccs, 'local_code7.json'), JSON.stringify({ sessionId: 'local_code7', cliSessionId: 'aaaa-7', cwd: '/Users/me/work/app', originCwd: '/Users/me/work/app', createdAt: daysAgo(1, 6).getTime(), lastActivityAt: daysAgo(1, 6).getTime(), model: 'claude-opus-4-1', isArchived: false, title: 'Morning brief', scheduledTaskId: 'morning-brief', permissionMode: 'auto' }));

// ---- Codex ----
const codexDir = D(join(dir, '.codex', 'sessions', '2026', '09', '10'));
function codexSession(id, start, prompt, tools) {
  const t0 = start.getTime();
  const lines = [
    { timestamp: iso(start), type: 'session_meta', payload: { id, timestamp: iso(start), cwd: '/Users/me/work/api', originator: 'codex_cli_rs', cli_version: '0.140.0', instructions: null } },
    { timestamp: iso(start), type: 'turn_context', payload: { cwd: '/Users/me/work/api', model: 'gpt-5-codex', approval_policy: 'on-request' } },
    { timestamp: iso(start), type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: '<environment_context>cwd=/x</environment_context>' }] } },
    { timestamp: iso(start), type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: prompt }] } },
    { timestamp: iso(start), type: 'event_msg', payload: { type: 'user_message', message: prompt } },
    ...tools.map((t, i) => ({ timestamp: iso(new Date(t0 + (i + 1) * 30e3)), type: 'response_item', payload: { type: 'function_call', name: t, arguments: '{}', call_id: 'c' + i } })),
    { timestamp: iso(new Date(t0 + 300e3)), type: 'event_msg', payload: { type: 'agent_message', message: 'Done.' } },
  ];
  writeFileSync(join(codexDir, `rollout-2026-09-10T10-00-00-${id}.jsonl`), lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
}
// Desktop app build (0.155, September 2026): no user_message event; prompt is an item_completed UserMessage, injected
// context shares the user role, shell and MCP go through custom_tool_call "exec", MCP detail is on the McpToolCall item.
function codexDesktopSession(id, start, prompt, threadName) {
  const t0 = start.getTime(); const at = (ms) => iso(new Date(t0 + ms)); let n = 0;
  const rec = (ms, type, payload) => ({ timestamp: at(ms), ordinal: n++, type, payload });
  const meta = (kinds) => ({ turn_id: 't1', content_item_kinds: kinds });
  const lines = [
    rec(0, 'session_meta', { session_id: id, id, timestamp: at(0), cwd: '/Users/me/Documents/Codex/x', originator: 'Codex Desktop', cli_version: '0.155.0-alpha.9.2', source: 'vscode', thread_source: 'user', model_provider: 'openai', base_instructions: { text: '...' } }),
    rec(0, 'event_msg', { type: 'task_started', turn_id: 't1', started_at: t0 / 1000 }),
    rec(1, 'response_item', { type: 'message', role: 'developer', content: [{ type: 'input_text', text: '<app-context>...</app-context>' }], internal_chat_message_metadata_passthrough: meta(['generic.developer_instructions']) }),
    rec(2, 'response_item', { type: 'message', role: 'user', content: [{ type: 'input_text', text: '<recommended_plugins>...</recommended_plugins>' }, { type: 'input_text', text: '<environment_context>cwd=/x</environment_context>' }], internal_chat_message_metadata_passthrough: meta(['plugins.recommendations', 'environments.environment_context']) }),
    rec(3, 'response_item', { type: 'message', role: 'user', content: [{ type: 'input_text', text: prompt }], internal_chat_message_metadata_passthrough: meta(['user.text']) }),
    rec(3, 'world_state', { full: true, state: { model: 'gpt-6' } }),
    rec(3, 'turn_context', { turn_id: 't1', cwd: '/Users/me/Documents/Codex/x', model: 'gpt-6', effort: 'medium' }),
    rec(4, 'event_msg', { type: 'item_completed', thread_id: id, turn_id: 't1', item: { type: 'UserMessage', id: 'i1', client_id: 'c1', content: [{ type: 'text', text: prompt, text_elements: [] }] } }),
    rec(30e3, 'response_item', { type: 'custom_tool_call', id: 'ctc1', status: 'completed', call_id: 'call1', name: 'exec', input: '...' }),
    rec(31e3, 'response_item', { type: 'custom_tool_call_output', call_id: 'call1', output: 'ok' }),
    rec(32e3, 'event_msg', { type: 'item_completed', thread_id: id, turn_id: 't1', item: { type: 'McpToolCall', id: 'i2', server: 'notion', tool: 'search', arguments: {}, pluginId: 'p', status: 'completed', result: {}, duration: { secs: 1, nanos: 0 } } }),
    rec(60e3, 'response_item', { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Done.' }] }),
    rec(60e3, 'event_msg', { type: 'item_completed', thread_id: id, turn_id: 't1', item: { type: 'AgentMessage', id: 'i3', content: [{ type: 'Text', text: 'Done.' }], phase: 'final' } }),
    rec(61e3, 'event_msg', { type: 'task_complete', turn_id: 't1' }),
  ];
  writeFileSync(join(codexDir, `rollout-2026-09-10T11-00-00-${id}.jsonl`), lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
  writeFileSync(join(dir, '.codex', 'session_index.jsonl'), JSON.stringify({ id, thread_name: threadName, updated_at: at(61e3) }) + '\n');
}
codexDesktopSession('c3', daysAgo(1, 12), 'Find the meeting notes from last week and list the open action items', 'Open action items');
codexSession('c1', daysAgo(9, 10), 'Migrate the users endpoint from REST to gRPC and keep the tests green', ['shell', 'apply_patch']);
codexSession('c2', daysAgo(12, 13), 'Write a GitHub Action that labels PRs by changed path', ['shell']);

// ---- exports in the inbox ----
const inbox = D(join(dir, 'how-i-ai', 'inbox'));
const chatgpt = [
  conv('g1', daysAgo(3, 12), 'Draft PRD for transfer alerts', ['Turn these rough notes into a PRD for transfer bonus alerts: ...', 'Shorter, and lead with the customer problem'], 'gpt-5'),
  conv('g2', daysAgo(8, 20), 'Half marathon plan', ['Build me a 12 week half marathon plan, I run 3x a week now'], 'gpt-5'),
  conv('g3', daysAgo(15, 9), 'SQL funnel', ['Write SQL to find where the signup funnel drops off. Tables: users, events'], 'gpt-5', true),
  conv('g4', daysAgo(60, 9), 'Old chat', ['too old to count'], 'gpt-4o'),
];
function conv(id, start, title, prompts, model, withPython = false) {
  const mapping = {}; let parent = null; let i = 0;
  const add = (msg) => { const nid = id + '-' + (i++); mapping[nid] = { id: nid, parent, children: [], message: msg }; if (parent) mapping[parent].children.push(nid); parent = nid; return nid; };
  add(null); // root
  add({ id: 's', author: { role: 'system' }, create_time: start.getTime() / 1000, content: { content_type: 'text', parts: [''] }, metadata: { is_visually_hidden_from_conversation: true } });
  prompts.forEach((p, k) => {
    add({ id: 'u' + k, author: { role: 'user' }, create_time: start.getTime() / 1000 + k * 100, content: { content_type: 'text', parts: [p] }, metadata: {} });
    if (withPython) add({ id: 't' + k, author: { role: 'assistant' }, create_time: start.getTime() / 1000 + k * 100 + 5, content: { content_type: 'code', text: 'print(1)' }, metadata: { model_slug: model } });
    add({ id: 'a' + k, author: { role: 'assistant' }, create_time: start.getTime() / 1000 + k * 100 + 10, content: { content_type: 'text', parts: ['Here you go'] }, metadata: { model_slug: model } });
  });
  return { id, title, create_time: start.getTime() / 1000, update_time: start.getTime() / 1000 + 900, mapping, current_node: parent, gizmo_id: null, default_model_slug: model };
}
const claude = [
  { uuid: 'k1', name: 'Roadmap tradeoffs', created_at: iso(daysAgo(7, 15)), updated_at: iso(daysAgo(7, 16)), chat_messages: [{ uuid: 'm1', sender: 'human', text: 'Weigh these three roadmap bets against our retention goal', created_at: iso(daysAgo(7, 15)), content: [{ type: 'text', text: 'Weigh these three roadmap bets against our retention goal' }] }, { uuid: 'm2', sender: 'assistant', text: 'Bet one...', created_at: iso(daysAgo(7, 15)), content: [{ type: 'text', text: 'Bet one...' }] }] },
  { uuid: 'k2', name: 'Landlord note', created_at: iso(daysAgo(11, 21)), updated_at: iso(daysAgo(11, 21)), chat_messages: [{ uuid: 'm3', sender: 'human', text: 'Draft a polite note to my landlord about the broken heater', created_at: iso(daysAgo(11, 21)) }, { uuid: 'm4', sender: 'assistant', text: 'Dear...', created_at: iso(daysAgo(11, 21)), content: [{ type: 'tool_use', name: 'artifacts' }] }] },
];
const gptInbox = D(join(dir, 'how-i-ai-chatgpt', 'inbox'));
writeFileSync(join(gptInbox, 'chatgpt-export.zip'), zip([['conversations.json', JSON.stringify(chatgpt)], ['user.json', '{}']], true));
writeFileSync(join(inbox, 'claude-export.zip'), zip([['data-2026/conversations.json', JSON.stringify(claude)], ['data-2026/projects.json', '[]']], false));

// ---- ChatGPT conversations as written by the agent inside the ChatGPT desktop app (PROMPT-chatgpt-app.md)
writeFileSync(join(gptInbox, 'chatgpt-app-threads.json'), JSON.stringify({ source: 'chatgpt-app', exported_at: iso(new Date()), threads: [
  { id: 'app1', kind: 'chatgpt', title: 'Offsite agenda', created_at: iso(daysAgo(2, 15)), updated_at: iso(daysAgo(2, 16)), first_message: 'Draft an agenda for a two day team offsite focused on planning', second_message: 'Make day two lighter', messages_user: 2, messages_assistant: 2, model: 'gpt-6', tools: [] },
  { id: 'g1', kind: 'chatgpt', title: 'Draft PRD for transfer alerts', created_at: daysAgo(3, 12).getTime() / 1000, updated_at: daysAgo(3, 12).getTime() / 1000 + 900, first_message: 'same conversation as the export, must not be counted twice' },
  { id: 'c3', kind: 'codex', title: 'a local codex thread, already read from its rollout', created_at: iso(daysAgo(1, 12)), first_message: 'skip me' },
] }));
// A codex binary that is not on PATH, where the ChatGPT app keeps it (Windows path is a guess at the same layout).
{
  const bin = plat === 'win32' ? join(dir, 'AppData', 'Local', 'Programs', 'ChatGPT', 'resources', 'codex.exe') : join(dir, 'Applications', 'ChatGPT.app', 'Contents', 'Resources', 'codex');
  D(join(bin, '..'));
  writeFileSync(bin, `#!/bin/sh\nif [ "$1" = "--version" ]; then echo "codex-cli 0.0.0-test"; exit 0; fi\necho '${JSON.stringify({ tasks: [{ id: 'task_cloud1', title: 'Bump dependencies and fix the lockfile', summary: 'Opened a PR', created_at: iso(daysAgo(2, 10)), updated_at: iso(daysAgo(2, 11)), environment_label: 'org/repo', is_review: false }], cursor: null })}'\n`, { mode: 0o755 });
}

// ---- ChatGPT desktop app cache (encrypted on macOS, so only counted)
const gptRoot = plat === 'win32' ? join(dir, 'AppData', 'Local', 'Packages', 'OpenAI.ChatGPT-Desktop_2p2nqsd0c76g0', 'LocalCache', 'Roaming', 'ChatGPT', 'IndexedDB', 'https_chatgpt.com_0.indexeddb.leveldb') : join(dir, 'Library', 'Application Support', 'com.openai.chat', 'conversations-v3-1111');
D(gptRoot); writeFileSync(join(gptRoot, plat === 'win32' ? '000003.log' : 'abc.data'), Buffer.from([1, 2, 3, 4]));

// ---- cloud sessions list (as exported from inside a claude.ai/code session) ----
writeFileSync(join(dir, 'how-i-ai', 'cloud-sessions.json'), JSON.stringify({ ccr: { data: [
  { id: 'session_cloud1', title: 'Fix flaky CI on the api repo', created_at: iso(daysAgo(2, 13)), updated_at: iso(daysAgo(2, 14)), origin: 'web', environment_kind: 'anthropic_cloud', session_context: { model: 'claude-opus-4-1' } },
  { id: 'session_bridge1', title: 'mirror of a local session', created_at: iso(daysAgo(2, 13)), updated_at: iso(daysAgo(2, 14)), origin: 'claude_code_cli', environment_kind: 'bridge' },
] } }));

console.log(`fake ${plat} home at ${dir}`);

// minimal zip writer
function zip(files, deflate) {
  const parts = []; const central = []; let offset = 0;
  for (const [name, text] of files) {
    const data = Buffer.from(text, 'utf8'); const comp = deflate ? deflateRawSync(data) : data; const crc = crc32(data); const nameB = Buffer.from(name);
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0, 6); local.writeUInt16LE(deflate ? 8 : 0, 8); local.writeUInt16LE(0, 10); local.writeUInt16LE(0, 12); local.writeUInt32LE(crc, 14); local.writeUInt32LE(comp.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nameB.length, 26); local.writeUInt16LE(0, 28);
    parts.push(local, nameB, comp);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0, 8); c.writeUInt16LE(deflate ? 8 : 0, 10); c.writeUInt16LE(0, 12); c.writeUInt16LE(0, 14); c.writeUInt32LE(crc, 16); c.writeUInt32LE(comp.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(nameB.length, 28); c.writeUInt16LE(0, 30); c.writeUInt16LE(0, 32); c.writeUInt16LE(0, 34); c.writeUInt16LE(0, 36); c.writeUInt32LE(0, 38); c.writeUInt32LE(offset, 42);
    central.push(c, nameB); offset += local.length + nameB.length + comp.length;
  }
  const cd = Buffer.concat(central); const eocd = Buffer.alloc(22); eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(0, 4); eocd.writeUInt16LE(0, 6); eocd.writeUInt16LE(files.length, 8); eocd.writeUInt16LE(files.length, 10); eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(offset, 16); eocd.writeUInt16LE(0, 20);
  return Buffer.concat([...parts, cd, eocd]);
}
function crc32(buf) { let c, crc = 0xffffffff; for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ 0xffffffff) >>> 0; }
