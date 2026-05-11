---
name: provenance-scoring
version: 0.1.0
type: validation
description: Computes the provenance score P(draft) — what fraction of a draft is traceable to canon, using a layered matching scheme.
requires:
  inputs: [draft, canon]
  optional:
    - embedder    # vector embeddings for semantic match
    - llm         # for paraphrase verification
capabilities:
  - validation.provenance_score
  - validation.span_matching
  - validation.suggest_quotes
author: Principal AI
---

# Provenance Scoring

Given a draft document and a corpus of canon units (e.g. huddle quotes), compute:

1. **P(draft)** — a single number in `[0, 1]` representing the weighted fraction of the draft that is traceable to canon
2. **Span annotations** — for each matched span: `{start, end, layer, weight, sourceUnitId}` for inline highlighting
3. **Suggested quotes** — canon units that match the *topic* of unmatched spans, so the author can incorporate them

## The four layers

| Layer | Detection | Weight | What it means |
|---|---|---|---|
| `verbatim` | Exact substring match against `source.verbatim_text` | **1.0** | Full credit. You used their actual words. |
| `near_verbatim` | Cosine similarity ≥ 0.95 after normalization | **0.8** | Tiny edits, same words. |
| `paraphrase_verified` | Cosine ≥ 0.85 AND LLM confirms "same idea" | **0.6** | You restated their idea faithfully. |
| `concept_only` | Cosine ≥ 0.75 (no LLM check) | **0.4** | The concept appears in canon; you recombined it. |

P is the weighted sum of matched draft-character-length divided by total draft length. A span can only count for the **highest** layer it qualifies for (no double counting).

## Formula

```
matched_weighted_chars = Σ (span.end - span.start) × span.weight
P(draft) = matched_weighted_chars / total_chars
```

A 3,000-character draft with:

- 600 chars of verbatim quotes (× 1.0) = 600
- 400 chars of near-verbatim (× 0.8) = 320
- 800 chars of verified paraphrase (× 0.6) = 480
- 300 chars of concept-only (× 0.4) = 120

Total weighted = 1,520. P = 1,520 / 3,000 = **0.51** → passes 50% threshold.

## Span detection algorithm

```
1. Split draft into sentences (using punctuation + heuristics for prose)
2. For each sentence, in order of decreasing precision:
   a. Try verbatim: scan canon for exact substring inclusion (both directions)
   b. Try near_verbatim: embedding lookup, threshold 0.95
   c. Try paraphrase_verified: embedding lookup ≥ 0.85, then LLM confirm
   d. Try concept_only: embedding lookup ≥ 0.75
3. First match at any layer wins; record span with weight + sourceUnitId
4. Coalesce adjacent same-source spans for cleaner highlighting
```

Sentence boundaries (rather than overlapping windows) keep the spans clean for UI highlighting and prevent gaming via word-soup repetition.

## Configuration

```yaml
provenance-scoring:
  weights:
    verbatim: 1.0
    near_verbatim: 0.8
    paraphrase_verified: 0.6
    concept_only: 0.4
  thresholds:
    near_verbatim_similarity: 0.95
    paraphrase_similarity: 0.85
    concept_similarity: 0.75
  canon_filter:
    # Which units to score against — typically huddle quotes only
    source_platform: 'slack-huddle'
    intent_promotable_to_blog: true
  suggestions:
    max: 5                # max suggestions per unmatched span
    only_for_unmatched: true
```

## Output

```js
{
  score: 0.62,            // P(draft)
  threshold: 0.5,         // configured publish threshold
  passes: true,
  totalChars: 3120,
  matchedChars: 1934,
  layerBreakdown: {
    verbatim: { chars: 600, weight: 1.0, count: 4 },
    near_verbatim: { chars: 400, weight: 0.8, count: 3 },
    paraphrase_verified: { chars: 800, weight: 0.6, count: 5 },
    concept_only: { chars: 300, weight: 0.4, count: 2 },
  },
  spans: [
    { start: 142, end: 218, layer: 'verbatim', weight: 1.0, sourceUnitId: 'huddle-2026-05-09-am-q14', sourceAuthor: 'Julie Allen', sourceTimestamp: '00:14:23' },
    // ... more spans
  ],
  unmatchedRanges: [
    { start: 0, end: 142, suggestions: [ { unitId, assertion, author, similarity } ] },
    // ...
  ],
}
```

## Why layered (vs single-threshold)

A single embedding threshold treats "you literally said this in a huddle" the same as "this is on the same general topic." That collapses the whole premise of the harness — which is rewarding *evidence of voice*, not topical relevance. Four layers let us reward verbatim use heavily, accept faithful paraphrase, and still credit concept reuse without flattening the integrity gradient.

## Performance

For drafts under 10k chars and canon under 5k units, the scorer runs in under 2 seconds with cached embeddings. The first run on a new canon pre-computes embeddings, which we persist in the workspace store under `embeddings/<unit_id>`.

## Why this matters

Provenance scoring is what turns a soft norm ("we should use our actual voice") into a measurable system property. Once it's measured, it can be required. Once it's required, the team's actual voice survives every blog post, every fundraising memo, every product launch — instead of getting diluted by whoever's writing that week.
