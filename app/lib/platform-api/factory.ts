import { PlatformAPIService } from './base-service';
import { InstagramAPIService } from './instagram-service';
import { TikTokAPIService } from './tiktok-service';
import { TwitterAPIService } from './twitter-service';
import { Platform, PlatformAPIConfig, PlatformAPIError } from './types';

export class PlatformAPIFactory {
  static create(platform: Platform, config: PlatformAPIConfig): PlatformAPIService {
    switch (platform) {
      case Platform.INSTAGRAM:
        return new InstagramAPIService(config);
      case Platform.TIKTOK:
        return new TikTokAPIService(config);
      case Platform.TWITTER:
        return new TwitterAPIService(config);
      default:
        throw new PlatformAPIError(
          `Unsupported platform: ${platform}`,
          'UNSUPPORTED_PLATFORM'
        );
    }
  }

  static createFromEnv(platform: Platform): PlatformAPIService {
    const config = this.getConfigFromEnv(platform);
    return this.create(platform, config);
  }

  private static getConfigFromEnv(platform: Platform): PlatformAPIConfig {
    switch (platform) {
      case Platform.INSTAGRAM:
        return {
          accessToken: process.env.INSTAGRAM_ACCESS_TOKEN,
          clientId: process.env.INSTAGRAM_CLIENT_ID,
          clientSecret: process.env.INSTAGRAM_CLIENT_SECRET,
        };
      case Platform.TIKTOK:
        return {
          accessToken: process.env.TIKTOK_ACCESS_TOKEN,
          refreshToken: process.env.TIKTOK_REFRESH_TOKEN,
          clientId: process.env.TIKTOK_CLIENT_ID,
          clientSecret: process.env.TIKTOK_CLIENT_SECRET,
        };
      case Platform.TWITTER:
        return {
          accessToken: process.env.TWITTER_ACCESS_TOKEN,
          refreshToken: process.env.TWITTER_REFRESH_TOKEN,
          clientId: process.env.TWITTER_CLIENT_ID,
          clientSecret: process.env.TWITTER_CLIENT_SECRET,
          apiKey: process.env.TWITTER_API_KEY,
          apiSecret: process.env.TWITTER_API_SECRET,
        };
      default:
        throw new PlatformAPIError(
          `No environment configuration for platform: ${platform}`,
          'CONFIG_NOT_FOUND'
        );
    }
  }
}