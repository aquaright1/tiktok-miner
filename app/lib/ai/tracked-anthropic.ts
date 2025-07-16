import Anthropic from '@anthropic-ai/sdk';
import { APITrackingMiddleware } from '../middleware/api-tracking';
import { anthropic } from './anthropic';
import { PrismaClient } from '@prisma/client';

export class TrackedAnthropicClient {
  private client: Anthropic;
  private tracker: APITrackingMiddleware;

  constructor(prisma?: PrismaClient) {
    this.client = anthropic;
    this.tracker = new APITrackingMiddleware(prisma);
  }

  async createMessage(
    params: Anthropic.MessageCreateParams,
    options?: { userId?: string; metadata?: Record<string, any> }
  ): Promise<Anthropic.Message> {
    return this.tracker.trackAnthropic(
      params.model,
      'messages.create',
      () => this.client.messages.create(params),
      options
    );
  }

  async createCompletion(
    params: Anthropic.CompletionCreateParams,
    options?: { userId?: string; metadata?: Record<string, any> }
  ): Promise<Anthropic.Completion> {
    return this.tracker.trackAnthropic(
      params.model,
      'completions.create',
      () => this.client.completions.create(params),
      options
    );
  }

  // Stream support with tracking
  async createMessageStream(
    params: Anthropic.MessageCreateParams & { stream: true },
    options?: { userId?: string; metadata?: Record<string, any> }
  ): Promise<AsyncIterable<Anthropic.MessageStreamEvent>> {
    // For streaming, we need to track after completion
    const startTime = Date.now();
    const requestId = `Anthropic-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const stream = await this.client.messages.create(params);
      
      // Create a wrapper to track usage after stream completes
      const trackedStream = this.wrapStream(stream, params.model, requestId, options);
      
      return trackedStream;
    } catch (error) {
      // Track error immediately
      await this.tracker.getTracker().trackRequest({
        platform: 'Anthropic',
        model: params.model,
        endpoint: 'messages.create',
        requestId,
        responseTime: Date.now() - startTime,
        statusCode: 500,
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: options?.userId,
        metadata: options?.metadata
      });
      throw error;
    }
  }

  private async *wrapStream(
    stream: AsyncIterable<Anthropic.MessageStreamEvent>,
    model: string,
    requestId: string,
    options?: { userId?: string; metadata?: Record<string, any> }
  ): AsyncIterable<Anthropic.MessageStreamEvent> {
    const startTime = Date.now();
    let totalTokens = 0;
    let error: string | undefined;

    try {
      for await (const event of stream) {
        // Track token usage from stream events
        if (event.type === 'message_delta' && event.usage) {
          totalTokens = event.usage.input_tokens + event.usage.output_tokens;
        }
        yield event;
      }
    } catch (err: any) {
      error = err.message || 'Stream error';
      throw err;
    } finally {
      // Track the completed stream
      const cost = await this.tracker.getTracker().calculateCost('Anthropic', model, totalTokens);
      
      await this.tracker.getTracker().trackRequest({
        platform: 'Anthropic',
        model,
        endpoint: 'messages.create (stream)',
        tokensUsed: totalTokens,
        cost,
        requestId,
        responseTime: Date.now() - startTime,
        statusCode: error ? 500 : 200,
        error,
        userId: options?.userId,
        metadata: options?.metadata
      });
    }
  }

  // Get usage statistics
  async getUsageStats(startDate: Date, endDate: Date) {
    return this.tracker.getTracker().getUsageStats('Anthropic', startDate, endDate);
  }

  // Get rate limit status
  async getRateLimitStatus(model?: string) {
    return this.tracker.getTracker().getRateLimitStatus('Anthropic', model);
  }

  // Get active alerts
  async getActiveAlerts() {
    const allAlerts = await this.tracker.getTracker().getActiveAlerts();
    return allAlerts.filter(alert => alert.platform === 'Anthropic');
  }
}