import { Creator } from '@/lib/types/creator'

// Scoring weight configuration
export interface ScoringWeights {
  engagement: number
  followers: number
  growth: number
  consistency: number
}

// Platform-specific baselines for normalization
export interface PlatformBaselines {
  engagement: {
    instagram: number
    tiktok: number
    twitter: number
    youtube: number
    [key: string]: number
  }
  followersLog: number // Logarithmic base for follower normalization
}

// Score breakdown for transparency
export interface ScoreBreakdown {
  totalScore: number
  components: {
    engagement: { raw: number, normalized: number, weighted: number }
    followers: { raw: number, normalized: number, weighted: number }
    growth: { raw: number, normalized: number, weighted: number }
    consistency: { raw: number, normalized: number, weighted: number }
  }
  weights: ScoringWeights
  explanation: string
}

// Default scoring configuration
export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  engagement: 0.4,    // 40% - Most important for quality
  followers: 0.3,     // 30% - Reach indicator
  growth: 0.2,        // 20% - Future potential
  consistency: 0.1    // 10% - Reliability factor
}

// Platform-specific baseline engagement rates
export const PLATFORM_BASELINES: PlatformBaselines = {
  engagement: {
    instagram: 3.5,    // Instagram average ~3.5%
    tiktok: 5.0,       // TikTok average ~5%
    twitter: 0.5,      // Twitter average ~0.5%
    youtube: 2.0,      // YouTube average ~2%
  },
  followersLog: 7     // Log base for normalizing to 0-1 (10^7 = 10M followers)
}

export class CreatorRankingService {
  private weights: ScoringWeights
  private baselines: PlatformBaselines

  constructor(
    weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS,
    baselines: PlatformBaselines = PLATFORM_BASELINES
  ) {
    this.weights = this.validateWeights(weights)
    this.baselines = baselines
  }

  /**
   * Validates that scoring weights sum to 1.0 and are within valid ranges
   */
  private validateWeights(weights: ScoringWeights): ScoringWeights {
    const sum = Object.values(weights).reduce((acc, val) => acc + val, 0)
    
    if (Math.abs(sum - 1.0) > 0.001) {
      throw new Error(`Scoring weights must sum to 1.0, got ${sum}`)
    }

    for (const [key, value] of Object.entries(weights)) {
      if (value < 0 || value > 1) {
        throw new Error(`Weight for ${key} must be between 0 and 1, got ${value}`)
      }
    }

    return weights
  }

  /**
   * Calculates the overall ranking score for a creator
   */
  calculateScore(creator: Creator, historicalData?: any): ScoreBreakdown {
    const engagementScore = this.normalizeEngagement(
      creator.platform,
      creator.engagementRate
    )
    
    const followerScore = this.normalizeFollowers(creator.followerCount)
    
    const growthScore = this.calculateGrowthScore(
      creator,
      historicalData
    )
    
    const consistencyScore = this.calculateConsistencyScore(
      creator.postFrequency || 0
    )

    // Calculate weighted scores
    const weightedEngagement = engagementScore * this.weights.engagement
    const weightedFollowers = followerScore * this.weights.followers
    const weightedGrowth = growthScore * this.weights.growth
    const weightedConsistency = consistencyScore * this.weights.consistency

    // Total score (0-100 scale)
    const totalScore = (
      weightedEngagement +
      weightedFollowers +
      weightedGrowth +
      weightedConsistency
    ) * 100

    return {
      totalScore: Math.round(totalScore * 10) / 10, // Round to 1 decimal
      components: {
        engagement: {
          raw: creator.engagementRate,
          normalized: engagementScore,
          weighted: weightedEngagement
        },
        followers: {
          raw: creator.followerCount,
          normalized: followerScore,
          weighted: weightedFollowers
        },
        growth: {
          raw: 0, // Will be calculated from historical data
          normalized: growthScore,
          weighted: weightedGrowth
        },
        consistency: {
          raw: creator.postFrequency || 0,
          normalized: consistencyScore,
          weighted: weightedConsistency
        }
      },
      weights: this.weights,
      explanation: this.generateExplanation(totalScore, creator)
    }
  }

  /**
   * Normalizes engagement rate based on platform baselines
   */
  private normalizeEngagement(platform: string, rate: number): number {
    const baseline = this.baselines.engagement[platform.toLowerCase()] || 2.0
    
    // Normalize to 0-1 scale, capped at 1.0 for rates above baseline
    return Math.min(rate / baseline, 1.0)
  }

  /**
   * Normalizes follower count using logarithmic scale
   */
  private normalizeFollowers(count: number): number {
    if (count <= 0) return 0
    
    // Log scale normalization (10^7 = 10M followers = 1.0)
    const normalized = Math.log10(count) / this.baselines.followersLog
    
    // Cap at 1.0 for creators with more than 10M followers
    return Math.min(normalized, 1.0)
  }

  /**
   * Calculates growth score based on historical data
   */
  private calculateGrowthScore(creator: Creator, historicalData?: any): number {
    // If no historical data, use a neutral score
    if (!historicalData || !historicalData.metrics) {
      return 0.5
    }

    const currentFollowers = creator.followerCount
    const historicalMetrics = historicalData.metrics

    // Calculate growth rate over different time periods
    let growthScore = 0
    let weightSum = 0

    // 30-day growth (highest weight)
    if (historicalMetrics.followers30DaysAgo) {
      const growth30d = (currentFollowers - historicalMetrics.followers30DaysAgo) / 
                       historicalMetrics.followers30DaysAgo
      const normalized30d = this.normalizeGrowthRate(growth30d, 0.1) // 10% monthly is excellent
      growthScore += normalized30d * 0.5
      weightSum += 0.5
    }

    // 90-day growth (medium weight)
    if (historicalMetrics.followers90DaysAgo) {
      const growth90d = (currentFollowers - historicalMetrics.followers90DaysAgo) / 
                       historicalMetrics.followers90DaysAgo
      const normalized90d = this.normalizeGrowthRate(growth90d, 0.3) // 30% quarterly is excellent
      growthScore += normalized90d * 0.3
      weightSum += 0.3
    }

    // Engagement trend (lower weight)
    if (historicalMetrics.engagementTrend) {
      const engagementGrowth = historicalMetrics.engagementTrend
      const normalizedEngagement = this.normalizeGrowthRate(engagementGrowth, 0.05) // 5% engagement growth is excellent
      growthScore += normalizedEngagement * 0.2
      weightSum += 0.2
    }

    // If we have any historical data, return weighted average
    if (weightSum > 0) {
      return growthScore / weightSum
    }

    // Fallback to neutral score
    return 0.5
  }

  /**
   * Normalizes growth rate to 0-1 scale
   */
  private normalizeGrowthRate(rate: number, excellentThreshold: number): number {
    if (rate <= 0) {
      // Negative or zero growth maps to 0-0.5 range
      return Math.max(0, 0.5 + (rate / excellentThreshold) * 0.5)
    } else {
      // Positive growth maps to 0.5-1.0 range
      return Math.min(1.0, 0.5 + (rate / excellentThreshold) * 0.5)
    }
  }

  /**
   * Calculates consistency score based on posting frequency
   */
  private calculateConsistencyScore(postsPerWeek: number): number {
    // Optimal posting frequency is 3-7 posts per week
    const optimalMin = 3
    const optimalMax = 7
    
    if (postsPerWeek >= optimalMin && postsPerWeek <= optimalMax) {
      return 1.0
    } else if (postsPerWeek < optimalMin) {
      // Linear decrease for under-posting
      return Math.max(postsPerWeek / optimalMin, 0)
    } else {
      // Gradual decrease for over-posting
      const overPostPenalty = Math.max(0, 14 - postsPerWeek) / 7
      return Math.max(overPostPenalty, 0.3) // Minimum 0.3 for very active creators
    }
  }

  /**
   * Generates human-readable explanation of the score
   */
  private generateExplanation(score: number, creator: Creator): string {
    if (score >= 80) {
      return `Exceptional creator with ${creator.followerCount.toLocaleString()} followers and outstanding ${(creator.engagementRate * 100).toFixed(1)}% engagement rate`
    } else if (score >= 60) {
      return `Strong creator performance with solid engagement and consistent posting activity`
    } else if (score >= 40) {
      return `Average creator metrics with room for growth in engagement or consistency`
    } else {
      return `Developing creator - focus on improving engagement rate and posting consistency`
    }
  }

  /**
   * Batch calculates scores for multiple creators
   */
  calculateBatchScores(creators: Creator[]): Map<string, ScoreBreakdown> {
    const scores = new Map<string, ScoreBreakdown>()
    
    for (const creator of creators) {
      scores.set(creator.id, this.calculateScore(creator))
    }
    
    return scores
  }

  /**
   * Updates scoring weights dynamically
   */
  updateWeights(newWeights: Partial<ScoringWeights>): void {
    const merged = { ...this.weights, ...newWeights }
    this.weights = this.validateWeights(merged)
  }
}