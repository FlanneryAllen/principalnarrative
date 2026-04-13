#!/usr/bin/env node
/**
 * Narrative Algebra — Unit tests
 *
 * Tests all 6 algebraic operations (Σ Δ Ω ρ κ δ), the in-memory graph,
 * composed queries, metrics, and edge cases.
 */

'use strict';

const assert = require('assert');
const {
  NarrativeGraph,
  NarrativeAlgebra,
  createAlgebra,
  LAYER_ORDER,
  ALL_LAYERS,
  STAKEHOLDER_PRESETS,
} = require('./algebra');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ✗ ${name}`);
    console.log(`    ${err.message}`);
    failed++;
  }
}

// ============================================================================
// Test data — minimal narrative graph
// ============================================================================

function sampleUnits() {
  return [
    {
      id: 'core_main',
      type: 'core_story',
      assertion: 'We make software visible to builders.',
      intent: { objective: 'visibility', constraints: { content: { required_themes: ['visibility'], forbidden_themes: ['surveillance'] } } },
      dependencies: [],
      confidence: 1.0,
    },
    {
      id: 'core_dims',
      type: 'core_story',
      assertion: 'Structure, motion, meaning — three dimensions.',
      intent: {},
      dependencies: ['core_main'],
      confidence: 1.0,
    },
    {
      id: 'pos_product',
      type: 'positioning',
      assertion: 'See your codebase as a living map.',
      intent: { constraints: { content: { required_themes: ['structure', 'visibility'] } } },
      dependencies: ['core_dims', 'core_main'],
      confidence: 1.0,
    },
    {
      id: 'pos_feed',
      type: 'positioning',
      assertion: 'Follow the work as it evolves across repos.',
      intent: {},
      dependencies: ['core_dims'],
      confidence: 1.0,
    },
    {
      id: 'ops_deploy',
      type: 'operational',
      assertion: 'Deploy weekly with zero-downtime process.',
      intent: {},
      dependencies: ['pos_product'],
      confidence: 0.9,
    },
    {
      id: 'ev_metric',
      type: 'evidence',
      assertion: 'NPS score above 60.',
      intent: {},
      dependencies: ['pos_product'],
      confidence: 0.8,
    },
    {
      id: 'comm_blog',
      type: 'communication',
      assertion: 'Blog post: why we built the living map.',
      intent: {},
      dependencies: ['pos_product'],
      confidence: 1.0,
    },
  ];
}

console.log('');
console.log('  narrative algebra tests');
console.log('  ──────────────────────');
console.log('');

// ============================================================================
// NarrativeGraph tests
// ============================================================================

test('Graph: constructs from unit array', () => {
  const graph = new NarrativeGraph(sampleUnits());
  assert.strictEqual(graph.getAllUnits().length, 7);
});

test('Graph: getUnit returns correct unit', () => {
  const graph = new NarrativeGraph(sampleUnits());
  const unit = graph.getUnit('core_main');
  assert.ok(unit);
  assert.strictEqual(unit.id, 'core_main');
  assert.strictEqual(unit.type, 'core_story');
});

test('Graph: getUnit returns null for missing', () => {
  const graph = new NarrativeGraph(sampleUnits());
  assert.strictEqual(graph.getUnit('nonexistent'), null);
});

test('Graph: getDependencies returns upstream units', () => {
  const graph = new NarrativeGraph(sampleUnits());
  const deps = graph.getDependencies('pos_product');
  const depIds = deps.map(d => d.id).sort();
  assert.deepStrictEqual(depIds, ['core_dims', 'core_main']);
});

test('Graph: getDependents returns downstream units', () => {
  const graph = new NarrativeGraph(sampleUnits());
  const deps = graph.getDependents('core_main');
  const depIds = deps.map(d => d.id).sort();
  assert.ok(depIds.includes('core_dims'));
  assert.ok(depIds.includes('pos_product'));
});

test('Graph: defaults validationState to UNKNOWN', () => {
  const graph = new NarrativeGraph(sampleUnits());
  for (const u of graph.getAllUnits()) {
    assert.strictEqual(u.validationState, 'UNKNOWN');
  }
});

test('Graph: updateValidationState works', () => {
  const graph = new NarrativeGraph(sampleUnits());
  graph.updateValidationState('core_main', 'ALIGNED', 0.95);
  const unit = graph.getUnit('core_main');
  assert.strictEqual(unit.validationState, 'ALIGNED');
  assert.strictEqual(unit.confidence, 0.95);
});

test('Graph: getStats returns correct counts', () => {
  const graph = new NarrativeGraph(sampleUnits());
  const stats = graph.getStats();
  assert.strictEqual(stats.total, 7);
  assert.strictEqual(stats.byType.core_story, 2);
  assert.strictEqual(stats.byType.positioning, 2);
});

// ============================================================================
// createAlgebra — builds and validates
// ============================================================================

test('createAlgebra: validates all units', () => {
  const { graph } = createAlgebra(sampleUnits());
  // After validation, root units with no deps should be ALIGNED
  const root = graph.getUnit('core_main');
  assert.strictEqual(root.validationState, 'ALIGNED');
});

test('createAlgebra: propagates alignment through deps', () => {
  const { graph } = createAlgebra(sampleUnits());
  // pos_product depends on ALIGNED roots → should be ALIGNED
  const pos = graph.getUnit('pos_product');
  assert.strictEqual(pos.validationState, 'ALIGNED');
});

// ============================================================================
// Σ Compose
// ============================================================================

test('Compose: filters by type', () => {
  const { algebra } = createAlgebra(sampleUnits());
  const sub = algebra.compose({
    typeFilter: ['core_story'],
    depth: Infinity,
    stakeholder: 'test',
  });
  assert.strictEqual(sub.units.length, 2);
  assert.ok(sub.units.every(u => u.type === 'core_story'));
});

test('Compose: stakeholder presets work', () => {
  const { algebra } = createAlgebra(sampleUnits());
  const board = algebra.composeForStakeholder('board');
  // board preset: core_story, positioning, evidence
  assert.ok(board.units.length > 0);
  const types = new Set(board.units.map(u => u.type));
  // Should not include operational or communication
  assert.ok(!types.has('operational'));
  assert.ok(!types.has('communication'));
});

test('Compose: preserves edges between included units', () => {
  const { algebra } = createAlgebra(sampleUnits());
  const sub = algebra.compose({
    typeFilter: ['core_story', 'positioning'],
    depth: Infinity,
    stakeholder: 'test',
  });
  assert.ok(sub.edges.length > 0);
  const unitIds = new Set(sub.units.map(u => u.id));
  for (const edge of sub.edges) {
    assert.ok(unitIds.has(edge.from), `edge.from ${edge.from} not in subgraph`);
    assert.ok(unitIds.has(edge.to), `edge.to ${edge.to} not in subgraph`);
  }
});

test('Compose: closure property — compose on subgraph', () => {
  const { algebra } = createAlgebra(sampleUnits());
  const broad = algebra.composeForStakeholder('board');
  const narrow = algebra.composeOnSubgraph(broad, {
    typeFilter: ['core_story'],
  });
  assert.ok(narrow.units.every(u => u.type === 'core_story'));
  assert.ok(narrow.provenance.parentGraph === 'compose');
});

test('Compose: unknown stakeholder throws', () => {
  const { algebra } = createAlgebra(sampleUnits());
  assert.throws(() => algebra.composeForStakeholder('alien'), /Unknown stakeholder/);
});

// ============================================================================
// Δ Propagate
// ============================================================================

test('Propagate: root change affects all downstream', () => {
  const { algebra } = createAlgebra(sampleUnits());
  const result = algebra.propagate('core_main');
  // core_main → core_dims, pos_product, pos_feed (via core_dims), ops_deploy, ev_metric, comm_blog
  assert.ok(result.affectedUnits.length >= 4);
  assert.ok(result.scope > 0);
});

test('Propagate: leaf unit has no downstream', () => {
  const { algebra } = createAlgebra(sampleUnits());
  const result = algebra.propagate('comm_blog');
  assert.strictEqual(result.affectedUnits.length, 0);
  assert.strictEqual(result.scope, 0);
});

test('Propagate: missing unit throws', () => {
  const { algebra } = createAlgebra(sampleUnits());
  assert.throws(() => algebra.propagate('nonexistent'), /not found/);
});

test('Propagate: no duplicates in affected', () => {
  const { algebra } = createAlgebra(sampleUnits());
  const result = algebra.propagate('core_main');
  const ids = result.affectedUnits.map(u => u.id);
  const unique = new Set(ids);
  assert.strictEqual(ids.length, unique.size, 'Affected units contain duplicates');
});

test('Propagate: byLayer groups correctly', () => {
  const { algebra } = createAlgebra(sampleUnits());
  const result = algebra.propagate('core_main');
  for (const layer of ALL_LAYERS) {
    assert.ok(Array.isArray(result.byLayer[layer]));
  }
});

// ============================================================================
// Ω Validate
// ============================================================================

test('Validate: root unit with no deps becomes ALIGNED', () => {
  const graph = new NarrativeGraph(sampleUnits());
  const algebra = new NarrativeAlgebra(graph);
  const result = algebra.validate('core_main');
  assert.strictEqual(result.newState, 'ALIGNED');
});

test('Validate: unit with UNKNOWN deps stays UNKNOWN initially', () => {
  const graph = new NarrativeGraph(sampleUnits());
  const algebra = new NarrativeAlgebra(graph);
  // Don't validate root first — validate a dependent
  const result = algebra.validate('pos_product');
  // Dependencies are UNKNOWN, so this should be UNKNOWN
  assert.strictEqual(result.newState, 'UNKNOWN');
});

test('Validate: validateAll processes in layer order', () => {
  const { algebra } = createAlgebra(sampleUnits());
  const results = algebra.validateAll();
  assert.strictEqual(results.length, 7);
  // All should be ALIGNED after proper ordering
  for (const r of results) {
    assert.strictEqual(r.newState, 'ALIGNED', `${r.unitId} should be ALIGNED`);
  }
});

test('Validate: drifted dependency cascades', () => {
  const graph = new NarrativeGraph(sampleUnits());
  const algebra = new NarrativeAlgebra(graph);
  // Mark root as BROKEN
  graph.updateValidationState('core_main', 'BROKEN', 0.1);
  // Validate child
  const result = algebra.validate('core_dims');
  assert.strictEqual(result.newState, 'DRIFTED');
});

// ============================================================================
// ρ Resonate
// ============================================================================

test('Resonate: matching signal has positive resonance', () => {
  const { algebra } = createAlgebra(sampleUnits());
  const result = algebra.resonate('software visibility for builders and codebase');
  assert.ok(result.resonance > 0, 'Expected positive resonance');
  assert.ok(result.matchedUnits.length > 0, 'Expected matched units');
});

test('Resonate: unrelated signal has zero resonance', () => {
  const { algebra } = createAlgebra(sampleUnits());
  const result = algebra.resonate('xyzzyplugh');
  assert.strictEqual(result.resonance, 0);
  assert.strictEqual(result.matchedUnits.length, 0);
});

test('Resonate: urgency reflects scope', () => {
  const { algebra } = createAlgebra(sampleUnits());
  // Signal that matches core story should be high urgency
  const result = algebra.resonate('software visibility builders human');
  assert.ok(['critical', 'high', 'medium'].includes(result.urgency));
});

// ============================================================================
// κ Cover
// ============================================================================

test('Cover: fully aligned graph has 100% coverage', () => {
  const { algebra } = createAlgebra(sampleUnits());
  const result = algebra.cover();
  assert.strictEqual(result.coverage, 1.0);
});

test('Cover: byLayer has entries for all layers', () => {
  const { algebra } = createAlgebra(sampleUnits());
  const result = algebra.cover();
  for (const layer of ALL_LAYERS) {
    assert.ok(result.byLayer[layer] !== undefined, `Missing byLayer.${layer}`);
  }
});

test('Cover: gaps identifies units without evidence backing', () => {
  const { algebra } = createAlgebra(sampleUnits());
  const result = algebra.cover();
  // All gaps should be non-evidence units
  for (const gap of result.gaps) {
    assert.notStrictEqual(gap.type, 'evidence');
  }
});

test('Cover: coverSubgraph works on compose result', () => {
  const { algebra } = createAlgebra(sampleUnits());
  const sub = algebra.composeForStakeholder('board');
  const result = algebra.coverSubgraph(sub);
  assert.ok(result.coverage >= 0 && result.coverage <= 1);
});

// ============================================================================
// δ Drift
// ============================================================================

test('Drift: no drift on fully aligned graph', () => {
  const { algebra } = createAlgebra(sampleUnits());
  const result = algebra.drift();
  assert.strictEqual(result.driftRate, 0);
  assert.strictEqual(result.driftedUnits.length, 0);
});

test('Drift: detects drifted units', () => {
  const graph = new NarrativeGraph(sampleUnits());
  graph.updateValidationState('pos_product', 'DRIFTED', 0.5);
  const algebra = new NarrativeAlgebra(graph);
  const result = algebra.drift();
  assert.ok(result.driftRate > 0);
  assert.ok(result.driftedUnits.some(u => u.id === 'pos_product'));
});

test('Drift: byLayer breaks down correctly', () => {
  const graph = new NarrativeGraph(sampleUnits());
  graph.updateValidationState('pos_product', 'BROKEN', 0.1);
  const algebra = new NarrativeAlgebra(graph);
  const result = algebra.drift();
  assert.strictEqual(result.byLayer.positioning.drifted, 1);
  assert.strictEqual(result.byLayer.core_story.drifted, 0);
});

// ============================================================================
// Metrics
// ============================================================================

test('Metrics: NCI is 1.0 for fully aligned graph', () => {
  const { algebra } = createAlgebra(sampleUnits());
  const metrics = algebra.computeMetrics();
  assert.strictEqual(metrics.narrativeCoherenceIndex, 1.0);
  assert.strictEqual(metrics.totalUnits, 7);
  assert.ok(metrics.totalEdges > 0);
});

test('Metrics: layerHealth has all layers', () => {
  const { algebra } = createAlgebra(sampleUnits());
  const metrics = algebra.computeMetrics();
  for (const layer of ALL_LAYERS) {
    assert.ok(metrics.layerHealth[layer] !== undefined);
  }
});

// ============================================================================
// Composed queries
// ============================================================================

test('Query: strategic alignment returns views', () => {
  const { algebra } = createAlgebra(sampleUnits());
  const result = algebra.queryStrategicAlignment();
  assert.ok(result.engineeringView);
  assert.ok(result.boardView);
  assert.ok(Array.isArray(result.misaligned));
});

test('Query: competitive response scores signal', () => {
  const { algebra } = createAlgebra(sampleUnits());
  const result = algebra.queryCompetitiveResponse('new competitor launches codebase visibility tool');
  assert.ok(result.resonance);
  assert.ok(Array.isArray(result.affectedStakeholders));
});

test('Query: regulatory exposure returns coverage', () => {
  const { algebra } = createAlgebra(sampleUnits());
  const result = algebra.queryRegulatoryExposure();
  assert.ok(result.complianceCoverage);
  assert.ok(Array.isArray(result.exposedCommunications));
});

// ============================================================================
// Edge cases
// ============================================================================

test('Edge: empty unit array', () => {
  const { graph, algebra } = createAlgebra([]);
  assert.strictEqual(graph.getAllUnits().length, 0);
  const metrics = algebra.computeMetrics();
  assert.strictEqual(metrics.narrativeCoherenceIndex, 1.0);
  assert.strictEqual(metrics.totalUnits, 0);
});

test('Edge: single unit graph', () => {
  const { algebra } = createAlgebra([{
    id: 'solo',
    type: 'core_story',
    assertion: 'We do one thing.',
    intent: {},
    dependencies: [],
    confidence: 1.0,
  }]);
  const metrics = algebra.computeMetrics();
  assert.strictEqual(metrics.totalUnits, 1);
  assert.strictEqual(metrics.narrativeCoherenceIndex, 1.0);
});

test('Edge: unit with missing dependency gracefully degrades', () => {
  const { algebra } = createAlgebra([{
    id: 'orphan',
    type: 'positioning',
    assertion: 'We claim things.',
    intent: {},
    dependencies: ['nonexistent_parent'],
    confidence: 1.0,
  }]);
  // Should not throw; graph just won't find the dep
  const results = algebra.validateAll();
  assert.strictEqual(results.length, 1);
});

// ============================================================================
// Constants
// ============================================================================

test('Constants: ALL_LAYERS has 6 layers', () => {
  assert.strictEqual(ALL_LAYERS.length, 6);
});

test('Constants: STAKEHOLDER_PRESETS has 6 presets', () => {
  assert.strictEqual(Object.keys(STAKEHOLDER_PRESETS).length, 6);
});

test('Constants: LAYER_ORDER maps all layers', () => {
  for (const layer of ALL_LAYERS) {
    assert.ok(LAYER_ORDER[layer] !== undefined, `Missing LAYER_ORDER.${layer}`);
  }
});

// ============================================================================
// Summary
// ============================================================================

console.log('');
console.log(`  ──────────────────────`);
console.log(`  ${passed + failed} tests: ${passed} passed, ${failed} failed`);

process.exit(failed > 0 ? 1 : 0);
