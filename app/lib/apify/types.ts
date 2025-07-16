/**
 * Unified data structures for mapping Apify actor responses to TikTok Miner data models
 */

import { Prisma } from '@prisma/client';

/**
 * Core unified creator data interface that standardizes creator data across all platforms.
 * This interface maps to the existing CreatorProfile schema while providing
 * flexibility for platform-specific data.
 */
export interface UnifiedCreatorData {
  // Basic Information (maps to CreatorProfile)
  name: string;
  email?: string | null;
  bio?: string | null;
  profileImageUrl?: string | null;
  category?: string | null; // e.g., "tech", "lifestyle", "gaming"
  tags?: string[];
  isVerified?: boolean;
  
  // Platform Identifiers (stored as JSON in CreatorProfile.platformIdentifiers)
  platformIdentifiers: {
    youtube_channel_id?: string;
    twitter_handle?: string;
    instagram_username?: string;
    tiktok_username?: string;
    linkedin_url?: string;
    [key: string]: string | undefined; // Allow additional platforms
  };
  
  // Core Metrics (calculated/aggregated)
  totalReach: number; // Sum of followers across platforms
  compositeEngagementScore?: number | null; // Calculated engagement score
  averageEngagementRate?: number | null; // Weighted average across platforms
  contentFrequency?: number | null; // Posts per week across platforms
  audienceQualityScore?: number | null; // 0-100 score based on fake follower detection
  
  // Platform-Specific Data (for creating related metric records)
  platformData?: {
    youtube?: YoutubeData;
    twitter?: TwitterData;
    instagram?: InstagramData;
    tiktok?: TiktokData;
    linkedin?: LinkedinData;
  };
  
  // Metadata
  sourceActorId?: string; // Apify actor that provided this data
  sourceRunId?: string; // Apify run ID for tracking
  scrapedAt?: Date; // When the data was scraped
}

/**
 * Platform-specific data interfaces that map to the respective metrics tables
 */

export interface YoutubeData {
  channelId: string;
  channelName: string;
  channelUrl: string;
  description?: string | null;
  country?: string | null;
  customUrl?: string | null;
  publishedAt?: Date | null;
  
  // Metrics
  subscriberCount: number;
  videoCount: number;
  viewCount: bigint | number; // Support both types for flexibility
  
  // Engagement metrics
  averageViews?: number;
  averageLikes?: number;
  averageComments?: number;
  engagementRate?: number;
  
  // Additional data
  uploadsPlaylistId?: string | null;
  thumbnailUrl?: string | null;
  bannerUrl?: string | null;
}

export interface TwitterData {
  userId: string;
  username: string;
  displayName: string;
  profileUrl: string;
  bio?: string | null;
  location?: string | null;
  website?: string | null;
  isVerified: boolean;
  joinedAt?: Date | null;
  
  // Metrics
  followerCount: number;
  followingCount: number;
  tweetCount: number;
  listedCount: number;
  
  // Engagement metrics
  averageLikes?: number;
  averageRetweets?: number;
  averageReplies?: number;
  engagementRate?: number;
  
  // Additional metrics
  impressions?: number | null;
  profileViews?: number | null;
}

export interface InstagramData {
  accountId: string;
  username: string;
  fullName?: string | null;
  profileUrl: string;
  bio?: string | null;
  website?: string | null;
  isVerified: boolean;
  isBusinessAccount?: boolean;
  businessCategory?: string | null;
  
  // Metrics
  followerCount: number;
  followingCount: number;
  mediaCount: number;
  
  // Engagement metrics
  averageLikes?: number;
  averageComments?: number;
  engagementRate?: number;
  
  // Business insights (if available)
  reach?: number | null;
  impressions?: number | null;
  profileViews?: number | null;
  websiteClicks?: number | null;
}

export interface TiktokData {
  userId: string;
  username: string;
  nickname?: string | null;
  profileUrl: string;
  bio?: string | null;
  isVerified: boolean;
  
  // Metrics
  followerCount: number;
  followingCount: number;
  videoCount: number;
  heartCount: bigint | number; // Total likes across all videos
  
  // Engagement metrics
  averageViews?: number;
  averageLikes?: number;
  averageComments?: number;
  averageShares?: number;
  engagementRate?: number;
  
  // Additional metrics
  totalViews?: bigint | number;
  dailyViewGrowth?: number | null;
  dailyFollowerGrowth?: number | null;
}

export interface LinkedinData {
  profileId: string;
  publicId: string; // LinkedIn public profile ID
  fullName: string;
  headline?: string | null;
  profileUrl: string;
  summary?: string | null;
  location?: string | null;
  industry?: string | null;
  
  // Metrics
  followerCount: number;
  connectionCount: number;
  postCount: number;
  
  // Engagement metrics
  averageLikes?: number;
  averageComments?: number;
  averageShares?: number;
  engagementRate?: number;
  
  // Additional metrics
  articleViews?: number | null;
  profileViews?: number | null;
  searchAppearances?: number | null;
}

/**
 * Apify actor response types - these represent the raw data from Apify actors
 * These will be transformed into UnifiedCreatorData
 */

export interface ApifyActorResponse<T = any> {
  status: 'SUCCEEDED' | 'FAILED' | 'RUNNING' | 'ABORTED';
  data: T[];
  error?: string;
  runId: string;
  actorId: string;
  startedAt: string;
  finishedAt?: string;
}

// Example Apify actor response structures (to be expanded based on actual actor outputs)
export interface ApifyInstagramProfile {
  username: string;
  fullName?: string;
  biography?: string;
  externalUrl?: string;
  followersCount: number;
  followsCount: number;
  postsCount: number;
  isVerified: boolean;
  isBusinessAccount?: boolean;
  businessCategoryName?: string;
  profilePicUrl?: string;
  profilePicUrlHd?: string;
  id: string;
  // Recent posts data for engagement calculation
  posts?: Array<{
    id: string;
    likesCount: number;
    commentsCount: number;
    timestamp: string;
  }>;
}

export interface ApifyTiktokProfile {
  user: {
    id: string;
    uniqueId: string;
    nickname: string;
    avatarThumb: string;
    signature: string;
    verified: boolean;
  };
  stats: {
    followerCount: number;
    followingCount: number;
    heartCount: number;
    videoCount: number;
    diggCount: number;
  };
  // Recent videos for engagement calculation
  videos?: Array<{
    id: string;
    stats: {
      playCount: number;
      diggCount: number;
      shareCount: number;
      commentCount: number;
    };
  }>;
}

/**
 * Validation result for transformed data
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Transformation result with validation
 */
export interface TransformationResult {
  data: UnifiedCreatorData | null;
  validation: ValidationResult;
  rawData?: any; // Original Apify response for debugging
}