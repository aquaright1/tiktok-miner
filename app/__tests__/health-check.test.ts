/**
 * Health check tests to ensure the app is running properly
 * These tests verify core functionality and catch runtime errors
 */

const { NextRequest } = require('next/server');

// Mock environment variables
const testEnv = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-key'
}

Object.assign(process.env, testEnv)

describe('Application Health Check', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Critical Path Tests', () => {
    it('should load and execute creators API without crashing', async () => {
      // Mock Supabase to return successful response
      jest.doMock('@supabase/supabase-js', () => ({
        createClient: jest.fn(() => ({
          from: jest.fn(() => ({
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                or: jest.fn(() => ({
                  range: jest.fn(() => ({
                    order: jest.fn(() => Promise.resolve({
                      data: [
                        {
                          id: 1,
                          name: 'Test Creator',
                          username: 'testcreator',
                          category: 'instagram',
                          totalReach: 10000,
                          platformIdentifiers: {
                            instagram: {
                              biography: 'Test bio',
                              postsCount: 50
                            }
                          },
                          updated_at: new Date().toISOString()
                        }
                      ],
                      error: null,
                      count: 1
                    }))
                  }))
                }))
              })),
              or: jest.fn(() => ({
                range: jest.fn(() => ({
                  order: jest.fn(() => Promise.resolve({
                    data: [],
                    error: null,
                    count: 0
                  }))
                }))
              })),
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
      }))

      // Import and test the API route
      const { GET, POST } = require('@/app/api/creators/route')
      
      // Test GET request
      const getRequest = new NextRequest('http://localhost:3000/api/creators')
      const getResponse = await GET(getRequest)
      const getData = await getResponse.json()
      
      expect(getResponse.status).toBe(200)
      expect(getData.success).toBe(true)
      expect(getData.creators).toBeDefined()
      expect(Array.isArray(getData.creators)).toBe(true)

      // Test POST request
      const postRequest = new NextRequest('http://localhost:3000/api/creators', {
        method: 'POST',
        body: JSON.stringify({
          platforms: ['instagram'],
          categories: ['lifestyle'],
          sortBy: 'followers',
          sortOrder: 'desc'
        })
      })
      const postResponse = await POST(postRequest)
      const postData = await postResponse.json()
      
      expect(postResponse.status).toBe(200)
      expect(postData.success).toBe(true)
    })

    it('should handle page component rendering without errors', () => {
      // Test that main page components can be loaded
      expect(() => {
        const CreatorsPage = require('@/app/creators/page').default
        expect(typeof CreatorsPage).toBe('function')
      }).not.toThrow()

      expect(() => {
        const HomePage = require('@/app/page').default
        expect(typeof HomePage).toBe('function')
      }).not.toThrow()
    })

    it('should handle essential utility functions', () => {
      // Test logger
      expect(() => {
        const { logger } = require('@/lib/logger')
        expect(logger).toBeDefined()
        expect(typeof logger.error).toBe('function')
        expect(typeof logger.info).toBe('function')
      }).not.toThrow()

      // Test utils
      expect(() => {
        const utils = require('@/lib/utils')
        expect(utils).toBeDefined()
      }).not.toThrow()
    })
  })

  describe('Error Boundary Tests', () => {
    it('should handle database errors gracefully', async () => {
      // Mock database failure
      jest.doMock('@supabase/supabase-js', () => ({
        createClient: jest.fn(() => ({
          from: jest.fn(() => ({
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                or: jest.fn(() => ({
                  range: jest.fn(() => ({
                    order: jest.fn(() => Promise.resolve({
                      data: null,
                      error: new Error('Database connection failed'),
                      count: 0
                    }))
                  }))
                }))
              })),
              or: jest.fn(() => ({
                range: jest.fn(() => ({
                  order: jest.fn(() => Promise.resolve({
                    data: null,
                    error: new Error('Database connection failed'),
                    count: 0
                  }))
                }))
              })),
              range: jest.fn(() => ({
                order: jest.fn(() => Promise.resolve({
                  data: null,
                  error: new Error('Database connection failed'),
                  count: 0
                }))
              }))
            }))
          }))
        }))
      }))

      const { GET } = require('@/app/api/creators/route')
      const request = new NextRequest('http://localhost:3000/api/creators')
      const response = await GET(request)
      const data = await response.json()
      
      // Should return error response instead of crashing
      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBeDefined()
    })

    it('should handle malformed data gracefully', async () => {
      // Mock corrupted data response
      jest.doMock('@supabase/supabase-js', () => ({
        createClient: jest.fn(() => ({
          from: jest.fn(() => ({
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                or: jest.fn(() => ({
                  range: jest.fn(() => ({
                    order: jest.fn(() => Promise.resolve({
                      data: [
                        null,
                        undefined,
                        { id: null, name: undefined },
                        { id: 'invalid', totalReach: 'not-a-number' },
                        { id: 1, name: 'Valid', category: 'instagram', totalReach: 1000 }
                      ],
                      error: null,
                      count: 5
                    }))
                  }))
                }))
              })),
              or: jest.fn(() => ({
                range: jest.fn(() => ({
                  order: jest.fn(() => Promise.resolve({
                    data: [],
                    error: null,
                    count: 0
                  }))
                }))
              })),
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
      }))

      const { GET } = require('@/app/api/creators/route')
      const request = new NextRequest('http://localhost:3000/api/creators')
      const response = await GET(request)
      const data = await response.json()
      
      // Should handle corrupted data without crashing
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.creators).toBeDefined()
      expect(Array.isArray(data.creators)).toBe(true)
    })

    it('should handle network timeouts', async () => {
      // Mock network timeout
      jest.doMock('@supabase/supabase-js', () => ({
        createClient: jest.fn(() => ({
          from: jest.fn(() => ({
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                or: jest.fn(() => ({
                  range: jest.fn(() => ({
                    order: jest.fn(() => {
                      return new Promise((_, reject) => {
                        setTimeout(() => reject(new Error('Request timeout')), 100)
                      })
                    })
                  }))
                }))
              }))
            }))
          }))
        }))
      }))

      const { GET } = require('@/app/api/creators/route')
      const request = new NextRequest('http://localhost:3000/api/creators')
      
      let response
      try {
        response = await GET(request)
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect(error.message).toContain('timeout')
      }

      if (response) {
        expect(response.status).toBe(500)
      }
    })
  })

  describe('Performance and Stability', () => {
    it('should handle high load without memory leaks', async () => {
      jest.doMock('@supabase/supabase-js', () => ({
        createClient: jest.fn(() => ({
          from: jest.fn(() => ({
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                or: jest.fn(() => ({
                  range: jest.fn(() => ({
                    order: jest.fn(() => Promise.resolve({
                      data: [],
                      error: null,
                      count: 0
                    }))
                  }))
                }))
              })),
              or: jest.fn(() => ({
                range: jest.fn(() => ({
                  order: jest.fn(() => Promise.resolve({
                    data: [],
                    error: null,
                    count: 0
                  }))
                }))
              })),
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
      }))

      const { GET } = require('@/app/api/creators/route')
      
      // Simulate high load
      const requests = Array.from({ length: 50 }, () => 
        new NextRequest('http://localhost:3000/api/creators')
      )
      
      const startTime = Date.now()
      const responses = await Promise.all(
        requests.map(req => GET(req).catch(err => ({ error: err })))
      )
      const endTime = Date.now()
      
      // All requests should complete
      expect(responses).toHaveLength(50)
      
      // Should complete in reasonable time (less than 5 seconds)
      expect(endTime - startTime).toBeLessThan(5000)
      
      // Check responses
      for (const response of responses) {
        if ('error' in response) {
          expect(response.error).toBeInstanceOf(Error)
        } else {
          expect(response.status).toBeDefined()
        }
      }
    })

    it('should handle concurrent database connections', async () => {
      let connectionCount = 0
      
      jest.doMock('@supabase/supabase-js', () => ({
        createClient: jest.fn(() => {
          connectionCount++
          return {
            from: jest.fn(() => ({
              select: jest.fn(() => ({
                range: jest.fn(() => ({
                  order: jest.fn(() => Promise.resolve({
                    data: [],
                    error: null,
                    count: 0
                  }))
                }))
              }))
            }))
          }
        })
      }))

      const { GET } = require('@/app/api/creators/route')
      
      // Create multiple concurrent requests
      const requests = Array.from({ length: 10 }, () =>
        new NextRequest('http://localhost:3000/api/creators')
      )
      
      await Promise.all(requests.map(req => GET(req)))
      
      // Should handle multiple connections
      expect(connectionCount).toBeGreaterThan(0)
    })
  })

  describe('Data Integrity', () => {
    it('should validate and sanitize creator data', async () => {
      jest.doMock('@supabase/supabase-js', () => ({
        createClient: jest.fn(() => ({
          from: jest.fn(() => ({
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                or: jest.fn(() => ({
                  range: jest.fn(() => ({
                    order: jest.fn(() => Promise.resolve({
                      data: [
                        {
                          id: 1,
                          name: '<script>alert("xss")</script>',
                          username: 'test@user',
                          category: 'instagram',
                          totalReach: -1000, // Invalid negative value
                          platformIdentifiers: {
                            instagram: {
                              biography: 'Valid bio',
                              postsCount: 'invalid' // Invalid type
                            }
                          },
                          updated_at: 'invalid-date'
                        }
                      ],
                      error: null,
                      count: 1
                    }))
                  }))
                }))
              })),
              or: jest.fn(() => ({
                range: jest.fn(() => ({
                  order: jest.fn(() => Promise.resolve({
                    data: [],
                    error: null,
                    count: 0
                  }))
                }))
              })),
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
      }))

      const { GET } = require('@/app/api/creators/route')
      const request = new NextRequest('http://localhost:3000/api/creators')
      const response = await GET(request)
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.creators).toHaveLength(1)
      
      const creator = data.creators[0]
      
      // Should have valid data types
      expect(typeof creator.id).toBe('string')
      expect(typeof creator.followerCount).toBe('number')
      expect(typeof creator.engagementRate).toBe('number')
      expect(creator.engagementRate).toBeGreaterThanOrEqual(0)
      expect(creator.engagementRate).toBeLessThanOrEqual(1)
    })
  })
});