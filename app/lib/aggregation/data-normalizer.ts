import { 
  PlatformData, 
  NormalizedMetrics, 
  ContentFrequency, 
  AudienceQualityScore,
  PlatformDistribution,
  GrowthMetrics,
  HistoricalDataPoint
} from './types';
import { Platform, Post } from '../platform-api/types';
import { logger } from '../logger';

export class DataNormalizer {
  private platformWeights: Record<Platform, number> = {
    [Platform.INSTAGRAM]: 0.35,
    [Platform.TIKTOK]: 0.35,
    [Platform.TWITTER]: 0.20,
    // Add weights for YouTube and LinkedIn when implemented
  };

  normalizeData(platformsData: PlatformData[]): NormalizedMetrics {
    if (platformsData.length === 0) {
      throw new Error('No platform data provided for normalization');
    }

    return {
      totalReach: this.calculateTotalReach(platformsData),
      averageEngagementRate: this.calculateWeightedEngagement(platformsData),
      contentFrequency: this.analyzeContentFrequency(platformsData),
      audienceQuality: this.assessAudienceQuality(platformsData),
      growthRate: this.calculateGrowthRate(platformsData),
      contentConsistency: this.calculateContentConsistency(platformsData),
      platformDistribution: this.analyzePlatformDistribution(platformsData),
    };
  }

  private calculateTotalReach(platformsData: PlatformData[]): number {
    // Calculate unique reach accounting for audience overlap
    const totalFollowers = platformsData.reduce(
      (sum, data) => sum + data.profile.followerCount,
      0
    );

    // Apply overlap adjustment (assume 20-30% overlap between platforms)
    const overlapFactor = 1 - (0.25 * Math.min(platformsData.length - 1, 3) / 3);
    return Math.round(totalFollowers * overlapFactor);
  }

  private calculateWeightedEngagement(platformsData: PlatformData[]): number {
    let weightedSum = 0;
    let totalWeight = 0;

    for (const data of platformsData) {
      const weight = this.platformWeights[data.platform] || 0.25;
      const engagementRate = data.metrics.averageEngagementRate;
      
      // Normalize engagement rates by platform (different platforms have different baselines)
      const normalizedRate = this.normalizePlatformEngagement(
        data.platform,
        engagementRate
      );

      weightedSum += normalizedRate * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  private normalizePlatformEngagement(platform: Platform, rate: number): number {
    // Platform-specific normalization factors based on typical engagement rates
    const normalizationFactors: Record<Platform, number> = {
      [Platform.INSTAGRAM]: 1.0, // Baseline
      [Platform.TIKTOK]: 0.6, // TikTok typically has higher raw engagement
      [Platform.TWITTER]: 2.5, // Twitter typically has lower raw engagement
    };

    const factor = normalizationFactors[platform] || 1.0;
    return Math.min(rate * factor, 100); // Cap at 100%
  }

  private analyzeContentFrequency(platformsData: PlatformData[]): ContentFrequency {
    const allPosts = platformsData.flatMap(data => data.posts);
    
    if (allPosts.length === 0) {
      return {
        postsPerDay: 0,
        postsPerWeek: 0,
        postsPerMonth: 0,
        consistency: 0,
        lastPostDate: new Date(),
        averageTimeBetweenPosts: 0,
      };
    }

    // Sort posts by date
    const sortedPosts = allPosts.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );

    const lastPostDate = sortedPosts[0].createdAt;
    const oldestPostDate = sortedPosts[sortedPosts.length - 1].createdAt;
    const timeSpanDays = (lastPostDate.getTime() - oldestPostDate.getTime()) / (1000 * 60 * 60 * 24);

    const postsPerDay = timeSpanDays > 0 ? allPosts.length / timeSpanDays : 0;
    const postsPerWeek = postsPerDay * 7;
    const postsPerMonth = postsPerDay * 30;

    // Calculate posting consistency
    const consistency = this.calculatePostingConsistency(sortedPosts);
    
    // Calculate average time between posts
    const averageTimeBetweenPosts = this.calculateAverageTimeBetweenPosts(sortedPosts);

    return {
      postsPerDay,
      postsPerWeek,
      postsPerMonth,
      consistency,
      lastPostDate,
      averageTimeBetweenPosts,
    };
  }

  private calculatePostingConsistency(posts: Post[]): number {
    if (posts.length < 2) return 0;

    const intervals: number[] = [];
    for (let i = 1; i < posts.length; i++) {
      const interval = posts[i - 1].createdAt.getTime() - posts[i].createdAt.getTime();
      intervals.push(interval);
    }

    const avgInterval = intervals.reduce((sum, int) => sum + int, 0) / intervals.length;
    const variance = intervals.reduce(
      (sum, int) => sum + Math.pow(int - avgInterval, 2),
      0
    ) / intervals.length;
    
    const stdDev = Math.sqrt(variance);
    const cv = stdDev / avgInterval; // Coefficient of variation

    // Convert to 0-1 score (lower CV = higher consistency)
    return Math.max(0, Math.min(1, 1 - cv));
  }

  private calculateAverageTimeBetweenPosts(posts: Post[]): number {
    if (posts.length < 2) return 0;

    let totalInterval = 0;
    for (let i = 1; i < posts.length; i++) {
      totalInterval += posts[i - 1].createdAt.getTime() - posts[i].createdAt.getTime();
    }

    return totalInterval / (posts.length - 1) / (1000 * 60 * 60); // Convert to hours
  }

  private assessAudienceQuality(platformsData: PlatformData[]): AudienceQualityScore {
    let totalFollowers = 0;
    let totalEngagement = 0;
    let platformScores: number[] = [];

    for (const data of platformsData) {
      const followers = data.profile.followerCount;
      const engagementRate = data.metrics.averageEngagementRate;
      
      totalFollowers += followers;
      totalEngagement += engagementRate * followers;

      // Calculate platform-specific quality indicators
      const platformScore = this.calculatePlatformAudienceQuality(data);
      platformScores.push(platformScore);
    }

    const engagementToFollowerRatio = totalFollowers > 0 
      ? (totalEngagement / totalFollowers) / 100 
      : 0;

    // Estimate active engagers percentage
    const activeEngagersPercent = Math.min(
      engagementToFollowerRatio * 100,
      30 // Cap at 30% as realistic maximum
    );

    // Calculate authenticity score based on engagement patterns
    const authenticity = this.calculateAuthenticityScore(platformsData);
    
    // Calculate relevance based on content consistency and engagement
    const relevance = this.calculateRelevanceScore(platformsData);

    // Overall score calculation
    const overallScore = (
      authenticity * 30 +
      relevance * 30 +
      activeEngagersPercent * 1.5 +
      Math.min(engagementToFollowerRatio * 100, 10) * 2.5
    );

    return {
      engagementToFollowerRatio,
      activeEngagersPercent,
      authenticity,
      relevance,
      overallScore: Math.min(overallScore, 100),
    };
  }

  private calculatePlatformAudienceQuality(data: PlatformData): number {
    const { metrics, profile } = data;
    
    // High engagement with relatively low followers indicates quality audience
    const engagementQuality = metrics.averageEngagementRate;
    const followerQuality = Math.min(1, 100000 / (profile.followerCount + 1));
    
    return (engagementQuality * 0.7 + followerQuality * 0.3) * 100;
  }

  private calculateAuthenticityScore(platformsData: PlatformData[]): number {
    // Check for suspicious patterns
    let score = 1.0;

    for (const data of platformsData) {
      const { metrics, profile } = data;
      
      // Penalize extremely high engagement rates (might indicate bots)
      if (metrics.averageEngagementRate > 20) {
        score *= 0.8;
      }

      // Penalize very low engagement with high followers
      if (profile.followerCount > 10000 && metrics.averageEngagementRate < 0.5) {
        score *= 0.7;
      }

      // Check engagement distribution
      const engagementVariance = this.calculateEngagementVariance(data.posts);
      if (engagementVariance < 0.1) {
        score *= 0.9; // Too consistent might indicate automation
      }
    }

    return Math.max(0.3, score);
  }

  private calculateEngagementVariance(posts: Post[]): number {
    if (posts.length < 2) return 0;

    const engagements = posts
      .map(p => p.engagementRate)
      .filter((rate): rate is number => rate !== undefined);

    if (engagements.length < 2) return 0;

    const mean = engagements.reduce((sum, rate) => sum + rate, 0) / engagements.length;
    const variance = engagements.reduce(
      (sum, rate) => sum + Math.pow(rate - mean, 2),
      0
    ) / engagements.length;

    return variance / (mean + 1); // Normalized variance
  }

  private calculateRelevanceScore(platformsData: PlatformData[]): number {
    // Based on content consistency and engagement patterns
    let totalRelevance = 0;
    let count = 0;

    for (const data of platformsData) {
      const posts = data.posts;
      if (posts.length === 0) continue;

      // Check hashtag consistency (for platforms that support it)
      const hashtagConsistency = this.calculateHashtagConsistency(posts);
      
      // Check engagement stability
      const engagementStability = this.calculateEngagementStability(posts);

      totalRelevance += (hashtagConsistency * 0.5 + engagementStability * 0.5);
      count++;
    }

    return count > 0 ? totalRelevance / count : 0.5;
  }

  private calculateHashtagConsistency(posts: Post[]): number {
    const allHashtags = posts.flatMap(p => p.hashtags || []);
    if (allHashtags.length === 0) return 0.5; // Neutral if no hashtags

    const hashtagFreq = new Map<string, number>();
    allHashtags.forEach(tag => {
      hashtagFreq.set(tag, (hashtagFreq.get(tag) || 0) + 1);
    });

    // Calculate how often top hashtags appear
    const sortedHashtags = Array.from(hashtagFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const topHashtagFrequency = sortedHashtags.reduce(
      (sum, [_, freq]) => sum + freq,
      0
    ) / allHashtags.length;

    return Math.min(topHashtagFrequency * 2, 1); // Scale to 0-1
  }

  private calculateEngagementStability(posts: Post[]): number {
    if (posts.length < 3) return 0.5;

    // Calculate moving average stability
    const engagements = posts
      .map(p => p.engagementRate || 0)
      .filter(rate => rate > 0);

    if (engagements.length < 3) return 0.5;

    const movingAverages: number[] = [];
    for (let i = 2; i < engagements.length; i++) {
      const avg = (engagements[i] + engagements[i-1] + engagements[i-2]) / 3;
      movingAverages.push(avg);
    }

    // Calculate variance in moving averages
    const mean = movingAverages.reduce((sum, avg) => sum + avg, 0) / movingAverages.length;
    const variance = movingAverages.reduce(
      (sum, avg) => sum + Math.pow(avg - mean, 2),
      0
    ) / movingAverages.length;

    const cv = Math.sqrt(variance) / (mean + 1);
    return Math.max(0, Math.min(1, 1 - cv));
  }

  private calculateGrowthRate(platformsData: PlatformData[]): number {
    // This would ideally use historical data
    // For now, estimate based on engagement trends
    let totalGrowthScore = 0;
    let count = 0;

    for (const data of platformsData) {
      const posts = data.posts.sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
      );

      if (posts.length < 5) continue;

      // Compare engagement of recent posts vs older posts
      const recentPosts = posts.slice(-Math.ceil(posts.length / 3));
      const olderPosts = posts.slice(0, Math.floor(posts.length / 3));

      const recentEngagement = recentPosts.reduce(
        (sum, p) => sum + (p.engagementRate || 0),
        0
      ) / recentPosts.length;

      const olderEngagement = olderPosts.reduce(
        (sum, p) => sum + (p.engagementRate || 0),
        0
      ) / olderPosts.length;

      const growthRate = olderEngagement > 0
        ? ((recentEngagement - olderEngagement) / olderEngagement) * 100
        : 0;

      totalGrowthScore += Math.max(-50, Math.min(50, growthRate));
      count++;
    }

    return count > 0 ? totalGrowthScore / count : 0;
  }

  private calculateContentConsistency(platformsData: PlatformData[]): number {
    const consistencyScores: number[] = [];

    for (const data of platformsData) {
      const posts = data.posts;
      if (posts.length < 2) continue;

      // Calculate posting interval consistency
      const postingConsistency = this.calculatePostingConsistency(posts);
      
      // Calculate content type consistency
      const contentTypeConsistency = this.calculateContentTypeConsistency(posts);

      consistencyScores.push((postingConsistency + contentTypeConsistency) / 2);
    }

    return consistencyScores.length > 0
      ? consistencyScores.reduce((sum, score) => sum + score, 0) / consistencyScores.length
      : 0;
  }

  private calculateContentTypeConsistency(posts: Post[]): number {
    if (posts.length === 0) return 0;

    const mediaTypes = posts.map(p => p.mediaType);
    const typeFreq = new Map<string, number>();
    
    mediaTypes.forEach(type => {
      typeFreq.set(type, (typeFreq.get(type) || 0) + 1);
    });

    // Calculate entropy as measure of consistency
    const total = mediaTypes.length;
    let entropy = 0;
    
    typeFreq.forEach(freq => {
      const p = freq / total;
      entropy -= p * Math.log2(p);
    });

    // Normalize entropy (lower = more consistent)
    const maxEntropy = Math.log2(typeFreq.size);
    return maxEntropy > 0 ? 1 - (entropy / maxEntropy) : 1;
  }

  private analyzePlatformDistribution(platformsData: PlatformData[]): PlatformDistribution {
    // Determine primary platform based on followers and engagement
    let primaryPlatform = platformsData[0].platform;
    let maxScore = 0;

    const platformWeights: Record<Platform, number> = {} as Record<Platform, number>;

    for (const data of platformsData) {
      const score = data.profile.followerCount * (1 + data.metrics.averageEngagementRate / 100);
      platformWeights[data.platform] = score;

      if (score > maxScore) {
        maxScore = score;
        primaryPlatform = data.platform;
      }
    }

    // Normalize weights
    const totalWeight = Object.values(platformWeights).reduce((sum, w) => sum + w, 0);
    Object.keys(platformWeights).forEach(platform => {
      platformWeights[platform as Platform] = platformWeights[platform as Platform] / totalWeight;
    });

    // Calculate cross-platform synergy
    const synergy = this.calculateCrossPlatformSynergy(platformsData);

    return {
      primaryPlatform,
      platformWeights,
      crossPlatformSynergy: synergy,
    };
  }

  private calculateCrossPlatformSynergy(platformsData: PlatformData[]): number {
    if (platformsData.length < 2) return 0;

    // Check for consistent branding/username
    const usernames = platformsData.map(d => d.profile.username.toLowerCase());
    const usernameConsistency = usernames.every(u => u === usernames[0]) ? 0.3 : 0;

    // Check for cross-promotion mentions
    let crossPromotion = 0;
    for (const data of platformsData) {
      const mentions = data.posts.flatMap(p => p.mentions || []);
      const otherPlatforms = platformsData
        .filter(d => d.platform !== data.platform)
        .map(d => d.profile.username.toLowerCase());

      const crossMentions = mentions.filter(m => 
        otherPlatforms.some(op => m.toLowerCase().includes(op))
      ).length;

      crossPromotion += Math.min(crossMentions * 0.1, 0.3);
    }

    // Check for content timing correlation
    const timingCorrelation = this.calculatePostingTimeCorrelation(platformsData);

    return Math.min(1, usernameConsistency + crossPromotion + timingCorrelation);
  }

  private calculatePostingTimeCorrelation(platformsData: PlatformData[]): number {
    if (platformsData.length < 2) return 0;

    // Group posts by day across platforms
    const postsByDay = new Map<string, number>();

    for (const data of platformsData) {
      for (const post of data.posts) {
        const day = post.createdAt.toISOString().split('T')[0];
        postsByDay.set(day, (postsByDay.get(day) || 0) + 1);
      }
    }

    // Calculate correlation score based on same-day posting
    const daysWithMultiplePosts = Array.from(postsByDay.values()).filter(count => count > 1).length;
    const totalDays = postsByDay.size;

    return totalDays > 0 ? (daysWithMultiplePosts / totalDays) * 0.4 : 0;
  }
}