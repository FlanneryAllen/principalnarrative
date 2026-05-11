---
name: blog-authoring-harness
version: 0.1.0
type: view
description: Wraps provenance-scoring into an authoring workflow — live scoring, suggestion engine, publish gate with override logging.
requires:
  skills: [provenance-scoring, huddle-harvest]
capabilities:
  - view.author_session
  - view.publish_gate
  - view.override_log
  - api.score_draft
  - api.suggest_quotes
author: Principal AI
---

# Blog Authoring Harness

This is the user-facing layer. `provenance-scoring` does the math; this skill turns that math into an authoring experience: a live score in the editor, inline highlighting of matched spans, suggestions for unmatched paragraphs, and a soft publish gate with logged overrides.

## The flow

```
┌──────────────────────────────────────────────────────────────┐
│ DRAFT: "Why we built Narrative Agent"        P: 0.62 ✓      │
│ Threshold: 0.50  ·  Status: ready to publish                 │
├──────────────────────────────────────────────────────────────┤
│ The thing we kept saying in every huddle was that this       │
│ ███ isn't just a developer tool — it's organizational    ███ │
│ ███ alignment infrastructure. (Julie, 5/9 huddle)        ███ │
│                                                              │
│ ░░ When Fernando first sketched the algebra on the board, ░░ │
│ ░░ the idea was that narrative could be measured the     ░░ │
│ ░░ same way code coverage is measured.                   ░░ │
│ ░░ (paraphrased — Fernando, 5/2 huddle)                  ░░ │
│                                                              │
│ ▒▒ Markets reward companies that know their own story.  ▒▒  │
│ ▒▒ (concept — multiple huddles)                          ▒▒  │
│                                                              │
│ We don't think AI should write your story. We think it       │
│ should keep your story honest.   ← your synthesis            │
└──────────────────────────────────────────────────────────────┘
   ███ verbatim · ░░ paraphrase · ▒▒ concept · plain = your synthesis

   Layer breakdown:
     verbatim:            4 spans · 600 chars · weight 1.0 → 600
     near-verbatim:       3 spans · 400 chars · weight 0.8 → 320
     paraphrase verified: 5 spans · 800 chars · weight 0.6 → 480
     concept only:        2 spans · 300 chars · weight 0.4 → 120
     total weighted:    1,520 / 3,000 chars = 0.51 → 0.62 with quote weighting

   Suggested quotes for unmatched paragraphs:
   • "The job isn't generation, it's alignment" — Julie, 5/4 huddle
   • "If we just become another AI writer..." — Michael, 5/7 huddle
   [Insert →]  [Insert →]
```

## What this skill provides

### 1. `startSession({ docId, draft })`
Begins an author session. Loads canon from huddles, sets baseline score, returns initial state.

### 2. `scoreDraft({ sessionId, draft })`
Live scoring on edit. Debounced server-side to ~1/second; returns the full spans + suggestions payload.

### 3. `suggestQuotes({ sessionId, paragraph })`
Targeted suggestions for a specific paragraph the author is working on.

### 4. `attemptPublish({ sessionId, draft })`
Returns `{ ok: true }` if P ≥ threshold, or `{ ok: false, requires_override: true, reason_prompt: "..." }` if below.

### 5. `logOverride({ sessionId, reason, finalDraft })`
Records a below-threshold publish. Stored permanently with timestamp, author, reason, and final P. Surfaces in workspace audit log.

### 6. `publishLog`
Append-only log of every publish (passed or overridden). Powers the weekly digest's "voice integrity" section.

## Override semantics

Soft enforcement is the choice — never block, always warn. Every override is logged:

```js
{
  publishId: 'pub_2026-05-10_juliea_3f9',
  docId: 'gdocs:abc123',
  title: 'Why we built Narrative Agent',
  authoredBy: 'Julie Allen',
  finalScore: 0.34,
  threshold: 0.5,
  passed: false,
  override: {
    reason: 'Vision piece — intentionally aspirational, will draw from upcoming huddle series',
    acknowledgedAt: '2026-05-10T20:31:00Z',
  },
  publishedAt: '2026-05-10T20:31:00Z',
}
```

Three useful properties of soft enforcement + logging:

1. **No blocked authors.** Velocity preserved.
2. **Pattern visibility.** If a particular author consistently overrides, that's a coaching conversation, not a tool problem.
3. **Workspace-level honesty.** "67% of our blog posts last quarter passed the voice threshold" is a metric you can actually report.

## Configuration

```yaml
blog-authoring-harness:
  threshold: 0.5
  liveScore:
    enabled: true
    debounceMs: 800
  suggestions:
    enabled: true
    perParagraph: 3
  override:
    requireReason: true
    minReasonLength: 20
    notify:
      - channel: '#voice-integrity'   # Slack channel for override notifications
  audit:
    retention_days: 365
  canon_source:
    skill: huddle-harvest             # which harvest skill feeds canon
    promotable_only: true             # only intent.promotable_to_blog units
```

## Integration surface

The skill exposes both an in-process API (for skills composing on top) and an HTTP surface (for the Google Docs add-on):

```
POST /api/harness/session          → { sessionId, canonUnits, threshold }
POST /api/harness/score            → { score, spans, suggestions }
POST /api/harness/suggest          → { suggestions }
POST /api/harness/publish/attempt  → { ok, requires_override?, prompt? }
POST /api/harness/publish/override → { publishId, ok: true }
GET  /api/harness/publishes        → publish log
```

## Why this matters

Provenance scoring without a harness is just a number on a dashboard nobody opens. A harness without scoring is just another editor. Combined, they create a workflow where every blog post the team publishes is **demonstrably written in the team's actual voice** — and the few that aren't are flagged, justified, and visible.

This is also the single most defensible product surface for an investor demo: "We promise our users that their content sounds like them. Here is the math and the audit log that proves it."
