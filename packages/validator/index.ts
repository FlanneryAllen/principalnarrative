/**
 * @narrative/validator
 *
 * Pre-commit validator for narrative compliance
 */

export { NarrativeValidator } from './narrative-validator';
export type {
  ValidationOptions,
  ValidationResult,
} from './narrative-validator';

// Re-export core types
export type * from '@narrative/sdk';
