# Handoff: verify how-i-ai on Windows

Every parser in `scripts/lib/sources.mjs` is verified against real macOS files from Claude
Code, Claude Desktop (Cowork), Codex and the ChatGPT desktop app, and both entry points run
end to end there. The Windows paths are written from the macOS layout and are still guesses.

You are a coding agent on a Windows machine with Claude Code, Claude Desktop and the ChatGPT
desktop app installed and signed in. Check the items below against what is really on this
disk, fix what is wrong, run both entry points end to end, and open a pull request.

Repository: https://github.com/mkhalife/how-i-ai. Skill folder:
`plugins/how-i-ai/skills/how-i-ai/`. Read `SKILL.md`, `references/sources.md`,
`references/data-schema.md` and `scripts/lib/sources.mjs` first.

## Ground rules

- Everything stays on this machine. Never run `share send`. Never commit anything from
  `~/how-i-ai` or `~/how-i-ai-chatgpt` (sessions, batches, profiles, exports, inbox files).
  `.gitignore` covers the usual names; check `git status` before every commit anyway.
- To reason about a format, print keys only: `node scripts/inspect.mjs <file>`. If you must
  look at a value, look at one field of one record. These are the person's private chats.
- Keep parser changes small and tolerant: "look for these keys, fall back to those", not
  exact schemas. The formats are undocumented and will change again.
- Every parser change needs a matching fixture change in `tests/make-fake-home.mjs` so
  `bash tests/run.sh` exercises the real shape. It must end `ALL OK` on the way out.
- Node 18+ and git are required; check `node --version` first.

## Setup

```powershell
git clone https://github.com/mkhalife/how-i-ai "$HOME\how-i-ai\repo"
cd "$HOME\how-i-ai\repo"; git checkout -b verify-on-windows
cd plugins\how-i-ai\skills\how-i-ai; bash tests/run.sh
```

## 1. Claude Desktop folder

`claudeDesktopRoots()` tries `%LOCALAPPDATA%\Claude`, `%APPDATA%\Claude`, and `Claude-3p`
next to each. Confirm which one a signed-in install uses, and that
`local-agent-mode-sessions\<account>\<org>\` and `claude-code-sessions\<account>\<org>\` sit
inside it with the same `local_<uuid>.json` plus `local_<uuid>\` layout as macOS
(`references/sources.md`, "Claude Desktop on disk"). Then run
`node scripts/collect.mjs --dry-run` and check the `claude-cowork` count.

## 2. ChatGPT Store app folder

`chatgptDesktop()` tries `%LOCALAPPDATA%\Packages\OpenAI.ChatGPT-Desktop_*\LocalCache\Roaming\ChatGPT`,
`%APPDATA%\OpenAI\ChatGPT` and `%LOCALAPPDATA%\OpenAI\ChatGPT`, and reports a signal only:
installed, cached conversation count, last activity. Confirm the folder is found and the
signal is sensible. Do not carve the IndexedDB log for message text; if it looks easy,
say so in the report instead of building it.

## 3. The bundled `codex.exe` and node

`codexBinaries()` guesses `%LOCALAPPDATA%\Programs\{ChatGPT,Codex}\resources\codex.exe`,
`%LOCALAPPDATA%\{ChatGPT,Codex}\resources\codex.exe`, and
`%ProgramFiles%\WindowsApps\OpenAI.*\app\resources\codex.exe`. Find where the app keeps it,
fix the list, and confirm `codex cloud list --json` is parsed (or note the error).
`PROMPT-chatgpt-app.md` tells the in-app agent to look for `cua_node\bin\node.exe` under the
app's `resources` folder when no `node` is on PATH; correct that path too. Never read
`~\.codex\auth.json` or `~\.codex\shell_snapshots\`.

## 4. Deep links

Open each link from a shell and report what happens (opens with the prompt prefilled, opens
without it, nothing):

```powershell
start "" "claude-cli://open?q=hello%20from%20how-i-ai"
start "" "claude://cowork/new?q=hello%20from%20how-i-ai"
start "" "claude://claude.ai/new?q=hello%20from%20how-i-ai"
start "" "https://claude.ai/code?q=hello%20from%20how-i-ai"
start "" "codex://threads/new?prompt=hello%20from%20how-i-ai"
start "" "https://chatgpt.com/?q=hello%20from%20how-i-ai"
```

Fix `docs/index.html` if a target is wrong, and note which ones need the app opened once
first.

## 5. Both entry points, end to end

Follow `SKILL.md` from step 0 as the user of this machine would, twice: the Claude entry
point from Claude Code, and the ChatGPT entry point (`PROMPT-chatgpt-app.md`) from inside
the ChatGPT desktop app. Stop at `share preview`; never `share send`. Check:

- The preview holds no prompt text, titles, paths or repository names. Grep
  `share-rows.json` in both working folders for the home directory path and the machine
  name.
- The two folders hold two different `participant_id` values and no overlapping sessions.
- The profile page renders without console errors.
- Every paraphrase reads as generic; fix `references/classification-guidelines.md` if you
  needed a rule that is not there.

## 6. Deliver

`bash tests/run.sh` ends `ALL OK` with the updated fixtures. Commit with clear messages,
push the branch, and open a pull request to `main` titled "Verify parsers on a real
Windows machine", with one section per numbered step: what you found, what you changed,
what is still unknown. Include the key structures you observed (`inspect.mjs`, keys only)
so the next person can see the real formats without a machine. No session content, no
paraphrases, no screenshots of real data.
