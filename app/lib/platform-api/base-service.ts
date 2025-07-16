import { 
  CreatorProfile, 
  Post, 
  EngagementMetrics, 
  Platform, 
  PlatformAPIConfig,
  PlatformAPIError,
  PlatformAPIResponse,
  RateLimitInfo
} from './types';
import { logger } from '../logger';

export interface RateLimitOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
}

export abstract class PlatformAPIService {
  protected config: PlatformAPIConfig;
  protected platform: Platform;
  protected rateLimitInfo: RateLimitInfo | null = null;
  
  protected rateLimitOptions: RateLimitOptions = {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 60000,
    backoffMultiplier: 2,
  };

  constructor(config: PlatformAPIConfig, platform: Platform) {
    this.config = config;
    this.platform = platform;
  }

  abstract getProfile(username: string): Promise<CreatorProfile>;
  
  abstract getRecentPosts(
    username: string, 
    limit?: number, 
    cursor?: string
  ): Promise<PlatformAPIResponse<Post[]>>;
  
  abstract refreshAccessToken(): Promise<void>;

  async calculateEngagement(posts: Post[]): Promise<EngagementMetrics> {
    if (posts.length === 0) {
      return {
        totalLikes: 0,
        totalComments: 0,
        totalShares: 0,
        totalViews: 0,
        averageEngagementRate: 0,
        postsAnalyzed: 0,
      };
    }

    const metrics = posts.reduce(
      (acc, post) => ({
        totalLikes: acc.totalLikes + post.likes,
        totalComments: acc.totalComments + post.comments,
        totalShares: acc.totalShares + (post.shares || 0),
        totalViews: acc.totalViews + (post.views || 0),
      }),
      { totalLikes: 0, totalComments: 0, totalShares: 0, totalViews: 0 }
    );

    const engagementRates = posts
      .map(post => post.engagementRate)
      .filter((rate): rate is number => rate !== undefined);

    const averageEngagementRate = 
      engagementRates.length > 0
        ? engagementRates.reduce((sum, rate) => sum + rate, 0) / engagementRates.length
        : 0;

    return {
      ...metrics,
      averageEngagementRate,
      postsAnalyzed: posts.length,
    };
  }

  protected async rateLimitedRequest<T>(
    fn: () => Promise<T>,
    retryCount = 0
  ): Promise<T> {
    try {
      const result = await fn();
      return result;
    } catch (error) {
      if (error instanceof PlatformAPIError) {
        if (error.statusCode === 429 || error.code === 'RATE_LIMIT_EXCEEDED') {
          if (retryCount >= (this.rateLimitOptions.maxRetries || 3)) {
            throw error;
          }

          const delay = this.calculateBackoffDelay(retryCount, error.retryAfter);
          
          logger.warn(
            `Rate limit hit for ${this.platform}. Retrying after ${delay}ms...`
          );

          await this.sleep(delay);
          return this.rateLimitedRequest(fn, retryCount + 1);
        }
      }
      throw error;
    }
  }

  protected calculateBackoffDelay(retryCount: number, retryAfter?: number): number {
    if (retryAfter) {
      return retryAfter * 1000;
    }

    const delay = Math.min(
      (this.rateLimitOptions.initialDelay || 1000) * 
      Math.pow(this.rateLimitOptions.backoffMultiplier || 2, retryCount),
      this.rateLimitOptions.maxDelay || 60000
    );

    return delay + Math.random() * 1000;
  }

  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  protected handleAPIError(error: any, platform: Platform): never {
    if (error.response) {
      const { status, data } = error.response;
      const message = data?.error?.message || data?.message || 'API request failed';
      const code = data?.error?.code || data?.code || 'UNKNOWN_ERROR';
      
      throw new PlatformAPIError(
        message,
        code,
        status,
        platform,
        error.response.headers?.['retry-after']
      );
    } else if (error.request) {
      throw new PlatformAPIError(
        'No response received from API',
        'NO_RESPONSE',
        undefined,
        platform
      );
    } else {
      throw new PlatformAPIError(
        error.message || 'Unknown error occurred',
        'UNKNOWN_ERROR',
        undefined,
        platform
      );
    }
  }

  protected updateRateLimitInfo(headers: Record<string, any>): void {
    const limit = parseInt(headers['x-rate-limit-limit'] || headers['rate-limit-limit'] || '0');
    const remaining = parseInt(headers['x-rate-limit-remaining'] || headers['rate-limit-remaining'] || '0');
    const reset = parseInt(headers['x-rate-limit-reset'] || headers['rate-limit-reset'] || '0');

    if (limit && reset) {
      this.rateLimitInfo = {
        limit,
        remaining,
        reset: new Date(reset * 1000),
      };
    }
  }

  getRateLimitInfo(): RateLimitInfo | null {
    return this.rateLimitInfo;
  }
}