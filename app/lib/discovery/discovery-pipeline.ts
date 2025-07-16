import { Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { QueueConfig } from './queue-config';
import { DiscoveryScheduler } from './scheduler';
import { TrendingDiscovery } from './trending-discovery';
import { CreatorEvaluator } from './creator-evaluator';
import { DuplicateDetector } from './duplicate-detector';
import { DataAggregationEngine } from '../aggregation';
import { 
  JobType, 
  JobPriority,
  CreatorDiscoveryData,
  TrendingTopic,
  DiscoveryReport,
} from './types';
import { logger } from '../logger';

export class DiscoveryPipeline {
  private db: PrismaClient;
  private queueConfig: QueueConfig;
  private scheduler: DiscoveryScheduler;
  private trendingDiscovery: TrendingDiscovery;
  private evaluator: CreatorEvaluator;
  private duplicateDetector: DuplicateDetector;
  private aggregationEngine: DataAggregationEngine;
  private isRunning: boolean = false;

  constructor(db: PrismaClient) {
    this.db = db;
    this.queueConfig = new QueueConfig();
    this.scheduler = new DiscoveryScheduler(db, this.queueConfig);
    this.trendingDiscovery = new TrendingDiscovery();
    this.evaluator = new CreatorEvaluator(db);
    this.duplicateDetector = new DuplicateDetector(db);
    this.aggregationEngine = new DataAggregationEngine(db);

    this.setupQueues();
  }

  /**
   * Setup all queues and workers
   */
  private setupQueues(): void {
    // Create main discovery queue
    this.queueConfig.createQueue('creator-discovery');

    // Create worker for discovery queue
    this.queueConfig.createWorker(
      'creator-discovery',
      this.processDiscoveryJob.bind(this),
      { concurrency: 5 }
    );

    // Create evaluation queue
    this.queueConfig.createQueue('creator-evaluation');

    // Create worker for evaluation queue
    this.queueConfig.createWorker(
      'creator-evaluation',
      this.processEvaluationJob.bind(this),
      { concurrency: 10 }
    );

    // Create aggregation queue
    this.queueConfig.createQueue('creator-aggregation');

    // Create worker for aggregation queue
    this.queueConfig.createWorker(
      'creator-aggregation',
      this.processAggregationJob.bind(this),
      { concurrency: 3 }
    );
  }

  /**
   * Start the discovery pipeline
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Discovery pipeline is already running');
      return;
    }

    logger.info('Starting discovery pipeline...');
    
    // Initialize scheduler
    await this.scheduler.initialize();
    this.scheduler.start();

    this.isRunning = true;
    logger.info('Discovery pipeline started successfully');
  }

  /**
   * Stop the discovery pipeline
   */
  async stop(): Promise<void> {
    logger.info('Stopping discovery pipeline...');
    
    this.scheduler.stop();
    await this.queueConfig.shutdown();
    
    this.isRunning = false;
    logger.info('Discovery pipeline stopped');
  }

  /**
   * Process discovery job
   */
  private async processDiscoveryJob(job: Job): Promise<any> {
    const { type, data } = job.data;

    switch (type) {
      case JobType.DISCOVER_TRENDING:
        return this.processTrendingDiscovery(data);
      
      case JobType.EXPLORE_CATEGORY:
        return this.processCategoryExploration(data);
      
      case JobType.REFRESH_EXISTING:
        return this.processCreatorRefresh(data);
      
      default:
        throw new Error(`Unknown discovery job type: ${type}`);
    }
  }

  /**
   * Process trending discovery
   */
  private async processTrendingDiscovery(data: any): Promise<any> {
    const { platform, topic, mode } = data;

    logger.info(`Processing trending discovery for ${platform} - ${topic}`);

    // Create trending topic object
    const trendingTopic: TrendingTopic = {
      topic,
      platform,
      volume: data.volume || 0,
      growth: data.growth || 0,
      relatedHashtags: [],
      timestamp: new Date(),
    };

    // Search for creators
    const creators = await this.trendingDiscovery.searchCreatorsByTopic(
      trendingTopic,
      50
    );

    // Queue evaluation jobs
    let queued = 0;
    for (const creator of creators) {
      // Check for duplicates first
      const duplicateCheck = await this.duplicateDetector.checkDuplicate(creator);
      
      if (!duplicateCheck.isDuplicate) {
        await this.queueConfig.addJob(
          'creator-evaluation',
          JobType.EVALUATE_CREATOR,
          creator,
          JobPriority.HIGH
        );
        queued++;
      }
    }

    logger.info(`Queued ${queued} creators for evaluation from trending topic ${topic}`);

    return {
      topic,
      platform,
      creatorsFound: creators.length,
      creatorsQueued: queued,
    };
  }

  /**
   * Process category exploration
   */
  private async processCategoryExploration(data: any): Promise<any> {
    const { category, limit = 20 } = data;

    logger.info(`Exploring category: ${category}`);

    // For each platform, search the category
    const platforms = ['instagram', 'tiktok', 'twitter'];
    const allCreators: CreatorDiscoveryData[] = [];

    for (const platform of platforms) {
      // Create a category-based topic
      const topic: TrendingTopic = {
        topic: category,
        platform: platform as any,
        volume: 0,
        growth: 0,
        relatedHashtags: [`#${category}`],
        timestamp: new Date(),
      };

      const creators = await this.trendingDiscovery.searchCreatorsByTopic(
        topic,
        Math.ceil(limit / platforms.length)
      );

      allCreators.push(...creators);
    }

    // Queue for evaluation
    let queued = 0;
    for (const creator of allCreators) {
      const duplicateCheck = await this.duplicateDetector.checkDuplicate(creator);
      
      if (!duplicateCheck.isDuplicate) {
        await this.queueConfig.addJob(
          'creator-evaluation',
          JobType.EVALUATE_CREATOR,
          creator,
          JobPriority.NORMAL
        );
        queued++;
      }
    }

    return {
      category,
      creatorsFound: allCreators.length,
      creatorsQueued: queued,
    };
  }

  /**
   * Process creator refresh
   */
  private async processCreatorRefresh(data: any): Promise<any> {
    const { creatorId, username, platform } = data;

    logger.info(`Refreshing creator: ${username} (${creatorId})`);

    try {
      // Run aggregation to refresh all data
      const aggregatedData = await this.aggregationEngine.aggregateCreatorData(
        creatorId,
        { includeHistoricalData: false }
      );

      return {
        creatorId,
        username,
        success: true,
        newScore: aggregatedData.compositeScore.overallScore,
        lastUpdated: new Date(),
      };
    } catch (error) {
      logger.error(`Failed to refresh creator ${creatorId}`, error);
      throw error;
    }
  }

  /**
   * Process evaluation job
   */
  private async processEvaluationJob(job: Job): Promise<any> {
    const creatorData: CreatorDiscoveryData = job.data;

    logger.info(`Evaluating creator: ${creatorData.identifier} on ${creatorData.platform}`);

    // Evaluate creator
    const evaluation = await this.evaluator.evaluateCreator(creatorData);

    // Handle based on recommendation
    if (evaluation.recommendation === 'add') {
      // Add creator to database
      const newCreator = await this.addCreatorToDatabase(creatorData, evaluation);
      
      // Queue for aggregation
      await this.queueConfig.addJob(
        'creator-aggregation',
        JobType.AGGREGATE_DATA,
        { creatorId: newCreator.id },
        JobPriority.NORMAL
      );

      return {
        action: 'added',
        creatorId: newCreator.id,
        qualityScore: evaluation.qualityScore,
      };
    } else if (evaluation.recommendation === 'monitor') {
      // Add to monitoring list (could be a separate table)
      await this.addToMonitoringList(creatorData, evaluation);
      
      return {
        action: 'monitoring',
        qualityScore: evaluation.qualityScore,
      };
    } else {
      return {
        action: 'rejected',
        qualityScore: evaluation.qualityScore,
        reasons: evaluation.reasons,
      };
    }
  }

  /**
   * Process aggregation job
   */
  private async processAggregationJob(job: Job): Promise<any> {
    const { creatorId } = job.data;

    logger.info(`Aggregating data for creator: ${creatorId}`);

    const aggregatedData = await this.aggregationEngine.aggregateCreatorData(
      creatorId,
      { analyzeContentThemes: true }
    );

    return {
      creatorId,
      score: aggregatedData.compositeScore.overallScore,
      tier: aggregatedData.compositeScore.tier,
    };
  }

  /**
   * Add creator to database
   */
  private async addCreatorToDatabase(
    data: CreatorDiscoveryData,
    evaluation: any
  ): Promise<any> {
    return await this.db.creatorProfile.create({
      data: {
        platform: data.platform,
        username: data.identifier,
        followerCount: evaluation.metrics.followerCount,
        engagementRate: evaluation.metrics.engagementRate,
        profileData: {
          discoverySource: data.discoverySource,
          evaluationScore: evaluation.qualityScore,
          metrics: evaluation.metrics,
        },
        candidate: {
          create: {
            candidateType: 'CREATOR',
            status: 'new',
          },
        },
      },
    });
  }

  /**
   * Add creator to monitoring list
   */
  private async addToMonitoringList(
    data: CreatorDiscoveryData,
    evaluation: any
  ): Promise<void> {
    // This could be a separate table or a status on the creator
    // For now, log it
    logger.info(`Added to monitoring: ${data.identifier} on ${data.platform}`, {
      qualityScore: evaluation.qualityScore,
      reasons: evaluation.reasons,
    });
  }

  /**
   * Get pipeline status
   */
  async getStatus(): Promise<{
    isRunning: boolean;
    queues: any;
    scheduledJobs: any;
  }> {
    const queueMetrics = await Promise.all(
      ['creator-discovery', 'creator-evaluation', 'creator-aggregation'].map(
        async (queueName) => ({
          name: queueName,
          metrics: await this.queueConfig.getQueueMetrics(queueName),
        })
      )
    );

    return {
      isRunning: this.isRunning,
      queues: queueMetrics,
      scheduledJobs: this.scheduler.getStatus(),
    };
  }

  /**
   * Generate discovery report
   */
  async generateReport(
    startDate: Date,
    endDate: Date
  ): Promise<DiscoveryReport> {
    const creators = await this.db.creatorProfile.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        id: true,
        platform: true,
        profileData: true,
        aggregatedData: true,
        createdAt: true,
      },
    });

    // Calculate statistics
    const platformBreakdown: Record<string, number> = {};
    const sourceBreakdown: Map<string, number> = new Map();
    let totalQualityScore = 0;
    let scoredCreators = 0;

    for (const creator of creators) {
      // Platform breakdown
      platformBreakdown[creator.platform] = 
        (platformBreakdown[creator.platform] || 0) + 1;

      // Source breakdown
      const source = (creator.profileData as any)?.discoverySource?.type || 'unknown';
      sourceBreakdown.set(source, (sourceBreakdown.get(source) || 0) + 1);

      // Quality scores
      const score = (creator.profileData as any)?.evaluationScore;
      if (score) {
        totalQualityScore += score;
        scoredCreators++;
      }
    }

    // Calculate trends
    const previousPeriodStart = new Date(startDate);
    previousPeriodStart.setDate(
      previousPeriodStart.getDate() - (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    const previousCreators = await this.db.creatorProfile.count({
      where: {
        createdAt: {
          gte: previousPeriodStart,
          lt: startDate,
        },
      },
    });

    const currentCount = creators.length;
    const discoveryRate = currentCount / ((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const growthRate = previousCreators > 0 
      ? ((currentCount - previousCreators) / previousCreators) * 100 
      : 100;

    return {
      period: { start: startDate, end: endDate },
      stats: {
        creatorsDiscovered: currentCount,
        creatorsAdded: currentCount, // Adjust based on actual logic
        creatorsRejected: 0, // Would need to track this separately
        platformBreakdown: platformBreakdown as any,
        topSources: Array.from(sourceBreakdown.entries())
          .map(([source, count]) => ({ source, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5),
        averageQualityScore: scoredCreators > 0 ? totalQualityScore / scoredCreators : 0,
      },
      trends: {
        discoveryRate,
        acceptanceRate: 100, // Would need to track rejections
        growthRate,
      },
    };
  }
}