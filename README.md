# how-i-ai

People describe how they use AI. This shows it, from the data.

`how-i-ai` is a Claude skill that reads your own session history on this machine (Claude
Code, Claude Desktop Chat and Cowork, Codex, plus the claude.ai and ChatGPT data
exports), takes the first message of each session and a little context, classifies
what every session was for and whether AI informed you or did the work, and renders a
profile of your last 30 days. Then, only if you say yes after seeing the exact rows, it
shares an anonymized version to a team sheet so a team can learn from each other.

- **Landing page with one-click "run with Claude" buttons:** `docs/index.html`
  (enable GitHub Pages on `main` → `/docs` to host it)
- **Skill:** `plugins/how-i-ai/skills/how-i-ai/SKILL.md`
- **Standalone prompt, no plugin install:** `PROMPT.md`; chat-only surfaces (ChatGPT,
  claude.ai chat): `PROMPT-chat.md`
- **Team sheet backend:** `apps-script/`

## Install

```bash
claude plugin marketplace add mkhalife/how-i-ai
claude plugin install how-i-ai@how-i-ai
```

Then, in Claude Code: "show me how I use AI", or `/how-i-ai:how-i-ai`. Node 18+ is the only
requirement (Claude Code already needs it).

Without the plugin, paste `PROMPT.md` into Claude Code or Cowork. Or use the buttons on
the landing page, which open the app with the prompt pre-filled:

| Button | Link it opens | Reads |
|---|---|---|
| Claude Code | `claude-cli://open?q=…` | everything on the machine |
| Cowork | `claude://cowork/new?q=…` | everything on the machine |
| Claude chat | `claude://claude.ai/new?q=…` | an uploaded export zip |
| ChatGPT | `https://chatgpt.com/?q=…` | an uploaded export zip |

## What it does

1. Asks your title and function (Design, Product, Engineering, …).
2. `collect`: inventories sessions from every source it can find, last 30 days, into
   `~/how-i-ai/sessions.json`. Chat products need their official export zip dropped in
   `~/how-i-ai/inbox`; the skill tells you how to request it.
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

| Source | How |
|---|---|
| Claude Code (CLI, IDE, Desktop Code tab, teleported cloud sessions) | `~/.claude/projects` transcripts |
| Claude Desktop Chat and Cowork | the desktop app's local session store |
| Claude Code cloud sessions | listed from inside a claude.ai/code session, titles only |
| Codex CLI and app, Codex cloud tasks | `~/.codex/sessions`, `codex cloud list --json` |
| claude.ai chats | official data export zip |
| ChatGPT | official data export zip |

macOS, Windows, and Linux paths are handled. No cookies, no tokens, no scraping.

## Privacy

Everything stays in `~/how-i-ai`. The only thing that can leave is the row set shown in
`share preview`: id, function, title (optional), and per-session category, paraphrase,
timing, counts, tool, skill and agent names. Never the prompts. Details: `references/sharing.md`.

## Develop

```bash
bash plugins/how-i-ai/skills/how-i-ai/tests/run.sh      # end-to-end on synthetic macOS and Windows homes
node plugins/how-i-ai/skills/how-i-ai/scripts/sample-data.mjs profile    # sample profile.json
```

Templates take `profile.json` or `aggregate.json` through `scripts/render.mjs`; the
contract is in `templates/README.md`.

## License

MIT
