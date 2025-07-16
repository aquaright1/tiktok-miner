import { config, validateConfig } from '@/lib/config';

describe('Config', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('config object', () => {
    it('should have all required properties', () => {
      expect(config).toHaveProperty('DATABASE_URL');
      expect(config).toHaveProperty('NEXT_PUBLIC_SUPABASE_URL');
      expect(config).toHaveProperty('NEXT_PUBLIC_SUPABASE_ANON_KEY');
      expect(config).toHaveProperty('OPENAI_API_KEY');
      expect(config).toHaveProperty('GITHUB_TOKEN');
    });

    it('should set default values for optional properties', () => {
      expect(config.OPENAI_MODEL).toBe('gpt-4o');
      expect(config.OPENAI_TEMPERATURE).toBe(0.7);
      expect(config.OPENAI_MIN_CONFIDENCE).toBe(0.5);
      expect(config.MAX_RETRIES).toBe(3);
      expect(config.RETRY_DELAY).toBe(1000);
      expect(config.TIMEOUT_MS).toBe(30000);
    });

    it('should handle numeric environment variables', () => {
      process.env.OPENAI_TEMPERATURE = '0.3';
      process.env.MAX_RETRIES = '5';
      process.env.TIMEOUT_MS = '45000';

      const { config: newConfig } = require('@/lib/config');
      expect(newConfig.OPENAI_TEMPERATURE).toBe(0.3);
      expect(newConfig.MAX_RETRIES).toBe(5);
      expect(newConfig.TIMEOUT_MS).toBe(45000);
    });
  });

  describe('validateConfig', () => {
    it('should not throw when all required env vars are set', () => {
      process.env.SUPABASE_DATABASE_PASSWORD = 'test-password';
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key';
      process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
      process.env.DIRECT_URL = 'postgresql://test:test@localhost:5432/test';
      process.env.OPENAI_API_KEY = 'test-key';
      process.env.GITHUB_TOKEN = 'test-token';

      expect(() => validateConfig()).not.toThrow();
    });

    it('should throw when required env vars are missing', () => {
      delete process.env.DATABASE_URL;
      delete process.env.OPENAI_API_KEY;

      expect(() => validateConfig()).toThrow('Missing required environment variables');
    });
  });
});