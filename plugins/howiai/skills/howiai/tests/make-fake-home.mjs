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
  const lines = [];
  const t0 = start.getTime();
  lines.push({ type: 'ai-title', aiTitle: opts.title || 'Session ' + id, sessionId: id });
  lines.push({ parentUuid: null, isSidechain: false, type: 'user', message: { role: 'user', content: prompt }, uuid: id + '-1', timestamp: iso(new Date(t0)), origin: { kind: opts.origin || 'human' }, entrypoint: opts.entrypoint || 'cli', cwd: '/Users/me/work/app', sessionId: id, version: '2.1.270', gitBranch: 'main' });
  let i = 2;
  for (const tool of tools) {
    lines.push({ isSidechain: false, type: 'assistant', message: { id: 'msg_' + id + i, role: 'assistant', model: 'claude-opus-4-1', content: [{ type: 'tool_use', id: 'tu' + i, name: tool, input: {} }] }, uuid: id + '-' + i, timestamp: iso(new Date(t0 + i * 60e3)), cwd: '/Users/me/work/app', sessionId: id });
    lines.push({ isSidechain: false, type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tu' + i, content: 'ok' }] }, uuid: id + '-' + (i + 1), timestamp: iso(new Date(t0 + i * 60e3 + 5e3)), cwd: '/Users/me/work/app', sessionId: id });
    i += 2;
  }
  lines.push({ isSidechain: false, type: 'assistant', message: { id: 'msg_' + id + 'z', role: 'assistant', model: 'claude-opus-4-1', content: [{ type: 'text', text: 'Done.' }] }, uuid: id + '-z', timestamp: iso(new Date(t0 + i * 60e3)), cwd: '/Users/me/work/app', sessionId: id });
  if (opts.second) lines.push({ isSidechain: false, type: 'user', message: { role: 'user', content: opts.second }, uuid: id + '-s', timestamp: iso(new Date(t0 + (i + 1) * 60e3)), cwd: '/Users/me/work/app', sessionId: id });
  writeFileSync(join(projects, id + '.jsonl'), lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
}
ccSession('aaaa-1', daysAgo(2, 9), 'Add a feature flag for the new checkout flow and write tests for it', ['Read', 'Edit', 'Bash', 'mcp__github__create_pull_request'], { title: 'Checkout feature flag', second: 'now run the full test suite' });
ccSession('aaaa-2', daysAgo(5, 14), '<command-name>/clear</command-name>', [], {});
ccSession('aaaa-3', daysAgo(5, 15), 'Why does this test pass locally but fail in CI? Here is the log: ...', ['Bash', 'Grep'], { entrypoint: 'desktop' });
ccSession('aaaa-4', daysAgo(1, 7), 'Nightly: review open PRs and summarize', ['Bash', 'mcp__github__list_pull_requests'], { origin: 'routine', entrypoint: 'remote_web' });
ccSession('aaaa-5', daysAgo(45, 11), 'Old session outside the window', ['Read'], {});
ccSession('aaaa-6', daysAgo(3, 22), 'Explain how OAuth refresh tokens work, I am a designer', [], { title: 'OAuth explained' });
// sidechain file must be ignored
writeFileSync(join(projects, 'agent-xyz.jsonl'), JSON.stringify({ isSidechain: true, type: 'user', message: { role: 'user', content: 'subagent prompt' }, timestamp: iso(daysAgo(2)), sessionId: 'aaaa-1' }) + '\n');

// ---- Claude Desktop (Chat + Cowork) ----
const appData = plat === 'win32' ? join(dir, 'AppData', 'Local', 'Claude') : join(dir, 'Library', 'Application Support', 'Claude');
const lam = D(join(appData, 'local-agent-mode-sessions', 'acct_123', 'org_456'));
function desktopSession(id, start, kind, title, prompts, tools = []) {
  const state = { id, title, createdAt: iso(start), updatedAt: iso(new Date(start.getTime() + 20 * 60e3)), sessionType: kind, messages: prompts.flatMap((p, i) => [{ role: 'user', content: p, createdAt: iso(new Date(start.getTime() + i * 120e3)) }, { role: 'assistant', content: [{ type: 'text', text: 'Sure.' }] }]) };
  writeFileSync(join(lam, `local_${id}.json`), JSON.stringify(state, null, 1));
  const wd = D(join(lam, id));
  writeFileSync(join(wd, 'audit.jsonl'), tools.map((t, i) => JSON.stringify({ seq: i, event: 'tool_invocation', tool: t, ts: iso(start), hmac: 'x' })).join('\n') + '\n');
}
desktopSession('d1', daysAgo(4, 11), 'chat', 'Critique onboarding screens', ['Critique these onboarding screens for clarity and hierarchy', 'Now check contrast against WCAG AA']);
desktopSession('d2', daysAgo(6, 16), 'cowork', 'Interview synthesis', ['Read the 12 interview transcripts in this folder and cluster them into themes'], ['Read', 'Write', 'Google Drive']);
desktopSession('d3', daysAgo(0, 8), 'chat', 'Birthday party', ["Help me plan my 6 year old's birthday party for 12 kids on a $300 budget"]);

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
codexSession('c1', daysAgo(9, 10), 'Migrate the users endpoint from REST to gRPC and keep the tests green', ['shell', 'apply_patch']);
codexSession('c2', daysAgo(12, 13), 'Write a GitHub Action that labels PRs by changed path', ['shell']);

// ---- exports in the inbox ----
const inbox = D(join(dir, 'howiai', 'inbox'));
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
writeFileSync(join(inbox, 'chatgpt-export.zip'), zip([['conversations.json', JSON.stringify(chatgpt)], ['user.json', '{}']], true));
writeFileSync(join(inbox, 'claude-export.zip'), zip([['data-2026/conversations.json', JSON.stringify(claude)], ['data-2026/projects.json', '[]']], false));

// ---- cloud sessions list (as exported from inside a claude.ai/code session) ----
writeFileSync(join(dir, 'howiai', 'cloud-sessions.json'), JSON.stringify({ ccr: { data: [
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
