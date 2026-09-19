#!/usr/bin/env node
// Generates realistic sample profile.json and aggregate.json so the report
// designs can be previewed without anyone's real data.
//   node scripts/sample-data.mjs profile   > fixtures/sample-profile.json
//   node scripts/sample-data.mjs aggregate > fixtures/sample-aggregate.json
import { writeFileSync } from 'node:fs';

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }
const r = rng(20260919);
const pick = (arr) => arr[Math.floor(r() * arr.length)];
const round = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

const WINDOW = { days: 30, start: '2026-08-20', end: '2026-09-19' };
const WEEKS = ['2026-08-17', '2026-08-24', '2026-08-31', '2026-09-07', '2026-09-14'];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SOURCE_LABEL = {
  'claude-code': 'Claude Code', 'claude-cowork': 'Cowork', 'claude-export': 'Claude',
  'codex': 'Codex', 'chatgpt-export': 'ChatGPT',
};

const CATS = {
  Design: [
    ['Design critique & feedback', ['Critique a flow', 'Accessibility check', 'Copy in the UI'], { ask: 6, make: 2, do: 1 }],
    ['Write & edit', ['Design doc', 'Rationale for stakeholders', 'Release notes'], { ask: 2, make: 7, do: 0 }],
    ['Research & synthesis', ['Summarize interviews', 'Competitive teardown', 'Affinity mapping'], { ask: 3, make: 5, do: 1 }],
    ['Prototype & build', ['Prototype in code', 'Motion spec', 'Design tokens'], { ask: 1, make: 4, do: 5 }],
    ['Explain & learn', ['How does X work', 'Terminology', 'Engineering concepts'], { ask: 9, make: 1, do: 0 }],
    ['Plan & prioritize', ['Sprint planning', 'Roadmap tradeoffs'], { ask: 4, make: 4, do: 1 }],
    ['Personal & life admin', ['Travel', 'Family', 'Health', 'Money'], { ask: 6, make: 3, do: 1 }],
  ],
  Product: [
    ['Write & edit', ['PRD', 'Exec update', 'Customer email', 'Spec'], { ask: 2, make: 8, do: 0 }],
    ['Plan & prioritize', ['Roadmap bets', 'Tradeoffs', 'OKRs'], { ask: 5, make: 4, do: 0 }],
    ['Analyze data', ['SQL', 'Funnel', 'Experiment readout'], { ask: 3, make: 4, do: 4 }],
    ['Research & synthesis', ['Interview synthesis', 'Market scan', 'Competitor'], { ask: 4, make: 5, do: 2 }],
    ['Explain & learn', ['Technical concept', 'Domain', 'Terminology'], { ask: 9, make: 0, do: 0 }],
    ['Communicate & coordinate', ['Slack replies', 'Meeting prep', 'Status'], { ask: 2, make: 5, do: 3 }],
    ['Personal & life admin', ['Travel', 'Cooking', 'Kids'], { ask: 6, make: 3, do: 1 }],
  ],
  Engineering: [
    ['Build & ship code', ['Add a feature', 'Refactor', 'Migration', 'Tests'], { ask: 1, make: 2, do: 9 }],
    ['Debug & fix', ['Failing test', 'Prod incident', 'Flaky CI'], { ask: 2, make: 1, do: 8 }],
    ['Review & explain code', ['PR review', 'Explain this module', 'Architecture'], { ask: 7, make: 1, do: 2 }],
    ['Automate & ops', ['CI', 'Scripts', 'Infra'], { ask: 1, make: 2, do: 7 }],
    ['Write & edit', ['Design doc', 'PR description', 'Runbook'], { ask: 1, make: 8, do: 1 }],
    ['Explain & learn', ['New language', 'Library docs', 'Concept'], { ask: 9, make: 1, do: 0 }],
    ['Personal & life admin', ['Home', 'Travel', 'Fitness'], { ask: 6, make: 3, do: 1 }],
  ],
};

const PARAPHRASES = {
  'Design critique & feedback': ['Critique the new onboarding flow screens for clarity', 'Check a settings page against WCAG contrast rules', 'Tighten microcopy on the empty-state screen'],
  'Write & edit': ['Draft a design rationale doc for the checkout redesign', 'Turn rough notes into a PRD for transfer alerts', 'Rewrite an exec update to lead with the decision', 'Write release notes from a changelog'],
  'Research & synthesis': ['Summarize twelve interview transcripts into themes', 'Tear down three competitor onboarding flows', 'Cluster survey verbatims into jobs to be done'],
  'Prototype & build': ['Build a clickable prototype of a card-stack interaction', 'Spec the motion curves for a modal transition', 'Generate design tokens from a Figma palette'],
  'Explain & learn': ['Explain how OAuth refresh tokens work', 'What is a p95 latency and why do engineers care', 'Explain event sourcing like I am a designer'],
  'Plan & prioritize': ['Weigh three roadmap bets against a retention goal', 'Plan a two-week sprint from a backlog dump', 'Turn OKRs into a quarterly plan'],
  'Personal & life admin': ["Plan a 6-year-old's birthday party on a budget", 'Draft a polite note to a landlord about repairs', 'Build a 12-week half-marathon plan', 'Compare two car leases'],
  'Analyze data': ['Write SQL to find where the signup funnel drops', 'Read an experiment result and say if it is significant', 'Chart weekly actives by cohort'],
  'Communicate & coordinate': ['Draft Slack replies to a thread of stakeholder questions', 'Prep talking points for a customer call', 'Write a status update from Jira tickets'],
  'Build & ship code': ['Add a feature flag and roll it out behind a config', 'Migrate a service from REST to gRPC', 'Write unit tests for a payment module', 'Refactor a 900-line component into pieces'],
  'Debug & fix': ['Find why a test passes locally and fails in CI', 'Trace a memory leak in a worker process', 'Fix a race condition in a queue consumer'],
  'Review & explain code': ['Review an open PR for correctness', 'Explain what this legacy module does', 'Compare two architectures for a cache layer'],
  'Automate & ops': ['Write a GitHub Action that labels PRs by path', 'Script a nightly backup and verify it', 'Set up a dev container for a monorepo'],
};

const TOOLS = ['Bash', 'Read', 'Edit', 'Write', 'Grep', 'Glob', 'WebSearch', 'WebFetch', 'Agent'];
const CONNECTORS = ['Slack', 'Google Drive', 'Notion', 'GitHub', 'Figma', 'Linear', 'Gmail'];
const SKILLS = { Design: ['design-critique', 'humanizer', 'pm-storytelling:customer-hero-story', 'dataviz'], Product: ['pm-storytelling:brag-to-bets', 'pm-storytelling:customer-hero-story', 'humanizer', 'docs'], Engineering: ['code-review', 'simplify', 'security-review', 'kg-frontend:web-motion-hardening', 'init'] };
const AGENTS = { Design: ['general-purpose', 'Explore'], Product: ['general-purpose', 'evidence-researcher'], Engineering: ['general-purpose', 'Explore', 'Plan', 'evidence-researcher', 'code-reviewer'] };

function mixBySource(fn) {
  return {
    Design: { 'claude-export': 0.45, 'chatgpt-export': 0.3, 'claude-cowork': 0.15, 'claude-code': 0.1 },
    Product: { 'claude-export': 0.4, 'chatgpt-export': 0.25, 'claude-cowork': 0.2, 'claude-code': 0.15 },
    Engineering: { 'claude-code': 0.6, 'codex': 0.15, 'claude-export': 0.15, 'chatgpt-export': 0.1 },
  }[fn];
}

function makeSessions(fn, n) {
  const cats = CATS[fn];
  const weights = cats.map((c, i) => Math.max(1, 8 - i * 1.1));
  const srcMix = mixBySource(fn);
  const out = [];
  for (let i = 0; i < n; i++) {
    let x = r() * weights.reduce((a, b) => a + b, 0); let ci = 0;
    while ((x -= weights[ci]) > 0) ci++;
    const [category, subs, at] = cats[ci];
    const atTotal = at.ask + at.make + at.do; let y = r() * atTotal;
    const assist_type = y < at.ask ? 'ask' : y < at.ask + at.make ? 'make' : 'do';
    let z = r(); let source = 'claude-export';
    for (const [s, p] of Object.entries(srcMix)) { if ((z -= p) <= 0) { source = s; break; } }
    const agentic = source === 'claude-code' || source === 'codex' || source === 'claude-cowork';
    const mode = agentic ? (r() < 0.08 ? 'routine' : 'agentic') : 'chat';
    const week = Math.floor(r() * 5);
    const weekday = Math.floor(Math.min(6, Math.abs(r() + r() - 1) * 7 + (r() < 0.85 ? 0 : 5)));
    const hour = Math.max(0, Math.min(23, Math.round(11 + (r() + r() + r() - 1.5) * 6)));
    const messages_user = Math.max(1, Math.round(agentic ? 2 + r() * 10 : 1 + r() * 5));
    const messages_assistant = Math.round(messages_user * (agentic ? 3.5 : 1.1));
    const duration_minutes = round(agentic ? 8 + r() * 70 : 2 + r() * 20);
    const tools = agentic ? TOOLS.filter(() => r() < 0.4) : [];
    const connectors = r() < (agentic ? 0.35 : 0.12) ? [pick(CONNECTORS)] : [];
    const skills = agentic && r() < 0.45 ? [pick(SKILLS[fn])] : [];
    const agents = agentic && r() < 0.3 ? [pick(AGENTS[fn]), ...(r() < 0.3 ? [pick(AGENTS[fn])] : [])] : [];
    const surprise = category === 'Personal & life admin' ? r() < 0.35 : r() < 0.03;
    out.push({
      source, week_start: WEEKS[week], weekday, hour, mode, assist_type, category,
      subcategory: pick(subs), paraphrase: pick(PARAPHRASES[category] || ['Work on something']),
      surprise, messages_user, messages_assistant, duration_minutes, tools, connectors, skills, agents,
      model: source.startsWith('claude') ? pick(['claude-opus-4-1', 'claude-sonnet-4-5']) : source === 'codex' ? 'gpt-5-codex' : 'gpt-5',
    });
  }
  return out;
}

function count(list, key) { const m = new Map(); for (const s of list) { const k = key(s); if (k == null) continue; m.set(k, (m.get(k) || 0) + 1); } return m; }
function sortedCounts(m, nameKey = 'name', valKey = 'sessions') { return [...m].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ [nameKey]: k, [valKey]: v })); }

function summarize(sessions, weeks) {
  const total = sessions.length;
  const bySrc = count(sessions, (s) => s.source);
  const byCat = new Map();
  for (const s of sessions) {
    const c = byCat.get(s.category) || { category: s.category, sessions: 0, assist_type_mix: { ask: 0, make: 0, do: 0 }, subs: new Map() };
    c.sessions++; c.assist_type_mix[s.assist_type]++; c.subs.set(s.subcategory, (c.subs.get(s.subcategory) || 0) + 1); byCat.set(s.category, c);
  }
  const byAT = count(sessions, (s) => s.assist_type);
  const ATL = { ask: 'Asked', make: 'Made', do: 'Did' };
  return {
    by_source: [...bySrc].sort((a, b) => b[1] - a[1]).map(([source, n]) => ({ source, label: SOURCE_LABEL[source], sessions: n, messages: sessions.filter((s) => s.source === source).reduce((a, s) => a + s.messages_user + s.messages_assistant, 0), share: round(n / total, 3) })),
    by_week: WEEKS.map((w) => ({ week_start: w, sessions: sessions.filter((s) => s.week_start === w).length, by_source: Object.fromEntries([...bySrc.keys()].map((src) => [src, sessions.filter((s) => s.week_start === w && s.source === src).length])) })),
    by_weekday: WEEKDAYS.map((label, weekday) => ({ weekday, label, sessions: sessions.filter((s) => s.weekday === weekday).length })),
    by_hour: Array.from({ length: 24 }, (_, hour) => ({ hour, sessions: sessions.filter((s) => s.hour === hour).length })),
    by_category: [...byCat.values()].sort((a, b) => b.sessions - a.sessions).map((c) => ({ category: c.category, sessions: c.sessions, share: round(c.sessions / total, 3), assist_type_mix: c.assist_type_mix, subcategories: sortedCounts(c.subs) })),
    by_assist_type: ['ask', 'make', 'do'].map((t) => ({ type: t, label: ATL[t], sessions: byAT.get(t) || 0, share: round((byAT.get(t) || 0) / total, 3) })),
    by_mode: sortedCounts(count(sessions, (s) => s.mode), 'mode'),
    tools: sortedCounts(count(sessions.flatMap((s) => s.tools.map((t) => ({ t }))), (x) => x.t)),
    connectors: sortedCounts(count(sessions.flatMap((s) => s.connectors.map((t) => ({ t }))), (x) => x.t)),
    skills: sortedCounts(count(sessions.flatMap((s) => s.skills.map((t) => ({ t }))), (x) => x.t)),
    agents: sortedCounts(count(sessions.flatMap((s) => s.agents.map((t) => ({ t }))), (x) => x.t)).map((a) => ({ ...a, custom: !['general-purpose', 'explore', 'plan'].includes(a.name.toLowerCase()) })),
    models: sortedCounts(count(sessions, (s) => s.model)),
  };
}

function profile() {
  const sessions = makeSessions('Design', 96);
  const sum = summarize(sessions);
  const msgs = sessions.reduce((a, s) => a + s.messages_user + s.messages_assistant, 0);
  const lens = sessions.map((s) => s.messages_user + s.messages_assistant).sort((a, b) => a - b);
  const surprises = sessions.filter((s) => s.surprise).slice(0, 5).map((s) => ({ paraphrase: s.paraphrase, category: s.category, source: s.source, date: '2026-09-0' + (1 + Math.floor(r() * 9)) }));
  return {
    schema_version: 1, generated_at: '2026-09-19T14:05:00-04:00', window: WINDOW,
    person: { participant_id: 'p_ab12cd34', title: 'Senior Product Designer', function: 'Design' },
    totals: { sessions: sessions.length, sessions_per_week: round(sessions.length / (WINDOW.days / 7)), messages: msgs, active_days: 22, hours_estimated: round(sessions.reduce((a, s) => a + s.duration_minutes, 0) / 60), longest_streak_days: 9, sources: sum.by_source.length },
    ...sum,
    session_length: {
      buckets: [['1 message', (n) => n <= 1], ['2–5', (n) => n >= 2 && n <= 5], ['6–20', (n) => n >= 6 && n <= 20], ['21+', (n) => n > 20]].map(([label, f]) => ({ label, sessions: lens.filter(f).length })),
      median_messages: lens[Math.floor(lens.length / 2)], p90_messages: lens[Math.floor(lens.length * 0.9)],
    },
    highlights: {
      biggest_use_case: sum.by_category[0].category,
      surprise: { paraphrase: "Plan a 6-year-old's birthday party on a budget", category: 'Personal & life admin', why: 'One of only a handful of non-work sessions, and the longest chat of the month' },
      busiest_day: { date: '2026-09-04', sessions: 9 }, peak_hour: sum.by_hour.reduce((a, b) => (b.sessions > a.sessions ? b : a), sum.by_hour[0]).hour,
      signature_move: 'Pastes a screenshot and asks for a critique before asking for a fix',
      one_liner: 'Critiques with Claude by day, learns engineering vocabulary at night',
    },
    surprises,
    sample_sessions: sessions.slice(0, 12).map((s) => ({ paraphrase: s.paraphrase, category: s.category, assist_type: s.assist_type, source: s.source, date: '2026-09-' + String(1 + Math.floor(r() * 18)).padStart(2, '0'), messages: s.messages_user + s.messages_assistant })),
    narrative: {
      headline: 'A critic first, a builder second',
      summary: 'Most sessions ask for a second pair of eyes on work that already exists: flows, copy, accessibility. Making things comes next, mostly docs and rationale for stakeholders. Agentic sessions are rare but long, and they cluster on Thursdays before design review.',
      patterns: ['Sessions spike the day before design review', 'ChatGPT is for quick questions, Claude is for long critiques', 'Almost nothing on weekends, except one very long personal chat'],
    },
  };
}

function aggregate() {
  const people = [
    ...Array.from({ length: 4 }, (_, i) => ({ id: 'p_d' + i, fn: 'Design', n: Math.round(12 + r() * 60) })),
    ...Array.from({ length: 4 }, (_, i) => ({ id: 'p_p' + i, fn: 'Product', n: Math.round(15 + r() * 80) })),
    ...Array.from({ length: 6 }, (_, i) => ({ id: 'p_e' + i, fn: 'Engineering', n: Math.round(30 + r() * 140) })),
  ];
  const all = []; const perPerson = [];
  for (const p of people) {
    const s = makeSessions(p.fn, p.n).map((x) => ({ ...x, participant_id: p.id, function: p.fn }));
    all.push(...s);
    const sum = summarize(s);
    perPerson.push({ participant_id: p.id, function: p.fn, sessions_per_week: round(p.n / (WINDOW.days / 7)), top_category: sum.by_category[0].category, assist_type_mix: Object.fromEntries(sum.by_assist_type.map((a) => [a.type, a.sessions])) });
  }
  const sum = summarize(all);
  const spw = perPerson.map((p) => p.sessions_per_week).sort((a, b) => a - b);
  const byFn = ['Design', 'Product', 'Engineering'].map((fn) => {
    const s = all.filter((x) => x.function === fn); const ss = summarize(s); const n = people.filter((p) => p.fn === fn).length;
    return { function: fn, participants: n, sessions: s.length, sessions_per_person_per_week: round(s.length / n / (WINDOW.days / 7)), top_categories: ss.by_category.slice(0, 4).map((c) => ({ category: c.category, share: c.share })), assist_type_mix: Object.fromEntries(ss.by_assist_type.map((a) => [a.type, a.sessions])), by_source: Object.fromEntries(ss.by_source.map((b) => [b.source, b.sessions])) };
  });
  return {
    schema_version: 1, generated_at: '2026-09-19T15:00:00-04:00', window: WINDOW,
    team: { name: 'Product team', participants: people.length, by_function: byFn.map((f) => ({ function: f.function, participants: f.participants })) },
    totals: { sessions: all.length, messages: all.reduce((a, s) => a + s.messages_user + s.messages_assistant, 0), sessions_per_person_per_week: round(all.length / people.length / (WINDOW.days / 7)) },
    distribution: {
      sessions_per_week_per_person: { buckets: [['0–5', (n) => n <= 5], ['6–15', (n) => n > 5 && n <= 15], ['16–30', (n) => n > 15 && n <= 30], ['31–50', (n) => n > 30 && n <= 50], ['51+', (n) => n > 50]].map(([label, f]) => ({ label, participants: spw.filter(f).length })), median: spw[Math.floor(spw.length / 2)], p90: spw[Math.floor(spw.length * 0.9)], max: spw[spw.length - 1] },
      participants: perPerson,
    },
    by_function: byFn,
    by_category: sum.by_category.map((c) => ({ ...c, by_function: Object.fromEntries(['Design', 'Product', 'Engineering'].map((fn) => [fn, all.filter((s) => s.function === fn && s.category === c.category).length])) })),
    by_assist_type: sum.by_assist_type, by_source: sum.by_source, by_mode: sum.by_mode,
    by_week: WEEKS.map((w) => ({ week_start: w, sessions: all.filter((s) => s.week_start === w).length, active_participants: new Set(all.filter((s) => s.week_start === w).map((s) => s.participant_id)).size })),
    by_weekday: sum.by_weekday, by_hour: sum.by_hour, tools: sum.tools, connectors: sum.connectors,
    skills: sum.skills.map((x) => ({ ...x, participants: new Set(all.filter((s) => s.skills.includes(x.name)).map((s) => s.participant_id)).size })),
    agents: sum.agents.map((x) => ({ ...x, participants: new Set(all.filter((s) => s.agents.includes(x.name)).map((s) => s.participant_id)).size })),
    surprises: all.filter((s) => s.surprise).slice(0, 8).map((s) => ({ paraphrase: s.paraphrase, function: s.function, category: s.category, source: s.source })),
    highlights: { biggest_use_case: sum.by_category[0].category, surprise_use_case: 'Designers prototyping in code with Cowork', most_agentic_function: 'Engineering', most_curious_function: 'Product', one_liner: 'Engineers let AI do, designers ask it to look, PMs ask it to write' },
    narrative: { headline: 'Three functions, three different relationships with AI', summary: 'Engineering sessions are agentic and long. Design sessions are short critiques. Product sits in the middle, writing with AI more than anyone. The distribution is heavy-tailed: two people account for a third of all sessions.', patterns: ['Sessions per person per week range from 3 to 45', 'Every function has a personal-life use case they did not expect to share', 'Thursday is the busiest day for all three functions'] },
  };
}

const kind = process.argv[2] || 'profile';
const data = kind === 'aggregate' ? aggregate() : profile();
const out = process.argv[3];
if (out) writeFileSync(out, JSON.stringify(data, null, 2)); else process.stdout.write(JSON.stringify(data, null, 2));
