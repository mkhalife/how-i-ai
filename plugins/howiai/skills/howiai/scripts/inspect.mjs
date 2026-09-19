#!/usr/bin/env node
// Prints the key structure of a JSON or JSONL file without printing values,
// so an unknown session format can be adapted without reading anyone's content.
//   node scripts/inspect.mjs <file> [--lines 5]
import { readFileSync } from 'node:fs';
import { parseArgs } from './lib/util.mjs';

const args = parseArgs(process.argv.slice(2));
const file = args._[0];
if (!file) { console.error('usage: inspect.mjs <file.json|file.jsonl> [--lines 5]'); process.exit(2); }
const text = readFileSync(file, 'utf8');

function shape(v, depth = 0) {
  if (depth > 5) return '…';
  if (Array.isArray(v)) return v.length ? [shape(v[0], depth + 1), `(${v.length} items)`] : [];
  if (v && typeof v === 'object') { const o = {}; for (const k of Object.keys(v).slice(0, 40)) o[k] = shape(v[k], depth + 1); return o; }
  if (typeof v === 'string') return `string(${v.length})`;
  return typeof v;
}

const isJsonl = file.endsWith('.jsonl');
if (isJsonl) {
  const lines = text.split('\n').filter(Boolean);
  const n = Number(args.lines || 5);
  const seenTypes = new Map();
  for (const l of lines) { try { const r = JSON.parse(l); const t = r.type || r.kind || r.role || '?'; if (!seenTypes.has(t)) seenTypes.set(t, shape(r)); } catch { /* skip */ } }
  console.log(`${lines.length} lines; record types: ${[...seenTypes.keys()].join(', ')}\n`);
  let i = 0; for (const [t, s] of seenTypes) { if (i++ >= n) break; console.log(`--- type: ${t}`); console.log(JSON.stringify(s, null, 1)); }
} else {
  console.log(JSON.stringify(shape(JSON.parse(text)), null, 1));
}
