# how-i-ai, from inside the ChatGPT desktop app

You are an agent running in the ChatGPT desktop app (the merged ChatGPT and Codex app) on
this person's work machine, with shell access. You are running **how-i-ai**: show how
this person actually uses AI, from their own session history. This is the ChatGPT
entry point: it covers their ChatGPT conversations and Codex sessions, and everything it
writes lives in `~/how-i-ai-chatgpt`. You are the only agent that can list their ChatGPT
conversations, so that part is yours; the scripts do the rest. Follow every step.
Nothing leaves the machine unless the person explicitly says yes to a preview of exactly
what would be shared.

## 1. Get the scripts

The result must be a folder containing `plugins/how-i-ai/skills/how-i-ai/SKILL.md`.

macOS / Linux:

```bash
mkdir -p ~/how-i-ai-chatgpt/inbox && if command -v git >/dev/null; then
  ( [ -d ~/how-i-ai-chatgpt/repo/.git ] && git -C ~/how-i-ai-chatgpt/repo pull --ff-only -q ) || git clone -q --depth 1 https://github.com/mkhalife/how-i-ai ~/how-i-ai-chatgpt/repo
else
  mkdir -p ~/how-i-ai-chatgpt/repo && curl -fsSL https://codeload.github.com/mkhalife/how-i-ai/tar.gz/main | tar -xz --strip-components=1 -C ~/how-i-ai-chatgpt/repo
fi && echo ready
```

Windows (PowerShell):

```powershell
New-Item -ItemType Directory -Force "$HOME\how-i-ai-chatgpt\inbox" | Out-Null
if (Get-Command git -ErrorAction SilentlyContinue) {
  if (Test-Path "$HOME\how-i-ai-chatgpt\repo\.git") { git -C "$HOME\how-i-ai-chatgpt\repo" pull --ff-only -q } else { git clone -q --depth 1 https://github.com/mkhalife/how-i-ai "$HOME\how-i-ai-chatgpt\repo" }
} else {
  New-Item -ItemType Directory -Force "$HOME\how-i-ai-chatgpt\repo" | Out-Null
  curl.exe -fsSL https://codeload.github.com/mkhalife/how-i-ai/tar.gz/main -o "$env:TEMP\how-i-ai.tgz"
  tar -xzf "$env:TEMP\how-i-ai.tgz" --strip-components=1 -C "$HOME\how-i-ai-chatgpt\repo"
}
"ready"
```

Node 18 or newer runs the scripts. Try `node --version`. If there is no `node` on PATH,
this app ships one: macOS `/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node`;
on Windows look for `cua_node\bin\node.exe` under the app's `resources` folder. Use its
full path in place of `node` everywhere below. Only if neither exists: macOS
`brew install node`, Windows `winget install OpenJS.NodeJS.LTS`.

## 2. List the ChatGPT conversations (only you can do this)

Use this app's own tools, `list_threads` and `read_thread` (they may appear with a
`codex_app` prefix). If they are not available in this session, say so, skip to step 3,
and the person's ChatGPT history will come from the data export instead.

1. Call `list_threads` with `limit: 50` (the maximum in the verified build).
   `limit` is its only argument; there is no cursor or paging argument. Its payload
   contains `threads[]` (non-pinned entries in recency order) and `pinnedThreads[]`
   (all pinned entries, separate from `threads[]`). Combine those arrays and dedupe
   by `id`. `sections[]` contains `sectionId`, `name`, and `itemKeys`, not conversation
   objects. Entries expose `id`, `kind`, `title`, `updatedAt`, `summary`, and `status`;
   other fields may depend on `kind`. Keep `kind: "chatgpt"` entries whose `updatedAt`
   is within the last 30 days. Skip `kind: "codex"`; the scripts collect Codex
   separately. Check `unavailableHosts` and `unavailableSources` and report any
   incomplete coverage. There is no `nextCursor` or `hasMore` in this listing: if
   the non-pinned limit is reached before older entries appear, report that the
   30-day inventory may be incomplete. Do not claim complete account history.
2. For each kept conversation call `read_thread` with `threadId: <id>` and
   `turnLimit: 10` (the maximum in the verified build). The other supported arguments
   are `cursor`, `hostId`, `includeOutputs`, and `maxOutputCharsPerItem`; use `hostId`
   only when supplied by the listing. `maxOutputCharsPerItem` controls truncation,
   not message counts. There is no `order` or oldest-first argument.

   The payload contains `thread` (`id`, `title`, `createdAt`, `updatedAt`), `turns[]`
   (`id`, `startedAt`, `items[]`), and `page` (`order`, `limit`, `nextCursor`,
   `hasMore`). The verified order is `newest_first`. To reach the opening, pass
   `page.nextCursor` as the next call's `cursor`, keeping `threadId` and `turnLimit`,
   while `page.hasMore` is true, for at most five pages including the initial page.
   Stop on an error, an absent cursor, or a repeated cursor and mark that read
   incomplete. Do not reuse a cursor from another conversation.

   Deduplicate turns by `turns[].id`, sort them by `startedAt` ascending, and preserve
   the order of `items[]` within each turn. The person's message item has
   `type: "userMessage"` and text in `content[].text` for blocks with `type: "text"`.
   The assistant's message item has `type: "agentMessage"` and text in `text`.
   Count message items, not turns or content blocks. Only when all pages were read
   from the initial page through `page.hasMore: false`, take the first and second
   user message in that chronological order and count each side's items for
   `messages_user` and `messages_assistant`. Otherwise leave both opening messages
   empty and both counts `null`; recent turns are not the opening. A failed page
   must not turn partial counts into totals.

   Map `created_at` to `thread.createdAt` and `updated_at` to `thread.updatedAt`;
   these timestamps were returned as epoch seconds. If reading fails, keep the
   listing's `updatedAt` and use `null` for unavailable `created_at`. No total-count
   or model field appeared in the verified ChatGPT responses: use `model: null`.
   No tool-call item schema was verified either. Use `tools: []` unless actual
   tool names are explicitly exposed in a response; `userMessage` and
   `agentMessage` are item types, not tool names. Do not infer tools from prose.
3. Write `~/how-i-ai-chatgpt/inbox/chatgpt-app-threads.json`. Use a script or your file
   tool; do not print the contents into this conversation.

```json
{ "source": "chatgpt-app", "exported_at": "2026-09-18T12:00:00Z",
  "threads": [ { "id": "<threadId>", "kind": "chatgpt", "title": "<title>",
    "created_at": "<ISO time or epoch seconds>", "updated_at": "<same>",
    "first_message": "<their first message, at most 2000 characters>",
    "second_message": "<their second message, at most 300 characters, or empty>",
    "messages_user": 3, "messages_assistant": 3, "model": "<model or null>", "tools": [] } ] }
```

Field names above are from the app build of September 2026; if yours differ, map them.
Add no other fields to the file. If `read_thread` fails for a conversation, or you
could not reach its first turn, keep the entry with its title and times and leave
`first_message` and `second_message` empty and both message counts `null`. This file
is private: it stays in `~/how-i-ai-chatgpt/inbox`, the same as an export zip, and is
never shared, committed, or pasted anywhere.

## 3. Follow the skill

Read `~/how-i-ai-chatgpt/repo/plugins/how-i-ai/skills/how-i-ai/SKILL.md` and follow it
from step 0, with `SKILL_DIR` = `~/how-i-ai-chatgpt/repo/plugins/how-i-ai/skills/how-i-ai`
and two changes:

- Add `--app chatgpt` right after `how-i-ai.mjs` in every command, for example
  `node SKILL_DIR/scripts/how-i-ai.mjs --app chatgpt collect --days 30`.
- Read `~/how-i-ai-chatgpt` wherever SKILL.md says `~/how-i-ai`.

`collect` picks up the file you wrote as the `chatgpt-app` source, next to the Codex
sessions on this machine, Codex cloud tasks, and a ChatGPT export zip if one is in
`~/how-i-ai-chatgpt/inbox`.

This run covers ChatGPT and Codex only. If the person also uses Claude, they run the
Claude entry point from Claude separately (`PROMPT.md`); it keeps its own folder and its
own id on the team sheet.
