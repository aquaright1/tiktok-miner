/**
 * ActorManager - Manages Apify actor configurations and runs
 */

import { ApifyClient } from './client';
import { logger } from '../logger';
import { APITrackingMiddleware } from '../middleware/api-tracking';
import {
  ActorStartOptions,
  ActorRun,
  ActorCallResult,
  DatasetItem,
  InstagramScraperInput,
  TikTokScraperInput,
  WebhookConfig,
  ApifyActorConfig,
} from './apify-types';
import { getActorConfig, WEBHOOK_EVENTS } from './config';

export interface ActorManagerConfig {
  apiKey: string;
  baseUrl?: string;
  webhookUrl?: string;
  maxRetries?: number;
  requestTimeoutMs?: number;
}

export class ActorManager {
  private client: ApifyClient;
  private config: ActorManagerConfig;
  private actorConfigs: Map<string, ApifyActorConfig> = new Map();
  private tracker: APITrackingMiddleware;

  constructor(config: ActorManagerConfig) {
    this.config = config;
    this.client = new ApifyClient({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      maxRetries: config.maxRetries,
      requestTimeoutMs: config.requestTimeoutMs,
    });
    this.tracker = new APITrackingMiddleware();

    // Pre-load actor configurations
    this.loadActorConfigs();
  }

  /**
   * Load actor configurations for all supported platforms
   */
  private loadActorConfigs() {
    const platforms = ['instagram', 'tiktok', 'youtube', 'twitter', 'youtubePosts', 'instagramPosts'];
    
    platforms.forEach(platform => {
      try {
        const config = getActorConfig(platform);
        this.actorConfigs.set(platform, config);
        logger.info(`Loaded actor config for ${platform}`, { actorId: config.actorId });
      } catch (error) {
        logger.warn(`Failed to load actor config for ${platform}`, { error });
      }
    });
  }

  /**
   * Get actor configuration for a platform
   */
  getActorConfigForPlatform(platform: string): ApifyActorConfig | null {
    return this.actorConfigs.get(platform.toLowerCase()) || null;
  }

  /**
   * Scrape Instagram profile
   */
  async scrapeInstagramProfile(username: string, options?: Partial<InstagramScraperInput>): Promise<ActorCallResult> {
    const actorConfig = this.actorConfigs.get('instagram');
    if (!actorConfig) {
      throw new Error('Instagram actor configuration not found');
    }

    const input: InstagramScraperInput = {
      ...actorConfig.defaultInput,
      ...options,
      directUrls: [`https://www.instagram.com/${username}/`],
      resultsType: 'details',
    };

    logger.info('Starting Instagram scraper', { username, input });

    return this.runActor('instagram', input, actorConfig.defaultRunOptions);
  }

  /**
   * Search Instagram profiles by keywords
   */
  async searchInstagramProfiles(keywords: string[], options?: Partial<InstagramScraperInput>): Promise<ActorCallResult> {
    const actorConfig = this.actorConfigs.get('instagram');
    if (!actorConfig) {
      throw new Error('Instagram actor configuration not found');
    }

    const input: InstagramScraperInput = {
      ...actorConfig.defaultInput,
      ...options,
      search: keywords.join(' '),
      searchType: 'user',
      searchLimit: options?.searchLimit || 100,
      resultsType: 'details',
      resultsLimit: options?.resultsLimit || 100,
    };

    logger.info('Starting Instagram profile search', { keywords, input });

    return this.runActor('instagram', input, actorConfig.defaultRunOptions);
  }

  /**
   * Scrape TikTok profile
   */
  async scrapeTikTokProfile(username: string, options?: Partial<TikTokScraperInput>): Promise<ActorCallResult> {
    const actorConfig = this.actorConfigs.get('tiktok');
    if (!actorConfig) {
      throw new Error('TikTok actor configuration not found');
    }

    const input: TikTokScraperInput = {
      ...actorConfig.defaultInput,
      ...options,
      profiles: [`https://www.tiktok.com/@${username}`],
    };

    logger.info('Starting TikTok scraper', { username, input });

    return this.runActor('tiktok', input, actorConfig.defaultRunOptions);
  }

  /**
   * Search TikTok profiles by keywords
   */
  async searchTikTokProfiles(keywords: string[], options?: Partial<TikTokScraperInput>): Promise<ActorCallResult> {
    const actorConfig = this.actorConfigs.get('tiktok');
    if (!actorConfig) {
      throw new Error('TikTok actor configuration not found');
    }

    const input: TikTokScraperInput = {
      ...actorConfig.defaultInput,
      ...options,
      searchQueries: keywords,
      resultsPerPage: options?.resultsPerPage || 100,
      maxProfilesPerQuery: options?.maxProfilesPerQuery || 50,
      excludePinnedPosts: false,
      profileScrapeSections: ['videos'],
      proxyCountryCode: 'None',
      scrapeRelatedVideos: false,
      shouldDownloadAvatars: false,
      shouldDownloadCovers: false,
      shouldDownloadMusicCovers: false,
      shouldDownloadSlideshowImages: false,
      shouldDownloadSubtitles: false,
      shouldDownloadVideos: false,
    };

    logger.info('Starting TikTok profile search', { keywords, input });

    return this.runActor('tiktok', input, actorConfig.defaultRunOptions);
  }

  /**
   * Scrape YouTube channel
   */
  async scrapeYouTubeChannel(channelUrl: string, options?: any): Promise<ActorCallResult> {
    const actorConfig = this.actorConfigs.get('youtube');
    if (!actorConfig) {
      throw new Error('YouTube actor configuration not found');
    }

    const input = {
      ...actorConfig.defaultInput,
      ...options,
      startUrls: [{ url: channelUrl }],
    };

    logger.info('Starting YouTube channel scraper', { channelUrl, input });

    return this.runActor('youtube', input, actorConfig.defaultRunOptions);
  }

  /**
   * Search YouTube videos by keywords
   */
  async searchYouTubeVideos(keywords: string[], options?: any): Promise<ActorCallResult> {
    const actorConfig = this.actorConfigs.get('youtubePosts');
    if (!actorConfig) {
      throw new Error('YouTube posts actor configuration not found');
    }

    const input = {
      ...actorConfig.defaultInput,
      ...options,
      searchKeywords: keywords,
      startUrls: [],
    };

    logger.info('Starting YouTube video search', { keywords, input });

    return this.runActor('youtubePosts', input, actorConfig.defaultRunOptions);
  }

  /**
   * Scrape Twitter profile
   */
  async scrapeTwitterProfile(username: string, options?: any): Promise<ActorCallResult> {
    const actorConfig = this.actorConfigs.get('twitter');
    if (!actorConfig) {
      throw new Error('Twitter actor configuration not found');
    }

    const input = {
      ...actorConfig.defaultInput,
      ...options,
      startUrls: [{ url: `https://twitter.com/${username}` }],
    };

    logger.info('Starting Twitter scraper', { username, input });

    return this.runActor('twitter', input, actorConfig.defaultRunOptions);
  }


  /**
   * Run an actor with retry logic
   */
  private async runActor(
    platform: string,
    input: any,
    runOptions?: any
  ): Promise<ActorCallResult> {
    const actorConfig = this.actorConfigs.get(platform);
    if (!actorConfig) {
      throw new Error(`Actor configuration not found for platform: ${platform}`);
    }

    let lastError: Error | null = null;
    let attempt = 0;
    const maxRetries = actorConfig.maxRetries || 3;

    while (attempt < maxRetries) {
      try {
        attempt++;
        logger.info(`Running actor for ${platform}, attempt ${attempt}/${maxRetries}`);

        const startOptions: ActorStartOptions = {
          actorId: actorConfig.actorId,
          input,
          ...runOptions,
          webhooks: this.getWebhooksForPlatform(platform),
          waitForFinish: runOptions?.waitForFinish || 300, // Default 5 minutes
        };

        // Track the API call
        let result;
        try {
          result = await this.tracker.trackApify(
            actorConfig.actorId,
            `/actors/${actorConfig.actorId}/runs`,
            async () => this.client.callActor(startOptions),
            {
              metadata: {
                platform,
                input,
                runOptions,
              }
            }
          );
        } catch (trackingError: any) {
          // If tracking fails, try without tracking
          logger.warn('API tracking failed, proceeding without tracking', { error: trackingError.message });
          result = await this.client.callActor(startOptions);
        }
        
        // Track compute units and dataset operations after run completes
        if (result.runId) {
          try {
            const runStatus = await this.client.getRunStatus(result.runId);
            const stats = runStatus.usage || {};
            
            if (stats.computeUnits || stats.datasetItemCount) {
              await this.tracker.trackApify(
                actorConfig.actorId,
                `/actors/${actorConfig.actorId}/runs/${result.runId}/stats`,
                async () => ({ stats }),
                {
                  computeUnits: stats.computeUnits || 0,
                  datasetOperations: stats.datasetItemCount || 0,
                  metadata: {
                    platform,
                    runId: result.runId,
                    status: result.status,
                    duration: stats.runTimeSecs,
                  }
                }
              );
            }
          } catch (error) {
            logger.error('Failed to track Apify run stats:', error);
          }
        }
        
        logger.info(`Actor run completed for ${platform}`, {
          runId: result.runId,
          status: result.status,
          datasetId: result.datasetId,
        });

        return result;
      } catch (error: any) {
        lastError = error;
        logger.error(`Actor run failed for ${platform}, attempt ${attempt}/${maxRetries}`, {
          error: error.message,
          attempt,
        });

        if (attempt < maxRetries) {
          const delayMs = actorConfig.retryDelayMs || 2000;
          await this.sleep(delayMs * attempt); // Exponential backoff
        }
      }
    }

    throw lastError || new Error(`Failed to run actor for ${platform} after ${maxRetries} attempts`);
  }

  /**
   * Get run status
   */
  async getRunStatus(runId: string): Promise<ActorRun> {
    return this.client.getRunStatus(runId);
  }

  /**
   * Get dataset items from a run
   */
  async getRunDataset(datasetId: string): Promise<DatasetItem[]> {
    try {
      return await this.tracker.trackApify(
        'dataset-read',
        `/datasets/${datasetId}/items`,
        async () => {
          const items = await this.client.getAllDatasetItems(datasetId);
          return items;
        },
        {
          datasetOperations: 1, // Count as one operation
          metadata: {
            datasetId,
            operation: 'read-all',
          }
        }
      );
    } catch (trackingError: any) {
      // If tracking fails, try without tracking
      logger.warn('Dataset tracking failed, proceeding without tracking', { error: trackingError.message });
      return await this.client.getAllDatasetItems(datasetId);
    }
  }

  /**
   * Abort a run
   */
  async abortRun(runId: string): Promise<ActorRun> {
    return this.client.abortRun(runId);
  }

  /**
   * Register webhooks for all configured actors
   */
  async registerWebhooksForAllActors(): Promise<void> {
    if (!this.config.webhookUrl) {
      logger.warn('No webhook URL configured, skipping webhook registration');
      return;
    }

    for (const [platform, config] of this.actorConfigs.entries()) {
      try {
        const webhook = this.createWebhookConfig(platform);
        await this.client.registerWebhook(config.actorId, webhook);
        logger.info(`Registered webhook for ${platform} actor`, { actorId: config.actorId });
      } catch (error) {
        logger.error(`Failed to register webhook for ${platform}`, { error });
      }
    }
  }

  /**
   * Get webhooks configuration for a platform
   */
  private getWebhooksForPlatform(platform: string): WebhookConfig[] | undefined {
    if (!this.config.webhookUrl) {
      return undefined;
    }

    return [this.createWebhookConfig(platform)];
  }

  /**
   * Create webhook configuration
   */
  private createWebhookConfig(platform: string): WebhookConfig {
    return {
      eventTypes: [
        WEBHOOK_EVENTS.runSucceeded as any,
        WEBHOOK_EVENTS.runFailed as any,
      ],
      requestUrl: `${this.config.webhookUrl}?platform=${platform}`,
      description: `Webhook for ${platform} actor runs`,
      isAdHoc: true,
    };
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validate client connection
   */
  async validateConnection(): Promise<boolean> {
    return this.client.validateApiKey();
  }

  /**
   * Get account usage and limits
   */
  async getAccountInfo() {
    const [user, limits] = await Promise.all([
      this.client.getCurrentUser(),
      this.client.getAccountLimits(),
    ]);

    return {
      user,
      limits,
    };
  }
}