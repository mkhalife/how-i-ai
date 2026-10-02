# Build Loops Hackathon pitch

Three slides and a voiceover script for pitching a one-day AI hackathon to the team.
The pitch: we can picture an agent-run build loop for AskTPG (traces in, evals, a PR,
one human review). We cannot yet picture it for new features, UI changes or design work.
The hackathon is how we find out.

Not related to the rest of this repo. It lives here because the cloud session that
made it needed a repo, and the slides borrow the wrapped template's look (black card,
heavy type, lime accent).

## Present it

Open `deck.html` in a browser. It is one self-contained file: arrow keys or a click move
between slides, `N` shows the speaker notes under the slide, `F` goes fullscreen, and the
slide number is in the URL (`deck.html#2`) so a shared link can open on a slide. It loads
DM Sans and JetBrains Mono from Google Fonts when online and falls back to the system sans
offline.

## Files

| File | What it is |
|---|---|
| `deck.html` | The deck as one standalone HTML file, to present or share |
| `voiceover.md` | The full script: a pre-slides opener, one section per slide, the close, and the lines kept off the slides on purpose |
| `deck/deck.json` | The deck index: slide order, sections, typefaces |
| `deck/slides/loop.html` | Slide 1: the loop is clear for AskTPG, open question for everything else |
| `deck/slides/hackathon.html` | Slide 2: one day, three teams, one product each |
| `deck/slides/ask.html` | Slide 3: the closing question |

The live deck is a Claude Slides artifact: https://claude.ai/artifact/HRMBT9Km9JfbDEhnLBZ22M
(private until shared). The slide files are that artifact's source, in its slide format:
one `<section>` per slide on a 1920x1080 canvas, inline styles only, speaker notes in a
trailing `<aside>`. They are not standalone web pages.

## Placeholders

- `[date]` on slides 2 and 3.
- Slide 2 says "Alexandra and Mohamed float across all three". Swap to "Alexandra and I"
  when Mohamed presents.
