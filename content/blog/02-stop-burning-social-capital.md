# Stop Burning Social Capital Every Time You Ask for a Review

Every engineer knows the feeling. You finish a piece of work, you need a second pair of eyes, and you hesitate. Not because you don't know who to ask — you know exactly who. The hesitation is something else: a calculated pause where you ask whether this review is *worth it*. Worth pulling them out of flow. Worth the Slack DM. Worth the favor you're spending.

That pause is the tax. And in our huddle this week, we put a name on it: burning social capital.

It's the currency of how teams ship. Every "got a sec?" is a withdrawal from an account you can't see and can't easily refill. Seniors feel it most — they're the bank everyone draws on, and they run dry quietly. Juniors hoard, because asking too often gets you a reputation, and a reputation costs more than a bug.

## The asymmetry in code feedback

Most code feedback today is asymmetric in a way nobody talks about. The asker burns a little capital. The answerer burns a lot — context-switching, pulling up the diff, paging in the system, then re-paging back into whatever they were doing.

So the asker over-prepares, or under-asks, or just doesn't ask. The team sees the *output* of that — slower reviews, longer PRs, design drift — but the actual cause is upstream. That asking for review currently burns significant time and resources is the real bug, and it's load-bearing for everything downstream.

We're pitching CodeTrails as a collaboration primitive precisely because that's where the leverage is. Not in the review surface. In the asking surface. The whole point of a code trail is that the high-cost part of review happens *before* anyone is asked. The trail does the work of explaining code clearly and quickly, allowing for easy sharing and rapid understanding. By the time a reviewer opens it, the context is already paged in for them. They're not being asked to dig. They're being asked to nod.

## Show, don't tell — applied to asking

We keep coming back to Frame.io as the model. Frame.io didn't make video review better by improving the comments. It made review *cheap to start*. Anyone with an opinion could leave one without scheduling a meeting, without burning a favor. We want the same physics for code. Show, don't tell. A trail you paste into a thread, a trail your teammate scrubs on their phone, a trail that earns its own context so the asker isn't apologizing for the ask.

This is what makes it a new way to collaborate with software — not a new review tool, a new *asking* tool. The thing that gets cheaper is the part before the review even starts.

## What goes up when the tax comes down

When the cost of asking drops, three things shift, and we've watched them shift on our own team:

- **Seniors stop being the bottleneck.** They react to a trail in 90 seconds instead of a 30-minute deep-dive. Their capital lasts longer.
- **Juniors ask more often.** Not because they're more confident — because each ask is cheaper. More reps, faster learning, the team's floor rises.
- **Cross-team review actually happens.** The hardest reviews to get are across team lines. A trail crosses that gap without needing a meeting.

That last one matters more than people realize. Most product bugs aren't bugs in code. They're bugs in alignment between teams who needed five minutes of each other's attention and couldn't afford it.

## The unsexy version of velocity

There's a glamorous version of dev productivity — agents that ship overnight, prompts that write themselves, IDEs that read your mind. Real stuff, we use it daily. But the unsexy version, the one that compounds quietly, lowers the cost of one engineer asking another for help. Most teams can't see how much capital they're burning on that single transaction. Once you do, you can't unsee it.

Stop burning social capital every time you ask for a review. Build the asking surface, not just the answering one. That's where the next decade of team velocity comes from.
