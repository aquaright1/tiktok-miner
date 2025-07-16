import { PrismaClient } from '@prisma/client';
import { Platform } from '../platform-api/types';
import { PlatformAPIFactory } from '../platform-api/factory';
import { DataAggregationEngine } from '../aggregation';
import { 
  CreatorEvaluationResult, 
  CreatorDiscoveryData,
  DiscoveryConfig 
} from './types';
import { logger } from '../logger';

export class CreatorEvaluator {
  private db: PrismaClient;
  private aggregationEngine: DataAggregationEngine;
  private config: DiscoveryConfig;

  constructor(db: PrismaClient, config?: Partial<DiscoveryConfig>) {
    this.db = db;
    this.aggregationEngine = new DataAggregationEngine(db);
    this.config = {
      qualityThreshold: 60,
      minFollowers: 1000,
      maxFollowers: undefined,
      minEngagementRate: 1.0,
      requiredPlatforms: [],
      excludedCategories: ['adult', 'controversial', 'spam'],
      refreshIntervalHours: 24,
      ...config,
    };
  }

  /**
   * Evaluate a discovered creator
   */
  async evaluateCreator(
    data: CreatorDiscoveryData
  ): Promise<CreatorEvaluationResult> {
    try {
      logger.info(`Evaluating creator: ${data.identifier} on ${data.platform}`);

      // Fetch creator metrics
      const metrics = await this.fetchCreatorMetrics(data);
      if (!metrics) {
        return this.createRejectionResult('Failed to fetch creator metrics');
      }

      // Check basic requirements
      const basicCheck = this.checkBasicRequirements(metrics);
      if (!basicCheck.passed) {
        return this.createRejectionResult(basicCheck.reason!);
      }

      // Calculate quality score
      const qualityScore = this.calculateQualityScore(metrics, data);

      // Determine recommendation
      const recommendation = this.getRecommendation(qualityScore, metrics);

      // Get detailed reasons
      const reasons = this.getEvaluationReasons(qualityScore, metrics, recommendation);

      return {
        qualityScore,
        metrics,
        recommendation,
        reasons,
      };
    } catch (error) {
      logger.error(`Failed to evaluate creator ${data.identifier}`, error);
      return this.createRejectionResult('Evaluation error occurred');
    }
  }

  /**
   * Fetch creator metrics from platform API
   */
  private async fetchCreatorMetrics(
    data: CreatorDiscoveryData
  ): Promise<any> {
    try {
      const apiService = PlatformAPIFactory.createFromEnv(data.platform);
      const profile = await apiService.getProfile(data.identifier);
      const postsResponse = await apiService.getRecentPosts(data.identifier, 20);
      const engagement = await apiService.calculateEngagement(postsResponse.data);

      return {
        followerCount: profile.followerCount,
        engagementRate: engagement.averageEngagementRate,
        contentFrequency: this.calculateContentFrequency(postsResponse.data),
        audienceQuality: this.estimateAudienceQuality(profile, engagement),
        profile,
        posts: postsResponse.data,
      };
    } catch (error) {
      logger.error(`Failed to fetch metrics for ${data.identifier}`, error);
      
      // Use metadata hints if available
      if (data.metadata) {
        return {
          followerCount: data.metadata.followerCount || 0,
          engagementRate: data.metadata.engagementHint || 0,
          contentFrequency: 0,
          audienceQuality: 50,
        };
      }

      return null;
    }
  }

  /**
   * Check basic requirements
   */
  private checkBasicRequirements(
    metrics: any
  ): { passed: boolean; reason?: string } {
    // Check follower count
    if (metrics.followerCount < this.config.minFollowers) {
      return { 
        passed: false, 
        reason: `Follower count (${metrics.followerCount}) below minimum (${this.config.minFollowers})` 
      };
    }

    if (this.config.maxFollowers && metrics.followerCount > this.config.maxFollowers) {
      return { 
        passed: false, 
        reason: `Follower count (${metrics.followerCount}) above maximum (${this.config.maxFollowers})` 
      };
    }

    // Check engagement rate
    if (metrics.engagementRate < this.config.minEngagementRate) {
      return { 
        passed: false, 
        reason: `Engagement rate (${metrics.engagementRate.toFixed(2)}%) below minimum (${this.config.minEngagementRate}%)` 
      };
    }

    // Check for suspicious patterns
    if (this.detectSuspiciousPatterns(metrics)) {
      return { 
        passed: false, 
        reason: 'Suspicious activity patterns detected' 
      };
    }

    return { passed: true };
  }

  /**
   * Calculate quality score (0-100)
   */
  private calculateQualityScore(
    metrics: any,
    data: CreatorDiscoveryData
  ): number {
    let score = 0;

    // Engagement component (35 points)
    const engagementScore = Math.min(35, metrics.engagementRate * 3.5);
    score += engagementScore;

    // Audience quality component (25 points)
    const audienceScore = (metrics.audienceQuality / 100) * 25;
    score += audienceScore;

    // Content consistency component (20 points)
    const consistencyScore = Math.min(20, metrics.contentFrequency * 4);
    score += consistencyScore;

    // Follower tier component (10 points)
    const followerScore = this.getFollowerTierScore(metrics.followerCount);
    score += followerScore;

    // Discovery source bonus (10 points)
    const sourceBonus = this.getDiscoverySourceBonus(data.discoverySource);
    score += sourceBonus;

    return Math.round(Math.min(100, score));
  }

  /**
   * Calculate content frequency (posts per week)
   */
  private calculateContentFrequency(posts: any[]): number {
    if (posts.length < 2) return 0;

    const sortedPosts = posts.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const newestPost = new Date(sortedPosts[0].createdAt);
    const oldestPost = new Date(sortedPosts[sortedPosts.length - 1].createdAt);
    const daysDiff = (newestPost.getTime() - oldestPost.getTime()) / (1000 * 60 * 60 * 24);

    if (daysDiff === 0) return posts.length * 7; // All posts on same day
    
    return (posts.length / daysDiff) * 7; // Posts per week
  }

  /**
   * Estimate audience quality
   */
  private estimateAudienceQuality(profile: any, engagement: any): number {
    let quality = 50; // Base quality

    // High engagement with reasonable followers = quality audience
    if (engagement.averageEngagementRate > 5 && profile.followerCount < 100000) {
      quality += 20;
    }

    // Verified account bonus
    if (profile.isVerified) {
      quality += 10;
    }

    // Good engagement to follower ratio
    const engagementRatio = engagement.totalLikes / engagement.postsAnalyzed / profile.followerCount;
    if (engagementRatio > 0.05) {
      quality += 15;
    }

    // Cap at 100
    return Math.min(100, quality);
  }

  /**
   * Detect suspicious patterns
   */
  private detectSuspiciousPatterns(metrics: any): boolean {
    // Extremely high engagement (possible bots)
    if (metrics.engagementRate > 20) {
      return true;
    }

    // Very low engagement with high followers (bought followers)
    if (metrics.followerCount > 50000 && metrics.engagementRate < 0.5) {
      return true;
    }

    // No recent posts but high metrics
    if (metrics.contentFrequency === 0 && metrics.followerCount > 10000) {
      return true;
    }

    return false;
  }

  /**
   * Get follower tier score
   */
  private getFollowerTierScore(followerCount: number): number {
    if (followerCount >= 1000000) return 10;
    if (followerCount >= 100000) return 8;
    if (followerCount >= 50000) return 6;
    if (followerCount >= 10000) return 4;
    if (followerCount >= 5000) return 2;
    return 1;
  }

  /**
   * Get discovery source bonus
   */
  private getDiscoverySourceBonus(source: any): number {
    switch (source.type) {
      case 'trending':
        return 10;
      case 'recommendation':
        return 8;
      case 'category':
        return 5;
      case 'search':
        return 3;
      default:
        return 0;
    }
  }

  /**
   * Get recommendation based on score
   */
  private getRecommendation(
    qualityScore: number,
    metrics: any
  ): 'add' | 'monitor' | 'reject' {
    if (qualityScore >= this.config.qualityThreshold) {
      return 'add';
    }

    // Consider monitoring if close to threshold with growth potential
    if (qualityScore >= this.config.qualityThreshold * 0.8 && 
        metrics.engagementRate > 3 &&
        metrics.followerCount < 50000) {
      return 'monitor';
    }

    return 'reject';
  }

  /**
   * Get detailed evaluation reasons
   */
  private getEvaluationReasons(
    qualityScore: number,
    metrics: any,
    recommendation: string
  ): string[] {
    const reasons: string[] = [];

    // Quality score reason
    reasons.push(`Quality score: ${qualityScore}/100`);

    // Engagement reason
    if (metrics.engagementRate > 5) {
      reasons.push(`Excellent engagement rate: ${metrics.engagementRate.toFixed(2)}%`);
    } else if (metrics.engagementRate > 2) {
      reasons.push(`Good engagement rate: ${metrics.engagementRate.toFixed(2)}%`);
    } else {
      reasons.push(`Low engagement rate: ${metrics.engagementRate.toFixed(2)}%`);
    }

    // Follower reason
    if (metrics.followerCount > 100000) {
      reasons.push(`Large following: ${metrics.followerCount.toLocaleString()} followers`);
    } else if (metrics.followerCount > 10000) {
      reasons.push(`Moderate following: ${metrics.followerCount.toLocaleString()} followers`);
    } else {
      reasons.push(`Small following: ${metrics.followerCount.toLocaleString()} followers`);
    }

    // Content frequency
    if (metrics.contentFrequency > 5) {
      reasons.push(`Very active: ${metrics.contentFrequency.toFixed(1)} posts/week`);
    } else if (metrics.contentFrequency > 2) {
      reasons.push(`Active: ${metrics.contentFrequency.toFixed(1)} posts/week`);
    } else {
      reasons.push(`Low activity: ${metrics.contentFrequency.toFixed(1)} posts/week`);
    }

    // Recommendation specific
    if (recommendation === 'add') {
      reasons.push('Meets all quality criteria');
    } else if (recommendation === 'monitor') {
      reasons.push('Shows growth potential, monitoring recommended');
    } else {
      reasons.push('Does not meet minimum quality standards');
    }

    return reasons;
  }

  /**
   * Create rejection result
   */
  private createRejectionResult(reason: string): CreatorEvaluationResult {
    return {
      qualityScore: 0,
      metrics: {
        followerCount: 0,
        engagementRate: 0,
        contentFrequency: 0,
        audienceQuality: 0,
      },
      recommendation: 'reject',
      reasons: [reason],
    };
  }

  /**
   * Batch evaluate multiple creators
   */
  async batchEvaluate(
    creators: CreatorDiscoveryData[]
  ): Promise<Map<string, CreatorEvaluationResult>> {
    const results = new Map<string, CreatorEvaluationResult>();

    // Process in parallel with concurrency limit
    const batchSize = 5;
    for (let i = 0; i < creators.length; i += batchSize) {
      const batch = creators.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(creator => 
          this.evaluateCreator(creator)
            .then(result => ({ key: `${creator.platform}-${creator.identifier}`, result }))
        )
      );

      for (const { key, result } of batchResults) {
        results.set(key, result);
      }
    }

    return results;
  }
}