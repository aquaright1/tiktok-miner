/**
 * ScraperFactory - Factory for creating platform scrapers with feature flag support
 */

import { Platform, PlatformAPIConfig } from '../platform-api/types';
import { PlatformAPIService } from '../platform-api/base-service';
import { logger } from '../logger';

export interface ScraperConfig extends PlatformAPIConfig {
  useApifyScrapers?: boolean;
  apifyApiKey?: string;
  platformOverrides?: {
    [key in Platform]?: boolean;
  };
}

export class ScraperFactory {
  private static config: ScraperConfig = {
    useApifyScrapers: false,
    platformOverrides: {},
  };

  /**
   * Configure the scraper factory
   */
  static configure(config: ScraperConfig) {
    this.config = { ...this.config, ...config };
    logger.info('ScraperFactory configured', {
      useApifyScrapers: this.config.useApifyScrapers,
      platformOverrides: this.config.platformOverrides,
    });
  }

  /**
   * Get configuration
   */
  static getConfig(): ScraperConfig {
    return { ...this.config };
  }

  /**
   * Create a platform service instance
   */
  static createService(platform: Platform, config?: PlatformAPIConfig): PlatformAPIService {
    const mergedConfig = { ...this.config, ...config };
    
    // Check if Apify scrapers should be used for this platform
    const useApify = this.shouldUseApifyScraper(platform);
    
    logger.info(`Creating ${platform} service`, { useApify });

    switch (platform) {
      case Platform.TIKTOK:
        // TODO: Implement TikTok scraper
        throw new Error('TikTok scraper not yet implemented');
      
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }



  /**
   * Determine if Apify scraper should be used for a platform
   */
  private static shouldUseApifyScraper(platform: Platform): boolean {
    // Check platform-specific override first
    if (this.config.platformOverrides?.[platform] !== undefined) {
      return this.config.platformOverrides[platform];
    }
    
    // Fall back to global setting
    return this.config.useApifyScrapers || false;
  }

  /**
   * Enable Apify scrapers globally
   */
  static enableApifyScrapers(apiKey: string) {
    this.configure({
      useApifyScrapers: true,
      apifyApiKey: apiKey,
    });
  }

  /**
   * Enable Apify scraper for specific platform
   */
  static enableApifyForPlatform(platform: Platform, apiKey?: string) {
    const currentConfig = this.getConfig();
    this.configure({
      ...currentConfig,
      apifyApiKey: apiKey || currentConfig.apifyApiKey,
      platformOverrides: {
        ...currentConfig.platformOverrides,
        [platform]: true,
      },
    });
  }

  /**
   * Disable Apify scraper for specific platform
   */
  static disableApifyForPlatform(platform: Platform) {
    const currentConfig = this.getConfig();
    this.configure({
      ...currentConfig,
      platformOverrides: {
        ...currentConfig.platformOverrides,
        [platform]: false,
      },
    });
  }

  /**
   * Get feature flag status
   */
  static getFeatureStatus(): {
    globalEnabled: boolean;
    platformStatus: Record<Platform, boolean>;
  } {
    const status: Record<Platform, boolean> = {} as any;
    
    for (const platform of Object.values(Platform)) {
      status[platform] = this.shouldUseApifyScraper(platform);
    }
    
    return {
      globalEnabled: this.config.useApifyScrapers || false,
      platformStatus: status,
    };
  }
}