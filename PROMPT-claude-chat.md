# how-i-ai: list my Claude chats (paste into claude.ai Chat, web or desktop)

Optional step before the main run. Claude in Chat mode lists your last 30 days of chats and gives you
`claude-chat-threads.json` as a download; save it to `~/how-i-ai/inbox` and the normal run (`PROMPT.md`) picks it up.

```
You are running the "Claude chat" step of how-i-ai, which shows me how I actually use AI. Your only job here: list my Claude chats from the last 30 days and give me one JSON file. Do not analyse anything, and do not print chat titles or summaries in your reply.

1. Call recent_chats with n=20. Keep calling it with before set to the earliest updated_at you have seen, until you pass 30 days ago or nothing new comes back (stop after 25 calls at most).
2. For every chat inside the last 30 days keep: url, updated_at, title, summary (the text the tool gave you, unedited, at most 600 characters).
3. Create a downloadable file named claude-chat-threads.json with exactly this shape:
{"source":"claude-chat","exported_at":"<now, ISO>","chats":[{"url":"...","updated_at":"...","title":"...","summary":"..."}]}
4. Reply with only: how many chats are in the file, the date range covered, whether you hit the call limit, and this instruction: "Save the file to the how-i-ai/inbox folder in your home folder, then run how-i-ai from Claude Code."
If recent_chats is not available, say so and tell me to turn on "Search and reference chats" in Settings, or to use Settings > Privacy > Export data instead.
```
