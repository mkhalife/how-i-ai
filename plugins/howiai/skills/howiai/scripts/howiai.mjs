#!/usr/bin/env node
// Single entry point. Every subcommand is its own file in this folder.
//   node scripts/howiai.mjs <collect|classify|stats|render|share|aggregate|config|inspect|sample> [args]
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const [cmd, ...rest] = process.argv.slice(2);
const map = { collect: 'collect.mjs', classify: 'classify.mjs', stats: 'stats.mjs', render: 'render.mjs', share: 'share.mjs', aggregate: 'aggregate.mjs', config: 'config.mjs', inspect: 'inspect.mjs', sample: 'sample-data.mjs' };
if (!map[cmd]) {
  console.log(`howiai · how you actually use AI\n\nusage: node scripts/howiai.mjs <command> [options]\n\n  config     --title "..." --function Design      who is running this (stored locally)\n  collect    [--days 30]                          inventory sessions on this machine\n  classify   prep | merge                         batch sessions for Claude, then validate its answers\n  stats      [--narrative narrative.json]         compute profile.json\n  render     --template t.html --data d.json --out o.html\n  share      preview | send                       show exactly what would be shared; send it\n  aggregate  --url | --json | --csv               build the team aggregate.json\n  inspect    <file>                               print a file's key structure, no values\n  sample     profile | aggregate [out]            generate sample data for previews\n\nNode ${process.version}. Working folder: ${process.env.HOWIAI_DIR || '~/howiai'}`);
  process.exit(cmd ? 2 : 0);
}
const r = spawnSync(process.execPath, [join(here, map[cmd]), ...rest], { stdio: 'inherit' });
process.exit(r.status ?? 1);
