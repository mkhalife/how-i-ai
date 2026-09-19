# how-i-ai data schema

Every script reads and writes plain JSON. Three documents matter:

1. `sessions.json` – the local, private inventory (never leaves the machine)
2. `profile.json` – the numbers and text the profile page renders
3. shared rows – the anonymized subset that goes to the team sheet

All timestamps are ISO 8601. All dates are `YYYY-MM-DD` in the user's local time.

## 1. `sessions.json` (private)

```jsonc
{
  "schema_version": 1,
  "collected_at": "2026-09-19T14:02:11-04:00",
  "window": { "days": 30, "start": "2026-08-20", "end": "2026-09-19" },
  "machine": { "platform": "darwin", "hostname_hash": "h_9f3a..." },
  "sources": [
    // one entry per source the collector looked for
    { "source": "claude-code", "found": true, "path": "/Users/x/.claude/projects", "sessions": 81 },
    { "source": "chatgpt-export", "found": false, "path": null, "sessions": 0, "hint": "Drop the ChatGPT export zip in ~/how-i-ai/inbox" }
  ],
  "sessions": [
    {
      "id": "s_claude-code_ff558e1b",       // stable: source + native id
      "source": "claude-code",                // see Sources
      "surface": "cli",                        // cli | desktop | web | cloud | cowork | app | export
      "started_at": "2026-09-19T01:37:01.378Z",
      "ended_at": "2026-09-19T02:10:44.102Z",
      "duration_minutes": 33.7,                // active minutes from per-record timestamps (gaps over 15 min dropped); null when the source only knows created/updated times
      "title": "Howiai skills plugin",         // product-generated title if any
      "first_message": "Make me a new skills repo like...", // raw, trimmed to 2,000 chars
      "first_message_chars": 2410,
      "context": "Second message: ... | Tools: Bash, Read, WebSearch",   // ≤ 600 chars of extra signal
      "messages_user": 4,                      // both counts are null when the source gives only a title (cloud lists, a thread the in-app agent could not open)
      "messages_assistant": 9,
      "tools": ["Bash", "Read", "WebSearch"],          // built-in tool names
      "connectors": ["github", "Google_Drive"],        // MCP server names (mcp__<server>__*)
      "skills": ["code-review", "pm-storytelling:brag-to-bets"], // skills invoked (Skill tool or a /slash command that is not a built-in); plugin skills are "<plugin>:<skill>". Codex: SKILL.md reads, plus "plugin:<plugin>" for a plugin used through its MCP tools
      "agents": ["general-purpose", "evidence-researcher"],       // sub-agent types spawned (Agent tool subagent_type)
      "model": "claude-opus-4-1",
      "mode": "agentic",                               // chat | agentic | routine
      "trigger": "human",                              // human | scheduled | routine | review | unknown
      "project_hash": "h_1c2d...",                     // sha256 of cwd/repo, never the path
      "resumed": false,
      "classification": null                           // filled by classify step, see below
    }
  ]
}
```

### Sources

| `source` | Where it comes from |
|---|---|
| `claude-code` | `~/.claude/projects/**/*.jsonl` (local CLI, IDE, desktop "Code" tab) |
| `claude-cowork` | Claude Desktop Cowork session store |
| `claude-export` | claude.ai data export zip (`conversations.json`) |
| `codex` | `~/.codex/sessions/**/*.jsonl`, and cloud tasks from `codex cloud list --json` |
| `chatgpt-export` | ChatGPT data export zip (`conversations.json`) |
| `chatgpt-app` | `chatgpt-app-threads.json`, written by the agent inside the ChatGPT desktop app |

The `claude-*` sources belong to the Claude entry point (`~/how-i-ai`), `codex` and
`chatgpt-*` to the ChatGPT entry point (`~/how-i-ai-chatgpt`); one `sessions.json` holds
one entry point's sources.

### `classification` (written by Claude, validated by `validate.mjs`)

```jsonc
{
  "category": "Build & ship code",          // free text, follow guidelines, Title Case, ≤ 40 chars
  "subcategory": "Add a feature",           // free text, ≤ 40 chars, or null
  "assist_type": "do",                      // ask | make | do   (fixed)
  "paraphrase": "Add a new plugin to a skills repo and push it", // ≤ 120 chars, no names/secrets
  "surprise": false,                        // true when it is outside what the role predicts
  "confidence": 0.9                         // 0..1
}
```

`assist_type` is the "is AI informing you or doing things for you" axis:

- `ask`: the person wanted information, an explanation, advice, a recommendation, a review of their own thinking. Output was words they read.
- `make`: the person wanted an artifact produced: a doc, a design, code, a plan, a spreadsheet, an image. They took it and used it.
- `do`: AI took actions in the world or in tools: edited files, ran commands, sent messages, filed tickets, browsed, changed settings.

## 2. `profile.json` (rendered into the profile page)

```jsonc
{
  "schema_version": 1,
  "generated_at": "2026-09-19T14:05:00-04:00",
  "window": { "days": 30, "start": "2026-08-20", "end": "2026-09-19" },
  "person": { "participant_id": "p_ab12cd34", "title": "Senior Product Designer", "function": "Design" },
  "totals": {
    "sessions": 142, "sessions_per_week": 33.1, "messages": 1180,
    "active_days": 22, "hours_estimated": 41.5, "sessions_timed": 120, "longest_streak_days": 9, // hours sum only the sessions_timed sessions that have a duration; null when none do
    "sources": 3
  },
  "by_source": [ { "source": "claude-code", "label": "Claude Code", "sessions": 80, "messages": 900, "share": 0.56 } ],
  "by_week": [ { "week_start": "2026-08-18", "sessions": 30, "by_source": { "claude-code": 20 } } ],
  "by_weekday": [ { "weekday": 0, "label": "Mon", "sessions": 28 } ],      // 0 = Monday
  "by_hour": [ { "hour": 0, "sessions": 1 } ],                                // 24 entries
  "by_category": [
    { "category": "Build & ship code", "sessions": 40, "share": 0.28,
      "assist_type_mix": { "ask": 5, "make": 10, "do": 25 },
      "subcategories": [ { "name": "Add a feature", "sessions": 18 } ] }
  ],
  "by_assist_type": [ { "type": "ask", "label": "Asked", "sessions": 40, "share": 0.28 } ],
  "by_mode": [ { "mode": "agentic", "sessions": 90 } ],
  "tools": [ { "name": "Bash", "sessions": 60 } ],
  "connectors": [ { "name": "Slack", "sessions": 12 } ],
  "skills": [ { "name": "code-review", "sessions": 9 } ],
  "agents": [ { "name": "evidence-researcher", "sessions": 4, "custom": true } ],   // custom = not one of Claude Code's built-in agent types
  "models": [ { "name": "claude-opus-4-1", "sessions": 70 } ],
  "session_length": {
    "buckets": [ { "label": "1 message", "sessions": 30 }, { "label": "2–5", "sessions": 50 }, { "label": "6–20", "sessions": 40 }, { "label": "21+", "sessions": 22 } ],
    "median_messages": 6, "p90_messages": 30
  },
  "highlights": {
    "biggest_use_case": "Build & ship code",
    "surprise": { "paraphrase": "Plan a 6-year-old's birthday party with a budget", "category": "Personal & life admin", "why": "Nothing else in the month was personal" },
    "busiest_day": { "date": "2026-09-04", "sessions": 14 },
    "peak_hour": 10,
    "signature_move": "Starts agentic sessions with a paste of the failing test output",
    "one_liner": "Ships with Claude Code by day, thinks out loud with Claude at night"
  },
  "surprises": [ { "paraphrase": "...", "category": "...", "source": "claude-export", "date": "2026-09-02" } ],
  "sample_sessions": [ { "paraphrase": "...", "category": "...", "assist_type": "do", "source": "claude-code", "date": "2026-09-10", "messages": 12 } ],
  "narrative": { "headline": "...", "summary": "...", "patterns": [ "..." ] }
}
```

## 3. Shared rows (the only thing that leaves the machine)

One `participant` row and one `session` row per session. `share.mjs` prints these in full before anything is sent.

`participant`: `participant_id, function, title, window_days, window_start, window_end, sessions_total, sources, submitted_at, schema_version`

`session`: `participant_id, function, source, surface, date, week_start, weekday, hour, mode, trigger, category, subcategory, assist_type, paraphrase, surprise, messages_user, messages_assistant, duration_minutes, tools, connectors, skills, agents, model, submitted_at, schema_version`

`participant_id` is minted per working folder: each entry point (`~/how-i-ai` for Claude, `~/how-i-ai-chatgpt` for ChatGPT) has its own `config.json` and so its own id, and a person who runs both appears as two ids on the sheet.

Never shared: `first_message`, `context`, `title`, `project_hash`, `hostname_hash`, paths, file names, anything under `machine`.

## 4. `aggregate.json` (rendered into the team report)

```jsonc
{
  "schema_version": 1,
  "generated_at": "...",
  "window": { "days": 30, "start": "...", "end": "..." },
  "team": { "name": "Product team", "participants": 14,
            "by_function": [ { "function": "Design", "participants": 4 } ] },
  "totals": { "sessions": 1830, "messages": 14100, "sessions_per_person_per_week": 9.4 },
  "distribution": {
    "sessions_per_week_per_person": { "buckets": [ { "label": "0–5", "participants": 3 } ], "median": 8, "p90": 30, "max": 45 },
    "participants": [ { "participant_id": "p_..", "function": "Design", "sessions_per_week": 12.1, "top_category": "...", "assist_type_mix": { "ask": 10, "make": 20, "do": 5 } } ]
  },
  "by_function": [
    { "function": "Design", "participants": 4, "sessions": 300, "sessions_per_person_per_week": 18.7,
      "top_categories": [ { "category": "...", "share": 0.3 } ],
      "assist_type_mix": { "ask": 100, "make": 150, "do": 50 },
      "by_source": { "claude-export": 200, "chatgpt-export": 100 } }
  ],
  "by_category": [ { "category": "...", "sessions": 400, "share": 0.22, "by_function": { "Design": 100 }, "subcategories": [ { "name": "...", "sessions": 80 } ] } ],
  "by_assist_type": [ { "type": "ask", "label": "Asked", "sessions": 700, "share": 0.38 } ],
  "by_source": [ { "source": "claude-code", "label": "Claude Code", "sessions": 800, "share": 0.44 } ],
  "by_mode": [ { "mode": "chat", "sessions": 900 } ],
  "by_week": [ { "week_start": "...", "sessions": 420, "active_participants": 13 } ],
  "by_weekday": [ { "weekday": 0, "label": "Mon", "sessions": 300 } ],
  "by_hour": [ { "hour": 9, "sessions": 120 } ],
  "tools": [ { "name": "Bash", "sessions": 500 } ],
  "connectors": [ { "name": "Slack", "sessions": 90 } ],
  "skills": [ { "name": "code-review", "sessions": 60, "participants": 5 } ],
  "agents": [ { "name": "evidence-researcher", "sessions": 22, "custom": true, "participants": 3 } ],
  "surprises": [ { "paraphrase": "...", "function": "Design", "category": "...", "source": "chatgpt-export" } ],
  "highlights": {
    "biggest_use_case": "...", "surprise_use_case": "...", "most_agentic_function": "Engineering",
    "most_curious_function": "Product", "one_liner": "..."
  },
  "narrative": { "headline": "...", "summary": "...", "patterns": [ "..." ] }
}
```
