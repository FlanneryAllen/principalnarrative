/**
 * Narrative Intelligence Core Types
 *
 * Machine-readable organizational narrative primitives
 */

export type NarrativeType =
  | 'core_story'          // Strategic narrative (CEO-level decisions)
  | 'positioning'         // Market-facing claims
  | 'product_narrative'   // Product capabilities and features
  | 'operational'         // How we execute
  | 'evidence'           // Validation data (KPIs, metrics)
  | 'communication';     // External messaging

export type ValidationState =
  | 'ALIGNED'   // Consistent with dependencies and evidence
  | 'DRIFTED'   // May be inconsistent, needs review
  | 'BROKEN'    // Demonstrably inconsistent
  | 'UNKNOWN';  // Not yet validated

export interface CodeConstraints {
  required_patterns?: string[];   // e.g., ["audit_logging", "encryption_at_rest"]
  forbidden_patterns?: string[];  // e.g., ["localStorage", "eval"]
  required_libraries?: string[];  // e.g., ["@aws-sdk/client-kms"]
}

export interface ContentConstraints {
  required_themes?: string[];    // e.g., ["compliance", "security"]
  forbidden_themes?: string[];   // e.g., ["price_competition"]
  tone?: 'professional' | 'casual' | 'technical' | 'empathetic' | 'urgent';
  target_audience?: string;      // e.g., "healthcare_decision_makers"
}

export interface ValidationRule {
  type: 'regex' | 'ast_pattern' | 'semantic' | 'kpi_threshold';
  check: string;              // The actual validation logic
  error_message?: string;     // What to show when it fails
  suggestion?: string;        // What to do instead
}

export interface NarrativeConstraints {
  code?: CodeConstraints;
  content?: ContentConstraints;
  validation_rules?: ValidationRule[];
}

export interface Narrative {
  objective: string;                    // What the org wants
  constraints?: NarrativeConstraints;      // How agents implement it
  evidence_required?: string[];         // What proves this is working
}

export interface StorySignal {
  score: number;        // 0-100 (sum of 5 dimensions)
  source: string;       // e.g., "slack://leadership"
  timestamp: string;    // ISO 8601
  dimensions?: {
    resonance: number;    // 0-20
    relevance: number;    // 0-20
    rarity: number;       // 0-20
    relatability: number; // 0-20
    riskReward: number;   // 0-20
  };
}

export interface PropagationRules {
  scope?: 'all_dependents' | 'direct_only' | 'filtered';
  urgency?: 'immediate' | 'batched' | 'manual';
  mode?: 'auto_update' | 'notification' | 'silent';
}

export interface NarrativeMetadata {
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  tags?: string[];
}

/**
 * Core Narrative Unit
 *
 * The fundamental primitive for organizational narrative intelligence.
 * Analogous to a database row in relational databases.
 */
export interface NarrativeUnit {
  // Core fields (from patent: N = (id, τ, α, D, V, c, P))
  id: string;                           // Unique identifier
  type: NarrativeType;                     // τ (tau) - layer taxonomy
  assertion: string;                    // α (alpha) - the claim
  dependencies: string[];               // D - IDs of units this depends on
  validationState: ValidationState;     // V - alignment status
  confidence: number;                   // c - 0.0 to 1.0

  // Intent-specific fields (NEW - for agent coordination)
  intent: Narrative;                       // Machine-actionable constraints

  // Story Signal metadata
  signal?: StorySignal;                 // Where this came from

  // Propagation rules
  propagation?: PropagationRules;       // P - how changes cascade

  // Metadata
  metadata?: NarrativeMetadata;
}

/**
 * Narrative Query Response
 *
 * What agents get back when they query "what does the org want?"
 */
export interface NarrativeResponse {
  // The chain of narrative from core_story → operational
  narrativeChain: Array<{
    type: NarrativeType;
    assertion: string;
    source: string;  // narrative unit ID
  }>;

  // Merged constraints from entire chain
  constraints: NarrativeConstraints;

  // Validation rules that apply
  validationRules: ValidationRule[];

  // Evidence requirements
  evidenceRequired?: string[];
}

/**
 * Narrative Violation
 *
 * When agent output doesn't align with organizational narrative
 */
export interface NarrativeViolation {
  file?: string;
  line?: number;
  pattern: string;        // What pattern was detected
  message: string;        // Human-readable error
  narrative: string;      // Which narrative was violated
  suggestion?: string;    // How to fix it
  severity: 'error' | 'warning' | 'info';
}
