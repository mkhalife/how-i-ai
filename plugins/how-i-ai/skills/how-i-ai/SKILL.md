---
name: how-i-ai
description: Show how a person actually uses AI, from their own session history of the last 30 days. Reads Claude Code and Cowork sessions on this machine, plus the Claude chat and cloud session lists and a claude.ai export when they are in the inbox (a separate ChatGPT entry point reads Codex and ChatGPT), grabs the first message of each session plus a little context, classifies every session (what for, and whether AI informed them or did the work), and renders a personal profile page. Optionally shares anonymized rows to a team sheet after showing exactly what would leave the machine. Use whenever someone asks "how do I use AI", wants an AI usage profile, "AI wrapped", "how-i-ai", a breakdown of their Claude or ChatGPT sessions, sessions per week, their biggest or most surprising AI use case, or wants to contribute to the team's AI usage aggregate.
---

# how-i-ai

People describe how they use AI. This shows it, from the data. Everything runs locally
with plain Node scripts; the only judgment calls (what a session was for, a safe
one-line paraphrase) are yours. Nothing leaves the machine unless the person says yes to
a preview of the exact rows.

`SKILL_DIR` below means the folder this file is in. Working files go in `~/how-i-ai`
(override with `HOW_I_AI_DIR`). Every command is `node SKILL_DIR/scripts/how-i-ai.mjs <cmd>`
and works the same on macOS, Windows, and Linux.

There are two independent entry points. The Claude one is the default and is what the
commands below show: it reads Claude sessions only. The ChatGPT one is run from inside
the ChatGPT desktop app (`PROMPT-chatgpt-app.md`): put `--app chatgpt` right after
`how-i-ai.mjs` in every command (`node SKILL_DIR/scripts/how-i-ai.mjs --app chatgpt <cmd>`)
and read `~/how-i-ai-chatgpt` wherever this file says `~/how-i-ai`. It reads Codex and
ChatGPT sources only. Each entry point keeps its own working folder and its own
`participant_id`, and both post to the same team sheet.

## 0. Setup

1. `node --version` must be 18 or newer. Missing: macOS `brew install node`, Windows
   `winget install OpenJS.NodeJS.LTS`, or nodejs.org. Claude Code machines always have it.
2. `node SKILL_DIR/scripts/how-i-ai.mjs` prints the command list. Run that once to confirm
   the scripts load.
3. Tell the person, in two sentences, what is about to happen: their AI session history
   on this machine will be inventoried into `~/how-i-ai`, you will classify each session,
   and they get a profile page. Sharing is a separate yes/no later.

## 1. Who is this

Ask one question: their job title, and which function they belong to from this list:
Design, Product, Engineering, Data, Research, Marketing, Sales, Operations, Leadership,
Other. Then:

```
node SKILL_DIR/scripts/how-i-ai.mjs config --title "Senior Product Designer" --function Design
```

This also mints a random `participant_id` kept in `~/how-i-ai/config.json`. Nothing about
the person's name or email is stored.

## 2. Collect

```
node SKILL_DIR/scripts/how-i-ai.mjs collect --days 30
```

Read the source table it prints. It looks for, in order: Claude Code transcripts,
Cowork sessions from Claude Desktop, and in `~/how-i-ai/inbox` a Claude Code cloud
session list (`cloud-sessions.json`), a claude.ai export zip, and a Claude chat list
(`claude-chat-threads.json`), see below. With `--app chatgpt` it looks instead
for Codex sessions (and cloud tasks if a signed-in `codex` binary is on PATH or inside
the ChatGPT desktop app), a ChatGPT export zip and `chatgpt-app-threads.json` in
`~/how-i-ai-chatgpt/inbox`, and whether the ChatGPT desktop app is installed. Details
and paths per source: `references/sources.md`.

Then handle what is missing:

- **Claude chats and Claude Code cloud sessions are not on disk, and the surfaces that
  hold them cannot run these scripts.** Each of those surfaces lists its own history and
  hands the person one JSON file to download; they save it into `~/how-i-ai/inbox` and
  collect picks it up. This is the normal route for both, and both are optional:
  - `claude-chat-threads.json`: the "Claude chats" card on the landing page (or
    `PROMPT-claude-chat.md` pasted into claude.ai Chat, web or desktop). Claude in Chat
    mode lists the last 30 days with its `recent_chats` tool. Per chat it holds the url,
    `updated_at`, the title, and a summary written by Claude; no first message, no
    counts, no model. These become `claude-chat` sessions.
  - `cloud-sessions.json`: the "Claude Code on the web" card (or `PROMPT-claude-cloud.md`
    pasted into a claude.ai/code session). Claude there lists cloud sessions with the
    Claude Code Remote `list_sessions` tool. Per session it holds the id, title, two
    timestamps, environment, origin, tags, model, and a short status summary; no message
    text. Remote Control mirrors of local sessions (`environment_kind` `bridge`) are in
    the list too and are skipped. If this conversation is itself a cloud session and you
    have `list_sessions`, follow `PROMPT-claude-cloud.md` and write the file into the
    inbox yourself.
  When the `claude-chat` row is empty or collect prints that `cloud-sessions.json` is
  missing, mention the two cards once and continue; do not block on them. Cowork and
  local Claude Code do not have either tool.
- **ChatGPT chats are not readable on disk** (`--app chatgpt`). ChatGPT's desktop app
  encrypts its cache with a Keychain key only OpenAI-signed apps can read, and the
  Windows app keeps only a volatile partial cache; the collector reports the app as a
  signal (installed, how many cached conversations, last used) and nothing more. Content
  comes from the agent inside the ChatGPT desktop app, which writes
  `chatgpt-app-threads.json` per `PROMPT-chatgpt-app.md`. chatgpt.com on the web has no
  tool that lists conversations, so there is no web route to that file.
- **The data exports are an optional top-up.** Do not ask for one by default. Offer it
  when the person wants real first messages and message counts for Claude chats (the
  chat listing has only Claude's summaries), when a ChatGPT user has more than ~50
  conversations in the window or conversations longer than ~50 turns (the in-app listing
  stops there), or when they have no surface that can list (no ChatGPT desktop app, or
  `recent_chats` is unavailable). claude.ai: Settings → Privacy → Export data, zip into
  `~/how-i-ai/inbox`. ChatGPT: Settings → Data controls → Export data, zip into
  `~/how-i-ai-chatgpt/inbox`. It is emailed, usually within the hour, sometimes longer.
  Do not wait: continue with what is on the machine and re-run collect when the zip
  lands (re-running is safe: everything dedupes by session id and judgments already
  merged are kept). An export wins over a listing file for the same conversation.
- **A source shows found but 0 sessions**: run
  `node SKILL_DIR/scripts/how-i-ai.mjs inspect "<one file from that folder>"` to see its
  key structure (no values are printed), then adapt the matching parser in
  `scripts/lib/sources.mjs`. Keep the change small and tell the person you did it.
- **Everything says no**: the person may use AI only on another machine. Say so, and
  offer the export route, which works from anywhere.

`~/how-i-ai/sessions.json` now holds the private inventory: one record per session with
the first message (trimmed to 2,000 chars), a little context (the second message and
tools used), counts, timings, tools and connectors, skills invoked and sub-agents spawned,
model, mode (chat, agentic, routine), and a hash of the project path. Never share or
upload this file.

## 3. Classify

```
node SKILL_DIR/scripts/how-i-ai.mjs classify prep --size 40
```

This writes `~/how-i-ai/classify/batch-NNN.json`. For each batch: read it, judge every
item using `references/classification-guidelines.md`, and write
`~/how-i-ai/classify/batch-NNN.out.json` as:

```json
{ "items": [ { "id": "s_claude-code_…", "category": "Build & ship code", "subcategory": "Add a feature",
               "assist_type": "do", "paraphrase": "Add a feature flag to a checkout flow and write tests",
               "surprise": false, "confidence": 0.9 } ] }
```

Then:

```
node SKILL_DIR/scripts/how-i-ai.mjs classify merge
```

It validates every answer (assist_type must be ask, make, or do; paraphrases with emails,
URLs, phone numbers, or secrets are rejected), writes them into `sessions.json`, and
exits non-zero listing what is still unclassified. Loop prep → judge → merge until it
exits clean. Do not paraphrase from memory across batches; read each batch file.

Batches are the cost lever. 40 items × ~1,200 chars is a comfortable read; use
`--size 20` on a small context.

## 4. Numbers, then words

```
node SKILL_DIR/scripts/how-i-ai.mjs stats
```

Read `~/how-i-ai/profile.json`. Then write `~/how-i-ai/narrative.json` following
`references/narrative-guidelines.md`:

```json
{ "headline": "A critic first, a builder second",
  "summary": "Two to four sentences grounded in the numbers.",
  "patterns": ["three to five short observations"],
  "one_liner": "The line for the share card",
  "signature_move": "The habit that shows up again and again",
  "surprise_why": "One sentence on why the surprise session stands out" }
```

Run `stats` again so the words land in `profile.json`.

## 5. Render the profile

```
node SKILL_DIR/scripts/how-i-ai.mjs render
```

writes `~/how-i-ai/how-i-ai.html`: the wrapped design, year-in-review story cards with a
final share card. Open it (`open <file>` on macOS, `start "" <file>` on Windows,
`xdg-open` on Linux). The page is self-contained and works offline. If you can publish
an Artifact, offer that too; it is the same HTML.

Two other designs sit in `SKILL_DIR/templates` (`profile-editorial.html`,
`profile-terminal.html`). Render one only if the person asks:
`render --template <file> --out ~/how-i-ai/how-i-ai-editorial.html`.

## 6. Share, only with a yes

Sharing is optional and off by default. The person needs to see two things before
deciding:

1. **How the aggregate uses it.** Render the team report from sample data and open it:
   ```
   node SKILL_DIR/scripts/how-i-ai.mjs sample aggregate ~/how-i-ai/sample-aggregate.json
   node SKILL_DIR/scripts/how-i-ai.mjs render --template SKILL_DIR/templates/aggregate-boardroom.html --data ~/how-i-ai/sample-aggregate.json --out ~/how-i-ai/example-aggregate.html
   ```
   Say in one line what it answers: biggest use case, surprise use case, sessions per
   week and their distribution, ask/make/do by function, top skills and custom agents.
   (The same page is hosted at
   the project's landing page under `examples/`.)
2. **Exactly what leaves the machine.**
   ```
   node SKILL_DIR/scripts/how-i-ai.mjs share preview
   ```
   opens the column-by-column preview in `~/how-i-ai/share-preview.html`. Read
   `references/sharing.md` for what is and is not included, and say it plainly: category,
   paraphrase, timing, counts, tools, function and title. No prompts, no titles, no paths.
   The title is optional; offer to blank it (`config --title ""`) if they would rather
   share only the function.

Ask: "Share these rows with the team sheet?" Only on an explicit yes in this conversation:

```
node SKILL_DIR/scripts/how-i-ai.mjs share send
```

The endpoint comes from `SKILL_DIR/team.json` (`share_url`). If it is empty the command
refuses; the team owner sets it up per `apps-script/README.md`. Re-running replaces that
participant's earlier rows, so re-sharing after new exports arrive is fine. To withdraw,
the person sends their `participant_id` (in `~/how-i-ai/config.json`) to the sheet owner.

## 7. The team report (whoever owns the sheet)

```
node SKILL_DIR/scripts/how-i-ai.mjs aggregate --url "<share_url>"     # or --json dump.json, --csv sessions.csv --participants participants.csv, --csv-dir folder
```

Read `~/how-i-ai/aggregate.json`, write `~/how-i-ai/aggregate-narrative.json` (`headline`,
`summary`, `patterns`, `one_liner`, optional `surprise_use_case`), re-run aggregate, then
render `templates/aggregate-boardroom.html` (leadership readout) or
`templates/aggregate-exhibit.html` (poster for the team meeting) the same way as step 5.

## Rules

- Never print or paste a person's raw prompts into anything that leaves the machine:
  not the sheet, not an Artifact, not a Slack message. Paraphrases only.
- Never send without the explicit yes in step 6. "Sounds good" to the plan in step 0 is
  not a yes to sharing.
- `sessions.json`, the classify folder, and the inbox stay local. Do not commit them,
  upload them, or attach them anywhere.
- If a parser needed adapting, say what changed. If a source could not be read, say
  which one and why in the final summary, next to the numbers that did work.
- If the person also uses the other product (ChatGPT and Codex from the Claude entry
  point, Claude from the ChatGPT one), tell them once, at the end, to run the other entry
  point from that tool: `PROMPT-chatgpt-app.md` inside the ChatGPT desktop app, `PROMPT.md`
  in Claude.
