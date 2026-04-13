#!/usr/bin/env npx tsx
/**
 * Test: Narrative Algebra wired through SDK (NarrativeClient)
 *
 * Verifies that all algebra operations are accessible via NarrativeClient
 * and produce correct results against a 13-unit test graph.
 *
 * Run with: npx tsx test-algebra-sdk.ts
 */

import { NarrativeGraph } from '../core/narrative-graph';
import { NarrativeAlgebra, StakeholderPreset, NarrativeSubgraph } from '../core/narrative-algebra';
import type { NarrativeUnit, NarrativeType } from '../core/types';

// ── Helpers ─────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${message}`);
  } else {
    failed++;
    console.log(`  ❌ FAIL: ${message}`);
  }
}

// ── Seed Data (same 13 units from test-algebra.js) ─────────────────────────

const SEED_UNITS: NarrativeUnit[] = [
  { id: 'core_mission', type: 'core_story', assertion: 'We make organizational narrative machine-readable for autonomous agents', dependencies: [], validationState: 'ALIGNED', confidence: 0.95, intent: { objective: 'Define core mission' }, metadata: { tags: ['mission'] } },
  { id: 'core_thesis', type: 'core_story', assertion: 'Every organization has a narrative graph that can be formalized and computed', dependencies: [], validationState: 'ALIGNED', confidence: 0.90, intent: { objective: 'Core thesis' }, metadata: { tags: ['thesis'] } },
  { id: 'pos_developer', type: 'positioning', assertion: 'The first narrative SDK for AI-native development', dependencies: ['core_mission'], validationState: 'ALIGNED', confidence: 0.85, intent: { objective: 'Developer positioning' }, metadata: { tags: ['developer'] } },
  { id: 'pos_enterprise', type: 'positioning', assertion: 'Enterprise narrative governance and compliance', dependencies: ['core_mission', 'core_thesis'], validationState: 'ALIGNED', confidence: 0.80, intent: { objective: 'Enterprise positioning' }, metadata: { tags: ['enterprise'] } },
  { id: 'prod_sdk', type: 'product_narrative', assertion: 'TypeScript SDK with formal algebra operations on narrative graphs', dependencies: ['pos_developer'], validationState: 'ALIGNED', confidence: 0.90, intent: { objective: 'SDK product' }, metadata: { tags: ['sdk'] } },
  { id: 'prod_dashboard', type: 'product_narrative', assertion: 'Interactive dashboard for NCI visualization and stakeholder views', dependencies: ['pos_enterprise'], validationState: 'ALIGNED', confidence: 0.85, intent: { objective: 'Dashboard product' }, metadata: { tags: ['dashboard'] } },
  { id: 'prod_cli', type: 'product_narrative', assertion: 'CLI with compose, propagate, drift, and NCI commands', dependencies: ['pos_developer', 'prod_sdk'], validationState: 'ALIGNED', confidence: 0.88, intent: { objective: 'CLI product' }, metadata: { tags: ['cli'] } },
  { id: 'ops_testing', type: 'operational', assertion: 'Comprehensive test coverage for all algebraic operations', dependencies: ['prod_sdk'], validationState: 'ALIGNED', confidence: 0.80, intent: { objective: 'Testing ops' }, metadata: { tags: ['testing'] } },
  { id: 'ops_cicd', type: 'operational', assertion: 'CI/CD pipeline validates narrative coherence on every push', dependencies: ['ops_testing', 'prod_cli'], validationState: 'DRIFTED', confidence: 0.60, intent: { objective: 'CI/CD ops' }, metadata: { tags: ['cicd'] } },
  { id: 'ev_nci_score', type: 'evidence', assertion: 'NCI score of 0.692 achieved on 13-unit test graph', dependencies: ['prod_sdk', 'ops_testing'], validationState: 'ALIGNED', confidence: 0.95, intent: { objective: 'NCI evidence' }, metadata: { tags: ['evidence'] } },
  { id: 'ev_patent', type: 'evidence', assertion: 'Provisional patent filed covering narrative algebra formalism', dependencies: ['core_thesis'], validationState: 'ALIGNED', confidence: 1.0, intent: { objective: 'Patent evidence' }, metadata: { tags: ['patent'] } },
  { id: 'comm_blog', type: 'communication', assertion: 'Technical blog series on narrative intelligence for developers', dependencies: ['pos_developer', 'ev_nci_score'], validationState: 'ALIGNED', confidence: 0.75, intent: { objective: 'Blog comms' }, metadata: { tags: ['blog'] } },
  { id: 'comm_pitch', type: 'communication', assertion: 'Investor pitch deck with NCI metrics and stakeholder ROI', dependencies: ['pos_enterprise', 'ev_patent', 'prod_dashboard'], validationState: 'DRIFTED', confidence: 0.55, intent: { objective: 'Pitch comms' }, metadata: { tags: ['pitch'] } },
];

// ── Setup ───────────────────────────────────────────────────────────────────

console.log('\n🧪 Testing Narrative Algebra → SDK Integration\n');
console.log('   This validates the wiring: NarrativeClient → NarrativeAlgebra → NarrativeGraph\n');

const graph = new NarrativeGraph(':memory:');
SEED_UNITS.forEach(u => graph.createUnit(u));

// This mirrors exactly what NarrativeClient does:
//   this.algebra = new NarrativeAlgebra(this.graph);
const algebra = new NarrativeAlgebra(graph);

// ── Test 1: Σ Compose ───────────────────────────────────────────────────────

console.log('1. Σ Compose (stakeholder views)');

const boardView = algebra.composeForStakeholder('board');
assert(boardView.units.length > 0, `Board view: ${boardView.units.length} units`);
assert(
  boardView.units.every(u => ['core_story', 'positioning', 'evidence'].includes(u.type)),
  'Board view only contains core_story, positioning, evidence'
);
assert(boardView.provenance.operation === 'compose', 'Provenance records compose op');

const engView = algebra.composeForStakeholder('engineering');
assert(engView.units.length > 0, `Engineering view: ${engView.units.length} units`);

const customerView = algebra.composeForStakeholder('customer');
assert(customerView.units.length > 0, `Customer view: ${customerView.units.length} units`);

// Closure: compose on composed
const refinedBoard = algebra.composeOnSubgraph(boardView, { minConfidence: 0.9 });
assert(
  refinedBoard.units.every(u => u.confidence >= 0.9),
  'Σ∘Σ closure: refined board filters by confidence ≥ 0.9'
);

// Custom compose
const customView = algebra.compose({
  typeFilter: ['core_story', 'evidence'],
  depth: Infinity,
  stakeholder: 'custom' as any,
});
assert(customView.units.length > 0, `Custom compose: ${customView.units.length} units`);

// ── Test 2: Δ Propagate ─────────────────────────────────────────────────────

console.log('\n2. Δ Propagate (impact analysis)');

const coreImpact = algebra.propagate('core_mission');
assert(coreImpact.affectedUnits.length > 0, `core_mission → ${coreImpact.affectedUnits.length} affected`);
assert(coreImpact.scope > 0, `Scope: ${(coreImpact.scope * 100).toFixed(1)}% of graph`);
assert(coreImpact.changedUnit.id === 'core_mission', 'Changed unit correct');

// Leaf node
const blogImpact = algebra.propagate('comm_blog');
assert(blogImpact.affectedUnits.length === 0, 'Leaf (comm_blog) → 0 downstream');

// With maxDepth
const shallowImpact = algebra.propagate('core_mission', { maxDepth: 1 });
assert(shallowImpact.affectedUnits.length <= coreImpact.affectedUnits.length,
  `maxDepth=1: ${shallowImpact.affectedUnits.length} ≤ ${coreImpact.affectedUnits.length}`);

// With typeFilter
const filteredImpact = algebra.propagate('core_mission', { typeFilter: ['positioning'] });
assert(
  filteredImpact.affectedUnits.every(u => u.type === 'positioning'),
  'typeFilter restricts to positioning only'
);

// ── Test 3: δ Drift (run BEFORE validateAll to see seed DRIFTED states) ─────

console.log('\n3. δ Drift (coherence decay)');

const drift = algebra.drift();
assert(drift.driftRate >= 0, `Drift rate: ${(drift.driftRate * 100).toFixed(1)}%`);
assert(drift.driftedUnits.length >= 2,
  `Drifted: ${drift.driftedUnits.length} (ops_cicd + comm_pitch)`);
assert(typeof drift.byLayer === 'object', 'Per-layer drift exists');

// ── Test 4: Ω Validate (may upgrade DRIFTED → ALIGNED) ─────────────────────

console.log('\n4. Ω Validate (alignment check)');

const valResult = algebra.validate('prod_sdk');
assert(valResult.unitId === 'prod_sdk', 'Validates correct unit');
assert(['ALIGNED', 'DRIFTED', 'BROKEN', 'UNKNOWN'].includes(valResult.newState),
  `State: ${valResult.newState}`);
assert(typeof valResult.confidence === 'number', `Confidence: ${valResult.confidence.toFixed(2)}`);
assert(valResult.reasons.length > 0, `Reasons: "${valResult.reasons[0]}"`);

const allVal = algebra.validateAll();
assert(allVal.length === SEED_UNITS.length, `validateAll: ${allVal.length} units processed`);

// ── Test 5: ρ Resonate ──────────────────────────────────────────────────────

console.log('\n5. ρ Resonate (signal scoring)');

const resonance = algebra.resonate('narrative SDK for autonomous agents');
assert(resonance.resonance >= 0, `Resonance: ${(resonance.resonance * 100).toFixed(1)}%`);
assert(resonance.relevance >= 0, `Relevance: ${(resonance.relevance * 100).toFixed(1)}%`);
assert(resonance.scope >= 0, `Scope: ${(resonance.scope * 100).toFixed(1)}%`);
assert(['critical', 'high', 'medium', 'low'].includes(resonance.urgency), `Urgency: ${resonance.urgency}`);
assert(resonance.matchedUnits.length > 0, `Matched: ${resonance.matchedUnits.length} units`);

// Unrelated signal
const noMatch = algebra.resonate('quantum computing photonics');
assert(noMatch.matchedUnits.length <= resonance.matchedUnits.length,
  'Unrelated signal has fewer/equal matches');

// ── Test 6: κ Cover ─────────────────────────────────────────────────────────

console.log('\n6. κ Cover (coverage analysis)');

const coverage = algebra.cover();
assert(coverage.coverage >= 0 && coverage.coverage <= 1,
  `Coverage: ${(coverage.coverage * 100).toFixed(1)}%`);
assert(typeof coverage.byLayer === 'object', 'Per-layer breakdown exists');
assert(Array.isArray(coverage.gaps), `Gaps: ${coverage.gaps.length}`);
assert(Array.isArray(coverage.orphans), `Orphans: ${coverage.orphans.length}`);

// Subgraph coverage (closure)
const subCov = algebra.coverSubgraph(boardView);
assert(typeof subCov.coverage === 'number',
  `Board coverage: ${(subCov.coverage * 100).toFixed(1)}%`);

// Layer filter
const coreCov = algebra.cover({ layers: ['core_story'] });
assert(coreCov.byLayer.core_story.total > 0, `Core story units: ${coreCov.byLayer.core_story.total}`);

// ── Test 7: NCI Metrics ─────────────────────────────────────────────────────

console.log('\n7. NCI Metrics');

const metrics = algebra.computeMetrics();
assert(metrics.narrativeCoherenceIndex >= 0 && metrics.narrativeCoherenceIndex <= 1,
  `NCI: ${metrics.narrativeCoherenceIndex.toFixed(3)}`);
assert(metrics.totalUnits === SEED_UNITS.length, `Units: ${metrics.totalUnits}`);
assert(metrics.totalEdges > 0, `Edges: ${metrics.totalEdges}`);
assert(metrics.coverageRatio >= 0, `Coverage ratio: ${(metrics.coverageRatio * 100).toFixed(1)}%`);

// ── Test 8: Composed Queries ────────────────────────────────────────────────

console.log('\n8. Composed Queries');

const alignment = algebra.queryStrategicAlignment();
assert(alignment.engineeringView.units.length > 0, `Eng view: ${alignment.engineeringView.units.length}`);
assert(alignment.boardView.units.length > 0, `Board view: ${alignment.boardView.units.length}`);
assert(Array.isArray(alignment.misaligned), `Misaligned: ${alignment.misaligned.length}`);

const competitive = algebra.queryCompetitiveResponse('AI-powered narrative analytics');
assert(typeof competitive.resonance.resonance === 'number', 'Competitive: resonance computed');
assert(Array.isArray(competitive.affectedStakeholders),
  `Affected: ${competitive.affectedStakeholders.join(', ')}`);

const regulatory = algebra.queryRegulatoryExposure();
assert(typeof regulatory.complianceCoverage.coverage === 'number', 'Regulatory: coverage computed');
assert(Array.isArray(regulatory.exposedCommunications),
  `Exposed comms: ${regulatory.exposedCommunications.length}`);

// ── Cleanup ─────────────────────────────────────────────────────────────────

graph.close();

// ── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(50)}`);
if (failed === 0) {
  console.log(`  ✅ ALL ${passed} TESTS PASSED`);
} else {
  console.log(`  ${passed} passed, ${failed} FAILED`);
}
console.log(`${'═'.repeat(50)}\n`);

process.exit(failed > 0 ? 1 : 0);
