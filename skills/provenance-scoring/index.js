/**
 * provenance-scoring — Computes P(draft) with layered matching.
 *
 * Dependency-injected:
 *   - embedder: { embed(text) → Promise<number[]> }    (optional; without it only verbatim runs)
 *   - llm:      { complete({prompt}) → {text} }        (optional; without it paraphrase is downgraded)
 */

'use strict';

const MANIFEST = {
  name: 'provenance-scoring',
  version: '0.1.0',
  type: 'validation',
};

const DEFAULT_CONFIG = {
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
    publish: 0.5,
  },
  suggestions: { max: 5, only_for_unmatched: true },
};

// ───────────────────────── text utilities ─────────────────────────

/**
 * Split prose into sentences with offsets back into the original text.
 * Returns [{ text, start, end }, ...].
 */
function splitSentences(draft) {
  const sentences = [];
  // Match runs of non-terminator chars, then a terminator + trailing whitespace.
  const re = /[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g;
  let match;
  while ((match = re.exec(draft)) !== null) {
    const text = match[0];
    const trimmed = text.replace(/\s+$/, '');
    if (trimmed.length === 0) continue;
    sentences.push({
      text: trimmed,
      start: match.index,
      end: match.index + trimmed.length,
    });
  }
  return sentences;
}

/**
 * Normalize text for matching: lowercase, collapse whitespace, strip light punctuation.
 */
function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[""'']/g, '"')
    .replace(/[—–]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Cosine similarity between two vectors.
 */
function cosine(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// ───────────────────────── layered matching ─────────────────────────

/**
 * Verbatim match — exact substring inclusion in either direction.
 * (Sentence appears inside a canon assertion, or canon assertion appears
 *  inside the sentence.)
 */
function matchVerbatim(sentence, canon) {
  const nSent = normalize(sentence.text);
  if (nSent.length < 8) return null;
  for (const unit of canon) {
    const verbatim = unit.source?.verbatim_text;
    if (!verbatim) continue;
    const nUnit = normalize(verbatim);
    if (nUnit.includes(nSent) || nSent.includes(nUnit)) {
      return { unit, similarity: 1.0 };
    }
  }
  return null;
}

/**
 * Embedding-based match. Returns the best canon unit + similarity, or null.
 */
async function matchEmbedding(sentence, canon, embedder, embeddingCache) {
  if (!embedder) return null;
  const sentEmb = await embedder.embed(sentence.text);
  let best = null;
  for (const unit of canon) {
    const text = unit.source?.verbatim_text || unit.assertion;
    if (!text) continue;
    let unitEmb = embeddingCache.get(unit.id);
    if (!unitEmb) {
      unitEmb = await embedder.embed(text);
      embeddingCache.set(unit.id, unitEmb);
    }
    const sim = cosine(sentEmb, unitEmb);
    if (!best || sim > best.similarity) best = { unit, similarity: sim };
  }
  return best;
}

/**
 * LLM verification — confirms paraphrase is the same idea, not just topical.
 */
async function verifyParaphrase(sentence, unit, llm) {
  if (!llm) return false;
  const canonText = unit.source?.verbatim_text || unit.assertion;
  const prompt = `Decide if SENTENCE faithfully restates the IDEA from CANON. Answer only YES or NO.

CANON: "${canonText}"
SENTENCE: "${sentence.text}"

Faithful restatement preserves the same point and intent, even with different words. Topical overlap alone is NO.`;
  const resp = await llm.complete({ prompt, maxTokens: 4, temperature: 0 });
  return /^\s*yes/i.test(resp.text || '');
}

/**
 * Classify a sentence into the highest-priority layer it qualifies for.
 */
async function classifySentence(sentence, canon, ctx, embeddingCache) {
  const { embedder, llm, thresholds } = ctx;

  // 1. Verbatim (no embedder needed)
  const v = matchVerbatim(sentence, canon);
  if (v) {
    return { layer: 'verbatim', weight: ctx.weights.verbatim, ...v };
  }

  // Without embedder, can't do further layers
  if (!embedder) return null;

  // 2. Embedding lookup once
  const emb = await matchEmbedding(sentence, canon, embedder, embeddingCache);
  if (!emb) return null;

  if (emb.similarity >= thresholds.near_verbatim_similarity) {
    return { layer: 'near_verbatim', weight: ctx.weights.near_verbatim, ...emb };
  }

  if (emb.similarity >= thresholds.paraphrase_similarity) {
    if (await verifyParaphrase(sentence, emb.unit, llm)) {
      return { layer: 'paraphrase_verified', weight: ctx.weights.paraphrase_verified, ...emb };
    }
    // LLM rejected: downgrade to concept_only if it still meets that threshold
    if (emb.similarity >= thresholds.concept_similarity) {
      return { layer: 'concept_only', weight: ctx.weights.concept_only, ...emb };
    }
    return null;
  }

  if (emb.similarity >= thresholds.concept_similarity) {
    return { layer: 'concept_only', weight: ctx.weights.concept_only, ...emb };
  }
  return null;
}

// ───────────────────────── span coalescing ─────────────────────────

/**
 * Merge adjacent spans that share the same source unit & layer.
 */
function coalesceSpans(spans) {
  if (spans.length === 0) return spans;
  const sorted = spans.slice().sort((a, b) => a.start - b.start);
  const out = [sorted[0]];
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = out[out.length - 1];
    const curr = sorted[i];
    const adjacent = curr.start - prev.end <= 2;
    const sameSource = prev.sourceUnitId === curr.sourceUnitId && prev.layer === curr.layer;
    if (adjacent && sameSource) {
      prev.end = curr.end;
    } else {
      out.push(curr);
    }
  }
  return out;
}

// ───────────────────────── suggestions ─────────────────────────

async function suggestForUnmatched(unmatchedText, canon, ctx, embeddingCache) {
  if (!ctx.embedder || !unmatchedText) return [];
  const emb = await ctx.embedder.embed(unmatchedText);
  const scored = [];
  for (const unit of canon) {
    let unitEmb = embeddingCache.get(unit.id);
    if (!unitEmb) {
      unitEmb = await ctx.embedder.embed(unit.source?.verbatim_text || unit.assertion);
      embeddingCache.set(unit.id, unitEmb);
    }
    const sim = cosine(emb, unitEmb);
    if (sim >= 0.6) {
      scored.push({
        unitId: unit.id,
        assertion: unit.source?.verbatim_text || unit.assertion,
        author: unit.author,
        timestamp: unit.source?.timestamp_in_recording,
        similarity: +sim.toFixed(3),
      });
    }
  }
  return scored
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, ctx.suggestions?.max || 5);
}

// ───────────────────────── public hook ─────────────────────────

/**
 * Score a draft against canon.
 *
 * @param {object} args
 * @param {string} args.draft
 * @param {object[]} args.canon — narrative units (typically huddle quotes)
 * @param {object} [args.embedder]
 * @param {object} [args.llm]
 * @param {object} [args.config]
 * @returns {Promise<ProvenanceResult>}
 */
async function score({ draft, canon, embedder, llm, config }) {
  const cfg = mergeConfig(config);
  const ctx = {
    embedder,
    llm,
    weights: cfg.weights,
    thresholds: cfg.thresholds,
    suggestions: cfg.suggestions,
  };

  // Filter canon to promotable units (typically huddle quotes only)
  const filteredCanon = canon.filter((u) => {
    if (cfg.canon_filter?.source_platform
        && u.source?.platform !== cfg.canon_filter.source_platform) return false;
    if (cfg.canon_filter?.intent_promotable_to_blog
        && !u.intent?.promotable_to_blog) return false;
    return true;
  });

  const sentences = splitSentences(draft);
  const embeddingCache = new Map();
  const spans = [];

  for (const sent of sentences) {
    const cls = await classifySentence(sent, filteredCanon, ctx, embeddingCache);
    if (cls) {
      spans.push({
        start: sent.start,
        end: sent.end,
        layer: cls.layer,
        weight: cls.weight,
        similarity: +cls.similarity.toFixed(3),
        sourceUnitId: cls.unit.id,
        sourceAuthor: cls.unit.author,
        sourceTimestamp: cls.unit.source?.timestamp_in_recording,
      });
    }
  }

  const merged = coalesceSpans(spans);

  // Compute weighted score
  const layerBreakdown = {
    verbatim: { chars: 0, weight: cfg.weights.verbatim, count: 0 },
    near_verbatim: { chars: 0, weight: cfg.weights.near_verbatim, count: 0 },
    paraphrase_verified: { chars: 0, weight: cfg.weights.paraphrase_verified, count: 0 },
    concept_only: { chars: 0, weight: cfg.weights.concept_only, count: 0 },
  };
  let weightedChars = 0;
  let matchedChars = 0;
  for (const span of merged) {
    const len = span.end - span.start;
    matchedChars += len;
    weightedChars += len * span.weight;
    layerBreakdown[span.layer].chars += len;
    layerBreakdown[span.layer].count += 1;
  }

  const totalChars = draft.length;
  const scoreVal = totalChars > 0 ? +(weightedChars / totalChars).toFixed(3) : 0;

  // Find unmatched ranges & generate suggestions
  const unmatchedRanges = findUnmatchedRanges(draft, merged);
  if (cfg.suggestions?.only_for_unmatched !== false) {
    for (const range of unmatchedRanges) {
      const text = draft.slice(range.start, range.end);
      if (text.trim().length < 40) continue; // skip tiny gaps
      range.suggestions = await suggestForUnmatched(text, filteredCanon, ctx, embeddingCache);
    }
  }

  return {
    score: scoreVal,
    threshold: cfg.thresholds.publish,
    passes: scoreVal >= cfg.thresholds.publish,
    totalChars,
    matchedChars,
    weightedChars: +weightedChars.toFixed(1),
    layerBreakdown,
    spans: merged,
    unmatchedRanges,
  };
}

function findUnmatchedRanges(draft, spans) {
  const ranges = [];
  let cursor = 0;
  const sorted = spans.slice().sort((a, b) => a.start - b.start);
  for (const span of sorted) {
    if (span.start > cursor) {
      ranges.push({ start: cursor, end: span.start });
    }
    cursor = Math.max(cursor, span.end);
  }
  if (cursor < draft.length) ranges.push({ start: cursor, end: draft.length });
  return ranges;
}

function mergeConfig(user) {
  if (!user) return DEFAULT_CONFIG;
  return {
    weights: { ...DEFAULT_CONFIG.weights, ...(user.weights || {}) },
    thresholds: { ...DEFAULT_CONFIG.thresholds, ...(user.thresholds || {}) },
    suggestions: { ...DEFAULT_CONFIG.suggestions, ...(user.suggestions || {}) },
    canon_filter: user.canon_filter,
  };
}

module.exports = {
  manifest: MANIFEST,
  score,
  _internals: {
    splitSentences,
    normalize,
    cosine,
    matchVerbatim,
    coalesceSpans,
    findUnmatchedRanges,
  },
};
