# What sharing sends, and what it never sends

Sharing is a POST of one JSON document to the team's Apps Script endpoint (`share_url`
in `team.json`). `share preview` writes the same document to `~/how-i-ai/share-rows.json`
and a readable table to `~/how-i-ai/share-preview.html` so the person can check it before
saying yes. The code only ever serializes the columns below (`SESSION_COLUMNS` and
`PARTICIPANT_COLUMNS` in `scripts/share.mjs`); there is no other field.

## One participant row

| column | example | why |
|---|---|---|
| participant_id | `p_8d471afb` | random id minted locally; lets re-runs replace earlier rows and lets the person withdraw |
| function | `Design` | the aggregate's main split |
| title | `Senior Product Designer` | optional; blank it with `config --title ""` |
| window_days, window_start, window_end | `30`, `2026-08-20`, `2026-09-19` | so sessions/week is computed correctly |
| sessions_total | `96` | |
| sources | `claude-export;chatgpt-export;claude-cowork` | which tools they use at all |
| submitted_at, schema_version | | bookkeeping |

## One row per session

| column | example |
|---|---|
| participant_id, function | as above |
| source, surface | `claude-code`, `cli` |
| date, week_start, weekday, hour | `2026-09-04`, `2026-08-31`, `3`, `10` (local time, hour only) |
| mode, trigger | `agentic`, `human` |
| category, subcategory, assist_type | `Build & ship code`, `Add a feature`, `do` |
| paraphrase | `Add a feature flag to a checkout flow and write tests` |
| surprise | `false` |
| messages_user, messages_assistant, duration_minutes | `4`, `9`, `33.7` |
| tools, connectors, model | `Bash;Edit;Read`, `github`, `claude-opus-4-1` |
| skills, agents | `code-review;humanizer`, `general-purpose;evidence-researcher` (names only; see the note below) |
| submitted_at, schema_version | bookkeeping |

## Never shared

- the first message or any message text
- session titles (they often quote the prompt)
- file paths, folder names, repository or project names, branch names, the project hash
- machine name or its hash, OS user name, email, IP
- the export zips, `sessions.json`, or the classify batches

The paraphrase is written to contain no names, companies, customers, secrets, or
identifying numbers (`classification-guidelines.md`), and `classify merge` rejects
paraphrases with emails, URLs, phone numbers, or key-shaped strings. It is still worth a
skim in the preview: it is the one free-text column.

## Re-runs and withdrawal

- Sending again with the same `participant_id` deletes that participant's earlier rows
  in both sheets before appending, so the sheet always holds one snapshot per person.
- To withdraw, send the `participant_id` from `~/how-i-ai/config.json` to whoever owns the
  sheet; they delete the rows. Nothing in the sheet links the id to a person.

## Where it goes

A Google Sheet owned by the team, fronted by an Apps Script web app (`apps-script/`).
Anyone with the sheet link can read it, which is the point: the data is meant to be
looked at together. Do not put anything in a paraphrase you would not want a teammate
to read.

## Skill, agent, and connector names

These are shared as written. Built-in names say nothing, but a custom skill or a plugin
prefix (`acme-delivery:client-decks`) can name an employer, a client, or a product, and a
self-hosted connector is named whatever the person called it. When you walk the person
through the preview, read the distinct skill, agent, and connector names out loud and ask
whether any of them identify something they would rather not share. There is no
per-name redaction yet; the choice today is share or do not share.
