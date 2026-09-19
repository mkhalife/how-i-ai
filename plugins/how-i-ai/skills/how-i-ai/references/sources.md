# Where sessions come from

There are two entry points and each reads only its own product's sources. `claude` (the
default) works in `~/how-i-ai`; `chatgpt` (`--app chatgpt`, run from inside the ChatGPT
desktop app) works in `~/how-i-ai-chatgpt`. `collect.mjs` looks in the places below that
belong to the entry point it was started as, and an export zip for the other product is
ignored. Paths use `~` for the home folder; on Windows that is `%USERPROFILE%`. All
parsers are in `scripts/lib/sources.mjs`.

| Source | Entry point | Surface | Location | Status |
|---|---|---|---|---|
| `claude-code` | claude | cli, ide, desktop, cloud (teleported) | `~/.claude/projects/<encoded-cwd>/<session>.jsonl` (or `$CLAUDE_CONFIG_DIR/projects`) | on disk, parsed |
| `claude-desktop` | claude | desktop chat | not on disk (verified macOS, September 2026): the desktop app keeps Chat conversations server-side, so they arrive with `claude-chat-threads.json` or the claude.ai export. The tolerant state-file parser still accepts an inline-`messages` shape in case a build writes one | export only |
| `claude-cowork` | claude | cowork | macOS `~/Library/Application Support/Claude/local-agent-mode-sessions/<account>/<org>/`; Windows `%LOCALAPPDATA%\Claude\local-agent-mode-sessions\` (older builds `%APPDATA%`); Linux `~/.config/Claude/`. Also `Claude-3p` for managed installs. `local_<uuid>.json` state file plus working dir `local_<uuid>/` (layout below) | on disk, verified on macOS |
| `claude-code` cloud | claude | cloud | not on disk. `~/how-i-ai/inbox/cloud-sessions.json` (the working folder is also checked, `--cloud-sessions` overrides), written by Claude inside a claude.ai/code session from the Claude Code Remote `list_sessions` tool (`PROMPT-claude-cloud.md`) and saved there by the person | title, timestamps, model, status summary |
| `codex` | chatgpt | cli, ide, desktop | `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl` and `~/.codex/archived_sessions/` (or `$CODEX_HOME`) | on disk, parsed |
| `codex` cloud | chatgpt | cloud | `codex cloud list --json` (`{tasks[], cursor}`). The binary is looked for on PATH, then inside the ChatGPT desktop app: macOS `ChatGPT.app/Contents/Resources/codex` (verified), Windows `%LOCALAPPDATA%\Programs\ChatGPT\resources\codex.exe` and the Store package folder (unverified) | title and summary only |
| `chatgpt-export` | chatgpt | export, gpt | zip from ChatGPT Settings → Data controls → Export data, dropped in `~/how-i-ai-chatgpt/inbox` | parsed from `conversations.json` |
| `chatgpt-app` | chatgpt | desktop | `~/how-i-ai-chatgpt/inbox/chatgpt-app-threads.json`, written by the agent inside the ChatGPT desktop app from its `list_threads` / `read_thread` tools (`PROMPT-chatgpt-app.md`). Same ids as the export; when both exist the export wins | first message, counts, title |
| `claude-chat` | claude | chat | `~/how-i-ai/inbox/claude-chat-threads.json`, written by Claude in claude.ai Chat mode (web or desktop) from its `recent_chats` tool (`PROMPT-claude-chat.md`) and saved there by the person. Same ids as the claude.ai export; when both exist the export wins | title, Claude's summary, one timestamp |
| `claude-export` | claude | export | zip from claude.ai Settings → Privacy → Export data, dropped in `~/how-i-ai/inbox` | parsed from `conversations.json` |
| `chatgpt-desktop` | chatgpt | signal only | macOS `~/Library/Application Support/com.openai.chat/conversations-v2-*` and `-v3-*` (classic app), or `~/Library/Application Support/Codex/` (merged app, Chromium profile only: no cached count, last activity from file times); Windows `%LOCALAPPDATA%\Packages\OpenAI.ChatGPT-Desktop_*\LocalCache\Roaming\ChatGPT\` | installed, cached conversation count, last activity. No message bodies |

Not covered, on purpose: Cursor and Copilot (different product category), and any route
that scrapes a logged-in web session with cookies or tokens. Those unofficial routes
exist but they are against the products' terms and break without notice; the exports are
the supported path.

## Claude surfaces that hand over a file (verified September 2026)

Two Claude surfaces hold history the local run cannot reach, and neither can run the
scripts or post to the sheet. Each writes one JSON file, the person saves it into
`~/how-i-ai/inbox`, and the normal Claude run (Claude Code or Cowork) reads it. One
Claude profile, one id. The landing page has a card for each; both prompts are carried
whole, with no fetch.

- **Claude chats** (`PROMPT-claude-chat.md` → `claude-chat-threads.json`). Claude in
  claude.ai Chat mode, web or desktop, has `recent_chats` (args `n` up to 20, `before`,
  `after` as ISO datetimes) and `conversation_search` (args `query`, `max_results`,
  `within_conversation_id`). `recent_chats` returns per chat: `url`, `updated_at`, a
  title, and a prose summary. No first message, created time, counts, or model. Older
  pages: pass `before` = the earliest `updated_at` seen. Cowork and Code mode do not have
  these tools. File shape: `{ source: "claude-chat", exported_at, chats: [ { url,
  updated_at, title, summary } ] }` (a bare array is accepted). The id is the last path
  segment of `url` (`https://claude.ai/chat/<uuid>`), in the export's id space
  (`s_claude-export_<uuid>`). `started_at` and `ended_at` are both `updated_at`, the
  summary stands in for the first message, counts, duration and model are null.
- **Claude Code cloud sessions** (`PROMPT-claude-cloud.md` → `cloud-sessions.json`). A
  claude.ai/code session has the Claude Code Remote `list_sessions` tool (args `limit` up
  to 100, `after_id`, `before_id`, `mine`, `tags`). Response: `data[]`, `has_more`,
  `first_id`, `last_id`; older pages: pass `last_id` as `after_id`. Per session: `id`,
  `title`, `session_status`, `status_bucket`, `created_at`, `updated_at`,
  `environment_id`, `environment_kind`, `origin`, `permission_mode`, `connection_status`,
  `tags`, `configured_model`, `unread`, `session_context` (`sources`, `outcomes`, `model`,
  `effort_level`, `permission_mode`), `post_turn_summary` (`status_category`,
  `status_detail`, `recent_action`, `needs_action`), `external_metadata`. No message
  text. Local Claude Code, Cowork, and Chat do not have this tool. File shape:
  `{ source: "claude-cloud", exported_at, data: [...] }` with the fields the prompt keeps
  (a bare array and the `{ ccr: { data } }` wrapper are accepted). The title stands in
  for the first message; `post_turn_summary.status_detail` and `recent_action` go into
  `context`; `environment_kind` containing `bridge` is a Remote Control mirror of a local
  session and is skipped.

## Claude Desktop on disk (verified on macOS, September 2026)

```
local-agent-mode-sessions/<account-uuid>/<org-uuid>/
  local_<uuid>.json            state file, metadata only (no messages)
  local_<uuid>/                working dir
    audit.jsonl                SDK message stream, HMAC-signed lines
    outputs/  uploads/
    .claude/projects/<encoded-cwd>/<cliSessionId>.jsonl          transcript, Claude Code shape, entrypoint "local-agent"
    .claude/projects/<encoded-cwd>/<cliSessionId>/subagents/     agent-*.jsonl, ignored
  scheduled-tasks.json  cowork-*-cache.json  rpm/                not sessions
claude-code-sessions/<account-uuid>/<org-uuid>/
  local_<uuid>.json            Code-tab state file; transcript is ~/.claude/projects/**/<cliSessionId>.jsonl
  deleted_<uuid>  archived-sessions.idx  backlog  scheduled-tasks.json
```

- State file keys used: `sessionId` (`local_<uuid>`), `cliSessionId`, `title`, `initialMessage`, `createdAt` and
  `lastActivityAt` (epoch ms), `model`, `cwd`, `scheduledTaskId`. There is no Chat/Cowork key: everything in
  `local-agent-mode-sessions` is Cowork. Never read: `systemPrompt`, `accountName`, `emailAddress`.
- The state file and the transcript describe the same session. The parser joins them on `cliSessionId` and
  emits one record; a transcript whose state file is gone is still picked up on its own.
- `audit.jsonl` records: `type` is `user`, `assistant`, `system`, `result`, or `rate_limit_event`, with
  `session_id`, `parent_tool_use_id` (set on sub-agent traffic), `isReplay`, `isSynthetic`, `message`. A tool
  invocation is an `assistant` record whose `message.content[]` has a `tool_use` block; the tool name is
  `.name`. Used only when the transcript has been cleaned up.
- Code-tab sessions are counted once, from `~/.claude/projects`. Their state files are consulted for
  `scheduledTaskId` only.
- Desktop scheduled tasks run with `origin.kind: "human"`. The tells are the `<scheduled-task name file>`
  wrapper around the first message and `scheduledTaskId` in the state file; both set `trigger: scheduled`,
  `mode: routine`.

## Why ChatGPT is not read from disk (researched September 2026)

The desktop apps do not give a legitimate way to read conversation text from disk:

- **macOS.** After a 2024 disclosure that the app stored chats in plain text, OpenAI
  moved them to `conversations-v2-<uuid>/*.data` (later `-v3-`), encrypted with a key
  held in the Keychain under `com.openai.chat.conversations_v2_cache`. That item sits in
  an access group scoped to OpenAI's Team ID, so a third-party process cannot read it
  without the person exporting the key by hand. Building around that would be undoing a
  security fix, so this tool does not. Forensics tooling that has looked at v2/v3 treats
  them as inventory only (ids, sizes, timestamps) and notes newer builds may keep text
  cloud-only anyway.
- **Windows.** The Store app is a Chromium wrapper; chats the person opened sit in an
  IndexedDB write-ahead log under `LocalCache\Roaming\ChatGPT\IndexedDB\`. It is
  unencrypted but volatile: only chats typed or opened in the app, and the folder is
  wiped on logout. Good enough for "the app is used", not for history.
- **The merged ChatGPT/Codex app** (July 2026, bundle `com.openai.codex`) adds only a
  Chromium profile under `Application Support/Codex`; Codex transcripts still live in
  `~/.codex`, plaintext and complete, which the `codex` parser reads.
- **What else is in `~/.codex`** (verified September 2026). `session_index.jsonl` is
  `{id, thread_name, updated_at}` per local thread (used for titles). `state_5.sqlite`
  table `threads` indexes local Codex threads only, one row per rollout file
  (`rollout_path`), so it adds nothing the rollouts lack. `thread_history_1.sqlite`
  (`thread_turns`, `thread_items`) is a projection of the same rollouts.
  `sqlite/codex-dev.db` table `local_thread_catalog` is the app's thread list:
  `source_kind` is `chatgpt` for ChatGPT conversations and `vscode` for local threads,
  with `display_title` and `source_updated_at` (epoch seconds) and no message bodies.
  It only holds conversations the app has listed, so the collector uses it for the
  signal (count and last update; titles are never selected). Its `automations` /
  `automation_runs` tables list scheduled Codex tasks and their runs (thread ids only
  are read, see below). ChatGPT conversations shown inside the app are fetched
  from the server and have no rollout file. Cloud Codex tasks are not on disk either.
- **The app's `list_threads` / `read_thread` tools** come from the bundled
  `codex-app-tools` MCP server. It only works for agents the desktop app hosts: started
  by hand it answers "Codex did not provide CODEX_APP_TOOLS_PIPE_PATH", and under
  `codex exec` the tools are not offered at all (both tested). So listing ChatGPT
  conversations is a job for the agent inside the app, which is what
  `PROMPT-chatgpt-app.md` is for.
- **Never read:** `~/.codex/auth.json` (live tokens), `~/.codex/shell_snapshots/`
  (exported env vars), Atlas caches, or the opt-in "Computer History" telemetry under
  `Group Containers/2DC432GLL2.com.openai.sky.CUAService`. None are needed for usage
  counts and all are more sensitive than chat text.
- **The export.** Settings → Data controls → Export data. Arrives by email, usually in
  minutes, officially "up to 7 days"; the link expires after 24 hours. The zip holds
  `conversations.json` (or numbered conversation files on very large accounts),
  `chat.html`, `message_feedback.json`, `model_comparisons.json`, `user.json`. It does
  not include Codex sessions, Projects as a unit, or scheduled Tasks, and generated
  images have been unreliable in exports since 2025.

So the ChatGPT entry point reports the desktop app as a signal (installed, cached
conversation count, last activity) and gets content from the export or from the in-app
agent's `chatgpt-app-threads.json`.

`codex cloud` writes an `error.log` containing an account id into its working directory,
so the collector runs it in a throwaway temp dir and deletes that afterwards.

## What is extracted per session

| Field | Claude Code | Claude Desktop | Codex | ChatGPT export | Claude export |
|---|---|---|---|---|---|
| id | `sessionId` | file name | `session_meta.payload.id` | `id` | `uuid` |
| started / ended | first and last `timestamp` | `createdAt`/`lastActivityAt` or file times | line timestamps | `create_time`/`update_time` | `created_at`/`updated_at` |
| first message | first `type:user` with human text, harness tags stripped | transcript's first human turn, else `audit.jsonl`, else `initialMessage` | first `user_message` event or `item_completed` `UserMessage` item (falls back to `response_item` items of kind `user.text`) | first visible `author.role=user` node | first `sender=human` |
| duration | active time (below) | active time from the transcript, else from `audit.jsonl`; null for an inline-`messages` state file | active time from line timestamps | null | null |
| context | second message, tools, branch | second message, tools, skills, agents | second message, tools, skills | second message, custom GPT, tools | second message, tools |
| counts | human turns, distinct assistant messages | user and assistant entries | user events, assistant messages | visible user and assistant nodes | human and assistant |
| tools / connectors | `tool_use` names; `mcp__<server>__` → connector | same, from the transcript or `audit.jsonl` `tool_use` blocks | `function_call` / `custom_tool_call` names; desktop builds: `item_completed` items instead of the generic `exec` (`CommandExecution` → `shell`, `Extension.kind` `web.search` → `web_search`); MCP server from `mcp_tool_call` or the `McpToolCall` item | tool-author names, `code` parts → python | `tool_use` blocks |
| skills / agents | `Skill` tool `input.skill`; `/slash` commands that are not built-ins; `Agent` tool `input.subagent_type` (omitted = `general-purpose`; custom = not a built-in type) | same | skills: reads of `<skills root>/<skill>/SKILL.md` → `<skill>`, or `<plugin>:<skill>` under a plugin cache; plugins: `McpToolCall.pluginId` → `plugin:<plugin>` (details below). No agents | n/a | n/a |
| model | most common `message.model` | if present | `turn_context.model` | `model_slug` | if present |
| mode / trigger | `origin.kind` (human vs routine), `<scheduled-task>` wrapper or desktop `scheduledTaskId` → scheduled; tool use → agentic | `scheduledTaskId` | automation thread → scheduled / routine (below); tools → agentic | chat | chat |
| surface | `entrypoint` (`cli`, `claude-desktop` → desktop, `sdk-cli` → sdk, `local-agent` → cowork, ide, remote → cloud) | cowork | `originator` | export or gpt | export |

Harness noise is removed before anything is counted: `<system-reminder>`, slash
commands, pasted-content wrappers, tool results, compaction summaries, sub-agent
transcripts (`agent-*.jsonl`, `isSidechain`), and user-role records that are not the
person: `<task-notification>` (`origin.kind: task-notification`), `<ci-monitor-event>`,
`<cross-session-message>`, `<bash-input>`/`<bash-stdout>`. A forked session's file
replays its parent's records first, so the session id is the last `sessionId` in the
file, not the first, and only the fork's own records are counted.

More things real transcripts do (verified on macOS, September 2026):

- **Resume copies.** Resuming can write a second transcript with a new `sessionId` on
  every record and the same message `uuid`s. Two files whose first human record has the
  same `uuid` are one conversation; the copy that ran longest is kept.
- **Headless pings.** Scripts and apps check that `claude -p` answers by sending one
  short word (`entrypoint: sdk-cli`, one prompt under 12 characters, no tools). Dropped.
- **Duration** is active time: gaps between consecutive records, ignoring any gap over
  15 minutes. Desktop sessions stay open for days, so first-to-last is not time spent.
  Sources without per-record timestamps (both exports, `chatgpt-app`, `claude-chat`, the
  Claude cloud list, Codex cloud) get `duration_minutes: null` rather than the created-to-updated
  span. `profile.json` sums hours over the sessions that have a duration
  (`totals.sessions_timed`).
- **Listing-only sources have no message counts.** The Claude cloud list, `claude-chat`
  and `codex cloud list` give a title, a summary at most, and timestamps, so
  `messages_user` and `messages_assistant` are null (shared as blank), not a placeholder.

## Codex rollouts: skills, plugins, scheduled tasks (desktop build 0.155, macOS, September 2026)

Record types: `session_meta`, `event_msg`, `response_item`, `world_state`, `turn_context`,
`token_usage_record`. What the agent did is on `event_msg` / `item_completed` items:
`UserMessage`, `AgentMessage`, `Reasoning`, `CommandExecution` (`command`, `cwd`,
`parsed_cmd[]`, `exit_code`, ...), `McpToolCall` (`server`, `tool`, `pluginId`, ...),
`Extension` (`kind: "web.search"`). The matching `response_item` is a `custom_tool_call`
named `exec` for all three, so it is dropped whenever items name the tools.

- **Skills.** There is no skill item type and no skill field on a turn. The skills list
  reaches the model in `world_state.state.host_skills.body` (every installed skill, so
  not a usage signal), and the model uses a skill by reading its file: a
  `CommandExecution` whose `parsed_cmd[]` holds `{ type: "read", name: "SKILL.md", path }`.
  Skills roots seen: `~/.agents/skills/<skill>/`, `~/.codex/skills/.system/<skill>/`,
  and for plugin skills `~/.codex/plugins/cache/<marketplace>/<plugin>/<version>/skills/<skill>/`.
  The parser looks for a `SKILL.md` under a `.codex` or `.agents` folder in
  `parsed_cmd[].path` and the command (CLI builds: the `function_call` arguments) and
  keeps only the folder name: `<skill>`, or `<plugin>:<skill>` under a plugin cache, the
  same convention as Claude. A `SKILL.md` anywhere else is a file in the person's
  project and is ignored. Commands and paths are never stored; every
  `CommandExecution` is the one tool `shell`.
- **Plugins.** `McpToolCall.pluginId` is `<plugin>@<marketplace>` (seen:
  `codex-app-tools@openai-bundled`). It is recorded in `skills` as `plugin:<plugin>`,
  marketplace dropped, so a plugin used only through its MCP tools still shows up.
  A plugin skill read gives `<plugin>:<skill>` (seen: `visualize:visualize` from
  `openai-bundled`; a system skill reads as plain `openai-docs`).
- **Scheduled tasks (automations).** Two signals set `trigger: scheduled`,
  `mode: routine`: the thread id is listed in `sqlite/codex-dev.db`
  (`automations.target_thread_id`, or `automation_runs.thread_id`), or
  `session_meta.payload.thread_source` matches `automation|schedul` (seen values:
  `user`, `guardian_review`). The `target_thread_id` path is verified on a real
  scheduled task: an automation of `kind: "heartbeat"` has `target_thread_id` set, fires
  into that existing thread every time, and writes no `automation_runs` row, so that one
  long-lived thread counts as one scheduled session. The `automation_runs` path is
  unverified. Only those id columns are selected; `prompt`, `name` and titles are never
  read. Needs `node:sqlite` (Node 22.5+); older Node skips the lookup.
- **Connector names.** claude.ai connectors appear as `mcp__<uuid>__tool`. The desktop
  state files' `remoteMcpServersConfig[] { uuid, name }` maps them to names; without the
  desktop app the uuid is kept.

## When a format changes

These files are internal to their products and change without notice. When a source is
found but yields 0 sessions, or numbers look wrong:

```
node scripts/how-i-ai.mjs inspect "<one file>"
```

prints the key structure with no values. Adapt the matching function in
`scripts/lib/sources.mjs`, run `bash tests/run.sh`, and open a pull request with the
fixture updated in `tests/make-fake-home.mjs`.
