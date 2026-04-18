/**
 * Narrative Algebra — JavaScript port
 *
 * A formal system of six operations on narrative units and narrative graphs.
 * The narrative algebra is to the narrative unit what relational algebra is
 * to the database row: the operational foundation that makes the primitive
 * universally useful.
 *
 * Operations:
 *   Σ  Compose   — Generate stakeholder-specific subgraphs
 *   Δ  Propagate — Compute impact sets of changed units
 *   Ω  Validate  — Evaluate alignment between units and dependencies
 *   ρ  Resonate  — Score external signals against the narrative graph
 *   κ  Cover     — Measure narrative completeness across domains
 *   δ  Drift     — Measure coherence decay over time
 *
 * The closure property of Compose ensures that the result of any operation
 * is a valid input to any subsequent operation — enabling arbitrarily
 * complex queries from simple algebraic primitives.
 *
 * @see Patent: "Systems and Methods for Composable Narrative Unit
 *      Architecture and Algebraic Operations on Narrative Graphs"
 */

'use strict';

// ============================================================================
// Constants
// ============================================================================

const LAYER_ORDER = {
  core_story: 0,
  positioning: 1,
  product_narrative: 2,
  operational: 3,
  evidence: 4,
  communication: 5,
};

const ALL_LAYERS = [
  'core_story', 'positioning', 'product_narrative',
  'operational', 'evidence', 'communication',
];

const STAKEHOLDER_PRESETS = {
  board: {
    typeFilter: ['core_story', 'positioning', 'evidence'],
    depth: 2,
    stakeholder: 'board',
  },
  engineering: {
    typeFilter: ['product_narrative', 'operational', 'evidence'],
    depth: Infinity,
    stakeholder: 'engineering',
  },
  compliance: {
    typeFilter: ['operational', 'evidence', 'core_story'],
    depth: Infinity,
    stakeholder: 'compliance',
  },
  customer: {
    typeFilter: ['product_narrative', 'communication', 'positioning'],
    depth: 3,
    stakeholder: 'customer',
  },
  investor: {
    typeFilter: ['core_story', 'positioning', 'evidence'],
    depth: 3,
    stakeholder: 'investor',
  },
  marketing: {
    typeFilter: ['positioning', 'communication', 'product_narrative'],
    depth: 3,
    stakeholder: 'marketing',
  },
};


// ============================================================================
// NarrativeGraph — In-memory graph built from parsed canon YAML units
// ============================================================================

class NarrativeGraph {
  /**
   * @param {Array} units — Array of narrative units from parseCanon().units
   *   Each unit must have: id, type, assertion, dependencies, confidence
   *   Optional: validationState (defaults to 'UNKNOWN'), intent, evidence_required
   */
  constructor(units) {
    /** @type {Map<string, object>} unit id → unit object */
    this.unitMap = new Map();

    /** @type {Map<string, Set<string>>} unit id → set of unit ids that depend ON this unit */
    this.dependentsMap = new Map();

    for (const raw of units) {
      // Ensure every unit has a validationState + attribution fields
      const unit = {
        ...raw,
        validationState: raw.validationState || 'UNKNOWN',
        dependencies: raw.dependencies || [],
        confidence: raw.confidence ?? 1.0,
        author: raw.author || null,
        authoredAt: raw.authoredAt || null,
        scope: raw.scope || null,
        tensionIntent: raw.tensionIntent || null,
        contestedBy: raw.contestedBy || [],
      };
      this.unitMap.set(unit.id, unit);
      // Initialize dependents set
      if (!this.dependentsMap.has(unit.id)) {
        this.dependentsMap.set(unit.id, new Set());
      }
    }

    // Build reverse adjacency (dependents) index
    for (const unit of this.unitMap.values()) {
      for (const depId of unit.dependencies) {
        if (!this.dependentsMap.has(depId)) {
          this.dependentsMap.set(depId, new Set());
        }
        this.dependentsMap.get(depId).add(unit.id);
      }
    }
  }

  /** Get a single unit by ID, or null */
  getUnit(id) {
    return this.unitMap.get(id) || null;
  }

  /** Get all units (ordered by creation / insertion order) */
  getAllUnits() {
    return Array.from(this.unitMap.values());
  }

  /** Get all units that THIS unit depends on (upstream) */
  getDependencies(unitId) {
    const unit = this.getUnit(unitId);
    if (!unit) return [];
    return unit.dependencies
      .map(id => this.getUnit(id))
      .filter(Boolean);
  }

  /** Get all units that depend ON this unit (downstream) */
  getDependents(unitId) {
    const depIds = this.dependentsMap.get(unitId);
    if (!depIds) return [];
    return Array.from(depIds)
      .map(id => this.getUnit(id))
      .filter(Boolean);
  }

  /** Update a unit's validation state and confidence in memory */
  updateValidationState(unitId, state, confidence) {
    const unit = this.getUnit(unitId);
    if (unit) {
      unit.validationState = state;
      if (confidence !== undefined) {
        unit.confidence = confidence;
      }
    }
  }

  /** Update a unit's attribution metadata */
  updateAttribution(unitId, { author, authoredAt, scope }) {
    const unit = this.getUnit(unitId);
    if (!unit) return null;
    if (author !== undefined) unit.author = author;
    if (authoredAt !== undefined) unit.authoredAt = authoredAt;
    if (scope !== undefined) unit.scope = scope;
    return unit;
  }

  /** Mark a unit as contested by another unit (or a named author) */
  markContested(unitId, contestedByUnitId) {
    const unit = this.getUnit(unitId);
    if (!unit) return null;
    if (!unit.contestedBy) unit.contestedBy = [];
    if (!unit.contestedBy.includes(contestedByUnitId)) {
      unit.contestedBy.push(contestedByUnitId);
    }
    unit.validationState = 'CONTESTED';
    return unit;
  }

  /** Set tension intent on a unit: 'drift', 'evolution', or 'deliberate_tension' */
  setTensionIntent(unitId, intent, metadata = {}) {
    const unit = this.getUnit(unitId);
    if (!unit) return null;
    unit.tensionIntent = intent;
    if (metadata.classifiedBy) unit.tensionClassifiedBy = metadata.classifiedBy;
    if (metadata.classifiedAt) unit.tensionClassifiedAt = metadata.classifiedAt;
    if (metadata.reason) unit.tensionReason = metadata.reason;
    return unit;
  }

  /** Get all units in a given scope (department/team subgraph) */
  getUnitsByScope(scope) {
    return this.getAllUnits().filter(u => u.scope === scope);
  }

  /** Get all distinct scopes in the graph */
  getScopes() {
    const scopes = new Set();
    for (const u of this.unitMap.values()) {
      if (u.scope) scopes.add(u.scope);
    }
    return Array.from(scopes);
  }

  /** Get all contested units */
  getContestedUnits() {
    return this.getAllUnits().filter(
      u => u.validationState === 'CONTESTED' || (u.contestedBy && u.contestedBy.length > 0)
    );
  }

  /** Get boundary units: units whose dependencies cross scope boundaries */
  getBoundaryUnits() {
    const boundaries = [];
    for (const unit of this.unitMap.values()) {
      if (!unit.scope) continue;
      for (const depId of unit.dependencies) {
        const dep = this.getUnit(depId);
        if (dep && dep.scope && dep.scope !== unit.scope) {
          boundaries.push({
            unit,
            dependency: dep,
            fromScope: unit.scope,
            toScope: dep.scope,
          });
        }
      }
    }
    return boundaries;
  }

  /** Graph statistics */
  getStats() {
    const all = this.getAllUnits();
    const byType = {};
    const byValidation = {};
    let totalEdges = 0;

    for (const u of all) {
      byType[u.type] = (byType[u.type] || 0) + 1;
      byValidation[u.validationState] = (byValidation[u.validationState] || 0) + 1;
      totalEdges += u.dependencies.length;
    }

    return { total: all.length, byType, byValidation, totalEdges };
  }
}


// ============================================================================
// NarrativeAlgebra — The six operations
// ============================================================================

class NarrativeAlgebra {
  /**
   * @param {NarrativeGraph} graph
   */
  constructor(graph) {
    this.graph = graph;
  }

  // ==========================================================================
  // Σ  COMPOSE — Generate stakeholder-specific subgraphs
  // ==========================================================================

  /**
   * Compose (Σ): Generate a stakeholder-specific subgraph.
   *
   * Σ(G, τ_filter, depth, stakeholder) = G′ ⊆ G
   *
   * The Compose operation is closed: the resulting subgraph is itself a valid
   * narrative graph on which all algebraic operations can be performed.
   */
  compose(params) {
    const allUnits = this.graph.getAllUnits();

    // Step 1: Filter by type
    let candidates = allUnits.filter(u => params.typeFilter.includes(u.type));

    // Step 2: Filter by depth (relative to highest included layer)
    if (params.depth !== Infinity) {
      const minLayerDepth = Math.min(
        ...params.typeFilter.map(t => LAYER_ORDER[t])
      );
      candidates = candidates.filter(u => {
        const unitDepth = LAYER_ORDER[u.type] - minLayerDepth;
        return unitDepth <= params.depth;
      });
    }

    // Step 3: Optional filters
    if (params.unitFilter) {
      const allowed = new Set(params.unitFilter);
      candidates = candidates.filter(u => allowed.has(u.id));
    }
    if (params.minConfidence !== undefined) {
      candidates = candidates.filter(u => u.confidence >= params.minConfidence);
    }
    if (params.validationStates) {
      const states = new Set(params.validationStates);
      candidates = candidates.filter(u => states.has(u.validationState));
    }

    // Step 4: Build edges (only between included units)
    const includedIds = new Set(candidates.map(u => u.id));
    const edges = [];
    for (const unit of candidates) {
      for (const depId of unit.dependencies) {
        if (includedIds.has(depId)) {
          edges.push({ from: unit.id, to: depId });
        }
      }
    }

    // Step 5: Sort by layer order
    candidates.sort((a, b) => LAYER_ORDER[a.type] - LAYER_ORDER[b.type]);

    return {
      units: candidates,
      edges,
      provenance: {
        operation: 'compose',
        parameters: { ...params },
        timestamp: new Date().toISOString(),
      },
    };
  }

  /** Compose from a predefined stakeholder preset. */
  composeForStakeholder(preset) {
    const config = STAKEHOLDER_PRESETS[preset];
    if (!config) {
      throw new Error(`Unknown stakeholder preset: ${preset}. Available: ${Object.keys(STAKEHOLDER_PRESETS).join(', ')}`);
    }
    return this.compose(config);
  }

  /**
   * Compose by scope: generate a department/team-specific subgraph.
   * Includes all units in the given scope + shared (unscoped) units
   * that they depend on.
   */
  composeByScope(scope) {
    const allUnits = this.graph.getAllUnits();

    // Step 1: Get all units in this scope + unscoped units
    const scopedUnits = allUnits.filter(u => u.scope === scope);
    const unscopedDeps = new Set();

    // Step 2: Also pull in unscoped units that scoped units depend on
    for (const unit of scopedUnits) {
      for (const depId of unit.dependencies) {
        const dep = this.graph.getUnit(depId);
        if (dep && !dep.scope) {
          unscopedDeps.add(dep.id);
        }
      }
    }

    const candidates = allUnits.filter(
      u => u.scope === scope || unscopedDeps.has(u.id)
    );

    // Build edges (only between included units)
    const includedIds = new Set(candidates.map(u => u.id));
    const edges = [];
    for (const unit of candidates) {
      for (const depId of unit.dependencies) {
        if (includedIds.has(depId)) {
          edges.push({ from: unit.id, to: depId });
        }
      }
    }

    candidates.sort((a, b) => LAYER_ORDER[a.type] - LAYER_ORDER[b.type]);

    return {
      units: candidates,
      edges,
      provenance: {
        operation: 'compose',
        parameters: { scope },
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Measure coherence at scope boundaries.
   * Returns cross-scope dependency pairs where the two units
   * are misaligned (different validation states), excluding
   * pairs where tension is marked deliberate.
   */
  measureBoundaryCoherence() {
    const boundaries = this.graph.getBoundaryUnits();
    const tensions = [];
    let alignedCount = 0;

    for (const b of boundaries) {
      const unitState = b.unit.validationState;
      const depState = b.dependency.validationState;
      const isAligned = unitState === depState ||
        (unitState === 'ALIGNED' && depState === 'ALIGNED');

      if (isAligned) {
        alignedCount++;
      } else {
        // Check if this tension is deliberate
        const isDeliberate = b.unit.tensionIntent === 'deliberate_tension' ||
          b.dependency.tensionIntent === 'deliberate_tension';

        tensions.push({
          unit: b.unit,
          dependency: b.dependency,
          fromScope: b.fromScope,
          toScope: b.toScope,
          deliberate: isDeliberate,
          unitState,
          depState,
        });
      }
    }

    const total = boundaries.length;
    const actionableTensions = tensions.filter(t => !t.deliberate);

    return {
      totalBoundaries: total,
      aligned: alignedCount,
      coherence: total > 0 ? alignedCount / total : 1.0,
      tensions,
      actionableTensions,
      deliberateTensions: tensions.filter(t => t.deliberate),
    };
  }

  /** Compose on an existing subgraph (closure property). */
  composeOnSubgraph(subgraph, params) {
    let candidates = [...subgraph.units];

    if (params.typeFilter) {
      candidates = candidates.filter(u => params.typeFilter.includes(u.type));
    }
    if (params.minConfidence !== undefined) {
      candidates = candidates.filter(u => u.confidence >= params.minConfidence);
    }
    if (params.validationStates) {
      const states = new Set(params.validationStates);
      candidates = candidates.filter(u => states.has(u.validationState));
    }

    const includedIds = new Set(candidates.map(u => u.id));
    const edges = subgraph.edges.filter(
      e => includedIds.has(e.from) && includedIds.has(e.to)
    );

    return {
      units: candidates,
      edges,
      provenance: {
        operation: 'compose',
        parameters: { ...params, composedFrom: subgraph.provenance },
        timestamp: new Date().toISOString(),
        parentGraph: subgraph.provenance.operation,
      },
    };
  }

  // ==========================================================================
  // Δ  PROPAGATE — Compute impact sets of changed units
  // ==========================================================================

  /**
   * Propagate (Δ): Compute the impact set of a changed unit.
   *
   * Δ(nᵢ, G) = {nⱼ ∈ G | nᵢ ∈ transitive_closure(D(nⱼ))}
   *
   * Returns all units whose transitive dependency chain includes the changed unit.
   */
  propagate(unitId, options) {
    const changedUnit = this.graph.getUnit(unitId);
    if (!changedUnit) {
      throw new Error(`Unit ${unitId} not found`);
    }

    const allUnits = this.graph.getAllUnits();
    const totalCount = allUnits.length;

    // BFS through dependents (deduplicated)
    const visited = new Set();
    const affected = [];
    const queue = [{ id: unitId, depth: 0 }];
    visited.add(unitId); // mark source as visited immediately

    while (queue.length > 0) {
      const { id, depth } = queue.shift();

      if (options?.maxDepth !== undefined && depth > options.maxDepth) continue;

      const dependents = this.graph.getDependents(id);
      for (const dep of dependents) {
        if (!visited.has(dep.id)) {
          visited.add(dep.id);
          if (!options?.typeFilter || options.typeFilter.includes(dep.type)) {
            affected.push(dep);
          }
          queue.push({ id: dep.id, depth: depth + 1 });
        }
      }
    }

    // Group by layer
    const byLayer = {};
    for (const layer of ALL_LAYERS) {
      byLayer[layer] = affected.filter(u => u.type === layer);
    }

    return {
      changedUnit,
      affectedUnits: affected,
      byLayer,
      scope: totalCount > 0 ? affected.length / totalCount : 0,
    };
  }

  // ==========================================================================
  // Ω  VALIDATE — Evaluate alignment between units and dependencies
  // ==========================================================================

  /**
   * Validate (Ω): Evaluate alignment of a unit against its dependencies.
   *
   * Ω(nᵢ, G) = f(α(nᵢ), {α(nⱼ) | nⱼ ∈ D(nᵢ)}, E(nᵢ)) → (V, c)
   */
  validate(unitId) {
    const unit = this.graph.getUnit(unitId);
    if (!unit) {
      throw new Error(`Unit ${unitId} not found`);
    }

    const previousState = unit.validationState;
    const reasons = [];
    const dependencyStates = [];

    // Get all dependencies
    const deps = this.graph.getDependencies(unitId);

    for (const dep of deps) {
      dependencyStates.push({
        id: dep.id,
        assertion: dep.assertion,
        state: dep.validationState,
      });
    }

    // Validation rules:
    // 0. If unit is CONTESTED, preserve that state (requires manual resolution)
    // 1. If unit has deliberate_tension intent, keep current state with note
    // 2. If any dependency is BROKEN, this unit is at least DRIFTED
    // 3. If any dependency is DRIFTED, this unit confidence drops
    // 4. If any dependency is CONTESTED, flag this unit too
    // 5. If all dependencies are ALIGNED, this unit can be ALIGNED

    const brokenDeps = deps.filter(d => d.validationState === 'BROKEN');
    const driftedDeps = deps.filter(d => d.validationState === 'DRIFTED');
    const contestedDeps = deps.filter(d => d.validationState === 'CONTESTED');
    const unknownDeps = deps.filter(d => d.validationState === 'UNKNOWN');

    let newState;
    let confidence;

    // Preserve CONTESTED state — it requires human resolution
    if (unit.validationState === 'CONTESTED' && (!unit.tensionIntent || unit.tensionIntent === 'drift')) {
      newState = 'CONTESTED';
      confidence = unit.confidence;
      reasons.push('Unit is CONTESTED — awaiting resolution');
    } else if (unit.tensionIntent === 'deliberate_tension') {
      // Deliberate tension: suppress drift/alarm signals
      newState = previousState === 'UNKNOWN' ? 'ALIGNED' : previousState;
      confidence = unit.confidence;
      reasons.push('Tension marked as DELIBERATE — suppressing alerts');
    } else if (unit.tensionIntent === 'evolution') {
      // Evolution: unit is intentionally changing — flag but don't alarm
      newState = 'DRIFTED';
      confidence = unit.confidence;
      reasons.push('Unit marked as EVOLUTION — intentional strategic shift');
    } else if (brokenDeps.length > 0) {
      newState = 'DRIFTED';
      confidence = Math.max(0.1, 1.0 - (brokenDeps.length / Math.max(deps.length, 1)));
      reasons.push(
        `${brokenDeps.length} dependency(ies) are BROKEN: ${brokenDeps.map(d => d.id).join(', ')}`
      );
    } else if (contestedDeps.length > 0) {
      newState = 'CONTESTED';
      confidence = Math.max(0.3, unit.confidence - (contestedDeps.length * 0.15));
      reasons.push(
        `${contestedDeps.length} dependency(ies) are CONTESTED: ${contestedDeps.map(d => d.id).join(', ')}`
      );
    } else if (driftedDeps.length > 0) {
      newState = 'DRIFTED';
      confidence = Math.max(0.3, 1.0 - (driftedDeps.length * 0.2 / Math.max(deps.length, 1)));
      reasons.push(
        `${driftedDeps.length} dependency(ies) are DRIFTED: ${driftedDeps.map(d => d.id).join(', ')}`
      );
    } else if (unknownDeps.length > 0) {
      newState = previousState === 'ALIGNED' ? 'ALIGNED' : 'UNKNOWN';
      confidence = Math.max(0.5, 1.0 - (unknownDeps.length * 0.1));
      reasons.push(
        `${unknownDeps.length} dependency(ies) not yet validated`
      );
    } else if (deps.length === 0 && unit.type !== 'core_story') {
      // Non-root unit with no dependencies — suspicious
      newState = previousState;
      confidence = 0.7;
      reasons.push('Unit has no dependencies (orphan) — confidence reduced');
    } else {
      newState = 'ALIGNED';
      confidence = Math.min(
        unit.confidence,
        ...deps.map(d => d.confidence)
      );
      reasons.push('All dependencies are ALIGNED');
    }

    // Update the unit in the graph
    this.graph.updateValidationState(unitId, newState, confidence);

    return {
      unitId,
      previousState,
      newState,
      confidence,
      reasons,
      dependencyStates,
    };
  }

  /**
   * Validate all units in the graph (full graph validation).
   * Processes in dependency order (roots first).
   */
  validateAll() {
    const allUnits = this.graph.getAllUnits();

    // Sort by layer order so we validate roots first
    const sorted = [...allUnits].sort(
      (a, b) => LAYER_ORDER[a.type] - LAYER_ORDER[b.type]
    );

    return sorted.map(u => this.validate(u.id));
  }

  // ==========================================================================
  // ρ  RESONATE — Score external signals against the narrative graph
  // ==========================================================================

  /**
   * Resonate (ρ): Evaluate an external signal against the narrative graph.
   *
   * ρ(signal, G) = (resonance, relevance, scope, urgency)
   *
   * Uses keyword matching for structural resonance.
   */
  resonate(signalText) {
    const allUnits = this.graph.getAllUnits();
    const signalWords = new Set(
      signalText.toLowerCase().split(/\W+/).filter(w => w.length > 3)
    );

    // Score each unit by keyword overlap
    const scored = allUnits.map(unit => {
      const assertionWords = new Set(
        unit.assertion.toLowerCase().split(/\W+/).filter(w => w.length > 3)
      );
      const overlap = [...signalWords].filter(w => assertionWords.has(w)).length;
      const similarity = signalWords.size > 0
        ? overlap / signalWords.size
        : 0;
      return { unit, similarity };
    });

    // Sort by similarity
    scored.sort((a, b) => b.similarity - a.similarity);
    const matchedUnits = scored.filter(s => s.similarity > 0).slice(0, 10);

    // Resonance: average similarity of top matches
    const resonance = matchedUnits.length > 0
      ? matchedUnits.reduce((sum, m) => sum + m.similarity, 0) / matchedUnits.length
      : 0;

    // Relevance: proximity to stakeholder-facing layers
    const stakeholderLayers = ['positioning', 'communication', 'product_narrative'];
    const stakeholderMatches = matchedUnits.filter(
      m => stakeholderLayers.includes(m.unit.type)
    );
    const relevance = matchedUnits.length > 0
      ? stakeholderMatches.length / matchedUnits.length
      : 0;

    // Scope: what % of graph would be affected
    const affectedIds = new Set();
    for (const match of matchedUnits) {
      const impact = this.propagate(match.unit.id);
      for (const u of impact.affectedUnits) {
        affectedIds.add(u.id);
      }
      affectedIds.add(match.unit.id);
    }
    const scope = allUnits.length > 0 ? affectedIds.size / allUnits.length : 0;

    // Urgency: function of scope and layer criticality
    const hasCoreStoryMatch = matchedUnits.some(m => m.unit.type === 'core_story');
    let urgency;
    if (scope > 0.5 || hasCoreStoryMatch) {
      urgency = 'critical';
    } else if (scope > 0.3) {
      urgency = 'high';
    } else if (scope > 0.1) {
      urgency = 'medium';
    } else {
      urgency = 'low';
    }

    return {
      resonance,
      relevance,
      scope,
      urgency,
      matchedUnits,
    };
  }

  // ==========================================================================
  // κ  COVER — Measure narrative completeness across domains
  // ==========================================================================

  /**
   * Cover (κ): Measure narrative coverage.
   *
   * κ(G, domain) = |{nᵢ ∈ G | domain(nᵢ) = domain ∧ V(nᵢ) = ALIGNED}| / |domain_total|
   */
  cover(options) {
    const allUnits = this.graph.getAllUnits();
    const layers = options?.layers || ALL_LAYERS;
    const coveredStates = new Set(options?.coveredStates || ['ALIGNED']);

    const inScope = allUnits.filter(u => layers.includes(u.type));
    const aligned = inScope.filter(u => coveredStates.has(u.validationState));

    // By layer
    const byLayer = {};
    for (const layer of ALL_LAYERS) {
      const layerUnits = inScope.filter(u => u.type === layer);
      const layerAligned = layerUnits.filter(u => coveredStates.has(u.validationState));
      byLayer[layer] = {
        total: layerUnits.length,
        aligned: layerAligned.length,
        coverage: layerUnits.length > 0 ? layerAligned.length / layerUnits.length : 0,
      };
    }

    // Gaps: non-evidence units with no evidence dependents
    const gaps = inScope.filter(u => {
      if (u.type === 'evidence') return false;
      const dependents = this.graph.getDependents(u.id);
      return !dependents.some(d => d.type === 'evidence');
    });

    // Orphans: units with no dependencies and no dependents
    const orphans = inScope.filter(u => {
      if (u.type === 'core_story') return false; // root nodes expected to have no deps
      const hasDeps = u.dependencies.length > 0;
      const hasDependents = this.graph.getDependents(u.id).length > 0;
      return !hasDeps && !hasDependents;
    });

    return {
      coverage: inScope.length > 0 ? aligned.length / inScope.length : 0,
      byLayer,
      gaps,
      orphans,
    };
  }

  /** Cover applied to a subgraph (closure property). */
  coverSubgraph(subgraph) {
    const units = subgraph.units;
    const aligned = units.filter(u => u.validationState === 'ALIGNED');

    const byLayer = {};
    for (const layer of ALL_LAYERS) {
      const layerUnits = units.filter(u => u.type === layer);
      const layerAligned = layerUnits.filter(u => u.validationState === 'ALIGNED');
      byLayer[layer] = {
        total: layerUnits.length,
        aligned: layerAligned.length,
        coverage: layerUnits.length > 0 ? layerAligned.length / layerUnits.length : 0,
      };
    }

    const subgraphIds = new Set(units.map(u => u.id));
    const gaps = units.filter(u => {
      if (u.type === 'evidence') return false;
      return !units.some(other =>
        other.type === 'evidence' && other.dependencies.some(d => d === u.id)
      );
    });

    const orphans = units.filter(u => {
      if (u.type === 'core_story') return false;
      const hasDeps = u.dependencies.some(d => subgraphIds.has(d));
      const hasDependents = units.some(
        other => other.dependencies.includes(u.id)
      );
      return !hasDeps && !hasDependents;
    });

    return {
      coverage: units.length > 0 ? aligned.length / units.length : 0,
      byLayer,
      gaps,
      orphans,
    };
  }

  // ==========================================================================
  // δ  DRIFT — Measure coherence decay over time
  // ==========================================================================

  /**
   * Drift (δ): Measure narrative coherence decay.
   *
   * δ(G, t₁, t₂) = |{nᵢ ∈ G | V(nᵢ, t₁) = ALIGNED ∧ V(nᵢ, t₂) ≠ ALIGNED}| / |G|
   */
  drift(options) {
    const allUnits = this.graph.getAllUnits();
    const layers = options?.layers || ALL_LAYERS;
    const inScope = allUnits.filter(u => layers.includes(u.type));

    const driftedUnits = inScope.filter(
      u => u.validationState === 'DRIFTED' || u.validationState === 'BROKEN'
    );

    const byLayer = {};
    for (const layer of ALL_LAYERS) {
      const layerUnits = inScope.filter(u => u.type === layer);
      const layerDrifted = layerUnits.filter(
        u => u.validationState === 'DRIFTED' || u.validationState === 'BROKEN'
      );
      byLayer[layer] = {
        total: layerUnits.length,
        drifted: layerDrifted.length,
        rate: layerUnits.length > 0 ? layerDrifted.length / layerUnits.length : 0,
      };
    }

    return {
      driftRate: inScope.length > 0 ? driftedUnits.length / inScope.length : 0,
      driftedUnits,
      byLayer,
    };
  }

  // ==========================================================================
  // METRICS — Computed from algebraic operations
  // ==========================================================================

  /**
   * Compute the Narrative Coherence Index and related metrics.
   *
   * NCI(G) = |{n ∈ G | V(n) = ALIGNED}| / |G|
   */
  computeMetrics() {
    const allUnits = this.graph.getAllUnits();
    const totalUnits = allUnits.length;

    const aligned = allUnits.filter(u => u.validationState === 'ALIGNED');

    const contested = allUnits.filter(u => u.validationState === 'CONTESTED');
    const deliberateTensions = allUnits.filter(u => u.tensionIntent === 'deliberate_tension');

    // Layer health
    const layerHealth = {};
    for (const layer of ALL_LAYERS) {
      const layerUnits = allUnits.filter(u => u.type === layer);
      const layerAligned = layerUnits.filter(u => u.validationState === 'ALIGNED');
      const layerDrifted = layerUnits.filter(u => u.validationState === 'DRIFTED');
      const layerBroken = layerUnits.filter(u => u.validationState === 'BROKEN');
      const layerContested = layerUnits.filter(u => u.validationState === 'CONTESTED');
      layerHealth[layer] = {
        nci: layerUnits.length > 0 ? layerAligned.length / layerUnits.length : 1.0,
        unitCount: layerUnits.length,
        alignedCount: layerAligned.length,
        driftedCount: layerDrifted.length,
        brokenCount: layerBroken.length,
        contestedCount: layerContested.length,
      };
    }

    // Coverage
    const coverResult = this.cover();

    // Scope health
    const scopes = this.graph.getScopes();
    const scopeHealth = {};
    for (const scope of scopes) {
      const scopeUnits = this.graph.getUnitsByScope(scope);
      const scopeAligned = scopeUnits.filter(u => u.validationState === 'ALIGNED');
      scopeHealth[scope] = {
        unitCount: scopeUnits.length,
        nci: scopeUnits.length > 0 ? scopeAligned.length / scopeUnits.length : 1.0,
      };
    }

    // Total edges
    let totalEdges = 0;
    for (const unit of allUnits) {
      totalEdges += unit.dependencies.length;
    }

    return {
      narrativeCoherenceIndex: totalUnits > 0 ? aligned.length / totalUnits : 1.0,
      coverageRatio: coverResult.coverage,
      layerHealth,
      scopeHealth,
      totalUnits,
      totalEdges,
      contestedCount: contested.length,
      deliberateTensionCount: deliberateTensions.length,
    };
  }

  // ==========================================================================
  // COMPOSED QUERIES — Demonstrating algebraic expressiveness
  // ==========================================================================

  /** Strategic alignment: validate engineering subgraph against board deps. */
  queryStrategicAlignment() {
    const engineeringView = this.composeForStakeholder('engineering');
    const boardView = this.composeForStakeholder('board');

    const boardIds = new Set(boardView.units.map(u => u.id));

    const misaligned = engineeringView.units.filter(unit => {
      return unit.dependencies.some(depId => {
        if (!boardIds.has(depId)) return false;
        const boardUnit = boardView.units.find(u => u.id === depId);
        return boardUnit && boardUnit.validationState !== 'ALIGNED';
      });
    });

    return { engineeringView, boardView, misaligned };
  }

  /** Competitive response: resonate signal, then propagate to compute full impact. */
  queryCompetitiveResponse(competitorSignal) {
    const resonance = this.resonate(competitorSignal);

    const totalImpact = resonance.matchedUnits.map(m =>
      this.propagate(m.unit.id)
    );

    // Which stakeholder views are affected?
    const allAffectedTypes = new Set();
    for (const impact of totalImpact) {
      for (const unit of impact.affectedUnits) {
        allAffectedTypes.add(unit.type);
      }
    }

    const affectedStakeholders = [];
    for (const [preset, config] of Object.entries(STAKEHOLDER_PRESETS)) {
      if (config.typeFilter.some(t => allAffectedTypes.has(t))) {
        affectedStakeholders.push(preset);
      }
    }

    return { resonance, totalImpact, affectedStakeholders };
  }

  /** Regulatory exposure: cover compliance domain → propagate to find exposed comms. */
  queryRegulatoryExposure() {
    const complianceView = this.composeForStakeholder('compliance');
    const complianceCoverage = this.coverSubgraph(complianceView);

    const unvalidated = complianceView.units.filter(
      u => u.validationState !== 'ALIGNED'
    );

    const exposedCommunications = [];
    for (const unit of unvalidated) {
      const impact = this.propagate(unit.id, {
        typeFilter: ['communication'],
      });
      exposedCommunications.push(...impact.affectedUnits);
    }

    // Deduplicate
    const seen = new Set();
    const deduped = exposedCommunications.filter(u => {
      if (seen.has(u.id)) return false;
      seen.add(u.id);
      return true;
    });

    return {
      complianceCoverage,
      exposedCommunications: deduped,
    };
  }
}


// ============================================================================
// Helper: Build graph + algebra from canon units and run initial validation
// ============================================================================

/**
 * Create a validated algebra instance from raw canon units.
 * Builds the graph, runs validateAll() to compute initial states,
 * then returns { graph, algebra } ready for any operation.
 */
function createAlgebra(units) {
  const graph = new NarrativeGraph(units);
  const algebra = new NarrativeAlgebra(graph);
  algebra.validateAll();
  return { graph, algebra };
}


module.exports = {
  NarrativeGraph,
  NarrativeAlgebra,
  createAlgebra,
  LAYER_ORDER,
  ALL_LAYERS,
  STAKEHOLDER_PRESETS,
};
