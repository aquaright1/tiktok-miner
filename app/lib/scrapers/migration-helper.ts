/**
 * MigrationHelper - Utilities for gradual migration from API to Apify scrapers
 */

import { Platform } from '../platform-api/types';
import { ScraperFactory } from './scraper-factory';
import { logger } from '../logger';

export interface MigrationConfig {
  // Percentage of traffic to route to Apify (0-100)
  trafficPercentage: number;
  // Specific user IDs to always use Apify for
  userAllowlist?: string[];
  // Specific user IDs to never use Apify for
  userBlocklist?: string[];
  // Enable A/B testing mode
  abTestingEnabled?: boolean;
  // Session ID for consistent routing
  sessionId?: string;
}

export class MigrationHelper {
  private static configs: Map<Platform, MigrationConfig> = new Map();
  private static metrics: Map<string, number> = new Map();

  /**
   * Configure migration for a platform
   */
  static configureMigration(platform: Platform, config: MigrationConfig) {
    this.configs.set(platform, config);
    logger.info(`Migration configured for ${platform}`, config);
  }

  /**
   * Determine if a request should use Apify
   */
  static shouldUseApify(
    platform: Platform,
    userId?: string,
    requestId?: string
  ): boolean {
    const config = this.configs.get(platform);
    if (!config) {
      return false;
    }

    // Check user allowlist
    if (userId && config.userAllowlist?.includes(userId)) {
      this.recordDecision(platform, true, 'allowlist');
      return true;
    }

    // Check user blocklist
    if (userId && config.userBlocklist?.includes(userId)) {
      this.recordDecision(platform, false, 'blocklist');
      return false;
    }

    // Use traffic percentage
    const useApify = this.isInTrafficPercentage(
      config.trafficPercentage,
      requestId || userId || Math.random().toString()
    );

    this.recordDecision(platform, useApify, 'traffic');
    return useApify;
  }

  /**
   * Check if request falls within traffic percentage
   */
  private static isInTrafficPercentage(
    percentage: number,
    identifier: string
  ): boolean {
    if (percentage <= 0) return false;
    if (percentage >= 100) return true;

    // Use consistent hashing for deterministic routing
    const hash = this.hashString(identifier);
    const bucket = hash % 100;
    return bucket < percentage;
  }

  /**
   * Simple hash function for consistent routing
   */
  private static hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Record routing decision for monitoring
   */
  private static recordDecision(
    platform: Platform,
    useApify: boolean,
    reason: string
  ) {
    const key = `${platform}_${useApify ? 'apify' : 'api'}_${reason}`;
    this.metrics.set(key, (this.metrics.get(key) || 0) + 1);
  }

  /**
   * Get migration metrics
   */
  static getMetrics(platform?: Platform): Record<string, number> {
    const result: Record<string, number> = {};
    
    for (const [key, value] of this.metrics.entries()) {
      if (!platform || key.startsWith(platform)) {
        result[key] = value;
      }
    }
    
    return result;
  }

  /**
   * Get migration status for all platforms
   */
  static getMigrationStatus(): Record<Platform, {
    configured: boolean;
    trafficPercentage: number;
    totalRequests: number;
    apifyRequests: number;
  }> {
    const status: any = {};
    
    for (const platform of Object.values(Platform)) {
      const config = this.configs.get(platform);
      const apifyKey = `${platform}_apify_`;
      const apiKey = `${platform}_api_`;
      
      let apifyRequests = 0;
      let apiRequests = 0;
      
      for (const [key, value] of this.metrics.entries()) {
        if (key.startsWith(apifyKey)) {
          apifyRequests += value;
        } else if (key.startsWith(apiKey)) {
          apiRequests += value;
        }
      }
      
      status[platform] = {
        configured: !!config,
        trafficPercentage: config?.trafficPercentage || 0,
        totalRequests: apifyRequests + apiRequests,
        apifyRequests,
      };
    }
    
    return status;
  }

  /**
   * Gradually increase traffic percentage
   */
  static async graduateTraffic(
    platform: Platform,
    targetPercentage: number,
    incrementPercentage: number = 10,
    delayMs: number = 3600000 // 1 hour default
  ): Promise<void> {
    const currentConfig = this.configs.get(platform) || { trafficPercentage: 0 };
    let currentPercentage = currentConfig.trafficPercentage;

    while (currentPercentage < targetPercentage) {
      currentPercentage = Math.min(
        currentPercentage + incrementPercentage,
        targetPercentage
      );

      this.configureMigration(platform, {
        ...currentConfig,
        trafficPercentage: currentPercentage,
      });

      logger.info(`Graduated ${platform} traffic to ${currentPercentage}%`);

      if (currentPercentage < targetPercentage) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  /**
   * Reset metrics
   */
  static resetMetrics(platform?: Platform) {
    if (platform) {
      for (const key of this.metrics.keys()) {
        if (key.startsWith(platform)) {
          this.metrics.delete(key);
        }
      }
    } else {
      this.metrics.clear();
    }
  }
}