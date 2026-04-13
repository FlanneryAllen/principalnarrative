#!/usr/bin/env node
/**
 * Tests for web-app.js — the hosted SaaS server
 *
 * Tests session management, webhook verification, rate limiting,
 * API endpoints (with mocked GitHub), and algebra operations.
 */

'use strict';

const http = require('http');
const crypto = require('crypto');
const YAML = require('yaml');

// Import testable functions from web-app.js
const {
  signSession,
  verifySession,
  verifyWebhookSignature,
  checkRateLimit,
  runClarionCall,
  reviewContent,
  createSessionId,
  sessions,
  repoCache,
  server,
  RATE_LIMIT_MAX,
  unitsToYaml,
  skillsToTerminologyYaml,
  skillsToToneYaml,
} = require('./web-app');

const { createAlgebra, STAKEHOLDER_PRESETS, ALL_LAYERS } = require('./algebra');

// ============================================================================
// Test Framework (same pattern as test-algebra.js)
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

function assertIncludes(arr, item, message) {
  if (!arr.includes(item)) {
    throw new Error(`${message || 'assertIncludes'}: ${JSON.stringify(item)} not found in array`);
  }
}

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    failures.push({ name, error: err.message });
    console.log(`  ✗ ${name}`);
    console.log(`    ${err.message}`);
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    failures.push({ name, error: err.message });
    console.log(`  ✗ ${name}`);
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
    id: 'pos_not_devtool',
    type: 'positioning',
    assertion: 'This is not a developer tool. It is an organizational alignment platform.',
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
];

const TEST_SKILLS = {
  terminology: { forbidden: ['synergy', 'leverage'] },
  brand: { company_name: 'Principal AI', never: ['principal.ai', 'PrincipalAI'] },
};

// ============================================================================
// Session Tests
// ============================================================================

console.log('\n  Session Management');
console.log('  ' + '─'.repeat(40));

test('signSession produces a signed value with dot separator', () => {
  const id = createSessionId();
  const signed = signSession(id);
  assert(signed.includes('.'), 'Signed session should contain dot');
  const [sessionPart, sig] = signed.split('.');
  assertEqual(sessionPart, id, 'Session ID should be prefix');
  assert(sig.length === 64, 'HMAC-SHA256 hex should be 64 chars');
});

test('verifySession validates a correctly signed session', () => {
  const id = createSessionId();
  const signed = signSession(id);
  const result = verifySession(signed);
  assertEqual(result, id, 'Should return the session ID');
});

test('verifySession rejects a tampered session', () => {
  const id = createSessionId();
  const signed = signSession(id);
  // Tamper with the signature
  const tampered = signed.slice(0, -4) + 'beef';
  const result = verifySession(tampered);
  assertEqual(result, null, 'Should return null for tampered session');
});

test('verifySession rejects null/undefined/empty', () => {
  assertEqual(verifySession(null), null, 'null');
  assertEqual(verifySession(undefined), null, 'undefined');
  assertEqual(verifySession(''), null, 'empty string');
  assertEqual(verifySession('noseparator'), null, 'no dot');
});

// ============================================================================
// Webhook Verification Tests
// ============================================================================

console.log('\n  Webhook Verification');
console.log('  ' + '─'.repeat(40));

test('verifyWebhookSignature accepts valid signature', () => {
  // This test only works if WEBHOOK_SECRET is set
  if (!process.env.WEBHOOK_SECRET) {
    // Mock it by testing the function with known values
    // The function checks WEBHOOK_SECRET env var internally
    // Since it's empty, it should return false
    const result = verifyWebhookSignature('test', 'sha256=abc');
    assertEqual(result, false, 'Should reject when no WEBHOOK_SECRET set');
    return;
  }
  const payload = '{"action":"push"}';
  const hmac = crypto.createHmac('sha256', process.env.WEBHOOK_SECRET);
  hmac.update(payload);
  const sig = 'sha256=' + hmac.digest('hex');
  assert(verifyWebhookSignature(payload, sig), 'Valid signature should pass');
});

test('verifyWebhookSignature rejects invalid signature', () => {
  const result = verifyWebhookSignature('test', 'sha256=invalid');
  assertEqual(result, false, 'Invalid signature should fail');
});

// ============================================================================
// Rate Limiting Tests
// ============================================================================

console.log('\n  Rate Limiting');
console.log('  ' + '─'.repeat(40));

test('checkRateLimit allows requests within limit', () => {
  const session = { rateLimit: { count: 0, resetAt: Date.now() + 60000 } };
  assert(checkRateLimit(session), 'First request should be allowed');
  assertEqual(session.rateLimit.count, 1, 'Count should increment');
});

test('checkRateLimit blocks requests over limit', () => {
  const session = { rateLimit: { count: RATE_LIMIT_MAX, resetAt: Date.now() + 60000 } };
  const result = checkRateLimit(session);
  assertEqual(result, false, 'Should block over-limit requests');
});

test('checkRateLimit resets after window expires', () => {
  const session = { rateLimit: { count: RATE_LIMIT_MAX + 10, resetAt: Date.now() - 1 } };
  assert(checkRateLimit(session), 'Should allow after window reset');
  assertEqual(session.rateLimit.count, 1, 'Count should reset to 1');
});

// ============================================================================
// Clarion Call Tests
// ============================================================================

console.log('\n  Clarion Call (web)');
console.log('  ' + '─'.repeat(40));

test('runClarionCall returns correct structure', () => {
  const result = runClarionCall(TEST_UNITS, TEST_SKILLS, 'test');
  assert(result.timestamp, 'Should have timestamp');
  assertEqual(result.trigger, 'test', 'Trigger');
  assertEqual(result.totalUnits, 4, 'Total units');
  assert(typeof result.coherenceScore === 'number', 'coherenceScore should be number');
  assert(typeof result.nci === 'number', 'NCI should be number');
  assert(typeof result.coverageRatio === 'number', 'Coverage ratio should be number');
  assert(typeof result.driftRate === 'number', 'Drift rate should be number');
  assert(result.layerHealth, 'Should have layerHealth');
  assert(Array.isArray(result.driftedUnits), 'driftedUnits should be array');
  assert(Array.isArray(result.gaps), 'gaps should be array');
  assert(Array.isArray(result.driftAlerts), 'driftAlerts should be array');
  assert(Array.isArray(result.terminologyViolations), 'terminologyViolations should be array');
  assert(Array.isArray(result.toneViolations), 'toneViolations should be array');
});

test('runClarionCall computes NCI correctly', () => {
  const result = runClarionCall(TEST_UNITS, TEST_SKILLS);
  // All 4 units should be ALIGNED (no broken deps, all connected)
  assertEqual(result.coherenceScore, 100, 'All units aligned = 100');
  assertEqual(result.nci, 1.0, 'NCI = 1.0');
});

test('runClarionCall detects terminology violations', () => {
  const unitsWithForbidden = [
    ...TEST_UNITS,
    { id: 'bad_unit', type: 'communication', assertion: 'We leverage synergy to drive value',
      intent: {}, dependencies: [], confidence: 1.0 },
  ];
  const result = runClarionCall(unitsWithForbidden, TEST_SKILLS);
  assert(result.terminologyViolations.length > 0, 'Should detect forbidden terms');
  assert(result.toneViolations.length > 0, 'Should detect tone violations');
});

// ============================================================================
// Review Content Tests
// ============================================================================

console.log('\n  Review Content');
console.log('  ' + '─'.repeat(40));

test('reviewContent detects forbidden terms', () => {
  const result = reviewContent('We leverage our platform synergy', TEST_SKILLS, TEST_UNITS);
  assert(result.violations.length >= 2, 'Should detect leverage and synergy');
});

test('reviewContent computes resonance', () => {
  const result = reviewContent(
    'Software development is invisible. We need to make it visible with Principal AI.',
    TEST_SKILLS, TEST_UNITS
  );
  assert(result.resonance, 'Should have resonance data');
  assert(result.resonance.resonance > 0, 'Should have positive resonance');
  assert(result.resonance.matchedUnits.length > 0, 'Should match some units');
});

test('reviewContent returns empty for clean text', () => {
  const result = reviewContent('This is a clean sentence about technology.', TEST_SKILLS, TEST_UNITS);
  assertEqual(result.violations.length, 0, 'No violations for clean text');
});

// ============================================================================
// Algebra Integration Tests (via web-app helpers)
// ============================================================================

console.log('\n  Algebra Integration');
console.log('  ' + '─'.repeat(40));

test('createAlgebra from canon units works', () => {
  const { algebra } = createAlgebra(TEST_UNITS);
  const metrics = algebra.computeMetrics();
  assertEqual(metrics.totalUnits, 4, 'Total units');
  assert(metrics.totalEdges > 0, 'Should have edges');
  assert(metrics.narrativeCoherenceIndex > 0, 'NCI should be positive');
});

test('stakeholder compose works through algebra', () => {
  const { algebra } = createAlgebra(TEST_UNITS);
  const board = algebra.composeForStakeholder('board');
  assert(board.units.length > 0, 'Board view should have units');
  assert(board.provenance.operation === 'compose', 'Should have compose provenance');
});

test('propagate works through algebra', () => {
  const { algebra } = createAlgebra(TEST_UNITS);
  const result = algebra.propagate('core_visibility');
  assert(result.affectedUnits.length > 0, 'Core visibility should affect other units');
  assert(result.scope > 0, 'Scope should be positive');
});

test('drift returns zero for healthy graph', () => {
  const { algebra } = createAlgebra(TEST_UNITS);
  const result = algebra.drift();
  assertEqual(result.driftRate, 0, 'No drift in healthy graph');
  assertEqual(result.driftedUnits.length, 0, 'No drifted units');
});

test('cover returns full coverage for connected graph', () => {
  const { algebra } = createAlgebra(TEST_UNITS);
  const result = algebra.cover();
  assertEqual(result.coverage, 1.0, 'Full coverage expected');
});

test('resonate scores text against units', () => {
  const { algebra } = createAlgebra(TEST_UNITS);
  const result = algebra.resonate('software development visibility instrument');
  assert(result.resonance > 0, 'Should resonate with graph keywords');
  assert(result.matchedUnits.length > 0, 'Should match units');
});

test('validate marks all units ALIGNED in healthy graph', () => {
  const { algebra } = createAlgebra(TEST_UNITS);
  const results = algebra.validateAll();
  for (const r of results) {
    assertEqual(r.newState, 'ALIGNED', `${r.unitId} should be ALIGNED`);
  }
});

// ============================================================================
// YAML Serializer Tests
// ============================================================================

console.log('\n  YAML Serializers');
console.log('  ' + '─'.repeat(40));

test('unitsToYaml produces valid YAML with all fields', () => {
  const yaml = unitsToYaml(TEST_UNITS, { owner: 'test@example.com' });
  assert(yaml.includes('core_visibility'), 'Should contain unit ID');
  assert(yaml.includes('Software'), 'Should contain assertion text');
  assert(yaml.includes('core_story'), 'Should contain type');
  assert(yaml.includes('owner:'), 'Should contain owner metadata');
  // Parse it back to verify round-trip
  const parsed = YAML.parse(yaml);
  assertEqual(parsed.units.length, 4, 'Should have 4 units after round-trip');
  assertEqual(parsed.units[0].id, 'core_visibility', 'First unit ID preserved');
});

test('unitsToYaml handles units with intent', () => {
  const units = [{
    id: 'test_unit', type: 'core_story', assertion: 'Test assertion',
    intent: { objective: 'Test', constraints: { content: { required_themes: ['a', 'b'] } } },
    dependencies: [], confidence: 0.8,
  }];
  const yaml = unitsToYaml(units);
  const parsed = YAML.parse(yaml);
  assert(parsed.units[0].intent.objective === 'Test', 'Intent preserved');
  assert(parsed.units[0].confidence === 0.8, 'Confidence preserved');
});

test('skillsToTerminologyYaml produces valid YAML', () => {
  const yaml = skillsToTerminologyYaml({
    brand: { company_name: 'Acme', never: ['ACME', 'acme'] },
    products: [{ name: 'Widget', never: ['widget'] }],
    terminology: { forbidden: ['synergy', 'leverage'] },
  });
  const parsed = YAML.parse(yaml);
  assertEqual(parsed.brand.company_name, 'Acme', 'Brand name');
  assertEqual(parsed.products.length, 1, 'Products count');
  assertEqual(parsed.terminology.forbidden.length, 2, 'Forbidden terms count');
});

test('skillsToToneYaml produces valid YAML', () => {
  const yaml = skillsToToneYaml({
    owner: 'test@example.com',
    voice: { name: 'Test Voice', summary: 'Be clear.', principles: [{ id: 'p1', rule: 'Be direct' }] },
    terminology: { forbidden: ['buzzword'] },
  });
  const parsed = YAML.parse(yaml);
  assert(parsed.voice.name === 'Test Voice', 'Voice name');
  assert(parsed.voice.principles.length === 1, 'Principles count');
  assert(parsed.owner === 'test@example.com', 'Owner preserved');
});

// ============================================================================
// HTTP Server Tests (quick functional tests)
// ============================================================================

console.log('\n  HTTP Server');
console.log('  ' + '─'.repeat(40));

const TEST_PORT = 39876;

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

// Create a test session for authenticated requests
function createTestSession() {
  const sessionId = createSessionId();
  const signed = signSession(sessionId);
  sessions.set(sessionId, {
    githubToken: 'test-token',
    user: { login: 'testuser', name: 'Test User', avatar_url: '', id: 1 },
    connectedRepos: new Set(['test/repo']),
    rateLimit: { count: 0, resetAt: Date.now() + 60000 },
  });

  // Seed repo cache with test data
  repoCache.set('test/repo', {
    canon: { units: TEST_UNITS, skills: TEST_SKILLS, files: [], errors: [] },
    lastCheck: runClarionCall(TEST_UNITS, TEST_SKILLS),
    history: [],
  });

  return { sessionId, cookie: `na_session=${signed}` };
}

async function runHttpTests() {
  // Start server on test port
  await new Promise((resolve) => {
    server.listen(TEST_PORT, '127.0.0.1', resolve);
  });

  const { cookie } = createTestSession();

  await testAsync('GET / serves dashboard HTML', async () => {
    const res = await httpRequest({ path: '/', method: 'GET' });
    assertEqual(res.status, 200, 'Status');
    assert(typeof res.body === 'string' && res.body.includes('Narrative Agent'), 'Should contain dashboard HTML');
  });

  await testAsync('GET /api/me without auth returns 401', async () => {
    const res = await httpRequest({ path: '/api/me', method: 'GET' });
    assertEqual(res.status, 401, 'Status');
  });

  await testAsync('GET /api/me with auth returns user', async () => {
    const res = await httpRequest({ path: '/api/me', method: 'GET', headers: { Cookie: cookie } });
    assertEqual(res.status, 200, 'Status');
    assertEqual(res.body.user.login, 'testuser', 'Login');
    assert(res.body.connectedRepos.includes('test/repo'), 'Connected repos');
  });

  await testAsync('GET /api/repos without auth returns 401', async () => {
    const res = await httpRequest({ path: '/api/repos', method: 'GET' });
    assertEqual(res.status, 401, 'Status');
  });

  await testAsync('GET /api/repos/:owner/:repo/metrics returns algebra metrics', async () => {
    const res = await httpRequest({ path: '/api/repos/test/repo/metrics', method: 'GET', headers: { Cookie: cookie } });
    assertEqual(res.status, 200, 'Status');
    assert(typeof res.body.narrativeCoherenceIndex === 'number', 'Has NCI');
    assertEqual(res.body.totalUnits, 4, 'Total units');
    assert(res.body.totalEdges > 0, 'Has edges');
    assert(res.body.layerHealth, 'Has layer health');
  });

  await testAsync('GET /api/repos/:owner/:repo/compose?stakeholder=board works', async () => {
    const res = await httpRequest({ path: '/api/repos/test/repo/compose?stakeholder=board', method: 'GET', headers: { Cookie: cookie } });
    assertEqual(res.status, 200, 'Status');
    assert(res.body.unitCount > 0, 'Has units');
    assertEqual(res.body.stakeholder, 'board', 'Stakeholder');
    assert(Array.isArray(res.body.units), 'Units is array');
    assert(Array.isArray(res.body.edges), 'Edges is array');
  });

  await testAsync('GET /api/repos/:owner/:repo/compose rejects invalid stakeholder', async () => {
    const res = await httpRequest({ path: '/api/repos/test/repo/compose?stakeholder=invalid', method: 'GET', headers: { Cookie: cookie } });
    assertEqual(res.status, 400, 'Status');
    assert(res.body.error.includes('Invalid stakeholder'), 'Error message');
  });

  await testAsync('GET /api/repos/:owner/:repo/propagate?unit=core_visibility works', async () => {
    const res = await httpRequest({ path: '/api/repos/test/repo/propagate?unit=core_visibility', method: 'GET', headers: { Cookie: cookie } });
    assertEqual(res.status, 200, 'Status');
    assert(res.body.affectedCount > 0, 'Has affected units');
    assert(res.body.scope > 0, 'Has scope');
  });

  await testAsync('GET /api/repos/:owner/:repo/propagate rejects missing unit', async () => {
    const res = await httpRequest({ path: '/api/repos/test/repo/propagate', method: 'GET', headers: { Cookie: cookie } });
    assertEqual(res.status, 400, 'Status');
  });

  await testAsync('GET /api/repos/:owner/:repo/drift returns drift data', async () => {
    const res = await httpRequest({ path: '/api/repos/test/repo/drift', method: 'GET', headers: { Cookie: cookie } });
    assertEqual(res.status, 200, 'Status');
    assertEqual(res.body.driftRate, 0, 'Zero drift');
    assert(Array.isArray(res.body.driftedUnits), 'Drifted units array');
  });

  await testAsync('GET /api/repos/:owner/:repo/cover returns coverage', async () => {
    const res = await httpRequest({ path: '/api/repos/test/repo/cover', method: 'GET', headers: { Cookie: cookie } });
    assertEqual(res.status, 200, 'Status');
    assertEqual(res.body.coverage, 1.0, 'Full coverage');
    assert(res.body.byLayer, 'Has by-layer data');
  });

  await testAsync('POST /api/repos/:owner/:repo/validate works', async () => {
    const res = await httpRequest({
      path: '/api/repos/test/repo/validate',
      method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    }, '{}');
    assertEqual(res.status, 200, 'Status');
    assert(Array.isArray(res.body.results), 'Results is array');
    assert(res.body.results.length === 4, 'All 4 units validated');
  });

  await testAsync('POST /api/repos/:owner/:repo/resonate works', async () => {
    const res = await httpRequest({
      path: '/api/repos/test/repo/resonate',
      method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    }, JSON.stringify({ signal: 'software development visibility' }));
    assertEqual(res.status, 200, 'Status');
    assert(typeof res.body.resonance === 'number', 'Has resonance score');
    assert(res.body.resonance > 0, 'Positive resonance');
  });

  await testAsync('POST /api/repos/:owner/:repo/resonate rejects empty signal', async () => {
    const res = await httpRequest({
      path: '/api/repos/test/repo/resonate',
      method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    }, JSON.stringify({ signal: '' }));
    assertEqual(res.status, 400, 'Status');
  });

  await testAsync('POST /api/repos/:owner/:repo/review works', async () => {
    const res = await httpRequest({
      path: '/api/repos/test/repo/review',
      method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    }, JSON.stringify({ text: 'We leverage synergy for Principal AI' }));
    assertEqual(res.status, 200, 'Status');
    assert(res.body.violations.length > 0, 'Should detect violations');
    assert(res.body.resonance, 'Should have resonance');
  });

  await testAsync('GET /api/repos/:owner/:repo/scan re-scans and returns results', async () => {
    const res = await httpRequest({ path: '/api/repos/test/repo/scan', method: 'GET', headers: { Cookie: cookie } });
    assertEqual(res.status, 200, 'Status');
    assert(res.body.result, 'Has result');
  });

  await testAsync('Unconnected repo returns 403', async () => {
    const res = await httpRequest({ path: '/api/repos/other/repo/metrics', method: 'GET', headers: { Cookie: cookie } });
    assertEqual(res.status, 403, 'Status');
  });

  await testAsync('GET /api/events without auth returns 401', async () => {
    const res = await httpRequest({ path: '/api/events', method: 'GET' });
    assertEqual(res.status, 401, 'Status');
  });

  await testAsync('POST /webhook/github rejects missing signature', async () => {
    const res = await httpRequest({
      path: '/webhook/github',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, JSON.stringify({ action: 'push' }));
    assertEqual(res.status, 401, 'Status');
  });

  await testAsync('Unknown route returns 404', async () => {
    const res = await httpRequest({ path: '/api/nonexistent', method: 'GET', headers: { Cookie: cookie } });
    assertEqual(res.status, 404, 'Status');
  });

  await testAsync('POST /api/repos/disconnect works', async () => {
    const res = await httpRequest({
      path: '/api/repos/disconnect',
      method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    }, JSON.stringify({ owner: 'test', repo: 'repo' }));
    assertEqual(res.status, 200, 'Status');
    assert(res.body.disconnected, 'Should be disconnected');
  });

  // Re-connect for editor tests (re-seed session + cache)
  const testSession = sessions.get(Array.from(sessions.keys())[0]);
  testSession.connectedRepos.add('test/repo');
  repoCache.set('test/repo', {
    canon: { units: TEST_UNITS, skills: TEST_SKILLS, files: [], errors: [] },
    lastCheck: runClarionCall(TEST_UNITS, TEST_SKILLS),
    history: [],
  });

  // ---- Editor API Tests ----

  await testAsync('GET /api/repos/:owner/:repo/canon returns full canon data', async () => {
    const res = await httpRequest({ path: '/api/repos/test/repo/canon', method: 'GET', headers: { Cookie: cookie } });
    assertEqual(res.status, 200, 'Status');
    assert(Array.isArray(res.body.units), 'Has units array');
    assertEqual(res.body.units.length, 4, 'Has 4 test units');
    assert(res.body.skills, 'Has skills');
  });

  await testAsync('POST /api/repos/:owner/:repo/units/save rejects empty units', async () => {
    const res = await httpRequest({
      path: '/api/repos/test/repo/units/save',
      method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    }, JSON.stringify({ units: [], filename: 'test.yml' }));
    assertEqual(res.status, 400, 'Status');
    assert(res.body.error.includes('Missing'), 'Error message');
  });

  await testAsync('POST /api/repos/:owner/:repo/skills/save rejects missing type', async () => {
    const res = await httpRequest({
      path: '/api/repos/test/repo/skills/save',
      method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    }, JSON.stringify({ data: {} }));
    assertEqual(res.status, 400, 'Status');
    assert(res.body.error.includes('Missing type'), 'Error message');
  });

  await testAsync('POST /api/repos/:owner/:repo/skills/save rejects unknown type', async () => {
    const res = await httpRequest({
      path: '/api/repos/test/repo/skills/save',
      method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    }, JSON.stringify({ type: 'invalid', data: {} }));
    assertEqual(res.status, 400, 'Status');
    assert(res.body.error.includes('Unknown skills type'), 'Error message');
  });

  await testAsync('POST /api/repos/:owner/:repo/wizard/setup rejects empty core story', async () => {
    const res = await httpRequest({
      path: '/api/repos/test/repo/wizard/setup',
      method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    }, JSON.stringify({ coreStory: [] }));
    assertEqual(res.status, 400, 'Status');
    assert(res.body.error.includes('core story'), 'Error message');
  });

  // Clean up
  server.close();
}

// ============================================================================
// Run all tests
// ============================================================================

runHttpTests().then(() => {
  console.log('\n  ' + '═'.repeat(40));
  console.log(`  ${passed + failed} tests: ${passed} passed, ${failed} failed`);

  if (failures.length > 0) {
    console.log('\n  Failures:');
    for (const f of failures) {
      console.log(`    ✗ ${f.name}: ${f.error}`);
    }
  }

  console.log('');
  process.exit(failed > 0 ? 1 : 0);
}).catch(err => {
  console.error('Test runner error:', err);
  server.close();
  process.exit(1);
});
