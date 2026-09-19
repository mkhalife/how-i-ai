#!/usr/bin/env node
// Injects a JSON document into an HTML template and writes a self-contained page.
//   node scripts/render.mjs                      the profile: templates/profile-wrapped.html + <work dir>/profile.json → <work dir>/how-i-ai.html
//   node scripts/render.mjs --template templates/aggregate-boardroom.html --data aggregate.json --out team.html
// The template must contain: <script id="how-i-ai-data" type="application/json">__HOW_I_AI_DATA__</script>
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { workDir } from './lib/util.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => {
  if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]);
  return acc;
}, []));

// No arguments renders the person's profile in the default design.
args.template = args.template || join(dirname(fileURLToPath(import.meta.url)), '..', 'templates', 'profile-wrapped.html');
args.data = args.data || join(workDir(), 'profile.json');
args.out = args.out || join(workDir(), 'how-i-ai.html');
const template = readFileSync(resolve(args.template), 'utf8');
const data = JSON.parse(readFileSync(resolve(args.data), 'utf8'));
// Escape sequences that would end the script block or be parsed as HTML / JS line terminators.
const LS = String.fromCharCode(0x2028), PS = String.fromCharCode(0x2029);
const json = JSON.stringify(data).split('<').join('\\u003c').split(LS).join('\\u2028').split(PS).join('\\u2029');
if (!template.includes('__HOW_I_AI_DATA__')) {
  console.error('template has no __HOW_I_AI_DATA__ placeholder');
  process.exit(1);
}
const html = template.replace('__HOW_I_AI_DATA__', () => json);
mkdirSync(dirname(resolve(args.out)), { recursive: true });
writeFileSync(resolve(args.out), html);
console.log(`wrote ${args.out} (${(html.length / 1024).toFixed(0)} KB)`);
