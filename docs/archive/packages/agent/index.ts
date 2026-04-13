/**
 * Narrative Agent
 *
 * Continuous coherence monitoring for organizational narrative.
 * Watches the .narrative/ directory for changes and runs clarion calls
 * to detect drift, terminology violations, and tone misalignment.
 */

export { CanonParser } from './canon-parser';
export type { ParsedCanon, CanonFile, CanonUnit, SkillSet, ToneRule, TerminologyEntry } from './canon-parser';

export { ClarionCallEngine } from './clarion-call';
export type { ClarionCallResult, DriftAlert, TerminologyViolation, ToneViolation } from './clarion-call';

export { NarrativeWatcher } from './watcher';
export type { AlertHandler } from './watcher';
