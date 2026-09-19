---
name: howiai
description: Show how a person actually uses AI, from their own session history. Reads Claude Code, Claude Desktop (Chat and Cowork), Codex, and the claude.ai and ChatGPT data exports on this machine for the last 30 days, grabs the first message of each session plus a little context, classifies every session (what for, and whether AI informed them or did the work), and renders a personal profile page in one of three designs. Optionally shares anonymized rows to a team sheet after showing exactly what would leave the machine. Use whenever someone asks "how do I use AI", wants an AI usage profile, "AI wrapped", "howiai", a breakdown of their Claude or ChatGPT sessions, sessions per week, their biggest or most surprising AI use case, or wants to contribute to the team's AI usage aggregate.
---

# howiai

People describe how they use AI. This shows it, from the data. Everything runs locally
with plain Node scripts; the only judgment calls (what a session was for, a safe
one-line paraphrase) are yours. Nothing leaves the machine unless the person says yes to
a preview of the exact rows.

`SKILL_DIR` below means the folder this file is in. Working files go in `~/howiai`
(override with `HOWIAI_DIR`). Every command is `node SKILL_DIR/scripts/howiai.mjs <cmd>`
and works the same on macOS, Windows, and Linux.

## 0. Setup

1. `node --version` must be 18 or newer. Missing: macOS `brew install node`, Windows
   `winget install OpenJS.NodeJS.LTS`, or nodejs.org. Claude Code machines always have it.
2. `node SKILL_DIR/scripts/howiai.mjs` prints the command list. Run that once to confirm
   the scripts load.
3. Tell the person, in two sentences, what is about to happen: their AI session history
   on this machine will be inventoried into `~/howiai`, you will classify each session,
   and they get a profile page. Sharing is a separate yes/no later.

## 1. Who is this

Ask one question: their job title, and which function they belong to from this list:
Design, Product, Engineering, Data, Research, Marketing, Sales, Operations, Leadership,
Other. Then:

```
node SKILL_DIR/scripts/howiai.mjs config --title "Senior Product Designer" --function Design
```

This also mints a random `participant_id` kept in `~/howiai/config.json`. Nothing about
the person's name or email is stored.

## 2. Collect

```
node SKILL_DIR/scripts/howiai.mjs collect --days 30
```

Read the source table it prints. It looks for, in order: Claude Code transcripts,
Claude Desktop Chat and Cowork sessions, Codex sessions (and cloud tasks if the
`codex` CLI is signed in), a cloud session list (see below), and any export zips in
`~/howiai/inbox`. Details and paths per source: `references/sources.md`.

Then handle what is missing:

- **claude.ai chats and ChatGPT chats are not on disk.** Both need the official export:
  claude.ai Settings → Privacy → Export data; ChatGPT Settings → Data controls → Export
  data. Each emails a zip, usually within the hour, sometimes longer. Ask the person to
  request both now, drop the zips into `~/howiai/inbox` when they arrive, and tell you.
  Do not wait: continue with what is on the machine and re-run collect when the zips
  land (re-running is safe, everything dedupes by session id).
- **Claude Code cloud sessions** (claude.ai/code) are not on disk either. If this
  conversation is itself running in a cloud session and the `list_sessions` tool from
  the Claude Code Remote server is available, page through it (`limit` 100, follow
  `last_id`), collect the raw results into one JSON file at `~/howiai/cloud-sessions.json`
  (the array of session objects, or the `{"ccr":{"data":[...]}}` wrapper as returned),
  and re-run collect. Only titles and timestamps are available for those, and that is
  fine. If the tool is not available, say so once and move on.
- **A source shows found but 0 sessions**: run
  `node SKILL_DIR/scripts/howiai.mjs inspect "<one file from that folder>"` to see its
  key structure (no values are printed), then adapt the matching parser in
  `scripts/lib/sources.mjs`. Keep the change small and tell the person you did it.
- **Everything says no**: the person may use AI only on another machine. Say so, and
  offer the export route, which works from anywhere.

`~/howiai/sessions.json` now holds the private inventory: one record per session with
the first message (trimmed to 2,000 chars), a little context (the second message and
tools used), counts, timings, tools and connectors, model, mode (chat, agentic, routine),
and a hash of the project path. Never share or upload this file.

## 3. Classify

```
node SKILL_DIR/scripts/howiai.mjs classify prep --size 40
```

This writes `~/howiai/classify/batch-NNN.json`. For each batch: read it, judge every
item using `references/classification-guidelines.md`, and write
`~/howiai/classify/batch-NNN.out.json` as:

```json
{ "items": [ { "id": "s_claude-code_…", "category": "Build & ship code", "subcategory": "Add a feature",
               "assist_type": "do", "paraphrase": "Add a feature flag to a checkout flow and write tests",
               "surprise": false, "confidence": 0.9 } ] }
```

Then:

```
node SKILL_DIR/scripts/howiai.mjs classify merge
```

It validates every answer (assist_type must be ask, make, or do; paraphrases with emails,
URLs, phone numbers, or secrets are rejected), writes them into `sessions.json`, and
exits non-zero listing what is still unclassified. Loop prep → judge → merge until it
exits clean. Do not paraphrase from memory across batches; read each batch file.

Batches are the cost lever. 40 items × ~1,200 chars is a comfortable read; use
`--size 20` on a small context.

## 4. Numbers, then words

```
node SKILL_DIR/scripts/howiai.mjs stats
```

Read `~/howiai/profile.json`. Then write `~/howiai/narrative.json` following
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

Three designs live in `SKILL_DIR/templates`. Ask which one they want, or render all
three; they are cheap:

```
node SKILL_DIR/scripts/howiai.mjs render --template SKILL_DIR/templates/profile-wrapped.html   --data ~/howiai/profile.json --out ~/howiai/howiai-wrapped.html
node SKILL_DIR/scripts/howiai.mjs render --template SKILL_DIR/templates/profile-editorial.html --data ~/howiai/profile.json --out ~/howiai/howiai-editorial.html
node SKILL_DIR/scripts/howiai.mjs render --template SKILL_DIR/templates/profile-terminal.html  --data ~/howiai/profile.json --out ~/howiai/howiai-terminal.html
```

- `wrapped`: year-in-review story cards with a final share card
- `editorial`: annual-report typography, prints well
- `terminal`: dark monospace dashboard

Open the result (`open <file>` on macOS, `start "" <file>` on Windows, `xdg-open` on
Linux). Pages are self-contained and work offline. If you can publish an Artifact, offer
that too; it is the same HTML.

## 6. Share, only with a yes

Sharing is optional and off by default. The person needs to see two things before
deciding:

1. **How the aggregate uses it.** Render the team report from sample data and open it:
   ```
   node SKILL_DIR/scripts/howiai.mjs sample aggregate ~/howiai/sample-aggregate.json
   node SKILL_DIR/scripts/howiai.mjs render --template SKILL_DIR/templates/aggregate-boardroom.html --data ~/howiai/sample-aggregate.json --out ~/howiai/example-aggregate.html
   ```
   Say in one line what it answers: biggest use case, surprise use case, sessions per
   week and their distribution, ask/make/do by function. (The same page is hosted at
   the project's landing page under `examples/`.)
2. **Exactly what leaves the machine.**
   ```
   node SKILL_DIR/scripts/howiai.mjs share preview
   ```
   opens the column-by-column preview in `~/howiai/share-preview.html`. Read
   `references/sharing.md` for what is and is not included, and say it plainly: category,
   paraphrase, timing, counts, tools, function and title. No prompts, no titles, no paths.
   The title is optional; offer to blank it (`config --title ""`) if they would rather
   share only the function.

Ask: "Share these rows with the team sheet?" Only on an explicit yes in this conversation:

```
node SKILL_DIR/scripts/howiai.mjs share send
```

The endpoint comes from `SKILL_DIR/team.json` (`share_url`). If it is empty the command
refuses; the team owner sets it up per `apps-script/README.md`. Re-running replaces that
participant's earlier rows, so re-sharing after new exports arrive is fine. To withdraw,
the person sends their `participant_id` (in `~/howiai/config.json`) to the sheet owner.

## 7. The team report (whoever owns the sheet)

```
node SKILL_DIR/scripts/howiai.mjs aggregate --url "<share_url>"     # or --json dump.json, --csv sessions.csv --participants participants.csv, --csv-dir folder
```

Read `~/howiai/aggregate.json`, write `~/howiai/aggregate-narrative.json` (`headline`,
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
