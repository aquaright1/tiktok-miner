/**
 * Zod schemas for validating Apify data and generating TypeScript types
 */

import { z } from 'zod';

/**
 * Common validation patterns
 */
const urlSchema = z.string().url().or(z.literal('')).optional().nullable();
const emailSchema = z.string().email().or(z.literal('')).optional().nullable();
const positiveIntSchema = z.number().int().min(0);
const percentageSchema = z.number().min(0).max(100);
const bigIntOrNumberSchema = z.union([z.bigint(), z.number()]).transform(val => Number(val));

/**
 * Platform identifiers schema
 */
export const PlatformIdentifiersSchema = z.object({
  youtube_channel_id: z.string().optional(),
  twitter_handle: z.string().optional(),
  instagram_username: z.string().optional(),
  tiktok_username: z.string().optional(),
}).passthrough(); // Allow additional platform identifiers

/**
 * YouTube data schema
 */
export const YoutubeDataSchema = z.object({
  channelId: z.string(),
  channelName: z.string(),
  channelUrl: z.string().url(),
  description: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  customUrl: z.string().optional().nullable(),
  publishedAt: z.date().optional().nullable(),
  subscriberCount: positiveIntSchema,
  videoCount: positiveIntSchema,
  viewCount: bigIntOrNumberSchema,
  averageViews: positiveIntSchema.optional().default(0),
  averageLikes: positiveIntSchema.optional().default(0),
  averageComments: positiveIntSchema.optional().default(0),
  engagementRate: percentageSchema.optional().default(0),
  uploadsPlaylistId: z.string().optional().nullable(),
  thumbnailUrl: urlSchema,
  bannerUrl: urlSchema,
});

/**
 * Twitter data schema
 */
export const TwitterDataSchema = z.object({
  userId: z.string(),
  username: z.string(),
  displayName: z.string(),
  profileUrl: z.string().url(),
  bio: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  website: urlSchema,
  isVerified: z.boolean(),
  joinedAt: z.date().optional().nullable(),
  followerCount: positiveIntSchema,
  followingCount: positiveIntSchema,
  tweetCount: positiveIntSchema,
  listedCount: positiveIntSchema,
  averageLikes: z.number().min(0).optional().default(0),
  averageRetweets: z.number().min(0).optional().default(0),
  averageReplies: z.number().min(0).optional().default(0),
  engagementRate: percentageSchema.optional().default(0),
  impressions: positiveIntSchema.optional().nullable(),
  profileViews: positiveIntSchema.optional().nullable(),
});

/**
 * Instagram data schema
 */
export const InstagramDataSchema = z.object({
  accountId: z.string(),
  username: z.string(),
  fullName: z.string().optional().nullable(),
  profileUrl: z.string().url(),
  bio: z.string().optional().nullable(),
  website: urlSchema,
  isVerified: z.boolean(),
  isBusinessAccount: z.boolean().optional().default(false),
  businessCategory: z.string().optional().nullable(),
  followerCount: positiveIntSchema,
  followingCount: positiveIntSchema,
  mediaCount: positiveIntSchema,
  averageLikes: z.number().min(0).optional().default(0),
  averageComments: z.number().min(0).optional().default(0),
  engagementRate: percentageSchema.optional().default(0),
  reach: positiveIntSchema.optional().nullable(),
  impressions: positiveIntSchema.optional().nullable(),
  profileViews: positiveIntSchema.optional().nullable(),
  websiteClicks: positiveIntSchema.optional().nullable(),
});

/**
 * TikTok data schema
 */
export const TiktokDataSchema = z.object({
  userId: z.string(),
  username: z.string(),
  nickname: z.string().optional().nullable(),
  profileUrl: z.string().url(),
  bio: z.string().optional().nullable(),
  isVerified: z.boolean(),
  followerCount: positiveIntSchema,
  followingCount: positiveIntSchema,
  videoCount: positiveIntSchema,
  heartCount: bigIntOrNumberSchema,
  averageViews: positiveIntSchema.optional().default(0),
  averageLikes: positiveIntSchema.optional().default(0),
  averageComments: positiveIntSchema.optional().default(0),
  averageShares: positiveIntSchema.optional().default(0),
  engagementRate: percentageSchema.optional().default(0),
  totalViews: bigIntOrNumberSchema.optional().default(0),
  dailyViewGrowth: z.number().optional().nullable(),
  dailyFollowerGrowth: z.number().optional().nullable(),
});

/**
 * Platform data schema - union of all platform schemas
 */
export const PlatformDataSchema = z.object({
  youtube: YoutubeDataSchema.optional(),
  twitter: TwitterDataSchema.optional(),
  instagram: InstagramDataSchema.optional(),
  tiktok: TiktokDataSchema.optional(),
}).optional();

/**
 * Unified creator data schema
 */
export const UnifiedCreatorDataSchema = z.object({
  // Basic Information
  name: z.string().min(1, "Name is required"),
  email: emailSchema,
  bio: z.string().optional().nullable(),
  profileImageUrl: urlSchema,
  category: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().default([]),
  isVerified: z.boolean().optional().default(false),
  
  // Platform Identifiers
  platformIdentifiers: PlatformIdentifiersSchema,
  
  // Core Metrics
  totalReach: positiveIntSchema,
  compositeEngagementScore: z.number().optional().nullable(),
  averageEngagementRate: z.number().optional().nullable(),
  contentFrequency: z.number().optional().nullable(),
  audienceQualityScore: percentageSchema.optional().nullable(),
  
  // Platform-Specific Data
  platformData: PlatformDataSchema,
  
  // Metadata
  sourceActorId: z.string().optional(),
  sourceRunId: z.string().optional(),
  scrapedAt: z.date().optional(),
});

/**
 * Apify actor response schemas
 */

// Instagram actor response schema
export const ApifyInstagramProfileSchema = z.object({
  id: z.string(),
  username: z.string(),
  fullName: z.string().optional(),
  biography: z.string().optional(),
  externalUrl: urlSchema,
  followersCount: positiveIntSchema,
  followsCount: positiveIntSchema,
  postsCount: positiveIntSchema,
  isVerified: z.boolean(),
  isBusinessAccount: z.boolean().optional(),
  businessCategoryName: z.string().optional(),
  profilePicUrl: urlSchema,
  profilePicUrlHd: urlSchema,
  posts: z.array(z.object({
    id: z.string(),
    likesCount: positiveIntSchema,
    commentsCount: positiveIntSchema,
    timestamp: z.string(),
  })).optional(),
});

// TikTok actor response schema
export const ApifyTiktokProfileSchema = z.object({
  user: z.object({
    id: z.string(),
    uniqueId: z.string(),
    nickname: z.string(),
    avatarThumb: z.string(),
    signature: z.string(),
    verified: z.boolean(),
  }),
  stats: z.object({
    followerCount: positiveIntSchema,
    followingCount: positiveIntSchema,
    heartCount: positiveIntSchema,
    videoCount: positiveIntSchema,
    diggCount: positiveIntSchema,
  }),
  videos: z.array(z.object({
    id: z.string(),
    stats: z.object({
      playCount: positiveIntSchema,
      diggCount: positiveIntSchema,
      shareCount: positiveIntSchema,
      commentCount: positiveIntSchema,
    }),
  })).optional(),
});

// YouTube actor response schema (flexible to handle different structures)
export const ApifyYoutubeChannelSchema = z.object({
  channelId: z.string().optional(),
  id: z.string().optional(),
  channelName: z.string().optional(),
  snippet: z.object({
    title: z.string(),
    description: z.string().optional(),
    country: z.string().optional(),
    customUrl: z.string().optional(),
    publishedAt: z.string().optional(),
    thumbnails: z.object({
      high: z.object({
        url: z.string(),
      }).optional(),
    }).optional(),
  }).optional(),
  statistics: z.object({
    subscriberCount: z.union([z.string(), z.number()]).transform(val => Number(val)),
    videoCount: z.union([z.string(), z.number()]).transform(val => Number(val)),
    viewCount: z.union([z.string(), z.number()]).transform(val => Number(val)),
  }).optional(),
  subscriberCount: positiveIntSchema.optional(),
  videoCount: positiveIntSchema.optional(),
  viewCount: positiveIntSchema.optional(),
  recentVideos: z.array(z.object({
    viewCount: positiveIntSchema,
    likeCount: positiveIntSchema,
    commentCount: positiveIntSchema,
  })).optional(),
}).passthrough(); // Allow additional fields

// Twitter actor response schema
export const ApifyTwitterProfileSchema = z.object({
  id: z.string().optional(),
  userId: z.string().optional(),
  username: z.string().optional(),
  screen_name: z.string().optional(),
  name: z.string().optional(),
  displayName: z.string().optional(),
  description: z.string().optional(),
  bio: z.string().optional(),
  location: z.string().optional(),
  url: z.string().optional(),
  website: z.string().optional(),
  verified: z.boolean().optional(),
  isVerified: z.boolean().optional(),
  created_at: z.string().optional(),
  followers_count: positiveIntSchema.optional(),
  followerCount: positiveIntSchema.optional(),
  friends_count: positiveIntSchema.optional(),
  followingCount: positiveIntSchema.optional(),
  statuses_count: positiveIntSchema.optional(),
  tweetCount: positiveIntSchema.optional(),
  listed_count: positiveIntSchema.optional(),
  listedCount: positiveIntSchema.optional(),
  profile_image_url_https: z.string().optional(),
  profileImageUrl: z.string().optional(),
  recentTweets: z.array(z.object({
    favorite_count: positiveIntSchema.optional(),
    likeCount: positiveIntSchema.optional(),
    retweet_count: positiveIntSchema.optional(),
    retweetCount: positiveIntSchema.optional(),
    reply_count: positiveIntSchema.optional(),
    replyCount: positiveIntSchema.optional(),
  })).optional(),
}).passthrough();

/**
 * Apify actor response wrapper schema
 */
export const ApifyActorResponseSchema = z.object({
  status: z.enum(['SUCCEEDED', 'FAILED', 'RUNNING', 'ABORTED']),
  data: z.array(z.unknown()),
  error: z.string().optional(),
  runId: z.string(),
  actorId: z.string(),
  startedAt: z.string(),
  finishedAt: z.string().optional(),
});

/**
 * Validation result schema
 */
export const ValidationResultSchema = z.object({
  isValid: z.boolean(),
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
});

/**
 * Transformation result schema
 */
export const TransformationResultSchema = z.object({
  data: UnifiedCreatorDataSchema.nullable(),
  validation: ValidationResultSchema,
  rawData: z.any().optional(),
});

/**
 * Type exports - automatically inferred from schemas
 */
export type UnifiedCreatorData = z.infer<typeof UnifiedCreatorDataSchema>;
export type YoutubeData = z.infer<typeof YoutubeDataSchema>;
export type TwitterData = z.infer<typeof TwitterDataSchema>;
export type InstagramData = z.infer<typeof InstagramDataSchema>;
export type TiktokData = z.infer<typeof TiktokDataSchema>;
export type PlatformIdentifiers = z.infer<typeof PlatformIdentifiersSchema>;
export type PlatformData = z.infer<typeof PlatformDataSchema>;
export type ApifyActorResponse = z.infer<typeof ApifyActorResponseSchema>;
export type ValidationResult = z.infer<typeof ValidationResultSchema>;
export type TransformationResult = z.infer<typeof TransformationResultSchema>;

// Apify profile types
export type ApifyInstagramProfile = z.infer<typeof ApifyInstagramProfileSchema>;
export type ApifyTiktokProfile = z.infer<typeof ApifyTiktokProfileSchema>;
export type ApifyYoutubeChannel = z.infer<typeof ApifyYoutubeChannelSchema>;
export type ApifyTwitterProfile = z.infer<typeof ApifyTwitterProfileSchema>;

/**
 * Validation helper functions
 */
export function validateUnifiedCreatorData(data: unknown): ValidationResult {
  try {
    UnifiedCreatorDataSchema.parse(data);
    return {
      isValid: true,
      errors: [],
      warnings: [],
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        isValid: false,
        errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
        warnings: [],
      };
    }
    return {
      isValid: false,
      errors: ['Unknown validation error'],
      warnings: [],
    };
  }
}

export function validateApifyResponse(platform: string, data: unknown): ValidationResult {
  const schemas: Record<string, z.ZodSchema> = {
    instagram: ApifyInstagramProfileSchema,
    tiktok: ApifyTiktokProfileSchema,
    youtube: ApifyYoutubeChannelSchema,
    twitter: ApifyTwitterProfileSchema,
  };

  const schema = schemas[platform.toLowerCase()];
  if (!schema) {
    return {
      isValid: false,
      errors: [`No validation schema available for platform: ${platform}`],
      warnings: [],
    };
  }

  try {
    schema.parse(data);
    return {
      isValid: true,
      errors: [],
      warnings: [],
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        isValid: false,
        errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
        warnings: [],
      };
    }
    return {
      isValid: false,
      errors: ['Unknown validation error'],
      warnings: [],
    };
  }
}