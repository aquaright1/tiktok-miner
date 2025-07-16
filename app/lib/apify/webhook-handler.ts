import { prisma } from '@/lib/prisma';
import { ApifyWebhookPayload } from '@/app/api/webhooks/apify/route';
import { ApifyActorResponse, UnifiedCreatorData } from './types';
import { TransformerFactory } from './transformers';
import { WebhookQueue } from './webhook-queue';
import { APITrackingMiddleware } from '@/lib/middleware/api-tracking';

export class WebhookHandler {
  private queue: WebhookQueue;
  private apiTracker: APITrackingMiddleware;

  constructor() {
    this.queue = new WebhookQueue();
    this.apiTracker = new APITrackingMiddleware();
  }

  /**
   * Process a webhook event from Apify
   */
  async processWebhook(webhookEventId: string, payload: ApifyWebhookPayload): Promise<void> {
    console.log(`Processing webhook ${webhookEventId}:`, {
      eventType: payload.eventType,
      actorId: payload.actorId,
      runId: payload.actorRunId,
      status: payload.status
    });

    try {
      // Update webhook status to processing
      await prisma.webhookEvent.update({
        where: { id: webhookEventId },
        data: { 
          status: 'processing',
          attempts: { increment: 1 }
        }
      });

      // Route based on event type
      switch (payload.eventType) {
        case 'ACTOR.RUN.SUCCEEDED':
          await this.handleActorRunSucceeded(webhookEventId, payload);
          break;
        
        case 'ACTOR.RUN.FAILED':
          await this.handleActorRunFailed(webhookEventId, payload);
          break;
        
        case 'ACTOR.RUN.ABORTED':
          await this.handleActorRunAborted(webhookEventId, payload);
          break;
        
        case 'ACTOR.RUN.TIMED_OUT':
          await this.handleActorRunTimedOut(webhookEventId, payload);
          break;
        
        default:
          console.warn(`Unknown webhook event type: ${payload.eventType}`);
      }

      // Mark as completed
      await prisma.webhookEvent.update({
        where: { id: webhookEventId },
        data: { 
          status: 'completed',
          processedAt: new Date()
        }
      });

    } catch (error) {
      console.error(`Error processing webhook ${webhookEventId}:`, error);
      
      // Check if we should retry
      const webhookEvent = await prisma.webhookEvent.findUnique({
        where: { id: webhookEventId }
      });

      if (webhookEvent && webhookEvent.attempts < webhookEvent.maxAttempts) {
        // Schedule retry
        const nextRetryAt = new Date(Date.now() + Math.pow(2, webhookEvent.attempts) * 60000); // Exponential backoff
        
        await prisma.webhookEvent.update({
          where: { id: webhookEventId },
          data: {
            status: 'pending',
            nextRetryAt,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        });

        // Queue for retry
        await this.queue.scheduleRetry(webhookEventId, nextRetryAt);
      } else {
        // Move to dead letter queue
        await prisma.webhookEvent.update({
          where: { id: webhookEventId },
          data: {
            status: 'dead_letter',
            error: error instanceof Error ? error.message : 'Unknown error',
            processedAt: new Date()
          }
        });
      }

      throw error;
    }
  }

  /**
   * Handle successful actor run completion
   */
  private async handleActorRunSucceeded(webhookEventId: string, payload: ApifyWebhookPayload): Promise<void> {
    console.log(`Actor run succeeded: ${payload.actorRunId}`);

    // Track API usage for monitoring
    await this.apiTracker.trackCustom('apify', 'webhook', {
      eventType: payload.eventType,
      actorId: payload.actorId,
      runId: payload.actorRunId,
      computeUnits: payload.stats?.computeUnits || 0
    });

    // Fetch the run results from Apify
    const results = await this.fetchActorRunResults(payload.actorRunId, payload.defaultDatasetId);

    // Process the results based on the actor type
    if (payload.customData?.actorType) {
      await this.processActorResults(
        payload.customData.actorType,
        results,
        payload.actorRunId
      );
    } else {
      console.warn(`No actor type specified in custom data for run ${payload.actorRunId}`);
    }

    // Update any related records if needed
    if (payload.customData?.creatorProfileId) {
      await this.updateCreatorProfileStatus(
        payload.customData.creatorProfileId,
        'synced',
        payload.finishedAt
      );
    }
  }

  /**
   * Handle failed actor run
   */
  private async handleActorRunFailed(webhookEventId: string, payload: ApifyWebhookPayload): Promise<void> {
    console.error(`Actor run failed: ${payload.actorRunId}`, {
      exitCode: payload.exitCode,
      status: payload.status
    });

    // Track the failure
    await this.apiTracker.trackCustom('apify', 'webhook', {
      eventType: payload.eventType,
      actorId: payload.actorId,
      runId: payload.actorRunId,
      error: 'Actor run failed',
      exitCode: payload.exitCode
    });

    // Update related records
    if (payload.customData?.creatorProfileId) {
      await this.updateCreatorProfileStatus(
        payload.customData.creatorProfileId,
        'failed',
        payload.finishedAt,
        `Actor run failed with exit code ${payload.exitCode}`
      );
    }

    // Send alert if needed
    await this.sendFailureAlert(payload);
  }

  /**
   * Handle aborted actor run
   */
  private async handleActorRunAborted(webhookEventId: string, payload: ApifyWebhookPayload): Promise<void> {
    console.warn(`Actor run aborted: ${payload.actorRunId}`);

    // Track the abort
    await this.apiTracker.trackCustom('apify', 'webhook', {
      eventType: payload.eventType,
      actorId: payload.actorId,
      runId: payload.actorRunId,
      status: 'aborted'
    });

    // Update related records
    if (payload.customData?.creatorProfileId) {
      await this.updateCreatorProfileStatus(
        payload.customData.creatorProfileId,
        'aborted',
        payload.finishedAt,
        'Actor run was aborted'
      );
    }
  }

  /**
   * Handle timed out actor run
   */
  private async handleActorRunTimedOut(webhookEventId: string, payload: ApifyWebhookPayload): Promise<void> {
    console.error(`Actor run timed out: ${payload.actorRunId}`);

    // Track the timeout
    await this.apiTracker.trackCustom('apify', 'webhook', {
      eventType: payload.eventType,
      actorId: payload.actorId,
      runId: payload.actorRunId,
      status: 'timed_out',
      duration: payload.stats?.durationMillis
    });

    // Update related records
    if (payload.customData?.creatorProfileId) {
      await this.updateCreatorProfileStatus(
        payload.customData.creatorProfileId,
        'timeout',
        payload.finishedAt,
        'Actor run timed out'
      );
    }

    // Send alert for timeout
    await this.sendTimeoutAlert(payload);
  }

  /**
   * Fetch results from Apify actor run
   */
  private async fetchActorRunResults(runId: string, datasetId: string): Promise<any[]> {
    // This would typically use the Apify client SDK
    // For now, we'll return a placeholder
    console.log(`Fetching results for run ${runId} from dataset ${datasetId}`);
    
    // TODO: Implement Apify SDK integration
    // const apifyClient = new ApifyClient({ token: process.env.APIFY_API_TOKEN });
    // const { items } = await apifyClient.dataset(datasetId).listItems();
    // return items;
    
    return [];
  }

  /**
   * Process actor results based on actor type
   */
  private async processActorResults(
    actorType: string,
    results: any[],
    runId: string
  ): Promise<void> {
    console.log(`Processing ${results.length} results from ${actorType} actor`);

    for (const result of results) {
      try {
        // Transform to unified format
        const transformResult = TransformerFactory.transform(actorType, result);
        if (!transformResult.validation.isValid) {
          throw new Error(`Failed to transform data: ${transformResult.validation.errors.join(', ')}`);
        }
        const transformedData = transformResult.data;
        
        if (transformedData) {
          // Store or update creator profile
          await this.upsertCreatorProfile(transformedData, runId);
        }
      } catch (error) {
        console.error(`Error processing result from ${actorType}:`, error);
      }
    }
  }

  /**
   * Upsert creator profile with unified data
   */
  private async upsertCreatorProfile(
    data: UnifiedCreatorData,
    runId: string
  ): Promise<void> {
    // Implementation would depend on your specific requirements
    console.log(`Upserting creator profile: ${data.name}`);
    
    // TODO: Implement the actual upsert logic
    // This would typically:
    // 1. Check if creator exists by platform identifiers
    // 2. Update existing or create new profile
    // 3. Update platform-specific metrics
    // 4. Calculate composite scores
  }

  /**
   * Update creator profile sync status
   */
  private async updateCreatorProfileStatus(
    creatorProfileId: string,
    status: string,
    timestamp?: string,
    error?: string
  ): Promise<void> {
    // TODO: Add status field to CreatorProfile if needed
    console.log(`Updating creator profile ${creatorProfileId} status to ${status}`);
  }

  /**
   * Send alert for failed actor runs
   */
  private async sendFailureAlert(payload: ApifyWebhookPayload): Promise<void> {
    console.error('Actor run failure alert:', {
      actorId: payload.actorId,
      runId: payload.actorRunId,
      exitCode: payload.exitCode
    });
    
    // TODO: Implement alert notification (email, Slack, etc.)
  }

  /**
   * Send alert for timed out actor runs
   */
  private async sendTimeoutAlert(payload: ApifyWebhookPayload): Promise<void> {
    console.error('Actor run timeout alert:', {
      actorId: payload.actorId,
      runId: payload.actorRunId,
      duration: payload.stats?.durationMillis
    });
    
    // TODO: Implement alert notification
  }

  /**
   * Retry failed webhooks
   */
  async retryFailedWebhooks(): Promise<void> {
    const failedWebhooks = await prisma.webhookEvent.findMany({
      where: {
        status: 'pending',
        nextRetryAt: { lte: new Date() },
        attempts: { lt: 3 }
      },
      orderBy: { nextRetryAt: 'asc' },
      take: 10
    });

    for (const webhook of failedWebhooks) {
      try {
        await this.processWebhook(webhook.id, webhook.payload as ApifyWebhookPayload);
      } catch (error) {
        console.error(`Retry failed for webhook ${webhook.id}:`, error);
      }
    }
  }

  /**
   * Process dead letter queue
   */
  async processDeadLetterQueue(): Promise<void> {
    const deadLetterWebhooks = await prisma.webhookEvent.findMany({
      where: {
        status: 'dead_letter',
        processedAt: null
      },
      orderBy: { createdAt: 'asc' },
      take: 5
    });

    for (const webhook of deadLetterWebhooks) {
      console.log(`Processing dead letter webhook ${webhook.id}`);
      
      // Manual intervention might be needed
      // Log for manual review or send to error tracking service
      
      await prisma.webhookEvent.update({
        where: { id: webhook.id },
        data: { processedAt: new Date() }
      });
    }
  }
}