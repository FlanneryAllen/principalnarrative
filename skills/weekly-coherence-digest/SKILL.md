---
name: weekly-coherence-digest
version: 0.1.0
type: delivery
description: Scheduled weekly email summarizing NCI trend, top drift, and recommended actions.
requires:
  connectors: [email]
  schedule: cron
capabilities:
  - delivery.email
  - delivery.scheduled
  - delivery.digest
author: Principal AI
---

# Weekly Coherence Digest

A narrative platform that only lights up when someone opens the dashboard is a tool. A narrative platform that shows up in your inbox every Monday with what changed last week is **infrastructure**.

This skill turns the agent's continuous Resonate measurement into a weekly ritual: one email, every Monday at 8am local time, with the four things that matter.

## What the digest contains

```
┌─────────────────────────────────────────────┐
│  ACME — Weekly Coherence Digest             │
│  Week of May 6 – May 12, 2026               │
└─────────────────────────────────────────────┘

  ┌──── NCI THIS WEEK ────┐
  │     0.82  ↑ +0.04     │
  │  (vs. 0.78 last week) │
  └───────────────────────┘

  TOP DRIFT (3)
  ─────────────────────────────────────────────
  1. "We integrate with anything" — δ=0.31
     Originated Q3 by Sarah Chen, contested by
     3 engineering claims this week.
     [Review in dashboard →]

  2. ...

  COVERAGE GAPS (2)
  ─────────────────────────────────────────────
  • Customer support has no canon-aligned voice
    (κ score: 0.12 — was 0.31 last week)
  • New "Enterprise Tier" lacks attribution chain

  ACTIONS RECOMMENDED (5)
  ─────────────────────────────────────────────
  • [HIGH] Reconcile "integrate with anything"
    with engineering's "first-class integrations
    list" — owner: Sarah
  • [HIGH] Author canon unit for Enterprise Tier
    — owner: Product
  • [MED] ...

  WHAT CHANGED IN CANON
  ─────────────────────────────────────────────
  + 2 new units harvested from Slack
  ~ 1 unit updated (tf-positioning-wedge)
  - 0 units retired
```

The digest is intentionally short. Anything that needs depth links back into the dashboard.

## Configuration

```yaml
weekly-coherence-digest:
  schedule:
    cron: '0 8 * * 1'         # Mondays 8am
    timezone: America/Chicago
  recipients:
    - role: workspace_admin    # everyone with admin role
    - emails:                  # plus explicit additions
        - board@acme.com
  thresholds:
    drift_top_n: 3
    actions_top_n: 5
    coverage_gap_threshold: 0.5
  brand:
    logo_url: https://acme.com/logo.png
    primary_color: '#0a1628'
  comparison_window: 7d       # week-over-week
```

## How it computes the digest

The skill is purely a composer — it does not re-run any algebra. It reads:

1. **Current NCI snapshot** from `GET /api/workspaces/:id/metrics`
2. **Last week's snapshot** from `workspace.snapshots[<lastMondayISO>]`
3. **Top drift list** sorted by δ score descending
4. **Coverage gaps** where κ < threshold
5. **Prescriptive actions** from `GET /api/workspaces/:id/actions`, top N by weight

It then renders an HTML email using the workspace's brand colors and sends via the configured email connector.

## Snapshot mechanism

For the trend line and "what changed" section to work, the agent persists a workspace snapshot every Sunday night at 23:59 local time. The skill registers this snapshot job at install time:

```js
schedule.weekly('snapshot', '59 23 * * 0', async (ctx) => {
  await ctx.snapshots.save(ctx.workspaceId, await ctx.metrics.compute());
});
```

Snapshots are append-only and immutable. Retained for 52 weeks by default.

## Output formats

The skill renders three formats from the same source data:

| Format | Use case |
|---|---|
| `email/html` | Default — sent via connector |
| `email/text` | Plain-text fallback |
| `markdown` | For Slack / Notion delivery (composes well with `slack-canon-bot`) |

## Failure modes

- **Email connector unavailable**: Digest is rendered and saved to `/api/workspaces/:id/digests/<date>`, dashboard shows a "digest waiting" banner
- **No prior snapshot** (first week): Trend line replaced with "Baseline week — trends start next Monday"
- **Zero drift / zero actions** (clean week): Digest sends with celebration framing instead of being suppressed (silence is bad UX for a habit-forming product)

## Why this is high-leverage

A user who opens the dashboard once a quarter forgets the product exists. A user who sees their NCI tick up or down every Monday morning — and reads three specific things they could do about it — has a relationship with the product. This is the difference between a tool and a system.

It also gives the agent a recurring point of contact with **non-users** on the team (the CEO who gets cc'd, the board member on `recipients.emails`) — which is exactly how organizational alignment products spread.
