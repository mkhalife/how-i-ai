#!/usr/bin/env node
// Inventory every AI session on this machine for the last N days.
//   node scripts/collect.mjs [--days 30] [--out ~/how-i-ai/sessions.json] [--inbox ~/how-i-ai/inbox]
//                            [--cloud-sessions file.json] [--no-codex-cloud] [--dry-run]
// Prints a source table and writes sessions.json. Nothing leaves the machine.
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { parseArgs, workDir, ensureDir, writeJson, os, hostHash, toISO, localDate } from './lib/util.mjs';
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
push(src.claudeCode());
push(src.claudeDesktop());
push(src.codex());
if (!args['no-codex-cloud']) push(src.codexCloud());
push(src.claudeCloud(args['cloud-sessions'] || (existsSync(join(dir, 'cloud-sessions.json')) ? join(dir, 'cloud-sessions.json') : null)));
for (const r of src.exportsInbox(inbox)) push(r);
push(src.geminiCli());

// Merge, dedupe, filter to window.
const seen = new Map();
for (const r of results) {
  r.total = r.sessions.length;
  r.sessions = r.sessions.filter((s) => s.started_at && new Date(s.started_at) >= start && new Date(s.started_at) <= new Date(now.getTime() + 86400e3));
  for (const s of r.sessions) if (!seen.has(s.id)) seen.set(s.id, s);
  r.in_window = r.sessions.length;
}
const sessions = [...seen.values()].sort((a, b) => new Date(a.started_at) - new Date(b.started_at));

const HINTS = {
  'claude-code': 'Claude Code transcripts live in ~/.claude/projects. Nothing there means Claude Code was not used on this machine.',
  'claude-desktop': 'Claude Desktop stores Chat and Cowork sessions under its Application Support folder. Not found means the desktop app is not installed here.',
  'chatgpt-export': `Request your ChatGPT export (Settings → Data controls → Export data), then drop the zip in ${inbox}`,
  'claude-export': `Request your claude.ai export (Settings → Privacy → Export data), then drop the zip in ${inbox}`,
  codex: 'Codex sessions live in ~/.codex/sessions. Not found means Codex was not used on this machine.',
  'gemini-cli': 'optional',
};

const table = [];
const bySource = new Map();
for (const r of results) {
  const key = r.source === 'export' ? r.path : r.source;
  const row = bySource.get(key) || { source: r.source, found: false, paths: [], total: 0, in_window: 0, notes: [] };
  row.found = row.found || r.found; if (r.path) row.paths.push(r.path); row.total += r.total; row.in_window += r.in_window; row.notes.push(...r.notes);
  bySource.set(key, row);
}
for (const want of ['chatgpt-export', 'claude-export']) if (![...bySource.values()].some((r) => r.source === want)) bySource.set(want, { source: want, found: false, paths: [], total: 0, in_window: 0, notes: [] });
for (const row of bySource.values()) table.push({ source: row.source, found: row.found, sessions_in_window: row.in_window, sessions_total: row.total, path: row.paths[0] || null, hint: row.found && row.in_window ? null : (row.notes[0] || HINTS[row.source] || null) });

const doc = {
  schema_version: 1, collected_at: toISO(now), window: { days, start: localDate(start.toISOString()), end: localDate(now.toISOString()) },
  machine: { platform: os(), hostname_hash: hostHash(), node: process.version },
  sources: table, sessions,
};

console.log(`how-i-ai collect · last ${days} days (${doc.window.start} → ${doc.window.end})\n`);
const pad = (s, n) => String(s ?? '').padEnd(n);
console.log(pad('source', 16) + pad('found', 7) + pad('in window', 11) + pad('all time', 10) + 'path / hint');
for (const t of table) console.log(pad(t.source, 16) + pad(t.found ? 'yes' : 'no', 7) + pad(t.sessions_in_window, 11) + pad(t.sessions_total, 10) + (t.found && t.sessions_in_window ? t.path : (t.hint || '')));
console.log(`\n${sessions.length} sessions in window across ${table.filter((t) => t.sessions_in_window).length} sources.`);
if (args['dry-run']) process.exit(0);
writeJson(out, doc);
console.log(`wrote ${out}`);
