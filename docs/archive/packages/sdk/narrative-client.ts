/**
 * Narrative Client SDK
 *
 * Provides agent-friendly interface for querying organizational narrative.
 * This is what autonomous agents use to ask "what does the org want?"
 */

import {
  NarrativeGraph,
  NarrativeAlgebra,
  QueryFilters,
  NarrativeUnit,
  NarrativeType,
  NarrativeResponse,
  NarrativeConstraints,
  ValidationRule,
  CodeConstraints,
  ContentConstraints,
  NarrativeSubgraph,
  ComposeParams,
  StakeholderPreset,
  PropagationResult,
  ValidationResult,
  ResonanceResult,
  CoverageResult,
  DriftResult,
  NarrativeMetrics,
} from '@narrative/core';

export interface QueryNarrativeParams {
  /**
   * What operation is the agent trying to perform?
   * e.g., "writing auth code", "drafting blog post", "configuring API"
   */
  operation: string;

  /**
   * Additional context about the operation
   */
  context?: {
    file_path?: string;
    narrative_type?: NarrativeType;
    tags?: string[];
    [key: string]: any;
  };
}

export class NarrativeClient {
  private graph: NarrativeGraph;
  private algebra: NarrativeAlgebra;

  constructor(dbPath?: string) {
    this.graph = new NarrativeGraph(dbPath);
    this.algebra = new NarrativeAlgebra(this.graph);
  }

  /**
   * Query organizational narrative for a given operation
   *
   * This is the main method agents call before acting.
   * Returns the full intent chain with merged constraints.
   *
   * Example:
   * ```ts
   * const intent = await client.queryNarrative({
   *   operation: "writing authentication code",
   *   context: { file_path: "src/auth/login.ts" }
   * });
   *
   * // Check constraints
   * if (intent.constraints.code?.required_patterns?.includes("audit_logging")) {
   *   // Must include audit logging
   * }
   * ```
   */
  async queryNarrative(params: QueryNarrativeParams): Promise<NarrativeResponse> {
    // 1. Find relevant intent units
    const relevantUnits = this.matchNarrative(params);

    if (relevantUnits.length === 0) {
      // No matching intent - return empty response
      return {
        narrativeChain: [],
        constraints: {},
        validationRules: [],
      };
    }

    // 2. Build complete dependency chains for all matches
    const allChains = relevantUnits.map(unit =>
      this.graph.getDependencyChain(unit.id)
    );

    // 3. Merge all chains (deduplicate by ID)
    const chainMap = new Map<string, NarrativeUnit>();
    for (const chain of allChains) {
      for (const unit of chain) {
        chainMap.set(unit.id, unit);
      }
    }

    const fullChain = Array.from(chainMap.values());

    // 4. Build intent chain summary (for agent context)
    const narrativeChain = fullChain.map(unit => ({
      type: unit.type,
      assertion: unit.assertion,
      source: unit.id,
    }));

    // 5. Extract and merge constraints
    const constraints = this.extractConstraints(fullChain);

    // 6. Collect validation rules
    const validationRules = this.extractValidationRules(fullChain);

    // 7. Collect evidence requirements
    const evidenceRequired = this.extractEvidenceRequirements(fullChain);

    return {
      narrativeChain,
      constraints,
      validationRules,
      evidenceRequired,
    };
  }

  /**
   * Find intent units relevant to the operation
   *
   * For MVP: simple keyword matching
   * Future: semantic search with embeddings
   */
  private matchNarrative(params: QueryNarrativeParams): NarrativeUnit[] {
    const filters: QueryFilters = {};

    // Filter by type if provided
    if (params.context?.narrative_type) {
      filters.type = params.context.narrative_type;
    }

    // Get all units matching filters
    let units = this.graph.query(filters);

    // Filter by keyword matching in operation
    const keywords = this.extractKeywords(params.operation);

    units = units.filter(unit => {
      // Match against assertion
      const assertionMatch = keywords.some(keyword =>
        unit.assertion.toLowerCase().includes(keyword)
      );

      // Match against intent objective
      const objectiveMatch = keywords.some(keyword =>
        unit.intent.objective.toLowerCase().includes(keyword)
      );

      // Match against metadata tags
      const tagMatch = unit.metadata?.tags?.some(tag =>
        keywords.includes(tag.toLowerCase())
      ) ?? false;

      return assertionMatch || objectiveMatch || tagMatch;
    });

    // If we have context tags, prioritize units with matching tags
    if (params.context?.tags && params.context.tags.length > 0) {
      units.sort((a, b) => {
        const aTagMatches = a.metadata?.tags?.filter(tag =>
          params.context!.tags!.includes(tag)
        ).length ?? 0;

        const bTagMatches = b.metadata?.tags?.filter(tag =>
          params.context!.tags!.includes(tag)
        ).length ?? 0;

        return bTagMatches - aTagMatches;
      });
    }

    return units;
  }

  /**
   * Extract keywords from operation string
   */
  private extractKeywords(operation: string): string[] {
    // Simple tokenization and stopword removal
    const stopwords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for']);

    return operation
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopwords.has(word));
  }

  /**
   * Extract and merge constraints from intent chain
   *
   * Constraints are cumulative - more specific units inherit constraints
   * from their dependencies and can add more.
   */
  private extractConstraints(chain: NarrativeUnit[]): NarrativeConstraints {
    const merged: NarrativeConstraints = {
      code: {
        required_patterns: [],
        forbidden_patterns: [],
        required_libraries: [],
      },
      content: {
        required_themes: [],
        forbidden_themes: [],
      },
    };

    for (const unit of chain) {
      const constraints = unit.intent.constraints;
      if (!constraints) continue;

      // Merge code constraints
      if (constraints.code) {
        if (constraints.code.required_patterns) {
          merged.code!.required_patterns!.push(...constraints.code.required_patterns);
        }
        if (constraints.code.forbidden_patterns) {
          merged.code!.forbidden_patterns!.push(...constraints.code.forbidden_patterns);
        }
        if (constraints.code.required_libraries) {
          merged.code!.required_libraries!.push(...constraints.code.required_libraries);
        }
      }

      // Merge content constraints
      if (constraints.content) {
        if (constraints.content.required_themes) {
          merged.content!.required_themes!.push(...constraints.content.required_themes);
        }
        if (constraints.content.forbidden_themes) {
          merged.content!.forbidden_themes!.push(...constraints.content.forbidden_themes);
        }

        // Last specified tone wins
        if (constraints.content.tone) {
          merged.content!.tone = constraints.content.tone;
        }

        // Last specified audience wins
        if (constraints.content.target_audience) {
          merged.content!.target_audience = constraints.content.target_audience;
        }
      }

      // Merge validation rules
      if (constraints.validation_rules) {
        if (!merged.validation_rules) {
          merged.validation_rules = [];
        }
        merged.validation_rules.push(...constraints.validation_rules);
      }
    }

    // Deduplicate arrays
    if (merged.code?.required_patterns) {
      merged.code.required_patterns = Array.from(new Set(merged.code.required_patterns));
    }
    if (merged.code?.forbidden_patterns) {
      merged.code.forbidden_patterns = Array.from(new Set(merged.code.forbidden_patterns));
    }
    if (merged.code?.required_libraries) {
      merged.code.required_libraries = Array.from(new Set(merged.code.required_libraries));
    }
    if (merged.content?.required_themes) {
      merged.content.required_themes = Array.from(new Set(merged.content.required_themes));
    }
    if (merged.content?.forbidden_themes) {
      merged.content.forbidden_themes = Array.from(new Set(merged.content.forbidden_themes));
    }

    return merged;
  }

  /**
   * Extract validation rules from intent chain
   */
  private extractValidationRules(chain: NarrativeUnit[]): ValidationRule[] {
    const rules: ValidationRule[] = [];

    for (const unit of chain) {
      const constraints = unit.intent.constraints;
      if (constraints?.validation_rules) {
        rules.push(...constraints.validation_rules);
      }
    }

    return rules;
  }

  /**
   * Extract evidence requirements from intent chain
   */
  private extractEvidenceRequirements(chain: NarrativeUnit[]): string[] {
    const requirements = new Set<string>();

    for (const unit of chain) {
      if (unit.intent.evidence_required) {
        unit.intent.evidence_required.forEach(req => requirements.add(req));
      }
    }

    return Array.from(requirements);
  }

  /**
   * Get propagation impact for a unit change
   *
   * Useful for "what if" analysis before making changes
   */
  async getPropagationImpact(unitId: string): Promise<NarrativeUnit[]> {
    return this.graph.getPropagationImpact(unitId);
  }

  /**
   * Get the complete dependency chain for a unit
   *
   * Useful for debugging or visualizing intent lineage
   */
  async getDependencyChain(unitId: string): Promise<NarrativeUnit[]> {
    return this.graph.getDependencyChain(unitId);
  }

  /**
   * Create a new intent unit
   *
   * Wrapper around graph.createUnit() for convenience
   */
  async createUnit(unit: NarrativeUnit): Promise<NarrativeUnit> {
    return this.graph.createUnit(unit);
  }

  /**
   * Get graph statistics
   */
  async getStats() {
    return this.graph.getStats();
  }

  // ===========================================================================
  // Algebra Operations — Σ, Δ, Ω, ρ, κ, δ
  // ===========================================================================

  /**
   * Σ  Compose a stakeholder-specific subgraph.
   *
   * Returns a filtered view of the narrative graph tailored to a specific
   * audience. The result is itself a valid narrative graph (closure property).
   *
   * ```ts
   * const boardView = client.compose({ typeFilter: ['core_story', 'evidence'], depth: 2, stakeholder: 'board' });
   * ```
   */
  compose(params: ComposeParams): NarrativeSubgraph {
    return this.algebra.compose(params);
  }

  /**
   * Σ  Compose from a predefined stakeholder preset.
   *
   * Available presets: board, engineering, compliance, customer, investor, marketing
   *
   * ```ts
   * const investorView = client.composeForStakeholder('investor');
   * ```
   */
  composeForStakeholder(preset: StakeholderPreset): NarrativeSubgraph {
    return this.algebra.composeForStakeholder(preset);
  }

  /**
   * Σ∘Σ  Compose on an existing subgraph (composition of compositions).
   *
   * Demonstrates the closure property — you can compose on composed views.
   */
  composeOnSubgraph(subgraph: NarrativeSubgraph, params: Partial<ComposeParams>): NarrativeSubgraph {
    return this.algebra.composeOnSubgraph(subgraph, params);
  }

  /**
   * Δ  Compute the propagation impact of changing a unit.
   *
   * Returns all units whose transitive dependency chain includes the changed unit.
   * Useful for "what if" analysis before making changes to narrative.
   *
   * ```ts
   * const impact = client.propagate('core_mission');
   * console.log(`${impact.affectedUnits.length} units would be affected`);
   * ```
   */
  propagate(
    unitId: string,
    options?: { maxDepth?: number; typeFilter?: NarrativeType[] }
  ): PropagationResult {
    return this.algebra.propagate(unitId, options);
  }

  /**
   * Ω  Validate a unit against its dependencies.
   *
   * Evaluates structural alignment: checks dependency validation states
   * and propagation consistency. Updates the unit's state in the graph.
   *
   * ```ts
   * const result = client.validate('product_positioning');
   * if (result.newState === 'DRIFTED') { /* remediate */ }
   * ```
   */
  validate(unitId: string): ValidationResult {
    return this.algebra.validate(unitId);
  }

  /**
   * Ω  Validate all units in dependency order (roots first).
   *
   * Full graph validation — propagates state from core_story outward.
   */
  validateAll(): ValidationResult[] {
    return this.algebra.validateAll();
  }

  /**
   * ρ  Score an external signal against the narrative graph.
   *
   * Evaluates how strongly a piece of market intelligence, competitor move,
   * or news article resonates with the existing narrative structure.
   *
   * ```ts
   * const result = client.resonate('Competitor launched AI-powered analytics');
   * if (result.urgency === 'critical') { /* act fast */ }
   * ```
   */
  resonate(signalText: string): ResonanceResult {
    return this.algebra.resonate(signalText);
  }

  /**
   * κ  Measure narrative coverage across the graph or specific layers.
   *
   * Returns overall coverage ratio, per-layer breakdown, gaps (units with
   * no evidence), and orphans (disconnected units).
   *
   * ```ts
   * const coverage = client.cover();
   * console.log(`NCI coverage: ${(coverage.coverage * 100).toFixed(1)}%`);
   * ```
   */
  cover(options?: {
    layers?: NarrativeType[];
    coveredStates?: import('@narrative/core').ValidationState[];
  }): CoverageResult {
    return this.algebra.cover(options);
  }

  /**
   * κ  Coverage applied to a subgraph (closure property).
   */
  coverSubgraph(subgraph: NarrativeSubgraph): CoverageResult {
    return this.algebra.coverSubgraph(subgraph);
  }

  /**
   * δ  Measure narrative coherence decay (drift).
   *
   * Returns the drift rate, list of drifted units, and per-layer breakdown.
   *
   * ```ts
   * const drift = client.drift();
   * if (drift.driftRate > 0.2) { /* narrative is fragmenting */ }
   * ```
   */
  drift(options?: { layers?: NarrativeType[] }): DriftResult {
    return this.algebra.drift(options);
  }

  /**
   * Compute the Narrative Coherence Index and related metrics.
   *
   * NCI(G) = |{n ∈ G | V(n) = ALIGNED}| / |G|
   *
   * Returns NCI, coverage ratio, per-layer health, and edge counts.
   *
   * ```ts
   * const metrics = client.computeMetrics();
   * console.log(`NCI: ${metrics.narrativeCoherenceIndex}`);
   * ```
   */
  computeMetrics(): NarrativeMetrics {
    return this.algebra.computeMetrics();
  }

  // ===========================================================================
  // Composed Queries — Multi-operation algebraic chains
  // ===========================================================================

  /**
   * Strategic alignment: validate engineering subgraph against board dependencies.
   *
   * Composes two stakeholder views and finds engineering units whose board-level
   * dependencies are misaligned.
   */
  queryStrategicAlignment() {
    return this.algebra.queryStrategicAlignment();
  }

  /**
   * Competitive response: resonate a signal then propagate to compute impact.
   *
   * Returns the resonance score, all propagation chains, and which
   * stakeholder views are affected.
   */
  queryCompetitiveResponse(competitorSignal: string) {
    return this.algebra.queryCompetitiveResponse(competitorSignal);
  }

  /**
   * Regulatory exposure: cover compliance domain, find exposed communications.
   *
   * Returns compliance coverage and communication units that depend on
   * unvalidated compliance units.
   */
  queryRegulatoryExposure() {
    return this.algebra.queryRegulatoryExposure();
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.graph.close();
  }
}
