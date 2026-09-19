#!/usr/bin/env node
// Builds the anonymized rows, shows them, and (only with --send) posts them to the team endpoint.
//   node scripts/share.mjs preview                 writes share-rows.json, share-rows.csv, share-preview.html; prints a summary
//   node scripts/share.mjs send [--endpoint URL]   posts the same rows (never anything else)
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { parseArgs, workDir, readJson, writeJson, localDate, localHour, localWeekday, weekStart, toISO, ensureDir } from './lib/util.mjs';
import { loadConfig } from './config.mjs';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const args = parseArgs(process.argv.slice(2));
const cmd = args._[0] || 'preview';
const dir = workDir();
const cfg = loadConfig();
const doc = readJson(args.in || join(dir, 'sessions.json'));
const team = readJson(join(here, '..', 'team.json'), {});

export const SESSION_COLUMNS = ['participant_id', 'function', 'source', 'surface', 'date', 'week_start', 'weekday', 'hour', 'mode', 'trigger', 'category', 'subcategory', 'assist_type', 'paraphrase', 'surprise', 'messages_user', 'messages_assistant', 'duration_minutes', 'tools', 'connectors', 'model', 'submitted_at', 'schema_version'];
export const PARTICIPANT_COLUMNS = ['participant_id', 'function', 'title', 'window_days', 'window_start', 'window_end', 'sessions_total', 'sources', 'submitted_at', 'schema_version'];

const submitted_at = toISO(new Date());
const classified = doc.sessions.filter((s) => s.classification);
const participant = {
  participant_id: cfg.participant_id, function: cfg.function || '', title: cfg.title || '',
  window_days: doc.window.days, window_start: doc.window.start, window_end: doc.window.end,
  sessions_total: classified.length, sources: [...new Set(classified.map((s) => s.source))].join(';'), submitted_at, schema_version: 1,
};
const rows = classified.map((s) => ({
  participant_id: cfg.participant_id, function: cfg.function || '', source: s.source, surface: s.surface,
  date: localDate(s.started_at), week_start: weekStart(s.started_at), weekday: localWeekday(s.started_at), hour: localHour(s.started_at),
  mode: s.mode, trigger: s.trigger, category: s.classification.category, subcategory: s.classification.subcategory || '',
  assist_type: s.classification.assist_type, paraphrase: s.classification.paraphrase, surprise: s.classification.surprise,
  messages_user: s.messages_user, messages_assistant: s.messages_assistant, duration_minutes: s.duration_minutes ?? '',
  tools: (s.tools || []).join(';'), connectors: (s.connectors || []).join(';'), model: s.model || '', submitted_at, schema_version: 1,
}));
// Belt and braces: only the declared columns can ever be in a row.
const payload = { participant: pickCols(participant, PARTICIPANT_COLUMNS), sessions: rows.map((r) => pickCols(r, SESSION_COLUMNS)) };

function pickCols(o, cols) { const x = {}; for (const c of cols) x[c] = o[c] ?? ''; return x; }
function csv(list, cols) { const esc = (v) => { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }; return [cols.join(','), ...list.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n') + '\n'; }

ensureDir(dir);
writeJson(join(dir, 'share-rows.json'), payload);
writeFileSync(join(dir, 'share-sessions.csv'), csv(payload.sessions, SESSION_COLUMNS));
writeFileSync(join(dir, 'share-participant.csv'), csv([payload.participant], PARTICIPANT_COLUMNS));
writeFileSync(join(dir, 'share-preview.html'), previewHtml(payload));

if (cmd === 'preview') {
  console.log(`Exactly this leaves your machine, nothing else. Team: ${team.team || cfg.team || '(unset)'}\n`);
  console.log('participant row:'); console.log('  ' + JSON.stringify(payload.participant));
  console.log(`\n${payload.sessions.length} session rows (first 5):`);
  for (const r of payload.sessions.slice(0, 5)) console.log('  ' + JSON.stringify(r));
  console.log(`\nFull preview: ${join(dir, 'share-preview.html')}  ·  raw rows: ${join(dir, 'share-rows.json')}`);
  console.log('Not included: your prompts, session titles, file paths, repo names, machine name.');
  process.exit(0);
}

if (cmd === 'send') {
  const endpoint = args.endpoint || process.env.HOWIAI_SHARE_URL || cfg.share_url || team.share_url;
  if (!endpoint) { console.error('No endpoint. Pass --endpoint, or set share_url in team.json next to the skill, or: node scripts/config.mjs --share-url URL'); process.exit(2); }
  const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ ...payload, key: team.share_key || cfg.share_key || '' }), redirect: 'follow' });
  const text = await res.text();
  let body; try { body = JSON.parse(text); } catch { body = { raw: text.slice(0, 300) }; }
  if (!res.ok || body.ok === false) { console.error(`share failed: HTTP ${res.status} ${JSON.stringify(body)}`); process.exit(1); }
  cfg.last_shared_at = submitted_at; writeJson(join(dir, 'config.json'), cfg);
  console.log(`shared ${payload.sessions.length} session rows + 1 participant row as ${cfg.participant_id}. Server said: ${JSON.stringify(body)}`);
  process.exit(0);
}

console.error('usage: share.mjs preview|send'); process.exit(2);

function previewHtml(p) {
  const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const table = (list, cols) => `<table><thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${list.map((r) => `<tr>${cols.map((c) => `<td>${esc(r[c])}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>What howiai would share</title><meta name="viewport" content="width=device-width,initial-scale=1">
<style>:root{--bg:#fff;--ink:#1a1a1a;--mute:#666;--line:#e5e5e5;--acc:#2b59c3}@media(prefers-color-scheme:dark){:root{--bg:#111;--ink:#eee;--mute:#aaa;--line:#333;--acc:#8ab4ff}}
body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.5 system-ui,sans-serif;padding:24px 16px;max-width:1200px;margin:auto}h1{font-size:22px}h2{font-size:16px;margin-top:32px}p{color:var(--mute)}
.wrap{overflow:auto;border:1px solid var(--line);border-radius:8px}table{border-collapse:collapse;font-size:12px;white-space:nowrap}th,td{padding:6px 10px;border-bottom:1px solid var(--line);text-align:left}th{position:sticky;top:0;background:var(--bg);font-weight:600}
.no{margin-top:24px;padding:12px 16px;border:1px solid var(--line);border-radius:8px}.no b{color:var(--acc)}</style></head><body>
<h1>Exactly what leaves your machine</h1><p>${p.sessions.length} session rows and 1 participant row. Every column is listed. There are no other fields.</p>
<h2>Participant row</h2><div class="wrap">${table([p.participant], PARTICIPANT_COLUMNS)}</div>
<h2>Session rows</h2><div class="wrap">${table(p.sessions, SESSION_COLUMNS)}</div>
<div class="no"><b>Never shared:</b> your prompts or messages, session titles, file paths, repository names, project names, machine name, email, or anything not in the tables above. The paraphrase column is a generic one-line description written to contain no names, companies, or secrets. Check it.</div>
</body></html>`;
}
