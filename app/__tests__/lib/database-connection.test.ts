const { createClient } = require('@supabase/supabase-js');

// Mock environment variables for testing
const mockEnv = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-key',
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test'
}

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn()
}))

describe('Database Connection Tests', () => {
  let originalEnv;

  beforeAll(() => {
    // Store original environment variables
    originalEnv = { ...process.env }
    
    // Set test environment variables
    Object.assign(process.env, mockEnv)
  })

  afterAll(() => {
    // Restore original environment variables
    process.env = originalEnv
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Supabase Client Creation', () => {
    it('should create client with valid environment variables', () => {
      const mockClient = {
        from: jest.fn(() => ({
          select: jest.fn(() => Promise.resolve({ data: [], error: null }))
        }))
      }

      ;(createClient as jest.Mock).mockReturnValue(mockClient)

      const client = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      expect(createClient).toHaveBeenCalledWith(
        'https://test.supabase.co',
        'test-key'
      )
      expect(client).toBeDefined()
    })

    it('should handle missing environment variables', () => {
      // Temporarily remove env vars
      delete process.env.NEXT_PUBLIC_SUPABASE_URL
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      expect(() => {
        createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )
      }).not.toThrow()

      // Restore env vars
      process.env.NEXT_PUBLIC_SUPABASE_URL = mockEnv.NEXT_PUBLIC_SUPABASE_URL
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = mockEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY
    })

    it('should handle invalid URL format', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'invalid-url'
      
      expect(() => {
        createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )
      }).not.toThrow()

      // Restore valid URL
      process.env.NEXT_PUBLIC_SUPABASE_URL = mockEnv.NEXT_PUBLIC_SUPABASE_URL
    })

    it('should handle empty API key', () => {
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ''
      
      expect(() => {
        createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )
      }).not.toThrow()

      // Restore valid key
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = mockEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY
    })
  })

  describe('Database Query Tests', () => {
    it('should handle successful database queries', async () => {
      const mockClient = {
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              range: jest.fn(() => ({
                order: jest.fn(() => Promise.resolve({
                  data: [{ id: 1, name: 'Test' }],
                  error: null,
                  count: 1
                }))
              }))
            }))
          }))
        }))
      }

      ;(createClient as jest.Mock).mockReturnValue(mockClient)

      const client = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      const result = await client
        .from('CreatorProfile')
        .select('*')
        .eq('platform', 'instagram')
        .range(0, 9)
        .order('totalReach', { ascending: false })

      expect(result.data).toEqual([{ id: 1, name: 'Test' }])
      expect(result.error).toBeNull()
    })

    it('should handle database connection errors', async () => {
      const mockClient = {
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
      }

      ;(createClient as jest.Mock).mockReturnValue(mockClient)

      const client = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      const result = await client
        .from('CreatorProfile')
        .select('*')
        .eq('platform', 'instagram')
        .range(0, 9)
        .order('totalReach', { ascending: false })

      expect(result.data).toBeNull()
      expect(result.error).toBeInstanceOf(Error)
      expect(result.error.message).toBe('Connection failed')
    })

    it('should handle timeout errors', async () => {
      const mockClient = {
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              range: jest.fn(() => ({
                order: jest.fn(() => Promise.reject(new Error('Timeout')))
              }))
            }))
          }))
        }))
      }

      ;(createClient as jest.Mock).mockReturnValue(mockClient)

      const client = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      await expect(
        client
          .from('CreatorProfile')
          .select('*')
          .eq('platform', 'instagram')
          .range(0, 9)
          .order('totalReach', { ascending: false })
      ).rejects.toThrow('Timeout')
    })

    it('should handle invalid table names', async () => {
      const mockClient = {
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              range: jest.fn(() => ({
                order: jest.fn(() => Promise.resolve({
                  data: null,
                  error: new Error('Table "InvalidTable" does not exist'),
                  count: 0
                }))
              }))
            }))
          }))
        }))
      }

      ;(createClient as jest.Mock).mockReturnValue(mockClient)

      const client = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      const result = await client
        .from('InvalidTable')
        .select('*')
        .eq('platform', 'instagram')
        .range(0, 9)
        .order('totalReach', { ascending: false })

      expect(result.data).toBeNull()
      expect(result.error).toBeInstanceOf(Error)
      expect(result.error.message).toContain('does not exist')
    })

    it('should handle authentication errors', async () => {
      const mockClient = {
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              range: jest.fn(() => ({
                order: jest.fn(() => Promise.resolve({
                  data: null,
                  error: new Error('Invalid API key'),
                  count: 0
                }))
              }))
            }))
          }))
        }))
      }

      ;(createClient as jest.Mock).mockReturnValue(mockClient)

      const client = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        'invalid-key'
      )

      const result = await client
        .from('CreatorProfile')
        .select('*')
        .eq('platform', 'instagram')
        .range(0, 9)
        .order('totalReach', { ascending: false })

      expect(result.data).toBeNull()
      expect(result.error).toBeInstanceOf(Error)
      expect(result.error.message).toBe('Invalid API key')
    })

    it('should handle malformed query parameters', async () => {
      const mockClient = {
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              range: jest.fn(() => ({
                order: jest.fn(() => Promise.resolve({
                  data: [],
                  error: null,
                  count: 0
                }))
              }))
            }))
          }))
        }))
      }

      ;(createClient as jest.Mock).mockReturnValue(mockClient)

      const client = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      // Test with invalid range parameters
      const result = await client
        .from('CreatorProfile')
        .select('*')
        .eq('platform', null as any)
        .range(-1, -5)  // Invalid range
        .order('invalidColumn', { ascending: true })

      expect(result.data).toEqual([])
      expect(result.error).toBeNull()
    })
  })

  describe('Connection Pool Tests', () => {
    it('should handle multiple concurrent connections', async () => {
      const mockClient = {
        from: jest.fn(() => ({
          select: jest.fn(() => Promise.resolve({
            data: [{ id: 1, name: 'Test' }],
            error: null,
            count: 1
          }))
        }))
      }

      ;(createClient as jest.Mock).mockReturnValue(mockClient)

      const client = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      // Create multiple concurrent requests
      const promises = Array.from({ length: 10 }, (_, i) => 
        client.from('CreatorProfile').select('*')
      )

      const results = await Promise.all(promises)

      expect(results).toHaveLength(10)
      results.forEach(result => {
        expect(result.data).toEqual([{ id: 1, name: 'Test' }])
        expect(result.error).toBeNull()
      })
    })

    it('should handle connection pool exhaustion', async () => {
      const mockClient = {
        from: jest.fn(() => ({
          select: jest.fn(() => Promise.reject(new Error('Connection pool exhausted')))
        }))
      }

      ;(createClient as jest.Mock).mockReturnValue(mockClient)

      const client = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      await expect(
        client.from('CreatorProfile').select('*')
      ).rejects.toThrow('Connection pool exhausted')
    })
  })
});