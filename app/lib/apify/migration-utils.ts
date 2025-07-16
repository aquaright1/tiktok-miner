/**
 * Migration utilities for transitioning from old CreatorProfile schema
 * to the new Apify-based UnifiedCreatorData format
 */

import { UnifiedCreatorData } from './schemas';
import { TransformerFactory } from './transformers';

/**
 * Old schema types for reference
 */
export interface LegacyCreatorProfile {
  id: string;
  candidateId: string;
  name: string;
  email?: string;
  bio?: string;
  profileImageUrl?: string;
  category?: string;
  tags: string[];
  isVerified: boolean;
  platformIdentifiers: {
    youtube_channel_id?: string;
    twitter_handle?: string;
    instagram_username?: string;
    tiktok_username?: string;
    linkedin_url?: string;
  };
  compositeEngagementScore?: number;
  totalReach: number;
  averageEngagementRate?: number;
  contentFrequency?: number;
  audienceQualityScore?: number;
}

export interface LegacyPlatformMetrics {
  instagram?: {
    username: string;
    fullName?: string;
    bio?: string;
    followerCount: number;
    followingCount: number;
    postCount: number;
    averageLikes: number;
    averageComments: number;
    engagementRate: number;
    isBusinessAccount: boolean;
    isVerified: boolean;
  };
  youtube?: {
    channelId: string;
    channelName: string;
    subscriberCount: number;
    videoCount: number;
    viewCount: number;
    averageViews: number;
    averageLikes: number;
    averageComments: number;
    engagementRate: number;
  };
  twitter?: {
    userId: string;
    username: string;
    displayName: string;
    followerCount: number;
    followingCount: number;
    tweetCount: number;
    averageLikes: number;
    averageRetweets: number;
    averageReplies: number;
    engagementRate: number;
    isVerified: boolean;
  };
  tiktok?: {
    userId: string;
    username: string;
    nickname: string;
    followerCount: number;
    followingCount: number;
    videoCount: number;
    heartCount: number;
    averageViews: number;
    averageLikes: number;
    averageComments: number;
    averageShares: number;
    engagementRate: number;
    isVerified: boolean;
  };
  linkedin?: {
    profileId: string;
    publicId: string;
    fullName: string;
    followerCount: number;
    connectionCount: number;
    postCount: number;
    averageLikes: number;
    averageComments: number;
    averageShares: number;
    engagementRate: number;
  };
}

/**
 * Migrates a legacy CreatorProfile to the new UnifiedCreatorData format
 */
export function migrateLegacyProfile(
  legacyProfile: LegacyCreatorProfile,
  platformMetrics?: LegacyPlatformMetrics
): UnifiedCreatorData {
  const unifiedData: UnifiedCreatorData = {
    name: legacyProfile.name,
    email: legacyProfile.email,
    bio: legacyProfile.bio || '',
    profileImageUrl: legacyProfile.profileImageUrl || '',
    category: legacyProfile.category || 'general',
    tags: legacyProfile.tags,
    isVerified: legacyProfile.isVerified,
    platformIdentifiers: legacyProfile.platformIdentifiers,
    totalReach: legacyProfile.totalReach,
    compositeEngagementScore: legacyProfile.compositeEngagementScore || 0,
    averageEngagementRate: legacyProfile.averageEngagementRate || 0,
    platformData: {},
    sourceActorId: 'legacy-migration',
    scrapedAt: new Date(),
  };

  // Add platform-specific data if available
  if (platformMetrics) {
    if (platformMetrics.instagram) {
      unifiedData.platformData.instagram = {
        accountId: '', // Not available in legacy data
        username: platformMetrics.instagram.username,
        fullName: platformMetrics.instagram.fullName || '',
        profileUrl: `https://instagram.com/${platformMetrics.instagram.username}`,
        bio: platformMetrics.instagram.bio || '',
        website: '',
        isVerified: platformMetrics.instagram.isVerified,
        isBusinessAccount: platformMetrics.instagram.isBusinessAccount,
        businessCategory: '',
        followerCount: platformMetrics.instagram.followerCount,
        followingCount: platformMetrics.instagram.followingCount,
        mediaCount: platformMetrics.instagram.postCount,
        averageLikes: platformMetrics.instagram.averageLikes,
        averageComments: platformMetrics.instagram.averageComments,
        engagementRate: platformMetrics.instagram.engagementRate,
      };
    }

    if (platformMetrics.youtube) {
      unifiedData.platformData.youtube = {
        channelId: platformMetrics.youtube.channelId,
        channelName: platformMetrics.youtube.channelName,
        channelUrl: `https://youtube.com/channel/${platformMetrics.youtube.channelId}`,
        description: '',
        country: null,
        customUrl: null,
        publishedAt: null,
        subscriberCount: platformMetrics.youtube.subscriberCount,
        videoCount: platformMetrics.youtube.videoCount,
        viewCount: platformMetrics.youtube.viewCount,
        averageViews: platformMetrics.youtube.averageViews,
        averageLikes: platformMetrics.youtube.averageLikes,
        averageComments: platformMetrics.youtube.averageComments,
        engagementRate: platformMetrics.youtube.engagementRate,
        thumbnailUrl: null,
      };
    }

    if (platformMetrics.twitter) {
      unifiedData.platformData.twitter = {
        userId: platformMetrics.twitter.userId,
        username: platformMetrics.twitter.username,
        displayName: platformMetrics.twitter.displayName,
        profileUrl: `https://twitter.com/${platformMetrics.twitter.username}`,
        bio: '',
        location: null,
        website: null,
        isVerified: platformMetrics.twitter.isVerified,
        joinedAt: null,
        followerCount: platformMetrics.twitter.followerCount,
        followingCount: platformMetrics.twitter.followingCount,
        tweetCount: platformMetrics.twitter.tweetCount,
        listedCount: 0,
        averageLikes: platformMetrics.twitter.averageLikes,
        averageRetweets: platformMetrics.twitter.averageRetweets,
        averageReplies: platformMetrics.twitter.averageReplies,
        engagementRate: platformMetrics.twitter.engagementRate,
      };
    }

    if (platformMetrics.tiktok) {
      unifiedData.platformData.tiktok = {
        userId: platformMetrics.tiktok.userId,
        username: platformMetrics.tiktok.username,
        nickname: platformMetrics.tiktok.nickname,
        profileUrl: `https://tiktok.com/@${platformMetrics.tiktok.username}`,
        bio: '',
        isVerified: platformMetrics.tiktok.isVerified,
        followerCount: platformMetrics.tiktok.followerCount,
        followingCount: platformMetrics.tiktok.followingCount,
        videoCount: platformMetrics.tiktok.videoCount,
        heartCount: platformMetrics.tiktok.heartCount,
        averageViews: platformMetrics.tiktok.averageViews,
        averageLikes: platformMetrics.tiktok.averageLikes,
        averageComments: platformMetrics.tiktok.averageComments,
        averageShares: platformMetrics.tiktok.averageShares,
        engagementRate: platformMetrics.tiktok.engagementRate,
        totalViews: 0, // Not available in legacy data
      };
    }

    if (platformMetrics.linkedin) {
      unifiedData.platformData.linkedin = {
        profileId: platformMetrics.linkedin.profileId,
        publicId: platformMetrics.linkedin.publicId,
        fullName: platformMetrics.linkedin.fullName,
        headline: '',
        profileUrl: `https://linkedin.com/in/${platformMetrics.linkedin.publicId}`,
        summary: '',
        location: null,
        industry: null,
        followerCount: platformMetrics.linkedin.followerCount,
        connectionCount: platformMetrics.linkedin.connectionCount,
        postCount: platformMetrics.linkedin.postCount,
        averageLikes: platformMetrics.linkedin.averageLikes,
        averageComments: platformMetrics.linkedin.averageComments,
        averageShares: platformMetrics.linkedin.averageShares,
        engagementRate: platformMetrics.linkedin.engagementRate,
      };
    }
  }

  return unifiedData;
}

/**
 * Converts platform-specific metrics from the old format to Apify-style data
 * that can be processed by the transformers
 */
export function convertToApifyFormat(platform: string, legacyMetrics: any): any {
  switch (platform.toLowerCase()) {
    case 'instagram':
      return {
        id: legacyMetrics.accountId || '',
        username: legacyMetrics.username,
        fullName: legacyMetrics.fullName,
        biography: legacyMetrics.bio,
        followersCount: legacyMetrics.followerCount,
        followsCount: legacyMetrics.followingCount,
        postsCount: legacyMetrics.postCount || legacyMetrics.mediaCount,
        isVerified: legacyMetrics.isVerified,
        isBusinessAccount: legacyMetrics.isBusinessAccount,
        businessCategoryName: legacyMetrics.businessCategory,
        posts: [], // No individual post data in legacy format
      };

    case 'youtube':
      return {
        channelId: legacyMetrics.channelId,
        channelName: legacyMetrics.channelName,
        subscriberCount: legacyMetrics.subscriberCount,
        videoCount: legacyMetrics.videoCount,
        viewCount: Number(legacyMetrics.viewCount),
        snippet: {
          title: legacyMetrics.channelName,
          description: legacyMetrics.description,
          country: legacyMetrics.country,
          customUrl: legacyMetrics.customUrl,
          publishedAt: legacyMetrics.publishedAt,
          thumbnails: legacyMetrics.thumbnailUrl ? {
            high: { url: legacyMetrics.thumbnailUrl }
          } : undefined,
        },
        statistics: {
          subscriberCount: legacyMetrics.subscriberCount,
          videoCount: legacyMetrics.videoCount,
          viewCount: Number(legacyMetrics.viewCount),
        },
        recentVideos: [], // No video data in legacy format
      };

    case 'twitter':
      return {
        id: legacyMetrics.userId,
        username: legacyMetrics.username,
        name: legacyMetrics.displayName,
        description: legacyMetrics.bio,
        location: legacyMetrics.location,
        url: legacyMetrics.website,
        verified: legacyMetrics.isVerified,
        created_at: legacyMetrics.joinedAt,
        followers_count: legacyMetrics.followerCount,
        friends_count: legacyMetrics.followingCount,
        statuses_count: legacyMetrics.tweetCount,
        listed_count: legacyMetrics.listedCount || 0,
        profile_image_url_https: legacyMetrics.profileImageUrl,
        recentTweets: [], // No tweet data in legacy format
      };

    case 'tiktok':
      return {
        user: {
          id: legacyMetrics.userId,
          uniqueId: legacyMetrics.username,
          nickname: legacyMetrics.nickname || legacyMetrics.displayName,
          avatarThumb: legacyMetrics.profileImageUrl,
          signature: legacyMetrics.bio,
          verified: legacyMetrics.isVerified,
        },
        stats: {
          followerCount: legacyMetrics.followerCount,
          followingCount: legacyMetrics.followingCount,
          heartCount: legacyMetrics.heartCount || 0,
          videoCount: legacyMetrics.videoCount,
          diggCount: 0,
        },
        videos: [], // No video data in legacy format
      };

    case 'linkedin':
      return {
        profileId: legacyMetrics.profileId,
        publicIdentifier: legacyMetrics.publicId,
        fullName: legacyMetrics.fullName,
        firstName: legacyMetrics.fullName?.split(' ')[0],
        lastName: legacyMetrics.fullName?.split(' ').slice(1).join(' '),
        headline: legacyMetrics.headline,
        summary: legacyMetrics.summary,
        location: legacyMetrics.location,
        industry: legacyMetrics.industry,
        followerCount: legacyMetrics.followerCount,
        connectionCount: legacyMetrics.connectionCount,
        postCount: legacyMetrics.postCount,
        profilePictureUrl: legacyMetrics.profileImageUrl,
        recentPosts: [], // No post data in legacy format
      };

    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

/**
 * Validates that a migrated profile maintains data integrity
 */
export function validateMigration(
  original: LegacyCreatorProfile,
  migrated: UnifiedCreatorData
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check core fields
  if (migrated.name !== original.name) {
    errors.push('Name mismatch');
  }

  if (migrated.email !== original.email) {
    errors.push('Email mismatch');
  }

  if (migrated.totalReach !== original.totalReach) {
    errors.push('Total reach mismatch');
  }

  // Check platform identifiers
  const origIds = original.platformIdentifiers;
  const migratedIds = migrated.platformIdentifiers;

  Object.keys(origIds).forEach(key => {
    if (origIds[key] !== migratedIds[key]) {
      errors.push(`Platform identifier mismatch for ${key}`);
    }
  });

  // Check optional numeric fields
  if (original.compositeEngagementScore !== undefined && 
      migrated.compositeEngagementScore !== original.compositeEngagementScore) {
    errors.push('Composite engagement score mismatch');
  }

  if (original.averageEngagementRate !== undefined && 
      migrated.averageEngagementRate !== original.averageEngagementRate) {
    errors.push('Average engagement rate mismatch');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Batch migration utility for processing multiple profiles
 */
export async function batchMigrateProfiles(
  profiles: LegacyCreatorProfile[],
  metricsMap: Map<string, LegacyPlatformMetrics>
): Promise<{
  successful: UnifiedCreatorData[];
  failed: Array<{ profile: LegacyCreatorProfile; error: string }>;
}> {
  const successful: UnifiedCreatorData[] = [];
  const failed: Array<{ profile: LegacyCreatorProfile; error: string }> = [];

  for (const profile of profiles) {
    try {
      const metrics = metricsMap.get(profile.candidateId);
      const migrated = migrateLegacyProfile(profile, metrics);
      
      const validation = validateMigration(profile, migrated);
      if (validation.isValid) {
        successful.push(migrated);
      } else {
        failed.push({
          profile,
          error: `Validation failed: ${validation.errors.join(', ')}`,
        });
      }
    } catch (error) {
      failed.push({
        profile,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return { successful, failed };
}