#!/usr/bin/env node
// Stores who is running this (title, function) and a random participant id, locally.
//   node scripts/config.mjs --title "Senior Product Designer" --function Design
//   node scripts/config.mjs --show
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { parseArgs, workDir, ensureDir, readJson, writeJson } from './lib/util.mjs';

export const FUNCTIONS = ['Design', 'Product', 'Engineering', 'Data', 'Research', 'Marketing', 'Sales', 'Operations', 'Leadership', 'Other'];

export function loadConfig() {
  const p = join(workDir(), 'config.json');
  const c = readJson(p, {});
  if (!c.participant_id) { c.participant_id = 'p_' + randomBytes(4).toString('hex'); ensureDir(workDir()); writeJson(p, c); }
  return c;
}

const isMain = process.argv[1] && /config\.mjs$/.test(process.argv[1]);
if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  const p = join(workDir(), 'config.json');
  const c = loadConfig();
  if (args.title) c.title = String(args.title).trim();
  if (args.function) {
    const f = String(args.function).trim();
    const match = FUNCTIONS.find((x) => x.toLowerCase() === f.toLowerCase());
    if (!match) { console.error(`function must be one of: ${FUNCTIONS.join(', ')}`); process.exit(2); }
    c.function = match;
  }
  if (args['share-url'] !== undefined) c.share_url = args['share-url'] === true ? '' : String(args['share-url']);
  if (args.team) c.team = String(args.team);
  writeJson(p, c);
  console.log(JSON.stringify(c, null, 2));
  console.log(`saved to ${p}`);
}
