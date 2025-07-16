import { PrismaClient } from '@prisma/client';
import { 
  PlatformAPIFactory, 
  Platform,
  CreatorProfile as APICreatorProfile,
  Post,
  EngagementMetrics,
} from '../platform-api';
import { CreatorSyncQueue } from './queue';
import {
  JobType,
  JobPriority,
  JobStatus,
  DiscoveryOptions,
  SyncOptions,
  CreatorSyncResult,
  SyncSchedule,
} from './types';
import { logger } from '../logger';

export class CreatorSyncService {
  private db: PrismaClient;
  private queue: CreatorSyncQueue;
  private syncSchedules: Map<string, SyncSchedule> = new Map();

  constructor(db: PrismaClient) {
    this.db = db;
    this.queue = new CreatorSyncQueue({
      concurrency: 5,
      pollInterval: 1000,
      maxRetries: 3,
    });

    this.setupQueueHandlers();
  }

  private setupQueueHandlers(): void {
    this.queue.on('job:execute', async (job) => {
      try {
        switch (job.type) {
          case JobType.DISCOVER_CREATORS:
            job.result = await this.executeDiscovery(job.data);
            break;
          case JobType.SYNC_CREATOR_PROFILE:
            job.result = await this.executeSyncProfile(job.data);
            break;
          case JobType.SYNC_CREATOR_POSTS:
            job.result = await this.executeSyncPosts(job.data);
            break;
          case JobType.CALCULATE_ENGAGEMENT:
            job.result = await this.executeCalculateEngagement(job.data);
            break;
          default:
            throw new Error(`Unknown job type: ${job.type}`);
        }
      } catch (error) {
        throw error;
      }
    });

    this.queue.on('job:completed', (job) => {
      logger.info(`Job completed: ${job.type}`, { jobId: job.id });
    });

    this.queue.on('job:failed', (job) => {
      logger.error(`Job failed: ${job.type}`, { 
        jobId: job.id, 
        error: job.error 
      });
    });
  }

  async start(): Promise<void> {
    await this.queue.start();
    logger.info('Creator sync service started');
  }

  async stop(): Promise<void> {
    await this.queue.stop();
    logger.info('Creator sync service stopped');
  }

  async discoverCreators(options: DiscoveryOptions): Promise<string> {
    const jobId = await this.queue.addJob(
      JobType.DISCOVER_CREATORS,
      options,
      JobPriority.NORMAL
    );
    return jobId;
  }

  async syncCreatorProfile(
    creatorId: string, 
    priority: JobPriority = JobPriority.NORMAL
  ): Promise<string> {
    const syncOptions: SyncOptions = {
      creatorId,
      includeRecentPosts: true,
      postsLimit: 20,
    };

    const jobId = await this.queue.addJob(
      JobType.SYNC_CREATOR_PROFILE,
      syncOptions,
      priority
    );

    return jobId;
  }

  async scheduleCreatorSync(
    creatorId: string,
    priority: JobPriority
  ): Promise<void> {
    const syncIntervalHours = this.getSyncInterval(priority);
    const nextSyncAt = new Date();
    nextSyncAt.setHours(nextSyncAt.getHours() + syncIntervalHours);

    const schedule: SyncSchedule = {
      creatorId,
      priority,
      nextSyncAt,
      syncIntervalHours,
    };

    this.syncSchedules.set(creatorId, schedule);

    // Schedule the job
    await this.queue.addJob(
      JobType.SYNC_CREATOR_PROFILE,
      { creatorId, includeRecentPosts: true },
      priority,
      nextSyncAt
    );
  }

  private getSyncInterval(priority: JobPriority): number {
    switch (priority) {
      case JobPriority.HIGH:
        return 4; // 4 hours for hot creators
      case JobPriority.NORMAL:
        return 24; // Daily for normal creators
      case JobPriority.LOW:
        return 168; // Weekly for cold creators
      default:
        return 24;
    }
  }

  private async executeDiscovery(
    options: DiscoveryOptions
  ): Promise<APICreatorProfile[]> {
    logger.info('Executing creator discovery', options);
    
    // For now, we'll implement a simple discovery based on trending
    // In a real implementation, this would use platform-specific trending APIs
    const discoveredCreators: APICreatorProfile[] = [];
    
    try {
      // This is a placeholder - real implementation would:
      // 1. Use platform trending APIs
      // 2. Search by hashtags
      // 3. Filter by follower count
      // 4. Check if creators already exist in DB
      
      // For each discovered creator, create a candidate and creator profile
      for (const creator of discoveredCreators) {
        await this.createCreatorFromDiscovery(creator, options.platform);
      }
      
      return discoveredCreators;
    } catch (error) {
      logger.error('Discovery failed', error);
      throw error;
    }
  }

  private async createCreatorFromDiscovery(
    profile: APICreatorProfile,
    platform: Platform
  ): Promise<void> {
    // Check if creator already exists
    const existingCandidate = await this.db.candidate.findFirst({
      where: {
        creatorProfile: {
          platform,
          username: profile.username,
        },
      },
    });

    if (existingCandidate) {
      logger.info(`Creator already exists: ${profile.username}`);
      return;
    }

    // Create new candidate and creator profile
    await this.db.candidate.create({
      data: {
        candidateType: 'CREATOR',
        status: 'new',
        creatorProfile: {
          create: {
            platform,
            username: profile.username,
            followerCount: profile.followerCount,
            engagementRate: 0,
            profileData: profile as any,
          },
        },
      },
    });

    logger.info(`Created new creator: ${profile.username}`);
  }

  private async executeSyncProfile(
    options: SyncOptions
  ): Promise<CreatorSyncResult> {
    const { creatorId, includeRecentPosts = true, postsLimit = 20 } = options;
    
    logger.info(`Syncing creator profile: ${creatorId}`);

    // Get creator from database
    const creator = await this.db.creatorProfile.findUnique({
      where: { id: creatorId },
      include: { candidate: true },
    });

    if (!creator) {
      throw new Error(`Creator not found: ${creatorId}`);
    }

    // Get platform API service
    const apiService = PlatformAPIFactory.createFromEnv(
      creator.platform as Platform
    );

    try {
      // Fetch updated profile data
      const profile = await apiService.getProfile(creator.username);
      
      let engagementMetrics: EngagementMetrics | null = null;
      let posts: Post[] = [];

      // Fetch recent posts if requested
      if (includeRecentPosts) {
        const postsResponse = await apiService.getRecentPosts(
          creator.username,
          postsLimit
        );
        posts = postsResponse.data;
        engagementMetrics = await apiService.calculateEngagement(posts);
      }

      // Update creator profile
      const updatedCreator = await this.db.creatorProfile.update({
        where: { id: creatorId },
        data: {
          followerCount: profile.followerCount,
          engagementRate: engagementMetrics?.averageEngagementRate || creator.engagementRate,
          profileData: profile as any,
          metrics: engagementMetrics as any,
          lastSync: new Date(),
        },
      });

      const result: CreatorSyncResult = {
        creatorId,
        platform: creator.platform as Platform,
        username: creator.username,
        followerCount: profile.followerCount,
        engagementRate: engagementMetrics?.averageEngagementRate || 0,
        postsAnalyzed: posts.length,
        lastSyncAt: new Date(),
        profileData: profile,
        metrics: engagementMetrics,
      };

      // Schedule next sync based on priority
      const schedule = this.syncSchedules.get(creatorId);
      if (schedule) {
        await this.scheduleCreatorSync(creatorId, schedule.priority);
      }

      logger.info(`Creator sync completed: ${creator.username}`, {
        followerCount: profile.followerCount,
        engagementRate: result.engagementRate,
        postsAnalyzed: posts.length,
      });

      return result;
    } catch (error) {
      logger.error(`Failed to sync creator: ${creator.username}`, error);
      throw error;
    }
  }

  private async executeSyncPosts(options: any): Promise<any> {
    // Implementation for syncing just posts without profile
    // This would be used for more frequent post updates
    logger.info('Syncing creator posts', options);
    return { success: true };
  }

  private async executeCalculateEngagement(options: any): Promise<any> {
    // Implementation for recalculating engagement metrics
    // This could be run periodically to update metrics
    logger.info('Calculating engagement metrics', options);
    return { success: true };
  }

  async getQueueStats() {
    return this.queue.getStats();
  }

  async clearCompletedJobs(): Promise<number> {
    return this.queue.clearCompleted();
  }
}