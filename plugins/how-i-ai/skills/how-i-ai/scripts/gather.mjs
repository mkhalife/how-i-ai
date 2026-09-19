#!/usr/bin/env node
// Opens the two Claude surfaces that hold history this machine does not (claude.ai Chat and Claude Code on the web),
// each with its prompt filled in, then moves the file each one hands over from Downloads into the inbox.
//   node scripts/gather.mjs [--timeout 300] [--no-open] [--only chat|cloud]
//   node scripts/gather.mjs --chatgpt      open a new task in the ChatGPT desktop app with its prompt, then exit
// The links prefill and never send: the person presses send in each window and clicks the download.
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync, readdirSync, statSync, renameSync, copyFileSync, unlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { parseArgs, workDir, appName, ensureDir, readJson, home, os } from './lib/util.mjs';
import { chatgptDesktopRoots } from './lib/sources.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const REPO_RAW = 'https://raw.githubusercontent.com/mkhalife/how-i-ai/main/';
// Same text as CHATGPT_APP_PROMPT in docs/index.html; tests/run.sh checks they match.
export const CHATGPT_APP_PROMPT = `Fetch ${REPO_RAW}PROMPT-chatgpt-app.md and follow it exactly. It runs how-i-ai from inside the ChatGPT desktop app: you list my ChatGPT conversations with your own thread tools, the scripts inventory my Codex sessions on this machine, you classify them, and I get a profile of how I actually use AI. Do not share anything unless I say yes to a preview.`;

export const TARGETS = {
  chat: {
    file: 'claude-chat-threads.json', prompt: 'PROMPT-claude-chat.md', link: 'claude://claude.ai/new?q=', label: 'Claude chat listing',
    step: 'Claude chat window: press send, then click claude-chat-threads.json when Claude offers it.',
    valid: (d) => d?.source === 'claude-chat' && Array.isArray(d.chats),
  },
  cloud: {
    file: 'cloud-sessions.json', prompt: 'PROMPT-claude-cloud.md', link: 'https://claude.ai/code?q=', label: 'Claude Code cloud session list',
    step: 'Claude Code on the web tab: press send, then download cloud-sessions.json when Claude offers it.',
    valid: (d) => d?.source === 'claude-cloud' && Array.isArray(d.data),
  },
};

// The prompt is the fenced block in the repository's PROMPT-*.md. A plugin install carries only the plugin folder, so
// the marketplace clone (the whole repository) is the second place to look.
export function promptFrom(name) {
  const dirs = [];
  for (let d = here, i = 0; i < 6; i++, d = dirname(d)) dirs.push(d);
  dirs.push(join(process.env.CLAUDE_CONFIG_DIR || join(home(), '.claude'), 'plugins', 'marketplaces', 'how-i-ai'));
  for (const d of dirs) {
    const f = join(d, name);
    if (!existsSync(f)) continue;
    const m = readFileSync(f, 'utf8').replace(/\r\n/g, '\n').match(/```[^\n]*\n([\s\S]*?)\n```/);
    if (m) return m[1];
  }
  return null;
}

// True when the platform opener accepted the link. A shell with no desktop (a Cowork VM, a cloud container, SSH) cannot
// open anything on the person's screen; the caller then prints the link instead.
// Windows goes through rundll32 rather than `cmd /c start`, so cmd.exe never parses the `&` and `%` in the link.
export function openLink(url) {
  const p = os();
  if (p === 'linux' && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) return false;
  const [cmd, args] = p === 'darwin' ? ['open', [url]] : p === 'win32' ? ['rundll32', ['url.dll,FileProtocolHandler', url]] : ['xdg-open', [url]];
  const r = spawnSync(cmd, args, { stdio: 'ignore', timeout: 15000, windowsHide: true });
  return !r.error && r.status === 0;
}

export function downloadsDir() { return join(home(), 'Downloads'); }

// Files of this target's name pattern (browsers append " (1)" and the like), modified since `since`, newest first.
// Every other entry in the folder is dropped here by name, before it is stat'ed or opened.
function candidates(dir, t, since) {
  const stem = t.file.replace(/\.json$/, '');
  let names = [];
  try { names = readdirSync(dir); } catch { return []; }
  return names.filter((n) => n.startsWith(stem) && n.endsWith('.json')).map((n) => {
    const p = join(dir, n);
    try { const s = statSync(p); return s.isFile() && s.mtimeMs >= since ? { p, n, mtime: s.mtimeMs } : null; } catch { return null; }
  }).filter(Boolean).sort((a, b) => b.mtime - a.mtime);
}

function move(src, dest) {
  try { renameSync(src, dest); } catch (e) { if (e.code !== 'EXDEV') throw e; copyFileSync(src, dest); unlinkSync(src); }
}

const isMain = process.argv[1] && /gather\.mjs$/.test(process.argv[1]);
if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  const self = join(here, 'how-i-ai.mjs');
  if (appName() !== 'claude') { console.error(`gather belongs to the Claude entry point. The ChatGPT run needs no file pickup; to open it, run: node ${self} gather --chatgpt`); process.exit(2); }

  if (args.chatgpt) {
    const url = 'codex://threads/new?prompt=' + encodeURIComponent(CHATGPT_APP_PROMPT);
    if (openLink(url)) console.log('Opened a new task in the ChatGPT desktop app with the how-i-ai prompt filled in. Press send there; that run works in ~/how-i-ai-chatgpt on its own.');
    else console.log(`Could not open the ChatGPT desktop app from here. Open this link on the computer it is installed on:\n${url}`);
    process.exit(0);
  }

  if (args.only && !TARGETS[args.only]) { console.error('--only must be chat or cloud'); process.exit(2); }
  const kinds = args.only ? [args.only] : ['chat', 'cloud'];
  const timeout = Math.max(0, Number(args.timeout ?? 300) || 0);
  const since = Date.now() - 2000; // file-time granularity
  const inbox = ensureDir(join(workDir(), 'inbox'));
  const downloads = downloadsDir();

  const opened = [], manual = [];
  for (const k of kinds) {
    const t = TARGETS[k];
    const prompt = promptFrom(t.prompt);
    if (!prompt) { console.log(`${t.prompt} is not next to these scripts; use its button on the landing page instead.`); continue; }
    if (args['no-open']) continue;
    const url = t.link + encodeURIComponent(prompt);
    if (openLink(url)) opened.push(t); else manual.push([t, url]);
  }
  for (const t of opened) console.log(t.step);
  for (const [t, url] of manual) console.log(`Could not open a window from here. Open this link on your computer, press send, and save ${t.file} into ${inbox}:\n${url}`);

  // The inbox is watched too, for a file the person saved there directly.
  const dirs = [existsSync(downloads) ? downloads : null, inbox].filter(Boolean);
  console.log(`Waiting up to ${timeout}s for ${kinds.map((k) => TARGETS[k].file).join(' and ')} in ${dirs.join(' and ')}.`);

  const pending = new Set(kinds), rejected = new Map();
  // The copy already in the inbox counts only once it is rewritten.
  const mtimeOf = (f) => { try { return statSync(f).mtimeMs; } catch { return null; } };
  const before = new Map(kinds.map((k) => [k, mtimeOf(join(inbox, TARGETS[k].file))]));
  const check = (k) => {
    const t = TARGETS[k], dest = join(inbox, t.file);
    for (const dir of dirs) for (const c of candidates(dir, t, since)) {
      if (c.p === dest && c.mtime === before.get(k)) continue;
      if (!t.valid(readJson(c.p, null))) { rejected.set(c.p, `${c.n} in ${dir} as it was: it is not a ${t.label}`); continue; } // may still be downloading; checked again next poll
      rejected.delete(c.p);
      if (c.p !== dest) move(c.p, dest);
      return true;
    }
    return false;
  };
  const deadline = Date.now() + timeout * 1000;
  for (;;) {
    for (const k of [...pending]) if (check(k)) { pending.delete(k); console.log(`${TARGETS[k].file} arrived, now in ${inbox}`); }
    if (!pending.size || Date.now() >= deadline) break;
    await new Promise((r) => setTimeout(r, 1000));
  }

  const arrived = kinds.filter((k) => !pending.has(k)).map((k) => TARGETS[k].file);
  const missing = [...pending].map((k) => TARGETS[k].file);
  console.log(`\nArrived: ${arrived.join(', ') || 'none'}. Not arrived: ${missing.join(', ') || 'none'}.`);
  for (const where of rejected.values()) console.log(`Left ${where}.`);
  if (chatgptDesktopRoots().some((r) => existsSync(r))) console.log(`The ChatGPT desktop app is on this machine. ChatGPT and Codex are a separate run: node ${self} gather --chatgpt opens a new task there with its prompt filled in.`);
  process.exit(0);
}
