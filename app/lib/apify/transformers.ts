/**
 * Platform-specific transformation functions for converting Apify actor responses
 * to UnifiedCreatorData format
 */

import {
  UnifiedCreatorData,
  InstagramData,
  TiktokData,
  YoutubeData,
  TwitterData,
  ValidationResult,
  TransformationResult,
} from './schemas';
import {
  ApifyInstagramProfile,
  ApifyTiktokProfile,
  ApifyYoutubeChannel,
  ApifyTwitterProfile,
  validateUnifiedCreatorData,
  validateApifyResponse,
} from './schemas';
import {
  sanitizeBio,
  sanitizeUsername,
  sanitizeEmail,
  normalizeUrl,
  sanitizeTags,
  stripHtml,
} from './sanitizers';

/**
 * Base transformer with common utility methods
 */
abstract class BaseTransformer {
  /**
   * Safely extract a string value with fallback
   */
  protected getString(value: any, fallback: string = ''): string {
    if (typeof value === 'string') return value;
    if (value === null || value === undefined) return fallback;
    return String(value);
  }

  /**
   * Safely extract a number value with fallback
   */
  protected getNumber(value: any, fallback: number = 0): number {
    const num = Number(value);
    return isNaN(num) ? fallback : num;
  }

  /**
   * Safely extract a boolean value
   */
  protected getBoolean(value: any, fallback: boolean = false): boolean {
    if (typeof value === 'boolean') return value;
    return fallback;
  }

  /**
   * Calculate engagement rate from metrics
   */
  protected calculateEngagementRate(
    interactions: number,
    followers: number,
    postsCount: number = 1
  ): number {
    if (followers === 0 || postsCount === 0) return 0;
    return Number(((interactions / followers / postsCount) * 100).toFixed(2));
  }

  /**
   * Validate the transformed data using Zod schema
   */
  protected validate(data: UnifiedCreatorData): ValidationResult {
    return validateUnifiedCreatorData(data);
  }
}

/**
 * Instagram transformer
 */
export class InstagramTransformer extends BaseTransformer {
  transform(apifyData: ApifyInstagramProfile): TransformationResult {
    try {
      // Calculate engagement metrics from recent posts
      let totalLikes = 0;
      let totalComments = 0;
      let postsAnalyzed = 0;

      if (apifyData.posts && Array.isArray(apifyData.posts)) {
        apifyData.posts.forEach(post => {
          totalLikes += this.getNumber(post.likesCount);
          totalComments += this.getNumber(post.commentsCount);
          postsAnalyzed++;
        });
      }

      const averageLikes = postsAnalyzed > 0 ? totalLikes / postsAnalyzed : 0;
      const averageComments = postsAnalyzed > 0 ? totalComments / postsAnalyzed : 0;
      const engagementRate = this.calculateEngagementRate(
        averageLikes + averageComments,
        this.getNumber(apifyData.followersCount),
        1
      );

      // Build Instagram-specific data
      const instagramData: InstagramData = {
        accountId: this.getString(apifyData.id),
        username: sanitizeUsername(apifyData.username),
        fullName: stripHtml(this.getString(apifyData.fullName)),
        profileUrl: `https://instagram.com/${sanitizeUsername(apifyData.username)}`,
        bio: sanitizeBio(apifyData.biography),
        website: normalizeUrl(apifyData.externalUrl),
        isVerified: this.getBoolean(apifyData.isVerified),
        isBusinessAccount: this.getBoolean(apifyData.isBusinessAccount),
        businessCategory: this.getString(apifyData.businessCategoryName),
        followerCount: this.getNumber(apifyData.followersCount),
        followingCount: this.getNumber(apifyData.followsCount),
        mediaCount: this.getNumber(apifyData.postsCount),
        averageLikes: Math.round(averageLikes),
        averageComments: Math.round(averageComments),
        engagementRate,
      };

      // Build unified data
      const unifiedData: UnifiedCreatorData = {
        name: stripHtml(this.getString(apifyData.fullName || apifyData.username)),
        bio: sanitizeBio(apifyData.biography),
        profileImageUrl: normalizeUrl(this.getString(apifyData.profilePicUrlHd || apifyData.profilePicUrl)),
        category: this.getString(apifyData.businessCategoryName, 'general'),
        tags: [], // Can be enriched based on bio analysis
        isVerified: this.getBoolean(apifyData.isVerified),
        platformIdentifiers: {
          instagram_username: sanitizeUsername(apifyData.username),
        },
        totalReach: this.getNumber(apifyData.followersCount),
        compositeEngagementScore: engagementRate,
        averageEngagementRate: engagementRate,
        platformData: {
          instagram: instagramData,
        },
        sourceActorId: 'instagram-scraper',
        scrapedAt: new Date(),
      };

      const validation = this.validate(unifiedData);
      
      return {
        data: validation.isValid ? unifiedData : null,
        validation,
        rawData: apifyData,
      };
    } catch (error) {
      return {
        data: null,
        validation: {
          isValid: false,
          errors: [`Transformation error: ${error.message}`],
          warnings: [],
        },
        rawData: apifyData,
      };
    }
  }
}

/**
 * TikTok transformer
 */
export class TiktokTransformer extends BaseTransformer {
  transform(apifyData: ApifyTiktokProfile): TransformationResult {
    try {
      // Calculate engagement metrics from recent videos
      let totalViews = 0;
      let totalLikes = 0;
      let totalComments = 0;
      let totalShares = 0;
      let videosAnalyzed = 0;

      if (apifyData.videos && Array.isArray(apifyData.videos)) {
        apifyData.videos.forEach(video => {
          if (video.stats) {
            totalViews += this.getNumber(video.stats.playCount);
            totalLikes += this.getNumber(video.stats.diggCount);
            totalComments += this.getNumber(video.stats.commentCount);
            totalShares += this.getNumber(video.stats.shareCount);
            videosAnalyzed++;
          }
        });
      }

      const averageViews = videosAnalyzed > 0 ? totalViews / videosAnalyzed : 0;
      const averageLikes = videosAnalyzed > 0 ? totalLikes / videosAnalyzed : 0;
      const averageComments = videosAnalyzed > 0 ? totalComments / videosAnalyzed : 0;
      const averageShares = videosAnalyzed > 0 ? totalShares / videosAnalyzed : 0;
      
      const followerCount = this.getNumber(apifyData.stats?.followerCount);
      const engagementRate = this.calculateEngagementRate(
        averageLikes + averageComments + averageShares,
        followerCount,
        1
      );

      // Build TikTok-specific data
      const tiktokData: TiktokData = {
        userId: this.getString(apifyData.user?.id),
        username: sanitizeUsername(apifyData.user?.uniqueId),
        nickname: stripHtml(this.getString(apifyData.user?.nickname)),
        profileUrl: `https://tiktok.com/@${sanitizeUsername(apifyData.user?.uniqueId)}`,
        bio: sanitizeBio(apifyData.user?.signature),
        isVerified: this.getBoolean(apifyData.user?.verified),
        followerCount,
        followingCount: this.getNumber(apifyData.stats?.followingCount),
        videoCount: this.getNumber(apifyData.stats?.videoCount),
        heartCount: this.getNumber(apifyData.stats?.heartCount),
        averageViews: Math.round(averageViews),
        averageLikes: Math.round(averageLikes),
        averageComments: Math.round(averageComments),
        averageShares: Math.round(averageShares),
        engagementRate,
        totalViews,
      };

      // Build unified data
      const unifiedData: UnifiedCreatorData = {
        name: stripHtml(this.getString(apifyData.user?.nickname || apifyData.user?.uniqueId)),
        bio: sanitizeBio(apifyData.user?.signature),
        profileImageUrl: normalizeUrl(this.getString(apifyData.user?.avatarThumb)),
        category: 'general', // TikTok doesn't provide categories
        tags: [], // Can be enriched based on content analysis
        isVerified: this.getBoolean(apifyData.user?.verified),
        platformIdentifiers: {
          tiktok_username: sanitizeUsername(apifyData.user?.uniqueId),
        },
        totalReach: followerCount,
        compositeEngagementScore: engagementRate,
        averageEngagementRate: engagementRate,
        platformData: {
          tiktok: tiktokData,
        },
        sourceActorId: 'tiktok-scraper',
        scrapedAt: new Date(),
      };

      const validation = this.validate(unifiedData);
      
      return {
        data: validation.isValid ? unifiedData : null,
        validation,
        rawData: apifyData,
      };
    } catch (error) {
      return {
        data: null,
        validation: {
          isValid: false,
          errors: [`Transformation error: ${error.message}`],
          warnings: [],
        },
        rawData: apifyData,
      };
    }
  }
}

/**
 * YouTube transformer
 */
export class YoutubeTransformer extends BaseTransformer {
  transform(apifyData: ApifyYoutubeChannel): TransformationResult {
    try {
      // YouTube-specific data extraction
      const channelId = this.getString(apifyData.channelId || apifyData.id);
      const subscriberCount = this.getNumber(apifyData.statistics?.subscriberCount || apifyData.subscriberCount);
      const videoCount = this.getNumber(apifyData.statistics?.videoCount || apifyData.videoCount);
      const viewCount = this.getNumber(apifyData.statistics?.viewCount || apifyData.viewCount);
      
      // Calculate average engagement from recent videos if available
      let averageViews = 0;
      let averageLikes = 0;
      let averageComments = 0;
      let engagementRate = 0;
      
      if (apifyData.recentVideos && Array.isArray(apifyData.recentVideos)) {
        const recentMetrics = apifyData.recentVideos.reduce(
          (acc, video) => ({
            views: acc.views + this.getNumber(video.viewCount),
            likes: acc.likes + this.getNumber(video.likeCount),
            comments: acc.comments + this.getNumber(video.commentCount),
          }),
          { views: 0, likes: 0, comments: 0 }
        );
        
        const videoAnalyzed = apifyData.recentVideos.length;
        if (videoAnalyzed > 0) {
          averageViews = recentMetrics.views / videoAnalyzed;
          averageLikes = recentMetrics.likes / videoAnalyzed;
          averageComments = recentMetrics.comments / videoAnalyzed;
          engagementRate = this.calculateEngagementRate(
            averageLikes + averageComments,
            subscriberCount,
            1
          );
        }
      }

      // Build YouTube-specific data
      const youtubeData: YoutubeData = {
        channelId,
        channelName: this.getString(apifyData.snippet?.title || apifyData.channelName),
        channelUrl: `https://youtube.com/channel/${channelId}`,
        description: this.getString(apifyData.snippet?.description),
        country: this.getString(apifyData.snippet?.country),
        customUrl: this.getString(apifyData.snippet?.customUrl),
        publishedAt: apifyData.snippet?.publishedAt ? new Date(apifyData.snippet.publishedAt) : null,
        subscriberCount,
        videoCount,
        viewCount,
        averageViews: Math.round(averageViews),
        averageLikes: Math.round(averageLikes),
        averageComments: Math.round(averageComments),
        engagementRate,
        thumbnailUrl: this.getString(apifyData.snippet?.thumbnails?.high?.url),
      };

      // Build unified data
      const unifiedData: UnifiedCreatorData = {
        name: this.getString(apifyData.snippet?.title || apifyData.channelName),
        bio: this.getString(apifyData.snippet?.description),
        profileImageUrl: this.getString(apifyData.snippet?.thumbnails?.high?.url),
        category: 'general', // Can be enriched based on channel topics
        tags: apifyData.topicCategories || [],
        isVerified: false, // YouTube doesn't expose verification in API
        platformIdentifiers: {
          youtube_channel_id: channelId,
        },
        totalReach: subscriberCount,
        compositeEngagementScore: engagementRate,
        averageEngagementRate: engagementRate,
        platformData: {
          youtube: youtubeData,
        },
        sourceActorId: 'youtube-scraper',
        scrapedAt: new Date(),
      };

      const validation = this.validate(unifiedData);
      
      return {
        data: validation.isValid ? unifiedData : null,
        validation,
        rawData: apifyData,
      };
    } catch (error) {
      return {
        data: null,
        validation: {
          isValid: false,
          errors: [`Transformation error: ${error.message}`],
          warnings: [],
        },
        rawData: apifyData,
      };
    }
  }
}

/**
 * Twitter transformer
 */
export class TwitterTransformer extends BaseTransformer {
  transform(apifyData: ApifyTwitterProfile): TransformationResult {
    try {
      const userId = this.getString(apifyData.id || apifyData.userId);
      const username = this.getString(apifyData.username || apifyData.screen_name);
      const followerCount = this.getNumber(apifyData.followers_count || apifyData.followerCount);
      
      // Calculate engagement from recent tweets if available
      let averageLikes = 0;
      let averageRetweets = 0;
      let averageReplies = 0;
      let engagementRate = 0;
      
      if (apifyData.recentTweets && Array.isArray(apifyData.recentTweets)) {
        const recentMetrics = apifyData.recentTweets.reduce(
          (acc, tweet) => ({
            likes: acc.likes + this.getNumber(tweet.favorite_count || tweet.likeCount),
            retweets: acc.retweets + this.getNumber(tweet.retweet_count || tweet.retweetCount),
            replies: acc.replies + this.getNumber(tweet.reply_count || tweet.replyCount),
          }),
          { likes: 0, retweets: 0, replies: 0 }
        );
        
        const tweetsAnalyzed = apifyData.recentTweets.length;
        if (tweetsAnalyzed > 0) {
          averageLikes = recentMetrics.likes / tweetsAnalyzed;
          averageRetweets = recentMetrics.retweets / tweetsAnalyzed;
          averageReplies = recentMetrics.replies / tweetsAnalyzed;
          engagementRate = this.calculateEngagementRate(
            averageLikes + averageRetweets + averageReplies,
            followerCount,
            1
          );
        }
      }

      // Build Twitter-specific data
      const twitterData: TwitterData = {
        userId,
        username,
        displayName: this.getString(apifyData.name || apifyData.displayName),
        profileUrl: `https://twitter.com/${username}`,
        bio: this.getString(apifyData.description || apifyData.bio),
        location: this.getString(apifyData.location),
        website: this.getString(apifyData.url || apifyData.website),
        isVerified: this.getBoolean(apifyData.verified || apifyData.isVerified),
        joinedAt: apifyData.created_at ? new Date(apifyData.created_at) : null,
        followerCount,
        followingCount: this.getNumber(apifyData.friends_count || apifyData.followingCount),
        tweetCount: this.getNumber(apifyData.statuses_count || apifyData.tweetCount),
        listedCount: this.getNumber(apifyData.listed_count || apifyData.listedCount),
        averageLikes,
        averageRetweets,
        averageReplies,
        engagementRate,
      };

      // Build unified data
      const unifiedData: UnifiedCreatorData = {
        name: this.getString(apifyData.name || apifyData.displayName || username),
        bio: this.getString(apifyData.description || apifyData.bio),
        profileImageUrl: this.getString(apifyData.profile_image_url_https || apifyData.profileImageUrl),
        category: 'general',
        tags: [],
        isVerified: this.getBoolean(apifyData.verified || apifyData.isVerified),
        platformIdentifiers: {
          twitter_handle: username,
        },
        totalReach: followerCount,
        compositeEngagementScore: engagementRate,
        averageEngagementRate: engagementRate,
        platformData: {
          twitter: twitterData,
        },
        sourceActorId: 'twitter-scraper',
        scrapedAt: new Date(),
      };

      const validation = this.validate(unifiedData);
      
      return {
        data: validation.isValid ? unifiedData : null,
        validation,
        rawData: apifyData,
      };
    } catch (error) {
      return {
        data: null,
        validation: {
          isValid: false,
          errors: [`Transformation error: ${error.message}`],
          warnings: [],
        },
        rawData: apifyData,
      };
    }
  }
}


/**
 * Factory for creating platform-specific transformers
 */
export class TransformerFactory {
  private static transformers = {
    instagram: new InstagramTransformer(),
    tiktok: new TiktokTransformer(),
    youtube: new YoutubeTransformer(),
    twitter: new TwitterTransformer(),
  };

  static getTransformer(platform: string): BaseTransformer | null {
    const normalizedPlatform = platform.toLowerCase();
    return this.transformers[normalizedPlatform] || null;
  }

  static transform(platform: string, data: any): TransformationResult {
    const transformer = this.getTransformer(platform);
    
    if (!transformer) {
      return {
        data: null,
        validation: {
          isValid: false,
          errors: [`No transformer available for platform: ${platform}`],
          warnings: [],
        },
        rawData: data,
      };
    }

    return transformer.transform(data);
  }
}