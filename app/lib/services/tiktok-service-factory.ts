/**
 * TikTokServiceFactory - Factory to create TikTok service instances
 * Uses Apify implementation for all TikTok operations
 */

import { TikTokApifyService, TikTokApifyConfig } from './tiktok-apify-service';
import { logger } from '../logger';

export interface TikTokFactoryConfig {
  apifyConfig?: TikTokApifyConfig;
}

export type TikTokServiceInterface = TikTokApifyService;

/**
 * Factory class to create the TikTok Apify service
 */
export class TikTokServiceFactory {
  private static instance: TikTokServiceInterface | null = null;
  private static currentConfig: TikTokFactoryConfig | null = null;

  /**
   * Create or get TikTok service instance
   */
  static createService(config?: TikTokFactoryConfig): TikTokServiceInterface {
    // Use existing instance if config hasn't changed
    if (this.instance && this.isConfigEqual(config, this.currentConfig)) {
      return this.instance;
    }

    // Use environment variables for defaults
    const finalConfig: TikTokFactoryConfig = {
      apifyConfig: config?.apifyConfig || {
        apifyApiKey: process.env.APIFY_API_KEY!,
        enableCaching: process.env.ENABLE_TIKTOK_CACHE === 'true',
        cacheTTL: parseInt(process.env.TIKTOK_CACHE_TTL || '3600000'),
        maxVideosPerProfile: parseInt(process.env.TIKTOK_MAX_VIDEOS || '50'),
      },
    };

    // Create the Apify service
    if (finalConfig.apifyConfig?.apifyApiKey) {
      logger.info('Creating TikTok Apify service');
      this.instance = new TikTokApifyService(finalConfig.apifyConfig);
    } else {
      throw new Error(
        'TikTok service configuration error: Apify API key must be provided'
      );
    }

    this.currentConfig = finalConfig;
    return this.instance;
  }

  /**
   * Get the current service instance or create with defaults
   */
  static getService(): TikTokServiceInterface {
    if (!this.instance) {
      return this.createService();
    }
    return this.instance;
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  static reset(): void {
    this.instance = null;
    this.currentConfig = null;
  }

  /**
   * Check if the service is using Apify (always true)
   */
  static isUsingApify(): boolean {
    return true;
  }

  /**
   * Check if two configs are equal
   */
  private static isConfigEqual(
    config1?: TikTokFactoryConfig | null,
    config2?: TikTokFactoryConfig | null
  ): boolean {
    // If both are undefined/null, they're equal
    if (!config1 && !config2) return true;
    if (!config1 || !config2) return false;
    
    // Simple comparison - can be enhanced
    return JSON.stringify(config1.apifyConfig) === JSON.stringify(config2.apifyConfig);
  }
}

/**
 * Unified interface wrapper to ensure compatibility
 * This allows both services to be used interchangeably
 */
export class UnifiedTikTokService {
  private service: TikTokServiceInterface;

  constructor(config?: TikTokFactoryConfig) {
    this.service = TikTokServiceFactory.createService(config);
  }

  /**
   * Get user profile
   */
  async getUserProfile(usernameOrToken?: string): Promise<any> {
    // Apify service expects username
    if (!usernameOrToken) {
      throw new Error('Username is required for TikTok service');
    }
    return this.service.getUserProfile(usernameOrToken);
  }

  /**
   * Get user videos
   */
  async getUserVideos(
    username: string,
    limit: number = 30,
    cursor?: string
  ): Promise<any> {
    return this.service.getUserVideos(username, limit, cursor);
  }

  /**
   * Get video insights
   */
  async getVideoInsights(videoId: string): Promise<any> {
    return this.service.getVideoInsights(videoId);
  }

  /**
   * Get user insights
   */
  async getUserInsights(username: string): Promise<any> {
    return this.service.getUserInsights(username);
  }

  /**
   * Search profiles by keywords
   */
  async searchProfiles(keywords: string[], limit: number = 50): Promise<any> {
    return this.service.searchProfiles(keywords, limit);
  }

  /**
   * Search users - wrapper for backward compatibility
   */
  async searchUsers(query: string, limit: number = 10): Promise<any> {
    // Convert single query to keywords array
    const keywords = query.split(' ').filter(k => k.trim());
    return this.searchProfiles(keywords, limit);
  }


  /**
   * Check if using Apify (always true)
   */
  isUsingApify(): boolean {
    return true;
  }
}

// Export a function to get default instance for backward compatibility
export function getDefaultTikTokService(): UnifiedTikTokService {
  return new UnifiedTikTokService();
}