# howiai (run without installing the plugin)

You are running **howiai**: show how this person actually uses AI, from their own
session history on this machine. Follow every step. Nothing leaves the machine unless
the person explicitly says yes to a preview of exactly what would be shared.

## 1. Get the scripts

Pick whichever works on this machine. The result must be a folder containing
`plugins/howiai/skills/howiai/SKILL.md`.

macOS / Linux (bash or zsh):

```bash
mkdir -p ~/howiai && if command -v git >/dev/null; then
  ( [ -d ~/howiai/repo/.git ] && git -C ~/howiai/repo pull --ff-only -q ) || git clone -q --depth 1 https://github.com/mkhalife/howiai ~/howiai/repo
else
  mkdir -p ~/howiai/repo && curl -fsSL https://codeload.github.com/mkhalife/howiai/tar.gz/main | tar -xz --strip-components=1 -C ~/howiai/repo
fi && echo ready
```

Windows (PowerShell):

```powershell
New-Item -ItemType Directory -Force "$HOME\howiai" | Out-Null
if (Get-Command git -ErrorAction SilentlyContinue) {
  if (Test-Path "$HOME\howiai\repo\.git") { git -C "$HOME\howiai\repo" pull --ff-only -q } else { git clone -q --depth 1 https://github.com/mkhalife/howiai "$HOME\howiai\repo" }
} else {
  New-Item -ItemType Directory -Force "$HOME\howiai\repo" | Out-Null
  curl.exe -fsSL https://codeload.github.com/mkhalife/howiai/tar.gz/main -o "$env:TEMP\howiai.tgz"
  tar -xzf "$env:TEMP\howiai.tgz" --strip-components=1 -C "$HOME\howiai\repo"
}
"ready"
```

Node 18+ is required (`node --version`). If it is missing: macOS `brew install node`,
Windows `winget install OpenJS.NodeJS.LTS`, or https://nodejs.org.

## 2. Follow the skill

Read `~/howiai/repo/plugins/howiai/skills/howiai/SKILL.md` and follow it from step 0,
with `SKILL_DIR` = `~/howiai/repo/plugins/howiai/skills/howiai`. It will ask the
person's title and function, inventory their sessions, have you classify them using
`references/classification-guidelines.md`, write the narrative, render the profile, and
only then ask whether to share anonymized rows after showing the exact preview.

## 3. If you cannot run shell commands here

You are in a chat-only surface (claude.ai chat, ChatGPT). Use `PROMPT-chat.md` from the
same repository instead: https://raw.githubusercontent.com/mkhalife/howiai/main/PROMPT-chat.md
