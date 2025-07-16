import { ApifyClient } from 'apify-client';
import { APITrackingMiddleware } from '../middleware/api-tracking';
import { logger } from '../logger';

/**
 * Tracked Apify client that monitors API usage and costs
 */
export class TrackedApifyClient extends ApifyClient {
  private tracker: APITrackingMiddleware;
  
  constructor(options?: any) {
    super(options);
    this.tracker = new APITrackingMiddleware();
  }

  /**
   * Override actor run method to track usage
   */
  async runActor(actorId: string, input?: any, options?: any) {
    const endpoint = `/actors/${actorId}/runs`;
    
    return this.tracker.trackApify(
      actorId,
      endpoint,
      async () => {
        const run = await super.actor(actorId).call(input, options);
        
        // Track compute units after run completes
        if (run?.defaultDatasetId) {
          try {
            // Wait for run to complete
            const finalRun = await this.waitForRun(run.id);
            
            // Get run statistics
            const stats = finalRun?.stats || {};
            const computeUnits = stats.computeUnits || 0;
            const datasetItemCount = stats.datasetItemCount || 0;
            
            // Track the usage
            await this.tracker.trackApify(
              actorId,
              `${endpoint}/stats`,
              async () => ({ stats }),
              {
                computeUnits,
                datasetOperations: datasetItemCount,
                metadata: {
                  runId: run.id,
                  defaultDatasetId: run.defaultDatasetId,
                  status: finalRun?.status,
                  duration: stats.runTimeSecs,
                }
              }
            );
          } catch (error) {
            logger.error('Failed to track Apify run stats:', error);
          }
        }
        
        return run;
      },
      {
        metadata: {
          input,
          options,
        }
      }
    );
  }

  /**
   * Wait for a run to complete
   */
  private async waitForRun(runId: string, maxWaitSecs: number = 300): Promise<any> {
    const startTime = Date.now();
    
    while ((Date.now() - startTime) / 1000 < maxWaitSecs) {
      const run = await super.run(runId).get();
      
      if (run?.status && ['SUCCEEDED', 'FAILED', 'ABORTED'].includes(run.status)) {
        return run;
      }
      
      // Wait 2 seconds before next check
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    throw new Error(`Run ${runId} did not complete within ${maxWaitSecs} seconds`);
  }

  /**
   * Track dataset operations
   */
  async getDatasetItems(datasetId: string, options?: any) {
    const endpoint = `/datasets/${datasetId}/items`;
    
    return this.tracker.trackApify(
      'dataset-read',
      endpoint,
      async () => {
        const items = await super.dataset(datasetId).listItems(options);
        return items;
      },
      {
        datasetOperations: options?.limit || 100,
        metadata: {
          datasetId,
          options,
        }
      }
    );
  }

  /**
   * Get aggregated Apify usage for monitoring
   */
  async getUsageStats(timeRange: '24h' | '7d' | '30d' = '24h') {
    const tracker = this.tracker.getTracker();
    const stats = await tracker.getUsageStats('Apify', timeRange);
    
    return {
      totalRequests: stats.totalRequests,
      totalCost: stats.totalCost,
      averageResponseTime: stats.averageResponseTime,
      errorRate: stats.errorRate,
      metadata: {
        totalComputeUnits: stats.metadata?.totalComputeUnits || 0,
        totalDatasetOperations: stats.metadata?.totalDatasetOperations || 0,
        totalStorageBytes: stats.metadata?.totalStorageBytes || 0,
      }
    };
  }
}

// Create singleton instance
export const trackedApifyClient = new TrackedApifyClient({
  token: process.env.APIFY_API_KEY,
});