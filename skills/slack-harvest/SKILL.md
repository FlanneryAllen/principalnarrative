---
name: slack-harvest
version: 0.1.0
type: harvest
description: Pulls candidate narrative units from Slack channels, threads, and (opt-in) DMs.
requires:
  connectors: [slack]
  scopes:
    - channels:history
    - channels:read
    - groups:history
    - users:read
capabilities:
  - harvest.channels
  - harvest.threads
  - harvest.pinned
  - harvest.canvases
author: Principal AI
---

# Slack Harvest

Most orgs' narrative does not live on their website. It lives in #announcements, in the CEO's Friday update thread, in the pinned canvas at the top of #product, in the all-hands recap a VP drops every Monday.

This skill harvests that signal into candidate narrative units the agent can then validate, compose, and measure against canon.

## What it harvests

| Source | What we extract | Why it matters |
|---|---|---|
| Pinned messages | High-confidence canon candidates | Pinned = the team explicitly endorsed it |
| Channel descriptions / topics | Scope-defining units | Tells us how teams frame their own work |
| Canvas documents | Multi-paragraph narrative units | Long-form thinking, not just chatter |
| Threads from designated authors | Stakeholder-attributed units | CEO updates, VP threads, leadership posts |
| `/canon` slash command captures | User-submitted units | Explicit, in-the-flow contribution |

We deliberately do **not** harvest:

- Direct messages (unless user opts in per-channel)
- Reactions, emoji, ephemeral chatter
- Messages from bots (except first-party canon bots)
- Anything older than the workspace's configured `historyDays` (default 90)

## Configuration

```yaml
slack-harvest:
  channels:
    - id: C01ANNOUNCE
      authorWhitelist: [U_CEO, U_COO]  # only these users count
      type: core_story
      scope: company
    - id: C02PRODUCT
      type: tactical
      scope: product
  pinned: true
  canvases: true
  historyDays: 90
  dms:
    enabled: false  # explicit opt-in only
```

## Unit attribution

Every harvested unit carries:

- `author` — Slack user real name + title (from `users.info`)
- `authoredAt` — message timestamp
- `source.platform` — `"slack"`
- `source.channel` — channel ID + name
- `source.permalink` — deep link back to the message
- `source.thread_ts` — if from a thread, the parent thread

This is critical for **Ω Validate** attribution checks and for **δ Drift** to show "this claim originated here, last reaffirmed here."

## Output format

Returns an array of candidate units matching the agent's standard unit shape:

```js
{
  id: 'slack-C01ANNOUNCE-1731234567',
  type: 'core_story',           // inferred or from channel config
  assertion: '<harvested text>',
  scope: 'company',              // from channel config
  author: 'Sarah Chen, CEO',
  authoredAt: '2026-05-08T14:23:00Z',
  confidence: 0.7,               // raw harvest confidence (validation refines this)
  dependencies: [],              // detected via mention/quote → other unit IDs
  source: {
    platform: 'slack',
    channel: { id: 'C01ANNOUNCE', name: 'announcements' },
    permalink: 'https://acme.slack.com/archives/C01ANNOUNCE/p1731234567',
  },
  evidence_required: [],
  intent: { harvested: true, needsReview: true },
}
```

All harvested units enter the workspace with `intent.needsReview: true` — they don't enter canon automatically. A human (or the `auto-promote` skill, if installed) decides.

## Privacy & consent

- Workspace admin must explicitly authorize Slack connection
- Per-channel opt-in for harvest (no blanket workspace access)
- DM harvest requires per-user consent flow
- All harvested content stays in the workspace's storage; never sent to third parties
- Users can issue `/canon forget` in any channel to redact their messages from the harvest set

## Failure modes

- **Rate limited**: Slack API returns 429 → exponential backoff, resume from last successful ts
- **Permission revoked**: Skill marks itself `disabled`, surfaces a re-auth banner in the dashboard
- **Channel archived**: Existing harvested units retained; no new harvests; flagged in source health

## Why this is high-leverage

Without this skill, the agent only sees the version of the org's narrative that someone bothered to write down on the marketing site. With this skill, it sees the version the team actually uses with each other every day. That gap — between the polished narrative and the working narrative — is exactly what δ Drift was built to surface.
