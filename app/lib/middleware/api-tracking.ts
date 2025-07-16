import { APIUsageTracker, APIUsageRequest } from '../services/api-usage-tracker';
import { PrismaClient } from '@prisma/client';
import { logger } from '../logger';

export interface TrackedAPICall {
  platform: string;
  model?: string;
  endpoint: string;
  execute: () => Promise<any>;
  calculateTokens?: (response: any) => number;
  calculateCost?: (response: any, tokens: number) => number;
  userId?: string;
  metadata?: Record<string, any>;
}

export class APITrackingMiddleware {
  private tracker: APIUsageTracker;

  constructor(prisma?: PrismaClient) {
    this.tracker = new APIUsageTracker(prisma);
  }

  async trackAPICall<T>(call: TrackedAPICall): Promise<T> {
    const startTime = Date.now();
    const requestId = `${call.platform}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    let response: T;
    let statusCode = 200;
    let error: string | undefined;
    let tokensUsed = 0;
    let cost = 0;

    try {
      // Execute the API call
      response = await call.execute();

      // Calculate tokens if function provided
      if (call.calculateTokens && response) {
        tokensUsed = call.calculateTokens(response);
      }

      // Calculate cost if function provided, otherwise use tracker
      if (call.calculateCost && response) {
        cost = call.calculateCost(response, tokensUsed);
      } else if (tokensUsed > 0 && call.model) {
        cost = await this.tracker.calculateCost(call.platform, call.model, tokensUsed);
      }

      return response;
    } catch (err: any) {
      statusCode = err.status || 500;
      error = err.message || 'Unknown error';
      logger.error(`API call failed for ${call.platform}/${call.endpoint}:`, err);
      throw err;
    } finally {
      const responseTime = Date.now() - startTime;

      // Track the usage
      await this.tracker.trackRequest({
        platform: call.platform,
        model: call.model,
        endpoint: call.endpoint,
        tokensUsed,
        cost,
        userId: call.userId,
        requestId,
        responseTime,
        statusCode,
        error,
        metadata: {
          ...call.metadata,
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  // Wrapper for OpenAI API calls
  async trackOpenAI<T>(
    model: string,
    endpoint: string,
    execute: () => Promise<T>,
    options?: {
      userId?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<T> {
    return this.trackAPICall({
      platform: 'OpenAI',
      model,
      endpoint,
      execute,
      calculateTokens: (response: any) => {
        // OpenAI usually returns usage data
        return response?.usage?.total_tokens || 0;
      },
      calculateCost: (response: any, tokens: number) => {
        // Basic cost calculation - should be updated with actual pricing
        const pricing: Record<string, number> = {
          'gpt-4': 0.03 / 1000, // $0.03 per 1K tokens
          'gpt-4-32k': 0.06 / 1000,
          'gpt-4-turbo': 0.01 / 1000,
          'gpt-4o': 0.005 / 1000,
          'gpt-3.5-turbo': 0.002 / 1000,
        };
        return tokens * (pricing[model] || 0);
      },
      userId: options?.userId,
      metadata: options?.metadata
    });
  }

  // Wrapper for Anthropic API calls
  async trackAnthropic<T>(
    model: string,
    endpoint: string,
    execute: () => Promise<T>,
    options?: {
      userId?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<T> {
    return this.trackAPICall({
      platform: 'Anthropic',
      model,
      endpoint,
      execute,
      calculateTokens: (response: any) => {
        // Anthropic returns usage in a different format
        return response?.usage?.input_tokens + response?.usage?.output_tokens || 0;
      },
      calculateCost: (response: any, tokens: number) => {
        // Basic cost calculation for Claude models
        const pricing: Record<string, number> = {
          'claude-3-opus': 0.015 / 1000,
          'claude-3-sonnet': 0.003 / 1000,
          'claude-3-haiku': 0.00025 / 1000,
          'claude-2.1': 0.008 / 1000,
          'claude-2': 0.008 / 1000,
        };
        return tokens * (pricing[model] || 0);
      },
      userId: options?.userId,
      metadata: options?.metadata
    });
  }

  // Wrapper for Google AI API calls
  async trackGoogle<T>(
    model: string,
    endpoint: string,
    execute: () => Promise<T>,
    options?: {
      userId?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<T> {
    return this.trackAPICall({
      platform: 'Google',
      model,
      endpoint,
      execute,
      calculateTokens: (response: any) => {
        // Google AI token calculation
        return response?.usageMetadata?.totalTokenCount || 0;
      },
      userId: options?.userId,
      metadata: options?.metadata
    });
  }

  // Wrapper for Apify API calls
  async trackApify<T>(
    actorId: string,
    endpoint: string,
    execute: () => Promise<T>,
    options?: {
      userId?: string;
      metadata?: Record<string, any>;
      computeUnits?: number;
      datasetOperations?: number;
      storageBytes?: number;
    }
  ): Promise<T> {
    return this.trackAPICall({
      platform: 'Apify',
      model: actorId,
      endpoint,
      execute,
      calculateCost: (response: any, tokens: number) => {
        // Apify pricing model (approximate)
        const computeUnitCost = 0.25 / 1000; // $0.25 per 1K compute units
        const datasetOpCost = 0.005 / 1000; // $0.005 per 1K operations
        const storageCost = 0.20 / (1024 * 1024 * 1024); // $0.20 per GB
        
        let totalCost = 0;
        if (options?.computeUnits) {
          totalCost += options.computeUnits * computeUnitCost;
        }
        if (options?.datasetOperations) {
          totalCost += options.datasetOperations * datasetOpCost;
        }
        if (options?.storageBytes) {
          totalCost += options.storageBytes * storageCost;
        }
        
        return totalCost;
      },
      userId: options?.userId,
      metadata: {
        ...options?.metadata,
        computeUnits: options?.computeUnits,
        datasetOperations: options?.datasetOperations,
        storageBytes: options?.storageBytes,
      }
    });
  }

  // Get the tracker instance for direct access
  getTracker(): APIUsageTracker {
    return this.tracker;
  }
}