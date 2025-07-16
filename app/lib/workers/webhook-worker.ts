import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { QueueName } from '@/lib/queue-management/types';
import { WebhookHandler } from '@/lib/apify/webhook-handler';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';

export interface WebhookJobData {
  eventId: string;
  eventType: string;
  actorRunId: string;
  payload: any;
  headers: Record<string, string>;
  metadata?: Record<string, any>;
  retryCount?: number;
  originalTimestamp: string;
}

export class WebhookWorker {
  private worker: Worker;
  private webhookHandler: WebhookHandler;
  private redis: IORedis;
  private isShuttingDown = false;

  constructor() {
    this.redis = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      enableReadyCheck: false,
    });

    this.webhookHandler = new WebhookHandler();

    this.worker = new Worker(
      QueueName.WEBHOOK_PROCESSING,
      this.processJob.bind(this),
      {
        connection: this.redis,
        concurrency: parseInt(process.env.WEBHOOK_WORKER_CONCURRENCY || '5'),
        maxStalledCount: 3,
        stalledInterval: 30000,
        removeOnComplete: 100,
        removeOnFail: 50,
      }
    );

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.worker.on('ready', () => {
      logger.info('Webhook worker ready to process jobs');
    });

    this.worker.on('active', (job: Job) => {
      logger.info(`Processing webhook job ${job.id}`, {
        eventType: job.data.eventType,
        actorRunId: job.data.actorRunId,
        retryCount: job.data.retryCount || 0,
      });
    });

    this.worker.on('completed', (job: Job, result: any) => {
      logger.info(`Webhook job ${job.id} completed successfully`, {
        eventType: job.data.eventType,
        actorRunId: job.data.actorRunId,
        processingTime: Date.now() - job.processedOn!,
        result,
      });
    });

    this.worker.on('failed', (job: Job | undefined, err: Error) => {
      if (job) {
        logger.error(`Webhook job ${job.id} failed`, {
          eventType: job.data?.eventType,
          actorRunId: job.data?.actorRunId,
          error: err.message,
          stack: err.stack,
          attemptsMade: job.attemptsMade,
          attemptsTotal: job.opts.attempts,
        });
      } else {
        logger.error('Webhook job failed (job data unavailable)', { error: err.message });
      }
    });

    this.worker.on('stalled', (jobId: string) => {
      logger.warn(`Webhook job ${jobId} stalled and will be retried`);
    });

    this.worker.on('error', (err: Error) => {
      logger.error('Webhook worker error', { error: err.message, stack: err.stack });
    });

    // Graceful shutdown handling
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
  }

  private async processJob(job: Job<WebhookJobData>): Promise<any> {
    const { eventId, eventType, actorRunId, payload, headers, metadata, retryCount = 0 } = job.data;

    try {
      // Update webhook event status to processing
      await this.updateWebhookEventStatus(eventId, 'processing', {
        startedAt: new Date(),
        workerId: `webhook-worker-${process.pid}`,
        jobId: job.id,
      });

      // Determine job type and route to appropriate handler
      let result;
      switch (eventType) {
        case 'ACTOR.RUN.SUCCEEDED':
          result = await this.handleActorRunSucceeded(job.data);
          break;
        case 'ACTOR.RUN.FAILED':
          result = await this.handleActorRunFailed(job.data);
          break;
        case 'ACTOR.RUN.ABORTED':
          result = await this.handleActorRunAborted(job.data);
          break;
        case 'ACTOR.RUN.TIMED_OUT':
          result = await this.handleActorRunTimedOut(job.data);
          break;
        default:
          logger.warn(`Unknown event type: ${eventType}`, { eventId, actorRunId });
          result = { status: 'ignored', reason: 'Unknown event type' };
      }

      // Update webhook event status to completed
      await this.updateWebhookEventStatus(eventId, 'completed', {
        completedAt: new Date(),
        result,
        processingTime: Date.now() - job.processedOn!,
      });

      return result;

    } catch (error) {
      // Update webhook event status to failed
      await this.updateWebhookEventStatus(eventId, 'failed', {
        failedAt: new Date(),
        error: error.message,
        stack: error.stack,
        retryCount: retryCount + 1,
      });

      throw error;
    }
  }

  private async handleActorRunSucceeded(jobData: WebhookJobData): Promise<any> {
    const { actorRunId, payload, headers } = jobData;

    try {
      // Use existing webhook handler for processing
      const result = await this.webhookHandler.handleWebhook({
        eventType: 'ACTOR.RUN.SUCCEEDED',
        actorRunId,
        payload,
        headers,
      });

      logger.info(`Successfully processed actor run ${actorRunId}`, {
        createdProfiles: result.createdProfiles?.length || 0,
        updatedProfiles: result.updatedProfiles?.length || 0,
        duplicatesFound: result.duplicatesFound?.length || 0,
      });

      return result;

    } catch (error) {
      logger.error(`Failed to process successful actor run ${actorRunId}`, {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  private async handleActorRunFailed(jobData: WebhookJobData): Promise<any> {
    const { actorRunId, payload } = jobData;

    try {
      // Log the failure and update metrics
      logger.warn(`Actor run failed: ${actorRunId}`, {
        failureReason: payload.data?.exitCode || 'Unknown',
        errorMessage: payload.data?.errorMessage,
      });

      // Use existing webhook handler
      const result = await this.webhookHandler.handleWebhook({
        eventType: 'ACTOR.RUN.FAILED',
        actorRunId,
        payload,
        headers: jobData.headers,
      });

      return { status: 'logged', actorRunId, result };

    } catch (error) {
      logger.error(`Failed to process failed actor run ${actorRunId}`, {
        error: error.message,
      });
      throw error;
    }
  }

  private async handleActorRunAborted(jobData: WebhookJobData): Promise<any> {
    const { actorRunId, payload } = jobData;

    logger.info(`Actor run aborted: ${actorRunId}`, {
      reason: payload.data?.statusMessage || 'User aborted',
    });

    // Use existing webhook handler
    const result = await this.webhookHandler.handleWebhook({
      eventType: 'ACTOR.RUN.ABORTED',
      actorRunId,
      payload,
      headers: jobData.headers,
    });

    return { status: 'logged', actorRunId, result };
  }

  private async handleActorRunTimedOut(jobData: WebhookJobData): Promise<any> {
    const { actorRunId, payload } = jobData;

    logger.warn(`Actor run timed out: ${actorRunId}`, {
      timeout: payload.data?.timeoutAt,
      runTime: payload.data?.stats?.runTimeSecs,
    });

    // Use existing webhook handler
    const result = await this.webhookHandler.handleWebhook({
      eventType: 'ACTOR.RUN.TIMED_OUT',
      actorRunId,
      payload,
      headers: jobData.headers,
    });

    return { status: 'logged', actorRunId, result };
  }

  private async updateWebhookEventStatus(
    eventId: string,
    status: 'processing' | 'completed' | 'failed',
    metadata: Record<string, any>
  ): Promise<void> {
    try {
      await prisma.webhookEvent.update({
        where: { id: eventId },
        data: {
          status,
          updatedAt: new Date(),
          metadata: {
            ...(await this.getExistingMetadata(eventId)),
            ...metadata,
          },
        },
      });
    } catch (error) {
      logger.warn(`Failed to update webhook event status for ${eventId}`, {
        error: error.message,
        status,
      });
    }
  }

  private async getExistingMetadata(eventId: string): Promise<Record<string, any>> {
    try {
      const event = await prisma.webhookEvent.findUnique({
        where: { id: eventId },
        select: { metadata: true },
      });
      return (event?.metadata as Record<string, any>) || {};
    } catch {
      return {};
    }
  }

  async getWorkerInfo(): Promise<{
    isRunning: boolean;
    concurrency: number;
    processingCount: number;
    pid: number;
    uptime: number;
  }> {
    return {
      isRunning: !this.isShuttingDown && !this.worker.closing,
      concurrency: parseInt(process.env.WEBHOOK_WORKER_CONCURRENCY || '5'),
      processingCount: this.worker.isRunning() ? 1 : 0, // BullMQ doesn't expose this directly
      pid: process.pid,
      uptime: process.uptime(),
    };
  }

  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    logger.info('Shutting down webhook worker...');

    try {
      // Stop accepting new jobs
      await this.worker.close();
      logger.info('Webhook worker closed successfully');

      // Close Redis connection
      this.redis.disconnect();
      logger.info('Redis connection closed');

    } catch (error) {
      logger.error('Error during webhook worker shutdown', {
        error: error.message,
        stack: error.stack,
      });
    }
  }

  isHealthy(): boolean {
    return !this.isShuttingDown && !this.worker.closing;
  }
}

// Export singleton instance for easy use
export const webhookWorker = new WebhookWorker();