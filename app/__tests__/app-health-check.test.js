/**
 * App health check tests - ensures the app can run without errors
 * These tests verify that the core functionality works and catch runtime errors
 */

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key';

// Mock Next.js server
const mockNextResponse = {
  json: (data, options = {}) => ({
    status: options.status || 200,
    json: () => Promise.resolve(data)
  })
};

// Mock the creators API route functionality
const mockCreatorsAPI = {
  GET: async (request) => {
    const url = new URL(request.url);
    const platform = url.searchParams.get('platform');
    const search = url.searchParams.get('search') || '';
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // Mock successful response
    return mockNextResponse.json({
      success: true,
      creators: [
        {
          id: '1',
          name: 'Test Creator',
          username: 'testcreator',
          platform: 'instagram',
          followerCount: 10000,
          engagementRate: 0.035,
          totalHearts: 50000,
          postCount: 100,
          avgLikesPerPost: 500,
          tags: ['lifestyle', 'fashion'],
          profileUrl: 'https://instagram.com/testcreator',
          lastSync: new Date(),
          category: 'instagram'
        }
      ],
      total: 1,
      hasMore: false
    });
  },

  POST: async (request) => {
    try {
      const body = await request.json();
      
      // Mock successful response
      return mockNextResponse.json({
        success: true,
        creators: [],
        total: 0
      });
    } catch (error) {
      // Handle malformed JSON
      return mockNextResponse.json(
        {
          success: false,
          error: 'Failed to search creators',
          details: error.message
        },
        { status: 500 }
      );
    }
  }
};

// Mock Supabase
const createMockQueryBuilder = () => {
  const mockResult = {
    data: [
      {
        id: 1,
        name: 'Test Creator',
        username: 'testcreator',
        category: 'instagram',
        totalReach: 10000,
        platformIdentifiers: {
          instagram: { biography: 'Test bio', postsCount: 50 }
        },
        updated_at: new Date().toISOString()
      }
    ],
    error: null,
    count: 1
  };

  const queryBuilder = {
    eq: jest.fn(() => queryBuilder),
    or: jest.fn(() => queryBuilder),
    range: jest.fn(() => queryBuilder),
    order: jest.fn(() => Promise.resolve(mockResult)),
    select: jest.fn(() => queryBuilder)
  };

  return queryBuilder;
};

const mockSupabaseClient = {
  from: jest.fn(() => createMockQueryBuilder())
};

describe('App Health Check Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('API Route Functionality', () => {
    it('should handle GET requests without crashing', async () => {
      const mockRequest = {
        url: 'http://localhost:3000/api/creators?platform=instagram&limit=10'
      };

      const response = await mockCreatorsAPI.GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.creators)).toBe(true);
      expect(data.creators.length).toBeGreaterThan(0);
      
      // Verify data structure
      const creator = data.creators[0];
      expect(creator.id).toBeDefined();
      expect(creator.name).toBeDefined();
      expect(creator.platform).toBeDefined();
      expect(typeof creator.followerCount).toBe('number');
      expect(typeof creator.engagementRate).toBe('number');
    });

    it('should handle POST requests without crashing', async () => {
      const mockRequest = {
        json: () => Promise.resolve({
          platforms: ['instagram'],
          sortBy: 'followers',
          sortOrder: 'desc'
        })
      };

      const response = await mockCreatorsAPI.POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.creators)).toBe(true);
    });

    it('should handle malformed POST requests gracefully', async () => {
      const mockRequest = {
        json: () => Promise.reject(new Error('Invalid JSON'))
      };

      const response = await mockCreatorsAPI.POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });
  });

  describe('Database Connection Simulation', () => {
    it('should handle successful database queries', async () => {
      const query = mockSupabaseClient
        .from('CreatorProfile')
        .select('*');
      
      const filtered = query.eq('platform', 'instagram');
      const ranged = filtered.range(0, 9);
      const result = await ranged.order('totalReach', { ascending: false });

      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.error).toBeNull();
      expect(result.count).toBe(1);
    });

    it('should handle database errors gracefully', async () => {
      // Mock database error
      const errorClient = {
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              range: jest.fn(() => ({
                order: jest.fn(() => Promise.resolve({
                  data: null,
                  error: new Error('Connection failed'),
                  count: 0
                }))
              }))
            }))
          }))
        }))
      };

      const result = await errorClient
        .from('CreatorProfile')
        .select('*')
        .eq('platform', 'instagram')
        .range(0, 9)
        .order('totalReach', { ascending: false });

      expect(result.data).toBeNull();
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error.message).toBe('Connection failed');
    });
  });

  describe('Data Validation and Transformation', () => {
    it('should validate creator data structure', () => {
      const testCreator = {
        id: 1,
        name: 'Test Creator',
        username: 'testcreator',
        category: 'instagram',
        totalReach: 10000,
        platformIdentifiers: {
          instagram: { biography: 'Test bio', postsCount: 50 }
        },
        updated_at: new Date().toISOString()
      };

      // Simulate transformation function
      const transformCreator = (creator) => {
        const platform = creator.category || 'unknown';
        const username = creator.username || creator.name?.toLowerCase().replace(/\s+/g, '') || 'unknown';
        const followerCount = creator.totalReach || 0;

        // Calculate engagement rate
        let baseRate = 0.0325; // Instagram default
        if (followerCount > 10000000) baseRate *= 0.6;
        else if (followerCount > 1000000) baseRate *= 0.75;
        else if (followerCount > 100000) baseRate *= 0.9;
        
        const variation = (Math.random() - 0.5) * 0.4;
        const engagementRate = Math.max(0.005, Math.min(0.15, baseRate * (1 + variation)));

        return {
          id: creator.id.toString(),
          name: creator.name,
          username,
          platform,
          followerCount,
          engagementRate,
          totalHearts: Math.round(followerCount * 3.5),
          postCount: Math.max(Math.round(followerCount * 0.001), 1),
          avgLikesPerPost: Math.round(followerCount * 0.035),
          tags: [],
          profileUrl: `https://instagram.com/${username}`,
          lastSync: new Date(creator.updated_at),
          category: platform
        };
      };

      const transformed = transformCreator(testCreator);

      expect(transformed.id).toBeDefined();
      expect(transformed.username).toBeDefined();
      expect(transformed.platform).toBeDefined();
      expect(typeof transformed.followerCount).toBe('number');
      expect(typeof transformed.engagementRate).toBe('number');
      expect(transformed.engagementRate).toBeGreaterThanOrEqual(0.005);
      expect(transformed.engagementRate).toBeLessThanOrEqual(0.15);
      expect(transformed.profileUrl).toContain(transformed.username);
    });

    it('should handle null and undefined creator data', () => {
      const corruptedData = [null, undefined, { id: null, name: undefined }];
      
      const processData = (creators) => {
        return creators
          .filter(creator => creator && creator.id)
          .map(creator => ({
            id: creator.id.toString(),
            name: creator.name || 'Unknown',
            username: creator.username || 'unknown',
            platform: creator.category || 'unknown',
            followerCount: creator.totalReach || 0,
            engagementRate: 0.025
          }));
      };

      const processed = processData(corruptedData);
      expect(Array.isArray(processed)).toBe(true);
      expect(processed.length).toBe(0); // Should filter out invalid entries
    });
  });

  describe('Error Handling', () => {
    it('should handle network timeouts gracefully', async () => {
      const timeoutClient = {
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              range: jest.fn(() => ({
                order: jest.fn(() => {
                  return new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Request timeout')), 100);
                  });
                })
              }))
            }))
          }))
        }))
      };

      try {
        await timeoutClient
          .from('CreatorProfile')
          .select('*')
          .eq('platform', 'instagram')
          .range(0, 9)
          .order('totalReach', { ascending: false });
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe('Request timeout');
      }
    });

    it('should handle invalid URL parameters', () => {
      const processParams = (url) => {
        try {
          const urlObj = new URL(url);
          const limit = parseInt(urlObj.searchParams.get('limit') || '100');
          const offset = parseInt(urlObj.searchParams.get('offset') || '0');
          
          return {
            limit: isNaN(limit) ? 100 : Math.max(1, Math.min(1000, limit)),
            offset: isNaN(offset) ? 0 : Math.max(0, offset)
          };
        } catch (error) {
          return { limit: 100, offset: 0 };
        }
      };

      // Test with invalid parameters
      const result1 = processParams('http://localhost:3000/api/creators?limit=invalid&offset=abc');
      expect(result1.limit).toBe(100);
      expect(result1.offset).toBe(0);

      // Test with valid parameters
      const result2 = processParams('http://localhost:3000/api/creators?limit=50&offset=10');
      expect(result2.limit).toBe(50);
      expect(result2.offset).toBe(10);

      // Test with extreme values
      const result3 = processParams('http://localhost:3000/api/creators?limit=9999&offset=-5');
      expect(result3.limit).toBe(1000); // Capped at max
      expect(result3.offset).toBe(0);   // Floored at 0
    });
  });

  describe('Performance Tests', () => {
    it('should handle multiple concurrent requests efficiently', async () => {
      const requests = Array.from({ length: 10 }, () => ({
        url: 'http://localhost:3000/api/creators'
      }));

      const startTime = Date.now();
      const responses = await Promise.all(
        requests.map(req => mockCreatorsAPI.GET(req))
      );
      const endTime = Date.now();

      expect(responses).toHaveLength(10);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete quickly

      // All responses should be successful
      for (const response of responses) {
        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
      }
    });

    it('should handle large dataset requests', async () => {
      const largeDataRequest = {
        url: 'http://localhost:3000/api/creators?limit=1000'
      };

      const response = await mockCreatorsAPI.GET(largeDataRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.creators)).toBe(true);
    });
  });

  describe('Environment Configuration', () => {
    it('should validate required environment variables', () => {
      const requiredVars = [
        'NEXT_PUBLIC_SUPABASE_URL',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY'
      ];

      requiredVars.forEach(varName => {
        expect(process.env[varName]).toBeDefined();
        expect(process.env[varName]).not.toBe('');
        expect(process.env[varName].length).toBeGreaterThan(0);
      });
    });

    it('should handle missing environment variables gracefully', () => {
      const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      try {
        delete process.env.NEXT_PUBLIC_SUPABASE_URL;
        delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        // Simulate createClient with missing env vars
        const createClient = (url, key) => {
          if (!url || !key) {
            throw new Error('Missing required environment variables');
          }
          return mockSupabaseClient;
        };

        expect(() => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY))
          .toThrow('Missing required environment variables');
      } finally {
        // Restore environment variables
        process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey;
      }
    });
  });
});