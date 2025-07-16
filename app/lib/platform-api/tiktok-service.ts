/**
 * TikTok API Service (Legacy - replaced by Apify)
 * This is a stub for backward compatibility
 */

import { BaseAPIService } from './base-service';
import { PlatformAPIConfig } from './types';

export class TikTokAPIService extends BaseAPIService {
  constructor(config: PlatformAPIConfig) {
    super(config);
  }

  async getProfile(userId?: string): Promise<any> {
    throw new Error('TikTok API service not implemented. Use Apify mode instead.');
  }

  async getRecentPosts(userId: string, limit?: number): Promise<any[]> {
    throw new Error('TikTok API service not implemented. Use Apify mode instead.');
  }

  async refreshAccessToken(): Promise<void> {
    throw new Error('TikTok API service not implemented. Use Apify mode instead.');
  }
}