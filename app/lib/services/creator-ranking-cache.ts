import { prisma } from '@/lib/db'
import { ScoreBreakdown } from './creator-ranking'

interface CachedScore {
  creatorId: string
  score: ScoreBreakdown
  calculatedAt: Date
  expiresAt: Date
}

export class CreatorRankingCache {
  private static readonly CACHE_DURATION_HOURS = 24 // Cache scores for 24 hours
  private static memoryCache = new Map<string, CachedScore>()

  /**
   * Gets cached score from memory or database
   */
  static async getCachedScore(creatorId: string): Promise<ScoreBreakdown | null> {
    // Check memory cache first
    const memoryCached = this.memoryCache.get(creatorId)
    if (memoryCached && memoryCached.expiresAt > new Date()) {
      return memoryCached.score
    }

    // Check database cache
    try {
      const dbCached = await prisma.creatorProfile.findUnique({
        where: { candidateId: creatorId },
        select: {
          cachedScore: true,
          cachedScoreExpiry: true
        }
      })

      if (dbCached?.cachedScore && dbCached.cachedScoreExpiry && 
          dbCached.cachedScoreExpiry > new Date()) {
        const score = dbCached.cachedScore as unknown as ScoreBreakdown
        
        // Update memory cache
        this.memoryCache.set(creatorId, {
          creatorId,
          score,
          calculatedAt: new Date(),
          expiresAt: dbCached.cachedScoreExpiry
        })
        
        return score
      }
    } catch (error) {
      console.error('Error fetching cached score:', error)
    }

    return null
  }

  /**
   * Caches score in memory and database
   */
  static async setCachedScore(
    creatorId: string, 
    score: ScoreBreakdown
  ): Promise<void> {
    const now = new Date()
    const expiresAt = new Date(now.getTime() + this.CACHE_DURATION_HOURS * 60 * 60 * 1000)

    // Update memory cache
    this.memoryCache.set(creatorId, {
      creatorId,
      score,
      calculatedAt: now,
      expiresAt
    })

    // Update database cache
    try {
      await prisma.creatorProfile.update({
        where: { candidateId: creatorId },
        data: {
          cachedScore: score as any,
          cachedScoreExpiry: expiresAt
        }
      })
    } catch (error) {
      console.error('Error caching score:', error)
    }
  }

  /**
   * Invalidates cached score for a creator
   */
  static async invalidateCache(creatorId: string): Promise<void> {
    // Remove from memory cache
    this.memoryCache.delete(creatorId)

    // Clear database cache
    try {
      await prisma.creatorProfile.update({
        where: { candidateId: creatorId },
        data: {
          cachedScore: null,
          cachedScoreExpiry: null
        }
      })
    } catch (error) {
      console.error('Error invalidating cache:', error)
    }
  }

  /**
   * Batch invalidates cached scores
   */
  static async invalidateBatch(creatorIds: string[]): Promise<void> {
    // Clear memory cache
    for (const id of creatorIds) {
      this.memoryCache.delete(id)
    }

    // Clear database cache
    try {
      await prisma.creatorProfile.updateMany({
        where: { candidateId: { in: creatorIds } },
        data: {
          cachedScore: null,
          cachedScoreExpiry: null
        }
      })
    } catch (error) {
      console.error('Error batch invalidating cache:', error)
    }
  }

  /**
   * Clears all expired cached scores
   */
  static async clearExpiredCache(): Promise<void> {
    const now = new Date()

    // Clear expired from memory
    for (const [id, cached] of this.memoryCache.entries()) {
      if (cached.expiresAt <= now) {
        this.memoryCache.delete(id)
      }
    }

    // Clear expired from database
    try {
      await prisma.creatorProfile.updateMany({
        where: {
          cachedScoreExpiry: { lte: now }
        },
        data: {
          cachedScore: null,
          cachedScoreExpiry: null
        }
      })
    } catch (error) {
      console.error('Error clearing expired cache:', error)
    }
  }

  /**
   * Gets memory cache stats for monitoring
   */
  static getCacheStats() {
    const now = new Date()
    let validCount = 0
    let expiredCount = 0

    for (const cached of this.memoryCache.values()) {
      if (cached.expiresAt > now) {
        validCount++
      } else {
        expiredCount++
      }
    }

    return {
      totalCached: this.memoryCache.size,
      validCount,
      expiredCount,
      memoryUsage: process.memoryUsage().heapUsed
    }
  }
}