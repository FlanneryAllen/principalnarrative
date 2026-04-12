/**
 * @narrative/signal
 *
 * Story Signal - AI-powered story mining and intent conversion
 */

export { StorySignalMiner } from './story-signal';
export type {
  StoryDimensions,
  StoryCapture,
  ConversionConfig,
} from './story-signal';

// Re-export core types for convenience
export type * from '@narrative/core';
