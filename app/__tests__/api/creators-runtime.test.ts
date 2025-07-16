const { NextRequest } = require('next/server');

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          or: jest.fn(() => ({
            range: jest.fn(() => ({
              order: jest.fn(() => ({
                data: [],
                error: null,
                count: 0
              }))
            }))
          }))
        })),
        or: jest.fn(() => ({
          range: jest.fn(() => ({
            order: jest.fn(() => ({
              data: [],
              error: null,
              count: 0
            }))
          }))
        })),
        range: jest.fn(() => ({
          order: jest.fn(() => ({
            data: [],
            error: null,
            count: 0
          }))
        })),
        order: jest.fn(() => ({
          data: [],
          error: null,
          count: 0
        })),
        in: jest.fn(() => ({
          in: jest.fn(() => ({
            gte: jest.fn(() => ({
              lte: jest.fn(() => ({
                order: jest.fn(() => ({
                  data: [],
                  error: null,
                  count: 0
                }))
              }))
            }))
          }))
        })),
        gte: jest.fn(() => ({
          lte: jest.fn(() => ({
            order: jest.fn(() => ({
              data: [],
              error: null,
              count: 0
            }))
          }))
        })),
        lte: jest.fn(() => ({
          order: jest.fn(() => ({
            data: [],
            error: null,
            count: 0
          }))
        }))
      }))
    }))
  }))
}));

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
  }
}));

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key';

describe('API Runtime Error Tests', () => {
  describe('GET /api/creators', () => {
    it('should handle missing environment variables gracefully', async () => {
      // Temporarily unset env vars
      const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      const { GET } = require('@/app/api/creators/route');
      const request = new NextRequest('http://localhost:3000/api/creators');
      
      try {
        const response = await GET(request);
        const data = await response.json();
        
        expect(response.status).toBe(500);
        expect(data.success).toBe(false);
        expect(data.error).toBeDefined();
      } finally {
        // Restore env vars
        process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey;
      }
    });

    it('should handle invalid URL parameters', async () => {
      const { GET } = require('@/app/api/creators/route');
      const request = new NextRequest('http://localhost:3000/api/creators?limit=invalid&offset=abc');
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.creators).toBeDefined();
    });

    it('should handle malformed search parameters', async () => {
      const request = new NextRequest('http://localhost:3000/api/creators?search=%&platform=');
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should handle database connection errors', async () => {
      // Mock database error
      const mockSupabase = {
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              or: jest.fn(() => ({
                range: jest.fn(() => ({
                  order: jest.fn(() => ({
                    data: null,
                    error: new Error('Database connection failed'),
                    count: 0
                  }))
                }))
              }))
            })),
            or: jest.fn(() => ({
              range: jest.fn(() => ({
                order: jest.fn(() => ({
                  data: null,
                  error: new Error('Database connection failed'),
                  count: 0
                }))
              }))
            })),
            range: jest.fn(() => ({
              order: jest.fn(() => ({
                data: null,
                error: new Error('Database connection failed'),
                count: 0
              }))
            }))
          }))
        }))
      };

      jest.doMock('@supabase/supabase-js', () => ({
        createClient: jest.fn(() => mockSupabase)
      }));

      const request = new NextRequest('http://localhost:3000/api/creators');
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Failed to fetch creators');
    });

    it('should handle null/undefined creator data', async () => {
      const mockSupabase = {
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              or: jest.fn(() => ({
                range: jest.fn(() => ({
                  order: jest.fn(() => ({
                    data: [null, undefined, { id: 1, name: null }],
                    error: null,
                    count: 3
                  }))
                }))
              }))
            })),
            or: jest.fn(() => ({
              range: jest.fn(() => ({
                order: jest.fn(() => ({
                  data: [null, undefined, { id: 1, name: null }],
                  error: null,
                  count: 3
                }))
              }))
            })),
            range: jest.fn(() => ({
              order: jest.fn(() => ({
                data: [null, undefined, { id: 1, name: null }],
                error: null,
                count: 3
              }))
            }))
          }))
        }))
      };

      jest.doMock('@supabase/supabase-js', () => ({
        createClient: jest.fn(() => mockSupabase)
      }));

      const request = new NextRequest('http://localhost:3000/api/creators');
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.creators).toBeDefined();
    });
  });

  describe('POST /api/creators', () => {
    it('should handle malformed JSON request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/creators', {
        method: 'POST',
        body: 'invalid json'
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });

    it('should handle missing request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/creators', {
        method: 'POST'
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });

    it('should handle invalid filter parameters', async () => {
      const request = new NextRequest('http://localhost:3000/api/creators', {
        method: 'POST',
        body: JSON.stringify({
          platforms: 'invalid',
          categories: null,
          minGemScore: 'not a number',
          maxGemScore: Infinity,
          sortBy: 'invalid_field',
          sortOrder: 'invalid_order'
        })
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('Transform Creator Function', () => {
    it('should handle creators with missing required fields', async () => {
      const mockSupabase = {
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            range: jest.fn(() => ({
              order: jest.fn(() => ({
                data: [
                  { id: 1 }, // Missing all other fields
                  { id: 2, name: 'Test', platformIdentifiers: null },
                  { id: 3, name: 'Test2', platformIdentifiers: { invalid: 'data' } }
                ],
                error: null,
                count: 3
              }))
            }))
          }))
        }))
      };

      jest.doMock('@supabase/supabase-js', () => ({
        createClient: jest.fn(() => mockSupabase)
      }));

      const request = new NextRequest('http://localhost:3000/api/creators');
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.creators).toHaveLength(3);
      
      // Check that each creator has required fields with defaults
      data.creators.forEach((creator: any) => {
        expect(creator.id).toBeDefined();
        expect(creator.username).toBeDefined();
        expect(creator.platform).toBeDefined();
        expect(creator.followerCount).toBeDefined();
        expect(creator.engagementRate).toBeDefined();
        expect(creator.profileUrl).toBeDefined();
      });
    });
  });

  describe('Engagement Rate Calculation', () => {
    it('should handle extreme follower counts', async () => {
      const mockSupabase = {
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            range: jest.fn(() => ({
              order: jest.fn(() => ({
                data: [
                  { id: 1, name: 'Test', totalReach: 0 },
                  { id: 2, name: 'Test2', totalReach: Number.MAX_SAFE_INTEGER },
                  { id: 3, name: 'Test3', totalReach: -1000 }
                ],
                error: null,
                count: 3
              }))
            }))
          }))
        }))
      };

      jest.doMock('@supabase/supabase-js', () => ({
        createClient: jest.fn(() => mockSupabase)
      }));

      const request = new NextRequest('http://localhost:3000/api/creators');
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      
      // Check that engagement rates are within valid bounds
      data.creators.forEach((creator: any) => {
        expect(creator.engagementRate).toBeGreaterThanOrEqual(0.005);
        expect(creator.engagementRate).toBeLessThanOrEqual(0.15);
        expect(Number.isFinite(creator.engagementRate)).toBe(true);
      });
    });
  });
});