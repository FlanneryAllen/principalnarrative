/**
 * Story Signal
 *
 * Captures and scores organizational stories using the 5 R's framework.
 * High-scoring signals can be converted into intent units.
 */

import { NarrativeGraph, NarrativeUnit, NarrativeType, StorySignal } from '@narrative/core';

/**
 * The 5 R's dimensions for story scoring
 */
export interface StoryDimensions {
  resonance: number;     // 0-20: How much does this resonate emotionally?
  relevance: number;     // 0-20: How relevant is this to our strategy?
  rarity: number;        // 0-20: How unique/novel is this signal?
  relatability: number;  // 0-20: Can stakeholders relate to this?
  riskReward: number;    // 0-20: What's the potential impact?
}

/**
 * A captured story signal before conversion to intent unit
 */
export interface StoryCapture {
  story: string;           // The raw story/signal text
  source: string;          // Where it came from (e.g., "slack://leadership")
  dimensions: StoryDimensions;
  tags?: string[];         // Optional categorization tags
  context?: {
    speaker?: string;
    channel?: string;
    timestamp?: string;
    [key: string]: any;
  };
}

/**
 * Configuration for auto-conversion thresholds
 */
export interface ConversionConfig {
  autoConvertThreshold: number;  // Auto-convert signals scoring above this (e.g., 85)
  defaultNarrativeType: NarrativeType;  // What type to create by default
  requireReview: boolean;         // Whether to require manual review before conversion
}

export class StorySignalMiner {
  private graph: NarrativeGraph;
  private config: ConversionConfig;

  constructor(
    dbPath?: string,
    config: Partial<ConversionConfig> = {}
  ) {
    this.graph = new NarrativeGraph(dbPath);
    this.config = {
      autoConvertThreshold: config.autoConvertThreshold ?? 85,
      defaultNarrativeType: config.defaultNarrativeType ?? 'core_story',
      requireReview: config.requireReview ?? true,
    };
  }

  /**
   * Calculate total score from dimensions (sum of 5 R's, max 100)
   */
  calculateScore(dimensions: StoryDimensions): number {
    return (
      dimensions.resonance +
      dimensions.relevance +
      dimensions.rarity +
      dimensions.relatability +
      dimensions.riskReward
    );
  }

  /**
   * Validate dimensions are within bounds
   */
  private validateDimensions(dimensions: StoryDimensions): void {
    const keys = ['resonance', 'relevance', 'rarity', 'relatability', 'riskReward'] as const;

    for (const key of keys) {
      const value = dimensions[key];
      if (value < 0 || value > 20) {
        throw new Error(`${key} must be between 0 and 20, got ${value}`);
      }
    }
  }

  /**
   * Convert a story signal into an intent unit
   *
   * This is the core bridge between story mining and intent engineering.
   */
  async convertToNarrativeUnit(
    capture: StoryCapture,
    options: {
      id?: string;
      type?: NarrativeType;
      assertion?: string;
      objective?: string;
      dependencies?: string[];
      constraints?: any;
    } = {}
  ): Promise<NarrativeUnit> {
    // Validate dimensions
    this.validateDimensions(capture.dimensions);

    // Calculate score
    const score = this.calculateScore(capture.dimensions);

    // Build story signal metadata
    const signal: StorySignal = {
      score,
      source: capture.source,
      timestamp: capture.context?.timestamp ?? new Date().toISOString(),
      dimensions: capture.dimensions,
    };

    // Generate ID from story text if not provided
    const id = options.id ?? this.generateId(capture.story);

    // Use the story as the assertion if not provided
    const assertion = options.assertion ?? this.extractAssertion(capture.story);

    // Use the story as the objective if not provided
    const objective = options.objective ?? capture.story;

    // Build the intent unit
    const intentUnit: NarrativeUnit = {
      id,
      type: options.type ?? this.config.defaultNarrativeType,
      assertion,
      intent: {
        objective,
        constraints: options.constraints,
      },
      dependencies: options.dependencies ?? [],
      validationState: this.config.requireReview ? 'UNKNOWN' : 'ALIGNED',
      confidence: score / 100, // Normalize to 0-1
      signal,
      metadata: {
        created_at: new Date().toISOString(),
        created_by: capture.context?.speaker ?? 'story_signal',
        tags: capture.tags ?? [],
      },
    };

    // Create the unit in the graph
    return this.graph.createUnit(intentUnit);
  }

  /**
   * Process a story signal - auto-convert if score is high enough
   *
   * Returns the intent unit if converted, null otherwise
   */
  async processSignal(capture: StoryCapture): Promise<{
    score: number;
    shouldConvert: boolean;
    intentUnit?: NarrativeUnit;
  }> {
    const score = this.calculateScore(capture.dimensions);
    const shouldConvert = score >= this.config.autoConvertThreshold;

    let intentUnit: NarrativeUnit | undefined;

    if (shouldConvert && !this.config.requireReview) {
      // Auto-convert high-value signals
      intentUnit = await this.convertToNarrativeUnit(capture);
    }

    return {
      score,
      shouldConvert,
      intentUnit,
    };
  }

  /**
   * Extract assertion from story text
   *
   * For MVP: first sentence or truncated text
   * Future: Use LLM to extract the core claim
   */
  private extractAssertion(story: string): string {
    // Take first sentence or first 100 chars
    const firstSentence = story.match(/^[^.!?]+[.!?]/)?.[0];
    if (firstSentence && firstSentence.length <= 150) {
      return firstSentence.trim();
    }

    // Truncate to 100 chars
    if (story.length <= 100) {
      return story.trim();
    }

    return story.substring(0, 97).trim() + '...';
  }

  /**
   * Generate ID from story text
   */
  private generateId(story: string): string {
    // Convert to snake_case slug
    const slug = story
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50);

    // Add timestamp suffix for uniqueness
    const timestamp = Date.now().toString(36);

    return `signal_${slug}_${timestamp}`;
  }

  /**
   * Batch process multiple signals
   */
  async batchProcess(
    captures: StoryCapture[]
  ): Promise<Array<{
    capture: StoryCapture;
    score: number;
    shouldConvert: boolean;
    intentUnit?: NarrativeUnit;
  }>> {
    const results = [];

    for (const capture of captures) {
      const result = await this.processSignal(capture);
      results.push({
        capture,
        ...result,
      });
    }

    return results;
  }

  /**
   * Get all signals that have been converted to intent units
   */
  getConvertedSignals(): NarrativeUnit[] {
    const allUnits = this.graph.getAllUnits();
    return allUnits.filter(unit => unit.signal !== undefined);
  }

  /**
   * Get statistics about signal conversion
   */
  getSignalStats() {
    const converted = this.getConvertedSignals();

    const avgScore = converted.length > 0
      ? converted.reduce((sum, u) => sum + (u.signal?.score ?? 0), 0) / converted.length
      : 0;

    const scoresByType = converted.reduce((acc, unit) => {
      if (!acc[unit.type]) acc[unit.type] = [];
      acc[unit.type].push(unit.signal?.score ?? 0);
      return acc;
    }, {} as Record<NarrativeType, number[]>);

    return {
      totalConverted: converted.length,
      averageScore: avgScore,
      scoresByType,
      highestScore: Math.max(...converted.map(u => u.signal?.score ?? 0), 0),
      lowestScore: Math.min(...converted.map(u => u.signal?.score ?? 100), 100),
    };
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.graph.close();
  }
}
