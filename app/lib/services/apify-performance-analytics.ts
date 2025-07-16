/**
 * ApifyPerformanceAnalytics - Advanced performance analytics for Apify scraping operations
 * Provides detailed metrics, trends, and insights for optimization
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export interface PerformanceMetrics {
  platform: string;
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  avgDatasetSize: number;
  avgCostPerRun: number;
  throughputPerHour: number;
  errorRate: number;
  p95Duration: number;
  p99Duration: number;
  successRate: number;
  costEfficiency: number; // items per dollar
  timeEfficiency: number; // items per minute
}

export interface PerformanceTrend {
  date: string;
  platform: string;
  avgDuration: number;
  successRate: number;
  throughput: number;
  errorRate: number;
  costPerItem: number;
}

export interface PerformanceComparison {
  platform: string;
  currentPeriod: PerformanceMetrics;
  previousPeriod: PerformanceMetrics;
  changes: {
    durationChange: number;
    successRateChange: number;
    throughputChange: number;
    costEfficiencyChange: number;
  };
}

export interface PerformanceBottleneck {
  type: 'duration' | 'error_rate' | 'cost' | 'throughput';
  platform: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  impact: string;
  recommendation: string;
  affectedRuns: number;
  estimatedCostImpact: number;
}

export interface PerformanceOptimization {
  platform: string;
  optimizationType: 'speed' | 'cost' | 'reliability';
  currentValue: number;
  targetValue: number;
  potentialSavings: number;
  recommendation: string;
  priority: 'low' | 'medium' | 'high';
}

export interface PerformanceReport {
  timeRange: {
    from: Date;
    to: Date;
  };
  summary: {
    totalRuns: number;
    totalCost: number;
    avgSuccessRate: number;
    avgDuration: number;
    totalItemsProcessed: number;
  };
  platformMetrics: PerformanceMetrics[];
  trends: PerformanceTrend[];
  comparisons: PerformanceComparison[];
  bottlenecks: PerformanceBottleneck[];
  optimizations: PerformanceOptimization[];
  insights: string[];
}

export class ApifyPerformanceAnalytics {
  /**
   * Get comprehensive performance metrics for all platforms
   */
  async getPerformanceMetrics(timeRange: {
    from: Date;
    to: Date;
  }): Promise<PerformanceMetrics[]> {
    try {
      const runs = await prisma.apifyRunMetrics.findMany({
        where: {
          startedAt: {
            gte: timeRange.from,
            lte: timeRange.to,
          },
        },
        orderBy: { startedAt: 'desc' },
      });

      const platformGroups = this.groupRunsByPlatform(runs);
      const metrics: PerformanceMetrics[] = [];

      for (const [platform, platformRuns] of Object.entries(platformGroups)) {
        const successfulRuns = platformRuns.filter(run => run.status === 'SUCCEEDED');
        const failedRuns = platformRuns.filter(run => run.status === 'FAILED');
        
        const durations = successfulRuns
          .map(run => run.duration)
          .filter(d => d !== null) as number[];
        
        const datasetSizes = successfulRuns
          .map(run => run.datasetItemCount)
          .filter(s => s !== null) as number[];
        
        const costs = platformRuns
          .map(run => run.costUsd)
          .filter(c => c !== null) as number[];

        const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
        const avgDatasetSize = datasetSizes.length > 0 ? datasetSizes.reduce((a, b) => a + b, 0) / datasetSizes.length : 0;
        const avgCostPerRun = costs.length > 0 ? costs.reduce((a, b) => a + b, 0) / costs.length : 0;
        
        const totalItems = datasetSizes.reduce((a, b) => a + b, 0);
        const totalCost = costs.reduce((a, b) => a + b, 0);
        const totalDuration = durations.reduce((a, b) => a + b, 0);

        metrics.push({
          platform,
          totalRuns: platformRuns.length,
          successfulRuns: successfulRuns.length,
          failedRuns: failedRuns.length,
          avgDuration,
          minDuration: durations.length > 0 ? Math.min(...durations) : 0,
          maxDuration: durations.length > 0 ? Math.max(...durations) : 0,
          avgDatasetSize,
          avgCostPerRun,
          throughputPerHour: totalDuration > 0 ? (totalItems / (totalDuration / 1000 / 60 / 60)) : 0,
          errorRate: platformRuns.length > 0 ? (failedRuns.length / platformRuns.length) * 100 : 0,
          p95Duration: this.calculatePercentile(durations, 95),
          p99Duration: this.calculatePercentile(durations, 99),
          successRate: platformRuns.length > 0 ? (successfulRuns.length / platformRuns.length) * 100 : 0,
          costEfficiency: totalCost > 0 ? totalItems / totalCost : 0,
          timeEfficiency: totalDuration > 0 ? totalItems / (totalDuration / 1000 / 60) : 0,
        });
      }

      return metrics;
    } catch (error) {
      logger.error('Failed to get performance metrics:', error);
      throw error;
    }
  }

  /**
   * Get performance trends over time
   */
  async getPerformanceTrends(timeRange: {
    from: Date;
    to: Date;
  }, granularity: 'hour' | 'day' | 'week' = 'day'): Promise<PerformanceTrend[]> {
    try {
      const dateFormat = granularity === 'hour' ? 'YYYY-MM-DD HH24:00:00' : 
                        granularity === 'day' ? 'YYYY-MM-DD' : 
                        'YYYY-"W"WW';

      const trends = await prisma.$queryRaw`
        SELECT 
          platform,
          TO_CHAR(DATE_TRUNC(${granularity}, "startedAt"), ${dateFormat}) as date,
          AVG(duration) as avgDuration,
          COUNT(*) FILTER (WHERE status = 'SUCCEEDED') * 100.0 / COUNT(*) as successRate,
          COUNT(*) as totalRuns,
          COUNT(*) FILTER (WHERE status = 'FAILED') * 100.0 / COUNT(*) as errorRate,
          AVG(CASE WHEN "datasetItemCount" > 0 AND "costUsd" > 0 THEN "costUsd" / "datasetItemCount" END) as costPerItem
        FROM "ApifyRunMetrics"
        WHERE "startedAt" BETWEEN ${timeRange.from} AND ${timeRange.to}
        GROUP BY platform, DATE_TRUNC(${granularity}, "startedAt")
        ORDER BY date, platform
      ` as any[];

      return trends.map(trend => ({
        date: trend.date,
        platform: trend.platform,
        avgDuration: Number(trend.avgduration) || 0,
        successRate: Number(trend.successrate) || 0,
        throughput: Number(trend.totalruns) || 0,
        errorRate: Number(trend.errorrate) || 0,
        costPerItem: Number(trend.costperitem) || 0,
      }));
    } catch (error) {
      logger.error('Failed to get performance trends:', error);
      throw error;
    }
  }

  /**
   * Compare performance between two time periods
   */
  async comparePerformance(
    currentPeriod: { from: Date; to: Date },
    previousPeriod: { from: Date; to: Date }
  ): Promise<PerformanceComparison[]> {
    try {
      const [currentMetrics, previousMetrics] = await Promise.all([
        this.getPerformanceMetrics(currentPeriod),
        this.getPerformanceMetrics(previousPeriod),
      ]);

      const comparisons: PerformanceComparison[] = [];

      for (const current of currentMetrics) {
        const previous = previousMetrics.find(p => p.platform === current.platform);
        
        if (previous) {
          const durationChange = previous.avgDuration > 0 ? 
            ((current.avgDuration - previous.avgDuration) / previous.avgDuration) * 100 : 0;
          
          const successRateChange = current.successRate - previous.successRate;
          
          const throughputChange = previous.throughputPerHour > 0 ?
            ((current.throughputPerHour - previous.throughputPerHour) / previous.throughputPerHour) * 100 : 0;
          
          const costEfficiencyChange = previous.costEfficiency > 0 ?
            ((current.costEfficiency - previous.costEfficiency) / previous.costEfficiency) * 100 : 0;

          comparisons.push({
            platform: current.platform,
            currentPeriod: current,
            previousPeriod: previous,
            changes: {
              durationChange,
              successRateChange,
              throughputChange,
              costEfficiencyChange,
            },
          });
        }
      }

      return comparisons;
    } catch (error) {
      logger.error('Failed to compare performance:', error);
      throw error;
    }
  }

  /**
   * Identify performance bottlenecks
   */
  async identifyBottlenecks(timeRange: {
    from: Date;
    to: Date;
  }): Promise<PerformanceBottleneck[]> {
    try {
      const metrics = await this.getPerformanceMetrics(timeRange);
      const bottlenecks: PerformanceBottleneck[] = [];

      for (const metric of metrics) {
        // High duration bottleneck
        if (metric.avgDuration > 300000) { // 5 minutes
          bottlenecks.push({
            type: 'duration',
            platform: metric.platform,
            severity: metric.avgDuration > 600000 ? 'critical' : 'high',
            description: `Average run duration is ${Math.round(metric.avgDuration / 1000)}s`,
            impact: `Affecting ${metric.totalRuns} runs with potential delays`,
            recommendation: 'Optimize scraping parameters, reduce data extraction scope, or upgrade compute resources',
            affectedRuns: metric.totalRuns,
            estimatedCostImpact: metric.avgCostPerRun * metric.totalRuns * 0.3,
          });
        }

        // High error rate bottleneck
        if (metric.errorRate > 15) {
          bottlenecks.push({
            type: 'error_rate',
            platform: metric.platform,
            severity: metric.errorRate > 30 ? 'critical' : 'high',
            description: `Error rate is ${metric.errorRate.toFixed(1)}%`,
            impact: `${metric.failedRuns} failed runs out of ${metric.totalRuns}`,
            recommendation: 'Review error patterns, update selectors, implement better error handling',
            affectedRuns: metric.failedRuns,
            estimatedCostImpact: metric.avgCostPerRun * metric.failedRuns,
          });
        }

        // High cost bottleneck
        if (metric.avgCostPerRun > 0.1) {
          bottlenecks.push({
            type: 'cost',
            platform: metric.platform,
            severity: metric.avgCostPerRun > 0.2 ? 'critical' : 'medium',
            description: `Average cost per run is $${metric.avgCostPerRun.toFixed(4)}`,
            impact: `High operational costs affecting budget`,
            recommendation: 'Optimize actor performance, reduce memory usage, or batch operations',
            affectedRuns: metric.totalRuns,
            estimatedCostImpact: metric.avgCostPerRun * metric.totalRuns * 0.5,
          });
        }

        // Low throughput bottleneck
        if (metric.throughputPerHour < 100) {
          bottlenecks.push({
            type: 'throughput',
            platform: metric.platform,
            severity: metric.throughputPerHour < 50 ? 'high' : 'medium',
            description: `Throughput is ${Math.round(metric.throughputPerHour)} items/hour`,
            impact: `Low data processing efficiency`,
            recommendation: 'Increase concurrency, optimize data extraction, or upgrade actor resources',
            affectedRuns: metric.totalRuns,
            estimatedCostImpact: metric.avgCostPerRun * metric.totalRuns * 0.2,
          });
        }
      }

      return bottlenecks.sort((a, b) => {
        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        return severityOrder[b.severity] - severityOrder[a.severity];
      });
    } catch (error) {
      logger.error('Failed to identify bottlenecks:', error);
      throw error;
    }
  }

  /**
   * Generate optimization recommendations
   */
  async generateOptimizations(timeRange: {
    from: Date;
    to: Date;
  }): Promise<PerformanceOptimization[]> {
    try {
      const metrics = await this.getPerformanceMetrics(timeRange);
      const optimizations: PerformanceOptimization[] = [];

      for (const metric of metrics) {
        // Speed optimization
        if (metric.avgDuration > 120000) { // 2 minutes
          optimizations.push({
            platform: metric.platform,
            optimizationType: 'speed',
            currentValue: metric.avgDuration,
            targetValue: metric.avgDuration * 0.7,
            potentialSavings: metric.avgCostPerRun * metric.totalRuns * 0.3,
            recommendation: 'Reduce scraping scope, optimize selectors, increase concurrency',
            priority: metric.avgDuration > 300000 ? 'high' : 'medium',
          });
        }

        // Cost optimization
        if (metric.costEfficiency < 1000) { // items per dollar
          optimizations.push({
            platform: metric.platform,
            optimizationType: 'cost',
            currentValue: metric.costEfficiency,
            targetValue: metric.costEfficiency * 1.5,
            potentialSavings: metric.avgCostPerRun * metric.totalRuns * 0.4,
            recommendation: 'Batch operations, optimize memory usage, reduce actor size',
            priority: metric.avgCostPerRun > 0.1 ? 'high' : 'medium',
          });
        }

        // Reliability optimization
        if (metric.errorRate > 10) {
          optimizations.push({
            platform: metric.platform,
            optimizationType: 'reliability',
            currentValue: metric.errorRate,
            targetValue: Math.max(metric.errorRate * 0.5, 5),
            potentialSavings: metric.avgCostPerRun * metric.failedRuns,
            recommendation: 'Implement retry logic, update selectors, add error handling',
            priority: metric.errorRate > 20 ? 'high' : 'medium',
          });
        }
      }

      return optimizations.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });
    } catch (error) {
      logger.error('Failed to generate optimizations:', error);
      throw error;
    }
  }

  /**
   * Generate comprehensive performance report
   */
  async generatePerformanceReport(timeRange: {
    from: Date;
    to: Date;
  }): Promise<PerformanceReport> {
    try {
      const [metrics, trends, bottlenecks, optimizations] = await Promise.all([
        this.getPerformanceMetrics(timeRange),
        this.getPerformanceTrends(timeRange),
        this.identifyBottlenecks(timeRange),
        this.generateOptimizations(timeRange),
      ]);

      // Calculate previous period for comparison
      const periodLength = timeRange.to.getTime() - timeRange.from.getTime();
      const previousPeriod = {
        from: new Date(timeRange.from.getTime() - periodLength),
        to: timeRange.from,
      };
      
      const comparisons = await this.comparePerformance(timeRange, previousPeriod);

      // Generate insights
      const insights: string[] = [];
      
      if (bottlenecks.length > 0) {
        insights.push(`Found ${bottlenecks.length} performance bottlenecks requiring attention.`);
      }
      
      if (optimizations.length > 0) {
        const totalSavings = optimizations.reduce((sum, opt) => sum + opt.potentialSavings, 0);
        insights.push(`Potential cost savings of $${totalSavings.toFixed(2)} with recommended optimizations.`);
      }
      
      const avgSuccessRate = metrics.reduce((sum, m) => sum + m.successRate, 0) / metrics.length;
      if (avgSuccessRate < 90) {
        insights.push(`Overall success rate of ${avgSuccessRate.toFixed(1)}% is below optimal threshold.`);
      }

      return {
        timeRange,
        summary: {
          totalRuns: metrics.reduce((sum, m) => sum + m.totalRuns, 0),
          totalCost: metrics.reduce((sum, m) => sum + m.avgCostPerRun * m.totalRuns, 0),
          avgSuccessRate,
          avgDuration: metrics.reduce((sum, m) => sum + m.avgDuration, 0) / metrics.length,
          totalItemsProcessed: metrics.reduce((sum, m) => sum + m.avgDatasetSize * m.totalRuns, 0),
        },
        platformMetrics: metrics,
        trends,
        comparisons,
        bottlenecks,
        optimizations,
        insights,
      };
    } catch (error) {
      logger.error('Failed to generate performance report:', error);
      throw error;
    }
  }

  /**
   * Helper method to group runs by platform
   */
  private groupRunsByPlatform(runs: any[]): Record<string, any[]> {
    return runs.reduce((groups, run) => {
      const platform = run.platform;
      if (!groups[platform]) {
        groups[platform] = [];
      }
      groups[platform].push(run);
      return groups;
    }, {});
  }

  /**
   * Helper method to calculate percentile
   */
  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    
    const sorted = values.slice().sort((a, b) => a - b);
    const index = (percentile / 100) * (sorted.length - 1);
    
    if (Math.floor(index) === index) {
      return sorted[index];
    } else {
      const lower = sorted[Math.floor(index)];
      const upper = sorted[Math.ceil(index)];
      return lower + (upper - lower) * (index - Math.floor(index));
    }
  }
}