import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { 
  Job, 
  JobType, 
  JobPriority, 
  JobStatus, 
  QueueStats 
} from './types';
import { logger } from '../logger';

export interface QueueOptions {
  concurrency?: number;
  pollInterval?: number;
  maxRetries?: number;
}

export class CreatorSyncQueue extends EventEmitter {
  private jobs: Map<string, Job> = new Map();
  private processing: Set<string> = new Set();
  private concurrency: number;
  private pollInterval: number;
  private maxRetries: number;
  private isRunning: boolean = false;
  private pollTimer?: NodeJS.Timeout;

  constructor(options: QueueOptions = {}) {
    super();
    this.concurrency = options.concurrency || 5;
    this.pollInterval = options.pollInterval || 1000;
    this.maxRetries = options.maxRetries || 3;
  }

  async addJob(
    type: JobType,
    data: any,
    priority: JobPriority = JobPriority.NORMAL,
    scheduledFor?: Date
  ): Promise<string> {
    const job: Job = {
      id: uuidv4(),
      type,
      priority,
      status: JobStatus.PENDING,
      data,
      attempts: 0,
      maxAttempts: this.maxRetries,
      createdAt: new Date(),
      updatedAt: new Date(),
      scheduledFor,
    };

    this.jobs.set(job.id, job);
    this.emit('job:added', job);
    
    logger.info(`Job added to queue: ${job.id}`, {
      type: job.type,
      priority: job.priority,
      scheduled: job.scheduledFor,
    });

    return job.id;
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Queue is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting creator sync queue');
    this.poll();
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = undefined;
    }
    logger.info('Stopping creator sync queue');
  }

  private async poll(): Promise<void> {
    if (!this.isRunning) return;

    try {
      await this.processJobs();
    } catch (error) {
      logger.error('Error in queue poll cycle:', error);
    }

    this.pollTimer = setTimeout(() => this.poll(), this.pollInterval);
  }

  private async processJobs(): Promise<void> {
    const availableSlots = this.concurrency - this.processing.size;
    if (availableSlots <= 0) return;

    const pendingJobs = this.getPendingJobs();
    const jobsToProcess = pendingJobs.slice(0, availableSlots);

    for (const job of jobsToProcess) {
      this.processJob(job);
    }
  }

  private getPendingJobs(): Job[] {
    const now = new Date();
    const pendingJobs = Array.from(this.jobs.values())
      .filter(job => 
        job.status === JobStatus.PENDING &&
        (!job.scheduledFor || job.scheduledFor <= now)
      )
      .sort((a, b) => {
        // Sort by priority first, then by creation time
        if (a.priority !== b.priority) {
          return a.priority - b.priority;
        }
        return a.createdAt.getTime() - b.createdAt.getTime();
      });

    return pendingJobs;
  }

  private async processJob(job: Job): Promise<void> {
    this.processing.add(job.id);
    job.status = JobStatus.PROCESSING;
    job.processedAt = new Date();
    job.attempts++;
    this.updateJob(job);

    try {
      logger.info(`Processing job: ${job.id}`, {
        type: job.type,
        attempt: job.attempts,
      });

      const result = await this.executeJob(job);
      
      job.status = JobStatus.COMPLETED;
      job.result = result;
      job.completedAt = new Date();
      this.updateJob(job);
      
      this.emit('job:completed', job);
      logger.info(`Job completed: ${job.id}`);
    } catch (error) {
      logger.error(`Job failed: ${job.id}`, error);
      
      if (job.attempts >= job.maxAttempts) {
        job.status = JobStatus.FAILED;
        job.error = error instanceof Error ? error.message : 'Unknown error';
        this.emit('job:failed', job);
      } else {
        job.status = JobStatus.RETRYING;
        job.scheduledFor = this.calculateRetryDelay(job.attempts);
        this.emit('job:retry', job);
      }
      
      this.updateJob(job);
    } finally {
      this.processing.delete(job.id);
    }
  }

  private async executeJob(job: Job): Promise<any> {
    // This will be overridden or extended by the CreatorSyncService
    this.emit('job:execute', job);
    return job;
  }

  private updateJob(job: Job): void {
    job.updatedAt = new Date();
    this.jobs.set(job.id, job);
  }

  private calculateRetryDelay(attempt: number): Date {
    // Exponential backoff: 2^attempt seconds
    const delaySeconds = Math.pow(2, attempt);
    const delay = new Date();
    delay.setSeconds(delay.getSeconds() + delaySeconds);
    return delay;
  }

  getJob(jobId: string): Job | undefined {
    return this.jobs.get(jobId);
  }

  getStats(): QueueStats {
    const jobs = Array.from(this.jobs.values());
    const stats = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      totalProcessingTime: 0,
      completedCount: 0,
    };

    for (const job of jobs) {
      switch (job.status) {
        case JobStatus.PENDING:
          stats.pending++;
          break;
        case JobStatus.PROCESSING:
          stats.processing++;
          break;
        case JobStatus.COMPLETED:
          stats.completed++;
          if (job.processedAt && job.completedAt) {
            stats.totalProcessingTime += 
              job.completedAt.getTime() - job.processedAt.getTime();
            stats.completedCount++;
          }
          break;
        case JobStatus.FAILED:
          stats.failed++;
          break;
      }
    }

    const avgProcessingTime = stats.completedCount > 0
      ? stats.totalProcessingTime / stats.completedCount
      : 0;

    const total = stats.completed + stats.failed;
    const successRate = total > 0 ? (stats.completed / total) * 100 : 0;

    return {
      pending: stats.pending,
      processing: stats.processing,
      completed: stats.completed,
      failed: stats.failed,
      avgProcessingTime,
      successRate,
    };
  }

  clearCompleted(): number {
    const completedJobs = Array.from(this.jobs.values())
      .filter(job => job.status === JobStatus.COMPLETED);
    
    for (const job of completedJobs) {
      this.jobs.delete(job.id);
    }

    return completedJobs.length;
  }
}