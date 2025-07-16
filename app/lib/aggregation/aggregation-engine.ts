import { PrismaClient } from '@prisma/client';
import { 
  AggregatedCreatorData,
  AggregationOptions,
  PlatformData,
  CreatorInsights,
  NormalizedMetrics,
  CompositeScore
} from './types';
import { Platform } from '../platform-api/types';
import { PlatformAPIFactory } from '../platform-api/factory';
import { DataNormalizer } from './data-normalizer';
import { CompositeScorer } from './composite-scorer';
import { ContentAnalyzer } from './content-analyzer';
import { logger } from '../logger';
import { APIUsageTracker } from '../services/api-usage-tracker';

export class DataAggregationEngine {
  private db: PrismaClient;
  private normalizer: DataNormalizer;
  private scorer: CompositeScorer;
  private contentAnalyzer: ContentAnalyzer;
  private apiTracker: APIUsageTracker;

  constructor(db: PrismaClient) {
    this.db = db;
    this.normalizer = new DataNormalizer();
    this.scorer = new CompositeScorer();
    this.contentAnalyzer = new ContentAnalyzer();
    this.apiTracker = new APIUsageTracker(db);
  }

  async aggregateCreatorData(
    creatorId: string,
    options: AggregationOptions = {}
  ): Promise<AggregatedCreatorData> {
    try {
      logger.info(`Starting data aggregation for creator: ${creatorId}`);

      // Fetch creator from database
      const creator = await this.db.creatorProfile.findUnique({
        where: { id: creatorId },
        include: { 
          candidate: true,
          platformProfiles: true,
        },
      });

      if (!creator) {
        throw new Error(`Creator not found: ${creatorId}`);
      }

      // Collect data from all platforms
      const platformsData = await this.collectPlatformData(creator, options);

      if (platformsData.length === 0) {
        throw new Error('No platform data available for aggregation');
      }

      // Normalize metrics across platforms
      const normalizedMetrics = this.normalizer.normalizeData(platformsData);

      // Calculate composite score
      const compositeScore = this.scorer.calculateCompositeScore(
        normalizedMetrics,
        platformsData
      );

      // Analyze content and generate insights
      const { themes, insights } = options.analyzeContentThemes !== false
        ? this.contentAnalyzer.analyzeContent(platformsData)
        : { themes: [], insights: {} };

      // Combine insights
      const creatorInsights: CreatorInsights = {
        strongestPlatform: insights.strongestPlatform || platformsData[0].platform,
        contentThemes: insights.contentThemes || [],
        audienceOverlap: insights.audienceOverlap || 0,
        recommendedActions: insights.recommendedActions || [],
        potentialReach: normalizedMetrics.totalReach,
        estimatedValue: insights.estimatedValue || {
          sponsorshipRange: { min: 0, max: 0 },
          currency: 'USD',
          confidence: 0,
        },
      };

      // Save aggregated data
      const aggregatedData: AggregatedCreatorData = {
        creatorId,
        platforms: platformsData,
        normalizedMetrics,
        compositeScore,
        insights: creatorInsights,
        lastAggregated: new Date(),
      };

      await this.saveAggregatedData(aggregatedData);

      logger.info(`Aggregation completed for creator: ${creatorId}`, {
        platforms: platformsData.length,
        score: compositeScore.overallScore,
        tier: compositeScore.tier,
      });

      return aggregatedData;
    } catch (error) {
      logger.error(`Aggregation failed for creator: ${creatorId}`, error);
      throw error;
    }
  }

  private async collectPlatformData(
    creator: any,
    options: AggregationOptions
  ): Promise<PlatformData[]> {
    const platformsData: PlatformData[] = [];
    const platforms = options.platforms || this.getCreatorPlatforms(creator);

    for (const platform of platforms) {
      try {
        const data = await this.fetchPlatformData(creator, platform);
        if (data) {
          platformsData.push(data);
        }
      } catch (error) {
        logger.error(`Failed to fetch data for platform ${platform}`, error);
        // Continue with other platforms
      }
    }

    return platformsData;
  }

  private getCreatorPlatforms(creator: any): Platform[] {
    const platforms: Platform[] = [];
    
    // Check main platform
    if (creator.platform) {
      platforms.push(creator.platform as Platform);
    }

    // Check platform profiles
    if (creator.platformProfiles) {
      for (const profile of creator.platformProfiles) {
        if (profile.platform && !platforms.includes(profile.platform as Platform)) {
          platforms.push(profile.platform as Platform);
        }
      }
    }

    // If no platforms found, try to infer from stored data
    if (platforms.length === 0 && creator.profileData) {
      const profileData = creator.profileData as any;
      if (profileData.platform) {
        platforms.push(profileData.platform as Platform);
      }
    }

    return platforms;
  }

  private async fetchPlatformData(
    creator: any,
    platform: Platform
  ): Promise<PlatformData | null> {
    try {
      // Get platform-specific username
      const username = this.getCreatorUsername(creator, platform);
      if (!username) {
        logger.warn(`No username found for creator ${creator.id} on ${platform}`);
        return null;
      }

      // Create API service
      const apiService = PlatformAPIFactory.createFromEnv(platform);

      // Track API usage
      const startTime = Date.now();

      // Fetch profile
      const profile = await this.apiTracker.trackRequest(
        platform,
        'profile',
        async () => apiService.getProfile(username),
        { creatorId: creator.id }
      );

      // Fetch recent posts
      const postsResponse = await this.apiTracker.trackRequest(
        platform,
        'posts',
        async () => apiService.getRecentPosts(username, 50),
        { creatorId: creator.id }
      );

      const posts = postsResponse.data;

      // Calculate engagement metrics
      const metrics = await apiService.calculateEngagement(posts);

      const platformData: PlatformData = {
        platform,
        profile,
        posts,
        metrics,
        lastUpdated: new Date(),
      };

      // Track request duration
      const duration = Date.now() - startTime;
      logger.info(`Fetched ${platform} data for ${username}`, {
        posts: posts.length,
        engagementRate: metrics.averageEngagementRate,
        duration,
      });

      return platformData;
    } catch (error) {
      logger.error(`Failed to fetch ${platform} data`, error);
      throw error;
    }
  }

  private getCreatorUsername(creator: any, platform: Platform): string | null {
    // Check platform profiles first
    if (creator.platformProfiles) {
      const profile = creator.platformProfiles.find(
        (p: any) => p.platform === platform
      );
      if (profile?.username) {
        return profile.username;
      }
    }

    // Check if main platform matches
    if (creator.platform === platform && creator.username) {
      return creator.username;
    }

    // Check stored profile data
    if (creator.profileData) {
      const profileData = creator.profileData as any;
      if (profileData.platform === platform && profileData.username) {
        return profileData.username;
      }
    }

    return null;
  }

  private async saveAggregatedData(data: AggregatedCreatorData): Promise<void> {
    try {
      // Update creator profile with aggregated metrics
      await this.db.creatorProfile.update({
        where: { id: data.creatorId },
        data: {
          engagementRate: data.normalizedMetrics.averageEngagementRate,
          followerCount: data.normalizedMetrics.totalReach,
          metrics: data.normalizedMetrics as any,
          aggregatedData: {
            compositeScore: data.compositeScore,
            insights: data.insights,
            platforms: data.platforms.map(p => ({
              platform: p.platform,
              followers: p.profile.followerCount,
              engagement: p.metrics.averageEngagementRate,
              posts: p.posts.length,
            })),
          } as any,
          lastSync: new Date(),
        },
      });

      // Store detailed platform data if needed
      for (const platformData of data.platforms) {
        await this.updatePlatformProfile(data.creatorId, platformData);
      }

      logger.info(`Saved aggregated data for creator: ${data.creatorId}`);
    } catch (error) {
      logger.error('Failed to save aggregated data', error);
      throw error;
    }
  }

  private async updatePlatformProfile(
    creatorId: string,
    platformData: PlatformData
  ): Promise<void> {
    // This would update or create platform-specific profile data
    // Implementation depends on your database schema
    try {
      const existingProfile = await this.db.platformProfile.findFirst({
        where: {
          creatorProfileId: creatorId,
          platform: platformData.platform,
        },
      });

      const profileData = {
        platform: platformData.platform,
        username: platformData.profile.username,
        followerCount: platformData.profile.followerCount,
        followingCount: platformData.profile.followingCount,
        postCount: platformData.profile.postCount,
        engagementRate: platformData.metrics.averageEngagementRate,
        profileData: platformData.profile as any,
        metrics: platformData.metrics as any,
        lastSync: new Date(),
      };

      if (existingProfile) {
        await this.db.platformProfile.update({
          where: { id: existingProfile.id },
          data: profileData,
        });
      } else {
        await this.db.platformProfile.create({
          data: {
            ...profileData,
            creatorProfileId: creatorId,
          },
        });
      }
    } catch (error) {
      logger.warn(`Failed to update platform profile for ${platformData.platform}`, error);
      // Don't throw - this is not critical
    }
  }

  // Batch aggregation methods

  async aggregateMultipleCreators(
    creatorIds: string[],
    options: AggregationOptions = {}
  ): Promise<Map<string, AggregatedCreatorData>> {
    const results = new Map<string, AggregatedCreatorData>();
    
    // Process in batches to avoid overwhelming APIs
    const batchSize = 5;
    for (let i = 0; i < creatorIds.length; i += batchSize) {
      const batch = creatorIds.slice(i, i + batchSize);
      const batchPromises = batch.map(id => 
        this.aggregateCreatorData(id, options)
          .then(data => results.set(id, data))
          .catch(error => {
            logger.error(`Failed to aggregate creator ${id}`, error);
            // Continue with other creators
          })
      );

      await Promise.all(batchPromises);
    }

    return results;
  }

  async aggregateCreatorsByTier(
    tier: string,
    options: AggregationOptions = {}
  ): Promise<Map<string, AggregatedCreatorData>> {
    // Find creators in the specified tier
    const creators = await this.db.creatorProfile.findMany({
      where: {
        aggregatedData: {
          path: ['compositeScore', 'tier'],
          equals: tier,
        },
      },
      select: { id: true },
    });

    const creatorIds = creators.map(c => c.id);
    return this.aggregateMultipleCreators(creatorIds, options);
  }

  // Analysis methods

  async compareCreators(
    creatorIds: string[]
  ): Promise<{
    creators: AggregatedCreatorData[];
    comparison: {
      bestOverall: string;
      bestEngagement: string;
      bestReach: string;
      bestGrowth: string;
      mostConsistent: string;
    };
  }> {
    const aggregatedData = await this.aggregateMultipleCreators(creatorIds);
    const creators = Array.from(aggregatedData.values());

    if (creators.length === 0) {
      throw new Error('No creators found for comparison');
    }

    const comparison = {
      bestOverall: this.findBestByMetric(creators, c => c.compositeScore.overallScore),
      bestEngagement: this.findBestByMetric(creators, c => c.normalizedMetrics.averageEngagementRate),
      bestReach: this.findBestByMetric(creators, c => c.normalizedMetrics.totalReach),
      bestGrowth: this.findBestByMetric(creators, c => c.normalizedMetrics.growthRate),
      mostConsistent: this.findBestByMetric(creators, c => c.normalizedMetrics.contentConsistency),
    };

    return { creators, comparison };
  }

  private findBestByMetric(
    creators: AggregatedCreatorData[],
    metricFn: (c: AggregatedCreatorData) => number
  ): string {
    let bestCreator = creators[0];
    let bestValue = metricFn(creators[0]);

    for (const creator of creators.slice(1)) {
      const value = metricFn(creator);
      if (value > bestValue) {
        bestValue = value;
        bestCreator = creator;
      }
    }

    return bestCreator.creatorId;
  }
}