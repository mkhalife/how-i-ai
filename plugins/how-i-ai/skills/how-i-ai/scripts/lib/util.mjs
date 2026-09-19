// Shared helpers. Node 18+, no dependencies.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, statSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir, platform, hostname } from 'node:os';

export function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) { args[key] = next; i++; } else args[key] = true;
    } else args._.push(a);
  }
  return args;
}

export function sha(s, n = 12) { return 'h_' + createHash('sha256').update(String(s)).digest('hex').slice(0, n); }

export function home() { return process.env.HOW_I_AI_HOME_OVERRIDE || homedir(); }
export function os() { return process.env.HOW_I_AI_PLATFORM_OVERRIDE || platform(); }
export function hostHash() { return sha(hostname()); }

// Directory the user's how-i-ai working files live in. Never inside the repo.
// Two entry points, each on its own: `claude` (the default) reads Claude sessions and works in ~/how-i-ai;
// `chatgpt` (run from inside the ChatGPT desktop app with `--app chatgpt`) reads Codex and ChatGPT sessions and works
// in ~/how-i-ai-chatgpt. Separate folders mean separate config.json, so each gets its own id on the team sheet.
export function appName() { return process.env.HOW_I_AI_APP === 'chatgpt' ? 'chatgpt' : 'claude'; }
export function workDir() { return process.env.HOW_I_AI_DIR || join(home(), appName() === 'chatgpt' ? 'how-i-ai-chatgpt' : 'how-i-ai'); }

export function ensureDir(p) { mkdirSync(p, { recursive: true }); return p; }

export function readJson(p, fallback) {
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch (e) { if (fallback !== undefined) return fallback; throw e; }
}
export function writeJson(p, data) { ensureDir(resolve(p, '..')); writeFileSync(p, JSON.stringify(data, null, 2) + '\n'); }

export function* walk(dir, { maxDepth = 8, filter = () => true } = {}, depth = 0) {
  if (!existsSync(dir) || depth > maxDepth) return;
  let entries = [];
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p, { maxDepth, filter }, depth + 1);
    else if (e.isFile() && filter(p, e.name)) yield p;
  }
}

export function fileTimes(p) {
  try { const s = statSync(p); return { mtime: s.mtime, birthtime: s.birthtime, size: s.size }; } catch { return null; }
}

export function readJsonl(p) {
  const out = [];
  let text;
  try { text = readFileSync(p, 'utf8'); } catch { return out; }
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try { out.push(JSON.parse(line)); } catch { /* skip partial line */ }
  }
  return out;
}

export function toISO(d) { const x = d instanceof Date ? d : new Date(d); return isNaN(x) ? null : x.toISOString(); }
export function fromEpoch(v) { if (v == null) return null; const n = Number(v); if (!isFinite(n)) return null; return new Date(n < 1e12 ? n * 1000 : n); }

export function localDate(iso) { const d = new Date(iso); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; }
export function localHour(iso) { return new Date(iso).getHours(); }
export function localWeekday(iso) { return (new Date(iso).getDay() + 6) % 7; } // 0 = Monday
export function weekStart(iso) { const d = new Date(iso); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - localWeekday(iso)); return localDate(d.toISOString()); }

export function trim(s, n) { if (s == null) return null; s = String(s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

// Strip harness noise that is not the person's own words.
export function cleanPrompt(s) {
  if (!s) return '';
  return String(s)
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '')
    .replace(/<pasted_content[^>]*>[\s\S]*?<\/pasted_content[^>]*>/g, '[pasted content]')
    .replace(/<command-name>[\s\S]*?<\/command-name>/g, '')
    .replace(/<command-message>[\s\S]*?<\/command-message>/g, '')
    .replace(/<command-args>[\s\S]*?<\/command-args>/g, '')
    .replace(/<local-command-stdout>[\s\S]*?<\/local-command-stdout>/g, '')
    .replace(/<ide_[a-z_]+>[\s\S]*?<\/ide_[a-z_]+>/g, '')
    // Desktop scheduled-task runs wrap the task prompt; keep the prompt, drop the wrapper (its attributes hold a file path).
    .replace(/^\s*<scheduled-task\b[^>]*>([\s\S]*?)<\/scheduled-task>\s*$/, '$1')
    .trim();
}

export function isHarnessOnly(s) {
  const t = String(s || '').trim();
  if (!t) return true;
  return /^<(command-name|local-command-stdout|command-message|system-reminder|environment_context|user_instructions|permissions instructions|ide_|task-notification|ci-monitor-event|cross-session-message|bash-input|bash-stdout|bash-stderr|recommended_plugins)/i.test(t) || /^\[Request interrupted/.test(t) || /^Caveat: The messages below were generated by the user while running local commands/.test(t);
}

export function mostCommon(arr) {
  const m = new Map(); for (const x of arr) if (x != null) m.set(x, (m.get(x) || 0) + 1);
  let best = null, n = 0; for (const [k, v] of m) if (v > n) { best = k; n = v; }
  return best;
}

export function uniq(arr) { return [...new Set(arr.filter((x) => x != null && x !== ''))]; }

export function minutesBetween(a, b) { if (!a || !b) return null; const ms = new Date(b) - new Date(a); return ms >= 0 ? Math.round(ms / 6000) / 10 : null; }

// Which entry point a source belongs to.
export function appOf(source) { return /^(codex|chatgpt)/.test(String(source || '')) ? 'chatgpt' : 'claude'; }

export const SOURCE_LABELS = {
  'claude-code': 'Claude Code', 'claude-desktop': 'Claude Desktop', 'claude-cowork': 'Cowork', 'claude-export': 'Claude',
  codex: 'Codex', 'chatgpt-export': 'ChatGPT', 'chatgpt-app': 'ChatGPT',
};
