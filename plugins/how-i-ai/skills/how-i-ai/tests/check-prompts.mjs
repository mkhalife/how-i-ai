// The prompts gather opens must be the ones the landing page opens and the PROMPT-*.md files show.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { promptFrom, CHATGPT_APP_PROMPT } from '../scripts/gather.mjs';

const html = readFileSync(fileURLToPath(new URL('../../../../../docs/index.html', import.meta.url)), 'utf8');
const repoRaw = html.match(/const REPO_RAW = '([^']+)'/)[1];
const literal = (name) => {
  const m = html.match(new RegExp('const ' + name + ' = `([\\s\\S]*?)`;'));
  return m ? m[1].replaceAll('${REPO_RAW}', repoRaw) : null;
};
const pairs = [
  ['PROMPT-claude-chat.md', promptFrom('PROMPT-claude-chat.md'), literal('CLAUDE_CHAT_PROMPT')],
  ['PROMPT-claude-cloud.md', promptFrom('PROMPT-claude-cloud.md'), literal('CLAUDE_CLOUD_PROMPT')],
  ['CHATGPT_APP_PROMPT', CHATGPT_APP_PROMPT, literal('CHATGPT_APP_PROMPT')],
];
for (const [name, script, page] of pairs) {
  if (!script || !page || script !== page) { console.error(`FAIL ${name}: gather and docs/index.html open different prompts`); process.exit(1); }
}
console.log('   gather, the PROMPT files and the landing page carry the same prompts');
