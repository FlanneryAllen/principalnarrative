# Pain-point validation: research summary

## Claim 1 — Reviewers can't keep up with AI-generated PR volume

**Verdict: STRONGLY VALIDATED. This is now a mainstream pain point with hard numbers.**

- [LinearB 2026 analysis of 8.1M PRs across 4,800+ orgs](https://dev.to/code-board/the-review-bottleneck-why-more-ai-code-means-slower-teams-in-2026-1e5n): high-AI teams merge **98% more PRs**, but **PR review time +91%**. Developers feel 20% faster, actually 19% slower. **39-point perception gap.**
- [Faros AI / 10,000+ developers](https://blog.logrocket.com/ai-coding-tools-shift-bottleneck-to-review/): 98% PR volume increase, 91% review time increase.
- [Byteiota / 2026 surveys](https://byteiota.com/developers-spend-11-4-hours-week-reviewing-ai-code/): developers now spend **11.4 hrs/week reviewing AI code vs. 9.8 hrs writing**. Verification > creation, for the first time.
- [r/ExperiencedDevs "AI Slop PRs are burning me and my team out hard"](https://www.reddit.com/r/ExperiencedDevs/comments/1kr8clp/ai_slop_prs_are_burning_me_and_my_team_out_hard/): 1,145 upvotes. Team of 6 getting ~30 PRs/day. 5,000-line PRs that should be <100. AuthZ bypassed by a "subtle middleware change with mocked tests."
- [r/ExperiencedDevs "How do you stop PR bottlenecks from turning into rubber stamping"](https://www.reddit.com/r/ExperiencedDevs/comments/1rv1ut2/how_do_you_stop_pr_bottlenecks_from_turning_into/): "800-line PR approved 'LGTM' within minutes, no comments." Direct confirmation of theater-review.
- [Eng Leadership newsletter "Code Review is the New Bottleneck"](https://newsletter.eng-leadership.com/p/code-review-is-the-new-bottleneck): "Engineers dread reviewing AI-generated code and often procrastinate when it comes to reviewing such PRs."
- [LinkedIn / Victor Proppe](https://www.linkedin.com/posts/victor-proppe_if-your-pr-has-more-than-400-lines-its-activity-7450860964125548545-fMgm): "If your PR has more than 400 lines, it's not a PR. It's a hostage situation."

**Implication for our post:** The "review bottleneck" claim is now table stakes — the audience already believes it. We don't need to convince them. We need to take a DIFFERENT angle on it, because everyone is writing about this.

---

## Claim 2 — AI code is correct-but-wrong; the bug moved upstream

**Verdict: VALIDATED. Stack Overflow has the canonical statistic.**

- [Stack Overflow 2025 Developer Survey](https://survey.stackoverflow.co/2025): **66% of developers** cite "AI solutions that are almost right, but not quite" as their #1 frustration. **45%** cite debugging AI code as more time-consuming.
- [Stack Overflow AI section](https://survey.stackoverflow.co/2025/ai): 46% actively distrust AI output, 33% trust. Only **3% "highly trust"**. Experienced devs are most skeptical (20% highly distrust).
- [LinkedIn "Why Your AI Coding Agent Keeps Getting It Wrong"](https://www.linkedin.com/pulse/why-your-ai-coding-agent-keeps-getting-wrong-d3mjc): "It will write something. It will look fine. Then you will find it inserts duplicates, has no access control, and talks to the wrong system — because none of that was in the spec." This is the *exact* framing we used.
- [LogRocket](https://blog.logrocket.com/ai-coding-tools-shift-bottleneck-to-review/): "You're not checking whether it works. You're checking whether it's over-engineered." Senior engineers spend **4.3 min** reviewing AI code vs. **1.2 min** for human code.

**Implication:** Our "correct code, wrong thing" frame is real and resonant. The 1:4 ratio I invented in the draft has a plausible basis in published data.

---

## Claim 3 — "Burning social capital" when asking for review

**Verdict: PARTIALLY VALIDATED. The phenomenon is real, the phrase is less common.**

- [Qase blog on code review alternatives](https://qase.io/blog/code-review-alternatives/): "Negative effects on social dynamics within your team... 23 minutes to switch contexts" per review interruption. "An hour of work lost just on context switching" per day.
- [r/cscareerquestions "How do I stop being afraid of code reviews"](https://www.reddit.com/r/cscareerquestions/comments/jqztd2/how_do_i_stop_being_afraid_of_code_reviews/): "Every time I push code for a review, I have a bad feeling in my stomach." Hundreds of upvotes. The emotional cost is widely felt.
- The exact phrase "burning social capital" doesn't have high SEO presence in dev discourse — which is actually GOOD for us. It's an undertapped framing.

**Implication:** The phenomenon is real and widely felt, but most writers describe it in terms of *time cost* or *anxiety*, not *social cost*. Our "burning social capital" framing is differentiated language for a felt-but-unnamed pain.

---

## Claim 4 — "Alignment, not coding, is now the bottleneck"

**Verdict: STRONGLY VALIDATED. This is the emerging consensus narrative.**

- [InfoQ on Agoda](https://www.infoq.com/news/2026/03/agoda-ai-code-bottleneck/): "AI Coding Assistants Haven't Sped up Delivery."
- [Engineering Leadership newsletter](https://newsletter.eng-leadership.com/p/code-review-is-the-new-bottleneck): "Agents can generate code, but getting it right for your system, team conventions, and past decisions is the hard part. The teams pulling ahead have an organizational context engine."
- [LinkedIn / spec-driven development](https://www.linkedin.com/pulse/why-your-ai-coding-agent-keeps-getting-wrong-d3mjc): "The entire ecosystem — GitHub Spec Kit, OpenAI Symphony, Claude Code plan mode — is converging on one idea: write a proper spec first, then let the agent implement it." → This is the SAME thesis as Fernando's "once you align on intent, the implementation is straightforward for the agent."
- [MIT News study on AI coding roadblocks](https://news.mit.edu/2025/can-ai-really-code-study-maps-roadblocks-to-autonomous-software-engineering-0716).
- [r/AgentsOfAI](https://www.reddit.com/r/AgentsOfAI/comments/1pypdud/seriously_explaining_code_mistakes_to_an_ai_feels/): top reply — "I typically draft a detailed specification and ensure that it comprehends the requirements and has a clear strategy before allowing it to start coding."

**Implication:** The "alignment is the bottleneck" thesis is becoming consensus. Spec-driven development (GitHub Spec Kit, OpenAI Symphony, Claude Code plan mode) is the explicit category. We are NOT contrarian by claiming this — we are aligned with where smart people are converging. That's good news for accuracy, but means we need a sharper *angle* on top of it.

---

## What this means for the HN draft

### Things to strengthen
1. **The 1:4 ratio.** Soft. Replace with cited stats: "Stack Overflow 2025: 66% of devs cite 'AI solutions almost right but not quite' as their #1 frustration. LinearB analysis of 8.1M PRs: review time up 91% even as PR volume rose 98%."
2. **The "burning social capital" framing.** Keep — it's our differentiator. But acknowledge the related but mainstream framing (context-switching cost, review fatigue, "vibe coding" backlash) so we don't seem ignorant of the literature.
3. **The "alignment is the bottleneck" thesis.** Already widely shared. Strengthen by naming the convergence (Spec Kit, Symphony, plan mode) and positioning code trails as a DIFFERENT shape of the same answer — humans-in-the-loop on the artifact, not just up-front on the spec.

### Risks an HN reader will flag
- **"Code trails" reads as a re-branded design doc / spec / RFC.** Need to be specific about what's different.
- **The "human-verified content as moat" claim is unfalsifiable.** Could be sharpened by describing what *technically* distinguishes a trail from a Notion doc with comments.
- **The 80%/1:4 ratio without source will get instantly challenged.** Replace.

### Angle that would actually pop on HN
Most posts in this space lead with "AI is breaking code review." That's the safe take. The sharper, more HN-friendly angle:

> "Everyone is treating this as a code review problem. It isn't. It's a code *asking* problem — the cost of one engineer pulling another engineer into a decision. Solve that and review becomes trivial. Don't solve that and no amount of AI review tooling will save you."

That's the post nobody else is writing yet. The data backs it. The "burning social capital" framing is the natural lede. And it preserves all 10 of your verbatim huddle anchors.

---

## Recommendation

The four huddle posts you have are all valid. The HN one is the one that benefits most from this research. Three concrete edits before publishing:

1. Replace the made-up 1:4 ratio with the LinearB 98%/91% stat + Stack Overflow 66%.
2. Insert one paragraph acknowledging the SDD / Spec Kit / Symphony convergence — then differentiate.
3. Sharpen the closing question: "Is the right primitive the spec (Spec Kit) or the trail (us)? We don't know yet, but the data says it's not the PR."

Want me to apply those three edits and re-score?
