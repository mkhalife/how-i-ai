---
name: ai-wrapped
description: Pull every AI session from the last 30 days that the current tool can see (Claude Code and Cowork transcripts on disk, claude.ai chats via recent_chats, Claude Code cloud sessions via list_sessions, Codex sessions, ChatGPT threads via the desktop app, or an uploaded data export), classify each one (what it was for, and whether AI informed the person or did the work), and hand back a self-contained "wrapped" slide deck. Use when someone says "AI wrapped", "my month in AI", "how do I use AI", "give me a slide deck of my sessions".
---

# ai-wrapped

Show this person how they actually used AI in the last 30 days, from their own sessions,
as a wrapped-style slide deck. Do it all in this conversation with the tools you have.
Nothing leaves the machine or this chat.

## 1. Pull the sessions

Window: the 30 days ending now. Use every source the surface you are running in can
reach, and skip the rest without asking. Never scrape a logged-in web session, never use
cookies or tokens; only the routes below.

| If you are… | Pull from | How |
|---|---|---|
| Claude Code (terminal, IDE, Desktop Code tab) | Claude Code transcripts | `~/.claude/projects/*/*.jsonl` (or `$CLAUDE_CONFIG_DIR/projects`). One file per session; `~/.claude/projects/<encoded-cwd>/`, Windows `%USERPROFILE%\.claude\projects`. Skip files whose lines are all `isSidechain` or whose only user text is a headless ping. Treat a resumed copy of a session as the same session |
| Claude Code, same machine | Cowork sessions | macOS `~/Library/Application Support/Claude/local-agent-mode-sessions/<account>/<org>/local_<uuid>/.claude/projects/*/*.jsonl` (and `audit.jsonl` beside it); Windows `%LOCALAPPDATA%\Claude\local-agent-mode-sessions\…`; Linux `~/.config/Claude/…`. The `local_<uuid>.json` next to it has the title and, when `scheduledTaskId` is set, marks a scheduled task |
| A claude.ai/code session (has the Claude Code Remote tools) | Claude Code cloud sessions | Call `list_sessions` with `mine=true, limit=100`; while `has_more` and the oldest `created_at` is inside the window, call again with `after_id` = the previous `last_id` (10 calls at most). Drop sessions whose `environment_kind` contains `bridge` (mirrors of local ones). You get title, timestamps, model and `post_turn_summary` only |
| claude.ai Chat, web or desktop (has `recent_chats`) | Claude chats | Call `recent_chats` with `n=20`; page with `before` = the earliest `updated_at` seen until you pass 30 days (25 calls at most). You get title, `updated_at` and Claude's summary only; the summary stands in for the first message |
| Codex CLI or IDE | Codex sessions | `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl` and `~/.codex/archived_sessions/` (or `$CODEX_HOME`); `codex cloud list --json` for cloud tasks if a signed-in `codex` binary is on PATH |
| The ChatGPT desktop app (has `list_threads` / `read_thread`) | ChatGPT threads | List threads updated in the window, open each for its first user message and counts |
| Anywhere, if the person uploads one | A data export zip | claude.ai Settings → Privacy → Export data, or ChatGPT Settings → Data controls → Export data. Parse `conversations.json`: Claude has `uuid, name, created_at, chat_messages[] (sender human/assistant, text)`; ChatGPT has `id, title, create_time, mapping` (walk nodes by `message.create_time`, first visible `author.role == "user"` node is the first message). An export wins over a listing for the same conversation |

If two sources can be reached at once (Claude Code plus a claude.ai export, for instance),
use both and dedupe by id. If the surface has none of these, say so in one line and ask
for an export zip; do not invent sessions.

For each session keep, in a table (use a code tool or a scratch JSON file if you have one,
so nothing is skipped):

`id, source, surface, started_at, ended_at, title, first_message (≤1,200 chars), context
(second user message ≤300 chars, tools used, or the status summary), messages_user,
messages_assistant, tools[], connectors[] (MCP servers), skills[] (Skill tool or /slash),
agents[] (sub-agent types), model, mode (chat | agentic | routine), trigger (human |
scheduled | routine)`

Keep only sessions started inside the window. Print one line per source: found or not,
sessions in window. Then say the total and move on; do not print titles or first messages.

## 2. Classify every session

Judge each one from its first message, context and source. Consistency across the month
matters more than precision on any one session. Six fields:

- **category**: the job, not the topic or tool. Title Case, ≤40 chars, verb phrase. Reuse
  names; aim for 6 to 12 categories, never more than 15. Start from: Build & ship code,
  Debug & fix, Review & explain code, Automate & ops, Write & edit, Communicate &
  coordinate, Research & synthesis, Analyze data, Plan & prioritize, Design critique &
  feedback, Prototype & build, Explain & learn, Brainstorm & ideate, Personal & life
  admin, Career & growth. Add one only when nothing fits.
- **subcategory**: short noun phrase ≤40 chars a teammate could search ("Failing test",
  "PRD", "Travel"), or null.
- **assist_type**: `ask` (they wanted information, advice, a critique; they read words and
  acted themselves), `make` (they wanted an artifact they took away: doc, email, plan,
  SQL, code to paste, image), `do` (AI took actions: edited files, ran commands, opened a
  PR, sent or scheduled something). Most Claude Code, Codex and Cowork sessions with tool
  use are `do`, unless tools only read and the answer was an explanation (then `ask`).
  Mixed sessions: pick what they came for.
- **paraphrase**: one generic line ≤120 chars a stranger could read. No names of people,
  companies, products, repos, files or projects; no identifying numbers; no secrets, URLs,
  emails. Your own words, imperative: "Add a feature flag to a checkout flow and write
  tests". Keep the interesting part.
- **surprise**: true only when a teammate would say "you use it for that?" given the
  person's role. Expect 0 to 5 in a month.
- **confidence**: 0.9 stated in the first message, 0.6 inferred from context or a title,
  0.4 guessed.

Edge cases: a greeting or "test" first message with a real ask in the context, classify
from the context. Scheduled or routine sessions, classify the job the routine does and
give every run the same category and paraphrase; skip the harness preamble. Cloud lists
and Claude chat summaries carry only a title and a summary, classify from those at 0.6 to
0.7. Continuations that open mid-thought ("done", "make a PR for both"), use the title
and context. Prompts written by a tool (a commit message request), classify the job,
`make`, never surprise. A pasted email, notice or path, paraphrase the job, never the
sender, place or file name.

If you do not already know the person's job title and function (Design, Product,
Engineering, Data, Research, Marketing, Sales, Operations, Leadership, Other), ask once
before judging `surprise`; otherwise infer a rough role from the sessions and say you did.

## 3. Compute the numbers

From the classified table, local time:

- totals: sessions, sessions per week (total ÷ 30/7, one decimal), messages, active days,
  longest streak of consecutive active days, estimated hours if durations are known
- by source, by week (weeks start Monday), by weekday, by hour of day, busiest day, peak hour
- by category ranked with share, and the ask/make/do mix inside each; top subcategories
- ask/make/do overall with share
- tools, connectors, skills and sub-agents ranked by sessions; models
- session length buckets (1 message, 2–5, 6–20, 21+), median and p90 messages
- biggest use case (top category); the surprise session with the highest confidence
- up to 12 "moments": dated paraphrases spread across categories and the month

Then write the words, each checkable against the numbers: **headline** (3 to 7 words, the
shape of the month, not a pun or a stat), **summary** (2 to 4 sentences: what they mostly
use AI for, ask/make/do, which tools, one thing about timing), **patterns** (3 to 5 lines
under 90 chars that would make them nod), **one_liner** (<80 chars, for the share card),
**signature_move** (<100 chars, the recurring habit in the first messages),
**surprise_why** (one sentence, refer to the paraphrase, never the raw prompt). Say each
thing once. No "overall", no "it is worth noting".

## 4. Build the deck

The deck is a fixed HTML template, `profile-wrapped.html`, with one JSON document injected
into it. Get the template, write the JSON, inject, open. Do not redesign it.

### 4a. Get the template

Take the first that works:

1. **Already on disk.** `../how-i-ai/templates/profile-wrapped.html` relative to this
   file's folder (an installed plugin ships it), or
   `~/how-i-ai/repo/plugins/how-i-ai/skills/how-i-ai/templates/profile-wrapped.html`.
2. **Fetch it.** Into the working folder:

   ```bash
   curl -fsSL -o profile-wrapped.html https://raw.githubusercontent.com/mkhalife/how-i-ai/main/plugins/how-i-ai/skills/how-i-ai/templates/profile-wrapped.html
   ```

   (`curl.exe` in PowerShell, same arguments.)

3. **Neither** (no shell, or no network): go to 4d.

### 4b. Write `profile.json`

Every value comes from step 3. Keep every key; use `null` or `[]` when there is no data.
Dates are local `YYYY-MM-DD`, `share` is a fraction of total sessions to three decimals.

```jsonc
{
  "schema_version": 1,
  "generated_at": "<now, ISO>",
  "window": { "days": 30, "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" },
  "person": { "participant_id": "p_<8 random hex>", "title": "<job title>", "function": "<function>" },
  "totals": { "sessions": 0, "sessions_per_week": 0.0, "messages": 0, "active_days": 0,
              "hours_estimated": null, "sessions_timed": 0, "longest_streak_days": 0, "sources": 0 },
  "by_source": [ { "source": "claude-code", "label": "Claude Code", "sessions": 0, "messages": 0, "share": 0.0 } ],
  "by_week": [ { "week_start": "<Monday>", "sessions": 0, "by_source": { "claude-code": 0 } } ],   // one per Monday in the window
  "by_weekday": [ { "weekday": 0, "label": "Mon", "sessions": 0 } ],                              // 7 entries, 0 = Monday
  "by_hour": [ { "hour": 0, "sessions": 0 } ],                                                     // 24 entries
  "by_category": [ { "category": "Build & ship code", "sessions": 0, "share": 0.0,
                     "assist_type_mix": { "ask": 0, "make": 0, "do": 0 },
                     "subcategories": [ { "name": "Add a feature", "sessions": 0 } ] } ],           // ranked
  "by_assist_type": [ { "type": "ask", "label": "Asked", "sessions": 0, "share": 0.0 },
                      { "type": "make", "label": "Made", "sessions": 0, "share": 0.0 },
                      { "type": "do", "label": "Did", "sessions": 0, "share": 0.0 } ],
  "by_mode": [ { "mode": "agentic", "sessions": 0 } ],
  "tools": [ { "name": "Bash", "sessions": 0 } ],                                                  // ranked, built-in tools
  "connectors": [ { "name": "Slack", "sessions": 0 } ],                                            // MCP servers
  "skills": [ { "name": "code-review", "sessions": 0 } ],
  "agents": [ { "name": "evidence-researcher", "sessions": 0, "custom": true } ],                  // custom = not general-purpose, explore, plan, claude, fork, claude-code-guide, statusline-setup, output-style-setup
  "models": [ { "name": "claude-opus-4-1", "sessions": 0 } ],
  "session_length": { "buckets": [ { "label": "1 message", "sessions": 0 }, { "label": "2–5", "sessions": 0 },
                                   { "label": "6–20", "sessions": 0 }, { "label": "21+", "sessions": 0 } ],
                      "median_messages": 0, "p90_messages": 0 },
  "highlights": { "biggest_use_case": "<top category>",
                  "surprise": { "paraphrase": "...", "category": "...", "why": "<surprise_why>" },  // or null
                  "busiest_day": { "date": "YYYY-MM-DD", "sessions": 0 }, "peak_hour": 0,
                  "signature_move": "...", "one_liner": "..." },
  "surprises": [ { "paraphrase": "...", "category": "...", "source": "claude-code", "date": "YYYY-MM-DD" } ],  // up to 8
  "sample_sessions": [ { "paraphrase": "...", "category": "...", "assist_type": "do", "source": "claude-code",
                         "date": "YYYY-MM-DD", "messages": 0 } ],                                  // the 12 moments, newest first
  "narrative": { "headline": "...", "summary": "...", "patterns": [ "..." ] }
}
```

Source labels: `claude-code` Claude Code, `claude-cowork` Cowork, `claude-chat` and
`claude-export` Claude, `claude-desktop` Claude Desktop, `codex` Codex, `chatgpt-app` and
`chatgpt-export` ChatGPT. Paraphrases only in every string; no raw prompts or titles.

### 4c. Inject and open

The template has one placeholder, `__HOW_I_AI_DATA__`, inside
`<script id="how-i-ai-data" type="application/json">`. Replace it with the JSON, with `<`
escaped as `\u003c` (and U+2028, U+2029 as `\u2028`, `\u2029`), and write the result as
`ai-wrapped.html`:

```bash
python3 -c 'import json,sys; t=open("profile-wrapped.html").read(); j=json.dumps(json.load(open("profile.json"))).replace("<","\\u003c").replace("\u2028","\\u2028").replace("\u2029","\\u2029"); open("ai-wrapped.html","w").write(t.replace("__HOW_I_AI_DATA__",j,1))'
```

(or the same three lines in Node). Check the placeholder is gone, then open the file
(`open` on macOS, `start ""` on Windows, `xdg-open` on Linux) or attach it. If you can
publish an Artifact, offer that too; it is the same HTML. The page is self-contained and
works offline.

### 4d. Without the template

If you can fetch URLs but not run shell, read the template's source from
`https://raw.githubusercontent.com/mkhalife/how-i-ai/main/plugins/how-i-ai/skills/how-i-ai/templates/profile-wrapped.html`
and reproduce it as closely as you can in a single HTML artifact: the same 13 cards in the
same order, the same eyebrow and heading lines, dark background with one accent colour per
card, full-viewport scroll-snap sections, a dot rail, bars drawn inline. If the source is
not reachable either, build the same 13 slides from this list:

1. **Cover**: "personal wrapped", the date range, the headline.
2. **The raw count**: sessions as the hero number; per week, active days, streak, messages.
3. **Where it happened**: sessions by source, bars.
4. **Week by week**: sessions per week, bars, with the busiest day called out.
5. **When you reach for it**: weekday bars plus hour-of-day strip, peak hour called out.
6. **What you brought to it**: "Number one: <biggest use case>.", its share, its top
   subcategories, then the top 7 categories as ranked bars.
7. **The real question**: "Did you ask AI for information, or did it do things for you?"
   The ask/make/do split as one stacked bar and the lead type in a sentence.
8. **What it touched**: top tools and connectors (only if any).
9. **What you reached for**: go-to skill and go-to sub-agent (only if any).
10. **And then there was this**: the surprise session's paraphrase and `surprise_why`.
11. **A few moments**: the 12 dated paraphrases as a list.
12. **The read on you**: summary and patterns.
13. **The one to screenshot**: share card with one_liner, signature_move, three or four
    hero stats, the date range.

If you can render no HTML at all, present the 13 slides as 13 short titled sections in
chat, numbers identical to step 3.

### 4e. Finish

Every number on a slide comes from step 3. Every line of text on a slide is a paraphrase
or your own words; no raw prompts, titles, file names, project names or people. Close with
two or three lines: the total, the biggest use case, and which sources could not be read
here and why.

## Rules

- Local only. Do not send, post, upload or publish anything the person did not ask for; the
  deck itself is the only output, and it contains paraphrases, not prompts.
- Never print raw first messages, titles or paths in your replies. Counts and paraphrases only.
- Do not classify from memory across a long list; work from the table you built.
- If a source could not be read, say which and why next to the numbers that did work.
