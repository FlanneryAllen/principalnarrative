/**
 * @narrative/core
 *
 * Core narrative graph storage and dependency engine
 * with formal algebraic operations on narrative graphs.
 */

export { NarrativeGraph } from './narrative-graph';
export type { QueryFilters } from './narrative-graph';

export { NarrativeAlgebra } from './narrative-algebra';
export type {
  NarrativeSubgraph,
  ComposeParams,
  StakeholderPreset,
  PropagationResult,
  ValidationResult,
  ResonanceResult,
  CoverageResult,
  DriftResult,
  NarrativeMetrics,
} from './narrative-algebra';

export type * from './types';
