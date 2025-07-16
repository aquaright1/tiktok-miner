import { queueManager } from '@/lib/queue-management/queue-manager';
import { QueueName, JobPriority } from '@/lib/queue-management/types';
import { WebhookJobData } from './webhook-worker';
import { logger } from '@/lib/logger';
import { v4 as uuidv4 } from 'uuid';

export interface WebhookEnqueueOptions {
  priority?: JobPriority;
  delay?: number;
  attempts?: number;
  removeOnComplete?: number;
  removeOnFail?: number;
}

export class WebhookWorkerManager {
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Ensure queue manager is initialized
      if (!queueManager.isReady()) {
        await queueManager.initialize();
      }

      this.isInitialized = true;
      logger.info('Webhook worker manager initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize webhook worker manager', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  async enqueueWebhookJob(
    eventData: {
      eventId: string;
      eventType: string;
      actorRunId: string;
      payload: any;
      headers: Record<string, string>;
      metadata?: Record<string, any>;
    },
    options: WebhookEnqueueOptions = {}
  ): Promise<string> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const jobData: WebhookJobData = {
      eventId: eventData.eventId,
      eventType: eventData.eventType,
      actorRunId: eventData.actorRunId,
      payload: eventData.payload,
      headers: eventData.headers,
      metadata: eventData.metadata,
      retryCount: 0,
      originalTimestamp: new Date().toISOString(),
    };

    try {
      const job = await queueManager.addJob(QueueName.WEBHOOK_PROCESSING, {
        id: uuidv4(),
        type: 'webhook-processing',
        payload: jobData,
        priority: options.priority || this.getEventPriority(eventData.eventType),
        delay: options.delay || 0,
        attempts: options.attempts || 3,
      });

      if (!job) {
        throw new Error('Failed to create webhook job');
      }

      logger.info(`Webhook job enqueued successfully`, {
        jobId: job.id,
        eventId: eventData.eventId,
        eventType: eventData.eventType,
        actorRunId: eventData.actorRunId,
        priority: options.priority || this.getEventPriority(eventData.eventType),
      });

      return job.id!;

    } catch (error) {
      logger.error('Failed to enqueue webhook job', {
        eventId: eventData.eventId,
        eventType: eventData.eventType,
        actorRunId: eventData.actorRunId,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  async enqueueRetryJob(
    originalJobData: WebhookJobData,
    retryDelay: number = 5000
  ): Promise<string> {
    const retryJobData: WebhookJobData = {
      ...originalJobData,
      retryCount: (originalJobData.retryCount || 0) + 1,
    };

    const job = await queueManager.addJob(QueueName.WEBHOOK_PROCESSING, {
      id: uuidv4(),
      type: 'webhook-retry',
      payload: retryJobData,
      priority: JobPriority.HIGH, // Retries get higher priority
      delay: retryDelay,
      attempts: 2, // Fewer attempts for retries
    });

    if (!job) {
      throw new Error('Failed to create webhook retry job');
    }

    logger.info(`Webhook retry job enqueued`, {
      jobId: job.id,
      eventId: retryJobData.eventId,
      retryCount: retryJobData.retryCount,
      delay: retryDelay,
    });

    return job.id!;
  }

  async enqueueDeadLetterProcessing(
    deadLetterData: {
      eventId: string;
      originalEventType: string;
      failureReason: string;
      attempts: number;
      lastError: string;
    }
  ): Promise<string> {
    const job = await queueManager.addJob(QueueName.WEBHOOK_PROCESSING, {
      id: uuidv4(),
      type: 'dead-letter-processing',
      payload: deadLetterData,
      priority: JobPriority.LOW,
      attempts: 1, // Dead letter processing only gets one attempt
    });

    if (!job) {
      throw new Error('Failed to create dead letter processing job');
    }

    logger.warn(`Dead letter processing job enqueued`, {
      jobId: job.id,
      eventId: deadLetterData.eventId,
      originalEventType: deadLetterData.originalEventType,
      attempts: deadLetterData.attempts,
    });

    return job.id!;
  }

  private getEventPriority(eventType: string): JobPriority {
    switch (eventType) {
      case 'ACTOR.RUN.SUCCEEDED':
        return JobPriority.HIGH; // Success events are high priority
      case 'ACTOR.RUN.FAILED':
      case 'ACTOR.RUN.ABORTED':
      case 'ACTOR.RUN.TIMED_OUT':
        return JobPriority.NORMAL; // Failure events are normal priority
      default:
        return JobPriority.LOW;
    }
  }

  async getQueueStats(): Promise<{
    queueName: string;
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: number;
    totalJobs: number;
    avgProcessingTime: number;
    throughput: number;
  }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return await queueManager.getQueueMetrics(QueueName.WEBHOOK_PROCESSING);
  }

  async pauseWebhookProcessing(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    await queueManager.pauseQueue(QueueName.WEBHOOK_PROCESSING);
    logger.info('Webhook processing queue paused');
  }

  async resumeWebhookProcessing(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    await queueManager.resumeQueue(QueueName.WEBHOOK_PROCESSING);
    logger.info('Webhook processing queue resumed');
  }

  async getFailedJobs(limit: number = 10): Promise<any[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const queue = queueManager.getQueue(QueueName.WEBHOOK_PROCESSING);
    if (!queue) {
      throw new Error('Webhook processing queue not found');
    }

    const failedJobs = await queue.getFailed(0, limit - 1);
    return failedJobs.map(job => ({
      id: job.id,
      data: job.data,
      failedReason: job.failedReason,
      finishedOn: job.finishedOn,
      processedOn: job.processedOn,
      attemptsMade: job.attemptsMade,
    }));
  }

  async retryFailedJob(jobId: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const queue = queueManager.getQueue(QueueName.WEBHOOK_PROCESSING);
    if (!queue) {
      throw new Error('Webhook processing queue not found');
    }

    const job = await queue.getJob(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    await job.retry();
    logger.info(`Manually retried webhook job ${jobId}`);
  }

  async cleanupOldJobs(olderThanHours: number = 24): Promise<{
    removedCompleted: number;
    removedFailed: number;
  }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const queue = queueManager.getQueue(QueueName.WEBHOOK_PROCESSING);
    if (!queue) {
      throw new Error('Webhook processing queue not found');
    }

    const olderThanMs = olderThanHours * 60 * 60 * 1000;
    const cutoffTime = Date.now() - olderThanMs;

    const [removedCompleted, removedFailed] = await Promise.all([
      queue.clean(cutoffTime, 0, 'completed'),
      queue.clean(cutoffTime, 0, 'failed'),
    ]);

    logger.info(`Cleaned up old webhook jobs`, {
      removedCompleted,
      removedFailed,
      olderThanHours,
    });

    return { removedCompleted, removedFailed };
  }

  isReady(): boolean {
    return this.isInitialized && queueManager.isReady();
  }
}

// Export singleton instance
export const webhookWorkerManager = new WebhookWorkerManager();