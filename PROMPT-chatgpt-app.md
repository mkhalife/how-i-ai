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

1. Call `list_threads` and keep paging until the entries are older than 30 days. Keep
   entries whose `kind` is `chatgpt`. Skip `kind: codex`: those are local files the
   scripts already read.
2. For each kept conversation call `read_thread` for its first page of turns. Take the
   first message the person wrote, their second message if there is one, how many
   messages each side wrote (the counts the tool gives you; do not page through a long
   conversation to count), the model, and any tool names that appear.
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

The tool's field names may differ from the ones above; map them. If `read_thread`
fails for a conversation, keep the entry with its title and times and leave
`first_message` empty. This file is private: it stays in `~/how-i-ai-chatgpt/inbox`, the
same as an export zip, and is never shared, committed, or pasted anywhere.

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
