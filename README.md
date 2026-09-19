# how-i-ai

People describe how they use AI. This shows it, from the data.

`how-i-ai` is a Claude skill that reads your own session history on this machine (Claude
Code, Claude Desktop Chat and Cowork, plus the claude.ai data export), takes the first
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
  chat-only surfaces (chatgpt.com, claude.ai chat): `PROMPT-chat.md`
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
the landing page, which open the app with the prompt pre-filled (the ChatGPT desktop app
card copies the prompt instead):

| Button | Link it opens | Reads |
|---|---|---|
| Claude Code | `claude-cli://open?q=…` | Claude Code, Cowork, and your claude.ai export |
| Cowork | `claude://cowork/new?q=…` | Claude Code, Cowork, and your claude.ai export |
| Claude chat | `claude://claude.ai/new?q=…` | an uploaded export zip |
| ChatGPT desktop app | copy and paste | ChatGPT conversations and Codex sessions |
| ChatGPT on the web | `https://chatgpt.com/?q=…` | an uploaded export zip |

## What it does

1. Asks your title and function (Design, Product, Engineering, …).
2. `collect`: inventories sessions from every source its entry point owns, last 30
   days, into `~/how-i-ai/sessions.json` (`~/how-i-ai-chatgpt/sessions.json` with
   `--app chatgpt`). Chat products need their official export zip dropped in that
   folder's `inbox`; the skill tells you how to request it. Inside the ChatGPT desktop
   app the agent can also list ChatGPT conversations itself.
3. `classify`: Claude judges each session (category, subcategory, ask/make/do, a safe
   one-line paraphrase, surprise flag); the script validates and merges.
4. `stats` + a short narrative → `profile.json`.
   Top skills and top custom sub-agents (from Claude Code transcripts) are counted too.
5. `render`: one of three self-contained HTML profiles (`wrapped`, `editorial`,
   `terminal`). Works offline.
6. `share preview` shows the exact rows; `share send` posts them only on an explicit yes.
7. `aggregate` builds the team report (`boardroom` or `exhibit` design) from the sheet.

See `plugins/how-i-ai/skills/how-i-ai/references/` for the data schema, sources, the
classification rules, and the sharing contract.

## Sources

| Source | Entry point | How |
|---|---|---|
| Claude Code (CLI, IDE, Desktop Code tab, teleported cloud sessions) | claude | `~/.claude/projects` transcripts |
| Claude Desktop Chat and Cowork | claude | the desktop app's local session store |
| Claude Code cloud sessions | claude | listed from inside a claude.ai/code session, titles only |
| claude.ai chats | claude | official data export zip in `~/how-i-ai/inbox` |
| Codex CLI and app, Codex cloud tasks | chatgpt | `~/.codex/sessions`, `codex cloud list --json` (the `codex` on PATH or the one inside the ChatGPT desktop app) |
| ChatGPT | chatgpt | listed by the agent inside the ChatGPT desktop app, or the official data export zip in `~/how-i-ai-chatgpt/inbox` |

macOS, Windows, and Linux paths are handled. No cookies, no tokens, no scraping.

## Privacy

Everything stays in `~/how-i-ai` (`~/how-i-ai-chatgpt` for the ChatGPT entry point). The
only thing that can leave is the row set shown in
`share preview`: id, function, title (optional), and per-session category, paraphrase,
timing, counts, tool, skill and agent names. Never the prompts. Details: `references/sharing.md`.

## Develop

```bash
bash plugins/how-i-ai/skills/how-i-ai/tests/run.sh      # end-to-end on synthetic macOS and Windows homes
node plugins/how-i-ai/skills/how-i-ai/scripts/sample-data.mjs profile    # sample profile.json
```

Templates take `profile.json` or `aggregate.json` through `scripts/render.mjs`; the
contract is in `templates/README.md`.

## Verifying on a real machine

The Claude Desktop and ChatGPT parsers were written without those apps present. To
check and fix them on a machine that has them, hand an agent `HANDOFF-verify-on-machine.md`.

## License

MIT
