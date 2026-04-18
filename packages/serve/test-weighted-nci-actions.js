#!/usr/bin/env node
/**
 * test-weighted-nci-actions.js — Tests for Feature 4:
 *   - Weighted NCI computation (algebra.js)
 *   - Scoped weighted NCI
 *   - Prescriptive action engine (prescriptive-actions.js)
 *   - Store weight persistence (store.js MemoryAdapter)
 *   - API routes: weighted-nci, actions, weights
 *
 * Uses the same custom test framework as other test files.
 */

'use strict';

const http = require('http');

const {
  NarrativeGraph,
  NarrativeAlgebra,
  createAlgebra,
  ALL_LAYERS,
  DEFAULT_LAYER_WEIGHTS,
} = require('./algebra');

const {
  generateActions,
  generateAllActions,
  summarizeActions,
  buildLLMPrompt,
} = require('./prescriptive-actions');

const { MemoryAdapter } = require('./store');

const {
  signSession,
  createSessionId,
  sessions,
  repoCache,
  server,
  workspaces,
  runClarionCall,
} = require('./web-app');

// ============================================================================
// Test Framework
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

function assertApprox(actual, expected, tolerance, message) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${message || 'assertApprox'}: expected ~${expected} (±${tolerance}), got ${actual}`);
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

function makeUnit(overrides = {}) {
  return {
    id: overrides.id || 'unit-1',
    type: overrides.type || 'core_story',
    assertion: overrides.assertion || 'Test assertion',
    dependencies: overrides.dependencies || [],
    confidence: overrides.confidence ?? 1.0,
    author: overrides.author || null,
    authoredAt: overrides.authoredAt || null,
    scope: overrides.scope || null,
    tensionIntent: overrides.tensionIntent || null,
    contestedBy: overrides.contestedBy || [],
    intent: overrides.intent || {},
    evidence_required: overrides.evidence_required || [],
    validationState: overrides.validationState || undefined,
  };
}

// Build a graph and then forcibly set validation states AFTER createAlgebra
// runs its automatic validateAll(). This ensures our test states survive.
function buildWeightedTestAlgebra() {
  const units = [
    makeUnit({ id: 'core-1', type: 'core_story', assertion: 'We are the platform', author: 'CEO' }),
    makeUnit({ id: 'core-2', type: 'core_story', assertion: 'We serve enterprise', author: 'CEO', tensionIntent: 'drift', dependencies: ['core-1'] }),
    makeUnit({ id: 'pos-1', type: 'positioning', assertion: 'Market leader', author: 'CMO', dependencies: ['core-1'] }),
    makeUnit({ id: 'pos-2', type: 'positioning', assertion: 'Enterprise grade', author: 'CMO', dependencies: ['core-1'] }),
    makeUnit({ id: 'prod-1', type: 'product_narrative', assertion: 'Feed is primary', author: 'VP Product', scope: 'engineering', dependencies: ['pos-1'] }),
    makeUnit({ id: 'prod-2', type: 'product_narrative', assertion: 'Dashboard is primary', author: 'VP Sales', scope: 'sales', dependencies: ['pos-1'] }),
    makeUnit({ id: 'prod-3', type: 'product_narrative', assertion: 'API is primary', author: 'CTO', scope: 'engineering', contestedBy: ['prod-2'], dependencies: ['pos-1'] }),
    makeUnit({ id: 'ops-1', type: 'operational', assertion: 'Ship weekly', author: 'Eng Manager', scope: 'engineering', dependencies: ['prod-1'] }),
    makeUnit({ id: 'ev-1', type: 'evidence', assertion: 'NPS is 72', author: 'Data Lead', dependencies: ['pos-1'] }),
    makeUnit({ id: 'ev-2', type: 'evidence', assertion: 'Revenue growth 40%', dependencies: ['pos-2'] }),
    makeUnit({ id: 'comm-1', type: 'communication', assertion: 'Our tagline resonates', author: 'Brand Lead', dependencies: ['pos-1'] }),
  ];

  const { graph, algebra } = createAlgebra(units);

  // Override validation states for controlled testing
  const stateOverrides = {
    'core-1': 'ALIGNED', 'core-2': 'DRIFTED',
    'pos-1': 'ALIGNED', 'pos-2': 'ALIGNED',
    'prod-1': 'ALIGNED', 'prod-2': 'BROKEN', 'prod-3': 'CONTESTED',
    'ops-1': 'ALIGNED',
    'ev-1': 'ALIGNED', 'ev-2': 'UNKNOWN',
    'comm-1': 'ALIGNED',
  };
  for (const u of graph.getAllUnits()) {
    if (stateOverrides[u.id]) u.validationState = stateOverrides[u.id];
  }

  return { graph, algebra, units: graph.getAllUnits() };
}

// A scoped graph for testing scoped weighted NCI
function buildScopedWeightedAlgebra() {
  const units = [
    makeUnit({ id: 'core-1', type: 'core_story', assertion: 'We are the platform', author: 'CEO' }),
    makeUnit({ id: 'eng-1', type: 'product_narrative', assertion: 'Build APIs', scope: 'engineering', author: 'CTO', dependencies: ['core-1'] }),
    makeUnit({ id: 'eng-2', type: 'operational', assertion: 'Ship weekly', scope: 'engineering', author: 'CTO', dependencies: ['eng-1'] }),
    makeUnit({ id: 'eng-3', type: 'communication', assertion: 'Dev docs', scope: 'engineering', author: 'CTO', dependencies: ['eng-1'] }),
    makeUnit({ id: 'sales-1', type: 'positioning', assertion: 'Enterprise focus', scope: 'sales', author: 'VP Sales', dependencies: ['core-1'] }),
    makeUnit({ id: 'sales-2', type: 'product_narrative', assertion: 'Full platform', scope: 'sales', author: 'VP Sales', dependencies: ['sales-1'] }),
  ];

  const { graph, algebra } = createAlgebra(units);

  const stateOverrides = {
    'core-1': 'ALIGNED',
    'eng-1': 'ALIGNED', 'eng-2': 'ALIGNED', 'eng-3': 'DRIFTED',
    'sales-1': 'ALIGNED', 'sales-2': 'BROKEN',
  };
  for (const u of graph.getAllUnits()) {
    if (stateOverrides[u.id]) u.validationState = stateOverrides[u.id];
  }

  return { graph, algebra, units: graph.getAllUnits() };
}


// ============================================================================
// 1. DEFAULT_LAYER_WEIGHTS
// ============================================================================

console.log('\n  DEFAULT_LAYER_WEIGHTS');
console.log('  ' + '─'.repeat(40));

test('DEFAULT_LAYER_WEIGHTS is exported', () => {
  assert(DEFAULT_LAYER_WEIGHTS, 'Should be exported');
  assert(typeof DEFAULT_LAYER_WEIGHTS === 'object', 'Should be an object');
});

test('DEFAULT_LAYER_WEIGHTS has all 6 layers', () => {
  for (const layer of ALL_LAYERS) {
    assert(layer in DEFAULT_LAYER_WEIGHTS, `Missing layer: ${layer}`);
    assert(typeof DEFAULT_LAYER_WEIGHTS[layer] === 'number', `Weight for ${layer} should be a number`);
  }
});

test('DEFAULT_LAYER_WEIGHTS values are correct', () => {
  assertEqual(DEFAULT_LAYER_WEIGHTS.core_story, 3.0, 'core_story');
  assertEqual(DEFAULT_LAYER_WEIGHTS.positioning, 2.5, 'positioning');
  assertEqual(DEFAULT_LAYER_WEIGHTS.product_narrative, 2.0, 'product_narrative');
  assertEqual(DEFAULT_LAYER_WEIGHTS.operational, 1.5, 'operational');
  assertEqual(DEFAULT_LAYER_WEIGHTS.evidence, 1.0, 'evidence');
  assertEqual(DEFAULT_LAYER_WEIGHTS.communication, 1.0, 'communication');
});

test('core_story has the highest weight', () => {
  const maxWeight = Math.max(...Object.values(DEFAULT_LAYER_WEIGHTS));
  assertEqual(DEFAULT_LAYER_WEIGHTS.core_story, maxWeight, 'core_story should have the highest weight');
});


// ============================================================================
// 2. Weighted NCI Computation
// ============================================================================

console.log('\n  Weighted NCI Computation');
console.log('  ' + '─'.repeat(40));

test('computeWeightedNCI returns correct shape', () => {
  const { graph, algebra, units } = buildWeightedTestAlgebra();
  const result = algebra.computeWeightedNCI();

  assert('weightedNCI' in result, 'Should have weightedNCI');
  assert('breakdown' in result, 'Should have breakdown');
  assert('weights' in result, 'Should have weights');
  assert(typeof result.weightedNCI === 'number', 'weightedNCI should be a number');
  assert(result.weightedNCI >= 0 && result.weightedNCI <= 1, 'weightedNCI should be between 0 and 1');
});

test('computeWeightedNCI uses DEFAULT_LAYER_WEIGHTS when no weights given', () => {
  const { graph, algebra, units } = buildWeightedTestAlgebra();
  const result = algebra.computeWeightedNCI();

  for (const layer of ALL_LAYERS) {
    assertEqual(result.weights[layer], DEFAULT_LAYER_WEIGHTS[layer], `Weight for ${layer}`);
  }
});

test('computeWeightedNCI uses custom weights when provided', () => {
  const { graph, algebra, units } = buildWeightedTestAlgebra();
  const customWeights = { core_story: 10.0, positioning: 1.0, product_narrative: 1.0, operational: 1.0, evidence: 1.0, communication: 1.0 };
  const result = algebra.computeWeightedNCI(customWeights);

  assertEqual(result.weights.core_story, 10.0, 'Should use custom core_story weight');
  assertEqual(result.weights.positioning, 1.0, 'Should use custom positioning weight');
});

test('computeWeightedNCI breakdown has all layers', () => {
  const { graph, algebra, units } = buildWeightedTestAlgebra();
  const result = algebra.computeWeightedNCI();

  for (const layer of ALL_LAYERS) {
    assert(layer in result.breakdown, `Missing layer in breakdown: ${layer}`);
    const b = result.breakdown[layer];
    assert('weight' in b, 'Should have weight');
    assert('total' in b, 'Should have total');
    assert('aligned' in b, 'Should have aligned');
    assert('rawNCI' in b, 'Should have rawNCI');
    assert('weightedContribution' in b, 'Should have weightedContribution');
    assert('impactOnScore' in b, 'Should have impactOnScore');
  }
});

test('computeWeightedNCI math is correct for known data', () => {
  const { graph, algebra, units } = buildWeightedTestAlgebra();
  const result = algebra.computeWeightedNCI();

  // Manual calculation with default weights:
  // core_story: 2 total, 1 aligned, weight 3.0 → aligned_contribution=3.0, total_contribution=6.0
  // positioning: 2 total, 2 aligned, weight 2.5 → aligned_contribution=5.0, total_contribution=5.0
  // product_narrative: 3 total, 1 aligned, weight 2.0 → aligned_contribution=2.0, total_contribution=6.0
  // operational: 1 total, 1 aligned, weight 1.5 → aligned_contribution=1.5, total_contribution=1.5
  // evidence: 2 total, 1 aligned, weight 1.0 → aligned_contribution=1.0, total_contribution=2.0
  // communication: 1 total, 1 aligned, weight 1.0 → aligned_contribution=1.0, total_contribution=1.0
  // Total aligned: 3+5+2+1.5+1+1 = 13.5
  // Total weighted: 6+5+6+1.5+2+1 = 21.5
  // WNCI = 13.5 / 21.5 ≈ 0.6279

  assertApprox(result.weightedNCI, 13.5 / 21.5, 0.001, 'Weighted NCI calculation');
});

test('computeWeightedNCI with equal weights equals standard NCI', () => {
  const { graph, algebra, units } = buildWeightedTestAlgebra();
  const equalWeights = {};
  for (const layer of ALL_LAYERS) equalWeights[layer] = 1.0;

  const wnci = algebra.computeWeightedNCI(equalWeights);
  const metrics = algebra.computeMetrics();

  // With equal weights, WNCI should equal NCI
  assertApprox(wnci.weightedNCI, metrics.narrativeCoherenceIndex, 0.001, 'Equal weights should give standard NCI');
});

test('computeWeightedNCI heavily weighting aligned layers raises score', () => {
  const { graph, algebra, units } = buildWeightedTestAlgebra();

  // Positioning is 100% aligned → weight it heavily
  const highPosWeights = { core_story: 0.1, positioning: 10.0, product_narrative: 0.1, operational: 0.1, evidence: 0.1, communication: 0.1 };
  const result = algebra.computeWeightedNCI(highPosWeights);

  // Should be close to 1.0 since positioning dominates and is fully aligned
  assert(result.weightedNCI > 0.85, `Heavily weighting aligned layer should raise score, got ${result.weightedNCI}`);
});

test('computeWeightedNCI heavily weighting broken layers lowers score', () => {
  const { graph, algebra, units } = buildWeightedTestAlgebra();

  // Product narrative has only 1/3 aligned → weight it heavily
  const highProdWeights = { core_story: 0.1, positioning: 0.1, product_narrative: 10.0, operational: 0.1, evidence: 0.1, communication: 0.1 };
  const result = algebra.computeWeightedNCI(highProdWeights);

  assert(result.weightedNCI < 0.5, `Heavily weighting broken layer should lower score, got ${result.weightedNCI}`);
});

test('computeWeightedNCI returns 1.0 for empty graph', () => {
  const { algebra } = createAlgebra([]);
  const result = algebra.computeWeightedNCI();
  assertEqual(result.weightedNCI, 1.0, 'Empty graph should have WNCI of 1.0');
});

test('computeWeightedNCI returns 1.0 for all-aligned graph', () => {
  const units = [
    makeUnit({ id: 'c1', type: 'core_story', validationState: 'ALIGNED', author: 'A' }),
    makeUnit({ id: 'p1', type: 'positioning', validationState: 'ALIGNED', author: 'B', dependencies: ['c1'] }),
  ];
  const { algebra } = createAlgebra(units);
  const result = algebra.computeWeightedNCI();
  assertEqual(result.weightedNCI, 1.0, 'All aligned should have WNCI of 1.0');
});


// ============================================================================
// 3. Scoped Weighted NCI
// ============================================================================

console.log('\n  Scoped Weighted NCI');
console.log('  ' + '─'.repeat(40));

test('computeScopedWeightedNCI returns per-scope results', () => {
  const { graph, algebra, units } = buildScopedWeightedAlgebra();
  const result = algebra.computeScopedWeightedNCI();

  assert('engineering' in result, 'Should have engineering scope');
  assert('sales' in result, 'Should have sales scope');
});

test('computeScopedWeightedNCI engineering scope is correct', () => {
  const { graph, algebra, units } = buildScopedWeightedAlgebra();
  const result = algebra.computeScopedWeightedNCI();

  // Engineering: eng-1 (product_narrative, ALIGNED, w=2.0), eng-2 (operational, ALIGNED, w=1.5), eng-3 (communication, DRIFTED, w=1.0)
  // aligned = 2.0 + 1.5 = 3.5, total = 2.0 + 1.5 + 1.0 = 4.5
  // WNCI = 3.5 / 4.5 ≈ 0.778
  assertEqual(result.engineering.unitCount, 3, 'Engineering unit count');
  assertApprox(result.engineering.weightedNCI, 3.5 / 4.5, 0.001, 'Engineering weighted NCI');
});

test('computeScopedWeightedNCI sales scope is correct', () => {
  const { graph, algebra, units } = buildScopedWeightedAlgebra();
  const result = algebra.computeScopedWeightedNCI();

  // Sales: sales-1 (positioning, ALIGNED, w=2.5), sales-2 (product_narrative, BROKEN, w=2.0)
  // aligned = 2.5, total = 2.5 + 2.0 = 4.5
  // WNCI = 2.5 / 4.5 ≈ 0.556
  assertEqual(result.sales.unitCount, 2, 'Sales unit count');
  assertApprox(result.sales.weightedNCI, 2.5 / 4.5, 0.001, 'Sales weighted NCI');
});

test('computeScopedWeightedNCI respects custom weights', () => {
  const { graph, algebra, units } = buildScopedWeightedAlgebra();
  const equalWeights = {};
  for (const layer of ALL_LAYERS) equalWeights[layer] = 1.0;
  const result = algebra.computeScopedWeightedNCI(equalWeights);

  // Engineering with equal weights: 2 aligned / 3 total = 0.667
  assertApprox(result.engineering.weightedNCI, 2 / 3, 0.001, 'Engineering with equal weights');
  // Sales with equal weights: 1 aligned / 2 total = 0.5
  assertApprox(result.sales.weightedNCI, 1 / 2, 0.001, 'Sales with equal weights');
});


// ============================================================================
// 4. computeMetrics includes weighted NCI fields
// ============================================================================

console.log('\n  computeMetrics with Weighted NCI');
console.log('  ' + '─'.repeat(40));

test('computeMetrics includes weightedNCI fields', () => {
  const { graph, algebra, units } = buildWeightedTestAlgebra();
  const metrics = algebra.computeMetrics();

  assert('weightedNCI' in metrics, 'Should have weightedNCI');
  assert('weightedBreakdown' in metrics, 'Should have weightedBreakdown');
  assert('scopeHealth' in metrics, 'Should have scopeHealth');
  assert('contestedCount' in metrics, 'Should have contestedCount');
  assert('deliberateTensionCount' in metrics, 'Should have deliberateTensionCount');
});

test('computeMetrics weightedNCI matches computeWeightedNCI', () => {
  const { graph, algebra, units } = buildWeightedTestAlgebra();
  const metrics = algebra.computeMetrics();
  const direct = algebra.computeWeightedNCI();

  assertApprox(metrics.weightedNCI, direct.weightedNCI, 0.001, 'Should match');
});

test('computeMetrics with custom weights passes them through', () => {
  const { graph, algebra, units } = buildWeightedTestAlgebra();
  const customWeights = { core_story: 10.0, positioning: 1.0, product_narrative: 1.0, operational: 1.0, evidence: 1.0, communication: 1.0 };
  const metrics = algebra.computeMetrics(customWeights);
  const direct = algebra.computeWeightedNCI(customWeights);

  assertApprox(metrics.weightedNCI, direct.weightedNCI, 0.001, 'Custom weights should pass through');
});

test('computeMetrics contestedCount is accurate', () => {
  const { graph, algebra, units } = buildWeightedTestAlgebra();
  const metrics = algebra.computeMetrics();

  // prod-3 is CONTESTED
  assertEqual(metrics.contestedCount, 1, 'contestedCount');
});


// ============================================================================
// 5. Prescriptive Actions: generateActions
// ============================================================================

console.log('\n  Prescriptive Actions: generateActions');
console.log('  ' + '─'.repeat(40));

test('generateActions returns empty for fully ALIGNED unit with author', () => {
  const unit = makeUnit({ id: 'ok', type: 'core_story', validationState: 'ALIGNED', author: 'CEO' });
  const { graph, algebra } = createAlgebra([unit]);
  const actions = generateActions(unit, { graph, algebra, allUnits: [unit] });
  assertEqual(actions.length, 0, 'No actions for aligned unit with author');
});

test('generateActions flags CONTESTED unit with resolve_contest', () => {
  const { graph, algebra, units } = buildWeightedTestAlgebra();
  const contested = units.find(u => u.id === 'prod-3');
  const actions = generateActions(contested, { graph, algebra, allUnits: units });

  const resolveAction = actions.find(a => a.type === 'resolve_contest');
  assert(resolveAction, 'Should have resolve_contest action');
  assertEqual(resolveAction.priority, 'critical', 'Should be critical priority');
  assert(resolveAction.details.contestants.length > 0, 'Should list contestants');
});

test('generateActions flags CONTESTED scoped unit with escalate', () => {
  const { graph, algebra, units } = buildWeightedTestAlgebra();
  const contested = units.find(u => u.id === 'prod-3');
  const actions = generateActions(contested, { graph, algebra, allUnits: units });

  const escalateAction = actions.find(a => a.type === 'escalate');
  assert(escalateAction, 'Should have escalate action for scoped contested unit');
  assert(escalateAction.description.includes('engineering'), 'Should mention scope');
});

test('generateActions flags DRIFTED unit without intent with mark_intent', () => {
  const unit = makeUnit({ id: 'drift-1', type: 'positioning', validationState: 'DRIFTED', author: 'VP' });
  const { graph, algebra } = createAlgebra([unit]);
  const actions = generateActions(unit, { graph, algebra, allUnits: [unit] });

  const markAction = actions.find(a => a.type === 'mark_intent');
  assert(markAction, 'Should have mark_intent action');
  assertEqual(markAction.priority, 'high', 'Should be high priority');
  assert(markAction.options.length === 3, 'Should have 3 intent options');
});

test('generateActions flags DRIFTED + drift intent with update_canon', () => {
  const { graph, algebra, units } = buildWeightedTestAlgebra();
  const drifted = units.find(u => u.id === 'core-2'); // has tensionIntent: 'drift'
  const actions = generateActions(drifted, { graph, algebra, allUnits: units });

  const updateAction = actions.find(a => a.type === 'update_canon');
  assert(updateAction, 'Should have update_canon action');
});

test('generateActions flags DRIFTED + evolution intent with update_canon and schedule_review', () => {
  const units = [
    makeUnit({ id: 'c1', type: 'core_story', validationState: 'ALIGNED', author: 'CEO' }),
    makeUnit({ id: 'p1', type: 'positioning', validationState: 'DRIFTED', tensionIntent: 'evolution', author: 'CMO', dependencies: ['c1'] }),
    makeUnit({ id: 'prod1', type: 'product_narrative', validationState: 'ALIGNED', author: 'VP', dependencies: ['p1'] }),
  ];
  const { graph, algebra } = createAlgebra(units);
  const evolved = units[1];
  const actions = generateActions(evolved, { graph, algebra, allUnits: units });

  const updateAction = actions.find(a => a.type === 'update_canon');
  assert(updateAction, 'Should have update_canon for evolution');
  assertEqual(updateAction.priority, 'medium', 'Evolution update is medium priority');

  const reviewAction = actions.find(a => a.type === 'schedule_review');
  assert(reviewAction, 'Should have schedule_review for downstream impact');
});

test('generateActions flags BROKEN unit with critical update_canon', () => {
  const { graph, algebra, units } = buildWeightedTestAlgebra();
  const broken = units.find(u => u.id === 'prod-2');
  const actions = generateActions(broken, { graph, algebra, allUnits: units });

  const updateAction = actions.find(a => a.type === 'update_canon' && a.priority === 'critical');
  assert(updateAction, 'Should have critical update_canon for BROKEN');
});

test('generateActions flags BROKEN scoped unit with escalate', () => {
  const { graph, algebra, units } = buildWeightedTestAlgebra();
  const broken = units.find(u => u.id === 'prod-2');
  const actions = generateActions(broken, { graph, algebra, allUnits: units });

  const escalateAction = actions.find(a => a.type === 'escalate');
  assert(escalateAction, 'Should escalate broken scoped unit');
  assert(escalateAction.description.includes('sales'), 'Should mention sales scope');
});

test('generateActions flags UNKNOWN unit with add_evidence', () => {
  const { graph, algebra, units } = buildWeightedTestAlgebra();
  const unknown = units.find(u => u.id === 'ev-2');
  const actions = generateActions(unknown, { graph, algebra, allUnits: units });

  const evidenceAction = actions.find(a => a.type === 'add_evidence');
  assert(evidenceAction, 'Should have add_evidence action');
  assertEqual(evidenceAction.priority, 'low', 'Should be low priority');
});

test('generateActions flags missing author', () => {
  const unit = makeUnit({ id: 'no-author', type: 'core_story', validationState: 'ALIGNED', author: null });
  const { graph, algebra } = createAlgebra([unit]);
  const actions = generateActions(unit, { graph, algebra, allUnits: [unit] });

  const authorAction = actions.find(a => a.title === 'Add author attribution');
  assert(authorAction, 'Should flag missing author');
});

test('generateActions flags orphan non-core unit', () => {
  const unit = makeUnit({ id: 'orphan', type: 'positioning', validationState: 'ALIGNED', author: 'VP', dependencies: [] });
  const { graph, algebra } = createAlgebra([unit]);
  const actions = generateActions(unit, { graph, algebra, allUnits: [unit] });

  const orphanAction = actions.find(a => a.title === 'Connect this orphan unit');
  assert(orphanAction, 'Should flag orphan unit');
});

test('generateActions does NOT flag core_story as orphan (even with no deps)', () => {
  const unit = makeUnit({ id: 'root', type: 'core_story', validationState: 'ALIGNED', author: 'CEO', dependencies: [] });
  const { graph, algebra } = createAlgebra([unit]);
  const actions = generateActions(unit, { graph, algebra, allUnits: [unit] });

  const orphanAction = actions.find(a => a.title === 'Connect this orphan unit');
  assert(!orphanAction, 'Should NOT flag core_story as orphan');
});

test('generateActions sorts by priority (critical first)', () => {
  const { graph, algebra, units } = buildWeightedTestAlgebra();
  const broken = units.find(u => u.id === 'prod-2'); // BROKEN + scoped → critical + critical
  const actions = generateActions(broken, { graph, algebra, allUnits: units });

  if (actions.length >= 2) {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    for (let i = 1; i < actions.length; i++) {
      assert(
        priorityOrder[actions[i].priority] >= priorityOrder[actions[i - 1].priority],
        `Action ${i} (${actions[i].priority}) should not precede action ${i - 1} (${actions[i - 1].priority})`
      );
    }
  }
});


// ============================================================================
// 6. Prescriptive Actions: generateAllActions
// ============================================================================

console.log('\n  Prescriptive Actions: generateAllActions');
console.log('  ' + '─'.repeat(40));

test('generateAllActions returns actions for all problematic units', () => {
  const { graph, algebra, units } = buildWeightedTestAlgebra();
  const allActions = generateAllActions(graph, algebra);

  assert(allActions.length > 0, 'Should have actions');
  // Each action should have unitId, unitType, etc.
  for (const action of allActions) {
    assert('unitId' in action, 'Should have unitId');
    assert('unitType' in action, 'Should have unitType');
    assert('unitAssertion' in action, 'Should have unitAssertion');
    assert('type' in action, 'Should have type');
    assert('priority' in action, 'Should have priority');
  }
});

test('generateAllActions includes actions for CONTESTED, BROKEN, DRIFTED, UNKNOWN', () => {
  const { graph, algebra, units } = buildWeightedTestAlgebra();
  const allActions = generateAllActions(graph, algebra);

  const unitIds = [...new Set(allActions.map(a => a.unitId))];
  assert(unitIds.includes('prod-3'), 'Should include CONTESTED unit');
  assert(unitIds.includes('prod-2'), 'Should include BROKEN unit');
  assert(unitIds.includes('core-2'), 'Should include DRIFTED unit');
  assert(unitIds.includes('ev-2'), 'Should include UNKNOWN unit');
});

test('generateAllActions skips fully ALIGNED units with authors', () => {
  const { graph, algebra, units } = buildWeightedTestAlgebra();
  const allActions = generateAllActions(graph, algebra);

  const unitIds = [...new Set(allActions.map(a => a.unitId))];
  // core-1 is ALIGNED with author and has dependents — should NOT appear
  assert(!unitIds.includes('core-1'), 'Should skip ALIGNED core with author');
});

test('generateAllActions is sorted globally by priority', () => {
  const { graph, algebra, units } = buildWeightedTestAlgebra();
  const allActions = generateAllActions(graph, algebra);

  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  for (let i = 1; i < allActions.length; i++) {
    assert(
      priorityOrder[allActions[i].priority] >= priorityOrder[allActions[i - 1].priority],
      `Global sort: action ${i} should not precede action ${i - 1}`
    );
  }
});

test('generateAllActions returns empty for fully healthy graph', () => {
  const units = [
    makeUnit({ id: 'c1', type: 'core_story', validationState: 'ALIGNED', author: 'CEO' }),
    makeUnit({ id: 'p1', type: 'positioning', validationState: 'ALIGNED', author: 'CMO', dependencies: ['c1'] }),
  ];
  const { graph, algebra } = createAlgebra(units);
  const allActions = generateAllActions(graph, algebra);
  assertEqual(allActions.length, 0, 'Healthy graph should have no actions');
});


// ============================================================================
// 7. Prescriptive Actions: summarizeActions
// ============================================================================

console.log('\n  Prescriptive Actions: summarizeActions');
console.log('  ' + '─'.repeat(40));

test('summarizeActions returns correct shape', () => {
  const { graph, algebra, units } = buildWeightedTestAlgebra();
  const allActions = generateAllActions(graph, algebra);
  const summary = summarizeActions(allActions);

  assert('total' in summary, 'Should have total');
  assert('byPriority' in summary, 'Should have byPriority');
  assert('byType' in summary, 'Should have byType');
  assert('topActions' in summary, 'Should have topActions');
});

test('summarizeActions total matches input length', () => {
  const { graph, algebra, units } = buildWeightedTestAlgebra();
  const allActions = generateAllActions(graph, algebra);
  const summary = summarizeActions(allActions);

  assertEqual(summary.total, allActions.length, 'Total should match');
});

test('summarizeActions byPriority sums to total', () => {
  const { graph, algebra, units } = buildWeightedTestAlgebra();
  const allActions = generateAllActions(graph, algebra);
  const summary = summarizeActions(allActions);

  const sum = Object.values(summary.byPriority).reduce((s, v) => s + v, 0);
  assertEqual(sum, summary.total, 'byPriority should sum to total');
});

test('summarizeActions byType sums to total', () => {
  const { graph, algebra, units } = buildWeightedTestAlgebra();
  const allActions = generateAllActions(graph, algebra);
  const summary = summarizeActions(allActions);

  const sum = Object.values(summary.byType).reduce((s, v) => s + v, 0);
  assertEqual(sum, summary.total, 'byType should sum to total');
});

test('summarizeActions topActions has at most 5', () => {
  const { graph, algebra, units } = buildWeightedTestAlgebra();
  const allActions = generateAllActions(graph, algebra);
  const summary = summarizeActions(allActions);

  assert(summary.topActions.length <= 5, 'Should have at most 5 top actions');
});

test('summarizeActions for empty actions', () => {
  const summary = summarizeActions([]);
  assertEqual(summary.total, 0, 'Total');
  assertEqual(summary.topActions.length, 0, 'No top actions');
});


// ============================================================================
// 8. Prescriptive Actions: buildLLMPrompt
// ============================================================================

console.log('\n  Prescriptive Actions: buildLLMPrompt');
console.log('  ' + '─'.repeat(40));

test('buildLLMPrompt returns a string', () => {
  const unit = makeUnit({ id: 'test-1', type: 'positioning', validationState: 'DRIFTED', author: 'VP Sales', scope: 'sales' });
  const prompt = buildLLMPrompt(unit, { relatedUnits: { dependencies: [], dependents: [] }, ruleBasedActions: [] });
  assert(typeof prompt === 'string', 'Should return a string');
  assert(prompt.length > 100, 'Should be a substantial prompt');
});

test('buildLLMPrompt includes unit details', () => {
  const unit = makeUnit({ id: 'u-42', type: 'product_narrative', assertion: 'We build APIs', validationState: 'CONTESTED', author: 'CTO', scope: 'engineering' });
  const prompt = buildLLMPrompt(unit, { relatedUnits: { dependencies: [], dependents: [] }, ruleBasedActions: [] });

  assert(prompt.includes('u-42'), 'Should include unit ID');
  assert(prompt.includes('We build APIs'), 'Should include assertion');
  assert(prompt.includes('CONTESTED'), 'Should include validation state');
  assert(prompt.includes('CTO'), 'Should include author');
  assert(prompt.includes('engineering'), 'Should include scope');
});

test('buildLLMPrompt includes dependencies and dependents', () => {
  const unit = makeUnit({ id: 'u-42', type: 'positioning', validationState: 'DRIFTED' });
  const deps = [makeUnit({ id: 'd-1', type: 'core_story', assertion: 'We are the platform', validationState: 'ALIGNED' })];
  const dependents = [makeUnit({ id: 'down-1', type: 'product_narrative', assertion: 'Feed is primary', validationState: 'ALIGNED' })];
  const prompt = buildLLMPrompt(unit, { relatedUnits: { dependencies: deps, dependents }, ruleBasedActions: [] });

  assert(prompt.includes('d-1'), 'Should include dependency ID');
  assert(prompt.includes('We are the platform'), 'Should include dependency assertion');
  assert(prompt.includes('down-1'), 'Should include dependent ID');
});

test('buildLLMPrompt includes rule-based actions', () => {
  const unit = makeUnit({ id: 'u-42', type: 'positioning', validationState: 'DRIFTED' });
  const actions = [{ priority: 'high', title: 'Fix it', description: 'Update this unit' }];
  const prompt = buildLLMPrompt(unit, { relatedUnits: { dependencies: [], dependents: [] }, ruleBasedActions: actions });

  assert(prompt.includes('Fix it'), 'Should include action title');
  assert(prompt.includes('Update this unit'), 'Should include action description');
});


// ============================================================================
// 9. Store: MemoryAdapter weight persistence
// ============================================================================

console.log('\n  Store: Weight Persistence');
console.log('  ' + '─'.repeat(40));

test('MemoryAdapter.getWeights returns null by default', async () => {
  const adapter = new MemoryAdapter();
  const weights = await adapter.getWeights();
  assertEqual(weights, null, 'Should return null for no saved weights');
});

test('MemoryAdapter.saveWeights persists weights', async () => {
  const adapter = new MemoryAdapter();
  const custom = { core_story: 5.0, positioning: 3.0 };
  await adapter.saveWeights(custom);
  const weights = await adapter.getWeights();
  assertEqual(weights.core_story, 5.0, 'core_story');
  assertEqual(weights.positioning, 3.0, 'positioning');
});

test('MemoryAdapter.saveWeights returns a copy (not reference)', async () => {
  const adapter = new MemoryAdapter();
  const custom = { core_story: 5.0 };
  await adapter.saveWeights(custom);
  custom.core_story = 99.0; // mutate original
  const weights = await adapter.getWeights();
  assertEqual(weights.core_story, 5.0, 'Should not be affected by mutation');
});

test('MemoryAdapter.saveWeights can overwrite previous weights', async () => {
  const adapter = new MemoryAdapter();
  await adapter.saveWeights({ core_story: 1.0 });
  await adapter.saveWeights({ core_story: 9.0 });
  const weights = await adapter.getWeights();
  assertEqual(weights.core_story, 9.0, 'Should overwrite');
});


// ============================================================================
// 10. HTTP API Tests
// ============================================================================

console.log('\n  HTTP API: Weighted NCI + Actions + Weights');
console.log('  ' + '─'.repeat(40));

const TEST_PORT = 39877;

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

// Test data for API tests — mixed states to generate actions
const API_TEST_UNITS = [
  {
    id: 'core_visibility',
    type: 'core_story',
    assertion: 'Software development is invisible.',
    intent: {},
    dependencies: [],
    confidence: 1.0,
    author: 'CEO',
  },
  {
    id: 'pos_instrument',
    type: 'positioning',
    assertion: 'We build the instrument.',
    intent: {},
    dependencies: ['core_visibility'],
    confidence: 1.0,
    author: 'CMO',
  },
  {
    id: 'prod_feed',
    type: 'product_narrative',
    assertion: 'The feed is the primary surface.',
    intent: {},
    dependencies: ['pos_instrument'],
    confidence: 1.0,
    // No author — should generate action
  },
  {
    id: 'prod_dashboard',
    type: 'product_narrative',
    assertion: 'Dashboard is primary.',
    intent: {},
    dependencies: ['pos_instrument'],
    confidence: 1.0,
    validationState: 'CONTESTED',
    contestedBy: ['prod_feed'],
    author: 'VP Sales',
    scope: 'sales',
  },
];

const API_TEST_SKILLS = {
  terminology: { forbidden: ['synergy'] },
  brand: { company_name: 'Principal AI', never: [] },
};

function createApiTestSession() {
  const sessionId = createSessionId();
  const signed = signSession(sessionId);
  sessions.set(sessionId, {
    githubToken: 'test-token',
    user: { login: 'testuser', name: 'Test User', avatar_url: '', id: 1 },
    connectedRepos: new Set(['test/repo']),
    rateLimit: { count: 0, resetAt: Date.now() + 60000 },
  });

  repoCache.set('test/repo', {
    canon: { units: API_TEST_UNITS, skills: API_TEST_SKILLS, files: [], errors: [] },
    lastCheck: runClarionCall(API_TEST_UNITS, API_TEST_SKILLS),
    history: [],
  });

  // Setup workspace for weights — must be a MemoryAdapter instance
  const wsStore = new MemoryAdapter('Test Workspace');
  workspaces.set(wsStore.id, wsStore);
  // Expose the workspace ID for tests
  createApiTestSession._wsId = wsStore.id;

  return { sessionId, cookie: `na_session=${signed}` };
}

async function runApiTests() {
  await new Promise((resolve) => {
    server.listen(TEST_PORT, '127.0.0.1', resolve);
  });

  const { cookie } = createApiTestSession();

  // -- weighted-nci route -------------------------------------------------------

  await testAsync('GET /api/repos/:owner/:repo/weighted-nci returns weighted NCI', async () => {
    const res = await httpRequest({ path: '/api/repos/test/repo/weighted-nci', method: 'GET', headers: { Cookie: cookie } });
    assertEqual(res.status, 200, 'Status');
    assert('weightedNCI' in res.body, 'Should have weightedNCI');
    assert('breakdown' in res.body, 'Should have breakdown');
    assert('weights' in res.body, 'Should have weights');
    assert(typeof res.body.weightedNCI === 'number', 'weightedNCI should be a number');
  });

  await testAsync('GET /api/repos/:owner/:repo/weighted-nci without auth returns 401', async () => {
    const res = await httpRequest({ path: '/api/repos/test/repo/weighted-nci', method: 'GET' });
    assertEqual(res.status, 401, 'Status');
  });

  // -- actions route (all) -------------------------------------------------------

  await testAsync('GET /api/repos/:owner/:repo/actions returns all actions', async () => {
    const res = await httpRequest({ path: '/api/repos/test/repo/actions', method: 'GET', headers: { Cookie: cookie } });
    assertEqual(res.status, 200, 'Status');
    assert('actions' in res.body, 'Should have actions');
    assert('summary' in res.body, 'Should have summary');
    assert(Array.isArray(res.body.actions), 'Actions should be an array');
    assert(res.body.actions.length > 0, 'Should have some actions (contested + missing author units)');
  });

  await testAsync('GET /api/repos/:owner/:repo/actions summary matches actions', async () => {
    const res = await httpRequest({ path: '/api/repos/test/repo/actions', method: 'GET', headers: { Cookie: cookie } });
    assertEqual(res.body.summary.total, res.body.actions.length, 'Summary total should match');
  });

  // -- actions/unit/:id route -------------------------------------------------------

  await testAsync('GET /api/repos/:owner/:repo/actions/unit/:unitId returns unit actions', async () => {
    const res = await httpRequest({ path: '/api/repos/test/repo/actions/unit/prod_dashboard', method: 'GET', headers: { Cookie: cookie } });
    assertEqual(res.status, 200, 'Status');
    assertEqual(res.body.unitId, 'prod_dashboard', 'unitId');
    assert(Array.isArray(res.body.actions), 'Actions should be an array');
    // prod_dashboard is CONTESTED so should have resolve_contest
    const hasResolve = res.body.actions.some(a => a.type === 'resolve_contest');
    assert(hasResolve, 'Should include resolve_contest action');
  });

  await testAsync('GET /api/repos/:owner/:repo/actions/unit/:id returns 404 for unknown unit', async () => {
    const res = await httpRequest({ path: '/api/repos/test/repo/actions/unit/nonexistent', method: 'GET', headers: { Cookie: cookie } });
    assertEqual(res.status, 404, 'Status');
    assert(res.body.error.includes('nonexistent'), 'Error should mention unit ID');
  });

  // -- workspace weights routes -------------------------------------------------------

  const wsId = createApiTestSession._wsId;

  await testAsync('GET /api/workspaces/:id/weights returns defaults when no custom weights', async () => {
    const res = await httpRequest({ path: `/api/workspaces/${wsId}/weights`, method: 'GET', headers: { Cookie: cookie } });
    assertEqual(res.status, 200, 'Status');
    assert('weights' in res.body, 'Should have weights');
    assertEqual(res.body.isCustom, false, 'Should not be custom');
    assertEqual(res.body.weights.core_story, DEFAULT_LAYER_WEIGHTS.core_story, 'Should return defaults');
  });

  await testAsync('PUT /api/workspaces/:id/weights saves custom weights', async () => {
    const customWeights = { core_story: 5.0, positioning: 4.0, product_narrative: 3.0, operational: 2.0, evidence: 1.5, communication: 1.0 };
    const res = await httpRequest(
      { path: `/api/workspaces/${wsId}/weights`, method: 'PUT', headers: { Cookie: cookie, 'Content-Type': 'application/json' } },
      JSON.stringify({ weights: customWeights })
    );
    assertEqual(res.status, 200, 'Status');
    assert(res.body.saved, 'Should return saved: true');
  });

  await testAsync('GET /api/workspaces/:id/weights returns saved custom weights', async () => {
    const res = await httpRequest({ path: `/api/workspaces/${wsId}/weights`, method: 'GET', headers: { Cookie: cookie } });
    assertEqual(res.status, 200, 'Status');
    assertEqual(res.body.isCustom, true, 'Should be custom');
    assertEqual(res.body.weights.core_story, 5.0, 'Should return saved custom weight');
  });

  // -- actions/recommend route (LLM) -----------------------------------------------

  await testAsync('POST /api/repos/:owner/:repo/actions/recommend returns prompt', async () => {
    const res = await httpRequest(
      { path: '/api/repos/test/repo/actions/recommend', method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' } },
      JSON.stringify({ unitId: 'prod_dashboard' })
    );
    assertEqual(res.status, 200, 'Status');
    assert('prompt' in res.body, 'Should have prompt');
    assert('ruleBasedActions' in res.body, 'Should have ruleBasedActions');
    assert(res.body.prompt.includes('prod_dashboard'), 'Prompt should include unit ID');
  });

  await testAsync('POST /api/repos/:owner/:repo/actions/recommend rejects missing unitId', async () => {
    const res = await httpRequest(
      { path: '/api/repos/test/repo/actions/recommend', method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' } },
      JSON.stringify({})
    );
    // Should return 400 or handle gracefully
    assert(res.status === 400 || res.status === 200, 'Should handle missing unitId');
  });

  // Cleanup
  server.close();
}


// ============================================================================
// Run everything
// ============================================================================

async function main() {
  console.log('\n  ════════════════════════════════════════════');
  console.log('  Feature 4: Weighted NCI + Prescriptive Actions');
  console.log('  ════════════════════════════════════════════');

  // Sync tests (algebra, prescriptive-actions, store) already ran above
  // Now run async tests
  await testAsync('MemoryAdapter.getWeights returns null by default', async () => {
    const adapter = new MemoryAdapter();
    const weights = await adapter.getWeights();
    assertEqual(weights, null, 'Should return null');
  });

  await testAsync('MemoryAdapter.saveWeights round-trips', async () => {
    const adapter = new MemoryAdapter();
    await adapter.saveWeights({ core_story: 7.0 });
    const w = await adapter.getWeights();
    assertEqual(w.core_story, 7.0, 'Should persist');
  });

  // Run HTTP API tests
  await runApiTests();

  // Summary
  console.log('\n  ────────────────────────────────────');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  if (failures.length > 0) {
    console.log('\n  Failures:');
    for (const f of failures) {
      console.log(`    ✗ ${f.name}: ${f.error}`);
    }
  }
  console.log('');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
