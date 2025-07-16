import { PrismaClient } from '@prisma/client';
import { APIUsageTracker } from './api-usage-tracker';
import { APIPricingManager } from './api-pricing-manager';
import { logger } from '../logger';

export interface ReportOptions {
  startDate: Date;
  endDate: Date;
  platforms?: string[];
  groupBy?: 'day' | 'week' | 'month' | 'platform' | 'model';
  includeProjections?: boolean;
  includRecommendations?: boolean;
  format?: 'json' | 'csv' | 'pdf';
}

export interface UsageReport {
  metadata: {
    generatedAt: Date;
    period: { start: Date; end: Date };
    platforms: string[];
  };
  summary: {
    totalRequests: number;
    totalTokens: number;
    totalCost: number;
    avgResponseTime: number;
    errorRate: number;
    topPlatforms: Array<{ platform: string; requests: number; cost: number }>;
    topModels: Array<{ model: string; requests: number; cost: number }>;
  };
  trends: {
    costTrend: Array<{ date: string; cost: number }>;
    requestTrend: Array<{ date: string; requests: number }>;
    tokenTrend: Array<{ date: string; tokens: number }>;
  };
  breakdowns: {
    byPlatform: Record<string, any>;
    byModel: Record<string, any>;
    byEndpoint: Array<{ endpoint: string; count: number; avgTime: number }>;
  };
  projections?: {
    nextMonthCost: number;
    growthRate: number;
    budgetRunway: number;
  };
  recommendations?: string[];
  alerts: {
    costOverruns: string[];
    performanceIssues: string[];
    errorPatterns: string[];
  };
}

export class APIReportGenerator {
  private prisma: PrismaClient;
  private usageTracker: APIUsageTracker;
  private pricingManager: APIPricingManager;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || new PrismaClient();
    this.usageTracker = new APIUsageTracker(this.prisma);
    this.pricingManager = new APIPricingManager(this.prisma);
  }

  async generateReport(options: ReportOptions): Promise<UsageReport> {
    const { startDate, endDate, platforms, includeProjections = true, includRecommendations = true } = options;

    try {
      const [summary, trends, breakdowns, alerts] = await Promise.all([
        this.generateSummary(startDate, endDate, platforms),
        this.generateTrends(startDate, endDate, platforms),
        this.generateBreakdowns(startDate, endDate, platforms),
        this.generateAlerts(startDate, endDate, platforms)
      ]);

      const report: UsageReport = {
        metadata: {
          generatedAt: new Date(),
          period: { start: startDate, end: endDate },
          platforms: platforms || ['all']
        },
        summary,
        trends,
        breakdowns,
        alerts
      };

      if (includeProjections) {
        report.projections = await this.generateProjections(summary, trends);
      }

      if (includRecommendations) {
        report.recommendations = await this.generateRecommendations(report);
      }

      return report;
    } catch (error) {
      logger.error('Failed to generate report:', error);
      throw error;
    }
  }

  private async generateSummary(startDate: Date, endDate: Date, platforms?: string[]): Promise<UsageReport['summary']> {
    const where = {
      timestamp: { gte: startDate, lte: endDate },
      ...(platforms && platforms.length > 0 && { platform: { in: platforms } })
    };

    const [totals, errors, platformStats, modelStats] = await Promise.all([
      this.prisma.apiUsage.aggregate({
        where,
        _count: { id: true },
        _sum: { tokensUsed: true, cost: true },
        _avg: { responseTime: true }
      }),
      this.prisma.apiUsage.count({
        where: {
          ...where,
          OR: [
            { statusCode: { gte: 400 } },
            { error: { not: null } }
          ]
        }
      }),
      this.prisma.apiUsage.groupBy({
        by: ['platform'],
        where,
        _count: { id: true },
        _sum: { cost: true },
        orderBy: { _sum: { cost: 'desc' } },
        take: 5
      }),
      this.prisma.apiUsage.groupBy({
        by: ['model'],
        where: { ...where, model: { not: null } },
        _count: { id: true },
        _sum: { cost: true },
        orderBy: { _sum: { cost: 'desc' } },
        take: 5
      })
    ]);

    return {
      totalRequests: totals._count.id,
      totalTokens: totals._sum.tokensUsed || 0,
      totalCost: totals._sum.cost || 0,
      avgResponseTime: totals._avg.responseTime || 0,
      errorRate: totals._count.id > 0 ? (errors / totals._count.id) * 100 : 0,
      topPlatforms: platformStats.map(p => ({
        platform: p.platform,
        requests: p._count.id,
        cost: p._sum.cost || 0
      })),
      topModels: modelStats.map(m => ({
        model: m.model || 'unknown',
        requests: m._count.id,
        cost: m._sum.cost || 0
      }))
    };
  }

  private async generateTrends(startDate: Date, endDate: Date, platforms?: string[]): Promise<UsageReport['trends']> {
    const where = {
      timestamp: { gte: startDate, lte: endDate },
      ...(platforms && platforms.length > 0 && { platform: { in: platforms } })
    };

    const usage = await this.prisma.apiUsage.findMany({
      where,
      select: {
        timestamp: true,
        cost: true,
        tokensUsed: true
      },
      orderBy: { timestamp: 'asc' }
    });

    // Group by day
    const dailyData = new Map<string, { cost: number; requests: number; tokens: number }>();
    
    usage.forEach(record => {
      const date = record.timestamp.toISOString().split('T')[0];
      const existing = dailyData.get(date) || { cost: 0, requests: 0, tokens: 0 };
      dailyData.set(date, {
        cost: existing.cost + (record.cost || 0),
        requests: existing.requests + 1,
        tokens: existing.tokens + (record.tokensUsed || 0)
      });
    });

    const dates = Array.from(dailyData.keys()).sort();
    
    return {
      costTrend: dates.map(date => ({
        date,
        cost: dailyData.get(date)!.cost
      })),
      requestTrend: dates.map(date => ({
        date,
        requests: dailyData.get(date)!.requests
      })),
      tokenTrend: dates.map(date => ({
        date,
        tokens: dailyData.get(date)!.tokens
      }))
    };
  }

  private async generateBreakdowns(startDate: Date, endDate: Date, platforms?: string[]): Promise<UsageReport['breakdowns']> {
    const where = {
      timestamp: { gte: startDate, lte: endDate },
      ...(platforms && platforms.length > 0 && { platform: { in: platforms } })
    };

    const [byPlatform, byModel, byEndpoint] = await Promise.all([
      this.generatePlatformBreakdown(where),
      this.generateModelBreakdown(where),
      this.generateEndpointBreakdown(where)
    ]);

    return { byPlatform, byModel, byEndpoint };
  }

  private async generatePlatformBreakdown(where: any): Promise<Record<string, any>> {
    const platforms = await this.prisma.apiUsage.groupBy({
      by: ['platform'],
      where,
      _count: { id: true },
      _sum: { cost: true, tokensUsed: true },
      _avg: { responseTime: true }
    });

    return platforms.reduce((acc, p) => {
      acc[p.platform] = {
        requests: p._count.id,
        cost: p._sum.cost || 0,
        tokens: p._sum.tokensUsed || 0,
        avgResponseTime: p._avg.responseTime || 0,
        costPerRequest: p._count.id > 0 ? (p._sum.cost || 0) / p._count.id : 0
      };
      return acc;
    }, {} as Record<string, any>);
  }

  private async generateModelBreakdown(where: any): Promise<Record<string, any>> {
    const models = await this.prisma.apiUsage.groupBy({
      by: ['platform', 'model'],
      where: { ...where, model: { not: null } },
      _count: { id: true },
      _sum: { cost: true, tokensUsed: true }
    });

    return models.reduce((acc, m) => {
      const key = `${m.platform}/${m.model}`;
      acc[key] = {
        requests: m._count.id,
        cost: m._sum.cost || 0,
        tokens: m._sum.tokensUsed || 0,
        avgTokensPerRequest: m._count.id > 0 ? (m._sum.tokensUsed || 0) / m._count.id : 0
      };
      return acc;
    }, {} as Record<string, any>);
  }

  private async generateEndpointBreakdown(where: any): Promise<Array<{ endpoint: string; count: number; avgTime: number }>> {
    const endpoints = await this.prisma.apiUsage.groupBy({
      by: ['endpoint'],
      where,
      _count: { id: true },
      _avg: { responseTime: true },
      orderBy: { _count: { id: 'desc' } },
      take: 20
    });

    return endpoints.map(e => ({
      endpoint: e.endpoint,
      count: e._count.id,
      avgTime: e._avg.responseTime || 0
    }));
  }

  private async generateAlerts(startDate: Date, endDate: Date, platforms?: string[]): Promise<UsageReport['alerts']> {
    const alerts = {
      costOverruns: [] as string[],
      performanceIssues: [] as string[],
      errorPatterns: [] as string[]
    };

    // Check for cost anomalies
    const costByDay = await this.prisma.apiUsage.groupBy({
      by: ['platform'],
      where: {
        timestamp: { gte: startDate, lte: endDate },
        ...(platforms && { platform: { in: platforms } })
      },
      _sum: { cost: true },
      having: {
        cost: { _sum: { gt: 50 } } // Daily cost over $50
      }
    });

    costByDay.forEach(day => {
      if ((day._sum.cost || 0) > 50) {
        alerts.costOverruns.push(
          `${day.platform}: Daily cost exceeded $50 (actual: $${(day._sum.cost || 0).toFixed(2)})`
        );
      }
    });

    // Check for performance issues
    const slowEndpoints = await this.prisma.apiUsage.groupBy({
      by: ['endpoint'],
      where: {
        timestamp: { gte: startDate, lte: endDate },
        responseTime: { gt: 5000 } // Over 5 seconds
      },
      _count: { id: true },
      _avg: { responseTime: true }
    });

    slowEndpoints.forEach(endpoint => {
      if (endpoint._count.id > 10) {
        alerts.performanceIssues.push(
          `${endpoint.endpoint}: ${endpoint._count.id} slow requests (avg: ${(endpoint._avg.responseTime || 0).toFixed(0)}ms)`
        );
      }
    });

    // Check for error patterns
    const errorsByPlatform = await this.prisma.apiUsage.groupBy({
      by: ['platform'],
      where: {
        timestamp: { gte: startDate, lte: endDate },
        OR: [
          { statusCode: { gte: 400 } },
          { error: { not: null } }
        ]
      },
      _count: { id: true }
    });

    errorsByPlatform.forEach(platform => {
      if (platform._count.id > 50) {
        alerts.errorPatterns.push(
          `${platform.platform}: High error count (${platform._count.id} errors)`
        );
      }
    });

    return alerts;
  }

  private async generateProjections(summary: UsageReport['summary'], trends: UsageReport['trends']): Promise<UsageReport['projections']> {
    // Calculate growth rate from trends
    const recentCosts = trends.costTrend.slice(-7).map(t => t.cost);
    const olderCosts = trends.costTrend.slice(-14, -7).map(t => t.cost);
    
    const recentAvg = recentCosts.reduce((a, b) => a + b, 0) / recentCosts.length;
    const olderAvg = olderCosts.length > 0 ? olderCosts.reduce((a, b) => a + b, 0) / olderCosts.length : recentAvg;
    
    const growthRate = olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : 0;
    
    // Project next month cost
    const dailyAvg = summary.totalCost / trends.costTrend.length;
    const projectedGrowth = 1 + (growthRate / 100);
    const nextMonthCost = dailyAvg * 30 * projectedGrowth;
    
    // Calculate budget runway (assuming $500/month budget)
    const monthlyBudget = 500;
    const currentMonthlyRate = dailyAvg * 30;
    const budgetRunway = currentMonthlyRate > 0 ? monthlyBudget / currentMonthlyRate : Infinity;

    return {
      nextMonthCost,
      growthRate,
      budgetRunway
    };
  }

  private async generateRecommendations(report: UsageReport): Promise<string[]> {
    const recommendations: string[] = [];
    const { summary, projections, breakdowns, alerts } = report;

    // Cost optimization recommendations
    if (summary.totalCost > 100) {
      const topPlatform = summary.topPlatforms[0];
      if (topPlatform && topPlatform.cost / summary.totalCost > 0.5) {
        recommendations.push(
          `${topPlatform.platform} accounts for ${((topPlatform.cost / summary.totalCost) * 100).toFixed(0)}% of costs. Consider optimizing usage or negotiating better rates.`
        );
      }
    }

    // Model optimization
    const expensiveModels = Object.entries(breakdowns.byModel)
      .filter(([_, data]: [string, any]) => data.cost > 50)
      .sort((a: any, b: any) => b[1].cost - a[1].cost);

    if (expensiveModels.length > 0) {
      const [model, data] = expensiveModels[0];
      const costPerRequest = data.cost / data.requests;
      if (costPerRequest > 0.1) {
        recommendations.push(
          `${model} has high cost per request ($${costPerRequest.toFixed(3)}). Consider using a more cost-effective model for non-critical tasks.`
        );
      }
    }

    // Performance recommendations
    if (summary.avgResponseTime > 2000) {
      recommendations.push(
        `Average response time is ${(summary.avgResponseTime / 1000).toFixed(1)}s. Consider implementing caching or request batching.`
      );
    }

    // Error rate recommendations
    if (summary.errorRate > 5) {
      recommendations.push(
        `Error rate is ${summary.errorRate.toFixed(1)}%. Investigate error patterns and implement retry logic with exponential backoff.`
      );
    }

    // Growth rate recommendations
    if (projections && projections.growthRate > 20) {
      recommendations.push(
        `API usage is growing at ${projections.growthRate.toFixed(0)}% week-over-week. Review scaling strategy and budget allocation.`
      );
    }

    // Budget recommendations
    if (projections && projections.budgetRunway < 2) {
      recommendations.push(
        `Current usage will exceed budget in ${projections.budgetRunway.toFixed(1)} months. Implement cost controls or increase budget.`
      );
    }

    // Token optimization
    const avgTokensPerRequest = summary.totalTokens / summary.totalRequests;
    if (avgTokensPerRequest > 1000) {
      recommendations.push(
        `Average ${avgTokensPerRequest.toFixed(0)} tokens per request. Optimize prompts and implement response streaming where possible.`
      );
    }

    // Platform-specific recommendations
    if (breakdowns.byPlatform['Instagram'] && breakdowns.byPlatform['Instagram'].requests > 10000) {
      recommendations.push(
        'High Instagram API usage detected. Consider implementing webhook subscriptions to reduce polling frequency.'
      );
    }

    // Alert-based recommendations
    if (alerts.costOverruns.length > 0) {
      recommendations.push(
        'Multiple cost overrun alerts detected. Set up daily cost limits and automated scaling controls.'
      );
    }

    return recommendations.slice(0, 10); // Limit to top 10 recommendations
  }

  async exportReport(report: UsageReport, format: 'json' | 'csv' | 'pdf' = 'json'): Promise<string | Buffer> {
    switch (format) {
      case 'json':
        return JSON.stringify(report, null, 2);
      
      case 'csv':
        return this.exportToCSV(report);
      
      case 'pdf':
        // PDF generation would require additional libraries
        throw new Error('PDF export not yet implemented');
      
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  private exportToCSV(report: UsageReport): string {
    const lines: string[] = [];
    
    // Summary section
    lines.push('Summary');
    lines.push('Metric,Value');
    lines.push(`Total Requests,${report.summary.totalRequests}`);
    lines.push(`Total Tokens,${report.summary.totalTokens}`);
    lines.push(`Total Cost,$${report.summary.totalCost.toFixed(2)}`);
    lines.push(`Average Response Time,${report.summary.avgResponseTime.toFixed(0)}ms`);
    lines.push(`Error Rate,${report.summary.errorRate.toFixed(2)}%`);
    lines.push('');

    // Cost trend
    lines.push('Daily Cost Trend');
    lines.push('Date,Cost');
    report.trends.costTrend.forEach(item => {
      lines.push(`${item.date},$${item.cost.toFixed(2)}`);
    });
    lines.push('');

    // Platform breakdown
    lines.push('Platform Breakdown');
    lines.push('Platform,Requests,Cost,Tokens,Avg Response Time');
    Object.entries(report.breakdowns.byPlatform).forEach(([platform, data]: [string, any]) => {
      lines.push(`${platform},${data.requests},$${data.cost.toFixed(2)},${data.tokens},${data.avgResponseTime.toFixed(0)}ms`);
    });
    lines.push('');

    // Recommendations
    if (report.recommendations) {
      lines.push('Recommendations');
      report.recommendations.forEach((rec, index) => {
        lines.push(`${index + 1},${rec}`);
      });
    }

    return lines.join('\n');
  }

  async scheduleReport(schedule: 'daily' | 'weekly' | 'monthly', recipients: string[]): Promise<void> {
    // This would integrate with a job scheduler like node-cron or bull
    logger.info(`Scheduling ${schedule} report for recipients: ${recipients.join(', ')}`);
    // Implementation would go here
  }

  async close(): Promise<void> {
    await this.prisma.$disconnect();
  }
}