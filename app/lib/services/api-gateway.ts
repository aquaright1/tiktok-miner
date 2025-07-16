import { RateLimiterMemory } from 'rate-limiter-flexible';
import { APIUsageTracker } from './api-usage-tracker';

export interface RateLimitConfig {
  windowMs: number;
  max: number;
}

export interface APIGatewayConfig {
  rateLimits: {
    youtube?: RateLimitConfig;
    twitter?: RateLimitConfig;
    instagram?: RateLimitConfig;
    tiktok?: RateLimitConfig;
    linkedin?: RateLimitConfig;
  };
}

export class APIGatewayService {
  private rateLimiters: Map<string, RateLimiterMemory> = new Map();
  private usageTracker: APIUsageTracker;
  
  constructor(private config: APIGatewayConfig) {
    this.usageTracker = new APIUsageTracker();
    this.initializeRateLimiters();
  }

  private initializeRateLimiters() {
    // Default rate limits based on free tier limits
    const defaultLimits = {
      youtube: { points: 10000, duration: 86400 }, // 10k per day
      twitter: { points: 500000, duration: 2592000 }, // 500k per month
      instagram: { points: 200, duration: 3600 }, // 200 per hour
      tiktok: { points: 1000, duration: 86400 }, // 1k per day (estimated)
      linkedin: { points: 100, duration: 86400 } // 100 per day (estimated)
    };

    for (const [platform, limits] of Object.entries(defaultLimits)) {
      this.rateLimiters.set(platform, new RateLimiterMemory(limits));
    }
  }

  /**
   * Make an API request with rate limiting and tracking
   */
  async makeRequest<T>(
    platform: string,
    endpoint: string,
    requestFn: () => Promise<T>,
    options?: {
      cost?: number;
      retries?: number;
      backoffMs?: number;
    }
  ): Promise<T> {
    const cost = options?.cost || 1;
    const maxRetries = options?.retries || 3;
    const backoffMs = options?.backoffMs || 1000;

    // Check rate limit
    const rateLimiter = this.rateLimiters.get(platform);
    if (!rateLimiter) {
      throw new Error(`No rate limiter configured for platform: ${platform}`);
    }

    try {
      await rateLimiter.consume(platform, cost);
    } catch (rejRes: any) {
      const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
      throw new Error(`Rate limit exceeded for ${platform}. Retry after ${secs} seconds`);
    }

    // Execute request with retry logic
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const startTime = Date.now();
        const result = await requestFn();
        const responseTime = Date.now() - startTime;

        // Track successful request
        await this.usageTracker.trackAPICall(
          platform,
          null,
          endpoint,
          cost,
          200,
          responseTime
        );

        return result;
      } catch (error: any) {
        lastError = error;
        
        // Track failed request
        await this.usageTracker.trackAPICall(
          platform,
          null,
          endpoint,
          cost,
          error.status || 500,
          0,
          error.message
        );

        // Check if error is retryable
        if (this.isRetryableError(error) && attempt < maxRetries - 1) {
          // Exponential backoff
          const delay = backoffMs * Math.pow(2, attempt);
          await this.sleep(delay);
          continue;
        }

        throw error;
      }
    }

    throw lastError || new Error('Request failed after all retries');
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: any): boolean {
    // Network errors
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      return true;
    }

    // HTTP status codes that are retryable
    const retryableStatuses = [429, 502, 503, 504];
    if (error.status && retryableStatuses.includes(error.status)) {
      return true;
    }

    // Platform-specific retryable errors
    if (error.message?.includes('rate limit') || 
        error.message?.includes('temporarily unavailable')) {
      return true;
    }

    return false;
  }

  /**
   * Get current rate limit status for all platforms
   */
  async getRateLimitStatus(): Promise<Record<string, any>> {
    const status: Record<string, any> = {};

    for (const [platform, limiter] of this.rateLimiters.entries()) {
      const points = await limiter.get(platform);
      status[platform] = {
        remaining: points ? limiter.points - points.consumedPoints : limiter.points,
        limit: limiter.points,
        reset: points ? new Date(Date.now() + points.msBeforeNext) : null
      };
    }

    return status;
  }

  /**
   * Reset rate limits for a platform (useful for testing)
   */
  async resetRateLimit(platform: string): Promise<void> {
    const limiter = this.rateLimiters.get(platform);
    if (limiter) {
      await limiter.delete(platform);
    }
  }

  /**
   * Helper sleep function
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Configure custom rate limits
   */
  setRateLimit(platform: string, config: { points: number; duration: number }): void {
    this.rateLimiters.set(platform, new RateLimiterMemory(config));
  }

  /**
   * Get usage tracker instance
   */
  getUsageTracker(): APIUsageTracker {
    return this.usageTracker;
  }
}