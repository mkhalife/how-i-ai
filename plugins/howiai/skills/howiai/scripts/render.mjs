#!/usr/bin/env node
// Injects a JSON document into an HTML template and writes a self-contained page.
//   node scripts/render.mjs --template templates/profile-wrapped.html --data profile.json --out howiai-profile.html
// The template must contain: <script id="howiai-data" type="application/json">__HOWIAI_DATA__</script>
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => {
  if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]);
  return acc;
}, []));

if (!args.template || !args.data || !args.out) {
  console.error('usage: render.mjs --template <file.html> --data <file.json> --out <file.html>');
  process.exit(2);
}
const template = readFileSync(resolve(args.template), 'utf8');
const data = JSON.parse(readFileSync(resolve(args.data), 'utf8'));
// Escape sequences that would end the script block or be parsed as HTML / JS line terminators.
const LS = String.fromCharCode(0x2028), PS = String.fromCharCode(0x2029);
const json = JSON.stringify(data).split('<').join('\\u003c').split(LS).join('\\u2028').split(PS).join('\\u2029');
if (!template.includes('__HOWIAI_DATA__')) {
  console.error('template has no __HOWIAI_DATA__ placeholder');
  process.exit(1);
}
const html = template.replace('__HOWIAI_DATA__', () => json);
mkdirSync(dirname(resolve(args.out)), { recursive: true });
writeFileSync(resolve(args.out), html);
console.log(`wrote ${args.out} (${(html.length / 1024).toFixed(0)} KB)`);
