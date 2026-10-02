# Voiceover script: Build Loops + AI Hackathon

Three slides, roughly 5 minutes with the opener. The slide sections are also in each slide's speaker notes. The opener is spoken before anything is on screen.

---

## Before the slides (nothing on screen yet)

Before I show you anything, I want to tell you what I'm actually after.

My goal is to get value into our users' hands as quickly as we possibly can. That's it. Everything I'm about to say is in service of that one thing.

And here's what I keep coming back to. We are a very smart, very talented team. I'd put us up against anyone. But I think we're capable of shipping faster than our process lets us. Not faster than we're capable of. Faster than the process allows. The process is getting in the way, and the process is the one thing we can actually change.

So I have a what-if. I don't know if it works. I want to try it with you for a day.

This is not me saying we're slow, and it's not about replacing anyone. It's an invitation. Let me show you.

*(Open slide 1.)*

---

## Slide 1: The loop is clear for AskTPG. What about everything else?

The idea is a radical change to how we build. Instead of designing features, we design loops, and then we let the loop run.

The left side is a loop we can already picture, because AskTPG has evals. Production traffic comes in and every request leaves a trace. An agent watches the traces and runs our evals against them: quality evals on the answers, tool evals on the tool calls, search evals on the searches, router evals on the routing decisions. When one fails, the agent files the issue, opens a PR with a fix, and the tests run with the evals as the gate. Then, for the first time in the whole loop, a human shows up: we review. It ships, and the next requests feed the loop again.

There is a second door into the same loop: a ticket tagged "agent ready" gets picked up and lands in the same place, a PR waiting for us.

Now the right side, which is the honest part. Most of what we build is not that. New features. UI adjustments. Design work. What triggers the agent there? What gates the PR when there is no eval to fail? Where does a designer sit in a loop that opens its own PRs? I do not know. I can see it clearly for AskTPG, and I cannot see it yet for the rest.

That is the question. And rather than answer it on a whiteboard, I would like us to answer it by trying. That is what the hackathon is for. Next slide.

---

## Slide 2: One day, three teams, one product each

Here is how I would like to answer that question: an AI hackathon. One day, three teams, and every team ships one product.

The brief is open on purpose. Pick any customer pain point you care about, and it does not have to be in AskTPG. The one rule on the product is that it has to help the user complete an action or a task. Not learn something, not get an insight. Finish something. And the thing I actually want to see at the end is the loop you used to build it.

Three teams, and each one has a designer, a front-end dev and a back-end dev. The design team is in from the start, because "where does design fit" is half the question from the last slide, and nobody but a designer can answer it. Alexandra and I are shared across all three teams, so pull us in whenever you need us.

Spend real time on the plan before anyone writes code. Decide the promise your product makes, who you are targeting, your definition of done, and break the work down so three people can run in parallel. A good plan will take you far, and it is also where you decide what your process is going to be: what the agents do, what the humans do, and where the loop closes.

Then build, and build in tpg-web. This is not a sandbox. The bar is: if we got approval tomorrow, this would be ready to go live.

At the end of the day, we share. Two things from each team: the product, and the process you used to get there. The process is the real output. The product is the proof.

To be honest about what I want out of this: I want us to see how quickly we can get real value to a user, and I want it to feel good. It is a what-if, for one day. If it does not work, we have learned something. If it does, we have a new way to build.

So that is the ask. One day, three teams, something a customer could use by the end of it. I do not have the answer to the question on the first slide, and I would rather we find it by building than by debating it.

*(Open slide 3.)*

---

## Slide 3: What is the first thing you would want to try?

So let me ask you: what is the first thing you would want to try?

*(Then stop talking. Let the silence sit. The first two or three answers are your team leads for the day, and the conversation turns from a pitch into planning on its own.)*

*(If nobody speaks, pick a designer and ask them where they would want to sit in the loop. That is the open question from slide one, and they are the only ones who can answer it.)*

---

## Only in the voiceover (kept off the slides)

- "We are smart and talented, the process is in the way." Said to faces, not printed.
- "Radical change" framing. The slide says "what-if"; you can be bolder in the room.
- "Not about replacing anyone." Said once in the opener, then left alone. Over-explaining it sounds like a denial.
- "I do not know." The slide poses the question; you own not having the answer.
- Encoding the guidelines is most of the work, and design owns part of it.

## Placeholders to confirm

- `[date]` on slide 2's eyebrow and in slide 3's pills.
- Slide 2 says "Alexandra and Mohamed float across all three". Swap to "Alexandra and I" if you present it yourself.
- Slide 3 is a closing question card. Drop it if you want to ask the question with the room lights up instead.
