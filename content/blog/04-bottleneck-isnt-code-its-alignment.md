# The Bottleneck Isn't Code Anymore. It's Alignment.

We spent a year building what we thought was a code review tool. We were wrong. We were solving the thing upstream of code review, and we didn't have a name for it until last week. If you've shipped with an AI agent in the last six months, some of this will be uncomfortably familiar.

## The thing nobody is measuring

Here's a question. In your last sprint, how many of your bugs came from incorrect code?

Now: how many came from *correct code that did the wrong thing*?

If your team is anything like ours, the second number is bigger. The public numbers say it's not just us. Stack Overflow's 2025 developer survey found that 66% of devs name "AI solutions that are almost right, but not quite" as their top frustration, ahead of hallucination, latency, and cost. LinearB's analysis of 8.1 million PRs in 2026 found PR volume up 98% year over year and review time up 91%. The work didn't get faster. It moved.

What we had to undo across four months of agent-assisted work was mostly technically working software that didn't match what the team thought it would do. The agent had been handed the wrong spec. The PR had been "reviewed" by a human who skimmed 600 lines because they trusted the agent. The reviewer and the author had different mental models, and neither knew it until production.

This isn't a model-quality problem. The code compiled, the tests passed, the diff was clean. The problem was earlier, in the layer where humans were supposed to mean the same thing as each other before any of this got written. That layer has no tools.

## Why "code review" stopped working

Code review was built for an era where humans wrote slowly and reviewed fast enough. The reviewer's mental model and the author's overlapped by default because both were bottlenecked by the same thing: human typing speed.

Agents broke that. Now the author can produce 4,000 lines in an afternoon, and the reviewer is still running at human speed. One of three things happens:

1. The reviewer skims and rubber-stamps. The bug ships three weeks later.
2. The reviewer actually reads it, burns half a day, and the next time the author asks for review they hesitate. We started calling this burning social capital. Once you have a name for it you see it everywhere. Asking for review currently burns significant time and resources, and the asker pays the social half of that bill whether they realize it or not.
3. The reviewer pushes back on style, because that's the only thing they have time to verify, and the substantive disagreement, *should this even exist*, never gets surfaced.

None of those are review. They're theater built on a contract that no longer holds.

## The diagnosis

We kept circling the same observation in huddles: most developers believe they understand their code, but actually lack a comprehensive view. That used to be a soft truth. Now it's the failure mode. Engineers ship things they couldn't reconstruct on a whiteboard because they didn't write them. An agent did, in a window they didn't fully read.

The honest version: coding has been mostly solved. Not perfectly, but well enough that the agent's first draft is closer to working than a junior engineer's was a year ago. What hasn't been solved is *alignment*: the shared understanding between two or more humans about what the system should do, why, and what counts as evidence it does.

The bottleneck moved. It used to be in your IDE. Now it's in the conversation that should have happened before anyone opened an IDE. Or, as one of us put it three huddles ago: now that coding has been solved, code trails will solve alignment to make dependable software factories possible.

The corollary we keep coming back to: once you align on intent, the implementation is straightforward for the agent. Most of the value, going forward, is upstream of the agent, not inside it.

## We're not the only ones who noticed

A quiet convergence happened in late 2025 and early 2026. GitHub shipped Spec Kit. OpenAI's Symphony work pushes the same direction. Claude Code's plan mode is the same instinct from a different angle. The shared premise: write the spec carefully and the agent's output stops being a coin flip.

Spec-driven development is correct *and incomplete*. It puts the human in the loop at the top of the funnel, before code exists. But the failure mode we keep hitting isn't "the spec was bad." It's that the spec, the implementation, and the team's mental model drift apart between Tuesday's commit and Friday's review, and no artifact carries the receipt of which human stood behind which decision along the way.

A spec is a contract *before* the work. A trail is a contract *during and after* it. You need both. The open question is which one is load-bearing.

## What we built

We built code trails. We've been describing them internally as a collaboration primitive, not a tool you bolt onto an existing workflow but a unit two engineers can both stand on. A trail is a small, opinionated artifact somewhere between a design doc, a PR description, and a code walkthrough. The agent generates it. A human then edits and signs it before anyone else reads it, marking which claims they personally verified. The agent fills in the rest.

The format isn't the interesting part. The contract is. When you open a trail, you see which sentences a human stood behind and which ones the agent produced unsupervised. That's the whole moat. A small, visible difference between human-verified content and machine-drafted content, inside one document where decisions actually get made. We're pitching it as a new way to collaborate with software. The preposition matters, *with*, not *on*, because the software is now one of the parties at the table.

If we're honest about what this solves, it's not code review. It's solving organizational alignment, not just traditional code review. The point is to help teams quickly understand project intent and maintain momentum in collaborative environments, which is the unsexy long-form way of saying: stop shipping things you didn't agree on.

It feels less like a documentation tool and more like a chat primitive. You generate one, paste a link in Slack, and a teammate reacts in 90 seconds instead of being yanked into a meeting. The high-cost part of asking happens while you're doing something else. The reviewer isn't being asked to dig. They're being asked to nod, push back, or steer.

Three things we didn't expect:

- **Seniors stopped being the bottleneck.** Not because they got faster, but because pinging them got cheap and the signal-to-noise of what hit their inbox went up.
- **Juniors asked more, not less.** Each ask got cheaper, the reputational cost dropped, the floor of the team rose.
- **Cross-team review actually happened.** A trail carries its own context, so it crosses team boundaries cheaply. Three cross-team moments last month that would have been meetings, weren't.

## What we still don't know

- **Monorepos at scale.** Our largest test repo is ~250k LOC. We don't know what the trail UX looks like at 10M.
- **Adversarial use.** What stops someone from rubber-stamping trails the way they currently rubber-stamp PRs? We have hypotheses, not proof.
- **Is the load-bearing primitive the spec (Spec Kit) or the trail (us)?** Both are bets on where to put the human. The data so far says it's not the PR.

We'll be wrong about some of this. The interesting thing is we'll be wrong about *which part*, not whether the underlying shift is real. Anyone shipping with agents has felt it.

## The bet, stated plainly

The next decade of dev-tool value isn't in writing code faster. It's in compressing the distance between *I wrote this* and *we ship this* without losing the part where a human had to sign. Whoever builds the surface for that gets the contract for how teams ship software in the agent era.

We think it's a trail. It might be something else. Either way, it's not a review tool. It's an asking tool, and the asking tool is the one that's missing.

If you've shipped through this same shift and seen something we haven't, we'd like to hear it. We're at the stage of the problem where we're more interested in being corrected than agreed with.
