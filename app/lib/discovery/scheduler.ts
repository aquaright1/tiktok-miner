import * as cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { QueueConfig } from './queue-config';
import { JobType, JobPriority, ScheduledJob } from './types';
import { logger } from '../logger';

export class DiscoveryScheduler {
  private scheduledTasks: Map<string, cron.ScheduledTask> = new Map();
  private db: PrismaClient;
  private queueConfig: QueueConfig;

  constructor(db: PrismaClient, queueConfig: QueueConfig) {
    this.db = db;
    this.queueConfig = queueConfig;
  }

  /**
   * Initialize all scheduled jobs
   */
  async initialize(): Promise<void> {
    logger.info('Initializing discovery scheduler...');

    // Schedule hourly trending discovery
    this.scheduleJob({
      id: 'trending-discovery',
      name: 'Discover Trending Creators',
      cronExpression: '0 * * * *', // Every hour
      jobType: JobType.DISCOVER_TRENDING,
      enabled: true,
      nextRun: this.getNextRunTime('0 * * * *'),
      config: {
        platforms: ['instagram', 'tiktok', 'twitter', 'youtube'],
        limit: 50,
      },
    });

    // Schedule daily category exploration
    this.scheduleJob({
      id: 'category-exploration',
      name: 'Explore Categories for New Creators',
      cronExpression: '0 2 * * *', // Daily at 2 AM
      jobType: JobType.EXPLORE_CATEGORY,
      enabled: true,
      nextRun: this.getNextRunTime('0 2 * * *'),
      config: {
        categories: [
          'lifestyle', 'fashion', 'beauty', 'fitness', 'food',
          'travel', 'tech', 'gaming', 'education', 'business',
        ],
        creatorsPerCategory: 20,
      },
    });

    // Schedule weekly deep discovery
    this.scheduleJob({
      id: 'deep-discovery',
      name: 'Deep Discovery Run',
      cronExpression: '0 3 * * 0', // Weekly on Sunday at 3 AM
      jobType: JobType.DISCOVER_TRENDING,
      enabled: true,
      nextRun: this.getNextRunTime('0 3 * * 0'),
      config: {
        mode: 'deep',
        includeRelated: true,
        maxDepth: 3,
      },
    });

    // Schedule daily refresh of existing creators
    this.scheduleJob({
      id: 'creator-refresh',
      name: 'Refresh Existing Creators',
      cronExpression: '0 4 * * *', // Daily at 4 AM
      jobType: JobType.REFRESH_EXISTING,
      enabled: true,
      nextRun: this.getNextRunTime('0 4 * * *'),
      config: {
        batchSize: 100,
        priorityTiers: ['platinum', 'gold'],
        maxAge: 7, // Days since last update
      },
    });

    logger.info('Discovery scheduler initialized with 4 scheduled jobs');
  }

  /**
   * Schedule a job
   */
  private scheduleJob(job: ScheduledJob): void {
    if (!job.enabled) {
      logger.info(`Job ${job.id} is disabled, skipping`);
      return;
    }

    if (!cron.validate(job.cronExpression)) {
      logger.error(`Invalid cron expression for job ${job.id}: ${job.cronExpression}`);
      return;
    }

    const task = cron.schedule(
      job.cronExpression,
      async () => {
        await this.executeScheduledJob(job);
      },
      {
        scheduled: true,
        timezone: process.env.TZ || 'UTC',
      }
    );

    this.scheduledTasks.set(job.id, task);
    logger.info(`Scheduled job: ${job.name} (${job.cronExpression})`);
  }

  /**
   * Execute a scheduled job
   */
  private async executeScheduledJob(job: ScheduledJob): Promise<void> {
    logger.info(`Executing scheduled job: ${job.name}`, {
      jobId: job.id,
      jobType: job.jobType,
    });

    try {
      switch (job.jobType) {
        case JobType.DISCOVER_TRENDING:
          await this.executeTrendingDiscovery(job.config);
          break;

        case JobType.EXPLORE_CATEGORY:
          await this.executeCategoryExploration(job.config);
          break;

        case JobType.REFRESH_EXISTING:
          await this.executeCreatorRefresh(job.config);
          break;

        default:
          logger.warn(`Unknown job type: ${job.jobType}`);
      }

      // Update last run time
      job.lastRun = new Date();
      job.nextRun = this.getNextRunTime(job.cronExpression);

      logger.info(`Scheduled job completed: ${job.name}`);
    } catch (error) {
      logger.error(`Scheduled job failed: ${job.name}`, error);
    }
  }

  /**
   * Execute trending discovery
   */
  private async executeTrendingDiscovery(config: any): Promise<void> {
    const { platforms = [], limit = 50, mode = 'standard' } = config;

    for (const platform of platforms) {
      try {
        // Get trending topics for platform
        const trendingTopics = await this.getTrendingTopics(platform, limit);

        // Queue discovery jobs for each topic
        for (const topic of trendingTopics) {
          await this.queueConfig.addJob(
            'creator-discovery',
            JobType.DISCOVER_TRENDING,
            {
              platform,
              topic: topic.topic,
              volume: topic.volume,
              mode,
            },
            JobPriority.HIGH
          );
        }

        logger.info(`Queued ${trendingTopics.length} trending topics for ${platform}`);
      } catch (error) {
        logger.error(`Failed to discover trending for ${platform}`, error);
      }
    }
  }

  /**
   * Execute category exploration
   */
  private async executeCategoryExploration(config: any): Promise<void> {
    const { categories = [], creatorsPerCategory = 20 } = config;

    for (const category of categories) {
      await this.queueConfig.addJob(
        'creator-discovery',
        JobType.EXPLORE_CATEGORY,
        {
          category,
          limit: creatorsPerCategory,
        },
        JobPriority.NORMAL
      );
    }

    logger.info(`Queued ${categories.length} categories for exploration`);
  }

  /**
   * Execute creator refresh
   */
  private async executeCreatorRefresh(config: any): Promise<void> {
    const { batchSize = 100, priorityTiers = [], maxAge = 7 } = config;

    // Find creators that need refresh
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAge);

    const creators = await this.db.creatorProfile.findMany({
      where: {
        OR: [
          { lastSync: { lt: cutoffDate } },
          { lastSync: null },
        ],
        aggregatedData: priorityTiers.length > 0 ? {
          path: ['compositeScore', 'tier'],
          in: priorityTiers,
        } : undefined,
      },
      select: {
        id: true,
        username: true,
        platform: true,
      },
      take: batchSize,
    });

    // Queue refresh jobs
    for (const creator of creators) {
      await this.queueConfig.addJob(
        'creator-discovery',
        JobType.REFRESH_EXISTING,
        {
          creatorId: creator.id,
          username: creator.username,
          platform: creator.platform,
        },
        JobPriority.LOW
      );
    }

    logger.info(`Queued ${creators.length} creators for refresh`);
  }

  /**
   * Get trending topics (mock implementation - replace with actual API calls)
   */
  private async getTrendingTopics(platform: string, limit: number): Promise<any[]> {
    // This would be replaced with actual API calls to get trending topics
    // For now, return mock data
    const mockTopics = [
      { topic: '#fitness', volume: 1000000, growth: 15 },
      { topic: '#cooking', volume: 800000, growth: 10 },
      { topic: '#tech', volume: 750000, growth: 20 },
      { topic: '#fashion', volume: 900000, growth: 5 },
      { topic: '#travel', volume: 650000, growth: 12 },
    ];

    return mockTopics.slice(0, limit).map(topic => ({
      ...topic,
      platform,
      timestamp: new Date(),
      relatedHashtags: [],
    }));
  }

  /**
   * Get next run time for cron expression
   */
  private getNextRunTime(cronExpression: string): Date {
    const interval = cron.schedule(cronExpression, () => {}, { scheduled: false });
    const pattern = (interval as any).cronExpression;
    return new Date(pattern.next().toISOString());
  }

  /**
   * Start all scheduled tasks
   */
  start(): void {
    for (const [id, task] of this.scheduledTasks) {
      task.start();
      logger.info(`Started scheduled task: ${id}`);
    }
  }

  /**
   * Stop all scheduled tasks
   */
  stop(): void {
    for (const [id, task] of this.scheduledTasks) {
      task.stop();
      logger.info(`Stopped scheduled task: ${id}`);
    }
  }

  /**
   * Get status of all scheduled jobs
   */
  getStatus(): ScheduledJob[] {
    const jobs: ScheduledJob[] = [];
    
    // Add predefined jobs with their current status
    const jobConfigs = [
      {
        id: 'trending-discovery',
        name: 'Discover Trending Creators',
        cronExpression: '0 * * * *',
        jobType: JobType.DISCOVER_TRENDING,
      },
      {
        id: 'category-exploration',
        name: 'Explore Categories for New Creators',
        cronExpression: '0 2 * * *',
        jobType: JobType.EXPLORE_CATEGORY,
      },
      {
        id: 'deep-discovery',
        name: 'Deep Discovery Run',
        cronExpression: '0 3 * * 0',
        jobType: JobType.DISCOVER_TRENDING,
      },
      {
        id: 'creator-refresh',
        name: 'Refresh Existing Creators',
        cronExpression: '0 4 * * *',
        jobType: JobType.REFRESH_EXISTING,
      },
    ];

    for (const config of jobConfigs) {
      jobs.push({
        ...config,
        enabled: this.scheduledTasks.has(config.id),
        nextRun: this.getNextRunTime(config.cronExpression),
      });
    }

    return jobs;
  }
}