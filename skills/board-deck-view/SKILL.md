---
name: board-deck-view
version: 0.1.0
type: view
description: Composes the workspace canon into board-meeting narrative framing.
requires:
  inputs: [canon, metrics, recentClarions]
capabilities:
  - view.compose
  - view.export.pptx
  - view.export.pdf
author: Principal AI
---

# Board Deck View

A board meeting is the most concentrated narrative event in an organization's quarter. Every other audience gets a piece of the story — the board gets the *integrated* story, framed in the language of strategy, risk, and capital.

This skill takes the workspace's canon and recomposes it into the eight-section narrative arc that boards expect, with NCI as the integrity layer running underneath.

## The eight-section composition

| Section | Source | Framing |
|---|---|---|
| 1. **Where we stand** | `core_story` units, current NCI | "Here is the story of the company today, and how aligned every team is with it." |
| 2. **What changed this quarter** | Δ Propagate log, Clarion events | "Here is what shifted in our narrative and why." |
| 3. **Strategic narrative** | `narrative_arc` units | "Here is the arc we are committing to over the next 12 months." |
| 4. **Stakeholder lens** | Σ Compose views | "Here is how customers, candidates, and analysts currently hear us." |
| 5. **Tension & contradictions** | δ Drift > threshold | "Here is where our public narrative and our working narrative diverge — and what we're doing about it." |
| 6. **Coverage & gaps** | κ Cover scores | "Here is where we have no story yet — markets we enter blind." |
| 7. **Risk** | Ω Validate failures, attribution gaps | "Here are claims we make that we cannot defend." |
| 8. **Asks** | Prescriptive actions weighted HIGH | "Here is what we are bringing to this board to decide." |

This is the structure successful operating execs use intuitively. The skill makes it computable, repeatable, and tied directly to evidence in canon.

## Configuration

```yaml
board-deck-view:
  meetingDate: '2026-05-15'
  comparisonWindow: 90d        # vs. last board meeting
  audience:
    name: 'Acme Board of Directors'
    sophistication: high       # affects framing language
  emphasize: [strategic, risk] # which sections lead
  exportFormat: pptx           # pptx | pdf | markdown
  themeFile: ./brand-theme.json
```

## Composition logic

This is a **view** skill — it does not write new units. It selects, orders, and reframes existing canon into the board narrative.

For each section, the composer:

1. **Selects** units matching the section's criteria (type, scope, validation state, recency)
2. **Ranks** by weighted importance (HIGH actions before MED, recent Clarion-touched before stable, etc.)
3. **Reframes** the underlying assertion into board-appropriate language using a prompt template:

```
SYSTEM: You are translating a company's internal narrative unit into language
suitable for a board of directors with [audience.sophistication] sophistication.
Preserve every factual claim. Add strategic framing. Never invent metrics.

UNIT TYPE: {unit.type}
UNIT ASSERTION: {unit.assertion}
ATTRIBUTION: {unit.author}, {unit.authoredAt}
EVIDENCE: {unit.evidence_required ? evidence.summary : 'none required'}
DRIFT STATUS: {unit.drift > 0.3 ? 'CONTESTED — flag for board attention' : 'aligned'}

OUTPUT: A single board-ready paragraph (max 60 words).
```

4. **Annotates** with provenance — every reframed claim links to its source unit so the board's "where did this come from?" question always has an answer.

## Output structure

```js
{
  meetingDate: '2026-05-15',
  audience: 'Acme Board of Directors',
  generatedAt: '2026-05-10T20:00:00Z',
  nciSnapshot: { current: 0.82, lastBoard: 0.71, delta: '+0.11' },
  sections: [
    {
      id: 'where-we-stand',
      title: 'Where we stand',
      narrative: '<reframed paragraph>',
      keyClaims: [
        { text: '...', sourceUnitId: 'tf-core-mission', evidenceUrl: '...' }
      ],
      slideNotes: '<speaker notes for whoever is presenting>',
    },
    // ... 7 more sections
  ],
  asks: [ /* HIGH-priority actions, formatted as board asks */ ],
  appendix: {
    fullCanonExport: '/workspaces/:id/canon/export?asOf=2026-05-10',
    driftReport: '/workspaces/:id/drift?asOf=2026-05-10',
  },
}
```

## Export formats

| Format | Uses | Notes |
|---|---|---|
| `pptx` | Drop into Google Slides / Keynote | Uses `office/pptx` skill if installed; one slide per section + appendix |
| `pdf` | Pre-read pack for board members | Generated via `office/pdf` skill |
| `markdown` | For Notion / Coda board pages | Native format, easiest to edit |
| `json` | For board portals & custom rendering | Full structured output |

## Defensibility (the meta-benefit)

Every claim in the deck links back to a canon unit with an author, timestamp, and evidence. A board member asking "where did this number come from?" gets a one-click answer. This is the kind of operational rigor that turns "narrative tool" into "governance infrastructure" in the board's mental model.

It also gives the CEO a clean defense: every slide is sourced from canon the team built collaboratively, not from one person's quarterly creative writing exercise.

## Why this is high-leverage

For the investor demo specifically: when a founder shows up to a board with a deck composed by their narrative agent — and can click any sentence to see the underlying canon unit, the team member who authored it, and the NCI score of the section — that is a *visible* demonstration of what an aligned organization looks like.

It also creates a natural sales motion: every quarter, the agent generates the board deck. The board sees the agent's fingerprint. Two of those board members sit on other boards. The product spreads horizontally through the most strategic surface area in any company.
