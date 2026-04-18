/**
 * prescriptive-actions.js — Rule-based prescriptive action engine
 *
 * When Resonate or Validate finds tension, this module generates concrete
 * next-step recommendations. Each action has a type, description, priority,
 * and (optionally) a one-click operation the UI can execute.
 *
 * Action types:
 *   - update_canon: edit a unit's assertion to reflect new reality
 *   - schedule_review: create a review checkpoint for stakeholder alignment
 *   - escalate: flag for leadership/cross-team resolution
 *   - mark_intent: classify tension (drift/evolution/deliberate)
 *   - add_evidence: request evidence to support or refute a unit
 *   - resolve_contest: resolve a contested unit by choosing a version
 *
 * The LLM upgrade path: generateLLMRecommendation() wraps the rule-based
 * output with contextual LLM analysis for deeper, tailored suggestions.
 *
 * Zero external dependencies.
 */

'use strict';

const { ALL_LAYERS, DEFAULT_LAYER_WEIGHTS } = require('./algebra');


// ============================================================================
// Action Templates
// ============================================================================

/**
 * Generate prescriptive actions for a unit based on its state, context, and
 * relationships.
 *
 * @param {Object} unit - The narrative unit
 * @param {Object} context - { graph, algebra, allUnits }
 * @returns {Array<Object>} Array of action recommendations
 */
function generateActions(unit, context) {
  const actions = [];
  const { graph } = context;

  // ---------------------------------------------------------------------------
  // CONTESTED units — the political dimension
  // ---------------------------------------------------------------------------
  if (unit.validationState === 'CONTESTED') {
    // Who contested it?
    const contesters = (unit.contestedBy || []).map(id => {
      const other = graph ? graph.getUnit(id) : null;
      return other ? { id: other.id, assertion: other.assertion, author: other.author, scope: other.scope } : { id };
    });

    actions.push({
      type: 'resolve_contest',
      priority: 'critical',
      title: 'Resolve contested narrative',
      description: `This unit is contested${contesters.length > 0 ? ` by ${contesters.map(c => c.author || c.id).join(', ')}` : ''}. Schedule a stakeholder alignment session to reconcile conflicting assertions.`,
      details: {
        currentAssertion: unit.assertion,
        currentAuthor: unit.author,
        contestants: contesters,
      },
      operation: { action: 'schedule_review', unitId: unit.id, reviewType: 'contested_resolution' },
    });

    // If it has a scope, suggest scoped resolution
    if (unit.scope) {
      actions.push({
        type: 'escalate',
        priority: 'high',
        title: `Escalate to ${unit.scope} leadership`,
        description: `This contested unit belongs to the ${unit.scope} scope. Route to the scope owner for resolution before it blocks downstream units.`,
        operation: { action: 'escalate', unitId: unit.id, targetScope: unit.scope },
      });
    }
  }

  // ---------------------------------------------------------------------------
  // DRIFTED units — needs attention
  // ---------------------------------------------------------------------------
  if (unit.validationState === 'DRIFTED') {
    // First: if no intent is set, suggest classifying
    if (!unit.tensionIntent) {
      actions.push({
        type: 'mark_intent',
        priority: 'high',
        title: 'Classify this tension',
        description: 'This unit is drifting. Is this drift unintentional, an intentional evolution, or a deliberate tension you want to keep?',
        options: [
          { intent: 'drift', label: 'Drift — unintentional, needs fix', description: 'This misalignment wasn\'t planned. It should be corrected.' },
          { intent: 'evolution', label: 'Evolution — strategic shift', description: 'Strategy changed. Update canon to match the new direction.' },
          { intent: 'deliberate_tension', label: 'Deliberate — by design', description: 'This tension is intentional. Suppress future alerts for this pair.' },
        ],
        operation: { action: 'classify_tension', unitId: unit.id },
      });
    }

    // If marked as drift — suggest concrete fix
    if (unit.tensionIntent === 'drift') {
      // Check what's causing the drift
      const deps = graph ? graph.getDependencies(unit.id) : [];
      const brokenDeps = deps.filter(d => d.validationState === 'BROKEN' || d.validationState === 'DRIFTED');

      if (brokenDeps.length > 0) {
        actions.push({
          type: 'update_canon',
          priority: 'high',
          title: `Fix upstream: ${brokenDeps.map(d => d.id).join(', ')}`,
          description: `This unit drifted because ${brokenDeps.length} upstream unit(s) are misaligned. Fix them first, and this unit may realign automatically.`,
          details: { brokenDependencies: brokenDeps.map(d => ({ id: d.id, assertion: d.assertion, state: d.validationState })) },
          operation: { action: 'navigate_to_unit', unitId: brokenDeps[0].id },
        });
      } else {
        actions.push({
          type: 'update_canon',
          priority: 'high',
          title: 'Update this unit\'s assertion',
          description: `Review and update "${unit.assertion}" to reflect current organizational reality.`,
          operation: { action: 'edit_unit', unitId: unit.id },
        });
      }
    }

    // If marked as evolution — suggest canon update
    if (unit.tensionIntent === 'evolution') {
      actions.push({
        type: 'update_canon',
        priority: 'medium',
        title: 'Update canon to match new strategy',
        description: `This unit represents an intentional shift. Update the assertion and propagate changes to downstream units.`,
        operation: { action: 'edit_unit', unitId: unit.id },
      });

      // Show what downstream units would need updating
      if (context.algebra) {
        const impact = context.algebra.propagate(unit.id);
        if (impact.affectedUnits.length > 0) {
          actions.push({
            type: 'schedule_review',
            priority: 'medium',
            title: `Review ${impact.affectedUnits.length} downstream unit(s)`,
            description: `Updating this unit will affect ${impact.affectedUnits.length} downstream units across ${Object.keys(impact.byLayer).filter(l => impact.byLayer[l].length > 0).length} layers. Schedule a review to ensure coherence.`,
            details: {
              affectedCount: impact.affectedUnits.length,
              affectedIds: impact.affectedUnits.map(u => u.id),
              scope: impact.scope,
            },
            operation: { action: 'schedule_review', unitId: unit.id, reviewType: 'evolution_propagation' },
          });
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // BROKEN units — urgent
  // ---------------------------------------------------------------------------
  if (unit.validationState === 'BROKEN') {
    actions.push({
      type: 'update_canon',
      priority: 'critical',
      title: 'This unit is broken — immediate action required',
      description: `"${unit.assertion}" has been marked as broken. This blocks all downstream validation. Fix or remove it.`,
      operation: { action: 'edit_unit', unitId: unit.id },
    });

    // Check scope and escalate if needed
    if (unit.scope) {
      actions.push({
        type: 'escalate',
        priority: 'critical',
        title: `Alert ${unit.scope} scope owner`,
        description: `A broken unit in the ${unit.scope} scope may affect boundary coherence with other teams.`,
        operation: { action: 'escalate', unitId: unit.id, targetScope: unit.scope },
      });
    }
  }

  // ---------------------------------------------------------------------------
  // UNKNOWN / unvalidated — needs evidence
  // ---------------------------------------------------------------------------
  if (unit.validationState === 'UNKNOWN') {
    actions.push({
      type: 'add_evidence',
      priority: 'low',
      title: 'Validate this unit',
      description: `"${unit.assertion}" hasn't been validated yet. Add evidence or confirm alignment with dependencies.`,
      operation: { action: 'validate_unit', unitId: unit.id },
    });
  }

  // ---------------------------------------------------------------------------
  // Orphan units — no dependencies and not root
  // ---------------------------------------------------------------------------
  if (unit.type !== 'core_story' && (!unit.dependencies || unit.dependencies.length === 0)) {
    const hasDependents = graph ? graph.getDependents(unit.id).length > 0 : false;
    if (!hasDependents) {
      actions.push({
        type: 'update_canon',
        priority: 'low',
        title: 'Connect this orphan unit',
        description: `"${unit.assertion}" has no connections to other units. Link it to a parent unit or remove it.`,
        operation: { action: 'edit_unit', unitId: unit.id },
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Missing attribution
  // ---------------------------------------------------------------------------
  if (!unit.author) {
    actions.push({
      type: 'update_canon',
      priority: 'low',
      title: 'Add author attribution',
      description: 'This unit has no author. Attributed truth is more trustworthy than anonymous truth.',
      operation: { action: 'attribute_unit', unitId: unit.id },
    });
  }

  // Sort by priority
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  actions.sort((a, b) => (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9));

  return actions;
}


// ============================================================================
// Batch: generate actions for all units needing attention
// ============================================================================

/**
 * Generate prescriptive actions for every unit that needs attention.
 * Returns a prioritized list of all recommended actions across the graph.
 *
 * @param {Object} graph - NarrativeGraph instance
 * @param {Object} algebra - NarrativeAlgebra instance
 * @returns {Array<Object>} All actions, sorted by priority
 */
function generateAllActions(graph, algebra) {
  const allUnits = graph.getAllUnits();
  const context = { graph, algebra, allUnits };
  const allActions = [];

  for (const unit of allUnits) {
    // Only generate for units needing attention
    if (['DRIFTED', 'BROKEN', 'CONTESTED', 'UNKNOWN'].includes(unit.validationState) ||
        !unit.author ||
        (unit.type !== 'core_story' && (!unit.dependencies || unit.dependencies.length === 0))) {
      const unitActions = generateActions(unit, context);
      for (const action of unitActions) {
        allActions.push({
          ...action,
          unitId: unit.id,
          unitType: unit.type,
          unitAssertion: unit.assertion,
          unitScope: unit.scope,
          unitAuthor: unit.author,
        });
      }
    }
  }

  // Sort globally by priority
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  allActions.sort((a, b) => (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9));

  return allActions;
}


// ============================================================================
// Summary: action counts by type and priority
// ============================================================================

function summarizeActions(actions) {
  const byPriority = { critical: 0, high: 0, medium: 0, low: 0 };
  const byType = {};

  for (const a of actions) {
    byPriority[a.priority] = (byPriority[a.priority] || 0) + 1;
    byType[a.type] = (byType[a.type] || 0) + 1;
  }

  return {
    total: actions.length,
    byPriority,
    byType,
    topActions: actions.slice(0, 5), // top 5 by priority
  };
}


// ============================================================================
// LLM Upgrade: build prompt for richer recommendations
// ============================================================================

/**
 * Build a prompt for LLM-enhanced recommendation on a specific tension.
 * This doesn't call the LLM — it prepares the prompt so the API route
 * can feed it to whatever LLM is configured.
 *
 * @param {Object} unit - The unit with tension
 * @param {Object} context - { graph, relatedUnits, ruleBasedActions }
 * @returns {string} The prompt
 */
function buildLLMPrompt(unit, context) {
  const { relatedUnits, ruleBasedActions } = context;

  const deps = relatedUnits?.dependencies || [];
  const dependents = relatedUnits?.dependents || [];

  return `You are a narrative alignment advisor for an organizational coherence platform.

A narrative unit is showing tension and needs a recommendation.

UNIT:
- ID: ${unit.id}
- Layer: ${unit.type}
- Assertion: "${unit.assertion}"
- Author: ${unit.author || 'unattributed'}
- Scope: ${unit.scope || 'org-wide'}
- Current state: ${unit.validationState}
- Tension intent: ${unit.tensionIntent || 'unclassified'}
${unit.contestedBy?.length > 0 ? `- Contested by: ${unit.contestedBy.join(', ')}` : ''}

UPSTREAM DEPENDENCIES (${deps.length}):
${deps.map(d => `  - ${d.id} (${d.type}): "${d.assertion}" [${d.validationState}]`).join('\n') || '  None'}

DOWNSTREAM DEPENDENTS (${dependents.length}):
${dependents.map(d => `  - ${d.id} (${d.type}): "${d.assertion}" [${d.validationState}]`).join('\n') || '  None'}

RULE-BASED SUGGESTIONS:
${ruleBasedActions.map((a, i) => `  ${i + 1}. [${a.priority}] ${a.title}: ${a.description}`).join('\n') || '  None generated'}

Given this context, provide:
1. A diagnosis: Why is this tension happening? What organizational dynamic does it reveal?
2. A specific recommendation: What should the team do, and in what order?
3. Who should be involved: Which stakeholders or roles need to participate?
4. Risk if ignored: What happens if this tension persists?

Be concrete and organizational — not abstract. Reference the specific assertions and relationships.`;
}


// ============================================================================
// Exports
// ============================================================================

module.exports = {
  generateActions,
  generateAllActions,
  summarizeActions,
  buildLLMPrompt,
};
