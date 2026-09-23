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
- **One-prompt version, no scripts:** `PROMPT-wrapped.md` is the prompt to hand a teammate:
  it pulls the last 30 days from whatever the current tool can see, classifies them, and
  builds the wrapped slide deck, fetching only the schema and rules in
  `plugins/how-i-ai/skills/ai-wrapped/SKILL.md` and the deck template. No install, no sharing step
- **Standalone prompt, no plugin install:** `PROMPT.md` (Claude Code); inside the
  ChatGPT desktop app (ChatGPT conversations and Codex sessions): `PROMPT-chatgpt-app.md`;
  export-based fallback for chat-only surfaces (chatgpt.com, claude.ai chat):
  `PROMPT-chat.md`
- **Claude chats and cloud sessions:** `PROMPT-claude-chat.md` (claude.ai Chat lists your
  chats into `claude-chat-threads.json`) and `PROMPT-claude-cloud.md` (a claude.ai/code
  session lists your cloud sessions into `cloud-sessions.json`). The Claude run opens both
  with `gather`; you press send and click each download, and it moves the files from
  Downloads into `~/how-i-ai/inbox`
- **Team sheet backend:** `apps-script/`

## Try AI wrapped now

The quick version: one prompt, nothing to install, no sharing step. Each link opens the
app with the prompt already typed; read it and press Enter. The prompt carries the whole
job; it fetches only the skill file and the deck template from this repository. GitHub
only makes the `https` link clickable here; for the others, copy the whole line into your
browser's address bar, or use the AI wrapped page, where all of them are buttons:
**https://mkhalife.github.io/how-i-ai/wrapped/**

**Claude Code on the web** (reads your cloud sessions): [click to open it with the prompt typed in](https://claude.ai/code?q=Show%20me%20how%20I%20actually%20used%20AI%20in%20the%20last%2030%20days%2C%20as%20a%20wrapped-style%20slide%20deck.%20Work%20here%2C%20from%20my%20own%20sessions.%20Nothing%20leaves%20this%20machine%2C%20and%20the%20deck%20holds%20paraphrases%2C%20never%20my%20prompts.%0A%0A1.%20Pull%20my%20sessions%20from%20the%20last%2030%20days%20from%20whatever%20you%20can%20reach%20where%20you%20run%3A%20Claude%20Code%20transcripts%20in%20~%2F.claude%2Fprojects%2C%20Cowork%20sessions%20in%20Claude%20Desktop%27s%20local-agent-mode-sessions%20folder%2C%20list_sessions%20if%20you%20are%20a%20claude.ai%2Fcode%20session%2C%20recent_chats%20if%20you%20are%20Claude%20in%20chat%2C%20Codex%20sessions%20in%20~%2F.codex%2C%20or%20the%20ChatGPT%20app%27s%20thread%20tools.%20Per%20session%20keep%20the%20first%20message%2C%20a%20little%20context%2C%20message%20counts%2C%20timings%2C%20tools%2C%20skills%2C%20agents%20and%20model.%20Skip%20sources%20you%20cannot%20reach%3B%20do%20not%20ask.%0A%0A2.%20Classify%20every%20session%3A%20category%20%28the%20job%2C%20Title%20Case%2C%20reuse%20names%3B%20start%20from%20Build%20%26%20ship%20code%2C%20Debug%20%26%20fix%2C%20Review%20%26%20explain%20code%2C%20Automate%20%26%20ops%2C%20Write%20%26%20edit%2C%20Communicate%20%26%20coordinate%2C%20Research%20%26%20synthesis%2C%20Analyze%20data%2C%20Plan%20%26%20prioritize%2C%20Design%20critique%20%26%20feedback%2C%20Prototype%20%26%20build%2C%20Explain%20%26%20learn%2C%20Brainstorm%20%26%20ideate%2C%20Personal%20%26%20life%20admin%2C%20Career%20%26%20growth%29%2C%20assist%20type%20%28ask%3A%20I%20wanted%20information%20or%20a%20critique%3B%20make%3A%20I%20wanted%20an%20artifact%3B%20do%3A%20you%20took%20actions%29%2C%20a%20one-line%20paraphrase%20with%20no%20names%2C%20identifying%20numbers%2C%20secrets%20or%20quotes%2C%20a%20surprise%20flag%2C%20and%20a%20confidence.%0A%0A3.%20Compute%20the%20numbers%20and%20write%20profile.json%20in%20the%20exact%20schema%20in%20section%204b%20of%20https%3A%2F%2Fraw.githubusercontent.com%2Fmkhalife%2Fhow-i-ai%2Fmain%2Fplugins%2Fhow-i-ai%2Fskills%2Fai-wrapped%2FSKILL.md%20%28sections%202%20and%203%20there%20carry%20the%20full%20classification%20and%20stats%20rules%3B%20read%20them%29.%0A%0A4.%20Download%20https%3A%2F%2Fraw.githubusercontent.com%2Fmkhalife%2Fhow-i-ai%2Fmain%2Fplugins%2Fhow-i-ai%2Fskills%2Fhow-i-ai%2Ftemplates%2Fprofile-wrapped.html%2C%20inject%20the%20JSON%20at%20its%20__HOW_I_AI_DATA__%20placeholder%20the%20way%20section%204c%20of%20that%20skill%20file%20shows%2C%20save%20the%20result%20as%20ai-wrapped.html%2C%20and%20open%20it.)

**Claude Code in Claude Desktop** (Code tab; reads Claude Code and Cowork sessions):

```
claude://code/new?q=Show%20me%20how%20I%20actually%20used%20AI%20in%20the%20last%2030%20days%2C%20as%20a%20wrapped-style%20slide%20deck.%20Work%20here%2C%20from%20my%20own%20sessions.%20Nothing%20leaves%20this%20machine%2C%20and%20the%20deck%20holds%20paraphrases%2C%20never%20my%20prompts.%0A%0A1.%20Pull%20my%20sessions%20from%20the%20last%2030%20days%20from%20whatever%20you%20can%20reach%20where%20you%20run%3A%20Claude%20Code%20transcripts%20in%20~%2F.claude%2Fprojects%2C%20Cowork%20sessions%20in%20Claude%20Desktop%27s%20local-agent-mode-sessions%20folder%2C%20list_sessions%20if%20you%20are%20a%20claude.ai%2Fcode%20session%2C%20recent_chats%20if%20you%20are%20Claude%20in%20chat%2C%20Codex%20sessions%20in%20~%2F.codex%2C%20or%20the%20ChatGPT%20app%27s%20thread%20tools.%20Per%20session%20keep%20the%20first%20message%2C%20a%20little%20context%2C%20message%20counts%2C%20timings%2C%20tools%2C%20skills%2C%20agents%20and%20model.%20Skip%20sources%20you%20cannot%20reach%3B%20do%20not%20ask.%0A%0A2.%20Classify%20every%20session%3A%20category%20%28the%20job%2C%20Title%20Case%2C%20reuse%20names%3B%20start%20from%20Build%20%26%20ship%20code%2C%20Debug%20%26%20fix%2C%20Review%20%26%20explain%20code%2C%20Automate%20%26%20ops%2C%20Write%20%26%20edit%2C%20Communicate%20%26%20coordinate%2C%20Research%20%26%20synthesis%2C%20Analyze%20data%2C%20Plan%20%26%20prioritize%2C%20Design%20critique%20%26%20feedback%2C%20Prototype%20%26%20build%2C%20Explain%20%26%20learn%2C%20Brainstorm%20%26%20ideate%2C%20Personal%20%26%20life%20admin%2C%20Career%20%26%20growth%29%2C%20assist%20type%20%28ask%3A%20I%20wanted%20information%20or%20a%20critique%3B%20make%3A%20I%20wanted%20an%20artifact%3B%20do%3A%20you%20took%20actions%29%2C%20a%20one-line%20paraphrase%20with%20no%20names%2C%20identifying%20numbers%2C%20secrets%20or%20quotes%2C%20a%20surprise%20flag%2C%20and%20a%20confidence.%0A%0A3.%20Compute%20the%20numbers%20and%20write%20profile.json%20in%20the%20exact%20schema%20in%20section%204b%20of%20https%3A%2F%2Fraw.githubusercontent.com%2Fmkhalife%2Fhow-i-ai%2Fmain%2Fplugins%2Fhow-i-ai%2Fskills%2Fai-wrapped%2FSKILL.md%20%28sections%202%20and%203%20there%20carry%20the%20full%20classification%20and%20stats%20rules%3B%20read%20them%29.%0A%0A4.%20Download%20https%3A%2F%2Fraw.githubusercontent.com%2Fmkhalife%2Fhow-i-ai%2Fmain%2Fplugins%2Fhow-i-ai%2Fskills%2Fhow-i-ai%2Ftemplates%2Fprofile-wrapped.html%2C%20inject%20the%20JSON%20at%20its%20__HOW_I_AI_DATA__%20placeholder%20the%20way%20section%204c%20of%20that%20skill%20file%20shows%2C%20save%20the%20result%20as%20ai-wrapped.html%2C%20and%20open%20it.
```

**Claude Code in a terminal** (same sessions):

```
claude-cli://open?q=Show%20me%20how%20I%20actually%20used%20AI%20in%20the%20last%2030%20days%2C%20as%20a%20wrapped-style%20slide%20deck.%20Work%20here%2C%20from%20my%20own%20sessions.%20Nothing%20leaves%20this%20machine%2C%20and%20the%20deck%20holds%20paraphrases%2C%20never%20my%20prompts.%0A%0A1.%20Pull%20my%20sessions%20from%20the%20last%2030%20days%20from%20whatever%20you%20can%20reach%20where%20you%20run%3A%20Claude%20Code%20transcripts%20in%20~%2F.claude%2Fprojects%2C%20Cowork%20sessions%20in%20Claude%20Desktop%27s%20local-agent-mode-sessions%20folder%2C%20list_sessions%20if%20you%20are%20a%20claude.ai%2Fcode%20session%2C%20recent_chats%20if%20you%20are%20Claude%20in%20chat%2C%20Codex%20sessions%20in%20~%2F.codex%2C%20or%20the%20ChatGPT%20app%27s%20thread%20tools.%20Per%20session%20keep%20the%20first%20message%2C%20a%20little%20context%2C%20message%20counts%2C%20timings%2C%20tools%2C%20skills%2C%20agents%20and%20model.%20Skip%20sources%20you%20cannot%20reach%3B%20do%20not%20ask.%0A%0A2.%20Classify%20every%20session%3A%20category%20%28the%20job%2C%20Title%20Case%2C%20reuse%20names%3B%20start%20from%20Build%20%26%20ship%20code%2C%20Debug%20%26%20fix%2C%20Review%20%26%20explain%20code%2C%20Automate%20%26%20ops%2C%20Write%20%26%20edit%2C%20Communicate%20%26%20coordinate%2C%20Research%20%26%20synthesis%2C%20Analyze%20data%2C%20Plan%20%26%20prioritize%2C%20Design%20critique%20%26%20feedback%2C%20Prototype%20%26%20build%2C%20Explain%20%26%20learn%2C%20Brainstorm%20%26%20ideate%2C%20Personal%20%26%20life%20admin%2C%20Career%20%26%20growth%29%2C%20assist%20type%20%28ask%3A%20I%20wanted%20information%20or%20a%20critique%3B%20make%3A%20I%20wanted%20an%20artifact%3B%20do%3A%20you%20took%20actions%29%2C%20a%20one-line%20paraphrase%20with%20no%20names%2C%20identifying%20numbers%2C%20secrets%20or%20quotes%2C%20a%20surprise%20flag%2C%20and%20a%20confidence.%0A%0A3.%20Compute%20the%20numbers%20and%20write%20profile.json%20in%20the%20exact%20schema%20in%20section%204b%20of%20https%3A%2F%2Fraw.githubusercontent.com%2Fmkhalife%2Fhow-i-ai%2Fmain%2Fplugins%2Fhow-i-ai%2Fskills%2Fai-wrapped%2FSKILL.md%20%28sections%202%20and%203%20there%20carry%20the%20full%20classification%20and%20stats%20rules%3B%20read%20them%29.%0A%0A4.%20Download%20https%3A%2F%2Fraw.githubusercontent.com%2Fmkhalife%2Fhow-i-ai%2Fmain%2Fplugins%2Fhow-i-ai%2Fskills%2Fhow-i-ai%2Ftemplates%2Fprofile-wrapped.html%2C%20inject%20the%20JSON%20at%20its%20__HOW_I_AI_DATA__%20placeholder%20the%20way%20section%204c%20of%20that%20skill%20file%20shows%2C%20save%20the%20result%20as%20ai-wrapped.html%2C%20and%20open%20it.
```

**Claude chat** (reads your claude.ai chats via `recent_chats`):

```
claude://claude.ai/new?q=Show%20me%20how%20I%20actually%20used%20AI%20in%20the%20last%2030%20days%2C%20as%20a%20wrapped-style%20slide%20deck.%20Work%20here%2C%20from%20my%20own%20sessions.%20Nothing%20leaves%20this%20machine%2C%20and%20the%20deck%20holds%20paraphrases%2C%20never%20my%20prompts.%0A%0A1.%20Pull%20my%20sessions%20from%20the%20last%2030%20days%20from%20whatever%20you%20can%20reach%20where%20you%20run%3A%20Claude%20Code%20transcripts%20in%20~%2F.claude%2Fprojects%2C%20Cowork%20sessions%20in%20Claude%20Desktop%27s%20local-agent-mode-sessions%20folder%2C%20list_sessions%20if%20you%20are%20a%20claude.ai%2Fcode%20session%2C%20recent_chats%20if%20you%20are%20Claude%20in%20chat%2C%20Codex%20sessions%20in%20~%2F.codex%2C%20or%20the%20ChatGPT%20app%27s%20thread%20tools.%20Per%20session%20keep%20the%20first%20message%2C%20a%20little%20context%2C%20message%20counts%2C%20timings%2C%20tools%2C%20skills%2C%20agents%20and%20model.%20Skip%20sources%20you%20cannot%20reach%3B%20do%20not%20ask.%0A%0A2.%20Classify%20every%20session%3A%20category%20%28the%20job%2C%20Title%20Case%2C%20reuse%20names%3B%20start%20from%20Build%20%26%20ship%20code%2C%20Debug%20%26%20fix%2C%20Review%20%26%20explain%20code%2C%20Automate%20%26%20ops%2C%20Write%20%26%20edit%2C%20Communicate%20%26%20coordinate%2C%20Research%20%26%20synthesis%2C%20Analyze%20data%2C%20Plan%20%26%20prioritize%2C%20Design%20critique%20%26%20feedback%2C%20Prototype%20%26%20build%2C%20Explain%20%26%20learn%2C%20Brainstorm%20%26%20ideate%2C%20Personal%20%26%20life%20admin%2C%20Career%20%26%20growth%29%2C%20assist%20type%20%28ask%3A%20I%20wanted%20information%20or%20a%20critique%3B%20make%3A%20I%20wanted%20an%20artifact%3B%20do%3A%20you%20took%20actions%29%2C%20a%20one-line%20paraphrase%20with%20no%20names%2C%20identifying%20numbers%2C%20secrets%20or%20quotes%2C%20a%20surprise%20flag%2C%20and%20a%20confidence.%0A%0A3.%20Compute%20the%20numbers%20and%20write%20profile.json%20in%20the%20exact%20schema%20in%20section%204b%20of%20https%3A%2F%2Fraw.githubusercontent.com%2Fmkhalife%2Fhow-i-ai%2Fmain%2Fplugins%2Fhow-i-ai%2Fskills%2Fai-wrapped%2FSKILL.md%20%28sections%202%20and%203%20there%20carry%20the%20full%20classification%20and%20stats%20rules%3B%20read%20them%29.%0A%0A4.%20Download%20https%3A%2F%2Fraw.githubusercontent.com%2Fmkhalife%2Fhow-i-ai%2Fmain%2Fplugins%2Fhow-i-ai%2Fskills%2Fhow-i-ai%2Ftemplates%2Fprofile-wrapped.html%2C%20inject%20the%20JSON%20at%20its%20__HOW_I_AI_DATA__%20placeholder%20the%20way%20section%204c%20of%20that%20skill%20file%20shows%2C%20save%20the%20result%20as%20ai-wrapped.html%2C%20and%20open%20it.
```

The prompt itself is in `PROMPT-wrapped.md` if you would rather paste text.

## Install

```bash
claude plugin marketplace add mkhalife/how-i-ai
claude plugin install how-i-ai@how-i-ai
```

Then, in Claude Code: "show me how I use AI", or `/how-i-ai:how-i-ai`. Node 18+ is the only
requirement (Claude Code already needs it).

Without the plugin, paste `PROMPT.md` into Claude Code (a terminal or Claude Desktop's Code tab), or
`PROMPT-chatgpt-app.md` into a new task in the ChatGPT desktop app. Or use the buttons on
the landing page, which open the app with the prompt pre-filled:

| Card | Link it opens | Reads |
|---|---|---|
| Claude chats (the run opens this for you) | `claude://claude.ai/new?q=…` (whole prompt inline) | lists your chats into `claude-chat-threads.json` for the inbox |
| Claude Code on the web (the run opens this for you) | `https://claude.ai/code?q=…` (whole prompt inline) | lists your cloud sessions into `cloud-sessions.json` for the inbox |
| AI wrapped | `claude://code/new?q=…`, `claude-cli://open?q=…`, `https://claude.ai/code?q=…`, `claude://claude.ai/new?q=…`, `codex://threads/new?prompt=…` | the one-prompt run (`PROMPT-wrapped.md`, whole prompt inline): builds the wrapped deck from whatever the surface can see, fetching only the skill file and the template |
| Claude Code | `claude-cli://open?q=…` | Claude Code, Cowork, the two inbox files `gather` collects, and a claude.ai export if present |
| Chat only, from an export | `claude://claude.ai/new?q=…` | an uploaded export zip (fallback without Claude Code) |
| ChatGPT desktop app | `codex://threads/new?prompt=…` | ChatGPT conversations and Codex sessions |
| ChatGPT on the web | `https://chatgpt.com/?q=…` | an uploaded export zip (fallback without the ChatGPT desktop app; chatgpt.com cannot list conversations) |

## What it does

1. Asks your title and function (Design, Product, Engineering, …).
2. `collect`: inventories sessions from every source its entry point owns, last 30 days,
   into `~/how-i-ai/sessions.json` (`~/how-i-ai-chatgpt/sessions.json` with `--app
   chatgpt`). Chat history comes from a listing file in that folder's `inbox`: Claude in
   Chat mode lists Claude chats, and the agent inside the ChatGPT desktop app lists
   ChatGPT conversations. For the Claude run, `gather` opens Claude in Chat mode and a
   claude.ai/code session with their prompts filled in, waits for the two downloads, and
   moves them into the inbox; if nothing arrives the run continues without them. The
   official data export is an optional top-up: it adds real first messages and counts for
   Claude chats, covers ChatGPT accounts with more than ~50 conversations in the window,
   and is the route without the desktop app.
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
| Cowork | claude | Claude Desktop's local session store (sessions that ran locally; remote Cowork sessions are not on disk) |
| Claude Code cloud sessions | claude | `cloud-sessions.json` in `~/how-i-ai/inbox`, listed by Claude inside a claude.ai/code session: titles and a status summary |
| claude.ai chats | claude | `claude-chat-threads.json` in `~/how-i-ai/inbox`, listed by Claude in Chat mode (titles and summaries); optionally the official data export zip there (fuller, wins when both exist) |
| Codex CLI and app, Codex cloud tasks | chatgpt | `~/.codex/sessions`, `codex cloud list --json` (the `codex` on PATH or the one inside the ChatGPT desktop app) |
| ChatGPT | chatgpt | listed by the agent inside the ChatGPT desktop app (chatgpt.com has no listing tool); optionally the official data export zip in `~/how-i-ai-chatgpt/inbox` |

macOS, Windows, and Linux paths are handled; the Windows ones are still unverified, and so
is how `gather` opens links on Windows. The run itself goes in Claude Code: Cowork works
in a separate VM that cannot see this machine's history, so `collect` stops there and says
so. The Claude Code run counts the Cowork sessions stored on disk; Cowork sessions that run
remotely keep their history server-side and are not counted. No cookies, no tokens, no scraping.

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
