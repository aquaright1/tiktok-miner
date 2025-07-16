/**
 * QueuedActorManager - Integrates Apify ActorManager with BullMQ queue system
 * Provides queue-based job management, rate limiting, and async processing
 */

import { Job } from 'bullmq';
import { ActorManager, ActorManagerConfig } from './actor-manager';
import { queueManager } from '../queue-management/queue-manager';
import { redisConnectionManager } from '../queue-management/redis-connection';
import { logger } from '../logger';
import {
  QueueName,
  JobPriority,
  ScrapingJobData,
  JobResult,
  isScrapingJob,
} from '../queue-management/types';
import {
  ActorCallResult,
  DatasetItem,
  InstagramScraperInput,
  TikTokScraperInput,
} from './apify-types';
import { processCreatorProfile } from './pipeline';

export interface QueuedActorManagerConfig extends ActorManagerConfig {
  enableRateLimiting?: boolean;
  platformRateLimits?: {
    instagram?: { requestsPerHour: number };
    tiktok?: { requestsPerHour: number };
    youtube?: { requestsPerHour: number };
    twitter?: { requestsPerHour: number };
    linkedin?: { requestsPerHour: number };
  };
}

export interface ScrapingJobResult {
  platform: string;
  runId: string;
  datasetId: string;
  status: string;
  items?: DatasetItem[];
  processedData?: any;
  error?: string;
}

export class QueuedActorManager extends ActorManager {
  private queueConfig: QueuedActorManagerConfig;
  private rateLimiters: Map<string, any> = new Map();

  constructor(config: QueuedActorManagerConfig) {
    super(config);
    this.queueConfig = config;
    
    // Initialize rate limiters if enabled
    if (config.enableRateLimiting) {
      this.initializeRateLimiters();
    }

    // Register the scraping worker
    this.registerScrapingWorker();
  }

  /**
   * Initialize rate limiters for each platform
   */
  private initializeRateLimiters() {
    const platforms = ['instagram', 'tiktok', 'youtube', 'twitter', 'linkedin'];
    
    platforms.forEach(platform => {
      const limit = this.queueConfig.platformRateLimits?.[platform as keyof typeof this.queueConfig.platformRateLimits];
      if (limit) {
        // Using Redis-based rate limiting with sliding window
        const key = `rate-limit:apify:${platform}`;
        this.rateLimiters.set(platform, {
          key,
          limit: limit.requestsPerHour,
          window: 3600000, // 1 hour in milliseconds
        });
      }
    });
  }

  /**
   * Check if rate limit allows a request
   */
  private async checkRateLimit(platform: string): Promise<boolean> {
    if (!this.queueConfig.enableRateLimiting) {
      return true;
    }

    const limiter = this.rateLimiters.get(platform);
    if (!limiter) {
      return true; // No limit configured
    }

    const redis = redisConnectionManager.getConnection('rate-limiter');
    const now = Date.now();
    const windowStart = now - limiter.window;
    
    // Remove old entries
    await redis.zremrangebyscore(limiter.key, '-inf', windowStart);
    
    // Count current entries
    const count = await redis.zcard(limiter.key);
    
    if (count >= limiter.limit) {
      logger.warn(`Rate limit exceeded for ${platform}`, {
        current: count,
        limit: limiter.limit,
      });
      return false;
    }

    // Add current request
    await redis.zadd(limiter.key, now, `${now}-${Math.random()}`);
    await redis.expire(limiter.key, Math.ceil(limiter.window / 1000));
    
    return true;
  }

  /**
   * Register the worker that processes scraping jobs
   */
  private registerScrapingWorker() {
    queueManager.registerWorker<ScrapingJobData>(
      QueueName.SCRAPING,
      async (job: Job<ScrapingJobData>) => {
        return this.processScrapingJob(job);
      },
      {
        concurrency: 5, // Process up to 5 scraping jobs concurrently
      }
    );
  }

  /**
   * Process a scraping job
   */
  private async processScrapingJob(job: Job<ScrapingJobData>): Promise<JobResult<ScrapingJobResult>> {
    const { platform, actorId, input, userId, metadata } = job.data;
    
    try {
      // Check rate limit
      const canProceed = await this.checkRateLimit(platform);
      if (!canProceed) {
        // Delay the job for retry
        await job.moveToDelayed(Date.now() + 300000); // Retry in 5 minutes
        return {
          success: false,
          error: 'Rate limit exceeded, job delayed',
          metadata: { delayed: true },
        };
      }

      logger.info(`Processing scraping job`, {
        jobId: job.id,
        platform,
        userId,
      });

      // Run the actor based on platform
      let result: ActorCallResult;
      
      switch (platform) {
        case 'instagram':
          result = await this.scrapeInstagramProfile(input.username || input.directUrls?.[0], input);
          break;
        case 'tiktok':
          result = await this.scrapeTikTokProfile(input.username || input.profiles?.[0], input);
          break;
        case 'youtube':
          result = await this.scrapeYouTubeChannel(input.channelUrl || input.startUrls?.[0]?.url, input);
          break;
        case 'twitter':
          result = await this.scrapeTwitterProfile(input.username || input.startUrls?.[0]?.url, input);
          break;
        case 'linkedin':
          result = await this.scrapeLinkedInProfile(input.profileUrl || input.startUrls?.[0], input);
          break;
        default:
          throw new Error(`Unsupported platform: ${platform}`);
      }

      // If the actor run is async (webhook-based), return early
      if (!result.datasetId) {
        return {
          success: true,
          data: {
            platform,
            runId: result.runId,
            datasetId: '',
            status: result.status,
          },
          metadata: { async: true, webhookPending: true },
        };
      }

      // Fetch and process the results
      const items = await this.getRunDataset(result.datasetId);
      
      // Process through the transformation pipeline
      const processedItems = await Promise.all(
        items.map(item => processCreatorProfile(platform, item))
      );

      const successfulItems = processedItems.filter(r => r.success);
      const failedItems = processedItems.filter(r => !r.success);

      logger.info(`Scraping job completed`, {
        jobId: job.id,
        platform,
        totalItems: items.length,
        successful: successfulItems.length,
        failed: failedItems.length,
      });

      return {
        success: true,
        data: {
          platform,
          runId: result.runId,
          datasetId: result.datasetId,
          status: result.status,
          items,
          processedData: successfulItems.map(r => r.data),
        },
        metadata: {
          processingTime: Date.now() - job.timestamp,
          itemCount: items.length,
          successCount: successfulItems.length,
          failureCount: failedItems.length,
        },
      };
    } catch (error) {
      logger.error(`Scraping job failed`, {
        jobId: job.id,
        platform,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          platform,
          jobId: job.id,
        },
      };
    }
  }

  /**
   * Queue an Instagram profile scraping job
   */
  async queueInstagramScrape(
    username: string,
    options?: {
      priority?: JobPriority;
      userId?: string;
      input?: Partial<InstagramScraperInput>;
      metadata?: Record<string, any>;
    }
  ): Promise<string> {
    const actorConfig = this.getActorConfigForPlatform('instagram');
    if (!actorConfig) {
      throw new Error('Instagram actor configuration not found');
    }

    const jobData: ScrapingJobData = {
      platform: 'instagram',
      actorId: actorConfig.actorId,
      input: {
        username,
        ...options?.input,
      },
      userId: options?.userId,
      metadata: options?.metadata,
    };

    return queueManager.addJob(
      QueueName.SCRAPING,
      'instagram-profile',
      jobData,
      {
        priority: options?.priority || JobPriority.NORMAL,
      }
    );
  }

  /**
   * Queue a TikTok profile scraping job
   */
  async queueTikTokScrape(
    username: string,
    options?: {
      priority?: JobPriority;
      userId?: string;
      input?: Partial<TikTokScraperInput>;
      metadata?: Record<string, any>;
    }
  ): Promise<string> {
    const actorConfig = this.getActorConfigForPlatform('tiktok');
    if (!actorConfig) {
      throw new Error('TikTok actor configuration not found');
    }

    const jobData: ScrapingJobData = {
      platform: 'tiktok',
      actorId: actorConfig.actorId,
      input: {
        username,
        ...options?.input,
      },
      userId: options?.userId,
      metadata: options?.metadata,
    };

    return queueManager.addJob(
      QueueName.SCRAPING,
      'tiktok-profile',
      jobData,
      {
        priority: options?.priority || JobPriority.NORMAL,
      }
    );
  }

  /**
   * Queue a YouTube channel scraping job
   */
  async queueYouTubeScrape(
    channelUrl: string,
    options?: {
      priority?: JobPriority;
      userId?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<string> {
    const actorConfig = this.getActorConfigForPlatform('youtube');
    if (!actorConfig) {
      throw new Error('YouTube actor configuration not found');
    }

    const jobData: ScrapingJobData = {
      platform: 'youtube',
      actorId: actorConfig.actorId,
      input: {
        channelUrl,
      },
      userId: options?.userId,
      metadata: options?.metadata,
    };

    return queueManager.addJob(
      QueueName.SCRAPING,
      'youtube-channel',
      jobData,
      {
        priority: options?.priority || JobPriority.NORMAL,
      }
    );
  }

  /**
   * Queue a Twitter profile scraping job
   */
  async queueTwitterScrape(
    username: string,
    options?: {
      priority?: JobPriority;
      userId?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<string> {
    const actorConfig = this.getActorConfigForPlatform('twitter');
    if (!actorConfig) {
      throw new Error('Twitter actor configuration not found');
    }

    const jobData: ScrapingJobData = {
      platform: 'twitter',
      actorId: actorConfig.actorId,
      input: {
        username,
      },
      userId: options?.userId,
      metadata: options?.metadata,
    };

    return queueManager.addJob(
      QueueName.SCRAPING,
      'twitter-profile',
      jobData,
      {
        priority: options?.priority || JobPriority.NORMAL,
      }
    );
  }

  /**
   * Queue a LinkedIn profile scraping job
   */
  async queueLinkedInScrape(
    profileUrl: string,
    options?: {
      priority?: JobPriority;
      userId?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<string> {
    const actorConfig = this.getActorConfigForPlatform('linkedin');
    if (!actorConfig) {
      throw new Error('LinkedIn actor configuration not found');
    }

    const jobData: ScrapingJobData = {
      platform: 'linkedin',
      actorId: actorConfig.actorId,
      input: {
        profileUrl,
      },
      userId: options?.userId,
      metadata: options?.metadata,
    };

    return queueManager.addJob(
      QueueName.SCRAPING,
      'linkedin-profile',
      jobData,
      {
        priority: options?.priority || JobPriority.NORMAL,
      }
    );
  }

  /**
   * Queue multiple scraping jobs
   */
  async queueBulkScrape(
    jobs: Array<{
      platform: string;
      identifier: string; // username or URL
      priority?: JobPriority;
      userId?: string;
      metadata?: Record<string, any>;
    }>
  ): Promise<string[]> {
    const bulkJobs = jobs.map(job => {
      const actorConfig = this.getActorConfigForPlatform(job.platform);
      if (!actorConfig) {
        throw new Error(`Actor configuration not found for platform: ${job.platform}`);
      }

      const jobData: ScrapingJobData = {
        platform: job.platform as any,
        actorId: actorConfig.actorId,
        input: {
          username: job.identifier,
          profileUrl: job.identifier,
          channelUrl: job.identifier,
        },
        userId: job.userId,
        metadata: job.metadata,
      };

      return {
        name: `${job.platform}-profile`,
        data: jobData,
        options: {
          priority: job.priority || JobPriority.NORMAL,
        },
      };
    });

    return queueManager.addBulkJobs(QueueName.SCRAPING, bulkJobs);
  }

  /**
   * Get scraping queue metrics
   */
  async getQueueMetrics() {
    return queueManager.getQueueMetrics(QueueName.SCRAPING);
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string) {
    const queue = queueManager.getQueue(QueueName.SCRAPING);
    const job = await queue.getJob(jobId);
    
    if (!job) {
      return null;
    }

    return {
      id: job.id,
      name: job.name,
      data: job.data,
      status: await job.getState(),
      progress: job.progress,
      attempts: job.attemptsMade,
      createdAt: new Date(job.timestamp),
      processedOn: job.processedOn ? new Date(job.processedOn) : undefined,
      finishedOn: job.finishedOn ? new Date(job.finishedOn) : undefined,
      failedReason: job.failedReason,
      returnValue: job.returnvalue,
    };
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    const queue = queueManager.getQueue(QueueName.SCRAPING);
    const job = await queue.getJob(jobId);
    
    if (!job) {
      return false;
    }

    await job.remove();
    return true;
  }

  /**
   * Pause scraping queue
   */
  async pauseQueue(): Promise<void> {
    await queueManager.pauseQueue(QueueName.SCRAPING);
  }

  /**
   * Resume scraping queue
   */
  async resumeQueue(): Promise<void> {
    await queueManager.resumeQueue(QueueName.SCRAPING);
  }

  /**
   * Clean old completed/failed jobs
   */
  async cleanQueue(gracePeriod: number = 86400000): Promise<string[]> {
    return queueManager.cleanQueue(QueueName.SCRAPING, gracePeriod);
  }
}

/**
 * Factory function to create a QueuedActorManager instance
 */
export function createQueuedActorManager(
  config?: Partial<QueuedActorManagerConfig>
): QueuedActorManager {
  const apiKey = config?.apiKey || process.env.APIFY_API_KEY;
  
  if (!apiKey) {
    throw new Error('APIFY_API_KEY is required');
  }

  const defaultConfig: QueuedActorManagerConfig = {
    apiKey,
    baseUrl: config?.baseUrl || 'https://api.apify.com/v2',
    webhookUrl: config?.webhookUrl || process.env.APIFY_WEBHOOK_URL,
    maxRetries: config?.maxRetries || 3,
    requestTimeoutMs: config?.requestTimeoutMs || 60000,
    enableRateLimiting: config?.enableRateLimiting ?? true,
    platformRateLimits: config?.platformRateLimits || {
      instagram: { requestsPerHour: 100 },
      tiktok: { requestsPerHour: 100 },
      youtube: { requestsPerHour: 200 },
      twitter: { requestsPerHour: 150 },
      linkedin: { requestsPerHour: 50 },
    },
  };

  return new QueuedActorManager(defaultConfig);
}