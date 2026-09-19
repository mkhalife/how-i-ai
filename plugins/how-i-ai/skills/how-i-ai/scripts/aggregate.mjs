#!/usr/bin/env node
// Builds aggregate.json for the team report from the shared rows.
//   node scripts/aggregate.mjs --url <apps script url>          fetches {participants, sessions} from the endpoint
//   node scripts/aggregate.mjs --json dump.json                   same shape from a file
//   node scripts/aggregate.mjs --csv sessions.csv --participants participants.csv   from Sheet downloads
//   options: [--team "Product team"] [--out ~/how-i-ai/aggregate.json] [--narrative ~/how-i-ai/aggregate-narrative.json] [--days 30]
import { join, dirname } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseArgs, workDir, readJson, writeJson, toISO, SOURCE_LABELS, localDate } from './lib/util.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const args = parseArgs(process.argv.slice(2));
const team = readJson(join(here, '..', 'team.json'), {});
const dir = workDir();

let data;
if (args.url || (!args.json && !args.csv && team.share_url)) {
  const u = new URL(args.url || team.share_url); u.searchParams.set('action', 'dump'); if (team.share_key) u.searchParams.set('key', team.share_key);
  const res = await fetch(u, { redirect: 'follow' }); const text = await res.text();
  try { data = JSON.parse(text); } catch { console.error('endpoint did not return JSON: ' + text.slice(0, 200)); process.exit(1); }
} else if (args.json) data = readJson(args.json);
else if (args.csv) data = { sessions: parseCsv(readFileSync(args.csv, 'utf8')), participants: args.participants ? parseCsv(readFileSync(args.participants, 'utf8')) : [] };
else if (args['csv-dir']) {
  // A folder of per-person CSVs (the chat-only path): how-i-ai-*-sessions.csv and how-i-ai-*-participant.csv
  const { readdirSync } = await import('node:fs');
  data = { sessions: [], participants: [] };
  for (const f of readdirSync(args['csv-dir'])) {
    if (!/\.csv$/i.test(f)) continue;
    const rows = parseCsv(readFileSync(join(args['csv-dir'], f), 'utf8'));
    if (rows.length && 'window_days' in rows[0]) data.participants.push(...rows); else data.sessions.push(...rows);
  }
}
else { console.error('need --url, --json, --csv, or --csv-dir'); process.exit(2); }

const sessionsRaw = (data.sessions || []).map(coerce);
const participantsRaw = data.participants || [];
// Latest submission per participant wins.
const latest = new Map();
for (const s of sessionsRaw) { const t = latest.get(s.participant_id); if (!t || String(s.submitted_at) > t) latest.set(s.participant_id, String(s.submitted_at)); }
const sessions = sessionsRaw.filter((s) => String(s.submitted_at) === latest.get(s.participant_id));
const pinfo = new Map();
for (const p of participantsRaw) { const prev = pinfo.get(p.participant_id); if (!prev || String(p.submitted_at) > String(prev.submitted_at)) pinfo.set(p.participant_id, p); }
for (const s of sessions) if (!pinfo.has(s.participant_id)) pinfo.set(s.participant_id, { participant_id: s.participant_id, function: s.function, window_days: 30 });

const days = Number(args.days || team.window_days || 30);
const dates = sessions.map((s) => s.date).filter(Boolean).sort();
const window = { days, start: dates[0] || localDate(new Date(Date.now() - days * 86400e3).toISOString()), end: dates[dates.length - 1] || localDate(new Date().toISOString()) };
const total = sessions.length;
if (!total) { console.error('no session rows'); process.exit(1); }
const r3 = (n) => Math.round(n * 1000) / 1000; const r1 = (n) => Math.round(n * 10) / 10;
const counts = (list, fn) => { const m = new Map(); for (const s of list) { const k = fn(s); if (k == null || k === '') continue; m.set(k, (m.get(k) || 0) + 1); } return [...m].sort((a, b) => b[1] - a[1]); };
const ATL = { ask: 'Asked', make: 'Made', do: 'Did' };
const mix = (list) => ({ ask: list.filter((s) => s.assist_type === 'ask').length, make: list.filter((s) => s.assist_type === 'make').length, do: list.filter((s) => s.assist_type === 'do').length });
const functions = counts([...pinfo.values()], (p) => p.function || 'Other');
const perPerson = [...pinfo.values()].map((p) => {
  const mine = sessions.filter((s) => s.participant_id === p.participant_id);
  const wd = Number(p.window_days) || days;
  return { participant_id: p.participant_id, function: p.function || 'Other', sessions: mine.length, sessions_per_week: r1(mine.length / (wd / 7)), top_category: counts(mine, (s) => s.category)[0]?.[0] || null, assist_type_mix: mix(mine) };
}).sort((a, b) => b.sessions_per_week - a.sessions_per_week);
const spw = perPerson.map((p) => p.sessions_per_week).sort((a, b) => a - b);
const weeks = counts(sessions, (s) => s.week_start).sort((a, b) => (a[0] < b[0] ? -1 : 1));

const aggregate = {
  schema_version: 1, generated_at: toISO(new Date()), window,
  team: { name: args.team || team.team || 'Team', participants: pinfo.size, by_function: functions.map(([f, n]) => ({ function: f, participants: n })) },
  totals: { sessions: total, messages: sessions.reduce((a, s) => a + (Number(s.messages_user) || 0) + (Number(s.messages_assistant) || 0), 0), sessions_per_person_per_week: r1(perPerson.reduce((a, p) => a + p.sessions_per_week, 0) / Math.max(1, perPerson.length)) },
  distribution: {
    sessions_per_week_per_person: { buckets: [['0–5', (n) => n <= 5], ['6–15', (n) => n > 5 && n <= 15], ['16–30', (n) => n > 15 && n <= 30], ['31–50', (n) => n > 30 && n <= 50], ['51+', (n) => n > 50]].map(([label, f]) => ({ label, participants: spw.filter(f).length })), median: spw[Math.floor(spw.length / 2)] || 0, p90: spw[Math.min(spw.length - 1, Math.floor(spw.length * 0.9))] || 0, max: spw[spw.length - 1] || 0 },
    participants: perPerson,
  },
  by_function: functions.map(([f, n]) => { const mine = sessions.filter((s) => (s.function || 'Other') === f); const ppl = perPerson.filter((p) => p.function === f); return { function: f, participants: n, sessions: mine.length, sessions_per_person_per_week: r1(ppl.reduce((a, p) => a + p.sessions_per_week, 0) / Math.max(1, ppl.length)), top_categories: counts(mine, (s) => s.category).slice(0, 5).map(([category, c]) => ({ category, share: r3(c / Math.max(1, mine.length)) })), assist_type_mix: mix(mine), by_source: Object.fromEntries(counts(mine, (s) => s.source)) }; }),
  by_category: counts(sessions, (s) => s.category).map(([category, n]) => { const mine = sessions.filter((s) => s.category === category); return { category, sessions: n, share: r3(n / total), by_function: Object.fromEntries(functions.map(([f]) => [f, mine.filter((s) => (s.function || 'Other') === f).length])), assist_type_mix: mix(mine), subcategories: counts(mine, (s) => s.subcategory).slice(0, 8).map(([name, c]) => ({ name, sessions: c })) }; }),
  by_assist_type: ['ask', 'make', 'do'].map((t) => ({ type: t, label: ATL[t], sessions: sessions.filter((s) => s.assist_type === t).length, share: r3(sessions.filter((s) => s.assist_type === t).length / total) })),
  by_source: counts(sessions, (s) => s.source).map(([source, n]) => ({ source, label: SOURCE_LABELS[source] || source, sessions: n, share: r3(n / total) })),
  by_mode: counts(sessions, (s) => s.mode).map(([mode, n]) => ({ mode, sessions: n })),
  by_week: weeks.map(([week_start, n]) => ({ week_start, sessions: n, active_participants: new Set(sessions.filter((s) => s.week_start === week_start).map((s) => s.participant_id)).size })),
  by_weekday: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label, weekday) => ({ weekday, label, sessions: sessions.filter((s) => Number(s.weekday) === weekday).length })),
  by_hour: Array.from({ length: 24 }, (_, hour) => ({ hour, sessions: sessions.filter((s) => Number(s.hour) === hour).length })),
  tools: counts(sessions.flatMap((s) => splitList(s.tools).map((t) => ({ t }))), (x) => x.t).map(([name, n]) => ({ name, sessions: n })),
  connectors: counts(sessions.flatMap((s) => splitList(s.connectors).map((t) => ({ t }))), (x) => x.t).map(([name, n]) => ({ name, sessions: n })),
  surprises: sessions.filter((s) => s.surprise === true || String(s.surprise).toLowerCase() === 'true').slice(0, 40).map((s) => ({ paraphrase: s.paraphrase, function: s.function || 'Other', category: s.category, source: s.source })),
  highlights: {}, narrative: { headline: '', summary: '', patterns: [] },
};
const fnMix = aggregate.by_function.map((f) => ({ f: f.function, doShare: f.assist_type_mix.do / Math.max(1, f.sessions), askShare: f.assist_type_mix.ask / Math.max(1, f.sessions) }));
aggregate.highlights = {
  biggest_use_case: aggregate.by_category[0]?.category || null,
  surprise_use_case: aggregate.surprises[0]?.paraphrase || null,
  most_agentic_function: fnMix.sort((a, b) => b.doShare - a.doShare)[0]?.f || null,
  most_curious_function: fnMix.sort((a, b) => b.askShare - a.askShare)[0]?.f || null,
  one_liner: '',
};
const narrPath = args.narrative || join(dir, 'aggregate-narrative.json');
if (existsSync(narrPath)) { const n = readJson(narrPath); aggregate.narrative = { headline: n.headline || '', summary: n.summary || '', patterns: n.patterns || [] }; aggregate.highlights.one_liner = n.one_liner || ''; if (n.surprise_use_case) aggregate.highlights.surprise_use_case = n.surprise_use_case; }
const out = args.out || join(dir, 'aggregate.json');
writeJson(out, aggregate);
console.log(`wrote ${out}: ${aggregate.team.participants} participants, ${total} sessions, ${aggregate.by_category.length} categories, functions: ${functions.map(([f, n]) => `${f}(${n})`).join(', ')}`);
if (!aggregate.narrative.headline) console.log(`narrative empty: write ${narrPath} {headline, summary, patterns[], one_liner, surprise_use_case?} and re-run`);

function splitList(v) { return String(v || '').split(';').map((x) => x.trim()).filter(Boolean); }
function coerce(r) { const o = { ...r }; for (const k of ['weekday', 'hour', 'messages_user', 'messages_assistant', 'duration_minutes']) if (o[k] !== '' && o[k] != null) o[k] = Number(o[k]); if (typeof o.surprise === 'string') o.surprise = o.surprise.toLowerCase() === 'true'; return o; }
function parseCsv(text) {
  const rows = []; let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) { const c = text[i]; if (q) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; } else field += c; } else if (c === '"') q = true; else if (c === ',') { row.push(field); field = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(field); rows.push(row); row = []; field = ''; } else field += c; }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.length > 1 || (r[0] && r[0].trim()));
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), r[i] ?? ''])));
}
