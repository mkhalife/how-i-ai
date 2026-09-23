# ai-wrapped (one prompt, nothing to install)

Paste this into Claude Code (Claude Desktop's Code tab or a terminal), a new claude.ai/code
session, Claude chat, or a new task in the ChatGPT desktop app. The AI wrapped page,
https://mkhalife.github.io/how-i-ai/wrapped/, opens each of those with it already typed.
The two links inside point at the skill file with the full rules and the deck template.

```
Show me how I actually used AI in the last 30 days, as a wrapped-style slide deck. Work here, from my own sessions. Nothing leaves this machine, and the deck holds paraphrases, never my prompts.

1. Pull my sessions from the last 30 days from whatever you can reach where you run: Claude Code transcripts in ~/.claude/projects, Cowork sessions in Claude Desktop's local-agent-mode-sessions folder, list_sessions if you are a claude.ai/code session, recent_chats if you are Claude in chat, Codex sessions in ~/.codex, or the ChatGPT app's thread tools. Per session keep the first message, a little context, message counts, timings, tools, skills, agents and model. Skip sources you cannot reach; do not ask.

2. Classify every session: category (the job, Title Case, reuse names; start from Build & ship code, Debug & fix, Review & explain code, Automate & ops, Write & edit, Communicate & coordinate, Research & synthesis, Analyze data, Plan & prioritize, Design critique & feedback, Prototype & build, Explain & learn, Brainstorm & ideate, Personal & life admin, Career & growth), assist type (ask: I wanted information or a critique; make: I wanted an artifact; do: you took actions), a one-line paraphrase with no names, identifying numbers, secrets or quotes, a surprise flag, and a confidence.

3. Compute the numbers and write profile.json in the exact schema in section 4b of https://raw.githubusercontent.com/mkhalife/how-i-ai/main/plugins/how-i-ai/skills/ai-wrapped/SKILL.md (sections 2 and 3 there carry the full classification and stats rules; read them).

4. Download https://raw.githubusercontent.com/mkhalife/how-i-ai/main/plugins/how-i-ai/skills/how-i-ai/templates/profile-wrapped.html, inject the JSON at its __HOW_I_AI_DATA__ placeholder the way section 4c of that skill file shows, save the result as ai-wrapped.html, and open it.
```
