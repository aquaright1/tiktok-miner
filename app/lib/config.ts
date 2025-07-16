// Type-safe configuration with runtime validation
import { z } from 'zod';

// Zod schema for environment validation
const configSchema = z.object({
  supabase: z.object({
    databasePassword: z.string().min(1, 'SUPABASE_DATABASE_PASSWORD is required'),
    url: z.string().url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL'),
    anonKey: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required'),
  }),
  database: z.object({
    url: z.string().min(1, 'DATABASE_URL is required'),
    directUrl: z.string().min(1, 'DIRECT_URL is required'),
  }),
  ai: z.object({
    openai: z.object({
      apiKey: z.string().min(1, 'OPENAI_API_KEY is required'),
      model: z.string().min(1),
      temperature: z.number().min(0).max(2),
      minConfidence: z.number().min(0).max(1),
    }),
    anthropic: z.object({
      apiKey: z.string().optional(),
    }),
  }),

  apify: z.object({
    apiKey: z.string().min(1, 'APIFY_API_KEY is required'),
    tiktokScraperId: z.string().min(1),
    useTiktokApify: z.boolean(),
  }),
  redis: z.object({
    url: z.string().min(1, 'REDIS_URL is required'),
    host: z.string().optional(),
    port: z.number().positive(),
    password: z.string().optional(),
    username: z.string().optional(),
  }),
  queue: z.object({
    concurrency: z.number().positive(),
    maxRetries: z.number().nonnegative(),
    delayOnFailure: z.number().nonnegative(),
  }),
  taskManagement: z.object({
    enableQueueWorkers: z.boolean(),
    enableDiscoveryScheduler: z.boolean(),
    enableCreatorSync: z.boolean(),
  }),
  email: z.object({
    azure: z.object({
      connectionString: z.string().optional(),
    }),
    smtp: z.object({
      host: z.string().optional(),
      port: z.number().positive(),
      user: z.string().optional(),
      password: z.string().optional(),
      secure: z.boolean(),
      authMethod: z.string(),
    }),
    outlook: z.object({
      tenantId: z.string().optional(),
      clientId: z.string().optional(),
      clientSecret: z.string().optional(),
      userEmail: z.string().optional(),
    }),
  }),
  app: z.object({
    url: z.string().url(),
    nodeEnv: z.enum(['development', 'production', 'test']),
    timezone: z.string(),
    vercel: z.object({
      env: z.enum(['development', 'preview', 'production']).optional(),
      url: z.string(),
      productionUrl: z.string().optional(),
    }),
  }),
  logging: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']),
  }),
  performance: z.object({
    retries: z.object({
      max: z.number().nonnegative(),
      delay: z.number().nonnegative(),
      attempts: z.number().nonnegative(),
    }),
    timeout: z.number().positive(),
    rateLimit: z.object({
      window: z.number().positive(),
      maxRequests: z.number().positive(),
    }),
    cache: z.object({
      ttl: z.number().positive(),
    }),
  }),
});

interface AppConfig {
  supabase: {
    databasePassword: string
    url: string
    anonKey: string
  }
  database: {
    url: string
    directUrl: string
  }
  ai: {
    openai: {
      apiKey: string
      model: string
      temperature: number
      minConfidence: number
    }
    anthropic: {
      apiKey: string
    }
  }
  github: {
    token: string
    tokens: string[]
    loadBalancingStrategy: 'ROUND_ROBIN'
  }
  apify: {
    apiKey: string
    tiktokScraperId: string
    useTiktokApify: boolean
  }
  redis: {
    url: string
    host: string
    port: number
    password: string
    username: string
  }
  queue: {
    concurrency: number
    maxRetries: number
    delayOnFailure: number
  }
  taskManagement: {
    enableQueueWorkers: boolean
    enableDiscoveryScheduler: boolean
    enableCreatorSync: boolean
  }
  email: {
    azure: {
      connectionString: string
    }
    smtp: {
      host: string
      port: number
      user: string
      password: string
      secure: boolean
      authMethod: string
    }
    outlook: {
      tenantId: string
      clientId: string
      clientSecret: string
      userEmail: string
    }
  }
  app: {
    url: string
    nodeEnv: 'development' | 'production' | 'test'
    timezone: string
    vercel: {
      env?: 'development' | 'preview' | 'production'
      url: string
      productionUrl: string
    }
  }
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error'
  }
  performance: {
    retries: {
      max: number
      delay: number
      attempts: number
    }
    timeout: number
    rateLimit: {
      window: number
      maxRequests: number
    }
    cache: {
      ttl: number
    }
  }
}

// Helper function to parse numbers with defaults
function parseNumber(value: string | undefined, defaultValue: number): number {
  const parsed = Number(value)
  return isNaN(parsed) ? defaultValue : parsed
}

// Helper function to parse boolean
function parseBoolean(value: string | undefined, defaultValue = false): boolean {
  if (!value) return defaultValue
  return value.toLowerCase() === 'true'
}

// Helper function to get required env var
function getRequiredEnv(key: string): string {
  const value = process.env[key]
  if (!value) {
    // Only throw in production, warn in development
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Missing required environment variable: ${key}`)
    } else {
      console.warn(`Warning: Missing environment variable: ${key}`)
    }
  }
  return value || ''
}

// Helper function to get optional env var
function getOptionalEnv(key: string, defaultValue = ''): string {
  return process.env[key] || defaultValue
}

// Create configuration object with validation
function createConfig(): AppConfig {
  const rawConfig = {
    supabase: {
      databasePassword: getRequiredEnv('SUPABASE_DATABASE_PASSWORD'),
      url: getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
      anonKey: getRequiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    },
    database: {
      url: getRequiredEnv('DATABASE_URL'),
      directUrl: getRequiredEnv('DIRECT_URL'),
    },
    ai: {
      openai: {
        apiKey: getRequiredEnv('OPENAI_API_KEY'),
        model: getOptionalEnv('OPENAI_MODEL', 'gpt-4o'),
        temperature: parseNumber(process.env.OPENAI_TEMPERATURE, 0.7),
        minConfidence: parseNumber(process.env.OPENAI_MIN_CONFIDENCE, 0.5),
      },
      anthropic: {
        apiKey: getOptionalEnv('ANTHROPIC_API_KEY'),
      },
    },

    apify: {
      apiKey: getRequiredEnv('APIFY_API_KEY'),
      tiktokScraperId: getOptionalEnv('APIFY_TIKTOK_SCRAPER_ID', 'GdWCkxBtKWOsKjdch'),
      useTiktokApify: parseBoolean(process.env.USE_TIKTOK_APIFY, true),
    },
    redis: {
      url: getRequiredEnv('REDIS_URL'),
      host: getOptionalEnv('REDIS_HOST'),
      port: parseNumber(process.env.REDIS_PORT, 6379),
      password: getOptionalEnv('REDIS_PASSWORD'),
      username: getOptionalEnv('REDIS_USERNAME', 'default'),
    },
    queue: {
      concurrency: parseNumber(process.env.QUEUE_CONCURRENCY, 5),
      maxRetries: parseNumber(process.env.QUEUE_MAX_RETRIES, 3),
      delayOnFailure: parseNumber(process.env.QUEUE_DELAY_ON_FAILURE, 5000),
    },
    taskManagement: {
      enableQueueWorkers: parseBoolean(process.env.ENABLE_QUEUE_WORKERS, true),
      enableDiscoveryScheduler: parseBoolean(process.env.ENABLE_DISCOVERY_SCHEDULER, true),
      enableCreatorSync: parseBoolean(process.env.ENABLE_CREATOR_SYNC, true),
    },
    email: {
      azure: {
        connectionString: getOptionalEnv('AZURE_EMAIL_CONNECTION_STRING'),
      },
      smtp: {
        host: getOptionalEnv('SMTP_HOST', 'smtp.gmail.com'),
        port: parseNumber(process.env.SMTP_PORT, 465),
        user: getOptionalEnv('SMTP_USER', 'your-email@gmail.com'),
        password: getOptionalEnv('SMTP_PASSWORD', 'your-smtp-password'),
        secure: parseBoolean(process.env.SMTP_SECURE, true),
        authMethod: getOptionalEnv('SMTP_AUTH_METHOD', 'login'),
      },
      outlook: {
        tenantId: getOptionalEnv('OUTLOOK_TENANT_ID'),
        clientId: getOptionalEnv('OUTLOOK_CLIENT_ID'),
        clientSecret: getOptionalEnv('OUTLOOK_CLIENT_SECRET'),
        userEmail: getOptionalEnv('OUTLOOK_USER_EMAIL'),
      },
    },
    app: {
      url: getOptionalEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000'),
      nodeEnv: (process.env.NODE_ENV || 'development') as 'development' | 'production' | 'test',
      timezone: getOptionalEnv('TZ', 'UTC'),
      vercel: {
        env: process.env.VERCEL_ENV as 'development' | 'preview' | 'production' | undefined,
        url: getOptionalEnv('VERCEL_URL', 'localhost:3000'),
        productionUrl: getOptionalEnv('VERCEL_PROJECT_PRODUCTION_URL'),
      },
    },
    logging: {
      level: (getOptionalEnv('LOG_LEVEL', 'debug') as 'debug' | 'info' | 'warn' | 'error'),
    },
    performance: {
      retries: {
        max: parseNumber(process.env.MAX_RETRIES, 3),
        delay: parseNumber(process.env.RETRY_DELAY, 1000),
        attempts: parseNumber(process.env.RETRY_ATTEMPTS, 3),
      },
      timeout: parseNumber(process.env.TIMEOUT_MS, 30000),
      rateLimit: {
        window: parseNumber(process.env.RATE_LIMIT_WINDOW, 60000),
        maxRequests: parseNumber(process.env.RATE_LIMIT_MAX_REQUESTS, 60),
      },
      cache: {
        ttl: parseNumber(process.env.CACHE_TTL, 3600000),
      },
    },
  };

  // Validate the configuration using Zod schema
  try {
    return configSchema.parse(rawConfig);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
      
      // In development, just warn and return the raw config
      if (process.env.NODE_ENV !== 'production') {
        console.warn('Configuration validation warnings in development:');
        console.warn(errorMessages.join('\n'));
        return rawConfig as AppConfig;
      }
      
      // In production, throw the error
      throw new Error(
        `Configuration validation failed:\n${errorMessages.join('\n')}\n\n` +
        'Please check your environment variables and ensure all required values are set.'
      );
    }
    throw error;
  }
}

// Create and export the configuration
export const config = createConfig()

// Export type
export type Config = typeof config

// Legacy exports for backward compatibility (will deprecate these later)
export const SUPABASE_DATABASE_PASSWORD = config.supabase.databasePassword
export const NEXT_PUBLIC_SUPABASE_URL = config.supabase.url
export const NEXT_PUBLIC_SUPABASE_ANON_KEY = config.supabase.anonKey
export const DATABASE_URL = config.database.url
export const DIRECT_URL = config.database.directUrl
export const OPENAI_API_KEY = config.ai.openai.apiKey
export const OPENAI_MODEL = config.ai.openai.model
export const OPENAI_TEMPERATURE = config.ai.openai.temperature
export const OPENAI_MIN_CONFIDENCE = config.ai.openai.minConfidence
export const ANTHROPIC_API_KEY = config.ai.anthropic.apiKey

export const APIFY_API_KEY = config.apify.apiKey
export const APIFY_TIKTOK_SCRAPER_ID = config.apify.tiktokScraperId
export const USE_TIKTOK_APIFY = config.apify.useTiktokApify
export const REDIS_URL = config.redis.url
export const REDIS_HOST = config.redis.host
export const REDIS_PORT = config.redis.port
export const REDIS_PASSWORD = config.redis.password
export const REDIS_USERNAME = config.redis.username
export const QUEUE_CONCURRENCY = config.queue.concurrency
export const QUEUE_MAX_RETRIES = config.queue.maxRetries
export const QUEUE_DELAY_ON_FAILURE = config.queue.delayOnFailure
export const ENABLE_QUEUE_WORKERS = config.taskManagement.enableQueueWorkers
export const ENABLE_DISCOVERY_SCHEDULER = config.taskManagement.enableDiscoveryScheduler
export const ENABLE_CREATOR_SYNC = config.taskManagement.enableCreatorSync
export const AZURE_EMAIL_CONNECTION_STRING = config.email.azure.connectionString
export const LOG_LEVEL = config.logging.level
export const SMTP_HOST = config.email.smtp.host
export const SMTP_PORT = config.email.smtp.port
export const SMTP_USER = config.email.smtp.user
export const SMTP_PASSWORD = config.email.smtp.password
export const SMTP_SECURE = config.email.smtp.secure
export const SMTP_AUTH_METHOD = config.email.smtp.authMethod
export const APP_URL = config.app.url
export const NODE_ENV = config.app.nodeEnv
export const TZ = config.app.timezone
export const VERCEL_ENV = config.app.vercel.env
export const VERCEL_URL = config.app.vercel.url
export const VERCEL_PROJECT_PRODUCTION_URL = config.app.vercel.productionUrl
export const OUTLOOK_TENANT_ID = config.email.outlook.tenantId
export const OUTLOOK_CLIENT_ID = config.email.outlook.clientId
export const OUTLOOK_CLIENT_SECRET = config.email.outlook.clientSecret
export const OUTLOOK_USER_EMAIL = config.email.outlook.userEmail
export const MAX_RETRIES = config.performance.retries.max
export const RETRY_DELAY = config.performance.retries.delay
export const TIMEOUT_MS = config.performance.timeout
export const RETRY_ATTEMPTS = config.performance.retries.attempts
export const RATE_LIMIT_WINDOW = config.performance.rateLimit.window
export const RATE_LIMIT_MAX_REQUESTS = config.performance.rateLimit.maxRequests
export const CACHE_TTL = config.performance.cache.ttl