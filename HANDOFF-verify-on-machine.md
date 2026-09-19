# Handoff: verify how-i-ai on a real machine

You are a coding agent running on a machine that has Claude Code, Claude Desktop (Chat
and Cowork), and the ChatGPT desktop app installed and signed in. The `how-i-ai` project
was built on a Linux cloud box without any of those apps, so several parsers were
written from documentation and reverse-engineering reports rather than real files. Your
job: verify each source against what is really on this disk, fix the parsers where they
are wrong, run the whole skill end to end on this machine's real data, and push the
fixes as a branch with a pull request. Do not share anything to any team endpoint.

Repository: https://github.com/mkhalife/how-i-ai (public, MIT). Skill folder:
`plugins/how-i-ai/skills/how-i-ai/`. Read `SKILL.md`, `references/sources.md`,
`references/data-schema.md`, and `scripts/lib/sources.mjs` before touching anything.

## Ground rules

- Everything stays on this machine. Never run `share send`. Never commit anything from
  `~/how-i-ai/` (sessions, batches, profiles, exports). `.gitignore` already covers the
  usual names; check `git status` before every commit anyway.
- When you print file contents to reason about a format, use
  `node scripts/inspect.mjs <file>` (keys only, no values). If you must look at a value,
  look at one field of one record, not whole files; these are the user's private chats.
- Keep parser changes small and tolerant. The formats are undocumented and will change
  again; prefer "look for these keys, fall back to those" over exact schemas.
- Every parser change needs a matching fixture change in `tests/make-fake-home.mjs` so
  `bash tests/run.sh` exercises the real shape. Tests must pass on the way out.
- Node 18+ and git are required; check `node --version` first.

## Setup

```bash
git clone https://github.com/mkhalife/how-i-ai ~/how-i-ai/repo
cd ~/how-i-ai/repo && git checkout -b verify-on-mac   # or verify-on-windows
cd plugins/how-i-ai/skills/how-i-ai && bash tests/run.sh
```

## 1. Claude Desktop: Chat and Cowork sessions (highest value, least verified)

The parser is `claudeDesktop()` / `parseDesktopStateFile()` in `scripts/lib/sources.mjs`.
It was written from Anthropic's data-storage doc, which says each session is a
`local_<uuid>.json` state file plus a working directory under
`local-agent-mode-sessions/<account>/<org>/`, with `audit.jsonl` inside. The key names
inside the state file are guessed.

Find the real layout:

```bash
# macOS
ls -la ~/Library/Application\ Support/Claude/local-agent-mode-sessions/
find ~/Library/Application\ Support/Claude/local-agent-mode-sessions -maxdepth 3 | head -40
# Windows (PowerShell): $env:LOCALAPPDATA\Claude\local-agent-mode-sessions (older builds: $env:APPDATA)
```

Then, for one Chat session and one Cowork session:

```bash
node scripts/inspect.mjs "<path to a local_*.json>"
node scripts/inspect.mjs "<path to that session's audit.jsonl>" --lines 8
find "<that session's working dir>" -maxdepth 2 -type f | head
```

Answer, and fix the parser to match:

1. Where is the session title, created time, updated time, and the list of messages?
   Which key says whether it is a Chat conversation or a Cowork session? Is there a
   flag for scheduled-task runs (Cowork "scheduled tasks")?
2. Is the transcript in the state file, or in a separate file in the working directory?
   If separate and in Claude Code JSONL shape, `parseClaudeCodeTranscript` already
   handles it; confirm the source comes out as `claude-cowork`.
3. What does an `audit.jsonl` tool-invocation record look like (which key holds the tool
   name)? The parser currently guesses `tool`, `toolName`, `tool_name`, `name`.
4. Do Code sessions launched from the desktop app appear in `claude-code-sessions/` with
   their transcripts in `~/.claude/projects` (expected)? Make sure they are not counted
   twice.

Then run `node scripts/collect.mjs --dry-run` and confirm `claude-desktop` and
`claude-cowork` show sensible counts. Update the fixture generator so the fake
`local_*.json` and `audit.jsonl` match the real key names.

## 2. Claude Code transcripts

`~/.claude/projects/**/*.jsonl` is the best-known format, but check two things on real
data:

- Run `node scripts/collect.mjs --dry-run` and compare the `claude-code` count with
  `claude --resume` (interactive picker; press Esc). They should be in the same
  ballpark for the last 30 days; investigate large gaps (sessions with no human text
  are skipped on purpose).
- Skills and agents: open a session where you used a skill (`/something`) and one where
  a sub-agent ran. Confirm `skills` and `agents` are populated in `sessions.json`
  (`node -e` over the JSON is fine). If slash commands appear in a shape other than
  `<command-name>/x</command-name>` in a user message, adapt `skillsAndAgents()`.
- Routines: if any routine ran on this machine, confirm `origin.kind` distinguishes it.

## 3. ChatGPT desktop app

Research (September 2026) says macOS chats are encrypted with a Keychain key we must
not try to read, and the Windows app keeps only a volatile IndexedDB log. The collector
only reports a signal. Verify the layout so the signal is right:

```bash
# macOS
ls -la ~/Library/Application\ Support/com.openai.chat/ 2>/dev/null
ls -la ~/Library/Application\ Support/Codex/ 2>/dev/null
# Windows (PowerShell)
Get-ChildItem "$env:LOCALAPPDATA\Packages" | Where-Object Name -like "OpenAI.ChatGPT-Desktop*"
```

Confirm `chatgptDesktop()` finds the folder and reports `cached_conversations` and
`last_activity`. Do NOT attempt to decrypt `conversations-v2/v3` or read Keychain
items. Do not carve the Windows IndexedDB log for message text either; if it looks
easy, note it in your report instead of building it.

## 4. Codex (if installed)

`~/.codex/sessions/**/rollout-*.jsonl`. Run `--dry-run`, then inspect one rollout with
`inspect.mjs` and confirm: the first user message comes from the `user_message` event
(not the injected `<environment_context>` items), tool names come from
`function_call`/`custom_tool_call`, and MCP calls carry a server name. If `codex` is on
PATH and signed in, confirm `codex cloud list --json` is parsed (or note the error).
Never read `~/.codex/auth.json` or `~/.codex/shell_snapshots/`.

## 5. Deep links

Open these from a shell and report what happens (opens with prompt prefilled, opens
without prompt, nothing):

```bash
open "claude-cli://open?q=hello%20from%20how-i-ai"        # macOS; Windows: start "" "claude-cli://open?q=..."
open "claude://cowork/new?q=hello%20from%20how-i-ai"
open "claude://claude.ai/new?q=hello%20from%20how-i-ai"
open "https://claude.ai/new?q=hello%20from%20how-i-ai"     # reports conflict on whether this still prefills
open "https://chatgpt.com/?q=hello%20from%20how-i-ai"      # expected to auto-submit
```

Fix `docs/index.html` if a button target is wrong, and note which ones need the app
opened once first.

## 6. Full run on real data

Follow `SKILL.md` from step 0 as the user of this machine would: config, collect,
classify (you do the judging, in batches), stats, narrative, render all three profile
designs, open them, then `share preview` only (never `share send`). Check:

- The share preview has no prompt text, titles, paths, or repo names anywhere. Grep
  `~/how-i-ai/share-rows.json` for the home directory path and the machine name.
- Every paraphrase reads as generic; fix `references/classification-guidelines.md` if
  you found yourself needing a rule that is not there.
- The three profile pages render without console errors (open them and check).
- Note anything in the SKILL flow that was confusing, slow, or needed a workaround.

## 7. Deliver

- `bash tests/run.sh` passes with the updated fixtures.
- Commit with clear messages, push the branch, open a pull request to `main` titled
  "Verify parsers on a real <macOS|Windows> machine". In the PR body, one section per
  numbered step above: what you found, what you changed, what is still unknown. Include
  the key structures you observed (from `inspect.mjs`, keys only) so the next person can
  see the real formats without a machine.
- Do not include any session content, paraphrases, counts that identify projects, or
  screenshots of real data in the PR.
