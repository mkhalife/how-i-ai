# Narrative guidelines

The numbers are in `profile.json` (or `aggregate.json`). The words go in
`narrative.json` (or `aggregate-narrative.json`). Write for the person, not about them.

## Profile

- **headline** (3 to 7 words): the shape of the month in one phrase. "A critic first,
  a builder second". "Ships by day, learns by night". Not a pun, not a stat.
- **summary** (2 to 4 sentences): what they mostly use AI for, whether AI informs them or
  does the work (use the ask/make/do split), where the sessions happen (which tools),
  and one thing about timing. Every sentence should be checkable against the numbers.
- **patterns** (3 to 5 items, each under 90 characters): observations that would make
  them nod. Day-of-week spikes, "ChatGPT for quick questions, Claude for long ones",
  "most agentic sessions start with a pasted error", "nothing on weekends", "reaches for
  the code-review skill before every push".
- **one_liner** (under 80 characters): the line on the share card. Plain, specific, a
  little proud. "Critiques with Claude by day, learns engineering vocabulary at night".
- **signature_move** (under 100 characters): the recurring habit visible in the first
  messages. "Pastes a screenshot and asks for a critique before asking for a fix".
- **surprise_why** (one sentence): why the surprise session stands out against the rest
  of the month. Refer to the paraphrase, never the raw prompt.

Say each thing once. No "overall", no "it is worth noting", no lists of every category.

## Aggregate

Same fields, plural subject:

- **headline**: the team-level shape. "Three functions, three relationships with AI".
- **summary**: biggest use case, the distribution (median vs the top few), how functions
  differ on ask/make/do, and the surprise use case.
- **patterns**: cross-function observations and one or two "learn from each other"
  pointers ("designers prototype in Cowork; engineers have not tried it").
- **one_liner**: "Engineers let AI do, designers ask it to look, PMs ask it to write".
- **surprise_use_case** (optional): override the automatic pick with the paraphrase that
  best earns the name.
