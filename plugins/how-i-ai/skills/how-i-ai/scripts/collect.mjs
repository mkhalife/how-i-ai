#!/usr/bin/env node
// Inventory every AI session on this machine for the last N days.
//   node scripts/collect.mjs [--days 30] [--out ~/how-i-ai/sessions.json] [--inbox ~/how-i-ai/inbox]
//                            [--cloud-sessions file.json] [--no-codex-cloud] [--dry-run]
// Prints a source table and writes sessions.json. Nothing leaves the machine.
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { parseArgs, workDir, appName, appOf, ensureDir, readJson, writeJson, os, hostHash, toISO, localDate } from './lib/util.mjs';
import * as src from './lib/sources.mjs';

const args = parseArgs(process.argv.slice(2));
const days = Number(args.days || 30);
const dir = ensureDir(workDir());
const inbox = ensureDir(args.inbox || join(dir, 'inbox'));
const out = args.out || join(dir, 'sessions.json');
const now = new Date();
const start = new Date(now.getTime() - days * 86400e3);

const results = [];
const push = (r) => { if (r) results.push(r); };
// Each entry point reads its own product's sessions and nothing else.
const app = appName();
let cloud = null;
if (app === 'claude') {
  push(src.claudeCode());
  push(src.claudeDesktop());
  // cloud-sessions.json is saved by the person into the inbox (PROMPT-claude-cloud.md); the working folder is also checked.
  cloud = src.claudeCloud(args['cloud-sessions'] || [join(inbox, 'cloud-sessions.json'), join(dir, 'cloud-sessions.json')].find((f) => existsSync(f)) || null);
  push(cloud);
} else {
  push(src.codex());
  if (!args['no-codex-cloud']) push(src.codexCloud());
}
const misplaced = [];
for (const r of src.exportsInbox(inbox)) { if (r.source === 'export' || appOf(r.source) === app) push(r); else misplaced.push(r); }
if (app === 'claude') push(src.claudeChatThreads(inbox)); // after the export: same ids, the export is richer
if (app === 'chatgpt') {
  push(src.chatgptAppThreads(inbox)); // after the export: same ids, the export is richer
  push(src.chatgptDesktop());
}

// Merge, dedupe, filter to window.
const seen = new Map();
for (const r of results) {
  r.total = r.sessions.length; r.all = r.sessions;
  r.sessions = r.sessions.filter((s) => s.started_at && new Date(s.started_at) >= start && new Date(s.started_at) <= new Date(now.getTime() + 86400e3));
  for (const s of r.sessions) if (!seen.has(s.id)) seen.set(s.id, s);
  r.in_window = r.sessions.length;
}
const sessions = [...seen.values()].sort((a, b) => new Date(a.started_at) - new Date(b.started_at));
// Re-running collect (new export zips, a second pass) must not throw away judgments already merged.
const previous = new Map((readJson(out, { sessions: [] }).sessions || []).filter((s) => s.classification).map((s) => [s.id, s.classification]));
for (const s of sessions) if (!s.classification && previous.has(s.id)) s.classification = previous.get(s.id);

const HINTS = {
  'claude-code': 'Claude Code transcripts live in ~/.claude/projects. Nothing there means Claude Code was not used on this machine.',
  'claude-desktop': 'Claude Desktop not found on this machine. Its Chat history comes from claude-chat-threads.json or the claude.ai export either way.',
  'claude-cowork': 'Cowork sessions live in Claude Desktop\'s local-agent-mode-sessions folder.',
  'chatgpt-export': `Request your ChatGPT export (Settings → Data controls → Export data), then drop the zip in ${inbox}`,
  'claude-export': `Request your claude.ai export (Settings → Privacy → Export data), then drop the zip in ${inbox}`,
  'claude-chat': `No ${inbox}/claude-chat-threads.json yet. Optional: the "Claude chats" button on the landing page (PROMPT-claude-chat.md) has Claude in Chat mode list your chats into that file; save it there and re-run.`,
  'chatgpt-app': `No ${inbox}/chatgpt-app-threads.json yet. The agent inside the ChatGPT desktop app writes it (PROMPT-chatgpt-app.md step 2).`,
  codex: 'Codex sessions live in ~/.codex/sessions. Not found means Codex was not used on this machine.',
  'chatgpt-desktop': 'ChatGPT desktop app not found on this machine (fine; the export covers ChatGPT conversations).',
};

// Found, but nothing parsed and no parser note: say why that is expected.
const FOUND_EMPTY = {
  'claude-desktop': 'Desktop app found. Chat conversations are not stored on disk (only Cowork sessions are), so Chat history comes from claude-chat-threads.json or the claude.ai export.',
};

const table = [];
const bySource = new Map();
for (const r of results) {
  // One parser can yield two sources (the Claude Desktop folder holds Cowork sessions), so rows follow the sessions.
  const parts = new Map([[r.source, { total: 0, in_window: 0 }]]);
  for (const s of r.all) { const c = parts.get(s.source) || { total: 0, in_window: 0 }; c.total++; parts.set(s.source, c); }
  for (const s of r.sessions) parts.get(s.source).in_window++;
  for (const [source, c] of parts) {
    if (source !== r.source && !c.total) continue;
    const key = source === 'export' ? r.path : source;
    const row = bySource.get(key) || { source, found: false, paths: [], total: 0, in_window: 0, notes: [] };
    row.found = row.found || r.found; if (r.path) row.paths.push(r.path); row.total += c.total; row.in_window += c.in_window; if (source === r.source) row.notes.push(...r.notes);
    bySource.set(key, row);
  }
}
for (const want of [app === 'chatgpt' ? 'chatgpt-export' : 'claude-export']) if (![...bySource.values()].some((r) => r.source === want)) bySource.set(want, { source: want, found: false, paths: [], total: 0, in_window: 0, notes: [] });
for (const row of bySource.values()) table.push({ source: row.source, found: row.found, sessions_in_window: row.in_window, sessions_total: row.total, path: row.paths[0] || null, hint: row.found && row.in_window ? null : (row.notes[0] || (row.found && row.total ? `${row.total} on disk, none started in the last ${days} days` : (row.found && FOUND_EMPTY[row.source]) || HINTS[row.source]) || null) });
const signals = results.filter((r) => r.signal).map((r) => ({ source: r.source, path: r.path, ...r.signal }));

const doc = {
  schema_version: 1, collected_at: toISO(now), window: { days, start: localDate(start.toISOString()), end: localDate(now.toISOString()) },
  machine: { platform: os(), hostname_hash: hostHash(), node: process.version },
  sources: table, signals, sessions,
};

console.log(`how-i-ai collect (${app}) · last ${days} days (${doc.window.start} → ${doc.window.end})\n`);
const pad = (s, n) => String(s ?? '').padEnd(n);
console.log(pad('source', 16) + pad('found', 7) + pad('in window', 11) + pad('all time', 10) + 'path / hint');
for (const t of table) console.log(pad(t.source, 16) + pad(t.found ? 'yes' : 'no', 7) + pad(t.sessions_in_window, 11) + pad(t.sessions_total, 10) + (t.found && t.sessions_in_window ? t.path : (t.hint || '')));
console.log(`\n${sessions.length} sessions in window across ${table.filter((t) => t.sessions_in_window).length} sources.`);
if (cloud && !cloud.found) console.log(`\nNo cloud-sessions.json in ${inbox}. Optional: the "Claude Code on the web" prompt (PROMPT-claude-cloud.md), pasted into a claude.ai/code session, lists your cloud sessions into that file.`);
for (const r of misplaced) console.log(`\nIgnored ${r.path}: it is a ${appOf(r.source) === 'chatgpt' ? 'ChatGPT' : 'claude.ai'} export, which belongs to the other entry point (${appOf(r.source) === 'chatgpt' ? 'run with --app chatgpt and put it in ~/how-i-ai-chatgpt/inbox' : 'run without --app and put it in ~/how-i-ai/inbox'}).`);
if (args['dry-run']) process.exit(0);
writeJson(out, doc);
console.log(`wrote ${out}`);
