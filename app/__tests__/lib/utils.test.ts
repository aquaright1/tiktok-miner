import { utils } from '@/lib/utils';

describe('Utils', () => {
  describe('formatNumber', () => {
    it('should format numbers correctly', () => {
      expect(utils.formatNumber(1000)).toBe('1K');
      expect(utils.formatNumber(1500)).toBe('1.5K');
      expect(utils.formatNumber(1000000)).toBe('1M');
      expect(utils.formatNumber(1500000)).toBe('1.5M');
      expect(utils.formatNumber(999)).toBe('999');
    });

    it('should handle edge cases', () => {
      expect(utils.formatNumber(0)).toBe('0');
      expect(utils.formatNumber(null)).toBe('0');
      expect(utils.formatNumber(undefined)).toBe('0');
    });

    it('should handle NaN values', () => {
      expect(utils.formatNumber(NaN)).toBe('0');
    });

    it('should handle negative numbers', () => {
      expect(utils.formatNumber(-1000)).toBe('0');
      expect(utils.formatNumber(-1)).toBe('0');
    });

    it('should handle decimal numbers', () => {
      expect(utils.formatNumber(1234.56)).toBe('1.2K');
      expect(utils.formatNumber(1234567.89)).toBe('1.2M');
    });

    it('should handle very large numbers', () => {
      expect(utils.formatNumber(1500000000)).toBe('1500M');
    });
  });

  describe('calculateEngagementRate', () => {
    it('should calculate engagement rate correctly', () => {
      const result = utils.calculateEngagementRate(1000, 10000);
      expect(result).toBe(10);
    });

    it('should handle zero followers', () => {
      const result = utils.calculateEngagementRate(1000, 0);
      expect(result).toBe(0);
    });

    it('should handle null values', () => {
      const result = utils.calculateEngagementRate(null, 10000);
      expect(result).toBe(0);
    });
  });

  describe('validateEmail', () => {
    it('should validate correct email addresses', () => {
      expect(utils.validateEmail('test@example.com')).toBe(true);
      expect(utils.validateEmail('user.name@domain.co.uk')).toBe(true);
      expect(utils.validateEmail('user+tag@example.org')).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      expect(utils.validateEmail('invalid-email')).toBe(false);
      expect(utils.validateEmail('test@')).toBe(false);
      expect(utils.validateEmail('@domain.com')).toBe(false);
      expect(utils.validateEmail('')).toBe(false);
    });
  });

  describe('slugify', () => {
    it('should create valid slugs', () => {
      expect(utils.slugify('Hello World')).toBe('hello-world');
      expect(utils.slugify('Test@Example.com')).toBe('test-example-com');
      expect(utils.slugify('Special Characters! @#$%')).toBe('special-characters');
    });

    it('should handle edge cases', () => {
      expect(utils.slugify('')).toBe('');
      expect(utils.slugify('   ')).toBe('');
      expect(utils.slugify('---')).toBe('');
    });
  });

  describe('debounce', () => {
    jest.useFakeTimers();

    it('should debounce function calls', () => {
      const mockFn = jest.fn();
      const debouncedFn = utils.debounce(mockFn, 300);

      debouncedFn();
      debouncedFn();
      debouncedFn();

      expect(mockFn).toHaveBeenCalledTimes(0);

      jest.advanceTimersByTime(300);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    afterEach(() => {
      jest.clearAllTimers();
    });
  });
});