/**
 * Metrics collector for processing pipeline monitoring
 */

import {
  IMetricsCollector,
  ProcessingStage,
  ProcessingStatus,
  ProcessingMetrics,
  StageMetrics,
  ProcessingError,
} from './types';

interface BatchMetrics {
  batchId: string;
  startTime: number;
  endTime?: number;
  items: Map<string, ItemMetrics>;
  stages: Map<ProcessingStage, StageMetricsData>;
  errors: ProcessingError[];
  duplicates: Map<string, string>;
}

interface ItemMetrics {
  itemId: string;
  status: ProcessingStatus;
  startTime: number;
  endTime?: number;
  stages: Map<ProcessingStage, StageTimingData>;
}

interface StageTimingData {
  startTime: number;
  endTime?: number;
  error?: any;
}

interface StageMetricsData extends StageMetrics {
  activeItems: Set<string>;
}

/**
 * In-memory metrics collector
 */
export class MetricsCollector implements IMetricsCollector {
  private batches: Map<string, BatchMetrics> = new Map();

  /**
   * Start tracking a new batch
   */
  startBatch(batchId: string): void {
    this.batches.set(batchId, {
      batchId,
      startTime: Date.now(),
      items: new Map(),
      stages: new Map(),
      errors: [],
      duplicates: new Map(),
    });

    // Initialize stage metrics
    Object.values(ProcessingStage).forEach(stage => {
      this.batches.get(batchId)!.stages.set(stage, {
        itemsProcessed: 0,
        errors: 0,
        duration: 0,
        averageDuration: 0,
        activeItems: new Set(),
      });
    });
  }

  /**
   * End batch tracking and calculate final metrics
   */
  endBatch(batchId: string): ProcessingMetrics {
    const batch = this.batches.get(batchId);
    if (!batch) {
      throw new Error(`Batch ${batchId} not found`);
    }

    batch.endTime = Date.now();
    return this.calculateMetrics(batch);
  }

  /**
   * Record the start of a processing stage
   */
  recordStageStart(
    batchId: string,
    stage: ProcessingStage,
    itemId?: string
  ): void {
    const batch = this.batches.get(batchId);
    if (!batch) return;

    if (itemId) {
      // Item-level tracking
      let item = batch.items.get(itemId);
      if (!item) {
        item = {
          itemId,
          status: ProcessingStatus.PROCESSING,
          startTime: Date.now(),
          stages: new Map(),
        };
        batch.items.set(itemId, item);
      }

      item.stages.set(stage, { startTime: Date.now() });

      // Update stage metrics
      const stageMetrics = batch.stages.get(stage);
      if (stageMetrics) {
        stageMetrics.activeItems.add(itemId);
      }
    }
  }

  /**
   * Record the end of a processing stage
   */
  recordStageEnd(
    batchId: string,
    stage: ProcessingStage,
    itemId?: string,
    error?: any
  ): void {
    const batch = this.batches.get(batchId);
    if (!batch) return;

    if (itemId) {
      const item = batch.items.get(itemId);
      if (!item) return;

      const stageTiming = item.stages.get(stage);
      if (stageTiming) {
        stageTiming.endTime = Date.now();
        stageTiming.error = error;

        // Update stage metrics
        const stageMetrics = batch.stages.get(stage);
        if (stageMetrics) {
          stageMetrics.activeItems.delete(itemId);
          stageMetrics.itemsProcessed++;
          
          if (error) {
            stageMetrics.errors++;
          }

          const duration = stageTiming.endTime - stageTiming.startTime;
          stageMetrics.duration += duration;
          stageMetrics.averageDuration = 
            stageMetrics.duration / stageMetrics.itemsProcessed;
        }
      }
    }
  }

  /**
   * Record item processing status
   */
  recordItem(
    batchId: string,
    itemId: string,
    status: ProcessingStatus
  ): void {
    const batch = this.batches.get(batchId);
    if (!batch) return;

    let item = batch.items.get(itemId);
    if (!item) {
      item = {
        itemId,
        status,
        startTime: Date.now(),
        stages: new Map(),
      };
      batch.items.set(itemId, item);
    } else {
      item.status = status;
      item.endTime = Date.now();
    }
  }

  /**
   * Record a duplicate detection
   */
  recordDuplicate(
    batchId: string,
    itemId: string,
    duplicateOf: string
  ): void {
    const batch = this.batches.get(batchId);
    if (!batch) return;

    batch.duplicates.set(itemId, duplicateOf);
  }

  /**
   * Record a processing error
   */
  recordError(batchId: string, error: ProcessingError): void {
    const batch = this.batches.get(batchId);
    if (!batch) return;

    batch.errors.push(error);
  }

  /**
   * Get current metrics for a batch
   */
  getMetrics(batchId: string): ProcessingMetrics {
    const batch = this.batches.get(batchId);
    if (!batch) {
      throw new Error(`Batch ${batchId} not found`);
    }

    return this.calculateMetrics(batch);
  }

  /**
   * Calculate metrics from batch data
   */
  private calculateMetrics(batch: BatchMetrics): ProcessingMetrics {
    const totalItems = batch.items.size;
    let processedItems = 0;
    let successfulItems = 0;
    let failedItems = 0;
    let skippedItems = 0;

    // Count items by status
    batch.items.forEach(item => {
      // An item is considered processed if it has a final status
      if (item.status === ProcessingStatus.COMPLETED ||
          item.status === ProcessingStatus.FAILED ||
          item.status === ProcessingStatus.SKIPPED ||
          item.status === ProcessingStatus.PARTIAL) {
        processedItems++;
      }

      switch (item.status) {
        case ProcessingStatus.COMPLETED:
          successfulItems++;
          break;
        case ProcessingStatus.FAILED:
          failedItems++;
          break;
        case ProcessingStatus.SKIPPED:
          skippedItems++;
          break;
      }
    });

    // Count validation errors
    const validationErrors = batch.errors.filter(
      e => e.stage === ProcessingStage.INPUT_VALIDATION
    ).length;

    // Calculate processing time
    const processingTime = batch.endTime 
      ? batch.endTime - batch.startTime 
      : Date.now() - batch.startTime;

    const averageItemTime = processedItems > 0 
      ? processingTime / processedItems 
      : 0;

    // Convert stage metrics
    const stages: Record<ProcessingStage, StageMetrics> = {} as any;
    batch.stages.forEach((stageData, stage) => {
      stages[stage] = {
        itemsProcessed: stageData.itemsProcessed,
        errors: stageData.errors,
        duration: stageData.duration,
        averageDuration: stageData.averageDuration,
      };
    });

    return {
      totalItems,
      processedItems,
      successfulItems,
      failedItems,
      skippedItems,
      duplicatesFound: batch.duplicates.size,
      duplicatesMerged: batch.duplicates.size, // Assuming all duplicates are merged
      validationErrors,
      processingTime,
      averageItemTime,
      stages,
    };
  }

  /**
   * Clear metrics for a batch
   */
  clearBatch(batchId: string): void {
    this.batches.delete(batchId);
  }

  /**
   * Clear all metrics
   */
  clearAll(): void {
    this.batches.clear();
  }

  /**
   * Get all active batches
   */
  getActiveBatches(): string[] {
    return Array.from(this.batches.keys()).filter(batchId => {
      const batch = this.batches.get(batchId);
      return batch && !batch.endTime;
    });
  }

  /**
   * Get completed batches
   */
  getCompletedBatches(): string[] {
    return Array.from(this.batches.keys()).filter(batchId => {
      const batch = this.batches.get(batchId);
      return batch && batch.endTime;
    });
  }

  /**
   * Export metrics for a batch
   */
  exportMetrics(batchId: string): any {
    const batch = this.batches.get(batchId);
    if (!batch) {
      throw new Error(`Batch ${batchId} not found`);
    }

    const metrics = this.calculateMetrics(batch);
    
    // Create detailed export including item-level data
    const itemDetails = Array.from(batch.items.values()).map(item => {
      const stages: any = {};
      item.stages.forEach((timing, stage) => {
        stages[stage] = {
          duration: timing.endTime ? timing.endTime - timing.startTime : null,
          error: timing.error || null,
        };
      });

      return {
        itemId: item.itemId,
        status: item.status,
        processingTime: item.endTime ? item.endTime - item.startTime : null,
        stages,
      };
    });

    return {
      batchId: batch.batchId,
      startTime: new Date(batch.startTime),
      endTime: batch.endTime ? new Date(batch.endTime) : null,
      metrics,
      items: itemDetails,
      errors: batch.errors,
      duplicates: Array.from(batch.duplicates.entries()).map(([item, duplicate]) => ({
        item,
        duplicateOf: duplicate,
      })),
    };
  }
}