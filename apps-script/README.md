# The team sheet

One Google Sheet, fronted by a tiny Apps Script web app, is where everyone's anonymized
rows land. Setting it up takes about five minutes and is done once by whoever owns the
sheet.

1. Create a new Google Sheet. Name it something like `how-i-ai · Product team`.
2. Extensions → Apps Script. Delete the sample code, paste `Code.gs`, save.
3. Optional but recommended: Project settings → Script properties → add `SHARE_KEY` with
   a random string. Only requests carrying that key can write or dump.
4. Deploy → New deployment → type **Web app**. Execute as **Me**. Who has access:
   **Anyone**. Deploy, authorize, copy the URL ending in `/exec`.
5. Put the URL (and the key, if you set one) in
   `plugins/how-i-ai/skills/how-i-ai/team.json` and commit:

   ```json
   { "team": "Product team", "share_url": "https://script.google.com/macros/s/…/exec", "share_key": "…", "window_days": 30 }
   ```

6. Test it: open `<url>?action=ping` in a browser. You should see `{"ok":true,…}`.

The script creates two tabs on first write: `participants` and `sessions`, with the
columns listed in `references/sharing.md`. Re-submissions replace that participant's
rows. Cells are written as plain strings (formula-looking values are prefixed with `'`),
so nothing in a paraphrase can execute in the sheet.

Share the sheet itself read-only with the team; the data is meant to be looked at
together. To remove someone, filter both tabs by their `participant_id` and delete the
rows.

## Building the report

```
node plugins/how-i-ai/skills/how-i-ai/scripts/how-i-ai.mjs aggregate --url "<share_url>"
```

then follow step 7 of `SKILL.md`. Without the endpoint, download both tabs as CSV and
use `--csv sessions.csv --participants participants.csv`, or point `--csv-dir` at a
folder of CSVs produced by the chat-only path.
