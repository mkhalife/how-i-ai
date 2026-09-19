#!/usr/bin/env node
// Turns classified sessions.json into profile.json (numbers only; the words come from --narrative).
//   node scripts/stats.mjs [--in ~/how-i-ai/sessions.json] [--out ~/how-i-ai/profile.json] [--narrative ~/how-i-ai/narrative.json]
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { parseArgs, workDir, readJson, writeJson, localDate, localHour, localWeekday, weekStart, toISO, SOURCE_LABELS } from './lib/util.mjs';
import { loadConfig } from './config.mjs';
import { BUILTIN_AGENTS } from './lib/sources.mjs';

const args = parseArgs(process.argv.slice(2));
const dir = workDir();
const doc = readJson(args.in || join(dir, 'sessions.json'));
const cfg = loadConfig();
if (!cfg.title || !cfg.function) { console.error('Set who this is first: node scripts/config.mjs --title "..." --function Design'); process.exit(2); }
const sessions = doc.sessions.filter((s) => s.classification);
if (!sessions.length) { console.error('No classified sessions. Run classify prep/merge first.'); process.exit(1); }

export function summarize(sessions, window) {
  const total = sessions.length;
  const r3 = (n) => Math.round(n * 1000) / 1000;
  const counts = (fn) => { const m = new Map(); for (const s of sessions) { const k = fn(s); if (k == null || k === '') continue; m.set(k, (m.get(k) || 0) + 1); } return m; };
  const sorted = (m) => [...m].sort((a, b) => b[1] - a[1]);
  const weeks = []; { const d = new Date(window.start + 'T00:00:00'); const end = new Date(window.end + 'T00:00:00'); let w = weekStart(d.toISOString()); while (new Date(w + 'T00:00:00') <= end) { weeks.push(w); const n = new Date(w + 'T00:00:00'); n.setDate(n.getDate() + 7); w = localDate(n.toISOString()); } }
  const bySrc = sorted(counts((s) => s.source));
  const cats = new Map();
  for (const s of sessions) {
    const c = s.classification; const e = cats.get(c.category) || { category: c.category, sessions: 0, assist_type_mix: { ask: 0, make: 0, do: 0 }, subs: new Map() };
    e.sessions++; e.assist_type_mix[c.assist_type]++; if (c.subcategory) e.subs.set(c.subcategory, (e.subs.get(c.subcategory) || 0) + 1); cats.set(c.category, e);
  }
  const at = counts((s) => s.classification.assist_type);
  const ATL = { ask: 'Asked', make: 'Made', do: 'Did' };
  const days = counts((s) => localDate(s.started_at));
  const lens = sessions.filter((s) => s.messages_user != null && s.messages_assistant != null).map((s) => s.messages_user + s.messages_assistant).sort((a, b) => a - b);
  let streak = 0, best = 0; { const ds = [...days.keys()].sort(); for (let i = 0; i < ds.length; i++) { if (i && (new Date(ds[i]) - new Date(ds[i - 1])) === 86400e3) streak++; else streak = 1; best = Math.max(best, streak); } }
  const busiest = sorted(days)[0];
  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, sessions: sessions.filter((s) => localHour(s.started_at) === hour).length }));
  return {
    totals: {
      sessions: total, sessions_per_week: Math.round((total / (window.days / 7)) * 10) / 10,
      messages: sessions.reduce((a, s) => a + s.messages_user + s.messages_assistant, 0), active_days: days.size,
      hours_estimated: Math.round(sessions.reduce((a, s) => a + (s.duration_minutes || 0), 0) / 6) / 10, longest_streak_days: best, sources: bySrc.length,
    },
    by_source: bySrc.map(([source, n]) => ({ source, label: SOURCE_LABELS[source] || source, sessions: n, messages: sessions.filter((s) => s.source === source).reduce((a, s) => a + s.messages_user + s.messages_assistant, 0), share: r3(n / total) })),
    by_week: weeks.map((w) => ({ week_start: w, sessions: sessions.filter((s) => weekStart(s.started_at) === w).length, by_source: Object.fromEntries(bySrc.map(([src]) => [src, sessions.filter((s) => weekStart(s.started_at) === w && s.source === src).length])) })),
    by_weekday: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label, weekday) => ({ weekday, label, sessions: sessions.filter((s) => localWeekday(s.started_at) === weekday).length })),
    by_hour: hours,
    by_category: [...cats.values()].sort((a, b) => b.sessions - a.sessions).map((c) => ({ category: c.category, sessions: c.sessions, share: r3(c.sessions / total), assist_type_mix: c.assist_type_mix, subcategories: sorted(c.subs).map(([name, n]) => ({ name, sessions: n })) })),
    by_assist_type: ['ask', 'make', 'do'].map((t) => ({ type: t, label: ATL[t], sessions: at.get(t) || 0, share: r3((at.get(t) || 0) / total) })),
    by_mode: sorted(counts((s) => s.mode)).map(([mode, n]) => ({ mode, sessions: n })),
    tools: countList(sessions, (s) => s.tools),
    connectors: countList(sessions, (s) => s.connectors),
    skills: countList(sessions, (s) => s.skills),
    agents: countList(sessions, (s) => s.agents).map((a) => ({ ...a, custom: !BUILTIN_AGENTS.has(String(a.name).toLowerCase()) })),
    models: sorted(counts((s) => s.model)).map(([name, n]) => ({ name, sessions: n })),
    session_length: {
      buckets: [['1 message', (n) => n <= 1], ['2–5', (n) => n >= 2 && n <= 5], ['6–20', (n) => n >= 6 && n <= 20], ['21+', (n) => n > 20]].map(([label, f]) => ({ label, sessions: lens.filter(f).length })),
      median_messages: lens[Math.floor(lens.length / 2)] || 0, p90_messages: lens[Math.min(lens.length - 1, Math.floor(lens.length * 0.9))] || 0,
    },
    _busiest: busiest ? { date: busiest[0], sessions: busiest[1] } : null,
    _peak_hour: hours.reduce((a, b) => (b.sessions > a.sessions ? b : a), hours[0]).hour,
  };
}

function countList(sessions, fn) {
  const m = new Map(); for (const s of sessions) for (const t of new Set(fn(s) || [])) m.set(t, (m.get(t) || 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1]).map(([name, n]) => ({ name, sessions: n }));
}

const sum = summarize(sessions, doc.window);
const narrative = args.narrative ? readJson(args.narrative) : (existsSync(join(dir, 'narrative.json')) ? readJson(join(dir, 'narrative.json')) : {});
const surprises = sessions.filter((s) => s.classification.surprise).sort((a, b) => b.classification.confidence - a.classification.confidence)
  .map((s) => ({ paraphrase: s.classification.paraphrase, category: s.classification.category, source: s.source, date: localDate(s.started_at) }));
const rarest = sum.by_category[sum.by_category.length - 1];
const fallbackSurprise = rarest ? sessions.find((s) => s.classification.category === rarest.category) : null;
const surprise = surprises[0] || (fallbackSurprise ? { paraphrase: fallbackSurprise.classification.paraphrase, category: rarest.category, source: fallbackSurprise.source, date: localDate(fallbackSurprise.started_at) } : null);
const sample = sessions.slice().sort((a, b) => (b.messages_user + b.messages_assistant) - (a.messages_user + a.messages_assistant));
const picked = []; const seenCat = new Set();
for (const s of sample) { if (picked.length >= 12) break; if (seenCat.has(s.classification.category) && picked.length < sum.by_category.length) continue; seenCat.add(s.classification.category); picked.push(s); }
for (const s of sample) { if (picked.length >= 12) break; if (!picked.includes(s)) picked.push(s); }

const profile = {
  schema_version: 1, generated_at: toISO(new Date()), window: doc.window,
  person: { participant_id: cfg.participant_id, title: cfg.title, function: cfg.function },
  totals: sum.totals, by_source: sum.by_source, by_week: sum.by_week, by_weekday: sum.by_weekday, by_hour: sum.by_hour,
  by_category: sum.by_category, by_assist_type: sum.by_assist_type, by_mode: sum.by_mode, tools: sum.tools, connectors: sum.connectors, skills: sum.skills, agents: sum.agents, models: sum.models,
  session_length: sum.session_length,
  highlights: {
    biggest_use_case: sum.by_category[0]?.category || null,
    surprise: surprise ? { ...surprise, why: narrative.surprise_why || '' } : null,
    busiest_day: sum._busiest, peak_hour: sum._peak_hour,
    signature_move: narrative.signature_move || '', one_liner: narrative.one_liner || '',
  },
  surprises: surprises.slice(0, 8),
  sample_sessions: picked.sort((a, b) => new Date(b.started_at) - new Date(a.started_at)).map((s) => ({ paraphrase: s.classification.paraphrase, category: s.classification.category, assist_type: s.classification.assist_type, source: s.source, date: localDate(s.started_at), messages: s.messages_user + s.messages_assistant })),
  narrative: { headline: narrative.headline || '', summary: narrative.summary || '', patterns: narrative.patterns || [] },
};
const out = args.out || join(dir, 'profile.json');
writeJson(out, profile);
console.log(`wrote ${out}: ${profile.totals.sessions} sessions, ${profile.totals.sessions_per_week}/week, top: ${profile.highlights.biggest_use_case}, ask/make/do = ${profile.by_assist_type.map((a) => a.sessions).join('/')}`);
if (!narrative.headline) console.log('narrative is empty: write ~/how-i-ai/narrative.json {headline, summary, patterns[], one_liner, signature_move, surprise_why} and re-run stats');
