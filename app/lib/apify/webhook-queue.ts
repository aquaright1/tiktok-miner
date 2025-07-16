import { EventEmitter } from 'events';
import { prisma } from '@/lib/prisma';

interface QueueJob {
  id: string;
  webhookEventId: string;
  scheduledFor: Date;
  priority: number;
  attempts: number;
}

/**
 * Simple in-memory queue for webhook processing
 * In production, consider using a proper queue like BullMQ, RabbitMQ, or AWS SQS
 */
export class WebhookQueue extends EventEmitter {
  private queue: Map<string, QueueJob>;
  private processingJobs: Set<string>;
  private timers: Map<string, NodeJS.Timeout>;
  private isProcessing: boolean;
  private maxConcurrent: number;

  constructor(maxConcurrent: number = 5) {
    super();
    this.queue = new Map();
    this.processingJobs = new Set();
    this.timers = new Map();
    this.isProcessing = false;
    this.maxConcurrent = maxConcurrent;
  }

  /**
   * Add a webhook to the queue for immediate processing
   */
  async enqueue(webhookEventId: string, priority: number = 0): Promise<void> {
    const job: QueueJob = {
      id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      webhookEventId,
      scheduledFor: new Date(),
      priority,
      attempts: 0
    };

    this.queue.set(job.id, job);
    this.emit('job:added', job);

    // Start processing if not already running
    if (!this.isProcessing) {
      this.startProcessing();
    }
  }

  /**
   * Schedule a webhook for retry at a specific time
   */
  async scheduleRetry(webhookEventId: string, retryAt: Date): Promise<void> {
    const job: QueueJob = {
      id: `retry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      webhookEventId,
      scheduledFor: retryAt,
      priority: -1, // Lower priority for retries
      attempts: 0
    };

    this.queue.set(job.id, job);

    // Set a timer to process this job
    const delay = retryAt.getTime() - Date.now();
    if (delay > 0) {
      const timer = setTimeout(() => {
        this.emit('job:ready', job);
        if (!this.isProcessing) {
          this.startProcessing();
        }
      }, delay);

      this.timers.set(job.id, timer);
    } else {
      // Process immediately if the time has passed
      this.emit('job:ready', job);
      if (!this.isProcessing) {
        this.startProcessing();
      }
    }
  }

  /**
   * Start processing jobs from the queue
   */
  private async startProcessing(): Promise<void> {
    if (this.isProcessing) return;
    
    this.isProcessing = true;

    while (this.queue.size > 0 || this.processingJobs.size > 0) {
      // Wait if we're at max concurrent jobs
      if (this.processingJobs.size >= this.maxConcurrent) {
        await this.waitForSlot();
        continue;
      }

      // Get next job to process
      const job = this.getNextJob();
      if (!job) {
        // No jobs ready to process
        if (this.processingJobs.size === 0) {
          break;
        }
        await this.waitForSlot();
        continue;
      }

      // Process the job
      this.processJob(job);
    }

    this.isProcessing = false;
  }

  /**
   * Get the next job that's ready to process
   */
  private getNextJob(): QueueJob | null {
    const now = new Date();
    let nextJob: QueueJob | null = null;
    let highestPriority = -Infinity;

    for (const job of this.queue.values()) {
      if (job.scheduledFor <= now && job.priority > highestPriority) {
        nextJob = job;
        highestPriority = job.priority;
      }
    }

    if (nextJob) {
      this.queue.delete(nextJob.id);
      this.clearTimer(nextJob.id);
    }

    return nextJob;
  }

  /**
   * Process a single job
   */
  private async processJob(job: QueueJob): Promise<void> {
    this.processingJobs.add(job.id);
    this.emit('job:started', job);

    try {
      job.attempts++;

      // Get the webhook event
      const webhookEvent = await prisma.webhookEvent.findUnique({
        where: { id: job.webhookEventId }
      });

      if (!webhookEvent) {
        throw new Error(`Webhook event ${job.webhookEventId} not found`);
      }

      // Process the webhook (this would call the actual handler)
      this.emit('webhook:process', webhookEvent);

      // Mark job as completed
      this.emit('job:completed', job);

    } catch (error) {
      console.error(`Error processing job ${job.id}:`, error);
      this.emit('job:failed', job, error);

      // Requeue if under max attempts
      if (job.attempts < 3) {
        const retryDelay = Math.pow(2, job.attempts) * 60000; // Exponential backoff
        const retryAt = new Date(Date.now() + retryDelay);
        await this.scheduleRetry(job.webhookEventId, retryAt);
      }
    } finally {
      this.processingJobs.delete(job.id);
      this.emit('job:finished', job);
    }
  }

  /**
   * Wait for a processing slot to become available
   */
  private async waitForSlot(): Promise<void> {
    return new Promise((resolve) => {
      const checkSlot = () => {
        if (this.processingJobs.size < this.maxConcurrent) {
          resolve();
        } else {
          setTimeout(checkSlot, 100);
        }
      };
      setTimeout(checkSlot, 100);
    });
  }

  /**
   * Clear a timer
   */
  private clearTimer(jobId: string): void {
    const timer = this.timers.get(jobId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(jobId);
    }
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    queueSize: number;
    processingCount: number;
    scheduledCount: number;
  } {
    const now = new Date();
    let scheduledCount = 0;

    for (const job of this.queue.values()) {
      if (job.scheduledFor > now) {
        scheduledCount++;
      }
    }

    return {
      queueSize: this.queue.size,
      processingCount: this.processingJobs.size,
      scheduledCount
    };
  }

  /**
   * Clear all jobs from the queue
   */
  clear(): void {
    // Clear all timers
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }

    this.queue.clear();
    this.timers.clear();
    this.emit('queue:cleared');
  }

  /**
   * Gracefully shutdown the queue
   */
  async shutdown(): Promise<void> {
    this.emit('queue:shutdown');

    // Stop accepting new jobs
    this.clear();

    // Wait for processing jobs to complete
    while (this.processingJobs.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.removeAllListeners();
  }
}

/**
 * Global webhook queue instance
 * This ensures we have a single queue across the application
 */
let globalQueue: WebhookQueue | null = null;

export function getWebhookQueue(): WebhookQueue {
  if (!globalQueue) {
    globalQueue = new WebhookQueue();
    
    // Set up event listeners
    globalQueue.on('job:failed', (job, error) => {
      console.error(`Webhook job ${job.id} failed:`, error);
    });

    globalQueue.on('job:completed', (job) => {
      console.log(`Webhook job ${job.id} completed successfully`);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('Shutting down webhook queue...');
      if (globalQueue) {
        await globalQueue.shutdown();
      }
    });
  }

  return globalQueue;
}

/**
 * Background job to process retry queue
 * This should be called periodically (e.g., every minute)
 */
export async function processRetryQueue(): Promise<void> {
  const webhooks = await prisma.webhookEvent.findMany({
    where: {
      status: 'pending',
      nextRetryAt: { lte: new Date() },
      attempts: { lt: 3 }
    },
    orderBy: { nextRetryAt: 'asc' },
    take: 10
  });

  const queue = getWebhookQueue();

  for (const webhook of webhooks) {
    await queue.enqueue(webhook.id, -webhook.attempts); // Lower priority for retries
  }
}

/**
 * Monitor dead letter queue
 */
export async function monitorDeadLetterQueue(): Promise<{
  count: number;
  oldestWebhook?: Date;
}> {
  const deadLetterCount = await prisma.webhookEvent.count({
    where: { status: 'dead_letter' }
  });

  const oldestWebhook = await prisma.webhookEvent.findFirst({
    where: { status: 'dead_letter' },
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true }
  });

  return {
    count: deadLetterCount,
    oldestWebhook: oldestWebhook?.createdAt
  };
}