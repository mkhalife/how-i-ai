# how-i-ai (run without installing the plugin)

You are running **how-i-ai**: show how this person actually uses AI, from their own
Claude session history (Claude Code and Cowork on this machine, plus the Claude chat and
cloud session lists and a claude.ai export when they are in the inbox). Follow every step.
Nothing leaves the machine unless the person explicitly says yes to a preview of exactly
what would be shared.

## 1. Get the scripts

Pick whichever works on this machine. The result must be a folder containing
`plugins/how-i-ai/skills/how-i-ai/SKILL.md`.

macOS / Linux (bash or zsh):

```bash
mkdir -p ~/how-i-ai && if command -v git >/dev/null; then
  ( [ -d ~/how-i-ai/repo/.git ] && git -C ~/how-i-ai/repo pull --ff-only -q ) || git clone -q --depth 1 https://github.com/mkhalife/how-i-ai ~/how-i-ai/repo
else
  mkdir -p ~/how-i-ai/repo && curl -fsSL https://codeload.github.com/mkhalife/how-i-ai/tar.gz/main | tar -xz --strip-components=1 -C ~/how-i-ai/repo
fi && echo ready
```

Windows (PowerShell):

```powershell
New-Item -ItemType Directory -Force "$HOME\how-i-ai" | Out-Null
if (Get-Command git -ErrorAction SilentlyContinue) {
  if (Test-Path "$HOME\how-i-ai\repo\.git") { git -C "$HOME\how-i-ai\repo" pull --ff-only -q } else { git clone -q --depth 1 https://github.com/mkhalife/how-i-ai "$HOME\how-i-ai\repo" }
} else {
  New-Item -ItemType Directory -Force "$HOME\how-i-ai\repo" | Out-Null
  curl.exe -fsSL https://codeload.github.com/mkhalife/how-i-ai/tar.gz/main -o "$env:TEMP\how-i-ai.tgz"
  tar -xzf "$env:TEMP\how-i-ai.tgz" --strip-components=1 -C "$HOME\how-i-ai\repo"
}
"ready"
```

Node 18+ is required (`node --version`). If it is missing: macOS `brew install node`,
Windows `winget install OpenJS.NodeJS.LTS`, or https://nodejs.org.

## 2. Follow the skill

Read `~/how-i-ai/repo/plugins/how-i-ai/skills/how-i-ai/SKILL.md` and follow it from step 0,
with `SKILL_DIR` = `~/how-i-ai/repo/plugins/how-i-ai/skills/how-i-ai`. It will ask the
person's title and function, inventory their sessions, have you classify them using
`references/classification-guidelines.md`, write the narrative, render the profile, and
only then ask whether to share anonymized rows after showing the exact preview.

Two files add history this machine does not hold, each listed by another Claude surface.
Step 2 of the skill runs `gather`, which opens both surfaces with the prompt filled in and
moves the two downloads into `~/how-i-ai/inbox`; if they do not arrive, continue without
them.

- `claude-chat-threads.json`: their claude.ai chats, listed by Claude in Chat mode
  (`PROMPT-claude-chat.md`, or the "Claude chats" card on the landing page).
- `cloud-sessions.json`: their Claude Code cloud sessions, listed by Claude inside a
  claude.ai/code session (`PROMPT-claude-cloud.md`, or the "Claude Code on the web" card).

## 3. If you are the agent inside the ChatGPT desktop app

Use `PROMPT-chatgpt-app.md` from the same repository instead. It is the ChatGPT entry
point: it covers the person's ChatGPT conversations and Codex sessions, works in its own
folder (`~/how-i-ai-chatgpt`), and is run separately from this one.

## 4. If you cannot run shell commands here

You are in a chat-only surface (claude.ai chat, ChatGPT). Use `PROMPT-chat.md` from the
same repository instead: https://raw.githubusercontent.com/mkhalife/how-i-ai/main/PROMPT-chat.md
