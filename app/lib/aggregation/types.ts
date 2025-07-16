import { Platform, CreatorProfile, EngagementMetrics, Post } from '../platform-api/types';

export interface PlatformData {
  platform: Platform;
  profile: CreatorProfile;
  posts: Post[];
  metrics: EngagementMetrics;
  lastUpdated: Date;
}

export interface NormalizedMetrics {
  totalReach: number;
  averageEngagementRate: number;
  contentFrequency: ContentFrequency;
  audienceQuality: AudienceQualityScore;
  growthRate: number;
  contentConsistency: number;
  platformDistribution: PlatformDistribution;
}

export interface ContentFrequency {
  postsPerDay: number;
  postsPerWeek: number;
  postsPerMonth: number;
  consistency: number; // 0-1 score for posting consistency
  lastPostDate: Date;
  averageTimeBetweenPosts: number; // in hours
}

export interface AudienceQualityScore {
  engagementToFollowerRatio: number;
  activeEngagersPercent: number;
  authenticity: number; // 0-1 score
  relevance: number; // 0-1 score
  overallScore: number; // 0-100
}

export interface PlatformDistribution {
  primaryPlatform: Platform;
  platformWeights: Record<Platform, number>;
  crossPlatformSynergy: number; // 0-1 score
}

export interface CompositeScore {
  overallScore: number; // 0-100
  breakdown: ScoreBreakdown;
  tier: CreatorTier;
  confidence: number; // 0-1
}

export interface ScoreBreakdown {
  reach: number; // 0-25
  engagement: number; // 0-25
  consistency: number; // 0-20
  audienceQuality: number; // 0-20
  growth: number; // 0-10
}

export enum CreatorTier {
  PLATINUM = 'platinum',
  GOLD = 'gold',
  SILVER = 'silver',
  BRONZE = 'bronze',
  EMERGING = 'emerging'
}

export interface AggregatedCreatorData {
  creatorId: string;
  platforms: PlatformData[];
  normalizedMetrics: NormalizedMetrics;
  compositeScore: CompositeScore;
  insights: CreatorInsights;
  lastAggregated: Date;
}

export interface CreatorInsights {
  strongestPlatform: Platform;
  contentThemes: string[];
  audienceOverlap: number; // Percentage of audience overlap across platforms
  recommendedActions: string[];
  potentialReach: number;
  estimatedValue: MonetaryValue;
}

export interface MonetaryValue {
  sponsorshipRange: {
    min: number;
    max: number;
  };
  currency: string;
  confidence: number; // 0-1
}

export interface AggregationOptions {
  includeHistoricalData?: boolean;
  analyzeContentThemes?: boolean;
  calculateMonetaryValue?: boolean;
  platforms?: Platform[];
}

export interface ContentTheme {
  theme: string;
  frequency: number;
  engagement: number;
  platforms: Platform[];
}

export interface HistoricalDataPoint {
  date: Date;
  followers: number;
  engagementRate: number;
  postsCount: number;
}

export interface GrowthMetrics {
  dailyGrowthRate: number;
  weeklyGrowthRate: number;
  monthlyGrowthRate: number;
  projectedFollowers30Days: number;
  growthAcceleration: number; // Rate of change in growth
}