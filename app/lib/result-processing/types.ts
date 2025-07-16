/**
 * Types for the result processing pipeline
 */

import { UnifiedCreatorData, ValidationResult } from '@/lib/apify/schemas';

/**
 * Processing options configuration
 */
export interface ProcessingOptions {
  batchSize?: number;
  maxRetries?: number;
  retryDelay?: number;
  validateInput?: boolean;
  validateOutput?: boolean;
  normalizeData?: boolean;
  detectDuplicates?: boolean;
  mergeDuplicates?: boolean;
  collectMetrics?: boolean;
  errorHandlingStrategy?: 'fail-fast' | 'continue' | 'dead-letter';
  processingMode?: 'sequential' | 'parallel' | 'batch';
  timeout?: number;
  maxConcurrency?: number;
  adaptiveBatching?: boolean;
  memoryOptimization?: boolean;
}

/**
 * Default processing options
 */
export const DEFAULT_PROCESSING_OPTIONS: ProcessingOptions = {
  batchSize: 100,
  maxRetries: 3,
  retryDelay: 1000,
  validateInput: true,
  validateOutput: true,
  normalizeData: true,
  detectDuplicates: true,
  mergeDuplicates: true,
  collectMetrics: true,
  errorHandlingStrategy: 'continue',
  processingMode: 'batch',
  timeout: 300000, // 5 minutes
  maxConcurrency: 25,
  adaptiveBatching: true,
  memoryOptimization: true,
};

/**
 * Processing result status
 */
export enum ProcessingStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  PARTIAL = 'partial',
  SKIPPED = 'skipped',
}

/**
 * Processing stage enum
 */
export enum ProcessingStage {
  INPUT_VALIDATION = 'input_validation',
  NORMALIZATION = 'normalization',
  DUPLICATE_DETECTION = 'duplicate_detection',
  MERGING = 'merging',
  OUTPUT_VALIDATION = 'output_validation',
  STORAGE = 'storage',
}

/**
 * Processing error
 */
export interface ProcessingError {
  stage: ProcessingStage;
  message: string;
  error?: any;
  data?: any;
  timestamp: Date;
  retryable: boolean;
}

/**
 * Processing metrics
 */
export interface ProcessingMetrics {
  totalItems: number;
  processedItems: number;
  successfulItems: number;
  failedItems: number;
  skippedItems: number;
  duplicatesFound: number;
  duplicatesMerged: number;
  validationErrors: number;
  processingTime: number;
  averageItemTime: number;
  stages: Record<ProcessingStage, StageMetrics>;
}

/**
 * Stage-specific metrics
 */
export interface StageMetrics {
  itemsProcessed: number;
  errors: number;
  duration: number;
  averageDuration: number;
}

/**
 * Processing result for a single item
 */
export interface ItemResult<T = UnifiedCreatorData> {
  id: string;
  status: ProcessingStatus;
  data?: T;
  errors: ProcessingError[];
  warnings: string[];
  metrics?: {
    processingTime: number;
    stages: Record<ProcessingStage, number>;
  };
  duplicateOf?: string;
}

/**
 * Batch processing result
 */
export interface BatchResult<T = UnifiedCreatorData> {
  batchId: string;
  status: ProcessingStatus;
  items: ItemResult<T>[];
  metrics: ProcessingMetrics;
  errors: ProcessingError[];
  warnings: string[];
  startedAt: Date;
  completedAt?: Date;
}

/**
 * Duplicate detection result
 */
export interface DuplicateResult {
  isDuplicate: boolean;
  matchingId?: string;
  confidence: number;
  matchedFields: string[];
  strategy: 'exact' | 'fuzzy' | 'probabilistic';
}

/**
 * Merge strategy options
 */
export interface MergeOptions {
  strategy: 'newest' | 'oldest' | 'most-complete' | 'custom';
  preserveFields?: string[];
  conflictResolution?: 'source' | 'target' | 'manual';
  auditTrail?: boolean;
}

/**
 * Normalized data result
 */
export interface NormalizedData<T = UnifiedCreatorData> {
  data: T;
  changes: Array<{
    field: string;
    oldValue: any;
    newValue: any;
    reason: string;
  }>;
  warnings: string[];
}

/**
 * Platform-specific configuration
 */
export interface PlatformConfig {
  platform: string;
  requiredFields: string[];
  optionalFields: string[];
  validationRules: Record<string, any>;
  normalizationRules: Record<string, any>;
  duplicateMatchFields: string[];
  mergeStrategy: MergeOptions;
}

/**
 * Processing context for passing state between stages
 */
export interface ProcessingContext {
  batchId: string;
  platform: string;
  config: PlatformConfig;
  options: ProcessingOptions;
  metadata: Record<string, any>;
  startTime: number;
}

/**
 * Result processor interface
 */
export interface IResultProcessor<T = UnifiedCreatorData> {
  process(data: any[], context: ProcessingContext): Promise<BatchResult<T>>;
  processItem(data: any, context: ProcessingContext): Promise<ItemResult<T>>;
  validate(data: any, context: ProcessingContext): Promise<ValidationResult>;
  normalize(data: T, context: ProcessingContext): Promise<NormalizedData<T>>;
  detectDuplicate(data: T, context: ProcessingContext): Promise<DuplicateResult>;
  merge(source: T, target: T, options: MergeOptions): Promise<T>;
}

/**
 * Stage processor interface
 */
export interface IStageProcessor<TInput = any, TOutput = any> {
  stage: ProcessingStage;
  process(input: TInput, context: ProcessingContext): Promise<TOutput>;
  canProcess(input: TInput, context: ProcessingContext): boolean;
}

/**
 * Platform validator interface
 */
export interface IPlatformValidator {
  platform: string;
  validate(data: any): ValidationResult;
  getRequiredFields(): string[];
  getValidationSchema(): any;
}

/**
 * Data normalizer interface
 */
export interface IDataNormalizer<T = UnifiedCreatorData> {
  normalize(data: T, rules?: Record<string, any>): NormalizedData<T>;
  registerRule(field: string, rule: NormalizationRule): void;
  removeRule(field: string): void;
}

/**
 * Normalization rule
 */
export interface NormalizationRule {
  field: string;
  type: 'transform' | 'format' | 'clean' | 'validate';
  handler: (value: any) => any;
  options?: Record<string, any>;
}

/**
 * Duplicate detector interface
 */
export interface IDuplicateDetector<T = UnifiedCreatorData> {
  detect(data: T, existingData: T[]): Promise<DuplicateResult>;
  calculateSimilarity(source: T, target: T): number;
  setMatchingFields(fields: string[]): void;
  setThreshold(threshold: number): void;
}

/**
 * Metrics collector interface
 */
export interface IMetricsCollector {
  startBatch(batchId: string): void;
  endBatch(batchId: string): ProcessingMetrics;
  recordStageStart(batchId: string, stage: ProcessingStage, itemId?: string): void;
  recordStageEnd(batchId: string, stage: ProcessingStage, itemId?: string, error?: any): void;
  recordItem(batchId: string, itemId: string, status: ProcessingStatus): void;
  recordDuplicate(batchId: string, itemId: string, duplicateOf: string): void;
  recordError(batchId: string, error: ProcessingError): void;
  getMetrics(batchId: string): ProcessingMetrics;
}