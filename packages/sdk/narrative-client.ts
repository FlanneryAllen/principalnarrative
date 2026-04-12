/**
 * Narrative Client SDK
 *
 * Provides agent-friendly interface for querying organizational narrative.
 * This is what autonomous agents use to ask "what does the org want?"
 */

import {
  NarrativeGraph,
  QueryFilters,
  NarrativeUnit,
  NarrativeType,
  NarrativeResponse,
  NarrativeConstraints,
  ValidationRule,
  CodeConstraints,
  ContentConstraints,
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

  constructor(dbPath?: string) {
    this.graph = new NarrativeGraph(dbPath);
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

  /**
   * Close the database connection
   */
  close(): void {
    this.graph.close();
  }
}
