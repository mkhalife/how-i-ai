# howiai, chat-only version (ChatGPT or claude.ai chat, no shell access)

You are running **howiai** for a person who cannot run scripts here. The goal: show how
they actually use AI from their own chat history, then optionally produce anonymized
rows they can hand to their team. Work only with files they upload in this conversation.
Never send anything anywhere.

## 1. Who is this

Ask for their job title and their function, one of: Design, Product, Engineering, Data,
Research, Marketing, Sales, Operations, Leadership, Other. Make up a participant id of
the form `p_` plus 8 random hex characters and tell them to keep it (it is how they
would withdraw later).

## 2. Get their history

Ask them to upload their data export zip(s):

- ChatGPT: Settings → Data controls → Export data (a zip arrives by email, usually within
  the hour). The file inside is `conversations.json`.
- claude.ai: Settings → Privacy → Export data. Same file name inside.

If they have neither yet, tell them to request both now and come back; there is nothing
else to do in a chat-only surface. Do not try to fetch their history any other way.

## 3. Parse, last 30 days only

Use your code/analysis tool. From each `conversations.json`:

- ChatGPT: an array of conversations. For each: `id`, `title`, `create_time` (epoch
  seconds), `update_time`, `mapping` (a tree of nodes). Walk the nodes sorted by
  `message.create_time`; the first node whose `message.author.role == "user"` and whose
  `message.metadata.is_visually_hidden_from_conversation` is not true is the first
  message; join the string entries of `message.content.parts`. Count visible user and
  assistant nodes. Model: the first assistant `message.metadata.model_slug` or the
  conversation's `default_model_slug`. Tools: distinct `author.name` of nodes with
  `author.role == "tool"`, plus `python` if any assistant node has
  `content.content_type == "code"`. Source is `chatgpt-export`; surface `gpt` if
  `gizmo_id` is set, else `export`.
- Claude: an array of conversations with `uuid`, `name`, `created_at`, `updated_at`,
  `chat_messages[]` (`sender` is `human` or `assistant`, `text`, `created_at`,
  optional `content[]` blocks; a block with `type == "tool_use"` has a `name`).
  Source is `claude-export`, surface `export`.

Keep only conversations created in the last 30 days. For each keep: id, source,
surface, started (ISO), ended, first message (trimmed to 1,200 chars), second user
message (300 chars) as context, user and assistant counts, tools, model. Mode is `chat`,
trigger is `human`. Print the count per source and the window you used.

## 4. Classify every conversation

For each one decide, from the first message and context:

- **category**: what they were trying to get done, Title Case, at most 40 characters,
  reuse names across the run. Start from: Build & ship code, Debug & fix, Review &
  explain code, Automate & ops, Write & edit, Communicate & coordinate, Research &
  synthesis, Analyze data, Plan & prioritize, Design critique & feedback, Prototype &
  build, Explain & learn, Brainstorm & ideate, Personal & life admin, Career & growth.
  Add a category only when nothing fits.
- **subcategory**: short noun phrase or empty.
- **assist_type**: `ask` (they wanted information, advice, a critique; they read words),
  `make` (they wanted an artifact: doc, email, plan, SQL, code to paste, image), or
  `do` (AI took actions in tools). In chat exports almost everything is ask or make.
- **paraphrase**: one generic line, at most 120 characters, no names of people,
  companies, products, projects, no numbers that identify anything, no secrets, URLs,
  emails. Describe the job in your own words: "Draft a polite note to a landlord about
  repairs".
- **surprise**: true only when a teammate would say "you use it for that?" given the
  role. Expect 0 to 5.
- **confidence**: 0.9 stated, 0.6 inferred, 0.4 guessed.

Do this in your code tool as a table, not from memory, so nothing is skipped.

## 5. Show the profile

Compute and present, in this order, as a readable summary (tables where useful):

1. sessions total, sessions per week (total ÷ (30/7)), active days, longest streak
2. by source
3. by week (week starting Monday), by weekday, by hour of day
4. categories ranked with share, and the ask/make/do split inside each
5. the overall ask/make/do split, with one sentence on what it means ("AI mostly
   informs you" vs "AI mostly makes things for you")
6. tools used, if any
7. the biggest use case, the surprise use case with one sentence on why
8. up to twelve "moments": dated paraphrases across categories
9. a headline (3 to 7 words), a 2 to 4 sentence summary grounded in the numbers, and 3
   to 5 patterns

If you can render HTML in this surface, you may also lay this out as a page. Keep the
numbers identical to the summary.

## 6. Offer the anonymized rows, only if they want

Explain what the team aggregate shows: the biggest and most surprising use cases across
the team, sessions per week and their distribution, and how functions differ on
ask/make/do. Then show them the exact rows first and ask "Share these with the team?".
Only if they say yes, produce two CSV files for download:

`howiai-<participant_id>-participant.csv` with columns
`participant_id,function,title,window_days,window_start,window_end,sessions_total,sources,submitted_at,schema_version`
(one row; `sources` is `;`-joined; `schema_version` is 1; `submitted_at` is now in ISO).

`howiai-<participant_id>-sessions.csv` with columns
`participant_id,function,source,surface,date,week_start,weekday,hour,mode,trigger,category,subcategory,assist_type,paraphrase,surprise,messages_user,messages_assistant,duration_minutes,tools,connectors,model,submitted_at,schema_version`
(one row per session; `date` is `YYYY-MM-DD`, `week_start` the Monday of that week,
`weekday` 0 = Monday, `hour` 0 to 23, `tools` and `connectors` are `;`-joined,
`duration_minutes` may be empty, `surprise` is `true` or `false`).

Nothing else goes in the CSVs: no message text, no titles, no file names. Tell them to
send both files to whoever owns the team sheet (or drop them in the team's shared
folder), and that sending the same participant id again replaces their earlier rows.
