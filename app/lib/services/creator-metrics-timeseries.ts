import { PrismaClient } from '@prisma/client';
import { CreatorProfile } from '@prisma/client';

export interface MetricsSnapshot {
  platform: string;
  followerCount: number;
  engagementRate: number;
  totalPosts: number;
  avgLikes: number;
  avgComments: number;
  avgShares: number;
  avgViews: number;
  platformMetrics?: Record<string, any>;
}

export interface EngagementData {
  hourlyLikes: number;
  hourlyComments: number;
  hourlyShares: number;
  hourlyViews: number;
  hourlyPosts: number;
  peakEngagementHour?: number;
  peakEngagementDay?: number;
  topPerformingContentIds?: string[];
  avgContentScore?: number;
  audienceActivityPattern?: Record<string, any>;
}

export interface GrowthMetrics {
  platform: string;
  period: string;
  followerGrowthRate: number;
  engagementGrowthRate: number;
  followerGrowthAbsolute: number;
  currentFollowers: number;
  currentEngagement: number;
}

export interface TrendingCreator {
  creatorId: string;
  platform: string;
  followerGrowthRate: number;
  engagementGrowthRate: number;
  currentFollowers: number;
  currentEngagementRate: number;
  profile?: CreatorProfile;
}

export class CreatorMetricsTimeSeriesService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Record a metrics snapshot for a creator
   */
  async recordMetricsSnapshot(
    creatorProfileId: string,
    metrics: MetricsSnapshot,
    previousMetrics?: MetricsSnapshot
  ) {
    const followerGrowth = previousMetrics 
      ? metrics.followerCount - previousMetrics.followerCount 
      : 0;
    
    const engagementGrowth = previousMetrics 
      ? metrics.engagementRate - previousMetrics.engagementRate 
      : 0;

    return await this.prisma.creatorMetricsHistory.create({
      data: {
        creatorProfileId,
        platform: metrics.platform,
        followerCount: metrics.followerCount,
        engagementRate: metrics.engagementRate,
        totalPosts: metrics.totalPosts,
        avgLikes: metrics.avgLikes,
        avgComments: metrics.avgComments,
        avgShares: metrics.avgShares,
        avgViews: metrics.avgViews,
        followerGrowth,
        engagementGrowth,
        platformMetrics: metrics.platformMetrics
      }
    });
  }

  /**
   * Record engagement analytics data
   */
  async recordEngagementAnalytics(
    creatorProfileId: string,
    engagementData: EngagementData
  ) {
    return await this.prisma.engagementAnalytics.create({
      data: {
        creatorProfileId,
        ...engagementData
      }
    });
  }

  /**
   * Get historical metrics for a creator
   */
  async getHistoricalMetrics(
    creatorProfileId: string,
    platform?: string,
    startDate?: Date,
    endDate?: Date,
    interval?: 'hour' | 'day' | 'week' | 'month'
  ) {
    const where: any = { creatorProfileId };
    if (platform) where.platform = platform;
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = startDate;
      if (endDate) where.timestamp.lte = endDate;
    }

    const metrics = await this.prisma.creatorMetricsHistory.findMany({
      where,
      orderBy: { timestamp: 'asc' }
    });

    // If interval is specified, aggregate the data
    if (interval && metrics.length > 0) {
      return this.aggregateMetricsByInterval(metrics, interval);
    }

    return metrics;
  }

  /**
   * Calculate growth metrics for a creator
   */
  async calculateGrowthMetrics(
    creatorProfileId: string,
    platform: string,
    periods: string[] = ['7d', '30d', '90d']
  ): Promise<GrowthMetrics[]> {
    const growthMetrics: GrowthMetrics[] = [];

    for (const period of periods) {
      const days = parseInt(period);
      const result = await this.prisma.$queryRaw<any[]>`
        SELECT * FROM calculate_growth_rate(
          ${creatorProfileId}::text,
          ${platform}::text,
          'followerCount'::text,
          INTERVAL '${days} days'
        ) as follower_growth,
        calculate_growth_rate(
          ${creatorProfileId}::text,
          ${platform}::text,
          'engagementRate'::text,
          INTERVAL '${days} days'
        ) as engagement_growth
      `;

      // Get current metrics
      const currentMetrics = await this.prisma.creatorMetricsHistory.findFirst({
        where: { creatorProfileId, platform },
        orderBy: { timestamp: 'desc' }
      });

      // Get metrics from the period start
      const periodStart = new Date();
      periodStart.setDate(periodStart.getDate() - days);
      
      const previousMetrics = await this.prisma.creatorMetricsHistory.findFirst({
        where: {
          creatorProfileId,
          platform,
          timestamp: { lte: periodStart }
        },
        orderBy: { timestamp: 'desc' }
      });

      if (currentMetrics && previousMetrics) {
        growthMetrics.push({
          platform,
          period,
          followerGrowthRate: parseFloat(result[0]?.follower_growth || '0'),
          engagementGrowthRate: parseFloat(result[0]?.engagement_growth || '0'),
          followerGrowthAbsolute: currentMetrics.followerCount - previousMetrics.followerCount,
          currentFollowers: currentMetrics.followerCount,
          currentEngagement: currentMetrics.engagementRate
        });
      }
    }

    return growthMetrics;
  }

  /**
   * Get trending creators based on growth metrics
   */
  async getTrendingCreators(
    platform?: string,
    days: number = 7,
    limit: number = 10
  ): Promise<TrendingCreator[]> {
    const results = await this.prisma.$queryRaw<any[]>`
      SELECT * FROM get_trending_creators(
        ${platform}::text,
        ${days}::integer,
        ${limit}::integer
      )
    `;

    // Enrich with creator profiles
    const trendingCreators: TrendingCreator[] = [];
    for (const result of results) {
      const profile = await this.prisma.creatorProfile.findUnique({
        where: { id: result.creator_id }
      });

      trendingCreators.push({
        creatorId: result.creator_id,
        platform: result.platform,
        followerGrowthRate: parseFloat(result.follower_growth_rate),
        engagementGrowthRate: parseFloat(result.engagement_growth_rate),
        currentFollowers: result.current_followers,
        currentEngagementRate: parseFloat(result.current_engagement_rate),
        profile: profile || undefined
      });
    }

    return trendingCreators;
  }

  /**
   * Get engagement patterns for a creator
   */
  async getEngagementPatterns(
    creatorProfileId: string,
    days: number = 30
  ) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const analytics = await this.prisma.engagementAnalytics.findMany({
      where: {
        creatorProfileId,
        timestamp: { gte: startDate }
      },
      orderBy: { timestamp: 'asc' }
    });

    // Analyze patterns
    const hourlyEngagement: Record<number, number> = {};
    const dailyEngagement: Record<number, number> = {};
    let totalEngagement = 0;

    for (const data of analytics) {
      const hour = data.timestamp.getUTCHours();
      const day = data.timestamp.getUTCDay();
      
      const engagement = data.hourlyLikes + data.hourlyComments + 
                        data.hourlyShares + data.hourlyViews;
      
      hourlyEngagement[hour] = (hourlyEngagement[hour] || 0) + engagement;
      dailyEngagement[day] = (dailyEngagement[day] || 0) + engagement;
      totalEngagement += engagement;
    }

    // Find peak times
    let peakHour = 0;
    let peakDay = 0;
    let maxHourlyEngagement = 0;
    let maxDailyEngagement = 0;

    for (const [hour, engagement] of Object.entries(hourlyEngagement)) {
      if (engagement > maxHourlyEngagement) {
        maxHourlyEngagement = engagement;
        peakHour = parseInt(hour);
      }
    }

    for (const [day, engagement] of Object.entries(dailyEngagement)) {
      if (engagement > maxDailyEngagement) {
        maxDailyEngagement = engagement;
        peakDay = parseInt(day);
      }
    }

    return {
      hourlyPattern: hourlyEngagement,
      dailyPattern: dailyEngagement,
      peakHour,
      peakDay,
      totalEngagement,
      avgEngagementPerHour: totalEngagement / (days * 24),
      topContent: analytics
        .flatMap(a => a.topPerformingContentIds)
        .filter(id => id)
        .slice(0, 10)
    };
  }

  /**
   * Clean up old data based on retention policies
   */
  async cleanupOldData() {
    // This is handled by TimescaleDB retention policies
    // But we can add custom cleanup logic here if needed
    
    // Example: Archive aggregated data before deletion
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    // You could archive to S3 or another storage here
    console.log('Data cleanup handled by TimescaleDB retention policies');
  }

  /**
   * Helper to aggregate metrics by interval
   */
  private aggregateMetricsByInterval(
    metrics: any[],
    interval: 'hour' | 'day' | 'week' | 'month'
  ) {
    const aggregated: Record<string, any> = {};

    for (const metric of metrics) {
      const key = this.getIntervalKey(metric.timestamp, interval);
      
      if (!aggregated[key]) {
        aggregated[key] = {
          timestamp: key,
          platform: metric.platform,
          avgFollowerCount: 0,
          avgEngagementRate: 0,
          maxFollowerCount: 0,
          minFollowerCount: Infinity,
          totalFollowerGrowth: 0,
          dataPoints: 0
        };
      }

      const agg = aggregated[key];
      agg.avgFollowerCount += metric.followerCount;
      agg.avgEngagementRate += metric.engagementRate;
      agg.maxFollowerCount = Math.max(agg.maxFollowerCount, metric.followerCount);
      agg.minFollowerCount = Math.min(agg.minFollowerCount, metric.followerCount);
      agg.totalFollowerGrowth += metric.followerGrowth;
      agg.dataPoints += 1;
    }

    // Calculate averages
    return Object.values(aggregated).map(agg => ({
      ...agg,
      avgFollowerCount: agg.avgFollowerCount / agg.dataPoints,
      avgEngagementRate: agg.avgEngagementRate / agg.dataPoints
    }));
  }

  private getIntervalKey(date: Date, interval: string): string {
    const d = new Date(date);
    switch (interval) {
      case 'hour':
        d.setMinutes(0, 0, 0);
        break;
      case 'day':
        d.setHours(0, 0, 0, 0);
        break;
      case 'week':
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - d.getDay());
        break;
      case 'month':
        d.setHours(0, 0, 0, 0);
        d.setDate(1);
        break;
    }
    return d.toISOString();
  }
}