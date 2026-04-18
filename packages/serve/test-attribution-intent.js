/**
 * test-attribution-intent.js — Tests for:
 *   Feature 2: Attributed Canon (author, scope, CONTESTED state, boundary coherence)
 *   Feature 3: Intent Layer (drift, evolution, deliberate_tension classification)
 *
 * Uses Node.js built-in test runner (node --test).
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  NarrativeGraph,
  NarrativeAlgebra,
  createAlgebra,
  ALL_LAYERS,
} = require('./algebra');

const {
  unitsToYaml,
  MemoryAdapter,
} = require('./store');

const YAML = require('yaml');


// ============================================================================
// Helpers
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

// Build a multi-scope graph for testing:
// Engineering and Sales each have their own units, both depend on shared core_story
function buildScopedGraph() {
  return [
    makeUnit({ id: 'core-1', type: 'core_story', assertion: 'We are an API-first platform' }),
    makeUnit({ id: 'eng-1', type: 'product_narrative', assertion: 'Engineering believes we are API-first', scope: 'engineering', author: 'VP Engineering', dependencies: ['core-1'] }),
    makeUnit({ id: 'eng-2', type: 'operational', assertion: 'All integrations are REST APIs', scope: 'engineering', author: 'VP Engineering', dependencies: ['eng-1'] }),
    makeUnit({ id: 'sales-1', type: 'positioning', assertion: 'Sales positions us as full-platform', scope: 'sales', author: 'VP Sales', dependencies: ['core-1'] }),
    makeUnit({ id: 'sales-2', type: 'communication', assertion: 'We offer end-to-end solutions', scope: 'sales', author: 'VP Sales', dependencies: ['sales-1'] }),
    makeUnit({ id: 'mktg-1', type: 'communication', assertion: 'We are both premium and accessible', scope: 'marketing', author: 'CMO', dependencies: ['core-1'] }),
  ];
}


// ============================================================================
// Feature 2: Attributed Canon
// ============================================================================

describe('Attributed Canon — Schema', () => {
  it('NarrativeGraph carries author, authoredAt, scope fields', () => {
    const graph = new NarrativeGraph([
      makeUnit({ id: 'u1', author: 'Julie Allen', authoredAt: '2026-04-18', scope: 'engineering' }),
    ]);
    const u = graph.getUnit('u1');
    assert.equal(u.author, 'Julie Allen');
    assert.equal(u.authoredAt, '2026-04-18');
    assert.equal(u.scope, 'engineering');
  });

  it('defaults null for missing attribution fields', () => {
    const graph = new NarrativeGraph([makeUnit({ id: 'u1' })]);
    const u = graph.getUnit('u1');
    assert.equal(u.author, null);
    assert.equal(u.scope, null);
    assert.deepEqual(u.contestedBy, []);
  });

  it('updateAttribution updates author and scope', () => {
    const graph = new NarrativeGraph([makeUnit({ id: 'u1' })]);
    graph.updateAttribution('u1', { author: 'Fernando', scope: 'product' });
    const u = graph.getUnit('u1');
    assert.equal(u.author, 'Fernando');
    assert.equal(u.scope, 'product');
  });

  it('updateAttribution returns null for missing unit', () => {
    const graph = new NarrativeGraph([]);
    const result = graph.updateAttribution('missing', { author: 'x' });
    assert.equal(result, null);
  });
});

describe('Attributed Canon — YAML serialization', () => {
  it('unitsToYaml includes author, scope, tension_intent, contested_by', () => {
    const units = [
      makeUnit({
        id: 'u1',
        author: 'Julie Allen',
        authoredAt: '2026-04-18',
        scope: 'engineering',
        tensionIntent: 'deliberate_tension',
        contestedBy: ['u2'],
      }),
    ];
    const yaml = unitsToYaml(units);
    const parsed = YAML.parse(yaml);
    assert.equal(parsed.units[0].author, 'Julie Allen');
    assert.equal(parsed.units[0].authored_at, '2026-04-18');
    assert.equal(parsed.units[0].scope, 'engineering');
    assert.equal(parsed.units[0].tension_intent, 'deliberate_tension');
    assert.deepEqual(parsed.units[0].contested_by, ['u2']);
  });

  it('omits null/empty attribution fields from YAML', () => {
    const units = [makeUnit({ id: 'u1' })];
    const yaml = unitsToYaml(units);
    const parsed = YAML.parse(yaml);
    assert.equal(parsed.units[0].author, undefined);
    assert.equal(parsed.units[0].scope, undefined);
    assert.equal(parsed.units[0].tension_intent, undefined);
    assert.equal(parsed.units[0].contested_by, undefined);
  });
});

describe('Attributed Canon — MemoryAdapter', () => {
  it('saves and loads units with attribution fields', async () => {
    const store = new MemoryAdapter('test');
    await store.saveUnits([
      makeUnit({ id: 'u1', author: 'Julie', scope: 'engineering', tensionIntent: 'evolution', contestedBy: ['u2'] }),
    ], 'test.yml');

    const data = await store.load();
    assert.equal(data.units[0].author, 'Julie');
    assert.equal(data.units[0].scope, 'engineering');
    assert.equal(data.units[0].tensionIntent, 'evolution');
    assert.deepEqual(data.units[0].contestedBy, ['u2']);
  });
});


// ============================================================================
// Feature 2: CONTESTED State
// ============================================================================

describe('CONTESTED state', () => {
  it('markContested sets state to CONTESTED and records the contester', () => {
    const graph = new NarrativeGraph([
      makeUnit({ id: 'u1' }),
      makeUnit({ id: 'u2' }),
    ]);
    const result = graph.markContested('u1', 'u2');
    assert.equal(result.validationState, 'CONTESTED');
    assert.deepEqual(result.contestedBy, ['u2']);
  });

  it('markContested is idempotent — no duplicate entries', () => {
    const graph = new NarrativeGraph([makeUnit({ id: 'u1' })]);
    graph.markContested('u1', 'u2');
    graph.markContested('u1', 'u2');
    assert.equal(graph.getUnit('u1').contestedBy.length, 1);
  });

  it('getContestedUnits returns all contested units', () => {
    const graph = new NarrativeGraph([
      makeUnit({ id: 'u1' }),
      makeUnit({ id: 'u2' }),
      makeUnit({ id: 'u3' }),
    ]);
    graph.markContested('u1', 'u3');
    graph.markContested('u2', 'u3');
    assert.equal(graph.getContestedUnits().length, 2);
  });

  it('validate preserves CONTESTED state (requires manual resolution)', () => {
    const units = [
      makeUnit({ id: 'core', type: 'core_story' }),
      makeUnit({ id: 'pos', type: 'positioning', dependencies: ['core'] }),
    ];
    const { graph, algebra } = createAlgebra(units);
    graph.markContested('pos', 'core');
    const result = algebra.validate('pos');
    assert.equal(result.newState, 'CONTESTED');
    assert.ok(result.reasons.some(r => r.includes('CONTESTED')));
  });

  it('CONTESTED dependency propagates to dependent units', () => {
    const units = [
      makeUnit({ id: 'core', type: 'core_story', validationState: 'CONTESTED' }),
      makeUnit({ id: 'pos', type: 'positioning', dependencies: ['core'] }),
    ];
    const graph = new NarrativeGraph(units);
    // Manually set the contested state
    graph.getUnit('core').validationState = 'CONTESTED';
    const algebra = new NarrativeAlgebra(graph);
    const result = algebra.validate('pos');
    assert.equal(result.newState, 'CONTESTED');
  });
});


// ============================================================================
// Feature 2: Scoped Canon
// ============================================================================

describe('Scoped Canon — Graph queries', () => {
  it('getScopes returns distinct scopes', () => {
    const graph = new NarrativeGraph(buildScopedGraph());
    const scopes = graph.getScopes();
    assert.ok(scopes.includes('engineering'));
    assert.ok(scopes.includes('sales'));
    assert.ok(scopes.includes('marketing'));
    assert.equal(scopes.length, 3);
  });

  it('getUnitsByScope returns only units in that scope', () => {
    const graph = new NarrativeGraph(buildScopedGraph());
    const eng = graph.getUnitsByScope('engineering');
    assert.equal(eng.length, 2);
    assert.ok(eng.every(u => u.scope === 'engineering'));
  });

  it('getBoundaryUnits finds cross-scope dependencies', () => {
    const graph = new NarrativeGraph(buildScopedGraph());
    const boundaries = graph.getBoundaryUnits();
    // eng-1 → core-1 (eng → null) — not a scope boundary (core-1 is unscoped)
    // But sales-1 → core-1 is also not (core-1 is unscoped)
    // So no boundaries between scoped units exist in this graph
    assert.equal(boundaries.length, 0);
  });

  it('getBoundaryUnits detects cross-scope deps when both have scopes', () => {
    const units = [
      makeUnit({ id: 'eng-1', type: 'product_narrative', scope: 'engineering' }),
      makeUnit({ id: 'sales-1', type: 'positioning', scope: 'sales', dependencies: ['eng-1'] }),
    ];
    const graph = new NarrativeGraph(units);
    const boundaries = graph.getBoundaryUnits();
    assert.equal(boundaries.length, 1);
    assert.equal(boundaries[0].fromScope, 'sales');
    assert.equal(boundaries[0].toScope, 'engineering');
  });
});

describe('Scoped Canon — Algebra', () => {
  it('composeByScope includes scoped units + unscoped dependencies', () => {
    const units = buildScopedGraph();
    const { algebra } = createAlgebra(units);
    const engView = algebra.composeByScope('engineering');

    // Should include eng-1, eng-2 (scoped) + core-1 (unscoped dep)
    const ids = engView.units.map(u => u.id);
    assert.ok(ids.includes('eng-1'));
    assert.ok(ids.includes('eng-2'));
    assert.ok(ids.includes('core-1')); // pulled in as unscoped dep
    assert.ok(!ids.includes('sales-1'));
    assert.ok(!ids.includes('sales-2'));
  });

  it('composeByScope for sales includes sales units + shared core', () => {
    const { algebra } = createAlgebra(buildScopedGraph());
    const salesView = algebra.composeByScope('sales');
    const ids = salesView.units.map(u => u.id);
    assert.ok(ids.includes('sales-1'));
    assert.ok(ids.includes('sales-2'));
    assert.ok(ids.includes('core-1'));
    assert.ok(!ids.includes('eng-1'));
  });

  it('composeByScope provenance records the scope', () => {
    const { algebra } = createAlgebra(buildScopedGraph());
    const view = algebra.composeByScope('engineering');
    assert.equal(view.provenance.parameters.scope, 'engineering');
  });

  it('measureBoundaryCoherence reports 1.0 when no cross-scope deps exist', () => {
    const { algebra } = createAlgebra(buildScopedGraph());
    const bc = algebra.measureBoundaryCoherence();
    // No cross-scope deps (core-1 is unscoped), so coherence = 1.0
    assert.equal(bc.coherence, 1.0);
    assert.equal(bc.tensions.length, 0);
  });

  it('measureBoundaryCoherence detects tension between misaligned cross-scope units', () => {
    const units = [
      makeUnit({ id: 'eng-1', type: 'product_narrative', scope: 'engineering', validationState: 'ALIGNED' }),
      makeUnit({ id: 'sales-1', type: 'positioning', scope: 'sales', validationState: 'DRIFTED', dependencies: ['eng-1'] }),
    ];
    const graph = new NarrativeGraph(units);
    const algebra = new NarrativeAlgebra(graph);
    const bc = algebra.measureBoundaryCoherence();

    assert.equal(bc.totalBoundaries, 1);
    assert.equal(bc.tensions.length, 1);
    assert.equal(bc.actionableTensions.length, 1);
    assert.ok(bc.coherence < 1.0);
  });

  it('measureBoundaryCoherence separates deliberate from actionable tensions', () => {
    const units = [
      makeUnit({ id: 'eng-1', type: 'product_narrative', scope: 'engineering', validationState: 'ALIGNED' }),
      makeUnit({ id: 'sales-1', type: 'positioning', scope: 'sales', validationState: 'DRIFTED', dependencies: ['eng-1'], tensionIntent: 'deliberate_tension' }),
    ];
    const graph = new NarrativeGraph(units);
    const algebra = new NarrativeAlgebra(graph);
    const bc = algebra.measureBoundaryCoherence();

    assert.equal(bc.tensions.length, 1);
    assert.equal(bc.deliberateTensions.length, 1);
    assert.equal(bc.actionableTensions.length, 0);
  });
});

describe('Scoped Canon — computeMetrics includes scope health', () => {
  it('returns scopeHealth with per-scope NCI', () => {
    const { algebra } = createAlgebra(buildScopedGraph());
    const metrics = algebra.computeMetrics();
    assert.ok(metrics.scopeHealth);
    assert.ok(metrics.scopeHealth.engineering);
    assert.ok(metrics.scopeHealth.sales);
    assert.equal(metrics.scopeHealth.engineering.unitCount, 2);
    assert.equal(metrics.scopeHealth.sales.unitCount, 2);
  });

  it('returns contestedCount and deliberateTensionCount', () => {
    const units = buildScopedGraph();
    const { graph, algebra } = createAlgebra(units);
    graph.markContested('sales-1', 'eng-1');
    graph.setTensionIntent('mktg-1', 'deliberate_tension');
    const metrics = algebra.computeMetrics();
    assert.ok(metrics.contestedCount >= 1);
    assert.equal(metrics.deliberateTensionCount, 1);
  });
});


// ============================================================================
// Feature 3: Intent Layer
// ============================================================================

describe('Intent Layer — setTensionIntent', () => {
  it('sets tensionIntent on a unit', () => {
    const graph = new NarrativeGraph([makeUnit({ id: 'u1' })]);
    graph.setTensionIntent('u1', 'deliberate_tension', {
      classifiedBy: 'Julie',
      classifiedAt: '2026-04-18',
      reason: 'We know API-first and full-platform coexist',
    });
    const u = graph.getUnit('u1');
    assert.equal(u.tensionIntent, 'deliberate_tension');
    assert.equal(u.tensionClassifiedBy, 'Julie');
    assert.equal(u.tensionReason, 'We know API-first and full-platform coexist');
  });

  it('returns null for missing unit', () => {
    const graph = new NarrativeGraph([]);
    assert.equal(graph.setTensionIntent('missing', 'drift'), null);
  });
});

describe('Intent Layer — Validate respects tension intent', () => {
  it('deliberate_tension suppresses DRIFTED state', () => {
    const units = [
      makeUnit({ id: 'core', type: 'core_story' }),
      makeUnit({ id: 'pos', type: 'positioning', dependencies: ['core'], tensionIntent: 'deliberate_tension' }),
    ];
    const graph = new NarrativeGraph(units);
    // Make core BROKEN to create tension
    graph.getUnit('core').validationState = 'BROKEN';
    const algebra = new NarrativeAlgebra(graph);
    const result = algebra.validate('pos');
    // With deliberate_tension, it should NOT cascade to DRIFTED
    assert.ok(result.reasons.some(r => r.includes('DELIBERATE')));
    // State should be preserved (not overridden to DRIFTED)
    assert.notEqual(result.newState, 'DRIFTED');
  });

  it('evolution intent flags as DRIFTED with reason', () => {
    const units = [
      makeUnit({ id: 'core', type: 'core_story' }),
      makeUnit({ id: 'pos', type: 'positioning', dependencies: ['core'], tensionIntent: 'evolution' }),
    ];
    const { algebra } = createAlgebra(units);
    const result = algebra.validate('pos');
    assert.equal(result.newState, 'DRIFTED');
    assert.ok(result.reasons.some(r => r.includes('EVOLUTION')));
  });

  it('drift intent (or null) allows normal validation cascade', () => {
    const units = [
      makeUnit({ id: 'core', type: 'core_story', validationState: 'BROKEN' }),
      makeUnit({ id: 'pos', type: 'positioning', dependencies: ['core'], tensionIntent: 'drift' }),
    ];
    const graph = new NarrativeGraph(units);
    graph.getUnit('core').validationState = 'BROKEN';
    const algebra = new NarrativeAlgebra(graph);
    const result = algebra.validate('pos');
    assert.equal(result.newState, 'DRIFTED');
  });
});

describe('Intent Layer — Clarion distinction', () => {
  it('deliberate_tension does NOT affect Clarion (canon unchanged)', () => {
    // Clarion fires when canon changes. Marking tension as deliberate
    // doesn't change canon — it's metadata. So propagate() shouldn't
    // include deliberate_tension units as "changed" unless they're
    // actually modified.
    const units = [
      makeUnit({ id: 'core', type: 'core_story' }),
      makeUnit({ id: 'pos', type: 'positioning', dependencies: ['core'] }),
      makeUnit({ id: 'comm', type: 'communication', dependencies: ['pos'] }),
    ];
    const { graph, algebra } = createAlgebra(units);
    // Set deliberate tension on pos — NOT a canon change
    graph.setTensionIntent('pos', 'deliberate_tension');
    // Propagate from core change should still show impact
    const impact = algebra.propagate('core');
    assert.ok(impact.affectedUnits.some(u => u.id === 'pos'));
    assert.ok(impact.affectedUnits.some(u => u.id === 'comm'));
  });

  it('evolution intent triggers Clarion-like propagation (canon is changing)', () => {
    const units = [
      makeUnit({ id: 'core', type: 'core_story' }),
      makeUnit({ id: 'pos', type: 'positioning', dependencies: ['core'] }),
    ];
    const { algebra } = createAlgebra(units);
    const impact = algebra.propagate('core');
    assert.ok(impact.affectedUnits.length > 0);
  });
});

describe('Intent Layer — Full validation cycle', () => {
  it('validateAll handles mix of contested, deliberate, and normal units', () => {
    const units = [
      makeUnit({ id: 'core', type: 'core_story' }),
      makeUnit({ id: 'pos-ceo', type: 'positioning', dependencies: ['core'], author: 'CEO', scope: 'executive' }),
      makeUnit({ id: 'pos-vp', type: 'positioning', dependencies: ['core'], author: 'VP Sales', scope: 'sales' }),
      makeUnit({ id: 'comm', type: 'communication', dependencies: ['pos-ceo'], tensionIntent: 'deliberate_tension' }),
    ];
    const { graph, algebra } = createAlgebra(units);

    // Mark CEO vs VP conflict
    graph.markContested('pos-ceo', 'pos-vp');

    const results = algebra.validateAll();
    const coreResult = results.find(r => r.unitId === 'core');
    const ceoResult = results.find(r => r.unitId === 'pos-ceo');
    const commResult = results.find(r => r.unitId === 'comm');

    // core should be ALIGNED (root, no deps)
    assert.equal(coreResult.newState, 'ALIGNED');
    // pos-ceo should be CONTESTED (marked contested)
    assert.equal(ceoResult.newState, 'CONTESTED');
    // comm should be deliberate (suppressed)
    assert.ok(commResult.reasons.some(r => r.includes('DELIBERATE')));
  });
});


// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge cases', () => {
  it('empty graph has no scopes, no contested, no boundaries', () => {
    const { graph, algebra } = createAlgebra([]);
    assert.deepEqual(graph.getScopes(), []);
    assert.deepEqual(graph.getContestedUnits(), []);
    assert.deepEqual(graph.getBoundaryUnits(), []);
    const bc = algebra.measureBoundaryCoherence();
    assert.equal(bc.coherence, 1.0);
    assert.equal(bc.tensions.length, 0);
  });

  it('single unit with scope', () => {
    const { graph, algebra } = createAlgebra([
      makeUnit({ id: 'u1', scope: 'engineering' }),
    ]);
    assert.deepEqual(graph.getScopes(), ['engineering']);
    const view = algebra.composeByScope('engineering');
    assert.equal(view.units.length, 1);
  });

  it('composeByScope for nonexistent scope returns empty', () => {
    const { algebra } = createAlgebra(buildScopedGraph());
    const view = algebra.composeByScope('nonexistent');
    assert.equal(view.units.length, 0);
  });

  it('markContested on nonexistent unit returns null', () => {
    const graph = new NarrativeGraph([]);
    assert.equal(graph.markContested('missing', 'other'), null);
  });

  it('computeMetrics handles layer with contested count', () => {
    const units = [
      makeUnit({ id: 'u1', type: 'core_story' }),
    ];
    const { graph, algebra } = createAlgebra(units);
    graph.markContested('u1', 'other');
    const metrics = algebra.computeMetrics();
    assert.equal(metrics.layerHealth.core_story.contestedCount, 1);
  });
});
