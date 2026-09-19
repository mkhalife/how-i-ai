# how-i-ai

People describe how they use AI. This shows it, from the data.

`how-i-ai` is a Claude skill that reads your own session history on this machine (Claude
Code, Cowork, and the chat and cloud session lists Claude hands you), takes the first
message of each session and a little context, classifies what every session was for and
whether AI informed you or did the work, and renders a profile of your last 30 days.
Then, only if you say yes after seeing the exact rows, it shares an anonymized version
to a team sheet so a team can learn from each other.

There are two independent entry points. The Claude one (the default) reads Claude
sessions and works in `~/how-i-ai`. The ChatGPT one is run from inside the ChatGPT
desktop app with `--app chatgpt`, reads Codex sessions and ChatGPT conversations, and
works in `~/how-i-ai-chatgpt`. Each keeps its own random id and both post to the same
team sheet; if you use both tools, run both.

- **Landing page with one-click "run with Claude" buttons:** `docs/index.html`
  (enable GitHub Pages on `main` → `/docs` to host it)
- **Skill:** `plugins/how-i-ai/skills/how-i-ai/SKILL.md`
- **Standalone prompt, no plugin install:** `PROMPT.md` (Claude Code, Cowork); inside the
  ChatGPT desktop app (ChatGPT conversations and Codex sessions): `PROMPT-chatgpt-app.md`;
  export-based fallback for chat-only surfaces (chatgpt.com, claude.ai chat):
  `PROMPT-chat.md`
- **Optional first steps for the Claude run:** `PROMPT-claude-chat.md` (claude.ai Chat lists
  your chats into `claude-chat-threads.json`) and `PROMPT-claude-cloud.md` (a claude.ai/code
  session lists your cloud sessions into `cloud-sessions.json`). Each gives you the file as
  a download. Save either file into
  `~/how-i-ai/inbox`; the Claude Code or Cowork run picks it up
- **Team sheet backend:** `apps-script/`

## Install

```bash
claude plugin marketplace add mkhalife/how-i-ai
claude plugin install how-i-ai@how-i-ai
```

Then, in Claude Code: "show me how I use AI", or `/how-i-ai:how-i-ai`. Node 18+ is the only
requirement (Claude Code already needs it).

Without the plugin, paste `PROMPT.md` into Claude Code or Cowork, or
`PROMPT-chatgpt-app.md` into a new task in the ChatGPT desktop app. Or use the buttons on
the landing page, which open the app with the prompt pre-filled:

| Card | Link it opens | Reads |
|---|---|---|
| Optional first: Claude chats | `claude://claude.ai/new?q=…` (whole prompt inline) | lists your chats into `claude-chat-threads.json` for the inbox |
| Optional first: Claude Code on the web | `https://claude.ai/code?q=…` (whole prompt inline) | lists your cloud sessions into `cloud-sessions.json` for the inbox |
| Claude Code | `claude-cli://open?q=…` | Claude Code, Cowork, the two optional inbox files, and a claude.ai export if present |
| Cowork | `claude://cowork/new?q=…` | Claude Code, Cowork, the two optional inbox files, and a claude.ai export if present |
| Chat only, from an export | `claude://claude.ai/new?q=…` | an uploaded export zip (fallback without Claude Code or Cowork) |
| ChatGPT desktop app | `codex://threads/new?prompt=…` | ChatGPT conversations and Codex sessions |
| ChatGPT on the web | `https://chatgpt.com/?q=…` | an uploaded export zip (fallback without the ChatGPT desktop app; chatgpt.com cannot list conversations) |

## What it does

1. Asks your title and function (Design, Product, Engineering, …).
2. `collect`: inventories sessions from every source its entry point owns, last 30
   days, into `~/how-i-ai/sessions.json` (`~/how-i-ai-chatgpt/sessions.json` with
   `--app chatgpt`). Chat history comes from a listing file in that folder's `inbox`:
   Claude in Chat mode lists Claude chats, and the agent inside the ChatGPT desktop app
   lists ChatGPT conversations. The official data export is an optional top-up: it adds
   real first messages and counts for Claude chats, covers ChatGPT accounts with more
   than ~50 conversations in the window, and is the route without the desktop app.
3. `classify`: Claude judges each session (category, subcategory, ask/make/do, a safe
   one-line paraphrase, surprise flag); the script validates and merges.
4. `stats` + a short narrative → `profile.json`.
   Top skills and top custom sub-agents are counted too.
5. `render`: a self-contained HTML profile in the wrapped design (`editorial` and
   `terminal` templates are also included). Works offline.
6. `share preview` shows the exact rows; `share send` posts them only on an explicit yes.
7. `aggregate` builds the team report (`boardroom` or `exhibit` design) from the sheet.

See `plugins/how-i-ai/skills/how-i-ai/references/` for the data schema, sources, the
classification rules, and the sharing contract.

## Sources

| Source | Entry point | How |
|---|---|---|
| Claude Code (CLI, IDE, Desktop Code tab, teleported cloud sessions) | claude | `~/.claude/projects` transcripts |
| Cowork | claude | Claude Desktop's local session store |
| Claude Code cloud sessions | claude | `cloud-sessions.json` in `~/how-i-ai/inbox`, listed by Claude inside a claude.ai/code session: titles and a status summary |
| claude.ai chats | claude | `claude-chat-threads.json` in `~/how-i-ai/inbox`, listed by Claude in Chat mode (titles and summaries); optionally the official data export zip there (fuller, wins when both exist) |
| Codex CLI and app, Codex cloud tasks | chatgpt | `~/.codex/sessions`, `codex cloud list --json` (the `codex` on PATH or the one inside the ChatGPT desktop app) |
| ChatGPT | chatgpt | listed by the agent inside the ChatGPT desktop app (chatgpt.com has no listing tool); optionally the official data export zip in `~/how-i-ai-chatgpt/inbox` |

macOS, Windows, and Linux paths are handled; the Windows ones are still unverified. No
cookies, no tokens, no scraping.

## Privacy

Everything stays in `~/how-i-ai` (`~/how-i-ai-chatgpt` for the ChatGPT entry point). The
only thing that can leave is the row set shown in `share preview`: id, function, title
(optional), and per-session category, paraphrase, timing, counts, model, and tool,
connector, skill and agent names. Never the prompts. Details: `references/sharing.md`.

## Develop

```bash
bash plugins/how-i-ai/skills/how-i-ai/tests/run.sh      # end-to-end on synthetic macOS and Windows homes
node plugins/how-i-ai/skills/how-i-ai/scripts/sample-data.mjs profile    # sample profile.json
```

Templates take `profile.json` or `aggregate.json` through `scripts/render.mjs`; the
contract is in `templates/README.md`.

## Verifying on a real machine

The parsers are verified on macOS. The Windows paths are guesses at the same layout; to
check and fix them, hand an agent `HANDOFF-verify-on-windows.md` on a Windows machine.

## License

MIT
