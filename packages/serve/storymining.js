/**
 * storymining.js — Narrative Unit Discovery Engine
 *
 * Rule-based extraction of candidate narrative units from unstructured text.
 * NO LLM dependency, NO external npm packages.
 *
 * Takes text (press releases, strategy docs, customer stories, etc.) and:
 *   1. Extracts candidate assertions using pattern matching
 *   2. Classifies each by narrative layer type using keyword/pattern signals
 *   3. Proposes dependency links to existing units if provided
 *   4. Returns candidates + coverage analysis
 */

'use strict';

const crypto = require('crypto');

// ============================================================================
// Layer Classification — keyword/pattern signals
// ============================================================================

const LAYER_SIGNALS = {
  core_story: {
    keywords: [
      'purpose', 'mission', 'why we exist', 'vision', 'believe', 'core',
      'fundamental', 'at our core', 'we exist to', 'our purpose', 'what drives us',
      'reason for being', 'founded on', 'guiding principle', 'north star',
    ],
    weight: 1.0,
  },
  positioning: {
    keywords: [
      'market', 'differentiat', 'value proposition', 'competitive', 'position',
      'unique', 'unlike', 'first to', 'only', 'leading', 'category',
      'advantage', 'stand apart', 'better than', 'compared to', 'alternative',
      'redefin', 'disrupt', 'transform the way',
    ],
    weight: 0.9,
  },
  product_narrative: {
    keywords: [
      'feature', 'capability', 'product', 'platform', 'solution', 'technology',
      'tool', 'service', 'enables', 'provides', 'delivers', 'built',
      'architecture', 'integration', 'api', 'dashboard', 'module',
      'functionality', 'launch', 'release',
    ],
    weight: 0.8,
  },
  operational: {
    keywords: [
      'process', 'workflow', 'team', 'implementation', 'internal', 'operations',
      'deploy', 'maintain', 'support', 'infrastructure', 'scale', 'automate',
      'procedure', 'standard', 'practice', 'methodology', 'governance',
    ],
    weight: 0.7,
  },
  evidence: {
    keywords: [
      'metric', 'percent', 'customer', 'result', 'proved', 'achieved', 'kpi',
      'growth', 'revenue', 'reduction', 'improvement', 'saved', 'roi',
      'increased', 'decreased', 'benchmark', 'measured', 'data shows',
      'according to', 'survey', 'study', 'research', 'report',
    ],
    patterns: [
      /\d+\s*%/,              // percentages
      /\$[\d,.]+[mMbBkK]?/,   // dollar amounts
      /\d+x\b/,               // multipliers
      /\d+\s*(customers?|users?|clients?|companies|organizations)/i, // user counts
    ],
    weight: 0.85,
  },
  communication: {
    keywords: [
      'press release', 'blog', 'announcement', 'campaign', 'pr ',
      'media', 'publish', 'communication', 'messaging', 'brand voice',
      'content', 'social', 'outreach', 'news', 'headline', 'story',
      'announce', 'today announced', 'is pleased',
    ],
    weight: 0.75,
  },
};

const ALL_LAYERS = ['core_story', 'positioning', 'product_narrative', 'operational', 'evidence', 'communication'];

// ============================================================================
// Assertion Extraction Patterns
// ============================================================================

/**
 * Patterns that indicate a sentence contains an assertion worth extracting.
 */
const ASSERTION_PATTERNS = [
  // "We [verb]..." statements
  /^we\s+(are|have|build|create|deliver|provide|enable|offer|believe|exist|make|help|empower|transform|drive)/i,
  // "[Company/Our] is/are..." identity statements
  /^(our|the)\s+\w+\s+(is|are|was|has|enables|provides|delivers)/i,
  // "[Product/Platform] [verb]..." product statements
  /^(the|this|our)\s+(platform|product|solution|tool|service|technology|system)\s+(is|enables|provides|delivers|helps)/i,
  // Declarative purpose/mission
  /^(our (mission|purpose|vision|goal)|we exist to|we believe)/i,
  // Value proposition patterns
  /(^|\.\s+)(unlike|the only|the first|we are the|no other)/i,
  // Evidence patterns with metrics
  /\d+\s*%\s+(increase|decrease|improvement|reduction|growth)/i,
  /achieved\s+(a\s+)?\d+/i,
  /resulted?\s+in\s+/i,
  // "Today announced" press release patterns
  /(today\s+announced|is\s+pleased\s+to\s+announce|proud\s+to)/i,
  // Assertive statements
  /^(it is|there is|this is|this means|this ensures|this enables)/i,
];

// ============================================================================
// Text Processing Helpers
// ============================================================================

/**
 * Split text into sentences, handling common abbreviations and edge cases.
 */
function splitSentences(text) {
  // Normalize whitespace
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Split on sentence boundaries
  const raw = normalized.split(/(?<=[.!?])\s+(?=[A-Z])|(?<=\n)\s*(?=\n)/);

  const sentences = [];
  for (const s of raw) {
    const trimmed = s.trim();
    if (trimmed.length < 10) continue; // Too short to be meaningful
    // Further split on newlines for bullet points
    const lines = trimmed.split(/\n+/);
    for (const line of lines) {
      const clean = line.replace(/^[-•*]\s*/, '').trim();
      if (clean.length >= 10) {
        sentences.push(clean);
      }
    }
  }
  return sentences;
}

/**
 * Generate a unit ID from assertion text.
 */
function generateUnitId(assertion, type) {
  const prefix = type ? type.split('_').map(w => w[0]).join('') : 'u';
  const slug = assertion
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2)
    .slice(0, 4)
    .join('_');
  const hash = crypto.createHash('md5').update(assertion).digest('hex').slice(0, 4);
  return `${prefix}_${slug}_${hash}`;
}

// ============================================================================
// Layer Classification
// ============================================================================

/**
 * Classify a sentence into a narrative layer.
 * Returns { layer, confidence, reasoning }.
 */
function classifyLayer(sentence, sourceType) {
  const lower = sentence.toLowerCase();
  const scores = {};

  for (const [layer, signals] of Object.entries(LAYER_SIGNALS)) {
    let score = 0;
    const matchedKeywords = [];

    // Keyword matching
    for (const kw of signals.keywords) {
      if (lower.includes(kw)) {
        score += signals.weight;
        matchedKeywords.push(kw);
      }
    }

    // Pattern matching (for evidence layer)
    if (signals.patterns) {
      for (const pattern of signals.patterns) {
        if (pattern.test(sentence)) {
          score += signals.weight * 1.5;
          matchedKeywords.push('pattern:' + pattern.source);
        }
      }
    }

    if (score > 0) {
      scores[layer] = { score, keywords: matchedKeywords };
    }
  }

  // Source type hint: boost the likely layer
  if (sourceType) {
    const sourceBoosts = {
      press_release: 'communication',
      strategy: 'core_story',
      customer_story: 'evidence',
      meeting_notes: 'operational',
      product_doc: 'product_narrative',
      investor: 'positioning',
      marketing: 'communication',
    };
    const boostLayer = sourceBoosts[sourceType];
    if (boostLayer && scores[boostLayer]) {
      scores[boostLayer].score *= 1.3;
    }
  }

  // Pick the highest-scoring layer
  let bestLayer = 'operational'; // default fallback
  let bestScore = 0;
  let bestKeywords = [];

  for (const [layer, data] of Object.entries(scores)) {
    if (data.score > bestScore) {
      bestScore = data.score;
      bestLayer = layer;
      bestKeywords = data.keywords;
    }
  }

  // Confidence based on score relative to threshold
  const confidence = Math.min(1.0, bestScore / 3.0);

  const reasoning = bestKeywords.length > 0
    ? `Matched ${bestLayer} signals: ${bestKeywords.slice(0, 3).join(', ')}`
    : `Default classification (no strong signals)`;

  return { layer: bestLayer, confidence: Math.round(confidence * 100) / 100, reasoning };
}

// ============================================================================
// Dependency Matching
// ============================================================================

/**
 * Find potential dependency links between a candidate and existing units.
 * Uses keyword overlap as a proxy for semantic relatedness.
 */
function findDependencies(assertion, existingUnits) {
  if (!existingUnits || existingUnits.length === 0) return [];

  const candidateWords = new Set(
    assertion.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 3)
  );

  const matches = [];
  for (const unit of existingUnits) {
    const unitWords = new Set(
      unit.assertion.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 3)
    );
    const overlap = [...candidateWords].filter(w => unitWords.has(w));
    const similarity = overlap.length / Math.max(candidateWords.size, unitWords.size, 1);
    if (similarity > 0.15 && overlap.length >= 2) {
      matches.push({ id: unit.id, similarity, overlap });
    }
  }

  // Return top 3 matches sorted by similarity
  return matches
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 3)
    .map(m => m.id);
}

// ============================================================================
// Main API
// ============================================================================

/**
 * Mine narrative units from unstructured text.
 *
 * @param {string} text - Raw content (press release, strategy doc, meeting notes, etc.)
 * @param {Object} [options]
 * @param {string} [options.sourceType] - Hint: 'press_release', 'strategy', 'customer_story', 'meeting_notes', etc.
 * @param {Array}  [options.existingGraph] - Existing units to check for dependency links
 * @returns {{ candidates: Array, coverage: { layers: Object, gaps: Array } }}
 */
function mineNarrativeUnits(text, options = {}) {
  const { sourceType, existingGraph } = options;

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return { candidates: [], coverage: { layers: {}, gaps: ALL_LAYERS.slice() } };
  }

  const sentences = splitSentences(text);
  const candidates = [];
  const layerCounts = {};
  for (const layer of ALL_LAYERS) layerCounts[layer] = 0;

  for (const sentence of sentences) {
    // Check if sentence matches any assertion pattern
    const isAssertion = ASSERTION_PATTERNS.some(p => p.test(sentence));

    // Also check for strong layer signals even without assertion pattern match
    const classification = classifyLayer(sentence, sourceType);
    const hasStrongSignal = classification.confidence >= 0.3;

    if (!isAssertion && !hasStrongSignal) continue;

    // Determine combined confidence
    const assertionBoost = isAssertion ? 0.2 : 0;
    const finalConfidence = Math.min(1.0, classification.confidence + assertionBoost);

    // Skip very low confidence
    if (finalConfidence < 0.15) continue;

    const id = generateUnitId(sentence, classification.layer);
    const dependencies = findDependencies(sentence, existingGraph);

    candidates.push({
      id,
      type: classification.layer,
      assertion: sentence,
      confidence: Math.round(finalConfidence * 100) / 100,
      dependencies,
      source: sourceType || 'unknown',
      reasoning: classification.reasoning,
    });

    layerCounts[classification.layer]++;
  }

  // Compute coverage
  const gaps = ALL_LAYERS.filter(layer => layerCounts[layer] === 0);

  return {
    candidates,
    coverage: {
      layers: layerCounts,
      gaps,
    },
  };
}

// ============================================================================
// Exports
// ============================================================================

module.exports = {
  mineNarrativeUnits,
  // Exported for testing
  splitSentences,
  classifyLayer,
  findDependencies,
  generateUnitId,
  LAYER_SIGNALS,
  ALL_LAYERS,
};
