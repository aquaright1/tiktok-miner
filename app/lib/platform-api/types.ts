export interface CreatorProfile {
  id: string;
  username: string;
  displayName: string;
  bio?: string;
  profilePictureUrl?: string;
  followerCount: number;
  followingCount?: number;
  postCount?: number;
  platform: Platform;
  isVerified?: boolean;
  externalUrl?: string;
  metadata?: Record<string, any>;
}

export interface Post {
  id: string;
  platform: Platform;
  createdAt: Date;
  content?: string;
  mediaType: 'image' | 'video' | 'text' | 'carousel';
  mediaUrls?: string[];
  likes: number;
  comments: number;
  shares?: number;
  views?: number;
  engagementRate?: number;
  hashtags?: string[];
  mentions?: string[];
  url: string;
}

export interface EngagementMetrics {
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalViews?: number;
  averageEngagementRate: number;
  postsAnalyzed: number;
}

export enum Platform {
  INSTAGRAM = 'instagram',
  TIKTOK = 'tiktok',
  TWITTER = 'twitter',
}

export interface PlatformAPIConfig {
  apiKey?: string;
  apiSecret?: string;
  accessToken?: string;
  refreshToken?: string;
  clientId?: string;
  clientSecret?: string;
  webhookUrl?: string;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: Date;
}

export class PlatformAPIError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public platform?: Platform,
    public retryAfter?: number
  ) {
    super(message);
    this.name = 'PlatformAPIError';
  }
}

export interface PlatformAPIResponse<T> {
  data: T;
  rateLimit?: RateLimitInfo;
  nextCursor?: string;
}