/**
 * Base ResultProcessor class for handling webhook data processing
 */

import { v4 as uuidv4 } from 'uuid';
import { UnifiedCreatorData, ValidationResult } from '@/lib/apify/schemas';
import {
  ProcessingOptions,
  ProcessingContext,
  ProcessingStatus,
  ProcessingStage,
  ProcessingError,
  ItemResult,
  BatchResult,
  DuplicateResult,
  NormalizedData,
  MergeOptions,
  IResultProcessor,
  DEFAULT_PROCESSING_OPTIONS,
} from './types';
import { ResultProcessingMonitor } from './monitoring/result-processing-monitor';

/**
 * Semaphore class for controlling concurrency
 */
class Semaphore {
  private permits: number;
  private waitQueue: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }

    return new Promise<void>((resolve) => {
      this.waitQueue.push(resolve);
    });
  }

  release(): void {
    this.permits++;
    if (this.waitQueue.length > 0) {
      this.permits--;
      const nextResolve = this.waitQueue.shift();
      nextResolve?.();
    }
  }
}

/**
 * Abstract base class for result processing
 */
export abstract class ResultProcessor<T = UnifiedCreatorData> implements IResultProcessor<T> {
  protected options: ProcessingOptions;
  protected monitor: ResultProcessingMonitor;

  constructor(options: Partial<ProcessingOptions> = {}) {
    this.options = { ...DEFAULT_PROCESSING_OPTIONS, ...options };
    this.monitor = new ResultProcessingMonitor({
      enableAlerts: this.options.collectMetrics,
      enableMetrics: this.options.collectMetrics,
      enableProfiling: false,
    });
  }

  /**
   * Process a batch of items with performance optimizations
   */
  async process(data: any[], context: ProcessingContext): Promise<BatchResult<T>> {
    const batchId = context.batchId || uuidv4();
    const startTime = Date.now();
    const errors: ProcessingError[] = [];
    const warnings: string[] = [];
    const results: ItemResult<T>[] = [];

    // Initialize batch metrics
    const metrics = this.initializeMetrics(data.length);

    try {
      // Process based on mode with optimizations
      if (this.options.processingMode === 'sequential') {
        results.push(...await this.processSequential(data, context, metrics));
      } else if (this.options.processingMode === 'parallel') {
        results.push(...await this.processParallel(data, context, metrics));
      } else {
        // Optimized batch processing
        results.push(...await this.processOptimizedBatch(data, context, metrics));
      }

      // Calculate final metrics
      const completedAt = new Date();
      metrics.processingTime = Date.now() - startTime;
      metrics.averageItemTime = metrics.processedItems > 0 
        ? metrics.processingTime / metrics.processedItems 
        : 0;

      // Determine batch status
      const status = this.determineBatchStatus(metrics);

      const batchResult: BatchResult<T> = {
        batchId,
        status,
        items: results,
        metrics,
        errors,
        warnings,
        startedAt: new Date(startTime),
        completedAt,
      };

      // Monitor the batch if metrics collection is enabled
      if (this.options.collectMetrics) {
        await this.monitor.monitorBatch(batchId, batchResult);
      }

      return batchResult;
    } catch (error) {
      // Handle catastrophic errors
      errors.push({
        stage: ProcessingStage.INPUT_VALIDATION,
        message: 'Batch processing failed',
        error,
        timestamp: new Date(),
        retryable: false,
      });

      const failedBatchResult: BatchResult<T> = {
        batchId,
        status: ProcessingStatus.FAILED,
        items: results,
        metrics,
        errors,
        warnings,
        startedAt: new Date(startTime),
        completedAt: new Date(),
      };

      // Monitor the failed batch if metrics collection is enabled
      if (this.options.collectMetrics) {
        await this.monitor.monitorBatch(batchId, failedBatchResult);
      }

      return failedBatchResult;
    }
  }

  /**
   * Process a single item with retry logic
   */
  protected async processItemWithRetry(
    data: any,
    context: ProcessingContext
  ): Promise<ItemResult<T>> {
    let lastError: any;
    let attempt = 0;

    while (attempt < this.options.maxRetries!) {
      try {
        return await this.processItem(data, context);
      } catch (error) {
        lastError = error;
        attempt++;
        
        if (attempt < this.options.maxRetries!) {
          await this.delay(this.options.retryDelay! * Math.pow(2, attempt - 1));
        }
      }
    }

    // Max retries exceeded
    return {
      id: this.extractId(data),
      status: ProcessingStatus.FAILED,
      errors: [{
        stage: ProcessingStage.INPUT_VALIDATION,
        message: `Failed after ${this.options.maxRetries} attempts`,
        error: lastError,
        timestamp: new Date(),
        retryable: false,
      }],
      warnings: [],
    };
  }

  /**
   * Process a single item through all stages
   */
  async processItem(data: any, context: ProcessingContext): Promise<ItemResult<T>> {
    const itemId = this.extractId(data);
    const startTime = Date.now();
    const errors: ProcessingError[] = [];
    const warnings: string[] = [];
    const stageTimings: Record<ProcessingStage, number> = {} as any;

    try {
      let processedData: T | undefined;

      // Stage 1: Input Validation
      if (this.options.validateInput) {
        const stageStart = Date.now();
        const validation = await this.validate(data, context);
        stageTimings[ProcessingStage.INPUT_VALIDATION] = Date.now() - stageStart;

        if (!validation.isValid) {
          errors.push({
            stage: ProcessingStage.INPUT_VALIDATION,
            message: 'Input validation failed',
            error: validation.errors,
            data,
            timestamp: new Date(),
            retryable: false,
          });

          if (this.options.errorHandlingStrategy === 'fail-fast') {
            throw new Error('Input validation failed');
          }
          
          // Return early if validation failed and we're continuing
          return {
            id: itemId,
            status: ProcessingStatus.FAILED,
            errors,
            warnings,
          };
        }

        warnings.push(...(validation.warnings || []));
      }

      // Transform raw data to typed format
      processedData = await this.transform(data, context);

      // Stage 2: Normalization
      if (this.options.normalizeData && processedData) {
        const stageStart = Date.now();
        const normalized = await this.normalize(processedData, context);
        stageTimings[ProcessingStage.NORMALIZATION] = Date.now() - stageStart;
        
        processedData = normalized.data;
        warnings.push(...normalized.warnings);
      }

      // Stage 3: Duplicate Detection
      let duplicateOf: string | undefined;
      if (this.options.detectDuplicates && processedData) {
        const stageStart = Date.now();
        const duplicateResult = await this.detectDuplicate(processedData, context);
        stageTimings[ProcessingStage.DUPLICATE_DETECTION] = Date.now() - stageStart;

        if (duplicateResult.isDuplicate) {
          duplicateOf = duplicateResult.matchingId;

          // Stage 4: Merging (if enabled)
          if (this.options.mergeDuplicates && duplicateResult.matchingId) {
            const mergeStart = Date.now();
            const existingData = await this.fetchExisting(duplicateResult.matchingId, context);
            
            if (existingData) {
              processedData = await this.merge(
                processedData,
                existingData,
                context.config.mergeStrategy
              );
            }
            
            stageTimings[ProcessingStage.MERGING] = Date.now() - mergeStart;
          }
        }
      }

      // Stage 5: Output Validation
      if (this.options.validateOutput && processedData) {
        const stageStart = Date.now();
        const outputValidation = await this.validateOutput(processedData, context);
        stageTimings[ProcessingStage.OUTPUT_VALIDATION] = Date.now() - stageStart;

        if (!outputValidation.isValid) {
          errors.push({
            stage: ProcessingStage.OUTPUT_VALIDATION,
            message: 'Output validation failed',
            error: outputValidation.errors,
            data: processedData,
            timestamp: new Date(),
            retryable: false,
          });

          if (this.options.errorHandlingStrategy === 'fail-fast') {
            throw new Error('Output validation failed');
          }
        }
      }

      // Calculate metrics
      const processingTime = Date.now() - startTime;

      return {
        id: itemId,
        status: errors.length === 0 ? ProcessingStatus.COMPLETED : ProcessingStatus.PARTIAL,
        data: processedData,
        errors,
        warnings,
        duplicateOf,
        metrics: {
          processingTime,
          stages: stageTimings,
        },
      };
    } catch (error) {
      errors.push({
        stage: ProcessingStage.INPUT_VALIDATION,
        message: 'Processing failed',
        error,
        data,
        timestamp: new Date(),
        retryable: true,
      });

      return {
        id: itemId,
        status: ProcessingStatus.FAILED,
        errors,
        warnings,
      };
    }
  }

  /**
   * Transform raw data to typed format
   * Must be implemented by subclasses
   */
  protected abstract transform(data: any, context: ProcessingContext): Promise<T>;

  /**
   * Fetch existing data for duplicate merging
   * Must be implemented by subclasses
   */
  protected abstract fetchExisting(id: string, context: ProcessingContext): Promise<T | null>;

  /**
   * Validate output data
   * Can be overridden by subclasses
   */
  protected async validateOutput(data: T, context: ProcessingContext): Promise<ValidationResult> {
    // Default implementation - can be overridden
    return {
      isValid: true,
      errors: [],
      warnings: [],
    };
  }

  /**
   * Extract ID from raw data
   * Can be overridden by subclasses
   */
  protected extractId(data: any): string {
    return data.id || data.uuid || data._id || uuidv4();
  }

  /**
   * Abstract methods that must be implemented by subclasses
   */
  abstract validate(data: any, context: ProcessingContext): Promise<ValidationResult>;
  abstract normalize(data: T, context: ProcessingContext): Promise<NormalizedData<T>>;
  abstract detectDuplicate(data: T, context: ProcessingContext): Promise<DuplicateResult>;
  abstract merge(source: T, target: T, options: MergeOptions): Promise<T>;

  /**
   * Optimized sequential processing with memory management
   */
  protected async processSequential(
    data: any[],
    context: ProcessingContext,
    metrics: any
  ): Promise<ItemResult<T>[]> {
    const results: ItemResult<T>[] = [];
    
    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      const result = await this.processItemWithRetry(item, context);
      results.push(result);
      this.updateMetrics(metrics, result);
      
      // Memory management: Force garbage collection for large batches
      if (i % 1000 === 0 && global.gc) {
        global.gc();
      }
    }
    
    return results;
  }

  /**
   * Optimized parallel processing with controlled concurrency
   */
  protected async processParallel(
    data: any[],
    context: ProcessingContext,
    metrics: any
  ): Promise<ItemResult<T>[]> {
    const maxConcurrency = this.options.maxConcurrency || Math.min(50, data.length);
    const results: ItemResult<T>[] = [];
    
    // Use semaphore pattern for controlled concurrency
    const semaphore = new Semaphore(maxConcurrency);
    
    const promises = data.map(async (item) => {
      await semaphore.acquire();
      try {
        const result = await this.processItemWithRetry(item, context);
        this.updateMetrics(metrics, result);
        return result;
      } finally {
        semaphore.release();
      }
    });
    
    const parallelResults = await Promise.all(promises);
    results.push(...parallelResults);
    
    return results;
  }

  /**
   * Optimized batch processing with adaptive batch sizes and connection pooling
   */
  protected async processOptimizedBatch(
    data: any[],
    context: ProcessingContext,
    metrics: any
  ): Promise<ItemResult<T>[]> {
    const results: ItemResult<T>[] = [];
    
    // Adaptive batch sizing based on item complexity
    const adaptiveBatchSize = this.calculateAdaptiveBatchSize(data.length);
    const batches = this.createOptimizedBatches(data, adaptiveBatchSize);
    
    // Process batches with optimized concurrency
    for (const batch of batches) {
      const batchStartTime = Date.now();
      
      // Use Promise.allSettled for better error handling
      const promises = batch.map(item => this.processItemWithRetry(item, context));
      const batchResults = await Promise.allSettled(promises);
      
      // Process results and handle rejections
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
          this.updateMetrics(metrics, result.value);
        } else {
          // Handle rejected promises
          const errorResult: ItemResult<T> = {
            id: uuidv4(),
            status: ProcessingStatus.FAILED,
            errors: [{
              stage: ProcessingStage.INPUT_VALIDATION,
              message: 'Promise rejected',
              error: result.reason,
              timestamp: new Date(),
              retryable: true,
            }],
            warnings: [],
          };
          results.push(errorResult);
          this.updateMetrics(metrics, errorResult);
        }
      }
      
      // Adaptive delay between batches to prevent overwhelming downstream systems
      const batchTime = Date.now() - batchStartTime;
      if (batchTime < 100) { // If batch completed too quickly, add small delay
        await this.delay(Math.min(50, Math.max(10, batchTime * 0.1)));
      }
      
      // Memory management
      if (results.length % 5000 === 0 && global.gc) {
        global.gc();
      }
    }
    
    return results;
  }

  /**
   * Calculate adaptive batch size based on data volume and system resources
   */
  protected calculateAdaptiveBatchSize(totalItems: number): number {
    const baseBatchSize = this.options.batchSize || 100;
    const memoryUsage = process.memoryUsage();
    const availableMemory = memoryUsage.heapTotal - memoryUsage.heapUsed;
    
    // Adjust batch size based on available memory
    const memoryFactor = Math.min(2, availableMemory / (100 * 1024 * 1024)); // 100MB baseline
    const itemCountFactor = totalItems > 10000 ? 0.8 : 1.2; // Smaller batches for large datasets
    
    return Math.max(10, Math.min(500, Math.floor(baseBatchSize * memoryFactor * itemCountFactor)));
  }

  /**
   * Create optimized batches with better memory efficiency
   */
  protected createOptimizedBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    const totalBatches = Math.ceil(items.length / batchSize);
    
    for (let i = 0; i < totalBatches; i++) {
      const start = i * batchSize;
      const end = Math.min(start + batchSize, items.length);
      
      // Use slice to avoid creating unnecessary copies
      batches.push(items.slice(start, end));
    }
    
    return batches;
  }

  /**
   * Helper method to create batches (legacy method for backward compatibility)
   */
  protected createBatches<T>(items: T[], batchSize: number): T[][] {
    return this.createOptimizedBatches(items, batchSize);
  }

  /**
   * Helper method for delays
   */
  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Initialize metrics
   */
  protected initializeMetrics(totalItems: number): any {
    return {
      totalItems,
      processedItems: 0,
      successfulItems: 0,
      failedItems: 0,
      skippedItems: 0,
      duplicatesFound: 0,
      duplicatesMerged: 0,
      validationErrors: 0,
      processingTime: 0,
      averageItemTime: 0,
      stages: Object.values(ProcessingStage).reduce((acc, stage) => ({
        ...acc,
        [stage]: {
          itemsProcessed: 0,
          errors: 0,
          duration: 0,
          averageDuration: 0,
        },
      }), {}),
    };
  }

  /**
   * Update metrics based on item result
   */
  protected updateMetrics(metrics: any, result: ItemResult<T>): void {
    metrics.processedItems++;

    switch (result.status) {
      case ProcessingStatus.COMPLETED:
        metrics.successfulItems++;
        break;
      case ProcessingStatus.FAILED:
        metrics.failedItems++;
        break;
      case ProcessingStatus.SKIPPED:
        metrics.skippedItems++;
        break;
    }

    if (result.duplicateOf) {
      metrics.duplicatesFound++;
    }

    if (result.errors.length > 0) {
      metrics.validationErrors += result.errors.filter(
        e => e.stage === ProcessingStage.INPUT_VALIDATION
      ).length;
    }

    // Update stage metrics
    if (result.metrics?.stages) {
      Object.entries(result.metrics.stages).forEach(([stage, duration]) => {
        const stageMetrics = metrics.stages[stage];
        if (stageMetrics) {
          stageMetrics.itemsProcessed++;
          stageMetrics.duration += duration;
          stageMetrics.averageDuration = stageMetrics.duration / stageMetrics.itemsProcessed;
        }
      });
    }
  }

  /**
   * Determine batch status based on metrics
   */
  protected determineBatchStatus(metrics: any): ProcessingStatus {
    if (metrics.failedItems === metrics.totalItems) {
      return ProcessingStatus.FAILED;
    } else if (metrics.successfulItems === metrics.totalItems) {
      return ProcessingStatus.COMPLETED;
    } else if (metrics.failedItems > 0) {
      return ProcessingStatus.PARTIAL;
    } else {
      return ProcessingStatus.COMPLETED;
    }
  }

  /**
   * Get monitoring statistics
   */
  public getMonitoringStats() {
    return this.monitor.getMonitoringStats();
  }

  /**
   * Get processing insights
   */
  public getProcessingInsights() {
    return this.monitor.generateInsights();
  }

  /**
   * Export monitoring data
   */
  public exportMonitoringData() {
    return this.monitor.exportMetrics();
  }

  /**
   * Get monitor instance for advanced usage
   */
  public getMonitor(): ResultProcessingMonitor {
    return this.monitor;
  }
}