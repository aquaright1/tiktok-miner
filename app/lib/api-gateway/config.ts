import { APIGatewayConfig } from './types';
import * as dotenv from 'dotenv';
import { logger } from '../logger';

dotenv.config();

export class ConfigManager {
  private config: APIGatewayConfig;
  private envPrefix = 'API_GATEWAY_';

  constructor() {
    this.config = this.loadConfiguration();
    this.validateConfiguration();
  }

  private loadConfiguration(): APIGatewayConfig {
    return {
      rateLimiting: {
        youtube: {
          windowMs: this.getEnvNumber('YOUTUBE_RATE_WINDOW_MS', 86400000), // 24 hours
          maxRequests: this.getEnvNumber('YOUTUBE_RATE_MAX_REQUESTS', 10000)
        },
        twitter: {
          windowMs: this.getEnvNumber('TWITTER_RATE_WINDOW_MS', 2592000000), // 30 days
          maxRequests: this.getEnvNumber('TWITTER_RATE_MAX_REQUESTS', 500000)
        },
        instagram: {
          windowMs: this.getEnvNumber('INSTAGRAM_RATE_WINDOW_MS', 3600000), // 1 hour
          maxRequests: this.getEnvNumber('INSTAGRAM_RATE_MAX_REQUESTS', 200)
        }
      },
      encryption: {
        algorithm: this.getEnvString('ENCRYPTION_ALGORITHM', 'aes-256-gcm'),
        secretKey: this.getEnvString('ENCRYPTION_SECRET_KEY', this.generateDefaultKey())
      },
      monitoring: {
        enabled: this.getEnvBoolean('MONITORING_ENABLED', true),
        logLevel: this.getEnvString('LOG_LEVEL', 'info') as any
      },
      retry: {
        maxRetries: this.getEnvNumber('RETRY_MAX_ATTEMPTS', 3),
        initialDelay: this.getEnvNumber('RETRY_INITIAL_DELAY_MS', 1000),
        maxDelay: this.getEnvNumber('RETRY_MAX_DELAY_MS', 60000),
        backoffMultiplier: this.getEnvNumber('RETRY_BACKOFF_MULTIPLIER', 2)
      }
    };
  }

  private validateConfiguration(): void {
    // Validate rate limiting settings
    const platforms = ['youtube', 'twitter', 'instagram'] as const;
    platforms.forEach(platform => {
      const settings = this.config.rateLimiting[platform];
      if (settings.windowMs <= 0 || settings.maxRequests <= 0) {
        throw new Error(`Invalid rate limiting configuration for ${platform}`);
      }
    });

    // Validate encryption settings
    if (!this.config.encryption.secretKey || this.config.encryption.secretKey.length < 32) {
      throw new Error('Encryption secret key must be at least 32 characters');
    }

    // Validate retry settings
    if (this.config.retry.maxRetries < 0 || 
        this.config.retry.initialDelay <= 0 ||
        this.config.retry.maxDelay <= this.config.retry.initialDelay ||
        this.config.retry.backoffMultiplier <= 1) {
      throw new Error('Invalid retry configuration');
    }

    logger.info('API Gateway configuration validated successfully');
  }

  getConfig(): APIGatewayConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<APIGatewayConfig>): void {
    this.config = {
      ...this.config,
      ...updates,
      rateLimiting: {
        ...this.config.rateLimiting,
        ...(updates.rateLimiting || {})
      },
      encryption: {
        ...this.config.encryption,
        ...(updates.encryption || {})
      },
      monitoring: {
        ...this.config.monitoring,
        ...(updates.monitoring || {})
      },
      retry: {
        ...this.config.retry,
        ...(updates.retry || {})
      }
    };
    
    this.validateConfiguration();
    logger.info('API Gateway configuration updated');
  }

  getPlatformConfig(platform: 'youtube' | 'twitter' | 'instagram'): {
    apiKey?: string;
    apiSecret?: string;
    baseUrl?: string;
    timeout?: number;
  } {
    const platformUpper = platform.toUpperCase();
    return {
      apiKey: process.env[`${platformUpper}_API_KEY`],
      apiSecret: process.env[`${platformUpper}_API_SECRET`],
      baseUrl: process.env[`${platformUpper}_BASE_URL`],
      timeout: this.getEnvNumber(`${platformUpper}_TIMEOUT_MS`, 30000)
    };
  }

  getDatabaseConfig(): {
    url: string;
    maxConnections?: number;
    connectionTimeout?: number;
  } {
    return {
      url: process.env.DATABASE_URL || '',
      maxConnections: this.getEnvNumber('DB_MAX_CONNECTIONS', 20),
      connectionTimeout: this.getEnvNumber('DB_CONNECTION_TIMEOUT_MS', 5000)
    };
  }

  getRedisConfig(): {
    url?: string;
    host?: string;
    port?: number;
    password?: string;
    db?: number;
  } {
    return {
      url: process.env.REDIS_URL,
      host: process.env.REDIS_HOST || 'localhost',
      port: this.getEnvNumber('REDIS_PORT', 6379),
      password: process.env.REDIS_PASSWORD,
      db: this.getEnvNumber('REDIS_DB', 0)
    };
  }

  private getEnvString(key: string, defaultValue: string): string {
    const fullKey = `${this.envPrefix}${key}`;
    return process.env[fullKey] || process.env[key] || defaultValue;
  }

  private getEnvNumber(key: string, defaultValue: number): number {
    const value = this.getEnvString(key, String(defaultValue));
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  private getEnvBoolean(key: string, defaultValue: boolean): boolean {
    const value = this.getEnvString(key, String(defaultValue));
    return value.toLowerCase() === 'true';
  }

  private generateDefaultKey(): string {
    // In production, this should be loaded from a secure secret store
    logger.warn('Using generated encryption key. Set API_GATEWAY_ENCRYPTION_SECRET_KEY in production!');
    return 'INSECURE_DEFAULT_KEY_REPLACE_IN_PRODUCTION_' + Date.now();
  }

  // Export configuration for debugging (with sensitive data masked)
  exportConfig(): string {
    const exported = JSON.parse(JSON.stringify(this.config));
    
    // Mask sensitive values
    if (exported.encryption?.secretKey) {
      exported.encryption.secretKey = '***MASKED***';
    }
    
    return JSON.stringify(exported, null, 2);
  }

  // Load configuration from file (useful for different environments)
  async loadFromFile(filePath: string): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const content = await fs.readFile(filePath, 'utf-8');
      const fileConfig = JSON.parse(content);
      
      this.updateConfig(fileConfig);
      logger.info(`Configuration loaded from ${filePath}`);
    } catch (error: any) {
      logger.error(`Failed to load configuration from ${filePath}:`, error);
      throw error;
    }
  }

  // Environment-specific configurations
  getEnvironment(): 'development' | 'staging' | 'production' {
    const env = process.env.NODE_ENV?.toLowerCase() || 'development';
    if (['production', 'staging'].includes(env)) {
      return env as 'production' | 'staging';
    }
    return 'development';
  }

  isDevelopment(): boolean {
    return this.getEnvironment() === 'development';
  }

  isProduction(): boolean {
    return this.getEnvironment() === 'production';
  }
}