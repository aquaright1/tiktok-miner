/**
 * ApifyClient - Core client for interacting with Apify API
 */

import { ApifyClient as ApifySDKClient } from 'apify-client';
import { logger } from '../logger';
import {
  ApifyConfig,
  ActorRun,
  ActorStartOptions,
  ActorCallResult,
  ActorRunStatus,
  DatasetListOptions,
  DatasetItem,
  KeyValueStoreRecord,
  ApifyError,
  ActorInfo,
  PaginatedList,
  WebhookConfig,
  WebhookEventType,
} from './apify-types';

export class ApifyClient {
  private client: ApifySDKClient;
  private config: ApifyConfig;
  private apiKey: string;

  constructor(config: ApifyConfig) {
    this.config = config;
    this.apiKey = config.apiKey || process.env.APIFY_API_KEY || '';

    if (!this.apiKey) {
      throw new Error('Apify API key is required. Set APIFY_API_KEY environment variable or pass it in config.');
    }

    // Initialize the official Apify client
    this.client = new ApifySDKClient({
      token: this.apiKey,
      baseUrl: config.baseUrl,
      maxRetries: config.maxRetries || 3,
    });

    logger.info('ApifyClient initialized', {
      baseUrl: config.baseUrl || 'https://api.apify.com',
      maxRetries: config.maxRetries || 3,
    });
  }

  /**
   * Validate API key by making a test API call
   */
  async validateApiKey(): Promise<boolean> {
    try {
      const user = await this.client.user().get();
      logger.info('Apify API key validated successfully', { userId: user.id });
      return true;
    } catch (error) {
      logger.error('Failed to validate Apify API key', { error });
      return false;
    }
  }

  /**
   * Get current user information
   */
  async getCurrentUser() {
    try {
      const user = await this.client.user().get();
      return user;
    } catch (error) {
      throw this.handleError(error, 'Failed to get current user');
    }
  }

  /**
   * Get account limits and usage
   */
  async getAccountLimits() {
    try {
      const user = await this.client.user().get();
      return {
        monthlyUsage: user.proxy?.groups?.RESIDENTIAL?.monthlyUsage || 0,
        monthlyLimit: user.limits?.monthlyUsage || 0,
        availableBalance: user.balance || 0,
      };
    } catch (error) {
      throw this.handleError(error, 'Failed to get account limits');
    }
  }

  /**
   * Start an actor run
   */
  async startActor(options: ActorStartOptions): Promise<ActorRun> {
    try {
      logger.info('Starting actor', { actorId: options.actorId });

      const actor = this.client.actor(options.actorId);
      // Map our options to Apify SDK format
      const runOptions: any = {
        build: options.build,
        memory: options.memoryMbytes,
        timeout: options.timeoutSecs,
        webhooks: options.webhooks,
      };

      // Remove undefined values
      Object.keys(runOptions).forEach(key => {
        if (runOptions[key] === undefined) {
          delete runOptions[key];
        }
      });

      // Call actor.start with input and options
      const run = await actor.start(options.input, runOptions);

      // If waitForFinish is specified, wait for the run to complete
      if (options.waitForFinish) {
        const waitSecs = Math.min(options.waitForFinish, 300); // Max 5 minutes
        const completedRun = await this.client.run(run.id).waitForFinish({ waitSecs });
        return this.mapActorRun(completedRun);
      }

      return this.mapActorRun(run);
    } catch (error) {
      throw this.handleError(error, 'Failed to start actor');
    }
  }

  /**
   * Get actor run status
   */
  async getRunStatus(runId: string): Promise<ActorRun> {
    try {
      const run = await this.client.run(runId).get();
      return this.mapActorRun(run);
    } catch (error) {
      throw this.handleError(error, `Failed to get run status for ${runId}`);
    }
  }

  /**
   * Wait for actor run to finish
   */
  async waitForRun(runId: string, timeoutSecs: number = 300): Promise<ActorRun> {
    try {
      logger.info('Waiting for actor run to finish', { runId, timeoutSecs });
      const run = await this.client.run(runId).waitForFinish({ waitSecs: timeoutSecs });
      return this.mapActorRun(run);
    } catch (error) {
      throw this.handleError(error, `Failed to wait for run ${runId}`);
    }
  }

  /**
   * Abort an actor run
   */
  async abortRun(runId: string): Promise<ActorRun> {
    try {
      logger.info('Aborting actor run', { runId });
      const run = await this.client.run(runId).abort();
      return this.mapActorRun(run);
    } catch (error) {
      throw this.handleError(error, `Failed to abort run ${runId}`);
    }
  }

  /**
   * Get dataset items from a run
   */
  async getDatasetItems(
    datasetId: string,
    options?: DatasetListOptions
  ): Promise<PaginatedList<DatasetItem>> {
    try {
      const dataset = this.client.dataset(datasetId);
      const result = await dataset.listItems(options);
      
      return {
        items: result.items,
        offset: result.offset,
        limit: result.limit,
        count: result.count,
        total: result.total,
      };
    } catch (error) {
      throw this.handleError(error, `Failed to get dataset items for ${datasetId}`);
    }
  }

  /**
   * Get all dataset items (handles pagination automatically)
   */
  async getAllDatasetItems(
    datasetId: string,
    options?: Omit<DatasetListOptions, 'offset' | 'limit'>
  ): Promise<DatasetItem[]> {
    try {
      const allItems: DatasetItem[] = [];
      let offset = 0;
      const limit = 1000; // Max items per request

      while (true) {
        const result = await this.getDatasetItems(datasetId, {
          ...options,
          offset,
          limit,
        });

        allItems.push(...result.items);

        if (allItems.length >= result.total) {
          break;
        }

        offset += limit;
      }

      return allItems;
    } catch (error) {
      throw this.handleError(error, `Failed to get all dataset items for ${datasetId}`);
    }
  }

  /**
   * Get key-value store record
   */
  async getKeyValueStoreRecord(
    storeId: string,
    key: string
  ): Promise<KeyValueStoreRecord | null> {
    try {
      const store = this.client.keyValueStore(storeId);
      const record = await store.getRecord(key);
      
      if (!record || record.value === null || record.value === undefined) {
        return null;
      }

      return {
        key,
        value: record.value,
        contentType: record.contentType || 'application/json',
      };
    } catch (error) {
      throw this.handleError(error, `Failed to get key-value store record ${key} from ${storeId}`);
    }
  }

  /**
   * Get actor information
   */
  async getActorInfo(actorId: string): Promise<ActorInfo> {
    try {
      const actor = await this.client.actor(actorId).get();
      return actor as ActorInfo;
    } catch (error) {
      throw this.handleError(error, `Failed to get actor info for ${actorId}`);
    }
  }

  /**
   * Call an actor and wait for results
   */
  async callActor(options: ActorStartOptions): Promise<ActorCallResult> {
    try {
      // Start the actor run
      const run = await this.startActor({
        ...options,
        waitForFinish: options.waitForFinish || 300, // Default 5 minutes
      });

      // Check if run succeeded
      if (run.status !== ActorRunStatus.SUCCEEDED) {
        throw new Error(`Actor run failed with status: ${run.status}`);
      }

      // Get the output from key-value store if available
      let output = null;
      if (run.defaultKeyValueStoreId) {
        const outputRecord = await this.getKeyValueStoreRecord(
          run.defaultKeyValueStoreId,
          'OUTPUT'
        );
        output = outputRecord?.value;
      }

      return {
        runId: run.id,
        status: run.status,
        datasetId: run.defaultDatasetId,
        keyValueStoreId: run.defaultKeyValueStoreId,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        exitCode: run.exitCode,
        output,
      };
    } catch (error) {
      throw this.handleError(error, 'Failed to call actor');
    }
  }

  /**
   * Register a webhook for an actor
   */
  async registerWebhook(
    actorId: string,
    webhook: WebhookConfig
  ): Promise<{ id: string; actorId: string }> {
    try {
      const actor = this.client.actor(actorId);
      const result = await actor.webhooks().create(webhook);
      return {
        id: result.id,
        actorId,
      };
    } catch (error) {
      throw this.handleError(error, `Failed to register webhook for actor ${actorId}`);
    }
  }

  /**
   * Map SDK run object to our ActorRun interface
   */
  private mapActorRun(run: any): ActorRun {
    return {
      id: run.id,
      actorId: run.actId,
      status: run.status as ActorRunStatus,
      startedAt: new Date(run.startedAt),
      finishedAt: run.finishedAt ? new Date(run.finishedAt) : undefined,
      buildId: run.buildId,
      buildNumber: run.buildNumber,
      exitCode: run.exitCode,
      defaultKeyValueStoreId: run.defaultKeyValueStoreId,
      defaultDatasetId: run.defaultDatasetId,
      defaultRequestQueueId: run.defaultRequestQueueId,
      statusMessage: run.statusMessage,
      isStatusMessageTerminal: run.isStatusMessageTerminal,
      meta: run.meta,
      options: run.options,
      usage: run.stats,
    };
  }

  /**
   * Handle and transform errors
   */
  private handleError(error: any, context: string): ApifyError {
    logger.error(context, { error });

    const apifyError = new Error(context) as ApifyError;
    apifyError.type = error.type || 'UNKNOWN_ERROR';
    apifyError.statusCode = error.statusCode;
    apifyError.details = error.details || error.message;

    return apifyError;
  }
}