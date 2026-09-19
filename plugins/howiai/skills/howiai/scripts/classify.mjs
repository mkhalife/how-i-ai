#!/usr/bin/env node
// Two halves of classification. The model does the judging; this script does the bookkeeping.
//   node scripts/classify.mjs prep  [--in ~/howiai/sessions.json] [--dir ~/howiai/classify] [--size 40]
//       writes batch-001.json … for Claude to read, and expects batch-001.out.json … back
//   node scripts/classify.mjs merge [--in ~/howiai/sessions.json] [--dir ~/howiai/classify]
//       validates every .out.json, writes classifications into sessions.json, exits 1 if any session is still unclassified
import { join } from 'node:path';
import { readdirSync, existsSync } from 'node:fs';
import { parseArgs, workDir, ensureDir, readJson, writeJson, trim } from './lib/util.mjs';

const args = parseArgs(process.argv.slice(2));
const cmd = args._[0];
const dir = workDir();
const inFile = args.in || join(dir, 'sessions.json');
const cdir = ensureDir(args.dir || join(dir, 'classify'));
const ASSIST = new Set(['ask', 'make', 'do']);

if (cmd === 'prep') {
  const doc = readJson(inFile);
  const size = Number(args.size || 40);
  const todo = doc.sessions.filter((s) => !s.classification);
  const total = Math.ceil(todo.length / size);
  for (const f of readdirSync(cdir)) if (/^batch-\d+\.json$/.test(f)) { /* leave old outputs, refresh inputs */ }
  for (let i = 0; i < total; i++) {
    const items = todo.slice(i * size, (i + 1) * size).map((s) => ({
      id: s.id, source: s.source, surface: s.surface, mode: s.mode, trigger: s.trigger, title: s.title,
      first_message: trim(s.first_message, 1200), context: s.context, messages_user: s.messages_user, tools: s.tools, connectors: s.connectors,
    }));
    const name = `batch-${String(i + 1).padStart(3, '0')}`;
    writeJson(join(cdir, name + '.json'), { batch: i + 1, of: total, expected_output: join(cdir, name + '.out.json'), items });
  }
  console.log(`${todo.length} sessions to classify in ${total} batch file(s) under ${cdir}`);
  console.log(total ? `Read each batch-NNN.json and write batch-NNN.out.json as {"items":[{id, category, subcategory, assist_type, paraphrase, surprise, confidence}]}. Then run: node scripts/classify.mjs merge` : 'Nothing to do.');
  process.exit(0);
}

if (cmd === 'merge') {
  const doc = readJson(inFile);
  const byId = new Map(doc.sessions.map((s) => [s.id, s]));
  const problems = [];
  let applied = 0;
  const outs = existsSync(cdir) ? readdirSync(cdir).filter((f) => /\.out\.json$/.test(f)).sort() : [];
  for (const f of outs) {
    let data; try { data = readJson(join(cdir, f)); } catch (e) { problems.push(`${f}: not valid JSON (${e.message})`); continue; }
    const items = Array.isArray(data) ? data : data.items;
    if (!Array.isArray(items)) { problems.push(`${f}: expected {"items":[...]}`); continue; }
    for (const it of items) {
      const s = byId.get(it.id);
      if (!s) { problems.push(`${f}: unknown id ${it.id}`); continue; }
      const err = validate(it);
      if (err) { problems.push(`${f}: ${it.id}: ${err}`); continue; }
      s.classification = {
        category: norm(it.category, 40), subcategory: it.subcategory ? norm(it.subcategory, 40) : null,
        assist_type: String(it.assist_type).toLowerCase(), paraphrase: trim(it.paraphrase, 120), surprise: !!it.surprise,
        confidence: Math.max(0, Math.min(1, Number(it.confidence ?? 0.7))),
      };
      applied++;
    }
  }
  const missing = doc.sessions.filter((s) => !s.classification);
  writeJson(inFile, doc);
  console.log(`applied ${applied} classification(s); ${doc.sessions.length - missing.length}/${doc.sessions.length} sessions classified`);
  for (const p of problems.slice(0, 50)) console.log('  ! ' + p);
  if (problems.length > 50) console.log(`  … ${problems.length - 50} more`);
  if (missing.length) {
    console.log(`\n${missing.length} still unclassified: ${missing.slice(0, 10).map((s) => s.id).join(', ')}${missing.length > 10 ? ' …' : ''}`);
    console.log('Re-run: node scripts/classify.mjs prep   (it only re-batches the unclassified ones)');
    process.exit(1);
  }
  process.exit(0);
}

console.error('usage: classify.mjs prep|merge'); process.exit(2);

function norm(s, n) { s = String(s).replace(/\s+/g, ' ').trim(); s = s.charAt(0).toUpperCase() + s.slice(1); return trim(s, n); }
function validate(it) {
  if (!it.category || String(it.category).trim().length < 3) return 'category missing';
  if (!ASSIST.has(String(it.assist_type || '').toLowerCase())) return `assist_type must be ask|make|do (got ${it.assist_type})`;
  const p = String(it.paraphrase || '').trim();
  if (p.length < 8) return 'paraphrase missing or too short';
  if (p.length > 160) return 'paraphrase over 160 chars';
  if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(p)) return 'paraphrase contains an email address';
  if (/https?:\/\//i.test(p)) return 'paraphrase contains a URL';
  if (/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/.test(p)) return 'paraphrase contains a phone number';
  if (/\b(sk|ghp|xox[abp]|AKIA)[-_A-Za-z0-9]{8,}/.test(p)) return 'paraphrase looks like it contains a secret';
  return null;
}
