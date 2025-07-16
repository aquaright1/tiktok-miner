import { Platform } from '../platform-api/types';

export interface DiscoveryJob {
  id: string;
  type: JobType;
  data: any;
  priority: JobPriority;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  processedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  error?: string;
  result?: any;
}

export enum JobType {
  DISCOVER_TRENDING = 'discover_trending',
  EXPLORE_CATEGORY = 'explore_category',
  EVALUATE_CREATOR = 'evaluate_creator',
  FETCH_CREATOR_METRICS = 'fetch_creator_metrics',
  QUALITY_SCORING = 'quality_scoring',
  AGGREGATE_DATA = 'aggregate_data',
  REFRESH_EXISTING = 'refresh_existing',
}

export enum JobPriority {
  HIGH = 1,
  NORMAL = 5,
  LOW = 10,
}

export interface DiscoverySource {
  type: 'trending' | 'category' | 'search' | 'recommendation' | 'refresh';
  topic?: string;
  category?: string;
  query?: string;
  relatedCreatorId?: string;
}

export interface CreatorDiscoveryData {
  platform: Platform;
  identifier: string; // username or channel ID
  discoverySource: DiscoverySource;
  metadata?: {
    followerCount?: number;
    engagementHint?: number;
    contentType?: string;
    lastActive?: Date;
  };
}

export interface CreatorEvaluationResult {
  qualityScore: number;
  metrics: {
    followerCount: number;
    engagementRate: number;
    contentFrequency: number;
    audienceQuality: number;
  };
  recommendation: 'add' | 'monitor' | 'reject';
  reasons: string[];
}

export interface TrendingTopic {
  topic: string;
  platform: Platform;
  volume: number;
  growth: number;
  relatedHashtags: string[];
  timestamp: Date;
}

export interface DiscoveryConfig {
  qualityThreshold: number;
  minFollowers: number;
  maxFollowers?: number;
  minEngagementRate: number;
  requiredPlatforms: Platform[];
  excludedCategories: string[];
  refreshIntervalHours: number;
}

export interface QueueMetrics {
  pending: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  lastProcessedAt?: Date;
  processingRate: number; // jobs per minute
  averageProcessingTime: number; // milliseconds
  errorRate: number; // percentage
}

export interface ScheduledJob {
  id: string;
  name: string;
  cronExpression: string;
  jobType: JobType;
  enabled: boolean;
  lastRun?: Date;
  nextRun: Date;
  config?: any;
}

export interface DiscoveryReport {
  period: {
    start: Date;
    end: Date;
  };
  stats: {
    creatorsDiscovered: number;
    creatorsAdded: number;
    creatorsRejected: number;
    platformBreakdown: Record<Platform, number>;
    topSources: Array<{
      source: string;
      count: number;
    }>;
    averageQualityScore: number;
  };
  trends: {
    discoveryRate: number; // per day
    acceptanceRate: number; // percentage
    growthRate: number; // week over week
  };
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingCreatorId?: string;
  matchType?: 'exact' | 'similar' | 'cross-platform';
  confidence: number;
}