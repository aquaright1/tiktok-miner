import OpenAI from 'openai';
import { APITrackingMiddleware } from '../middleware/api-tracking';
import { openai, openaiConfig } from './openai';
import { PrismaClient } from '@prisma/client';

export class TrackedOpenAIClient {
  private client: OpenAI;
  private tracker: APITrackingMiddleware;

  constructor(prisma?: PrismaClient) {
    this.client = openai;
    this.tracker = new APITrackingMiddleware(prisma);
  }

  async createChatCompletion(
    params: OpenAI.Chat.ChatCompletionCreateParams,
    options?: { userId?: string; metadata?: Record<string, any> }
  ): Promise<OpenAI.Chat.ChatCompletion> {
    return this.tracker.trackOpenAI(
      params.model || openaiConfig.model,
      'chat.completions.create',
      () => this.client.chat.completions.create(params),
      options
    );
  }

  async createCompletion(
    params: OpenAI.CompletionCreateParams,
    options?: { userId?: string; metadata?: Record<string, any> }
  ): Promise<OpenAI.Completion> {
    return this.tracker.trackOpenAI(
      params.model,
      'completions.create',
      () => this.client.completions.create(params),
      options
    );
  }

  async createEmbedding(
    params: OpenAI.EmbeddingCreateParams,
    options?: { userId?: string; metadata?: Record<string, any> }
  ): Promise<OpenAI.CreateEmbeddingResponse> {
    return this.tracker.trackOpenAI(
      params.model,
      'embeddings.create',
      () => this.client.embeddings.create(params),
      options
    );
  }

  async createModeration(
    params: OpenAI.ModerationCreateParams,
    options?: { userId?: string; metadata?: Record<string, any> }
  ): Promise<OpenAI.ModerationCreateResponse> {
    return this.tracker.trackOpenAI(
      params.model || 'text-moderation-latest',
      'moderations.create',
      () => this.client.moderations.create(params),
      options
    );
  }

  // Get usage statistics
  async getUsageStats(startDate: Date, endDate: Date) {
    return this.tracker.getTracker().getUsageStats('OpenAI', startDate, endDate);
  }

  // Get rate limit status
  async getRateLimitStatus(model?: string) {
    return this.tracker.getTracker().getRateLimitStatus('OpenAI', model);
  }

  // Get active alerts
  async getActiveAlerts() {
    const allAlerts = await this.tracker.getTracker().getActiveAlerts();
    return allAlerts.filter(alert => alert.platform === 'OpenAI');
  }
}