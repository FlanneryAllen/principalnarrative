/**
 * storymining-llm.js — LLM-Enhanced Narrative Unit Discovery Engine
 *
 * Wraps the rule-based storymining.js and adds optional LLM extraction.
 * If no API key is provided, falls back to rule-based extraction seamlessly.
 *
 * Supports: OpenAI (gpt-4o, gpt-4o-mini) and Anthropic (claude-3.5-sonnet)
 * Config via env: OPENAI_API_KEY or ANTHROPIC_API_KEY
 *
 * Zero external dependencies — Node.js https module only.
 */

'use strict';

const https = require('https');
const { mineNarrativeUnits } = require('./storymining');

// ============================================================================
// LLM Configuration
// ============================================================================

function getLLMConfig() {
  const openaiKey = process.env.OPENAI_API_KEY || '';
  const anthropicKey = process.env.ANTHROPIC_API_KEY || '';

  if (openaiKey) {
    return { available: true, provider: 'openai', model: 'gpt-4o-mini' };
  }
  if (anthropicKey) {
    return { available: true, provider: 'anthropic', model: 'claude-3-5-sonnet-20241022' };
  }
  return { available: false, provider: 'none', model: null };
}

// ============================================================================
// LLM Prompt Construction
// ============================================================================

const SOURCE_TYPE_HINTS = {
  press_release: 'This text is a press release. Expect communication-layer and evidence-layer units. Look for announcements, quotes, and metrics.',
  strategy: 'This text is a strategy document. Expect core_story and positioning-layer units. Look for mission, vision, and competitive claims.',
  customer_story: 'This text is a customer story/case study. Expect evidence-layer and product_narrative-layer units. Look for metrics, results, and product capabilities.',
  meeting_notes: 'This text is meeting notes. Expect operational-layer units. Look for process decisions, action items, and methodology choices.',
  product_doc: 'This text is product documentation. Expect product_narrative-layer units. Look for feature descriptions, capabilities, and technical claims.',
  investor: 'This text is investor materials. Expect positioning and evidence-layer units. Look for market claims, financial metrics, and growth assertions.',
  marketing: 'This text is marketing content. Expect communication and positioning-layer units. Look for value propositions and brand claims.',
};

function buildPrompt(text, options = {}) {
  const sourceHint = options.sourceType && SOURCE_TYPE_HINTS[options.sourceType]
    ? SOURCE_TYPE_HINTS[options.sourceType]
    : 'Source type was not specified. Classify units based on content analysis.';

  let existingContext = '';
  if (options.existingGraph && options.existingGraph.length > 0) {
    const existing = options.existingGraph.slice(0, 20).map(u =>
      `- ${u.id} (${u.type}): "${u.assertion}"`
    ).join('\n');
    existingContext = `\nEXISTING NARRATIVE UNITS (link dependencies to these if relevant):\n${existing}\n`;
  }

  return `You are an expert narrative intelligence analyst. Your job is to extract narrative units from unstructured text.

A narrative unit is an atomic assertion that an organization holds to be true. Think of it like a row in a database — it's the fundamental primitive of organizational narrative.

Each narrative unit has:
- id: a short snake_case identifier (e.g., "cs_purpose_secure_world")
- type: one of exactly 6 layers:
  * core_story — fundamental purpose, mission, why we exist (the "north star")
  * positioning — market differentiation, competitive advantages, unique value
  * product_narrative — what we build, features, capabilities, technical claims
  * operational — processes, team practices, methodologies, internal standards
  * evidence — measurable proof: metrics, KPIs, customer results, data points
  * communication — public-facing claims: press releases, blog posts, marketing copy
- assertion: a clear, declarative statement (1-2 sentences max)
- confidence: 0.0 to 1.0, how certain you are this is a genuine narrative unit (not filler)
- dependencies: array of other unit IDs this unit depends on (e.g., a product claim depends on a core story)
- reasoning: brief explanation of WHY you classified this way

IMPORTANT GUIDELINES:
- Extract ASSERTIONS, not descriptions. "We believe security is a fundamental right" is an assertion. "The company has offices in 5 countries" is a description (skip it unless it supports a claim).
- A single document might contain units across multiple layers. Strategy docs often have core_story + positioning. Customer stories often have evidence + product_narrative.
- For dependencies: if a product claim ("Our platform detects threats in real-time") clearly supports a positioning claim ("We are the industry leader in threat response"), the product unit should list the positioning unit as a dependency.
- Confidence should reflect clarity and strength. "We achieved 40% reduction in response time" (high confidence evidence) vs "We aim to improve outcomes" (low confidence, vague).
- Generate IDs using the format: {layer_prefix}_{2-4_key_words}. Layer prefixes: cs (core_story), pos (positioning), pn (product_narrative), op (operational), ev (evidence), com (communication).

${sourceHint}

${existingContext}

Extract all narrative units from the following text. Return ONLY valid JSON, no other text.

Output format:
{
  "units": [
    {
      "id": "cs_purpose_example",
      "type": "core_story",
      "assertion": "...",
      "confidence": 0.85,
      "dependencies": [],
      "reasoning": "..."
    }
  ],
  "summary": "Brief 1-sentence summary of what this content is about",
  "dominant_layer": "the layer with most units"
}

TEXT TO ANALYZE:
---
${text}
---`;
}

// ============================================================================
// HTTPS Request Helper
// ============================================================================

function httpsRequest(options, body) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      req.destroy();
      reject(new Error('LLM API request timed out after 30s'));
    }, 30000);

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        clearTimeout(timeout);
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ============================================================================
// LLM API Calls
// ============================================================================

async function callOpenAI(prompt, model) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  const response = await httpsRequest({
    hostname: 'api.openai.com',
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
  }, {
    model: model || 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  });

  if (response.status !== 200) {
    throw new Error(`OpenAI API error ${response.status}: ${JSON.stringify(response.body)}`);
  }

  const content = response.body.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response from OpenAI');

  const tokensUsed = response.body.usage?.total_tokens || 0;
  return { parsed: JSON.parse(content), tokensUsed };
}

async function callAnthropic(prompt, model) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const response = await httpsRequest({
    hostname: 'api.anthropic.com',
    path: '/v1/messages',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
  }, {
    model: model || 'claude-3-5-sonnet-20241022',
    max_tokens: 4096,
    system: 'You are a narrative intelligence analyst. Always respond with valid JSON only, no other text.',
    messages: [{ role: 'user', content: prompt }],
  });

  if (response.status !== 200) {
    throw new Error(`Anthropic API error ${response.status}: ${JSON.stringify(response.body)}`);
  }

  const content = response.body.content?.[0]?.text;
  if (!content) throw new Error('Empty response from Anthropic');

  const tokensUsed = (response.body.usage?.input_tokens || 0) + (response.body.usage?.output_tokens || 0);
  return { parsed: JSON.parse(content), tokensUsed };
}

// ============================================================================
// Merge Logic
// ============================================================================

/**
 * Compute word overlap similarity between two strings.
 * Returns a value between 0 and 1.
 */
function wordOverlapSimilarity(a, b) {
  const wordsA = new Set(a.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2));
  const wordsB = new Set(b.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  const intersection = [...wordsA].filter(w => wordsB.has(w)).length;
  const union = new Set([...wordsA, ...wordsB]).size;
  return union > 0 ? intersection / union : 0;
}

/**
 * Merge LLM and rule-based candidates with deduplication.
 */
function mergeCandidates(llmCandidates, ruleCandidates) {
  const merged = [];
  const matchedRuleIds = new Set();

  for (const llmCandidate of llmCandidates) {
    let bestMatch = null;
    let bestSimilarity = 0;

    for (const ruleCandidate of ruleCandidates) {
      if (matchedRuleIds.has(ruleCandidate.id)) continue;
      const similarity = wordOverlapSimilarity(llmCandidate.assertion, ruleCandidate.assertion);
      if (similarity > 0.6 && similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = ruleCandidate;
      }
    }

    if (bestMatch) {
      matchedRuleIds.add(bestMatch.id);
      merged.push({
        ...llmCandidate,
        confidence: Math.min(1.0, llmCandidate.confidence + 0.1),
        extractionMethod: 'both',
      });
    } else {
      merged.push({
        ...llmCandidate,
        extractionMethod: 'llm',
      });
    }
  }

  // Add unmatched rule-based candidates
  for (const ruleCandidate of ruleCandidates) {
    if (!matchedRuleIds.has(ruleCandidate.id)) {
      merged.push({
        ...ruleCandidate,
        extractionMethod: 'rule',
      });
    }
  }

  // Sort by confidence descending
  merged.sort((a, b) => b.confidence - a.confidence);

  return merged;
}

// ============================================================================
// Validate LLM Output
// ============================================================================

const VALID_LAYERS = new Set([
  'core_story', 'positioning', 'product_narrative',
  'operational', 'evidence', 'communication',
]);

function validateLLMUnits(parsed) {
  if (!parsed || !Array.isArray(parsed.units)) return [];

  return parsed.units.filter(u => {
    if (!u.id || typeof u.id !== 'string') return false;
    if (!u.type || !VALID_LAYERS.has(u.type)) return false;
    if (!u.assertion || typeof u.assertion !== 'string') return false;
    if (typeof u.confidence !== 'number' || u.confidence < 0 || u.confidence > 1) {
      u.confidence = 0.5; // default if invalid
    }
    if (!Array.isArray(u.dependencies)) u.dependencies = [];
    if (!u.reasoning) u.reasoning = 'LLM extraction';
    return true;
  }).map(u => ({
    id: u.id,
    type: u.type,
    assertion: u.assertion,
    confidence: Math.round(u.confidence * 100) / 100,
    dependencies: u.dependencies,
    source: 'llm',
    reasoning: u.reasoning,
  }));
}

// ============================================================================
// Main API
// ============================================================================

/**
 * LLM-enhanced narrative unit mining.
 *
 * @param {string} text - Raw content to mine
 * @param {Object} [options]
 * @param {string} [options.llmProvider] - 'openai' | 'anthropic' | 'none' (default: auto-detect)
 * @param {string} [options.llmModel] - Model name override
 * @param {string} [options.sourceType] - Source type hint
 * @param {Array}  [options.existingGraph] - Existing units for dependency matching
 * @returns {{ candidates: Array, coverage: Object, meta: Object }}
 */
async function llmMineNarrativeUnits(text, options = {}) {
  const config = getLLMConfig();
  const provider = options.llmProvider || config.provider;
  const model = options.llmModel || config.model;

  // Always run rule-based extraction
  const ruleResult = mineNarrativeUnits(text, {
    sourceType: options.sourceType,
    existingGraph: options.existingGraph,
  });

  // If no LLM available or provider set to 'none', return rule-based only
  if (provider === 'none' || !config.available) {
    return {
      candidates: ruleResult.candidates.map(c => ({ ...c, extractionMethod: 'rule' })),
      coverage: ruleResult.coverage,
      meta: {
        llmProvider: 'none',
        llmModel: null,
        llmTokensUsed: 0,
        ruleBasedCount: ruleResult.candidates.length,
        llmCount: 0,
        mergedCount: ruleResult.candidates.length,
      },
    };
  }

  // Try LLM extraction
  let llmCandidates = [];
  let tokensUsed = 0;
  let llmError = null;

  try {
    const prompt = buildPrompt(text, options);

    let result;
    if (provider === 'openai') {
      result = await callOpenAI(prompt, model);
    } else if (provider === 'anthropic') {
      result = await callAnthropic(prompt, model);
    } else {
      throw new Error(`Unknown LLM provider: ${provider}`);
    }

    llmCandidates = validateLLMUnits(result.parsed);
    tokensUsed = result.tokensUsed;
  } catch (err) {
    llmError = err.message;
    console.error('LLM extraction failed, falling back to rule-based:', err.message);
  }

  // If LLM failed, return rule-based with error info
  if (llmCandidates.length === 0 && llmError) {
    return {
      candidates: ruleResult.candidates.map(c => ({ ...c, extractionMethod: 'rule' })),
      coverage: ruleResult.coverage,
      meta: {
        llmProvider: provider,
        llmModel: model,
        llmTokensUsed: 0,
        llmError,
        ruleBasedCount: ruleResult.candidates.length,
        llmCount: 0,
        mergedCount: ruleResult.candidates.length,
      },
    };
  }

  // Merge LLM + rule-based results
  const merged = mergeCandidates(llmCandidates, ruleResult.candidates);

  // Recompute coverage from merged results
  const ALL_LAYERS = ['core_story', 'positioning', 'product_narrative', 'operational', 'evidence', 'communication'];
  const layerCounts = {};
  for (const layer of ALL_LAYERS) layerCounts[layer] = 0;
  for (const c of merged) {
    if (layerCounts[c.type] !== undefined) layerCounts[c.type]++;
  }
  const gaps = ALL_LAYERS.filter(layer => layerCounts[layer] === 0);

  return {
    candidates: merged,
    coverage: { layers: layerCounts, gaps },
    meta: {
      llmProvider: provider,
      llmModel: model,
      llmTokensUsed: tokensUsed,
      llmError: llmError || undefined,
      ruleBasedCount: ruleResult.candidates.length,
      llmCount: llmCandidates.length,
      mergedCount: merged.length,
    },
  };
}

// ============================================================================
// Exports
// ============================================================================

module.exports = {
  llmMineNarrativeUnits,
  getLLMConfig,
  // Exported for testing
  wordOverlapSimilarity,
  mergeCandidates,
  validateLLMUnits,
  buildPrompt,
  httpsRequest,
};
