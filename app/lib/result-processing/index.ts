/**
 * Result processing pipeline exports
 */

export * from './types';
export { ResultProcessor } from './result-processor';
export { WebhookResultProcessor } from './webhook-result-processor';
export { MetricsCollector } from './metrics-collector';

// Re-export commonly used types for convenience
export type {
  ProcessingOptions,
  ProcessingContext,
  ProcessingStatus,
  ProcessingStage,
  BatchResult,
  ItemResult,
  ProcessingError,
  ProcessingMetrics,
} from './types';