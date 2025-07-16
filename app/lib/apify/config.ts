/**
 * Apify configuration and environment variables
 */

import { z } from 'zod';
import { ApifyActorConfig } from './apify-types';
import { config } from '../config';

// Environment variable schema
export const apifyEnvSchema = z.object({
  APIFY_API_KEY: z.string().min(1).describe('Apify API key for authentication'),
  APIFY_BASE_URL: z.string().url().optional().default('https://api.apify.com'),
  APIFY_DEFAULT_TIMEOUT_SECS: z.string().transform(Number).optional().default('300'),
  APIFY_MAX_RETRIES: z.string().transform(Number).optional().default('3'),
  
  // Actor-specific configurations
  APIFY_INSTAGRAM_SCRAPER_ID: z.string().optional().default('apify/instagram-scraper'),
  APIFY_INSTAGRAM_POST_SCRAPER_ID: z.string().optional().default('apify/instagram-post-scraper'),
  APIFY_TIKTOK_SCRAPER_ID: z.string().optional().default('GdWCkxBtKWOsKjdch'),
  APIFY_YOUTUBE_SCRAPER_ID: z.string().optional().default('streamers/youtube-channel-scraper'),
  APIFY_YOUTUBE_POST_SCRAPER_ID: z.string().optional().default('streamers/youtube-scraper'),
  APIFY_TWITTER_SCRAPER_ID: z.string().optional().default('u6ppkMWAx2E2MpEKL'),
  APIFY_GOOGLE_SEARCH_SCRAPER_ID: z.string().optional().default('apify/google-search-scraper'),
  
  // Webhook configuration
  APIFY_WEBHOOK_URL: z.string().url().optional(),
  APIFY_WEBHOOK_SECRET: z.string().optional(),
});

export type ApifyEnvConfig = z.infer<typeof apifyEnvSchema>;

/**
 * Load and validate Apify configuration from environment
 */
export function loadApifyConfig(): ApifyEnvConfig {
  try {
    return apifyEnvSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors
        .filter(e => e.code === 'invalid_type' && e.received === 'undefined')
        .map(e => e.path.join('.'));
      
      throw new Error(
        `Missing required Apify environment variables: ${missingVars.join(', ')}\n` +
        'Please set them in your .env file or environment.'
      );
    }
    throw error;
  }
}

/**
 * Actor configurations with default inputs and options
 */
export const ACTOR_CONFIGS: Record<string, ApifyActorConfig> = {
  instagram: {
    actorId: process.env.APIFY_INSTAGRAM_SCRAPER_ID || 'apify/instagram-scraper',
    defaultInput: {
      resultsType: 'details',
      resultsLimit: 30,
      searchType: 'user',
      searchLimit: 1,
      addParentData: true,
    },
    defaultRunOptions: {
      timeoutSecs: 300,
      memoryMbytes: 512,
    },
    maxRetries: 3,
    retryDelayMs: 2000,
  },
  
  tiktok: {
    actorId: config.apify.tiktokScraperId,
    defaultInput: {
      resultsPerPage: 30,
      maxProfilesPerQuery: 1,
      proxyConfiguration: {
        useApifyProxy: true,
      },
    },
    defaultRunOptions: {
      timeoutSecs: 300,
      memoryMbytes: 512,
    },
    maxRetries: 3,
    retryDelayMs: 2000,
  },
  
  youtube: {
    actorId: process.env.APIFY_YOUTUBE_SCRAPER_ID || 'streamers/youtube-channel-scraper',
    defaultInput: {
      startUrls: [],
      maxItems: 50,
      includeChannelInfo: true,
      includeVideoDetails: true,
    },
    defaultRunOptions: {
      timeoutSecs: 600,
      memoryMbytes: 1024,
    },
    maxRetries: 3,
    retryDelayMs: 2000,
  },
  
  twitter: {
    actorId: process.env.APIFY_TWITTER_SCRAPER_ID || 'u6ppkMWAx2E2MpEKL',
    defaultInput: {
      tweetsDesired: 30,
      addUserInfo: true,
      startUrls: [],
    },
    defaultRunOptions: {
      timeoutSecs: 300,
      memoryMbytes: 512,
    },
    maxRetries: 3,
    retryDelayMs: 2000,
  },
  
  instagramPosts: {
    actorId: process.env.APIFY_INSTAGRAM_POST_SCRAPER_ID || 'apify/instagram-post-scraper',
    defaultInput: {
      directUrls: [],
      search: '',
      searchType: 'hashtag',
      searchLimit: 100,
      resultsLimit: 500,
      scrollWaitSecs: 2,
      pageTimeout: 60,
      maxRequestRetries: 3,
      enableComments: true,
      commentsLimit: 50,
      enableLikes: true,
      likesLimit: 100,
      addParentData: true,
      proxyConfiguration: {
        useApifyProxy: true,
        apifyProxyGroups: ['RESIDENTIAL'],
      },
    },
    defaultRunOptions: {
      timeoutSecs: 3600,
      memoryMbytes: 1024,
    },
    maxRetries: 3,
    retryDelayMs: 2000,
  },
  
  googleSearch: {
    actorId: process.env.APIFY_GOOGLE_SEARCH_SCRAPER_ID || 'apify/google-search-scraper',
    defaultInput: {
      queries: [],
      resultsPerPage: 100,
      maxPagesPerQuery: 1,
      languageCode: 'en',
      mobileResults: false,
      includeUnfilteredResults: false,
    },
    defaultRunOptions: {
      timeoutSecs: 300,
      memoryMbytes: 256,
    },
    maxRetries: 3,
    retryDelayMs: 2000,
  },
  
  youtubePosts: {
    actorId: process.env.APIFY_YOUTUBE_POST_SCRAPER_ID || 'streamers/youtube-scraper',
    defaultInput: {
      startUrls: [],
      searchKeywords: '',
      maxResults: 500,
      includeChannelData: true,
      includeComments: true,
      includeSubtitles: false,
      includeVideoDetails: true,
      language: 'en',
      maxCommentsPerVideo: 50,
      sortBy: 'date',
      uploadDate: 'month',
      videoDuration: 'any',
      videoDefinition: 'any',
      proxyConfiguration: {
        useApifyProxy: true,
        apifyProxyGroups: ['RESIDENTIAL'],
      },
    },
    defaultRunOptions: {
      timeoutSecs: 3600,
      memoryMbytes: 1024,
    },
    maxRetries: 3,
    retryDelayMs: 2000,
  },
};

/**
 * Get actor configuration by platform name
 */
export function getActorConfig(platform: string): ApifyActorConfig {
  const config = ACTOR_CONFIGS[platform.toLowerCase()];
  if (!config) {
    throw new Error(`No actor configuration found for platform: ${platform}`);
  }
  return config;
}

/**
 * Webhook event type mappings
 */
export const WEBHOOK_EVENTS = {
  runSucceeded: 'ACTOR.RUN.SUCCEEDED',
  runFailed: 'ACTOR.RUN.FAILED',
  runTimedOut: 'ACTOR.RUN.TIMED_OUT',
  runAborted: 'ACTOR.RUN.ABORTED',
} as const;

/**
 * Default webhook configuration
 */
export function getDefaultWebhookConfig(baseUrl: string) {
  return {
    events: [WEBHOOK_EVENTS.runSucceeded, WEBHOOK_EVENTS.runFailed],
    requestUrl: `${baseUrl}/api/webhooks/apify`,
    payloadTemplate: JSON.stringify({
      runId: '{{runId}}',
      actorId: '{{actorId}}',
      status: '{{status}}',
      startedAt: '{{startedAt}}',
      finishedAt: '{{finishedAt}}',
      datasetId: '{{defaultDatasetId}}',
      keyValueStoreId: '{{defaultKeyValueStoreId}}',
    }),
  };
}