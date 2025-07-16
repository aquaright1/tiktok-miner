import { PlatformAPIService } from './base-service';
import { PlatformAPIFactory } from './factory';
import { 
  Platform, 
  CreatorProfile, 
  Post, 
  EngagementMetrics,
  PlatformAPIConfig,
  PlatformAPIError,
  PlatformAPIResponse,
  RateLimitInfo,
} from './types';
import { logger } from '../logger';

export {
  PlatformAPIService,
  PlatformAPIFactory,
  Platform,
  CreatorProfile,
  Post,
  EngagementMetrics,
  PlatformAPIConfig,
  PlatformAPIError,
  PlatformAPIResponse,
  RateLimitInfo,
};

export class PlatformAPIClient {
  private services: Map<Platform, PlatformAPIService> = new Map();

  constructor(configs?: Map<Platform, PlatformAPIConfig>) {
    if (configs) {
      configs.forEach((config, platform) => {
        this.services.set(platform, PlatformAPIFactory.create(platform, config));
      });
    }
  }

  addService(platform: Platform, config: PlatformAPIConfig): void {
    const service = PlatformAPIFactory.create(platform, config);
    this.services.set(platform, service);
    logger.info(`Added ${platform} service to platform API client`);
  }

  async getCreatorProfile(platform: Platform, username: string): Promise<CreatorProfile> {
    const startTime = Date.now();
    const service = this.getService(platform);
    
    try {
      logger.info(`Fetching ${platform} profile for @${username}`);
      const profile = await service.getProfile(username);
      
      const duration = Date.now() - startTime;
      logger.info(`Successfully fetched ${platform} profile for @${username} in ${duration}ms`, {
        platform,
        username,
        followersCount: profile.followerCount,
        duration,
      });
      
      return profile;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`Failed to fetch ${platform} profile for @${username} after ${duration}ms`, {
        platform,
        username,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });
      throw error;
    }
  }

  async getCreatorPosts(
    platform: Platform, 
    username: string, 
    limit?: number,
    cursor?: string
  ): Promise<PlatformAPIResponse<Post[]>> {
    const startTime = Date.now();
    const service = this.getService(platform);
    
    try {
      logger.info(`Fetching ${platform} posts for @${username}`, { limit, cursor });
      const response = await service.getRecentPosts(username, limit, cursor);
      
      const duration = Date.now() - startTime;
      logger.info(`Successfully fetched ${response.data.length} ${platform} posts for @${username} in ${duration}ms`, {
        platform,
        username,
        postCount: response.data.length,
        hasMore: !!response.nextCursor,
        duration,
      });
      
      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`Failed to fetch ${platform} posts for @${username} after ${duration}ms`, {
        platform,
        username,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });
      throw error;
    }
  }

  async getEngagementMetrics(
    platform: Platform,
    username: string,
    postLimit?: number
  ): Promise<EngagementMetrics> {
    const startTime = Date.now();
    const service = this.getService(platform);
    
    try {
      logger.info(`Calculating engagement metrics for ${platform} @${username}`);
      const response = await service.getRecentPosts(username, postLimit);
      const metrics = await service.calculateEngagement(response.data);
      
      const duration = Date.now() - startTime;
      logger.info(`Successfully calculated ${platform} engagement metrics for @${username} in ${duration}ms`, {
        platform,
        username,
        postsAnalyzed: metrics.postsAnalyzed,
        avgEngagementRate: metrics.averageEngagementRate.toFixed(2),
        duration,
      });
      
      return metrics;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`Failed to calculate ${platform} engagement metrics for @${username} after ${duration}ms`, {
        platform,
        username,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });
      throw error;
    }
  }

  async refreshToken(platform: Platform): Promise<void> {
    const service = this.getService(platform);
    
    try {
      logger.info(`Refreshing access token for ${platform}`);
      await service.refreshAccessToken();
      logger.info(`Successfully refreshed access token for ${platform}`);
    } catch (error) {
      logger.error(`Failed to refresh access token for ${platform}`, {
        platform,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  getRateLimitInfo(platform: Platform): RateLimitInfo | null {
    const service = this.services.get(platform);
    return service ? service.getRateLimitInfo() : null;
  }

  private getService(platform: Platform): PlatformAPIService {
    const service = this.services.get(platform);
    if (!service) {
      throw new PlatformAPIError(
        `No service configured for platform: ${platform}`,
        'SERVICE_NOT_CONFIGURED'
      );
    }
    return service;
  }
}

// Export a singleton instance for convenience
export const platformAPIClient = new PlatformAPIClient();