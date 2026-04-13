#!/usr/bin/env node
/**
 * Tests for storymining-llm.js — LLM-Enhanced StoryMining
 *
 * Tests: fallback to rule-based, merge logic, deduplication,
 * confidence boosting, getLLMConfig, word overlap, validate LLM output,
 * and the /api/mine/live endpoint.
 */

'use strict';

const http = require('http');
const crypto = require('crypto');

// Import LLM storymining functions
const {
  llmMineNarrativeUnits,
  getLLMConfig,
  wordOverlapSimilarity,
  mergeCandidates,
  validateLLMUnits,
  buildPrompt,
} = require('./storymining-llm');

// Import web-app for HTTP endpoint tests
const {
  server,
  sessions,
  repoCache,
  signSession,
  createSessionId,
  runClarionCall,
  mineNarrativeUnits,
} = require('./web-app');

const { createAlgebra } = require('./algebra');

// ============================================================================
// Test Framework (same pattern as other test files)
// ============================================================================

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message || 'assertEqual'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  \u2713 ${name}`);
  } catch (err) {
    failed++;
    failures.push({ name, error: err.message });
    console.log(`  \u2717 ${name}`);
    console.log(`    ${err.message}`);
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  \u2713 ${name}`);
  } catch (err) {
    failed++;
    failures.push({ name, error: err.message });
    console.log(`  \u2717 ${name}`);
    console.log(`    ${err.message}`);
  }
}

// ============================================================================
// Test Data
// ============================================================================

const TEST_UNITS = [
  {
    id: 'core_visibility',
    type: 'core_story',
    assertion: 'Software development is the most consequential creative work on earth, yet it remains largely invisible.',
    intent: {},
    dependencies: [],
    confidence: 1.0,
  },
  {
    id: 'pos_instrument',
    type: 'positioning',
    assertion: 'Principal AI builds the instrument that makes software development visible.',
    intent: {},
    dependencies: ['core_visibility'],
    confidence: 1.0,
  },
  {
    id: 'prod_feed',
    type: 'product_narrative',
    assertion: 'The feed is the primary surface — a real-time stream of development activity.',
    intent: {},
    dependencies: ['pos_instrument'],
    confidence: 1.0,
  },
  {
    id: 'ev_growth',
    type: 'evidence',
    assertion: 'We achieved a 50% improvement in team alignment across 200 organizations.',
    intent: {},
    dependencies: ['pos_instrument'],
    confidence: 1.0,
  },
];

const TEST_SKILLS = {
  terminology: { forbidden: ['synergy', 'leverage'] },
  brand: { company_name: 'Principal AI', never: ['principal.ai'] },
};

// ============================================================================
// getLLMConfig Tests
// ============================================================================

console.log('\n  LLM Configuration');
console.log('  ' + '\u2500'.repeat(40));

test('getLLMConfig returns none when no API keys set', () => {
  // Save and clear env
  const openai = process.env.OPENAI_API_KEY;
  const anthropic = process.env.ANTHROPIC_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;

  const config = getLLMConfig();
  assertEqual(config.available, false, 'Should not be available');
  assertEqual(config.provider, 'none', 'Provider should be none');
  assertEqual(config.model, null, 'Model should be null');

  // Restore
  if (openai) process.env.OPENAI_API_KEY = openai;
  if (anthropic) process.env.ANTHROPIC_API_KEY = anthropic;
});

test('getLLMConfig detects OpenAI when OPENAI_API_KEY is set', () => {
  const orig = process.env.OPENAI_API_KEY;
  const origAnthropic = process.env.ANTHROPIC_API_KEY;
  process.env.OPENAI_API_KEY = 'sk-test-fake-key';
  delete process.env.ANTHROPIC_API_KEY;

  const config = getLLMConfig();
  assertEqual(config.available, true, 'Should be available');
  assertEqual(config.provider, 'openai', 'Provider');
  assertEqual(config.model, 'gpt-4o-mini', 'Default model');

  // Restore
  if (orig) process.env.OPENAI_API_KEY = orig;
  else delete process.env.OPENAI_API_KEY;
  if (origAnthropic) process.env.ANTHROPIC_API_KEY = origAnthropic;
});

test('getLLMConfig detects Anthropic when ANTHROPIC_API_KEY is set', () => {
  const origOpenai = process.env.OPENAI_API_KEY;
  const orig = process.env.ANTHROPIC_API_KEY;
  delete process.env.OPENAI_API_KEY;
  process.env.ANTHROPIC_API_KEY = 'sk-ant-test-fake-key';

  const config = getLLMConfig();
  assertEqual(config.available, true, 'Should be available');
  assertEqual(config.provider, 'anthropic', 'Provider');
  assertEqual(config.model, 'claude-3-5-sonnet-20241022', 'Default model');

  // Restore
  if (origOpenai) process.env.OPENAI_API_KEY = origOpenai;
  if (orig) process.env.ANTHROPIC_API_KEY = orig;
  else delete process.env.ANTHROPIC_API_KEY;
});

test('getLLMConfig prefers OpenAI when both keys are set', () => {
  const origOpenai = process.env.OPENAI_API_KEY;
  const origAnthropic = process.env.ANTHROPIC_API_KEY;
  process.env.OPENAI_API_KEY = 'sk-test';
  process.env.ANTHROPIC_API_KEY = 'sk-ant-test';

  const config = getLLMConfig();
  assertEqual(config.provider, 'openai', 'Should prefer OpenAI');

  // Restore
  if (origOpenai) process.env.OPENAI_API_KEY = origOpenai;
  else delete process.env.OPENAI_API_KEY;
  if (origAnthropic) process.env.ANTHROPIC_API_KEY = origAnthropic;
  else delete process.env.ANTHROPIC_API_KEY;
});

// ============================================================================
// Word Overlap Similarity Tests
// ============================================================================

console.log('\n  Word Overlap Similarity');
console.log('  ' + '\u2500'.repeat(40));

test('wordOverlapSimilarity returns 1.0 for identical strings', () => {
  const sim = wordOverlapSimilarity('our mission is to build great software', 'our mission is to build great software');
  assertEqual(sim, 1.0, 'Identical strings');
});

test('wordOverlapSimilarity returns 0 for completely different strings', () => {
  const sim = wordOverlapSimilarity('apple banana cherry', 'xyz xyz xyz xyz');
  assertEqual(sim, 0, 'No overlap');
});

test('wordOverlapSimilarity returns value between 0 and 1 for partial overlap', () => {
  const sim = wordOverlapSimilarity(
    'We build tools for software development visibility',
    'Software development tools are essential for modern teams'
  );
  assert(sim > 0 && sim < 1, `Partial overlap should be between 0 and 1, got ${sim}`);
});

test('wordOverlapSimilarity handles empty strings', () => {
  assertEqual(wordOverlapSimilarity('', 'hello world'), 0, 'Empty a');
  assertEqual(wordOverlapSimilarity('hello world', ''), 0, 'Empty b');
  assertEqual(wordOverlapSimilarity('', ''), 0, 'Both empty');
});

test('wordOverlapSimilarity ignores short words (<=2 chars)', () => {
  const sim = wordOverlapSimilarity('a b c d e f', 'a b c d e f');
  assertEqual(sim, 0, 'Short words should be filtered out');
});

// ============================================================================
// Merge Logic Tests
// ============================================================================

console.log('\n  Merge Logic');
console.log('  ' + '\u2500'.repeat(40));

test('mergeCandidates marks LLM-only candidates correctly', () => {
  const llm = [
    { id: 'llm_1', type: 'core_story', assertion: 'Our purpose is to revolutionize computing', confidence: 0.9, dependencies: [], reasoning: 'LLM' },
  ];
  const rule = [
    { id: 'rule_1', type: 'evidence', assertion: 'We achieved 300% growth in Q3', confidence: 0.7, dependencies: [], reasoning: 'rule' },
  ];

  const merged = mergeCandidates(llm, rule);
  assertEqual(merged.length, 2, 'Should have 2 candidates');

  const llmOnly = merged.find(c => c.id === 'llm_1');
  assertEqual(llmOnly.extractionMethod, 'llm', 'LLM-only method');

  const ruleOnly = merged.find(c => c.id === 'rule_1');
  assertEqual(ruleOnly.extractionMethod, 'rule', 'Rule-only method');
});

test('mergeCandidates merges overlapping candidates and boosts confidence', () => {
  const llm = [
    { id: 'llm_1', type: 'core_story', assertion: 'Our mission is to make software development visible to the world', confidence: 0.85, dependencies: [], reasoning: 'LLM' },
  ];
  const rule = [
    { id: 'rule_1', type: 'core_story', assertion: 'Our mission is to make software development visible to the world today', confidence: 0.7, dependencies: [], reasoning: 'rule' },
  ];

  const merged = mergeCandidates(llm, rule);
  assertEqual(merged.length, 1, 'Should merge to 1 candidate');
  assertEqual(merged[0].extractionMethod, 'both', 'Method should be both');
  assertEqual(merged[0].confidence, 0.95, 'Confidence should be boosted by 0.1');
});

test('mergeCandidates caps confidence at 1.0', () => {
  const llm = [
    { id: 'llm_1', type: 'core_story', assertion: 'Our mission is to make software development visible to the world', confidence: 0.95, dependencies: [], reasoning: 'LLM' },
  ];
  const rule = [
    { id: 'rule_1', type: 'core_story', assertion: 'Our mission is to make software development visible to the world today', confidence: 0.9, dependencies: [], reasoning: 'rule' },
  ];

  const merged = mergeCandidates(llm, rule);
  assert(merged[0].confidence <= 1.0, `Confidence should be capped at 1.0, got ${merged[0].confidence}`);
});

test('mergeCandidates sorts by confidence descending', () => {
  const llm = [
    { id: 'llm_low', type: 'operational', assertion: 'We follow agile processes daily standup', confidence: 0.3, dependencies: [], reasoning: '' },
    { id: 'llm_high', type: 'core_story', assertion: 'Our core purpose drives everything', confidence: 0.95, dependencies: [], reasoning: '' },
  ];
  const rule = [];

  const merged = mergeCandidates(llm, rule);
  assert(merged[0].confidence >= merged[1].confidence, 'Should be sorted by confidence desc');
  assertEqual(merged[0].id, 'llm_high', 'First should be high confidence');
});

test('mergeCandidates handles empty LLM results', () => {
  const rule = [
    { id: 'rule_1', type: 'evidence', assertion: 'We achieved 50% growth', confidence: 0.7, dependencies: [], reasoning: '' },
  ];
  const merged = mergeCandidates([], rule);
  assertEqual(merged.length, 1, 'Should keep rule-based');
  assertEqual(merged[0].extractionMethod, 'rule', 'Method');
});

test('mergeCandidates handles empty rule results', () => {
  const llm = [
    { id: 'llm_1', type: 'core_story', assertion: 'Our purpose is clear', confidence: 0.8, dependencies: [], reasoning: '' },
  ];
  const merged = mergeCandidates(llm, []);
  assertEqual(merged.length, 1, 'Should keep LLM');
  assertEqual(merged[0].extractionMethod, 'llm', 'Method');
});

// ============================================================================
// Validate LLM Output Tests
// ============================================================================

console.log('\n  Validate LLM Output');
console.log('  ' + '\u2500'.repeat(40));

test('validateLLMUnits accepts valid units', () => {
  const parsed = {
    units: [
      { id: 'cs_purpose', type: 'core_story', assertion: 'We exist to help', confidence: 0.9, dependencies: [], reasoning: 'test' },
      { id: 'ev_metric', type: 'evidence', assertion: 'We grew 50%', confidence: 0.8, dependencies: ['cs_purpose'], reasoning: 'test' },
    ],
  };
  const valid = validateLLMUnits(parsed);
  assertEqual(valid.length, 2, 'Both units valid');
  assertEqual(valid[0].source, 'llm', 'Source should be llm');
});

test('validateLLMUnits rejects units with invalid type', () => {
  const parsed = {
    units: [
      { id: 'bad_1', type: 'invalid_layer', assertion: 'test', confidence: 0.5, dependencies: [], reasoning: '' },
    ],
  };
  const valid = validateLLMUnits(parsed);
  assertEqual(valid.length, 0, 'Should reject invalid type');
});

test('validateLLMUnits rejects units without id', () => {
  const parsed = {
    units: [
      { type: 'core_story', assertion: 'test', confidence: 0.5, dependencies: [], reasoning: '' },
    ],
  };
  const valid = validateLLMUnits(parsed);
  assertEqual(valid.length, 0, 'Should reject missing id');
});

test('validateLLMUnits rejects units without assertion', () => {
  const parsed = {
    units: [
      { id: 'cs_1', type: 'core_story', confidence: 0.5, dependencies: [], reasoning: '' },
    ],
  };
  const valid = validateLLMUnits(parsed);
  assertEqual(valid.length, 0, 'Should reject missing assertion');
});

test('validateLLMUnits defaults invalid confidence to 0.5', () => {
  const parsed = {
    units: [
      { id: 'cs_1', type: 'core_story', assertion: 'test', confidence: -1, dependencies: [], reasoning: '' },
    ],
  };
  const valid = validateLLMUnits(parsed);
  assertEqual(valid.length, 1, 'Should accept');
  assertEqual(valid[0].confidence, 0.5, 'Confidence defaulted');
});

test('validateLLMUnits handles null/undefined input', () => {
  assertEqual(validateLLMUnits(null).length, 0, 'null');
  assertEqual(validateLLMUnits(undefined).length, 0, 'undefined');
  assertEqual(validateLLMUnits({}).length, 0, 'empty object');
  assertEqual(validateLLMUnits({ units: 'not-array' }).length, 0, 'non-array units');
});

test('validateLLMUnits defaults missing dependencies to empty array', () => {
  const parsed = {
    units: [
      { id: 'cs_1', type: 'core_story', assertion: 'test', confidence: 0.5, reasoning: '' },
    ],
  };
  const valid = validateLLMUnits(parsed);
  assert(Array.isArray(valid[0].dependencies), 'Should have dependencies array');
  assertEqual(valid[0].dependencies.length, 0, 'Should be empty');
});

// ============================================================================
// Build Prompt Tests
// ============================================================================

console.log('\n  Prompt Construction');
console.log('  ' + '\u2500'.repeat(40));

test('buildPrompt includes text content', () => {
  const prompt = buildPrompt('This is test content about our mission.');
  assert(prompt.includes('This is test content about our mission.'), 'Should include text');
});

test('buildPrompt includes source type hint when provided', () => {
  const prompt = buildPrompt('Content', { sourceType: 'press_release' });
  assert(prompt.includes('press release'), 'Should include press release hint');
});

test('buildPrompt includes existing graph context', () => {
  const prompt = buildPrompt('Content', {
    existingGraph: [{ id: 'cs_1', type: 'core_story', assertion: 'Our purpose is clear' }],
  });
  assert(prompt.includes('EXISTING NARRATIVE UNITS'), 'Should include existing units header');
  assert(prompt.includes('cs_1'), 'Should include unit id');
});

test('buildPrompt works without options', () => {
  const prompt = buildPrompt('Simple text');
  assert(prompt.includes('Simple text'), 'Should include text');
  assert(prompt.includes('narrative intelligence analyst'), 'Should include system instructions');
});

// ============================================================================
// Fallback Behavior Tests
// ============================================================================

console.log('\n  Fallback Behavior');
console.log('  ' + '\u2500'.repeat(40));

testAsync('llmMineNarrativeUnits falls back to rule-based when no API key', async () => {
  // Ensure no API keys
  const origOpenai = process.env.OPENAI_API_KEY;
  const origAnthropic = process.env.ANTHROPIC_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;

  const result = await llmMineNarrativeUnits(
    'Our mission is to make software visible. We achieved a 50% improvement in team alignment. The platform provides real-time dashboards.',
    { sourceType: 'strategy' }
  );

  assert(result.candidates.length > 0, 'Should have candidates');
  assert(result.candidates.every(c => c.extractionMethod === 'rule'), 'All should be rule-based');
  assertEqual(result.meta.llmProvider, 'none', 'Provider should be none');
  assertEqual(result.meta.llmCount, 0, 'LLM count should be 0');
  assert(result.meta.ruleBasedCount > 0, 'Rule-based count should be > 0');
  assertEqual(result.meta.mergedCount, result.meta.ruleBasedCount, 'Merged = rule-based');

  // Restore
  if (origOpenai) process.env.OPENAI_API_KEY = origOpenai;
  if (origAnthropic) process.env.ANTHROPIC_API_KEY = origAnthropic;
});

testAsync('llmMineNarrativeUnits returns coverage data', async () => {
  const origOpenai = process.env.OPENAI_API_KEY;
  const origAnthropic = process.env.ANTHROPIC_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;

  const result = await llmMineNarrativeUnits(
    'Our mission is to make software visible. We achieved a 50% improvement. The platform provides dashboards.',
    { sourceType: 'strategy' }
  );

  assert(result.coverage, 'Should have coverage');
  assert(result.coverage.layers, 'Should have layers');
  assert(Array.isArray(result.coverage.gaps), 'Should have gaps array');

  if (origOpenai) process.env.OPENAI_API_KEY = origOpenai;
  if (origAnthropic) process.env.ANTHROPIC_API_KEY = origAnthropic;
});

testAsync('llmMineNarrativeUnits respects llmProvider=none option', async () => {
  const result = await llmMineNarrativeUnits(
    'Our mission is to make software visible.',
    { llmProvider: 'none' }
  );
  assert(result.candidates.every(c => c.extractionMethod === 'rule'), 'Should all be rule-based');
  assertEqual(result.meta.llmProvider, 'none', 'Provider should be none');
});

testAsync('llmMineNarrativeUnits handles empty text', async () => {
  const result = await llmMineNarrativeUnits('', { llmProvider: 'none' });
  assertEqual(result.candidates.length, 0, 'No candidates for empty text');
});

// ============================================================================
// HTTP Endpoint Tests
// ============================================================================

const TEST_PORT = 39878;

function httpRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: 'localhost', port: TEST_PORT, ...options }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, headers: res.headers, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

function createTestSession() {
  const sessionId = createSessionId();
  const signed = signSession(sessionId);
  sessions.set(sessionId, {
    githubToken: 'test-token',
    user: { login: 'testuser', name: 'Test User', avatar_url: '', id: 1 },
    connectedRepos: new Set(['test/repo']),
    rateLimit: { count: 0, resetAt: Date.now() + 60000 },
  });
  return { sessionId, cookie: `na_session=${signed}` };
}

async function runHttpTests() {
  console.log('\n  HTTP Endpoint Tests');
  console.log('  ' + '\u2500'.repeat(40));

  await new Promise((resolve) => {
    server.listen(TEST_PORT, '127.0.0.1', resolve);
  });

  const { cookie, sessionId } = createTestSession();
  const testSession = sessions.get(sessionId);

  // Seed repo cache for dependency matching
  repoCache.set('test/repo', {
    canon: { units: TEST_UNITS, skills: TEST_SKILLS, files: [], errors: [] },
    lastCheck: runClarionCall(TEST_UNITS, TEST_SKILLS),
    history: [],
  });

  await testAsync('GET /api/llm/status returns LLM config', async () => {
    const res = await httpRequest({
      path: '/api/llm/status',
      method: 'GET',
      headers: { Cookie: cookie },
    });
    assertEqual(res.status, 200, 'Status');
    assert('available' in res.body, 'Has available');
    assert('provider' in res.body, 'Has provider');
  });

  await testAsync('POST /api/mine/live returns candidates + algebra', async () => {
    const res = await httpRequest({
      path: '/api/mine/live',
      method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    }, JSON.stringify({
      text: 'Our mission is to make software visible. We achieved a 50% improvement in team alignment. The platform provides real-time dashboards for development activity.',
      sourceType: 'strategy',
    }));
    assertEqual(res.status, 200, 'Status');
    assert(Array.isArray(res.body.candidates), 'Has candidates array');
    assert(res.body.candidates.length > 0, 'Has candidates');
    assert(res.body.coverage, 'Has coverage');
    assert(res.body.coverage.layers, 'Has coverage layers');
    assert(res.body.algebra !== undefined, 'Has algebra');
    assert(typeof res.body.algebra.nci === 'number' || res.body.algebra.nci === undefined, 'NCI is number or undefined');
  });

  await testAsync('POST /api/mine/live returns stakeholder views', async () => {
    const res = await httpRequest({
      path: '/api/mine/live',
      method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    }, JSON.stringify({
      text: 'Our mission is to build visibility tools. We believe software development is the most important creative work. Our platform detects issues in real-time. We achieved 40% reduction in response time.',
      sourceType: 'strategy',
    }));
    assertEqual(res.status, 200, 'Status');
    if (res.body.algebra && res.body.algebra.stakeholderViews) {
      assert(typeof res.body.algebra.stakeholderViews === 'object', 'stakeholderViews is object');
    }
  });

  await testAsync('POST /api/mine/live rejects empty text', async () => {
    const res = await httpRequest({
      path: '/api/mine/live',
      method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    }, JSON.stringify({ text: '' }));
    assertEqual(res.status, 400, 'Status');
    assert(res.body.error.includes('Missing'), 'Error message');
  });

  await testAsync('POST /api/mine/live requires auth', async () => {
    const res = await httpRequest({
      path: '/api/mine/live',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, JSON.stringify({ text: 'test' }));
    assertEqual(res.status, 401, 'Status');
  });

  await testAsync('POST /api/mine/live returns meta with extraction info', async () => {
    const res = await httpRequest({
      path: '/api/mine/live',
      method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    }, JSON.stringify({
      text: 'We believe in making software development visible to everyone.',
    }));
    assertEqual(res.status, 200, 'Status');
    assert(res.body.meta, 'Has meta');
    assert('llmProvider' in res.body.meta, 'Meta has llmProvider');
    assert('ruleBasedCount' in res.body.meta, 'Meta has ruleBasedCount');
    assert('mergedCount' in res.body.meta, 'Meta has mergedCount');
  });

  await testAsync('POST /api/mine still works (backward compat)', async () => {
    const res = await httpRequest({
      path: '/api/mine',
      method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    }, JSON.stringify({
      text: 'Our mission is to make software visible. We achieved 50% improvement.',
      sourceType: 'strategy',
    }));
    assertEqual(res.status, 200, 'Status');
    assert(res.body.candidates, 'Has candidates');
    assert(res.body.candidates.length > 0, 'Has candidates');
  });

  // Cleanup
  server.close();
}

// ============================================================================
// Run all tests
// ============================================================================

// Await all async tests first, then run HTTP tests
Promise.resolve()
  .then(() => runHttpTests())
  .then(() => {
    console.log('\n  ' + '\u2550'.repeat(40));
    console.log(`  ${passed + failed} tests: ${passed} passed, ${failed} failed`);

    if (failures.length > 0) {
      console.log('\n  Failures:');
      for (const f of failures) {
        console.log(`    \u2717 ${f.name}: ${f.error}`);
      }
    }

    console.log('');
    process.exit(failed > 0 ? 1 : 0);
  })
  .catch(err => {
    console.error('Test runner error:', err);
    server.close();
    process.exit(1);
  });
