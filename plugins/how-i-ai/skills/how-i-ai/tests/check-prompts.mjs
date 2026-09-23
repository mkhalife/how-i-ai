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
const wrappedPage = readFileSync(fileURLToPath(new URL('../../../../../docs/wrapped/index.html', import.meta.url)), 'utf8');
const wrappedLiteral = (src) => { const m = src.match(/const WRAPPED_PROMPT = `([\s\S]*?)`;/); return m && m[1]; };
const wrappedFile = readFileSync(fileURLToPath(new URL('../../../../../PROMPT-wrapped.md', import.meta.url)), 'utf8').match(/```\n([\s\S]*?)\n```/)[1];
if (!wrappedLiteral(html) || wrappedLiteral(html) !== wrappedLiteral(wrappedPage) || wrappedLiteral(html).replaceAll('${REPO_RAW}', repoRaw) !== wrappedFile) { console.error('FAIL WRAPPED_PROMPT: docs/index.html, docs/wrapped/index.html and PROMPT-wrapped.md differ'); process.exit(1); }
console.log('   the AI wrapped prompt is the same on both pages and in PROMPT-wrapped.md');
