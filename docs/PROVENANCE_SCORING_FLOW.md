# Provenance Scoring: How P(draft) is Computed

> **Headline:** Provenance scoring measures what fraction of a blog draft is traceable to canon (huddle quotes) using a four-layer waterfall match that rewards verbatim use (1.0) more than paraphrase (0.6) more than concept reuse (0.4).

## The Four-Layer Waterfall

For each sentence in the draft, the scorer tries layers in decreasing precision order. **First match wins**—no double-counting.

| Layer | Detection Method | Weight | When to Use |
|-------|-----------------|--------|-------------|
| **verbatim** | Exact substring match after normalization | 1.0 | Author literally quoted the huddle |
| **near_verbatim** | Embedding cosine similarity ≥ 0.95 | 0.8 | Tiny edits, same words |
| **paraphrase_verified** | Embedding ≥ 0.85 + LLM confirms "same idea" | 0.6 | Faithfully restated the idea |
| **concept_only** | Embedding ≥ 0.75 (no LLM check) | 0.4 | Concept appears; author recombined it |

## The Flow

### 1. Entry: `score()` function
**Location:** `skills/provenance-scoring/index.js:248`

```js
async function score({ draft, canon, embedder, llm, config })
```

- Merges user config with defaults (weights, thresholds, canon filters)
- Filters canon to only promotable units (typically `intent.promotable_to_blog` huddle quotes)
- Returns a `ProvenanceResult` with score, spans, layer breakdown, and suggestions

### 2. Split draft into sentences
**Location:** `skills/provenance-scoring/index.js:39-55`

```js
function splitSentences(draft)
```

- Regex splits on sentence terminators (`.!?`) followed by capital letters
- Returns `[{ text, start, end }, ...]` with character offsets preserved
- **Why sentences?** Keeps spans clean for UI highlighting; prevents gaming via word-soup repetition

### 3. Classify each sentence (the waterfall)
**Location:** `skills/provenance-scoring/index.js:147-182`

```js
async function classifySentence(sentence, canon, ctx, embeddingCache)
```

**The cascade:**

1. **Try verbatim first** (no embedder needed)
   - `matchVerbatim()` at `index.js:93-105`
   - Normalizes text (lowercase, collapse whitespace, strip light punctuation)
   - Checks bidirectionally: sentence in canon OR canon in sentence
   - Returns `{ unit, similarity: 1.0 }` on match

2. **If no verbatim match and embedder available:**
   - `matchEmbedding()` once at `index.js:110-126`
   - Computes cosine similarity between sentence and all canon embeddings
   - **Canon embeddings are cached** in `embeddingCache` to avoid redundant API calls
   - Returns best match `{ unit, similarity }`

3. **With embedding result, check thresholds:**
   - If similarity ≥ 0.95 → **near_verbatim** (weight 0.8)
   - If similarity ≥ 0.85 → try LLM verification:
     - `verifyParaphrase()` at `index.js:131-142`
     - LLM prompt: "Does SENTENCE faithfully restate CANON?"
     - If YES → **paraphrase_verified** (weight 0.6)
     - If NO but similarity still ≥ 0.75 → downgrade to **concept_only** (weight 0.4)
   - If similarity ≥ 0.75 (no LLM needed) → **concept_only**

**Key insight:** A single embedding lookup is reused for all three similarity layers. The LLM is only called for paraphrase verification (≥0.85 threshold).

### 4. Coalesce adjacent spans
**Location:** `skills/provenance-scoring/index.js:189-205`

```js
function coalesceSpans(spans)
```

- Merges adjacent spans from the same source unit + layer
- "Adjacent" = `curr.start - prev.end ≤ 2` (allows tiny gaps like `, `)
- Reduces UI noise: a quote spanning 3 sentences becomes one span, not three

### 5. Compute the weighted score P
**Location:** `skills/provenance-scoring/index.js:289-308`

```js
for (const span of merged) {
  const len = span.end - span.start;
  weightedChars += len * span.weight;
}
const scoreVal = totalChars > 0 ? weightedChars / totalChars : 0;
```

**Formula:**
```
P(draft) = Σ (span.length × span.weight) / total_chars
```

**Example:**
A 3,000-char draft with:
- 600 chars verbatim (× 1.0) = 600
- 800 chars paraphrase (× 0.6) = 480
- 300 chars concept (× 0.4) = 120

```
P = (600 + 480 + 120) / 3000 = 1,200 / 3,000 = 0.40
```

**Result:** 0.40 < 0.50 threshold → requires override to publish

### 6. Generate suggestions for unmatched ranges
**Location:** `skills/provenance-scoring/index.js:209-233`

```js
async function suggestForUnmatched(unmatchedText, canon, ctx, embeddingCache)
```

- Finds gaps between matched spans
- For each gap ≥ 40 chars, embeds the unmatched text
- Returns canon units with similarity ≥ 0.6 (topical suggestions)
- Sorted by similarity descending, limited to 5
- **Use case:** Shows author relevant huddle quotes they could incorporate

## The Math in Action

### High-scoring draft (passes threshold)
```
Draft: 3,000 chars
Matched:
  - 1,000 chars verbatim (× 1.0) = 1,000
  - 600 chars paraphrase (× 0.6) = 360
  - 400 chars concept (× 0.4) = 160

P = 1,520 / 3,000 = 0.51 ✓ (passes 0.5 threshold)
```

### Low-scoring draft (needs override)
```
Draft: 3,000 chars
Matched:
  - 200 chars verbatim (× 1.0) = 200
  - 400 chars paraphrase (× 0.6) = 240
  - 500 chars concept (× 0.4) = 200

P = 640 / 3,000 = 0.21 ✗ (requires override)
```

### Why-it-matters draft (all synthesis)
```
Draft: 3,000 chars
Matched: 0 chars

P = 0 / 3,000 = 0.00 ✗

Suggestions: 15 topical huddle quotes with similarity ≥ 0.6
→ Author can review and incorporate relevant quotes
```

## Key Design Decisions

### Why four layers instead of one threshold?
**SKILL.md:116-118:**
> A single embedding threshold treats "you literally said this in a huddle" the same as "this is on the same general topic." That collapses the whole premise—which is rewarding *evidence of voice*, not topical relevance.

Four layers create an integrity gradient:
- Verbatim quotes earn full credit (1.0)
- Faithful paraphrases earn good credit (0.6)
- Concept reuse earns partial credit (0.4)
- Pure synthesis earns zero (but gets suggestions)

### Why sentence boundaries?
**index.js:66** and SKILL.md:66:
> Sentence boundaries (rather than overlapping windows) keep the spans clean for UI highlighting and prevent gaming via word-soup repetition.

### Why cache embeddings?
**index.js:268:**
```js
const embeddingCache = new Map();
```

With 50 sentences and 200 canon units, naive approach = 10,000 embedding calls.
With caching: 50 (draft sentences) + 200 (canon units, cached once) = 250 calls.

40× reduction in API costs + latency.

### Why LLM verification only for paraphrase?
**index.js:168:**
```js
if (emb.similarity >= thresholds.paraphrase_similarity) {
  if (await verifyParaphrase(sentence, emb.unit, llm)) {
    return { layer: 'paraphrase_verified', weight: 0.6, ...emb };
  }
}
```

- Near-verbatim (≥0.95) doesn't need LLM—embeddings are accurate at that threshold
- Concept-only (≥0.75) doesn't warrant LLM cost—low weight anyway
- Paraphrase (0.85-0.95) is the ambiguous zone where "same words, different idea" vs "different words, same idea" matters

## Configuration

Default config at `index.js:17-31`:

```js
{
  weights: {
    verbatim: 1.0,
    near_verbatim: 0.8,
    paraphrase_verified: 0.6,
    concept_only: 0.4,
  },
  thresholds: {
    near_verbatim_similarity: 0.95,
    paraphrase_similarity: 0.85,
    concept_similarity: 0.75,
    publish: 0.5,  // P(draft) must be ≥ 0.5 to pass
  },
  suggestions: { max: 5, only_for_unmatched: true },
}
```

Override via `score({ config: { weights: { verbatim: 0.9 }, ... } })`

## Output Format

```js
{
  score: 0.62,              // P(draft)
  threshold: 0.5,           // configured publish threshold
  passes: true,             // score ≥ threshold
  totalChars: 3120,
  matchedChars: 1934,       // sum of span lengths (unweighted)
  weightedChars: 1934.8,    // sum of (span.length × span.weight)

  layerBreakdown: {
    verbatim: { chars: 600, weight: 1.0, count: 4 },
    near_verbatim: { chars: 400, weight: 0.8, count: 3 },
    paraphrase_verified: { chars: 800, weight: 0.6, count: 5 },
    concept_only: { chars: 300, weight: 0.4, count: 2 },
  },

  spans: [
    {
      start: 142,
      end: 218,
      layer: 'verbatim',
      weight: 1.0,
      sourceUnitId: 'huddle-2026-05-09-am-q14',
      sourceAuthor: 'Julie Allen',
      sourceTimestamp: '00:14:23',
      similarity: 1.0
    },
    // ... more spans
  ],

  unmatchedRanges: [
    {
      start: 0,
      end: 142,
      suggestions: [
        {
          unitId: 'huddle-2026-05-07-pm-q08',
          assertion: 'The job isn't generation, it's alignment',
          author: 'Julie Allen',
          timestamp: '00:08:15',
          similarity: 0.78
        }
      ]
    }
  ]
}
```

## Performance

**SKILL.md:120-122:**
> For drafts under 10k chars and canon under 5k units, the scorer runs in under 2 seconds with cached embeddings. The first run on a new canon pre-computes embeddings, which we persist in the workspace store under `embeddings/<unit_id>`.

## Why This Matters

**SKILL.md:124-126:**
> Provenance scoring is what turns a soft norm ("we should use our actual voice") into a measurable system property. Once it's measured, it can be required. Once it's required, the team's actual voice survives every blog post, every fundraising memo, every product launch—instead of getting diluted by whoever's writing that week.

---

## See Also

- **Story mining:** `packages/serve/storymining.js` + `storymining-llm.js` — extracts narrative units from raw text
- **Blog authoring harness:** `skills/blog-authoring-harness/` — wraps scoring into live editor workflow
- **Huddle harvest:** `skills/huddle-harvest/` — feeds canon from meeting transcripts
- **Provenance scoring skill:** `skills/provenance-scoring/SKILL.md` — full specification
