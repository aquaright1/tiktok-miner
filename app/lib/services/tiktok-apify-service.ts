/**
 * TikTokApifyService - Production-ready TikTok service using Apify scraper
 * Provides a drop-in replacement for TikTokAPIService with Apify backend
 */

import { ActorManager } from '../apify/actor-manager';
import { createPipeline, processCreatorProfile } from '../apify';
import { TikTokTransformer } from '../apify/transformers';
import { ApifyTiktokProfile } from '../apify/types';
import { UnifiedCreatorData } from '../apify/schemas';
import { prisma } from '@/lib/db';
import { logger } from '../logger';
import crypto from 'crypto';

export interface TikTokApifyConfig {
  apifyApiKey: string;
  enableCaching?: boolean;
  cacheTTL?: number; // in milliseconds
  maxVideosPerProfile?: number;
  maxRetries?: number;
}

export interface TikTokProfileData {
  user: TikTokUser;
  recentVideos: TikTokVideo[];
  engagement: TikTokEngagementMetrics;
  lastUpdated: Date;
}

export interface TikTokUser {
  id: string;
  uniqueId: string; // username
  nickname: string; // display name
  avatarUrl: string;
  signature: string; // bio
  followerCount: number;
  followingCount: number;
  heartCount: number; // total likes
  videoCount: number;
  verified: boolean;
  privateAccount: boolean;
  profileUrl: string;
}

export interface TikTokVideo {
  id: string;
  desc?: string; // caption
  createTime: number;
  duration: number;
  stats: {
    diggCount: number; // likes
    shareCount: number;
    commentCount: number;
    playCount: number;
  };
  music?: {
    id: string;
    title: string;
    authorName: string;
  };
  hashtags?: string[];
  coverUrl: string;
  videoUrl?: string;
}

export interface TikTokEngagementMetrics {
  averageLikes: number;
  averageComments: number;
  averageShares: number;
  averageViews: number;
  engagementRate: number;
  viewToFollowerRatio: number;
}

export interface TikTokVideoResponse {
  data: TikTokVideo[];
  hasMore: boolean;
  cursor?: string;
  maxCursor?: string;
  minCursor?: string;
}

export class TikTokApifyService {
  private actorManager: ActorManager;
  private transformer: TikTokTransformer;
  private pipeline: ReturnType<typeof createPipeline>;
  private config: TikTokApifyConfig;
  private cachePrefix = 'tiktok:apify:';

  constructor(config: TikTokApifyConfig) {
    this.config = config;
    this.actorManager = new ActorManager({
      apiKey: config.apifyApiKey,
      maxRetries: config.maxRetries || 3,
      requestTimeoutMs: 120000, // 2 minutes
    });
    this.transformer = new TikTokTransformer();
    this.pipeline = createPipeline('tiktok');
  }

  /**
   * Get user profile by username
   */
  async getUserProfile(username: string): Promise<TikTokUser> {
    const cacheKey = `${this.cachePrefix}profile:${username}`;
    
    // Check cache if enabled
    if (this.config.enableCaching) {
      const cached = await this.getFromCache(cacheKey);
      if (cached) {
        logger.info(`TikTok profile cache hit for ${username}`);
        return cached;
      }
    }

    try {
      logger.info(`Fetching TikTok profile for ${username} via Apify`);
      
      // Run Apify actor
      const result = await this.actorManager.scrapeTiktokProfile(username);
      
      // Get results from dataset
      const profiles = await this.actorManager.getRunDataset<ApifyTiktokProfile>(
        result.datasetId,
        { limit: 1 }
      );

      if (!profiles || profiles.length === 0) {
        throw new Error(`No TikTok profile data found for ${username}`);
      }

      // Transform to unified format
      const apifyProfile = profiles[0];
      const unifiedData = await this.transformProfile(apifyProfile);
      
      // Convert to TikTokUser format
      const tiktokUser = this.convertToTikTokUser(unifiedData);
      
      // Cache if enabled
      if (this.config.enableCaching) {
        await this.saveToCache(cacheKey, tiktokUser, this.config.cacheTTL);
      }

      return tiktokUser;
    } catch (error) {
      logger.error(`Failed to fetch TikTok profile for ${username}:`, error);
      throw error;
    }
  }

  /**
   * Get user videos
   */
  async getUserVideos(
    username: string,
    limit: number = 30,
    cursor?: string
  ): Promise<TikTokVideoResponse> {
    const cacheKey = `${this.cachePrefix}videos:${username}:${limit}:${cursor || 'initial'}`;
    
    // Check cache if enabled
    if (this.config.enableCaching && !cursor) {
      const cached = await this.getFromCache(cacheKey);
      if (cached) {
        logger.info(`TikTok videos cache hit for ${username}`);
        return cached;
      }
    }

    try {
      logger.info(`Fetching TikTok videos for ${username} via Apify`);
      
      // For Apify, we get all videos in one request, so we'll simulate pagination
      const result = await this.actorManager.scrapeTiktokProfile(username);
      const profiles = await this.actorManager.getRunDataset<ApifyTiktokProfile>(
        result.datasetId,
        { limit: 1 }
      );

      if (!profiles || profiles.length === 0) {
        throw new Error(`No TikTok data found for ${username}`);
      }

      const profile = profiles[0];
      const videos = profile.posts || [];
      
      // Apply limit and cursor logic
      const startIndex = cursor ? parseInt(cursor, 10) : 0;
      const endIndex = startIndex + limit;
      const paginatedVideos = videos.slice(startIndex, endIndex);
      
      // Convert to TikTokVideo format
      const tiktokVideos = paginatedVideos.map(video => this.convertToTikTokVideo(video));
      
      const response: TikTokVideoResponse = {
        data: tiktokVideos,
        hasMore: endIndex < videos.length,
        cursor: endIndex < videos.length ? endIndex.toString() : undefined,
      };
      
      // Cache if enabled
      if (this.config.enableCaching && !cursor) {
        await this.saveToCache(cacheKey, response, this.config.cacheTTL);
      }

      return response;
    } catch (error) {
      logger.error(`Failed to fetch TikTok videos for ${username}:`, error);
      throw error;
    }
  }

  /**
   * Get video insights (limited data from scraping)
   */
  async getVideoInsights(videoId: string): Promise<any> {
    logger.warn('Video insights not available via Apify scraping. Returning basic metrics only.');
    return {
      videoId,
      message: 'Detailed insights require TikTok API access',
      availableMetrics: ['likes', 'comments', 'shares', 'views'],
    };
  }

  /**
   * Get user insights based on profile and recent videos
   */
  async getUserInsights(username: string): Promise<TikTokEngagementMetrics> {
    try {
      const profile = await this.getUserProfile(username);
      const videosResponse = await this.getUserVideos(username, 50); // Get recent 50 videos
      const videos = videosResponse.data;

      if (videos.length === 0) {
        return {
          averageLikes: 0,
          averageComments: 0,
          averageShares: 0,
          averageViews: 0,
          engagementRate: 0,
          viewToFollowerRatio: 0,
        };
      }

      // Calculate averages
      const totalLikes = videos.reduce((sum, v) => sum + v.stats.diggCount, 0);
      const totalComments = videos.reduce((sum, v) => sum + v.stats.commentCount, 0);
      const totalShares = videos.reduce((sum, v) => sum + v.stats.shareCount, 0);
      const totalViews = videos.reduce((sum, v) => sum + v.stats.playCount, 0);

      const averageLikes = totalLikes / videos.length;
      const averageComments = totalComments / videos.length;
      const averageShares = totalShares / videos.length;
      const averageViews = totalViews / videos.length;

      // Calculate engagement rate
      const engagementRate = profile.followerCount > 0
        ? ((averageLikes + averageComments + averageShares) / profile.followerCount) * 100
        : 0;

      // Calculate view to follower ratio
      const viewToFollowerRatio = profile.followerCount > 0
        ? averageViews / profile.followerCount
        : 0;

      return {
        averageLikes,
        averageComments,
        averageShares,
        averageViews,
        engagementRate,
        viewToFollowerRatio,
      };
    } catch (error) {
      logger.error(`Failed to calculate TikTok insights for ${username}:`, error);
      throw error;
    }
  }

  /**
   * OAuth compatibility methods - not applicable for scraping
   */
  async initializeOAuthFlow(userId: string): Promise<{ authUrl: string; state: string }> {
    logger.warn('OAuth not applicable for Apify scraping. Returning mock response.');
    return {
      authUrl: 'https://www.tiktok.com/@username',
      state: 'apify-mode',
    };
  }

  async handleOAuthCallback(code: string, state: string): Promise<any> {
    throw new Error('OAuth callback not supported in Apify mode. Use username-based methods.');
  }

  async refreshAccessToken(): Promise<void> {
    logger.info('No access token needed for Apify scraping');
  }

  /**
   * Search TikTok profiles by keywords
   */
  async searchProfiles(keywords: string[], limit: number = 50): Promise<TikTokUser[]> {
    const cacheKey = `${this.cachePrefix}search:${keywords.join('-')}:${limit}`;
    
    // Check cache if enabled
    if (this.config.enableCaching) {
      const cached = await this.getFromCache(cacheKey);
      if (cached) {
        logger.info(`TikTok search cache hit for keywords: ${keywords.join(', ')}`);
        return cached;
      }
    }

    try {
      logger.info(`Searching TikTok profiles for keywords: ${keywords.join(', ')} via Apify`);
      
      // Run Apify actor with search queries
      const result = await this.actorManager.searchTikTokProfiles(keywords, {
        maxProfilesPerQuery: limit,
        resultsPerPage: 100,
      });
      
      // Get results from dataset
      const searchResults = await this.actorManager.getRunDataset(result.datasetId);
      
      if (!searchResults || searchResults.length === 0) {
        logger.warn(`No TikTok profiles found for keywords: ${keywords.join(', ')}`);
        return [];
      }

      // Transform search results to TikTokUser format
      const profiles: TikTokUser[] = [];
      
      for (const result of searchResults) {
        try {
          // Each result contains profile data
          if (result.authorMeta) {
            const user: TikTokUser = {
              id: result.authorMeta.id || crypto.randomBytes(16).toString('hex'),
              uniqueId: result.authorMeta.name || '',
              nickname: result.authorMeta.nickName || result.authorMeta.name || '',
              avatarUrl: result.authorMeta.avatar || '',
              signature: result.authorMeta.signature || '',
              followerCount: result.authorStats?.followerCount || 0,
              followingCount: result.authorStats?.followingCount || 0,
              heartCount: result.authorStats?.heartCount || 0,
              videoCount: result.authorStats?.videoCount || 0,
              verified: result.authorMeta.verified || false,
              privateAccount: result.authorMeta.privateAccount || false,
              profileUrl: `https://www.tiktok.com/@${result.authorMeta.name}`,
            };
            profiles.push(user);
          }
        } catch (error) {
          logger.warn(`Failed to transform search result:`, error);
        }
      }

      // Remove duplicates based on uniqueId
      const uniqueProfiles = Array.from(
        new Map(profiles.map(p => [p.uniqueId, p])).values()
      ).slice(0, limit);
      
      // Cache if enabled
      if (this.config.enableCaching) {
        await this.saveToCache(cacheKey, uniqueProfiles, this.config.cacheTTL);
      }

      logger.info(`Found ${uniqueProfiles.length} unique TikTok profiles for keywords: ${keywords.join(', ')}`);
      return uniqueProfiles;
    } catch (error) {
      logger.error(`Failed to search TikTok profiles:`, error);
      throw error;
    }
  }

  /**
   * Disconnect account (clean up any stored data)
   */
  async disconnectAccount(userId: string): Promise<void> {
    try {
      await prisma.platformAuth.deleteMany({
        where: {
          userId,
          platform: 'tiktok',
        },
      });
      logger.info(`Disconnected TikTok account for user ${userId}`);
    } catch (error) {
      logger.error(`Failed to disconnect TikTok account for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Helper methods
   */
  private async transformProfile(apifyProfile: ApifyTiktokProfile): Promise<UnifiedCreatorData> {
    const result = await processCreatorProfile('tiktok', apifyProfile);
    if (!result.success) {
      throw new Error(`Failed to transform TikTok profile: ${result.errors.join(', ')}`);
    }
    return result.data;
  }

  private convertToTikTokUser(unifiedData: UnifiedCreatorData): TikTokUser {
    const platformData = unifiedData.platformIdentifiers.tiktok;
    return {
      id: platformData?.id || unifiedData.id,
      uniqueId: platformData?.username || unifiedData.username,
      nickname: unifiedData.name,
      avatarUrl: unifiedData.profileImageUrl || '',
      signature: unifiedData.bio || '',
      followerCount: unifiedData.metrics.followerCount,
      followingCount: unifiedData.metrics.followingCount || 0,
      heartCount: platformData?.totalLikes || 0,
      videoCount: unifiedData.metrics.postCount || 0,
      verified: unifiedData.isVerified || false,
      privateAccount: false, // Not available from scraping
      profileUrl: unifiedData.profileUrl || `https://www.tiktok.com/@${unifiedData.username}`,
    };
  }

  private convertToTikTokVideo(apifyVideo: any): TikTokVideo {
    return {
      id: apifyVideo.id || crypto.randomBytes(16).toString('hex'),
      desc: apifyVideo.text || apifyVideo.description || '',
      createTime: apifyVideo.createTime || Date.now() / 1000,
      duration: apifyVideo.duration || 0,
      stats: {
        diggCount: apifyVideo.diggCount || 0,
        shareCount: apifyVideo.shareCount || 0,
        commentCount: apifyVideo.commentCount || 0,
        playCount: apifyVideo.playCount || 0,
      },
      music: apifyVideo.music ? {
        id: apifyVideo.music.id,
        title: apifyVideo.music.title,
        authorName: apifyVideo.music.authorName,
      } : undefined,
      hashtags: apifyVideo.hashtags || [],
      coverUrl: apifyVideo.covers?.default || '',
      videoUrl: apifyVideo.videoUrl,
    };
  }

  /**
   * Cache helper methods
   */
  private async getFromCache(key: string): Promise<any> {
    // In production, implement Redis caching
    // For now, return null to skip caching
    return null;
  }

  private async saveToCache(key: string, data: any, ttl?: number): Promise<void> {
    // In production, implement Redis caching
    // For now, do nothing
  }
}