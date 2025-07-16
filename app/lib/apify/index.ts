/**
 * Apify integration main export
 */

export { ApifyClient } from './client';
export { ActorManager } from './actor-manager';
export { QueuedActorManager, createQueuedActorManager as createQueuedActorManagerExport } from './queued-actor-manager';
export { loadApifyConfig, getActorConfig, ACTOR_CONFIGS, WEBHOOK_EVENTS } from './config';

// Export types
export type {
  ApifyConfig,
  ActorRun,
  ActorRunStatus,
  ActorStartOptions,
  ActorCallResult,
  DatasetItem,
  DatasetListOptions,
  WebhookConfig,
  WebhookEventType,
  ApifyError,
  ActorInfo,
  InstagramScraperInput,
  TikTokScraperInput,
  ApifyActorConfig,
} from './apify-types';

// Data model mapping layer exports
export * from './schemas';

export {
  InstagramTransformer,
  TiktokTransformer,
  YoutubeTransformer,
  TwitterTransformer,
  TransformerFactory,
} from './transformers';

export {
  sanitizeHtml,
  stripHtml,
  normalizeUrl,
  handleEmojis,
  sanitizePhoneNumber,
  removeSensitiveData,
  sanitizeUsername,
  normalizeWhitespace,
  truncateText,
  deduplicateStrings,
  sanitizeObject,
  sanitizeString,
  sanitizeBio,
  sanitizeTags,
  sanitizeEmail,
  type SanitizationOptions,
} from './sanitizers';

export {
  DataTransformationPipeline,
  createPipeline,
  processCreatorProfile,
  processCreatorProfiles,
  PipelineStep,
  type PipelineOptions,
  type PipelineResult,
  type PipelineError,
} from './pipeline';

// Re-export legacy types for backward compatibility
export type {
  UnifiedCreatorData,
  YoutubeData,
  TwitterData,
  InstagramData,
  TiktokData,
  ApifyActorResponse,
  ApifyInstagramProfile,
  ApifyTiktokProfile,
  ValidationResult,
  TransformationResult,
} from './schemas';

// Re-export enum values (removed duplicates that are already exported as types)
export { DatasetFormat, LogLevel } from './apify-types';

/**
 * Create a configured ActorManager instance
 */
export function createActorManager() {
  const config = loadApifyConfig();
  
  return new ActorManager({
    apiKey: config.APIFY_API_KEY,
    baseUrl: config.APIFY_BASE_URL,
    webhookUrl: config.APIFY_WEBHOOK_URL,
    maxRetries: config.APIFY_MAX_RETRIES,
    requestTimeoutMs: config.APIFY_DEFAULT_TIMEOUT_SECS * 1000,
  });
}

/**
 * Create a configured QueuedActorManager instance
 */
export function createQueuedActorManager() {
  const config = loadApifyConfig();
  
  return new QueuedActorManager({
    apiKey: config.APIFY_API_KEY,
    baseUrl: config.APIFY_BASE_URL,
    webhookUrl: config.APIFY_WEBHOOK_URL,
    maxRetries: config.APIFY_MAX_RETRIES,
    requestTimeoutMs: config.APIFY_DEFAULT_TIMEOUT_SECS * 1000,
    enableRateLimiting: true,
    platformRateLimits: {
      instagram: { requestsPerHour: 100 },
      tiktok: { requestsPerHour: 100 },
      youtube: { requestsPerHour: 200 },
      twitter: { requestsPerHour: 150 },
    },
  });
}