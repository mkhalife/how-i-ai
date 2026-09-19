#!/usr/bin/env node
// Stands in for Claude during tests: answers every batch with a deterministic keyword classification.
//   node tests/fake-classify.mjs <classify dir>
import { readdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
const dir = process.argv[2];
const rules = [
  [/test|ci|fail|bug|flaky/i, 'Debug & fix', 'Failing test', 'do'], [/feature|migrate|endpoint|action|flag/i, 'Build & ship code', 'Add a feature', 'do'],
  [/prd|draft|note|write/i, 'Write & edit', 'Doc', 'make'], [/critique|contrast|screens/i, 'Design critique & feedback', 'Critique a flow', 'ask'],
  [/interview|cluster|themes/i, 'Research & synthesis', 'Interview synthesis', 'make'], [/explain|how does|why/i, 'Explain & learn', 'Concept', 'ask'],
  [/sql|funnel/i, 'Analyze data', 'SQL', 'make'], [/roadmap|bets/i, 'Plan & prioritize', 'Roadmap', 'ask'],
  [/birthday|marathon|landlord/i, 'Personal & life admin', 'Life', 'make'], [/review|summarize/i, 'Review & explain code', 'PR review', 'ask'],
];
for (const f of readdirSync(dir).filter((f) => /^batch-\d+\.json$/.test(f))) {
  const b = JSON.parse(readFileSync(join(dir, f), 'utf8'));
  const items = b.items.map((it) => {
    const text = (it.first_message || '') + ' ' + (it.title || '');
    const r = rules.find(([re]) => re.test(text)) || [null, 'Other', null, 'ask'];
    return { id: it.id, category: r[1], subcategory: r[2], assist_type: r[3], paraphrase: 'Generic: ' + r[1].toLowerCase() + ' (' + it.source + ')', surprise: r[1] === 'Personal & life admin', confidence: 0.8 };
  });
  writeFileSync(join(dir, f.replace('.json', '.out.json')), JSON.stringify({ items }, null, 1));
}
console.log('fake classification written');
