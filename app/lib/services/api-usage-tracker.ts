import { PrismaClient, ApiUsage, ApiLimit, ApiPricing, ApiAlert, ApiAlertType } from '@prisma/client';
import { logger } from '../logger';

export interface APIUsageRequest {
  platform: string;
  model?: string;
  endpoint: string;
  tokensUsed?: number;
  cost?: number;
  userId?: string;
  requestId?: string;
  responseTime?: number;
  statusCode?: number;
  error?: string;
  metadata?: Record<string, any>;
}

export interface UsageStats {
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  averageResponseTime: number;
  errorRate: number;
}

export interface RateLimitStatus {
  platform: string;
  model?: string;
  hourlyUsage: number;
  hourlyLimit: number | null;
  dailyUsage: number;
  dailyLimit: number | null;
  hourlyTokenUsage: number;
  hourlyTokenLimit: number | null;
  dailyTokenUsage: number;
  dailyTokenLimit: number | null;
  isApproachingLimit: boolean;
  percentageUsed: number;
}

export class APIUsageTracker {
  private prisma: PrismaClient;
  private alertThresholds = {
    warning: 0.8, // 80%
    critical: 0.95 // 95%
  };

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || new PrismaClient();
  }

  async trackRequest(request: APIUsageRequest): Promise<ApiUsage> {
    try {
      const usage = await this.prisma.apiUsage.create({
        data: {
          platform: request.platform,
          model: request.model,
          endpoint: request.endpoint,
          tokensUsed: request.tokensUsed,
          cost: request.cost || 0,
          userId: request.userId,
          requestId: request.requestId,
          responseTime: request.responseTime,
          statusCode: request.statusCode,
          error: request.error,
          metadata: request.metadata
        }
      });

      // Check rate limits after tracking
      await this.checkRateLimits(request.platform, request.model);

      return usage;
    } catch (error) {
      logger.error('Failed to track API usage:', error);
      throw error;
    }
  }

  async getUsageInWindow(
    platform: string,
    window: '1h' | '24h',
    model?: string
  ): Promise<{ requests: number; tokens: number; cost: number }> {
    const now = new Date();
    const windowStart = new Date(
      window === '1h'
        ? now.getTime() - 60 * 60 * 1000
        : now.getTime() - 24 * 60 * 60 * 1000
    );

    const where = {
      platform,
      ...(model && { model }),
      timestamp: {
        gte: windowStart
      }
    };

    const [requestCount, aggregates] = await Promise.all([
      this.prisma.apiUsage.count({ where }),
      this.prisma.apiUsage.aggregate({
        where,
        _sum: {
          tokensUsed: true,
          cost: true
        }
      })
    ]);

    return {
      requests: requestCount,
      tokens: aggregates._sum.tokensUsed || 0,
      cost: aggregates._sum.cost || 0
    };
  }

  async getRateLimitStatus(platform: string, model?: string): Promise<RateLimitStatus> {
    const [hourlyUsage, dailyUsage, limits] = await Promise.all([
      this.getUsageInWindow(platform, '1h', model),
      this.getUsageInWindow(platform, '24h', model),
      this.getRateLimits(platform, model)
    ]);

    const hourlyPercentage = limits?.rateLimitHourly
      ? (hourlyUsage.requests / limits.rateLimitHourly) * 100
      : 0;
    const dailyPercentage = limits?.rateLimitDaily
      ? (dailyUsage.requests / limits.rateLimitDaily) * 100
      : 0;
    const maxPercentage = Math.max(hourlyPercentage, dailyPercentage);

    return {
      platform,
      model,
      hourlyUsage: hourlyUsage.requests,
      hourlyLimit: limits?.rateLimitHourly || null,
      dailyUsage: dailyUsage.requests,
      dailyLimit: limits?.rateLimitDaily || null,
      hourlyTokenUsage: hourlyUsage.tokens,
      hourlyTokenLimit: limits?.tokenLimitHourly || null,
      dailyTokenUsage: dailyUsage.tokens,
      dailyTokenLimit: limits?.tokenLimitDaily || null,
      isApproachingLimit: maxPercentage >= this.alertThresholds.warning * 100,
      percentageUsed: maxPercentage
    };
  }

  async checkRateLimits(platform: string, model?: string): Promise<void> {
    const status = await this.getRateLimitStatus(platform, model);

    if (status.percentageUsed >= this.alertThresholds.critical * 100) {
      await this.createAlert(
        platform,
        ApiAlertType.RATE_LIMIT_CRITICAL,
        `Critical: ${platform} API usage at ${status.percentageUsed.toFixed(1)}% of rate limit`
      );
    } else if (status.percentageUsed >= this.alertThresholds.warning * 100) {
      await this.createAlert(
        platform,
        ApiAlertType.RATE_LIMIT_WARNING,
        `Warning: ${platform} API usage at ${status.percentageUsed.toFixed(1)}% of rate limit`
      );
    }
  }

  async getUsageStats(
    platform: string,
    startDate: Date,
    endDate: Date,
    model?: string
  ): Promise<UsageStats> {
    const where = {
      platform,
      ...(model && { model }),
      timestamp: {
        gte: startDate,
        lte: endDate
      }
    };

    const [totalRequests, aggregates, errorCount] = await Promise.all([
      this.prisma.apiUsage.count({ where }),
      this.prisma.apiUsage.aggregate({
        where,
        _sum: {
          tokensUsed: true,
          cost: true
        },
        _avg: {
          responseTime: true
        }
      }),
      this.prisma.apiUsage.count({
        where: {
          ...where,
          OR: [
            { statusCode: { gte: 400 } },
            { error: { not: null } }
          ]
        }
      })
    ]);

    return {
      totalRequests,
      totalTokens: aggregates._sum.tokensUsed || 0,
      totalCost: aggregates._sum.cost || 0,
      averageResponseTime: aggregates._avg.responseTime || 0,
      errorRate: totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0
    };
  }

  async calculateCost(
    platform: string,
    model: string,
    tokensUsed: number
  ): Promise<number> {
    const pricing = await this.prisma.apiPricing.findFirst({
      where: {
        platform,
        model,
        isActive: true,
        effectiveFrom: { lte: new Date() },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: new Date() } }
        ]
      }
    });

    if (!pricing) {
      logger.warn(`No pricing found for ${platform}/${model}`);
      return 0;
    }

    return tokensUsed * pricing.pricePerToken;
  }

  private async getRateLimits(platform: string, model?: string): Promise<ApiLimit | null> {
    return this.prisma.apiLimit.findFirst({
      where: {
        platform,
        ...(model ? { model } : { model: null }),
        isActive: true
      }
    });
  }

  private async createAlert(
    platform: string,
    alertType: ApiAlertType,
    message: string
  ): Promise<void> {
    try {
      // Check if similar unresolved alert exists
      const existingAlert = await this.prisma.apiAlert.findFirst({
        where: {
          platform,
          alertType,
          isResolved: false,
          createdAt: {
            gte: new Date(Date.now() - 60 * 60 * 1000) // Within last hour
          }
        }
      });

      if (!existingAlert) {
        await this.prisma.apiAlert.create({
          data: {
            platform,
            alertType,
            threshold: alertType.includes('WARNING')
              ? this.alertThresholds.warning
              : this.alertThresholds.critical,
            message
          }
        });

        logger.warn(`API Alert: ${message}`);
      }
    } catch (error) {
      logger.error('Failed to create alert:', error);
    }
  }

  async resolveAlerts(platform: string, alertType?: ApiAlertType): Promise<void> {
    await this.prisma.apiAlert.updateMany({
      where: {
        platform,
        ...(alertType && { alertType }),
        isResolved: false
      },
      data: {
        isResolved: true,
        resolvedAt: new Date()
      }
    });
  }

  async getCostReport(
    startDate: Date,
    endDate: Date,
    groupBy: 'platform' | 'model' | 'day'
  ): Promise<any[]> {
    const usage = await this.prisma.apiUsage.findMany({
      where: {
        timestamp: {
          gte: startDate,
          lte: endDate
        }
      },
      select: {
        platform: true,
        model: true,
        cost: true,
        timestamp: true,
        tokensUsed: true
      }
    });

    // Group and aggregate based on groupBy parameter
    const grouped = new Map<string, { cost: number; tokens: number; requests: number }>();

    usage.forEach(record => {
      let key: string;
      if (groupBy === 'platform') {
        key = record.platform;
      } else if (groupBy === 'model') {
        key = `${record.platform}/${record.model || 'default'}`;
      } else {
        key = record.timestamp.toISOString().split('T')[0];
      }

      const existing = grouped.get(key) || { cost: 0, tokens: 0, requests: 0 };
      grouped.set(key, {
        cost: existing.cost + record.cost,
        tokens: existing.tokens + (record.tokensUsed || 0),
        requests: existing.requests + 1
      });
    });

    return Array.from(grouped.entries())
      .map(([key, value]) => ({ key, ...value }))
      .sort((a, b) => b.cost - a.cost);
  }

  async getActiveAlerts(): Promise<ApiAlert[]> {
    return this.prisma.apiAlert.findMany({
      where: { isResolved: false },
      orderBy: { createdAt: 'desc' }
    });
  }

  async close(): Promise<void> {
    await this.prisma.$disconnect();
  }
}