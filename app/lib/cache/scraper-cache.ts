import { logger } from '@/lib/logger'
import crypto from 'crypto'

export interface CacheEntry {
  data: any
  timestamp: number
  ttl: number // Time to live in seconds
  platforms: string[]
  keywords: string[]
}

export class ScraperCache {
  private cache: Map<string, CacheEntry> = new Map()
  private readonly defaultTTL = 3600 // 1 hour in seconds

  /**
   * Generate a cache key from keywords and platforms
   */
  private generateCacheKey(keywords: string[], platforms: string[]): string {
    const sortedKeywords = [...keywords].sort().join(',')
    const sortedPlatforms = [...platforms].sort().join(',')
    const content = `keywords:${sortedKeywords}|platforms:${sortedPlatforms}`
    return crypto.createHash('md5').update(content).digest('hex')
  }

  /**
   * Check if a cache entry is still valid
   */
  private isValidEntry(entry: CacheEntry): boolean {
    const now = Math.floor(Date.now() / 1000)
    return (entry.timestamp + entry.ttl) > now
  }

  /**
   * Get cached results for given keywords and platforms
   */
  async get(keywords: string[], platforms: string[]): Promise<any | null> {
    try {
      const key = this.generateCacheKey(keywords, platforms)
      const entry = this.cache.get(key)

      if (!entry) {
        logger.debug('Cache miss', { key, keywords, platforms })
        return null
      }

      if (!this.isValidEntry(entry)) {
        logger.debug('Cache entry expired', { key, age: Math.floor(Date.now() / 1000) - entry.timestamp })
        this.cache.delete(key)
        return null
      }

      logger.info('Cache hit', { 
        key, 
        keywords, 
        platforms, 
        profileCount: entry.data?.length || 0,
        age: Math.floor(Date.now() / 1000) - entry.timestamp 
      })
      
      return entry.data
    } catch (error) {
      logger.error('Cache get error', { error, keywords, platforms })
      return null
    }
  }

  /**
   * Store results in cache
   */
  async set(
    keywords: string[], 
    platforms: string[], 
    data: any, 
    ttl?: number
  ): Promise<void> {
    try {
      const key = this.generateCacheKey(keywords, platforms)
      const entry: CacheEntry = {
        data,
        timestamp: Math.floor(Date.now() / 1000),
        ttl: ttl || this.defaultTTL,
        platforms: [...platforms],
        keywords: [...keywords]
      }

      this.cache.set(key, entry)
      
      logger.info('Cache set', { 
        key, 
        keywords, 
        platforms, 
        profileCount: data?.length || 0,
        ttl: entry.ttl 
      })

      // Clean up expired entries periodically
      this.cleanupExpired()
    } catch (error) {
      logger.error('Cache set error', { error, keywords, platforms })
    }
  }

  /**
   * Check if results exist in cache without retrieving them
   */
  async has(keywords: string[], platforms: string[]): Promise<boolean> {
    const key = this.generateCacheKey(keywords, platforms)
    const entry = this.cache.get(key)
    return entry ? this.isValidEntry(entry) : false
  }

  /**
   * Clear all cached results
   */
  async clear(): Promise<void> {
    this.cache.clear()
    logger.info('Cache cleared')
  }

  /**
   * Get cache statistics
   */
  getStats(): { 
    totalEntries: number
    validEntries: number
    expiredEntries: number
    totalSize: number
  } {
    const now = Math.floor(Date.now() / 1000)
    let validEntries = 0
    let expiredEntries = 0
    let totalSize = 0

    for (const [key, entry] of this.cache.entries()) {
      if (this.isValidEntry(entry)) {
        validEntries++
      } else {
        expiredEntries++
      }
      totalSize += JSON.stringify(entry).length
    }

    return {
      totalEntries: this.cache.size,
      validEntries,
      expiredEntries,
      totalSize
    }
  }

  /**
   * Remove expired entries from cache
   */
  private cleanupExpired(): void {
    const now = Math.floor(Date.now() / 1000)
    let removedCount = 0

    for (const [key, entry] of this.cache.entries()) {
      if (!this.isValidEntry(entry)) {
        this.cache.delete(key)
        removedCount++
      }
    }

    if (removedCount > 0) {
      logger.debug('Cache cleanup', { removedCount })
    }
  }

  /**
   * Get cache entry details for debugging
   */
  getCacheInfo(keywords: string[], platforms: string[]): {
    key: string
    exists: boolean
    isValid: boolean
    age?: number
    ttl?: number
    profileCount?: number
  } {
    const key = this.generateCacheKey(keywords, platforms)
    const entry = this.cache.get(key)

    if (!entry) {
      return { key, exists: false, isValid: false }
    }

    const now = Math.floor(Date.now() / 1000)
    const age = now - entry.timestamp
    const isValid = this.isValidEntry(entry)

    return {
      key,
      exists: true,
      isValid,
      age,
      ttl: entry.ttl,
      profileCount: entry.data?.length || 0
    }
  }
}

// Export singleton instance
export const scraperCache = new ScraperCache()