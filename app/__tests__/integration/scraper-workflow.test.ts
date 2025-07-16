import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'

// Mock the fetch function
const mockFetch = jest.fn()
global.fetch = mockFetch

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn(),
  }),
}))

// Mock Sonner toast
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warning: jest.fn(),
  },
}))

// Mock data
const mockScrapedProfiles = [
  {
    id: '1',
    username: 'testuser1',
    platform: 'tiktok',
    followerCount: 100000,
    engagementRate: 5.2,
    avgLikesPerPost: 5000,
    videoCount: 50,
    tags: ['dance', 'music'],
    profileUrl: 'https://tiktok.com/@testuser1',
    bio: 'Test bio',
  },
  {
    id: '2',
    username: 'testuser2',
    platform: 'instagram',
    followerCount: 50000,
    engagementRate: 3.8,
    avgLikesPerPost: 1900,
    videoCount: 100,
    tags: ['lifestyle', 'fashion'],
    profileUrl: 'https://instagram.com/testuser2',
    bio: 'Fashion influencer',
  },
]

describe('Scraper Workflow Integration Tests', () => {
  beforeEach(() => {
    mockFetch.mockClear()
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('Scrape API Endpoint', () => {
    it('should handle successful scraping request', async () => {
      // Mock successful API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          profiles: mockScrapedProfiles,
          cached: false,
          demoMode: false,
          cacheInfo: null,
        }),
      })

      const response = await fetch('/api/scraper/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keywords: ['dance', 'music'],
          platforms: ['tiktok', 'instagram'],
          limit: 100,
          demoMode: false,
        }),
      })

      const data = await response.json()

      expect(response.ok).toBe(true)
      expect(data.profiles).toHaveLength(2)
      expect(data.profiles[0].username).toBe('testuser1')
      expect(data.profiles[1].username).toBe('testuser2')
    })

    it('should handle demo mode request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          profiles: mockScrapedProfiles,
          cached: false,
          demoMode: true,
          cacheInfo: null,
        }),
      })

      const response = await fetch('/api/scraper/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keywords: ['test'],
          platforms: ['tiktok'],
          limit: 100,
          demoMode: true,
        }),
      })

      const data = await response.json()

      expect(response.ok).toBe(true)
      expect(data.demoMode).toBe(true)
      expect(data.profiles).toHaveLength(2)
    })

    it('should handle cached results', async () => {
      const cacheInfo = {
        age: 1800, // 30 minutes in seconds
        key: 'scraper:dance,music:tiktok,instagram',
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          profiles: mockScrapedProfiles,
          cached: true,
          demoMode: false,
          cacheInfo,
        }),
      })

      const response = await fetch('/api/scraper/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keywords: ['dance', 'music'],
          platforms: ['tiktok', 'instagram'],
          limit: 100,
          demoMode: false,
        }),
      })

      const data = await response.json()

      expect(response.ok).toBe(true)
      expect(data.cached).toBe(true)
      expect(data.cacheInfo).toEqual(cacheInfo)
    })

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({
          error: 'Internal server error',
        }),
      })

      const response = await fetch('/api/scraper/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keywords: ['test'],
          platforms: ['tiktok'],
          limit: 100,
          demoMode: false,
        }),
      })

      expect(response.ok).toBe(false)
      expect(response.status).toBe(500)
    })

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      try {
        await fetch('/api/scraper/scrape', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            keywords: ['test'],
            platforms: ['tiktok'],
            limit: 100,
            demoMode: false,
          }),
        })
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toBe('Network error')
      }
    })

    it('should validate request parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'Invalid request parameters',
        }),
      })

      const response = await fetch('/api/scraper/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keywords: [], // Empty keywords should fail
          platforms: ['tiktok'],
          limit: 100,
          demoMode: false,
        }),
      })

      expect(response.ok).toBe(false)
      expect(response.status).toBe(400)
    })
  })

  describe('Add Selected API Endpoint', () => {
    it('should handle successful profile transfer', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          added: 2,
          updated: 0,
          failed: 0,
          results: mockScrapedProfiles.map(p => ({
            id: p.id,
            status: 'added',
            creatorId: `creator-${p.id}`,
          })),
        }),
      })

      const response = await fetch('/api/scraper/add-selected', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profiles: mockScrapedProfiles,
        }),
      })

      const data = await response.json()

      expect(response.ok).toBe(true)
      expect(data.added).toBe(2)
      expect(data.failed).toBe(0)
      expect(data.results).toHaveLength(2)
    })

    it('should handle duplicate profile detection', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          added: 1,
          updated: 1,
          failed: 0,
          results: [
            { id: '1', status: 'added', creatorId: 'creator-1' },
            { id: '2', status: 'updated', creatorId: 'creator-2' },
          ],
        }),
      })

      const response = await fetch('/api/scraper/add-selected', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profiles: mockScrapedProfiles,
        }),
      })

      const data = await response.json()

      expect(response.ok).toBe(true)
      expect(data.added).toBe(1)
      expect(data.updated).toBe(1)
      expect(data.failed).toBe(0)
    })

    it('should handle transfer failures', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({
          error: 'Database connection failed',
        }),
      })

      const response = await fetch('/api/scraper/add-selected', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profiles: mockScrapedProfiles,
        }),
      })

      expect(response.ok).toBe(false)
      expect(response.status).toBe(500)
    })

    it('should handle empty profile list', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'No profiles provided',
        }),
      })

      const response = await fetch('/api/scraper/add-selected', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profiles: [],
        }),
      })

      expect(response.ok).toBe(false)
      expect(response.status).toBe(400)
    })
  })

  describe('Cache API Endpoint', () => {
    it('should handle cache clear request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: 'Cache cleared successfully',
          clearedKeys: 5,
        }),
      })

      const response = await fetch('/api/scraper/cache', {
        method: 'DELETE',
      })

      const data = await response.json()

      expect(response.ok).toBe(true)
      expect(data.message).toBe('Cache cleared successfully')
      expect(data.clearedKeys).toBe(5)
    })

    it('should handle cache statistics request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          totalEntries: 10,
          totalSize: 1024000,
          hitRate: 0.75,
          oldestEntry: new Date('2023-01-01').toISOString(),
          newestEntry: new Date('2023-01-15').toISOString(),
        }),
      })

      const response = await fetch('/api/scraper/cache', {
        method: 'GET',
      })

      const data = await response.json()

      expect(response.ok).toBe(true)
      expect(data.totalEntries).toBe(10)
      expect(data.hitRate).toBe(0.75)
    })
  })

  describe('End-to-End Scraper Workflow', () => {
    it('should complete full scraping and transfer workflow', async () => {
      // Step 1: Scrape profiles
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          profiles: mockScrapedProfiles,
          cached: false,
          demoMode: false,
          cacheInfo: null,
        }),
      })

      const scrapeResponse = await fetch('/api/scraper/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keywords: ['dance', 'music'],
          platforms: ['tiktok', 'instagram'],
          limit: 100,
          demoMode: false,
        }),
      })

      const scrapeData = await scrapeResponse.json()
      expect(scrapeResponse.ok).toBe(true)
      expect(scrapeData.profiles).toHaveLength(2)

      // Step 2: Transfer selected profiles
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          added: 2,
          updated: 0,
          failed: 0,
          results: mockScrapedProfiles.map(p => ({
            id: p.id,
            status: 'added',
            creatorId: `creator-${p.id}`,
          })),
        }),
      })

      const transferResponse = await fetch('/api/scraper/add-selected', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profiles: scrapeData.profiles,
        }),
      })

      const transferData = await transferResponse.json()
      expect(transferResponse.ok).toBe(true)
      expect(transferData.added).toBe(2)
      expect(transferData.failed).toBe(0)

      // Verify both calls were made
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('should handle workflow with partial failures', async () => {
      // Step 1: Successful scrape
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          profiles: mockScrapedProfiles,
          cached: false,
          demoMode: false,
          cacheInfo: null,
        }),
      })

      const scrapeResponse = await fetch('/api/scraper/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keywords: ['dance', 'music'],
          platforms: ['tiktok', 'instagram'],
          limit: 100,
          demoMode: false,
        }),
      })

      const scrapeData = await scrapeResponse.json()
      expect(scrapeResponse.ok).toBe(true)

      // Step 2: Partial transfer failure
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          added: 1,
          updated: 0,
          failed: 1,
          results: [
            { id: '1', status: 'added', creatorId: 'creator-1' },
            { id: '2', status: 'failed', error: 'Validation error' },
          ],
        }),
      })

      const transferResponse = await fetch('/api/scraper/add-selected', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profiles: scrapeData.profiles,
        }),
      })

      const transferData = await transferResponse.json()
      expect(transferResponse.ok).toBe(true)
      expect(transferData.added).toBe(1)
      expect(transferData.failed).toBe(1)
    })
  })
})