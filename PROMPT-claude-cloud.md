# how-i-ai: list my Claude Code cloud sessions (paste into a claude.ai/code session)

Optional step before the main run. Claude in a cloud session lists your last 30 days of cloud sessions and gives
you `cloud-sessions.json` as a download; save it to `~/how-i-ai/inbox` and the normal run (`PROMPT.md`) picks it up.

```
You are running the "Claude Code on the web" step of how-i-ai, which shows me how I actually use AI. Your only job here: list my Claude Code cloud sessions from the last 30 days and give me one JSON file. Do not analyse anything, do not comment on the contents, and do not print session titles in your reply.

1. Call list_sessions (from the Claude Code Remote tools) with mine=true and limit=100. While has_more is true and the oldest session you have seen is newer than 30 days ago, call it again with after_id set to the last_id of the previous response (stop after 10 calls at most).
2. For every session created or updated inside the last 30 days keep only: id, title, created_at, updated_at, environment_kind, origin, tags, configured_model, session_context.model, post_turn_summary.status_detail, post_turn_summary.recent_action. Drop every other field.
3. Write cloud-sessions.json with exactly this shape:
{"source":"claude-cloud","exported_at":"<now, ISO>","data":[{"id":"...","title":"...","created_at":"...","updated_at":"...","environment_kind":"...","origin":"...","tags":[],"configured_model":"...","session_context":{"model":"..."},"post_turn_summary":{"status_detail":"...","recent_action":"..."}}]}
4. Give me the file as a download if you can here; otherwise print its contents in one fenced code block and nothing else from it.
5. Reply with only: how many sessions are in the file, the date range covered, whether you hit the call limit, and this instruction: "Save the file as cloud-sessions.json in the how-i-ai/inbox folder in your home folder, then run how-i-ai from Claude Code."
If list_sessions is not available, say so: it only exists inside a Claude Code session on claude.ai/code.
```
