/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/creators/route';

// Polyfill for Next.js server components
if (typeof Request === 'undefined') {
  global.Request = class Request {
    constructor(input, init) {
      this.url = input;
      this.method = init?.method || 'GET';
      this.headers = new Map(Object.entries(init?.headers || {}));
    }
  } as any;
}

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn((table) => {
      // Mock data for different tables
      const mockData = {
        instagram_profiles: [
          {
            id: '1',
            username: 'test_instagram',
            full_name: 'Test Instagram User',
            bio: 'Test bio',
            profile_url: 'https://instagram.com/test_instagram',
            follower_count: 10000,
            engagement_rate_30d: 0.035,
            likes_total_30d: 5000,
            posts_30d: 10,
            likes_avg_30d: 500,
            discovery_keywords: ['test', 'instagram'],
            updated_at: new Date().toISOString(),
            discovered_at: new Date().toISOString()
          },
          {
            id: '2',
            username: 'test_instagram2',
            full_name: 'Test Instagram User 2',
            follower_count: 5000,
            engagement_rate_30d: 0.04,
            likes_total_30d: 2000,
            posts_30d: 5,
            likes_avg_30d: 400,
            discovery_keywords: ['test'],
            updated_at: new Date().toISOString()
          }
        ],
        tiktok_profiles: [
          {
            username: 'test_tiktok',
            nick_name: 'Test TikTok User',
            signature: 'Test bio',
            profile_url: 'https://tiktok.com/@test_tiktok',
            follower_count: 20000,
            engagement_rate: 0.067,
            likes_total: 10000,
            posts_30d: 15,
            avg_likes_per_post: 667,
            comments_total: 500,
            views_total: 50000,
            shares_total: 100,
            verified: true,
            last_updated: new Date().toISOString()
          },
          {
            username: 'test_tiktok2',
            nick_name: 'Test TikTok User 2',
            follower_count: 15000,
            engagement_rate: 0.055,
            likes_total: 7500,
            posts_30d: 20,
            avg_likes_per_post: 375,
            comments_total: 300,
            views_total: 30000,
            shares_total: 50,
            verified: false,
            last_updated: new Date().toISOString()
          }
        ],
        CreatorProfile: [
          {
            id: '3',
            name: 'Test Creator',
            category: 'instagram',
            totalReach: 25000,
            averageEngagementRate: 0.045,
            updated_at: new Date().toISOString()
          }
        ]
      };

      const selectedData = mockData[table] || [];
      
      // Simulate Instagram table not existing
      if (table === 'InstagramProfile') {
        return {
          select: jest.fn(() => ({
            or: jest.fn(() => ({
              range: jest.fn(() => ({
                order: jest.fn(() => Promise.resolve({
                  data: null,
                  error: { code: '42P01', details: null, hint: null, message: 'relation "public.InstagramProfile" does not exist' },
                  count: null
                }))
              }))
            })),
            range: jest.fn(() => ({
              order: jest.fn(() => Promise.resolve({
                data: null,
                error: { code: '42P01', details: null, hint: null, message: 'relation "public.InstagramProfile" does not exist' },
                count: null
              }))
            }))
          }))
        };
      }
      
      return {
        select: jest.fn(() => ({
          or: jest.fn(() => ({
            range: jest.fn(() => ({
              order: jest.fn(() => Promise.resolve({
                data: selectedData,
                error: null,
                count: selectedData.length
              }))
            }))
          })),
          range: jest.fn(() => ({
            order: jest.fn(() => Promise.resolve({
              data: selectedData,
              error: null,
              count: selectedData.length
            }))
          }))
        }))
      };
    })
  }))
}));

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn()
  }
}));

describe('Creators API - Platform Toggle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/creators', () => {
    it('should handle Instagram table not existing', async () => {
      const request = new NextRequest('http://localhost:3000/api/creators?table=instagram_profiles&limit=10');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Failed to fetch creators');
      expect(data.details).toContain('InstagramProfile');
    });

    it('should fetch TikTok profiles when table=tiktok_profiles', async () => {
      const request = new NextRequest('http://localhost:3000/api/creators?table=tiktok_profiles&limit=10');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.creators).toHaveLength(2);
      expect(data.creators[0].platform).toBe('tiktok');
      expect(data.creators[0].username).toBe('test_tiktok');
      expect(data.creators[0].followerCount).toBe(20000);
      expect(data.creators[0].verified).toBe(true);
      expect(data.total).toBe(2);
    });

    it('should fetch default CreatorProfile when no table specified', async () => {
      const request = new NextRequest('http://localhost:3000/api/creators?limit=10');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.creators).toHaveLength(1);
      expect(data.creators[0].name).toBe('Test Creator');
      expect(data.total).toBe(1);
    });

    it('should handle search filters for Instagram profiles when table does not exist', async () => {
      const request = new NextRequest('http://localhost:3000/api/creators?table=instagram_profiles&search=test');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });

    it('should apply search filters for TikTok profiles', async () => {
      const request = new NextRequest('http://localhost:3000/api/creators?table=tiktok_profiles&search=test');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.creators.length).toBeGreaterThan(0);
    });

    it('should handle pagination parameters', async () => {
      const request = new NextRequest('http://localhost:3000/api/creators?table=tiktok_profiles&limit=1&offset=0');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      // hasMore is true when we have exactly limit number of items returned
      expect(data.hasMore).toBe(data.creators.length === 1);
    });

    it('should handle Instagram data transformation when table does not exist', async () => {
      const request = new NextRequest('http://localhost:3000/api/creators?table=instagram_profiles');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.creators).toBeUndefined();
    });

    it('should transform TikTok data correctly', async () => {
      const request = new NextRequest('http://localhost:3000/api/creators?table=tiktok_profiles');
      const response = await GET(request);
      const data = await response.json();

      const creator = data.creators[0];
      expect(creator).toHaveProperty('id');
      expect(creator).toHaveProperty('name');
      expect(creator).toHaveProperty('username');
      expect(creator).toHaveProperty('nickName');
      expect(creator).toHaveProperty('platform', 'tiktok');
      expect(creator).toHaveProperty('followerCount');
      expect(creator).toHaveProperty('engagementRate');
      expect(creator).toHaveProperty('totalHearts');
      expect(creator).toHaveProperty('postCount');
      expect(creator).toHaveProperty('avgLikesPerPost');
      expect(creator).toHaveProperty('profileUrl');
      expect(creator).toHaveProperty('lastSync');
      expect(creator).toHaveProperty('category', 'tiktok');
      expect(creator).toHaveProperty('posts30d');
      expect(creator).toHaveProperty('likesTotal');
      expect(creator).toHaveProperty('commentsTotal');
      expect(creator).toHaveProperty('viewsTotal');
      expect(creator).toHaveProperty('sharesTotal');
      expect(creator).toHaveProperty('verified');
    });
  });
});