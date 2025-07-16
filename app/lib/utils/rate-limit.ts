import { RATE_LIMIT_WINDOW, RATE_LIMIT_MAX_REQUESTS } from '../config';

export interface RateLimitOptions {
  window?: number;
  maxRequests?: number;
}

export class RateLimiter {
  private static instance: RateLimiter;
  private requests: Map<string, number[]>;
  private window: number;
  private maxRequests: number;

  private constructor() {
    this.requests = new Map();
    this.window = RATE_LIMIT_WINDOW;
    this.maxRequests = RATE_LIMIT_MAX_REQUESTS;
  }

  public static getInstance(): RateLimiter {
    if (!RateLimiter.instance) {
      RateLimiter.instance = new RateLimiter();
    }
    return RateLimiter.instance;
  }

  public isAllowed(key: string, options: RateLimitOptions = {}): boolean {
    const window = options.window || this.window;
    const maxRequests = options.maxRequests || this.maxRequests;

    const now = Date.now();
    const timestamps = this.requests.get(key) || [];

    // Remove old timestamps
    const recentTimestamps = timestamps.filter(
      timestamp => now - timestamp < window
    );

    // Check if we're over the limit
    if (recentTimestamps.length >= maxRequests) {
      return false;
    }

    // Add new timestamp
    recentTimestamps.push(now);
    this.requests.set(key, recentTimestamps);

    return true;
  }

  public getRemainingRequests(key: string, options: RateLimitOptions = {}): number {
    const window = options.window || this.window;
    const maxRequests = options.maxRequests || this.maxRequests;

    const now = Date.now();
    const timestamps = this.requests.get(key) || [];

    // Remove old timestamps
    const recentTimestamps = timestamps.filter(
      timestamp => now - timestamp < window
    );

    return Math.max(0, maxRequests - recentTimestamps.length);
  }

  public getResetTime(key: string, options: RateLimitOptions = {}): number {
    const window = options.window || this.window;
    const timestamps = this.requests.get(key) || [];

    if (timestamps.length === 0) {
      return 0;
    }

    const oldestTimestamp = Math.min(...timestamps);
    return oldestTimestamp + window;
  }

  public clear(key: string): void {
    this.requests.delete(key);
  }

  public clearAll(): void {
    this.requests.clear();
  }

  public getRequestCount(key: string, options: RateLimitOptions = {}): number {
    const window = options.window || this.window;
    const timestamps = this.requests.get(key) || [];

    const now = Date.now();
    return timestamps.filter(timestamp => now - timestamp < window).length;
  }

  public getWindow(key: string): number {
    return this.window;
  }

  public setWindow(window: number): void {
    this.window = window;
  }

  public getMaxRequests(key: string): number {
    return this.maxRequests;
  }

  public setMaxRequests(maxRequests: number): void {
    this.maxRequests = maxRequests;
  }

  public getKeys(): string[] {
    return Array.from(this.requests.keys());
  }

  public hasKey(key: string): boolean {
    return this.requests.has(key);
  }

  public getSize(): number {
    return this.requests.size;
  }

  public shrink(): void {
    const now = Date.now();
    for (const [key, timestamps] of this.requests.entries()) {
      const recentTimestamps = timestamps.filter(
        timestamp => now - timestamp < this.window
      );

      if (recentTimestamps.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, recentTimestamps);
      }
    }
  }
} 