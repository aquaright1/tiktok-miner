import { Queue, Worker, QueueEvents } from 'bullmq';
import Redis from 'ioredis';
import { logger } from '../logger';
import { JobType, JobPriority, QueueMetrics } from './types';

export class QueueConfig {
  private redis: Redis;
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, Worker> = new Map();
  private queueEvents: Map<string, QueueEvents> = new Map();

  constructor() {
    // Initialize Redis connection
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    this.redis.on('error', (error) => {
      logger.error('Redis connection error:', error);
    });

    this.redis.on('connect', () => {
      logger.info('Redis connected successfully');
    });
  }

  /**
   * Create a new queue with configuration
   */
  createQueue(name: string, options?: any): Queue {
    if (this.queues.has(name)) {
      return this.queues.get(name)!;
    }

    const queue = new Queue(name, {
      connection: this.redis,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          age: 24 * 3600, // 24 hours
          count: 1000, // Keep last 1000 completed jobs
        },
        removeOnFail: {
          age: 7 * 24 * 3600, // 7 days
        },
      },
      ...options,
    });

    this.queues.set(name, queue);

    // Create queue events for monitoring
    const queueEvents = new QueueEvents(name, {
      connection: this.redis,
    });
    this.queueEvents.set(name, queueEvents);

    return queue;
  }

  /**
   * Create a worker for processing jobs
   */
  createWorker(
    queueName: string,
    processor: (job: any) => Promise<any>,
    options?: any
  ): Worker {
    if (this.workers.has(queueName)) {
      return this.workers.get(queueName)!;
    }

    const worker = new Worker(
      queueName,
      async (job) => {
        const startTime = Date.now();
        try {
          logger.info(`Processing job ${job.id} of type ${job.name}`, {
            queueName,
            jobId: job.id,
            jobType: job.name,
            attempts: job.attemptsMade,
          });

          const result = await processor(job);

          const processingTime = Date.now() - startTime;
          logger.info(`Job ${job.id} completed in ${processingTime}ms`, {
            queueName,
            jobId: job.id,
            jobType: job.name,
            processingTime,
          });

          return result;
        } catch (error) {
          const processingTime = Date.now() - startTime;
          logger.error(`Job ${job.id} failed after ${processingTime}ms`, {
            queueName,
            jobId: job.id,
            jobType: job.name,
            error: error instanceof Error ? error.message : String(error),
            processingTime,
          });
          throw error;
        }
      },
      {
        connection: this.redis,
        concurrency: 5,
        ...options,
      }
    );

    // Set up worker event handlers
    worker.on('completed', (job) => {
      logger.debug(`Job ${job.id} completed`, {
        queueName,
        jobId: job.id,
        jobType: job.name,
      });
    });

    worker.on('failed', (job, err) => {
      logger.error(`Job ${job?.id} failed`, {
        queueName,
        jobId: job?.id,
        jobType: job?.name,
        error: err.message,
        stack: err.stack,
      });
    });

    worker.on('error', (err) => {
      logger.error(`Worker error in queue ${queueName}`, {
        error: err.message,
        stack: err.stack,
      });
    });

    this.workers.set(queueName, worker);
    return worker;
  }

  /**
   * Get queue metrics
   */
  async getQueueMetrics(queueName: string): Promise<QueueMetrics> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const [
      pendingCount,
      activeCount,
      completedCount,
      failedCount,
      delayedCount,
    ] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    // Calculate processing rate and average time
    const recentJobs = await queue.getCompleted(0, 100);
    let totalProcessingTime = 0;
    let processedInLastMinute = 0;
    const oneMinuteAgo = Date.now() - 60000;

    for (const job of recentJobs) {
      if (job.finishedOn && job.processedOn) {
        totalProcessingTime += job.finishedOn - job.processedOn;
        if (job.finishedOn > oneMinuteAgo) {
          processedInLastMinute++;
        }
      }
    }

    const averageProcessingTime = recentJobs.length > 0
      ? totalProcessingTime / recentJobs.length
      : 0;

    const errorRate = completedCount + failedCount > 0
      ? (failedCount / (completedCount + failedCount)) * 100
      : 0;

    return {
      pending: pendingCount,
      active: activeCount,
      completed: completedCount,
      failed: failedCount,
      delayed: delayedCount,
      processingRate: processedInLastMinute,
      averageProcessingTime,
      errorRate,
      lastProcessedAt: recentJobs[0]?.finishedOn
        ? new Date(recentJobs[0].finishedOn)
        : undefined,
    };
  }

  /**
   * Add a job to queue with priority
   */
  async addJob(
    queueName: string,
    jobType: JobType,
    data: any,
    priority: JobPriority = JobPriority.NORMAL,
    options?: any
  ): Promise<string> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const job = await queue.add(jobType, data, {
      priority,
      ...options,
    });

    logger.info(`Job ${job.id} added to queue ${queueName}`, {
      queueName,
      jobId: job.id,
      jobType,
      priority,
    });

    return job.id!;
  }

  /**
   * Pause/resume queue processing
   */
  async pauseQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (queue) {
      await queue.pause();
      logger.info(`Queue ${queueName} paused`);
    }
  }

  async resumeQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (queue) {
      await queue.resume();
      logger.info(`Queue ${queueName} resumed`);
    }
  }

  /**
   * Clean up old jobs
   */
  async cleanQueue(queueName: string, grace: number = 0): Promise<void> {
    const queue = this.queues.get(queueName);
    if (queue) {
      await queue.clean(grace, 1000, 'completed');
      await queue.clean(grace, 1000, 'failed');
      logger.info(`Queue ${queueName} cleaned`);
    }
  }

  /**
   * Gracefully shutdown all queues and workers
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down queue system...');

    // Close all workers
    for (const [name, worker] of this.workers) {
      await worker.close();
      logger.info(`Worker ${name} closed`);
    }

    // Close all queue events
    for (const [name, events] of this.queueEvents) {
      await events.close();
      logger.info(`Queue events ${name} closed`);
    }

    // Close all queues
    for (const [name, queue] of this.queues) {
      await queue.close();
      logger.info(`Queue ${name} closed`);
    }

    // Close Redis connection
    this.redis.disconnect();
    logger.info('Redis disconnected');
  }

  /**
   * Get all queues
   */
  getQueues(): Map<string, Queue> {
    return this.queues;
  }

  /**
   * Get Redis connection
   */
  getRedisConnection(): Redis {
    return this.redis;
  }
}