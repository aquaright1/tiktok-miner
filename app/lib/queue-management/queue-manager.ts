import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { QueueConfig, QueueHealth, QueueMetrics, QueueName, JobData } from './types';
import { logger } from '@/lib/logger';

export class QueueManager {
  private queues: Map<QueueName, Queue> = new Map();
  private workers: Map<QueueName, Worker> = new Map();
  private redis: IORedis;
  private isInitialized = false;

  constructor() {
    this.redis = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      enableReadyCheck: false,
      maxRetriesPerRequest: null,
    });
  }

  async initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      // Test Redis connection
      await this.redis.ping();
      logger.info('Redis connection established for queue management');

      // Initialize default queues
      await this.createQueue(QueueName.SCRAPING, {
        name: QueueName.SCRAPING,
        concurrency: parseInt(process.env.QUEUE_CONCURRENCY || '5'),
        maxRetries: parseInt(process.env.QUEUE_MAX_RETRIES || '3'),
        retryDelay: parseInt(process.env.QUEUE_DELAY_ON_FAILURE || '5000'),
        removeOnComplete: 100,
        removeOnFail: 50,
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 50,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
        },
      });

      await this.createQueue(QueueName.DISCOVERY, {
        name: QueueName.DISCOVERY,
        concurrency: 3,
        maxRetries: 3,
        retryDelay: 10000,
        removeOnComplete: 50,
        removeOnFail: 25,
        defaultJobOptions: {
          removeOnComplete: 50,
          removeOnFail: 25,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 10000,
          },
        },
      });

      await this.createQueue(QueueName.CREATOR_SYNC, {
        name: QueueName.CREATOR_SYNC,
        concurrency: 5,
        maxRetries: 2,
        retryDelay: 3000,
        removeOnComplete: 200,
        removeOnFail: 100,
        defaultJobOptions: {
          removeOnComplete: 200,
          removeOnFail: 100,
          attempts: 2,
          backoff: {
            type: 'exponential',
            delay: 3000,
          },
        },
      });

      await this.createQueue(QueueName.WEBHOOK_PROCESSING, {
        name: QueueName.WEBHOOK_PROCESSING,
        concurrency: parseInt(process.env.WEBHOOK_WORKER_CONCURRENCY || '5'),
        maxRetries: 3,
        retryDelay: 5000,
        removeOnComplete: 100,
        removeOnFail: 50,
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 50,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
        },
      });

      this.isInitialized = true;
      logger.info('Queue manager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize queue manager:', error);
      throw error;
    }
  }

  private async createQueue(name: QueueName, config: QueueConfig) {
    const queue = new Queue(name, {
      connection: this.redis,
      defaultJobOptions: config.defaultJobOptions,
    });

    this.queues.set(name, queue);
    logger.info(`Queue '${name}' created successfully`);
  }

  async addJob(queueName: QueueName, jobData: JobData): Promise<Job | null> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue '${queueName}' not found`);
    }

    try {
      const job = await queue.add(jobData.type, jobData.payload, {
        priority: jobData.priority || 5,
        delay: jobData.delay || 0,
        attempts: jobData.attempts || 3,
        removeOnComplete: 100,
        removeOnFail: 50,
      });

      logger.info(`Job added to queue '${queueName}':`, {
        jobId: job.id,
        type: jobData.type,
        priority: jobData.priority,
      });

      return job;
    } catch (error) {
      logger.error(`Failed to add job to queue '${queueName}':`, error);
      throw error;
    }
  }

  async getQueueMetrics(queueName: QueueName): Promise<QueueMetrics> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue '${queueName}' not found`);
    }

    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaiting(),
        queue.getActive(),
        queue.getCompleted(),
        queue.getFailed(),
        queue.getDelayed(),
      ]);
      
      // Get paused status separately
      const isPaused = await queue.isPaused();
      const paused = isPaused ? 1 : 0;

      const totalJobs = waiting.length + active.length + completed.length + failed.length;
      
      // Calculate average processing time from recent completed jobs
      let avgProcessingTime = 0;
      if (completed.length > 0) {
        const processingTimes = completed
          .slice(-10) // Last 10 jobs
          .map(job => job.finishedOn! - job.processedOn!)
          .filter(time => time > 0);
        
        if (processingTimes.length > 0) {
          avgProcessingTime = processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length;
        }
      }

      // Calculate throughput (jobs per minute)
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      const recentCompleted = completed.filter(job => job.finishedOn! > oneHourAgo);
      const throughput = recentCompleted.length;

      return {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        delayed: delayed.length,
        paused: paused.length,
        totalJobs,
        avgProcessingTime,
        throughput,
        lastProcessedAt: completed.length > 0 ? new Date(completed[0].finishedOn!) : undefined,
      };
    } catch (error) {
      logger.error(`Failed to get metrics for queue '${queueName}':`, error);
      throw error;
    }
  }

  async getHealthStatus(): Promise<QueueHealth[]> {
    const healthStatuses: QueueHealth[] = [];

    for (const [queueName, queue] of this.queues) {
      try {
        const metrics = await this.getQueueMetrics(queueName);
        const status = this.determineHealthStatus(metrics);
        const errors = this.getHealthErrors(metrics);

        healthStatuses.push({
          queueName,
          status,
          metrics,
          errors,
          lastCheck: new Date(),
        });
      } catch (error) {
        healthStatuses.push({
          queueName,
          status: 'unhealthy',
          metrics: {
            waiting: 0,
            active: 0,
            completed: 0,
            failed: 0,
            delayed: 0,
            paused: 0,
            totalJobs: 0,
            avgProcessingTime: 0,
            throughput: 0,
          },
          errors: [`Failed to get metrics: ${error.message}`],
          lastCheck: new Date(),
        });
      }
    }

    return healthStatuses;
  }

  private determineHealthStatus(metrics: QueueMetrics): 'healthy' | 'degraded' | 'unhealthy' {
    const failureRate = metrics.completed > 0 ? metrics.failed / metrics.completed : 0;
    
    // Unhealthy conditions
    if (failureRate > 0.5) {
      return 'unhealthy';
    }
    
    if (metrics.active === 0 && metrics.waiting > 1000) {
      return 'unhealthy';
    }
    
    // Degraded conditions
    if (failureRate > 0.2) {
      return 'degraded';
    }
    
    if (metrics.avgProcessingTime > 120000) { // > 2 minutes
      return 'degraded';
    }
    
    if (metrics.active === 0 && metrics.waiting > 100) {
      return 'degraded';
    }
    
    return 'healthy';
  }

  private getHealthErrors(metrics: QueueMetrics): string[] {
    const errors: string[] = [];
    const failureRate = metrics.completed > 0 ? metrics.failed / metrics.completed : 0;
    
    if (failureRate > 0.2) {
      errors.push(`High failure rate: ${(failureRate * 100).toFixed(2)}%`);
    }
    
    if (metrics.active === 0 && metrics.waiting > 100) {
      errors.push('Jobs backing up, no active processing');
    }
    
    if (metrics.avgProcessingTime > 120000) {
      errors.push(`Slow processing time: ${Math.round(metrics.avgProcessingTime / 1000)}s average`);
    }
    
    return errors;
  }

  async pauseQueue(queueName: QueueName): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue '${queueName}' not found`);
    }

    await queue.pause();
    logger.info(`Queue '${queueName}' paused`);
  }

  async resumeQueue(queueName: QueueName): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue '${queueName}' not found`);
    }

    await queue.resume();
    logger.info(`Queue '${queueName}' resumed`);
  }

  async cleanup(): Promise<void> {
    logger.info('Cleaning up queue manager...');
    
    // Close all workers
    for (const [name, worker] of this.workers) {
      await worker.close();
      logger.info(`Worker '${name}' closed`);
    }
    
    // Close all queues
    for (const [name, queue] of this.queues) {
      await queue.close();
      logger.info(`Queue '${name}' closed`);
    }
    
    // Close Redis connection
    this.redis.disconnect();
    logger.info('Redis connection closed');
  }

  getQueue(queueName: QueueName): Queue | undefined {
    return this.queues.get(queueName);
  }

  isReady(): boolean {
    return this.isInitialized;
  }
}

// Singleton instance
export const queueManager = new QueueManager();