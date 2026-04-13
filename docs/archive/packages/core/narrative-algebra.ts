/**
 * Narrative Algebra
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

import { NarrativeGraph, type QueryFilters } from './narrative-graph';
import type {
  NarrativeUnit,
  NarrativeType,
  ValidationState,
  StorySignal,
} from './types';


// ============================================================================
// Types for algebraic operations
// ============================================================================

/**
 * A NarrativeSubgraph is the result of any algebraic operation.
 * It is itself a valid input to any subsequent operation (closure property).
 */
export interface NarrativeSubgraph {
  /** The units in this subgraph */
  units: NarrativeUnit[];

  /** Edges preserved from the parent graph (only between included units) */
  edges: Array<{ from: string; to: string }>;

  /** Metadata about how this subgraph was produced */
  provenance: {
    operation: string;
    parameters: Record<string, unknown>;
    timestamp: string;
    parentGraph?: string;
  };
}

/** Parameters for the Compose operation Σ */
export interface ComposeParams {
  /** Filter by narrative unit types to include */
  typeFilter: NarrativeType[];

  /** Maximum dependency depth to traverse (Infinity = no limit) */
  depth: number;

  /** Stakeholder label (for provenance tracking) */
  stakeholder: string;

  /** Optional: only include units matching these IDs */
  unitFilter?: string[];

  /** Optional: minimum confidence threshold */
  minConfidence?: number;

  /** Optional: only include these validation states */
  validationStates?: ValidationState[];
}

/** Predefined stakeholder compositions */
export type StakeholderPreset =
  | 'board'
  | 'engineering'
  | 'compliance'
  | 'customer'
  | 'investor'
  | 'marketing';

/** Result of the Propagate operation Δ */
export interface PropagationResult {
  /** The unit that changed */
  changedUnit: NarrativeUnit;

  /** All affected units (full transitive closure of dependents) */
  affectedUnits: NarrativeUnit[];

  /** Affected units grouped by layer */
  byLayer: Record<NarrativeType, NarrativeUnit[]>;

  /** Scope: percentage of total graph affected */
  scope: number;
}

/** Result of the Validate operation Ω */
export interface ValidationResult {
  unitId: string;
  previousState: ValidationState;
  newState: ValidationState;
  confidence: number;
  reasons: string[];
  dependencyStates: Array<{
    id: string;
    assertion: string;
    state: ValidationState;
  }>;
}

/** Result of the Resonate operation ρ */
export interface ResonanceResult {
  /** Semantic similarity to existing assertions (0-1) */
  resonance: number;

  /** Proximity to stakeholder-facing layers (0-1) */
  relevance: number;

  /** Percentage of graph affected */
  scope: number;

  /** Time-sensitivity based on scope and layer criticality */
  urgency: 'critical' | 'high' | 'medium' | 'low';

  /** Most relevant existing units */
  matchedUnits: Array<{
    unit: NarrativeUnit;
    similarity: number;
  }>;
}

/** Result of the Cover operation κ */
export interface CoverageResult {
  /** Overall coverage: aligned units / total in domain */
  coverage: number;

  /** Coverage broken down by layer */
  byLayer: Record<NarrativeType, {
    total: number;
    aligned: number;
    coverage: number;
  }>;

  /** Units with no evidence (gap analysis) */
  gaps: NarrativeUnit[];

  /** Orphan units (no deps, no dependents) */
  orphans: NarrativeUnit[];
}

/** Result of the Drift operation δ */
export interface DriftResult {
  /** Percentage of units that lost alignment */
  driftRate: number;

  /** Units that drifted */
  driftedUnits: NarrativeUnit[];

  /** Drift broken down by layer */
  byLayer: Record<NarrativeType, {
    total: number;
    drifted: number;
    rate: number;
  }>;
}

/** Narrative Coherence Index and related metrics */
export interface NarrativeMetrics {
  /** NCI(G) = |{n ∈ G | V(n) = ALIGNED}| / |G| */
  narrativeCoherenceIndex: number;

  /** Coverage ratio from Cover operation */
  coverageRatio: number;

  /** Breakdown by layer */
  layerHealth: Record<NarrativeType, {
    nci: number;
    unitCount: number;
    alignedCount: number;
    driftedCount: number;
    brokenCount: number;
  }>;

  /** Dependency fragility: edges that break most often */
  totalUnits: number;
  totalEdges: number;
}


// ============================================================================
// Stakeholder presets
// ============================================================================

const STAKEHOLDER_PRESETS: Record<StakeholderPreset, ComposeParams> = {
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
// Layer ordering (used for sorting and depth computation)
// ============================================================================

const LAYER_ORDER: Record<NarrativeType, number> = {
  core_story: 0,
  positioning: 1,
  product_narrative: 2,
  operational: 3,
  evidence: 4,
  communication: 5,
};

const ALL_LAYERS: NarrativeType[] = [
  'core_story', 'positioning', 'product_narrative',
  'operational', 'evidence', 'communication',
];


// ============================================================================
// NarrativeAlgebra
// ============================================================================

export class NarrativeAlgebra {
  private graph: NarrativeGraph;

  constructor(graph: NarrativeGraph) {
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
  compose(params: ComposeParams): NarrativeSubgraph {
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
      candidates = candidates.filter(u => u.confidence >= params.minConfidence!);
    }
    if (params.validationStates) {
      const states = new Set(params.validationStates);
      candidates = candidates.filter(u =>
        states.has(u.validationState)
      );
    }

    // Step 4: Build edges (only between included units)
    const includedIds = new Set(candidates.map(u => u.id));
    const edges: Array<{ from: string; to: string }> = [];

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

  /**
   * Compose from a predefined stakeholder preset.
   */
  composeForStakeholder(preset: StakeholderPreset): NarrativeSubgraph {
    return this.compose(STAKEHOLDER_PRESETS[preset]);
  }

  /**
   * Compose on an existing subgraph (composition of compositions).
   * This demonstrates the closure property.
   */
  composeOnSubgraph(
    subgraph: NarrativeSubgraph,
    params: Partial<ComposeParams>
  ): NarrativeSubgraph {
    let candidates = [...subgraph.units];

    if (params.typeFilter) {
      candidates = candidates.filter(u => params.typeFilter!.includes(u.type));
    }
    if (params.minConfidence !== undefined) {
      candidates = candidates.filter(u => u.confidence >= params.minConfidence!);
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
  propagate(
    unitId: string,
    options?: {
      /** Max layers deep to propagate */
      maxDepth?: number;
      /** Only propagate to these types */
      typeFilter?: NarrativeType[];
    }
  ): PropagationResult {
    const changedUnit = this.graph.getUnit(unitId);
    if (!changedUnit) {
      throw new Error(`Unit ${unitId} not found`);
    }

    const allUnits = this.graph.getAllUnits();
    const totalCount = allUnits.length;

    // BFS through dependents
    const visited = new Set<string>();
    const affected: NarrativeUnit[] = [];
    const queue: Array<{ id: string; depth: number }> = [{ id: unitId, depth: 0 }];

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);

      if (options?.maxDepth !== undefined && depth > options.maxDepth) continue;

      const dependents = this.graph.getDependents(id);
      for (const dep of dependents) {
        if (!visited.has(dep.id)) {
          if (!options?.typeFilter || options.typeFilter.includes(dep.type)) {
            affected.push(dep);
          }
          queue.push({ id: dep.id, depth: depth + 1 });
        }
      }
    }

    // Group by layer
    const byLayer: Record<NarrativeType, NarrativeUnit[]> = {} as any;
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
   *
   * This is a structural validation — it checks dependency states and
   * propagation consistency. For semantic validation (NLP/embedding-based),
   * the SemanticDriftDetector in the Python layer handles that.
   */
  validate(unitId: string): ValidationResult {
    const unit = this.graph.getUnit(unitId);
    if (!unit) {
      throw new Error(`Unit ${unitId} not found`);
    }

    const previousState = unit.validationState;
    const reasons: string[] = [];
    const dependencyStates: ValidationResult['dependencyStates'] = [];

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
    // 1. If any dependency is BROKEN, this unit is at least DRIFTED
    // 2. If any dependency is DRIFTED, this unit confidence drops
    // 3. If all dependencies are ALIGNED, this unit can be ALIGNED

    const brokenDeps = deps.filter(d => d.validationState === 'BROKEN');
    const driftedDeps = deps.filter(d => d.validationState === 'DRIFTED');
    const unknownDeps = deps.filter(d => d.validationState === 'UNKNOWN');

    let newState: ValidationState;
    let confidence: number;

    if (brokenDeps.length > 0) {
      newState = 'DRIFTED';
      confidence = Math.max(0.1, 1.0 - (brokenDeps.length / Math.max(deps.length, 1)));
      reasons.push(
        `${brokenDeps.length} dependency(ies) are BROKEN: ${brokenDeps.map(d => d.id).join(', ')}`
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
  validateAll(): ValidationResult[] {
    const allUnits = this.graph.getAllUnits();

    // Sort by layer order so we validate roots first
    allUnits.sort((a, b) => LAYER_ORDER[a.type] - LAYER_ORDER[b.type]);

    return allUnits.map(u => this.validate(u.id));
  }

  // ==========================================================================
  // ρ  RESONATE — Score external signals against the narrative graph
  // ==========================================================================

  /**
   * Resonate (ρ): Evaluate an external signal against the narrative graph.
   *
   * ρ(signal, G) = (resonance, relevance, scope, urgency)
   *
   * Uses keyword matching for structural resonance. For full semantic
   * similarity, integrate with the vector store / embedding layer.
   */
  resonate(signalText: string): ResonanceResult {
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
    const stakeholderLayers: NarrativeType[] = ['positioning', 'communication', 'product_narrative'];
    const stakeholderMatches = matchedUnits.filter(
      m => stakeholderLayers.includes(m.unit.type)
    );
    const relevance = matchedUnits.length > 0
      ? stakeholderMatches.length / matchedUnits.length
      : 0;

    // Scope: what % of graph would be affected
    let affectedIds = new Set<string>();
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
    let urgency: ResonanceResult['urgency'];
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
   *
   * Without a domain parameter, computes overall coverage across all layers.
   */
  cover(options?: {
    /** Only compute coverage for these layers */
    layers?: NarrativeType[];
    /** What counts as "covered" (default: ALIGNED only) */
    coveredStates?: ValidationState[];
  }): CoverageResult {
    const allUnits = this.graph.getAllUnits();
    const layers = options?.layers ?? ALL_LAYERS;
    const coveredStates = new Set(options?.coveredStates ?? ['ALIGNED']);

    const inScope = allUnits.filter(u => layers.includes(u.type));
    const aligned = inScope.filter(u => coveredStates.has(u.validationState));

    // By layer
    const byLayer: CoverageResult['byLayer'] = {} as any;
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
    const evidenceUnitIds = new Set(
      allUnits.filter(u => u.type === 'evidence').map(u => u.id)
    );
    const gaps = inScope.filter(u => {
      if (u.type === 'evidence') return false;
      // Check if any unit of type 'evidence' depends on this unit
      const dependents = this.graph.getDependents(u.id);
      return !dependents.some(d => d.type === 'evidence');
    });

    // Orphans: units with no dependencies and no dependents
    const orphans = inScope.filter(u => {
      if (u.type === 'core_story') return false; // root nodes are expected to have no deps
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

  /**
   * Cover applied to a subgraph (closure property).
   */
  coverSubgraph(subgraph: NarrativeSubgraph): CoverageResult {
    const units = subgraph.units;
    const aligned = units.filter(u => u.validationState === 'ALIGNED');

    const byLayer: CoverageResult['byLayer'] = {} as any;
    for (const layer of ALL_LAYERS) {
      const layerUnits = units.filter(u => u.type === layer);
      const layerAligned = layerUnits.filter(u => u.validationState === 'ALIGNED');
      byLayer[layer] = {
        total: layerUnits.length,
        aligned: layerAligned.length,
        coverage: layerUnits.length > 0 ? layerAligned.length / layerUnits.length : 0,
      };
    }

    // Gaps within subgraph
    const subgraphIds = new Set(units.map(u => u.id));
    const evidenceIds = new Set(units.filter(u => u.type === 'evidence').map(u => u.id));
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
   *
   * Since validation state history is not yet tracked in the DB,
   * this computes current drift (snapshot) by comparing actual states.
   * For temporal drift, pipe in historical snapshots.
   */
  drift(options?: {
    /** Only measure drift in these layers */
    layers?: NarrativeType[];
  }): DriftResult {
    const allUnits = this.graph.getAllUnits();
    const layers = options?.layers ?? ALL_LAYERS;
    const inScope = allUnits.filter(u => layers.includes(u.type));

    const driftedUnits = inScope.filter(
      u => u.validationState === 'DRIFTED' || u.validationState === 'BROKEN'
    );

    const byLayer: DriftResult['byLayer'] = {} as any;
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
  computeMetrics(): NarrativeMetrics {
    const allUnits = this.graph.getAllUnits();
    const totalUnits = allUnits.length;

    const aligned = allUnits.filter(u => u.validationState === 'ALIGNED');

    // Layer health
    const layerHealth: NarrativeMetrics['layerHealth'] = {} as any;
    for (const layer of ALL_LAYERS) {
      const layerUnits = allUnits.filter(u => u.type === layer);
      const layerAligned = layerUnits.filter(u => u.validationState === 'ALIGNED');
      const layerDrifted = layerUnits.filter(u => u.validationState === 'DRIFTED');
      const layerBroken = layerUnits.filter(u => u.validationState === 'BROKEN');
      layerHealth[layer] = {
        nci: layerUnits.length > 0 ? layerAligned.length / layerUnits.length : 1.0,
        unitCount: layerUnits.length,
        alignedCount: layerAligned.length,
        driftedCount: layerDrifted.length,
        brokenCount: layerBroken.length,
      };
    }

    // Coverage
    const coverResult = this.cover();

    // Total edges
    let totalEdges = 0;
    for (const unit of allUnits) {
      totalEdges += unit.dependencies.length;
    }

    return {
      narrativeCoherenceIndex: totalUnits > 0 ? aligned.length / totalUnits : 1.0,
      coverageRatio: coverResult.coverage,
      layerHealth,
      totalUnits,
      totalEdges,
    };
  }

  // ==========================================================================
  // COMPOSED QUERIES — Demonstrating algebraic expressiveness
  // ==========================================================================

  /**
   * Strategic alignment query:
   * Validate units in engineering subgraph against board subgraph dependencies.
   */
  queryStrategicAlignment(): {
    engineeringView: NarrativeSubgraph;
    boardView: NarrativeSubgraph;
    misaligned: NarrativeUnit[];
  } {
    const engineeringView = this.composeForStakeholder('engineering');
    const boardView = this.composeForStakeholder('board');

    const boardIds = new Set(boardView.units.map(u => u.id));

    // Find engineering units whose dependencies include board units
    // that are not ALIGNED
    const misaligned = engineeringView.units.filter(unit => {
      return unit.dependencies.some(depId => {
        if (!boardIds.has(depId)) return false;
        const boardUnit = boardView.units.find(u => u.id === depId);
        return boardUnit && boardUnit.validationState !== 'ALIGNED';
      });
    });

    return { engineeringView, boardView, misaligned };
  }

  /**
   * Competitive response query:
   * Resonate a signal, then Propagate to compute full organizational impact.
   */
  queryCompetitiveResponse(competitorSignal: string): {
    resonance: ResonanceResult;
    totalImpact: PropagationResult[];
    affectedStakeholders: StakeholderPreset[];
  } {
    const resonance = this.resonate(competitorSignal);

    const totalImpact = resonance.matchedUnits.map(m =>
      this.propagate(m.unit.id)
    );

    // Which stakeholder views are affected?
    const allAffectedTypes = new Set<NarrativeType>();
    for (const impact of totalImpact) {
      for (const unit of impact.affectedUnits) {
        allAffectedTypes.add(unit.type);
      }
    }

    const affectedStakeholders: StakeholderPreset[] = [];
    for (const [preset, config] of Object.entries(STAKEHOLDER_PRESETS)) {
      if (config.typeFilter.some(t => allAffectedTypes.has(t))) {
        affectedStakeholders.push(preset as StakeholderPreset);
      }
    }

    return { resonance, totalImpact, affectedStakeholders };
  }

  /**
   * Regulatory exposure query:
   * Cover compliance domain → Propagate to find exposed communications.
   */
  queryRegulatoryExposure(): {
    complianceCoverage: CoverageResult;
    exposedCommunications: NarrativeUnit[];
  } {
    const complianceView = this.composeForStakeholder('compliance');
    const complianceCoverage = this.coverSubgraph(complianceView);

    // Find communication units that depend on unvalidated compliance units
    const unvalidated = complianceView.units.filter(
      u => u.validationState !== 'ALIGNED'
    );

    const exposedCommunications: NarrativeUnit[] = [];
    for (const unit of unvalidated) {
      const impact = this.propagate(unit.id, {
        typeFilter: ['communication'],
      });
      exposedCommunications.push(...impact.affectedUnits);
    }

    // Deduplicate
    const seen = new Set<string>();
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
