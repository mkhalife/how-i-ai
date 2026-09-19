# Classification guidelines

You are judging one session at a time from its first message, a little context (the
second message, tools used), and its source. Fill six fields. Consistency across a
person's sessions matters more than precision on any single one.

## category (free text, but disciplined)

What the person was trying to get done. Name the job, not the topic and not the tool.

- Title Case, at most 40 characters, a verb or a verb phrase where possible.
- Reuse a name you already used in this run whenever the job is the same. Aim for 6 to
  12 categories for a person; more than 15 means you are splitting hairs.
- Start from this list and add to it only when nothing fits. New names are welcome when
  they are honest; the team cleans the list up later.

| Starter category | Typical sessions |
|---|---|
| Build & ship code | add a feature, refactor, migrate, write tests, scaffold |
| Debug & fix | failing test, error message, incident, "why does this not work" |
| Review & explain code | PR review, "what does this do", architecture questions |
| Automate & ops | CI, scripts, infra, deploy, dev environment, cron |
| Write & edit | PRD, doc, spec, email, post, release notes, rewrite, shorten |
| Communicate & coordinate | Slack replies, meeting prep, status updates, talking points |
| Research & synthesis | summarize interviews, competitor scan, cluster feedback, literature |
| Analyze data | SQL, spreadsheets, experiment readouts, charts, metrics questions |
| Plan & prioritize | roadmap, sprint, OKRs, tradeoffs, decisions |
| Design critique & feedback | critique a flow, copy in the UI, accessibility, visual review |
| Prototype & build | prototype in code, design tokens, motion spec, demo |
| Explain & learn | "how does X work", concepts, terminology, tutorials |
| Brainstorm & ideate | names, options, angles, "give me ten ideas" |
| Personal & life admin | travel, family, health, money, home, hobbies |
| Career & growth | resume, interview prep, performance review, negotiation |

Edge cases:

- A session whose first message is a bare greeting or "test" but whose context shows the
  real ask: classify from the context.
- Scheduled or routine sessions: classify the job the routine does (a nightly PR review
  is Review & explain code).
- Only a title is available (cloud sessions): classify from the title, lower confidence.

## subcategory (free text, optional)

A short noun phrase, at most 40 characters, that would let a teammate find similar
sessions: "Failing test", "PRD", "Interview synthesis", "Travel". Null when nothing
useful comes to mind.

## assist_type (fixed: ask, make, do)

The question the team wants answered: is AI informing you, or is it doing things for you?

- **ask**: they wanted information, an explanation, advice, a recommendation, a
  second opinion, a critique of something that already exists. The output was words they
  read and then acted on themselves. "Explain OAuth", "which of these three is better",
  "review my plan", "critique this screen".
- **make**: they wanted an artifact produced and they took it: a doc, an email, a
  design, a plan, a spreadsheet, a chart, code they will paste in themselves, an image.
  "Draft a PRD", "write SQL for this", "turn these notes into a summary".
- **do**: AI took actions in tools or in the world: edited files in place, ran commands,
  opened a PR, sent or scheduled something, browsed and filed, changed settings. Most
  Claude Code, Codex, and Cowork sessions with tool use are `do`, unless the tools were
  only used to read and the answer was an explanation (then `ask`).

When a session mixes them, pick the one the person came for. "Explain this module, then
fix it" is `do`. "Fix it" that turned into a long explanation is still `do`.

## paraphrase (at most 120 characters)

A generic one-line description a stranger could read. This is the only free text that
may leave the machine, so:

- No names of people, companies, customers, products (internal or external), repos,
  files, or projects. "Add a feature flag to a checkout flow" not "Add a flag to
  Acme's checkout in payments-web".
- No numbers that identify anything (ticket ids, amounts, dates, addresses).
- No secrets, keys, URLs, emails, phone numbers.
- No quoting the prompt. Describe the job in your own words, present tense, imperative:
  "Draft a polite note to a landlord about repairs".
- Keep the interesting part. "Plan a 6-year-old's birthday on a budget" is a good
  paraphrase; "Personal task" is useless.

## surprise (true or false)

True when the session is outside what this person's role predicts, in either direction:
a designer prototyping in code, an engineer drafting a customer email, anyone using a
work tool for a personal thing, a use nobody on the team would guess. Not "unusual for
this person's month", but "would make a teammate say: you use it for that?". Expect 0
to 5 per person.

## confidence (0 to 1)

0.9 when the first message states the job. 0.6 when you inferred it from context or a
title. 0.4 when you are guessing. Below 0.4, still answer; the number carries the doubt.
