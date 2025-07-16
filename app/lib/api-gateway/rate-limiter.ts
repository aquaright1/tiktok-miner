import { APIGatewayError, RateLimitState } from './types';
import { logger } from '../logger';

export interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (identifier: string) => string;
  onLimitReached?: (identifier: string) => void;
}

export class RateLimiter {
  private limits: Map<string, RateLimitState> = new Map();
  private cleanupInterval: NodeJS.Timer;

  constructor(private options: RateLimiterOptions) {
    // Clean up expired windows every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  async checkLimit(identifier: string): Promise<void> {
    const key = this.options.keyGenerator ? this.options.keyGenerator(identifier) : identifier;
    const now = new Date();
    
    let state = this.limits.get(key);
    
    // Initialize or reset if window expired
    if (!state || now > state.windowEnd) {
      state = {
        requests: 0,
        windowStart: now,
        windowEnd: new Date(now.getTime() + this.options.windowMs)
      };
      this.limits.set(key, state);
    }
    
    // Check if limit exceeded
    if (state.requests >= this.options.maxRequests) {
      const resetTime = state.windowEnd;
      const waitTime = resetTime.getTime() - now.getTime();
      
      if (this.options.onLimitReached) {
        this.options.onLimitReached(identifier);
      }
      
      logger.warn(`Rate limit exceeded for ${identifier}. Reset in ${waitTime}ms`);
      
      throw new APIGatewayError(
        'Rate limit exceeded',
        'RATE_LIMIT_EXCEEDED',
        429,
        undefined,
        {
          limit: this.options.maxRequests,
          reset: resetTime,
          retryAfter: Math.ceil(waitTime / 1000)
        }
      );
    }
    
    // Increment request count
    state.requests++;
  }

  getRateLimitInfo(identifier: string): {
    limit: number;
    remaining: number;
    reset: Date;
  } | null {
    const key = this.options.keyGenerator ? this.options.keyGenerator(identifier) : identifier;
    const state = this.limits.get(key);
    
    if (!state) {
      return {
        limit: this.options.maxRequests,
        remaining: this.options.maxRequests,
        reset: new Date(Date.now() + this.options.windowMs)
      };
    }
    
    const now = new Date();
    if (now > state.windowEnd) {
      return {
        limit: this.options.maxRequests,
        remaining: this.options.maxRequests,
        reset: new Date(now.getTime() + this.options.windowMs)
      };
    }
    
    return {
      limit: this.options.maxRequests,
      remaining: Math.max(0, this.options.maxRequests - state.requests),
      reset: state.windowEnd
    };
  }

  reset(identifier: string): void {
    const key = this.options.keyGenerator ? this.options.keyGenerator(identifier) : identifier;
    this.limits.delete(key);
  }

  private cleanup(): void {
    const now = new Date();
    const expiredKeys: string[] = [];
    
    this.limits.forEach((state, key) => {
      if (now > state.windowEnd) {
        expiredKeys.push(key);
      }
    });
    
    expiredKeys.forEach(key => {
      this.limits.delete(key);
    });
    
    if (expiredKeys.length > 0) {
      logger.debug(`Cleaned up ${expiredKeys.length} expired rate limit entries`);
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.limits.clear();
  }
}

export class TokenBucketRateLimiter {
  private buckets: Map<string, {
    tokens: number;
    lastRefill: Date;
  }> = new Map();
  
  constructor(
    private capacity: number,
    private refillRate: number, // tokens per second
    private keyGenerator?: (identifier: string) => string
  ) {}

  async checkLimit(identifier: string, tokensRequired: number = 1): Promise<void> {
    const key = this.keyGenerator ? this.keyGenerator(identifier) : identifier;
    const now = new Date();
    
    let bucket = this.buckets.get(key);
    
    if (!bucket) {
      bucket = {
        tokens: this.capacity,
        lastRefill: now
      };
      this.buckets.set(key, bucket);
    }
    
    // Calculate tokens to add based on time elapsed
    const timeSinceRefill = (now.getTime() - bucket.lastRefill.getTime()) / 1000;
    const tokensToAdd = timeSinceRefill * this.refillRate;
    
    bucket.tokens = Math.min(this.capacity, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
    
    if (bucket.tokens < tokensRequired) {
      const tokensNeeded = tokensRequired - bucket.tokens;
      const waitTime = (tokensNeeded / this.refillRate) * 1000;
      
      throw new APIGatewayError(
        'Rate limit exceeded',
        'RATE_LIMIT_EXCEEDED',
        429,
        undefined,
        {
          tokensAvailable: bucket.tokens,
          tokensRequired,
          retryAfter: Math.ceil(waitTime / 1000)
        }
      );
    }
    
    bucket.tokens -= tokensRequired;
  }

  getTokensAvailable(identifier: string): number {
    const key = this.keyGenerator ? this.keyGenerator(identifier) : identifier;
    const bucket = this.buckets.get(key);
    
    if (!bucket) {
      return this.capacity;
    }
    
    const now = new Date();
    const timeSinceRefill = (now.getTime() - bucket.lastRefill.getTime()) / 1000;
    const tokensToAdd = timeSinceRefill * this.refillRate;
    
    return Math.min(this.capacity, bucket.tokens + tokensToAdd);
  }
}