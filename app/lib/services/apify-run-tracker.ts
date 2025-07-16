/**
 * ApifyRunTracker - Real-time tracking of Apify actor runs
 * Integrates with ActorManager to track runs and send updates to monitoring service
 */

import { ActorManager } from '../apify/actor-manager';
import { ApifyMonitoringService } from './apify-monitoring-service';
import { logger } from '../logger';

export interface ActorRunStatus {
  runId: string;
  actorId: string;
  platform: string;
  status: 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'TIMED_OUT' | 'ABORTED';
  startedAt: Date;
  finishedAt?: Date;
  datasetId?: string;
  progress?: {
    itemsProcessed: number;
    totalItems?: number;
    percentage?: number;
  };
  resources?: {
    memoryUsage: number;
    cpuUsage: number;
  };
  cost?: {
    current: number;
    estimated: number;
  };
  error?: string;
}

export interface RunTrackingOptions {
  pollInterval?: number; // milliseconds
  enableCostTracking?: boolean;
  enableProgressTracking?: boolean;
  enableResourceTracking?: boolean;
  onStatusUpdate?: (status: ActorRunStatus) => void;
  onError?: (error: Error, runId: string) => void;
}

export class ApifyRunTracker {
  private actorManager: ActorManager;
  private monitoringService: ApifyMonitoringService;
  private activeRuns: Map<string, {
    status: ActorRunStatus;
    intervalId?: NodeJS.Timeout;
    options: RunTrackingOptions;
  }> = new Map();
  private defaultOptions: RunTrackingOptions = {
    pollInterval: 10000, // 10 seconds
    enableCostTracking: true,
    enableProgressTracking: true,
    enableResourceTracking: true,
  };

  constructor() {
    this.actorManager = new ActorManager({
      apiKey: process.env.APIFY_API_KEY!,
      maxRetries: 3,
      requestTimeoutMs: 30000,
    });
    this.monitoringService = new ApifyMonitoringService();
  }

  /**
   * Start tracking an actor run
   */
  async startTracking(
    runId: string,
    actorId: string,
    platform: string,
    options: RunTrackingOptions = {}
  ): Promise<void> {
    const mergedOptions = { ...this.defaultOptions, ...options };
    
    try {
      // Get initial run status
      const initialStatus = await this.getRunStatus(runId, actorId, platform);
      
      // Store in active runs
      this.activeRuns.set(runId, {
        status: initialStatus,
        options: mergedOptions,
      });

      // Start polling if the run is still active
      if (initialStatus.status === 'RUNNING') {
        this.startPolling(runId);
      }

      // Track in monitoring service
      await this.monitoringService.trackActorRun({
        runId,
        actorId,
        platform,
        status: initialStatus.status,
        startedAt: initialStatus.startedAt,
        finishedAt: initialStatus.finishedAt,
        datasetItemCount: initialStatus.progress?.itemsProcessed,
        costUsd: initialStatus.cost?.current,
        errorMessage: initialStatus.error,
        metadata: {
          progress: initialStatus.progress,
          resources: initialStatus.resources,
        },
      });

      // Call status update callback
      if (mergedOptions.onStatusUpdate) {
        mergedOptions.onStatusUpdate(initialStatus);
      }

      logger.info(`Started tracking Apify run: ${runId} (${platform})`);
    } catch (error) {
      logger.error(`Failed to start tracking run ${runId}:`, error);
      if (mergedOptions.onError) {
        mergedOptions.onError(error as Error, runId);
      }
    }
  }

  /**
   * Stop tracking an actor run
   */
  stopTracking(runId: string): void {
    const runData = this.activeRuns.get(runId);
    if (runData) {
      if (runData.intervalId) {
        clearInterval(runData.intervalId);
      }
      this.activeRuns.delete(runId);
      logger.info(`Stopped tracking Apify run: ${runId}`);
    }
  }

  /**
   * Get current status of a tracked run
   */
  getTrackedRunStatus(runId: string): ActorRunStatus | null {
    const runData = this.activeRuns.get(runId);
    return runData?.status || null;
  }

  /**
   * Get all currently tracked runs
   */
  getAllTrackedRuns(): ActorRunStatus[] {
    return Array.from(this.activeRuns.values()).map(run => run.status);
  }

  /**
   * Start polling for run updates
   */
  private startPolling(runId: string): void {
    const runData = this.activeRuns.get(runId);
    if (!runData) return;

    const intervalId = setInterval(async () => {
      try {
        const updatedStatus = await this.getRunStatus(
          runId,
          runData.status.actorId,
          runData.status.platform
        );

        // Update stored status
        runData.status = updatedStatus;

        // Track in monitoring service
        await this.monitoringService.trackActorRun({
          runId,
          actorId: updatedStatus.actorId,
          platform: updatedStatus.platform,
          status: updatedStatus.status,
          startedAt: updatedStatus.startedAt,
          finishedAt: updatedStatus.finishedAt,
          datasetItemCount: updatedStatus.progress?.itemsProcessed,
          costUsd: updatedStatus.cost?.current,
          errorMessage: updatedStatus.error,
          metadata: {
            progress: updatedStatus.progress,
            resources: updatedStatus.resources,
          },
        });

        // Call status update callback
        if (runData.options.onStatusUpdate) {
          runData.options.onStatusUpdate(updatedStatus);
        }

        // Stop polling if run is finished
        if (updatedStatus.status !== 'RUNNING') {
          clearInterval(intervalId);
          logger.info(`Run ${runId} finished with status: ${updatedStatus.status}`);
        }
      } catch (error) {
        logger.error(`Failed to update run status for ${runId}:`, error);
        if (runData.options.onError) {
          runData.options.onError(error as Error, runId);
        }
      }
    }, runData.options.pollInterval);

    runData.intervalId = intervalId;
  }

  /**
   * Get run status from Apify API
   */
  private async getRunStatus(
    runId: string,
    actorId: string,
    platform: string
  ): Promise<ActorRunStatus> {
    try {
      // Get run details from Apify API
      const runDetails = await this.actorManager.getRunDetails(runId);
      
      // Get dataset details if available
      let progress: ActorRunStatus['progress'] | undefined;
      if (runDetails.defaultDatasetId) {
        try {
          const dataset = await this.actorManager.getDatasetInfo(runDetails.defaultDatasetId);
          progress = {
            itemsProcessed: dataset.itemCount || 0,
            totalItems: dataset.itemCount, // Apify doesn't provide total expected
          };
        } catch (error) {
          logger.debug(`Failed to get dataset info for run ${runId}:`, error);
        }
      }

      // Calculate resources if available
      let resources: ActorRunStatus['resources'] | undefined;
      if (runDetails.stats) {
        resources = {
          memoryUsage: runDetails.stats.memoryUsage || 0,
          cpuUsage: runDetails.stats.cpuUsage || 0,
        };
      }

      // Calculate cost if available
      let cost: ActorRunStatus['cost'] | undefined;
      if (runDetails.usage) {
        cost = {
          current: runDetails.usage.totalCost || 0,
          estimated: runDetails.usage.totalCost || 0, // Apify doesn't provide estimates
        };
      }

      return {
        runId,
        actorId,
        platform,
        status: runDetails.status as ActorRunStatus['status'],
        startedAt: new Date(runDetails.startedAt),
        finishedAt: runDetails.finishedAt ? new Date(runDetails.finishedAt) : undefined,
        datasetId: runDetails.defaultDatasetId,
        progress,
        resources,
        cost,
        error: runDetails.statusMessage || undefined,
      };
    } catch (error) {
      logger.error(`Failed to get run status for ${runId}:`, error);
      throw error;
    }
  }

  /**
   * Track multiple runs concurrently
   */
  async trackMultipleRuns(
    runs: Array<{
      runId: string;
      actorId: string;
      platform: string;
      options?: RunTrackingOptions;
    }>
  ): Promise<void> {
    const promises = runs.map(run =>
      this.startTracking(run.runId, run.actorId, run.platform, run.options)
    );

    try {
      await Promise.all(promises);
      logger.info(`Started tracking ${runs.length} Apify runs`);
    } catch (error) {
      logger.error('Failed to start tracking some runs:', error);
    }
  }

  /**
   * Stop tracking all runs
   */
  stopAllTracking(): void {
    const runIds = Array.from(this.activeRuns.keys());
    runIds.forEach(runId => this.stopTracking(runId));
    logger.info(`Stopped tracking ${runIds.length} Apify runs`);
  }

  /**
   * Get run statistics
   */
  getRunStatistics(): {
    total: number;
    running: number;
    succeeded: number;
    failed: number;
    platforms: Record<string, number>;
  } {
    const runs = this.getAllTrackedRuns();
    const stats = {
      total: runs.length,
      running: 0,
      succeeded: 0,
      failed: 0,
      platforms: {} as Record<string, number>,
    };

    runs.forEach(run => {
      if (run.status === 'RUNNING') stats.running++;
      else if (run.status === 'SUCCEEDED') stats.succeeded++;
      else if (run.status === 'FAILED') stats.failed++;

      stats.platforms[run.platform] = (stats.platforms[run.platform] || 0) + 1;
    });

    return stats;
  }
}