import { 
  NormalizedMetrics, 
  CompositeScore, 
  ScoreBreakdown, 
  CreatorTier,
  PlatformData 
} from './types';
import { logger } from '../logger';

export class CompositeScorer {
  private scoreWeights = {
    reach: 0.25,
    engagement: 0.25,
    consistency: 0.20,
    audienceQuality: 0.20,
    growth: 0.10,
  };

  calculateCompositeScore(
    metrics: NormalizedMetrics,
    platformsData: PlatformData[]
  ): CompositeScore {
    const breakdown = this.calculateScoreBreakdown(metrics, platformsData);
    const overallScore = this.computeOverallScore(breakdown);
    const tier = this.determineTier(overallScore, metrics);
    const confidence = this.calculateConfidence(platformsData, metrics);

    return {
      overallScore,
      breakdown,
      tier,
      confidence,
    };
  }

  private calculateScoreBreakdown(
    metrics: NormalizedMetrics,
    platformsData: PlatformData[]
  ): ScoreBreakdown {
    return {
      reach: this.scoreReach(metrics.totalReach),
      engagement: this.scoreEngagement(metrics.averageEngagementRate),
      consistency: this.scoreConsistency(metrics.contentConsistency, metrics.contentFrequency),
      audienceQuality: this.scoreAudienceQuality(metrics.audienceQuality),
      growth: this.scoreGrowth(metrics.growthRate),
    };
  }

  private scoreReach(totalReach: number): number {
    // Logarithmic scoring for reach to handle wide range of follower counts
    // Max score of 25 achieved at 1M+ followers
    const logReach = Math.log10(totalReach + 1);
    
    if (totalReach >= 1000000) return 25;
    if (totalReach >= 500000) return 23;
    if (totalReach >= 100000) return 20;
    if (totalReach >= 50000) return 17;
    if (totalReach >= 10000) return 14;
    if (totalReach >= 5000) return 11;
    if (totalReach >= 1000) return 8;
    if (totalReach >= 500) return 5;
    
    return Math.min(25, logReach * 3);
  }

  private scoreEngagement(engagementRate: number): number {
    // Engagement rate scoring (max 25 points)
    // High engagement rates are valuable but cap to prevent gaming
    
    if (engagementRate >= 10) return 25;
    if (engagementRate >= 7) return 23;
    if (engagementRate >= 5) return 20;
    if (engagementRate >= 3) return 17;
    if (engagementRate >= 2) return 14;
    if (engagementRate >= 1) return 10;
    if (engagementRate >= 0.5) return 6;
    
    return Math.max(0, engagementRate * 5);
  }

  private scoreConsistency(
    contentConsistency: number,
    contentFrequency: ContentFrequency
  ): number {
    // Max 20 points for consistency
    const consistencyScore = contentConsistency * 10; // 0-10 points
    
    // Frequency scoring (0-10 points)
    let frequencyScore = 0;
    if (contentFrequency.postsPerWeek >= 7) {
      frequencyScore = 10;
    } else if (contentFrequency.postsPerWeek >= 5) {
      frequencyScore = 8;
    } else if (contentFrequency.postsPerWeek >= 3) {
      frequencyScore = 6;
    } else if (contentFrequency.postsPerWeek >= 1) {
      frequencyScore = 4;
    } else {
      frequencyScore = Math.max(0, contentFrequency.postsPerWeek * 4);
    }

    // Penalize if last post is too old
    const daysSinceLastPost = (Date.now() - contentFrequency.lastPostDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceLastPost > 30) {
      frequencyScore *= 0.5;
    } else if (daysSinceLastPost > 14) {
      frequencyScore *= 0.8;
    }

    return consistencyScore + frequencyScore;
  }

  private scoreAudienceQuality(audienceQuality: AudienceQualityScore): number {
    // Max 20 points for audience quality
    // Direct mapping from the 0-100 quality score to 0-20
    return Math.min(20, audienceQuality.overallScore * 0.2);
  }

  private scoreGrowth(growthRate: number): number {
    // Max 10 points for growth
    // Positive growth is rewarded, negative growth is penalized
    
    if (growthRate >= 20) return 10;
    if (growthRate >= 15) return 9;
    if (growthRate >= 10) return 8;
    if (growthRate >= 5) return 6;
    if (growthRate >= 0) return 4;
    if (growthRate >= -5) return 2;
    
    return Math.max(0, Math.min(10, 5 + growthRate * 0.2));
  }

  private computeOverallScore(breakdown: ScoreBreakdown): number {
    const weightedSum = 
      breakdown.reach * (this.scoreWeights.reach / 0.25) +
      breakdown.engagement * (this.scoreWeights.engagement / 0.25) +
      breakdown.consistency * (this.scoreWeights.consistency / 0.20) +
      breakdown.audienceQuality * (this.scoreWeights.audienceQuality / 0.20) +
      breakdown.growth * (this.scoreWeights.growth / 0.10);

    // Ensure score is between 0 and 100
    return Math.max(0, Math.min(100, weightedSum));
  }

  private determineTier(score: number, metrics: NormalizedMetrics): CreatorTier {
    // Tier determination considers both score and specific thresholds
    
    // Platinum tier requires high score AND significant reach
    if (score >= 85 && metrics.totalReach >= 100000) {
      return CreatorTier.PLATINUM;
    }
    
    // Gold tier
    if (score >= 70 || (score >= 65 && metrics.totalReach >= 50000)) {
      return CreatorTier.GOLD;
    }
    
    // Silver tier
    if (score >= 55 || (score >= 50 && metrics.totalReach >= 10000)) {
      return CreatorTier.SILVER;
    }
    
    // Bronze tier
    if (score >= 40 || (score >= 35 && metrics.totalReach >= 5000)) {
      return CreatorTier.BRONZE;
    }
    
    // Emerging tier for everyone else with potential
    return CreatorTier.EMERGING;
  }

  private calculateConfidence(
    platformsData: PlatformData[],
    metrics: NormalizedMetrics
  ): number {
    let confidence = 1.0;

    // Reduce confidence for limited data
    const totalPosts = platformsData.reduce((sum, data) => sum + data.posts.length, 0);
    if (totalPosts < 5) {
      confidence *= 0.6;
    } else if (totalPosts < 10) {
      confidence *= 0.8;
    } else if (totalPosts < 20) {
      confidence *= 0.9;
    }

    // Reduce confidence for single platform
    if (platformsData.length === 1) {
      confidence *= 0.85;
    }

    // Reduce confidence for old data
    const oldestUpdate = Math.min(
      ...platformsData.map(data => data.lastUpdated.getTime())
    );
    const daysSinceUpdate = (Date.now() - oldestUpdate) / (1000 * 60 * 60 * 24);
    
    if (daysSinceUpdate > 30) {
      confidence *= 0.7;
    } else if (daysSinceUpdate > 7) {
      confidence *= 0.9;
    }

    // Reduce confidence for inconsistent metrics
    if (metrics.contentConsistency < 0.3) {
      confidence *= 0.9;
    }

    // Reduce confidence for suspicious patterns
    if (metrics.audienceQuality.authenticity < 0.5) {
      confidence *= 0.8;
    }

    return Math.max(0.3, confidence);
  }

  // Advanced scoring methods for specific use cases

  calculateNicheScore(
    metrics: NormalizedMetrics,
    targetEngagementRate: number = 5
  ): number {
    // Score optimized for niche/micro-influencers
    // Prioritizes engagement and quality over reach
    
    const engagementBonus = Math.min(
      30,
      (metrics.averageEngagementRate / targetEngagementRate) * 20
    );
    
    const qualityBonus = metrics.audienceQuality.overallScore * 0.4;
    
    const consistencyBonus = metrics.contentConsistency * 20;
    
    const reachPenalty = metrics.totalReach > 100000 ? -10 : 0;
    
    return Math.max(0, Math.min(100, 
      engagementBonus + qualityBonus + consistencyBonus + reachPenalty + 30
    ));
  }

  calculateCampaignScore(
    metrics: NormalizedMetrics,
    campaignRequirements: {
      minReach?: number;
      minEngagement?: number;
      requiredPlatforms?: number;
      targetAudience?: string;
    }
  ): number {
    let score = 100;

    // Check minimum reach requirement
    if (campaignRequirements.minReach && metrics.totalReach < campaignRequirements.minReach) {
      score -= 30;
    }

    // Check minimum engagement requirement
    if (campaignRequirements.minEngagement && metrics.averageEngagementRate < campaignRequirements.minEngagement) {
      score -= 25;
    }

    // Check platform diversity requirement
    if (campaignRequirements.requiredPlatforms) {
      const platformCount = Object.keys(metrics.platformDistribution.platformWeights).length;
      if (platformCount < campaignRequirements.requiredPlatforms) {
        score -= 20;
      }
    }

    // Add bonuses for exceeding requirements
    if (metrics.totalReach > (campaignRequirements.minReach || 0) * 2) {
      score += 10;
    }

    if (metrics.averageEngagementRate > (campaignRequirements.minEngagement || 0) * 1.5) {
      score += 10;
    }

    return Math.max(0, Math.min(100, score));
  }
}