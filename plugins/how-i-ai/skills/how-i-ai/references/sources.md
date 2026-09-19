# Where sessions come from

`collect.mjs` looks in every place below. Paths use `~` for the home folder; on Windows
that is `%USERPROFILE%`. All parsers are in `scripts/lib/sources.mjs`.

| Source | Surface | Location | Status |
|---|---|---|---|
| `claude-code` | cli, ide, desktop, cloud (teleported) | `~/.claude/projects/<encoded-cwd>/<session>.jsonl` (or `$CLAUDE_CONFIG_DIR/projects`) | on disk, parsed |
| `claude-desktop` | desktop chat | macOS `~/Library/Application Support/Claude/local-agent-mode-sessions/`; Windows `%LOCALAPPDATA%\Claude\local-agent-mode-sessions\` (older builds `%APPDATA%`); Linux `~/.config/Claude/`. Also `Claude-3p` for managed installs | on disk, tolerant parser |
| `claude-cowork` | cowork | same folder; `local_<id>.json` state files plus per-session working dirs with `audit.jsonl` and transcripts | on disk, tolerant parser |
| `claude-code` cloud | cloud | not on disk. From inside a claude.ai/code session, the Claude Code Remote `list_sessions` tool lists them; save the output to `~/how-i-ai/cloud-sessions.json` | title and timestamps only |
| `codex` | cli, ide, desktop | `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl` and `~/.codex/archived_sessions/` (or `$CODEX_HOME`) | on disk, parsed |
| `codex` cloud | cloud | `codex cloud list --json` when the CLI is installed and signed in | title and summary only |
| `chatgpt-export` | export, gpt | zip from ChatGPT Settings → Data controls → Export data, dropped in `~/how-i-ai/inbox` | parsed from `conversations.json` |
| `claude-export` | export | zip from claude.ai Settings → Privacy → Export data, dropped in `~/how-i-ai/inbox` | parsed from `conversations.json` |
| `gemini-cli` | cli | `~/.gemini/tmp/<project>/chats/` | optional, tolerant |
| `chatgpt-desktop` | signal only | macOS `~/Library/Application Support/com.openai.chat/conversations-v2-*` and `-v3-*`; Windows `%LOCALAPPDATA%\Packages\OpenAI.ChatGPT-Desktop_*\LocalCache\Roaming\ChatGPT\` | installed, cached conversation count, last activity. No message bodies |

Not covered, on purpose: Cursor and Copilot (different product category), and any route
that scrapes a logged-in web session with cookies or tokens. Those unofficial routes
exist but they are against the products' terms and break without notice; the exports are
the supported path.

## Why ChatGPT is export-only (researched September 2026)

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
  `~/.codex`, plaintext and complete, which the `codex` parser already reads.
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

So the collector reports the ChatGPT desktop app as a signal (installed, cached
conversation count, last activity) and asks for the export for content.

## What is extracted per session

| Field | Claude Code | Claude Desktop | Codex | ChatGPT export | Claude export |
|---|---|---|---|---|---|
| id | `sessionId` | file name | `session_meta.payload.id` | `id` | `uuid` |
| started / ended | first and last `timestamp` | `createdAt`/`updatedAt` or file times | line timestamps | `create_time`/`update_time` | `created_at`/`updated_at` |
| first message | first `type:user` with human text, harness tags stripped | first user-role message | first `user_message` event (falls back to `response_item`) | first visible `author.role=user` node | first `sender=human` |
| context | second message, tools, branch | second message, audit tools | second message, tools | second message, custom GPT, tools | second message, tools |
| counts | human turns, distinct assistant messages | user and assistant entries | user events, assistant messages | visible user and assistant nodes | human and assistant |
| tools / connectors | `tool_use` names; `mcp__<server>__` → connector | `audit.jsonl` tool names | `function_call` names; MCP server | tool-author names, `code` parts → python | `tool_use` blocks |
| skills / agents | `Skill` tool `input.skill`; `/slash` commands that are not built-ins; `Agent` tool `input.subagent_type` (custom = not a built-in type) | n/a | n/a | n/a | n/a |
| model | most common `message.model` | if present | `turn_context.model` | `model_slug` | if present |
| mode / trigger | `origin.kind` (human vs routine); tool use → agentic | scheduled flag if present | tools → agentic | chat | chat |
| surface | `entrypoint` (cli, desktop, ide, remote → cloud) | desktop or cowork | `originator` | export or gpt | export |

Harness noise is removed before anything is counted: `<system-reminder>`, slash
commands, pasted-content wrappers, tool results, compaction summaries, sub-agent
transcripts (`agent-*.jsonl`, `isSidechain`).

## When a format changes

These files are internal to their products and change without notice. When a source is
found but yields 0 sessions, or numbers look wrong:

```
node scripts/how-i-ai.mjs inspect "<one file>"
```

prints the key structure with no values. Adapt the matching function in
`scripts/lib/sources.mjs`, run `bash tests/run.sh`, and open a pull request with the
fixture updated in `tests/make-fake-home.mjs`.
