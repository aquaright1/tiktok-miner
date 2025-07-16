import { PrismaClient } from '@prisma/client';
import { 
  CostOptimization, 
  CostForecast,
  ServiceType,
  OptimizationType,
  OptimizationImpact,
  OptimizationStatus,
  ForecastPeriod,
  TrendDirection
} from '@prisma/client';
import { logger } from '../logger';

export interface OptimizationRecommendation {
  id: string;
  platform: string;
  serviceType: ServiceType;
  optimizationType: OptimizationType;
  currentCost: number;
  projectedCost: number;
  potentialSavings: number;
  savingsPercentage: number;
  recommendation: string;
  impact: OptimizationImpact;
  implementationEffort: 'LOW' | 'MEDIUM' | 'HIGH';
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  priority: number; // 1-10, higher = more important
  validUntil: Date;
  metadata?: any;
}

export interface CostForecastData {
  platform: string;
  serviceType: ServiceType;
  currentCost: number;
  weeklyForecast: number;
  monthlyForecast: number;
  quarterlyForecast: number;
  confidence: number;
  trendDirection: TrendDirection;
  seasonalPatterns?: any;
}

export interface OptimizationReport {
  totalPotentialSavings: number;
  totalCurrentCost: number;
  savingsPercentage: number;
  recommendations: OptimizationRecommendation[];
  priorityRecommendations: OptimizationRecommendation[];
  quickWins: OptimizationRecommendation[];
  platformBreakdown: {
    platform: string;
    currentCost: number;
    potentialSavings: number;
    recommendationCount: number;
  }[];
  forecastData: CostForecastData[];
}

export interface CostAnalysis {
  platform: string;
  serviceType: ServiceType;
  currentPeriodCost: number;
  previousPeriodCost: number;
  trendPercentage: number;
  usage: {
    requestCount: number;
    tokenUsage: number;
    averageRequestCost: number;
    peakUsageHours: number[];
  };
  efficiency: {
    costPerResult: number;
    successRate: number;
    errorRate: number;
    retryRate: number;
  };
  recommendations: string[];
}

export class CostOptimizer {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Generate comprehensive optimization recommendations
   */
  async generateOptimizationRecommendations(
    platforms?: string[],
    serviceTypes?: ServiceType[]
  ): Promise<OptimizationReport> {
    try {
      const analyses = await this.analyzeCostPatterns(platforms, serviceTypes);
      const recommendations: OptimizationRecommendation[] = [];

      // Generate recommendations for each platform/service combination
      for (const analysis of analyses) {
        const platformRecommendations = await this.generatePlatformRecommendations(analysis);
        recommendations.push(...platformRecommendations);
      }

      // Calculate forecasts
      const forecastData = await this.generateCostForecasts(platforms, serviceTypes);

      // Calculate totals
      const totalCurrentCost = analyses.reduce((sum, a) => sum + a.currentPeriodCost, 0);
      const totalPotentialSavings = recommendations.reduce((sum, r) => sum + r.potentialSavings, 0);
      const savingsPercentage = totalCurrentCost > 0 ? (totalPotentialSavings / totalCurrentCost) * 100 : 0;

      // Priority recommendations (priority >= 7)
      const priorityRecommendations = recommendations
        .filter(r => r.priority >= 7)
        .sort((a, b) => b.priority - a.priority);

      // Quick wins (high savings, low effort/risk)
      const quickWins = recommendations
        .filter(r => 
          r.potentialSavings > 50 && 
          r.implementationEffort === 'LOW' && 
          r.riskLevel === 'LOW'
        )
        .sort((a, b) => b.potentialSavings - a.potentialSavings);

      // Platform breakdown
      const platformBreakdown = this.calculatePlatformBreakdown(recommendations, analyses);

      // Store recommendations in database
      await this.storeRecommendations(recommendations);

      return {
        totalPotentialSavings,
        totalCurrentCost,
        savingsPercentage,
        recommendations: recommendations.sort((a, b) => b.priority - a.priority),
        priorityRecommendations,
        quickWins,
        platformBreakdown,
        forecastData
      };
    } catch (error) {
      logger.error('Failed to generate optimization recommendations', { error });
      throw error;
    }
  }

  /**
   * Analyze cost patterns for optimization opportunities
   */
  private async analyzeCostPatterns(
    platforms?: string[],
    serviceTypes?: ServiceType[]
  ): Promise<CostAnalysis[]> {
    const analyses: CostAnalysis[] = [];
    
    // Get cost data from last 60 days
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 60);
    
    const midDate = new Date();
    midDate.setDate(midDate.getDate() - 30);

    // Analyze API usage
    const apiUsage = await this.prisma.apiUsage.findMany({
      where: {
        timestamp: { gte: startDate, lte: endDate },
        platform: platforms ? { in: platforms } : undefined
      },
      select: {
        platform: true,
        cost: true,
        tokensUsed: true,
        statusCode: true,
        timestamp: true,
        error: true
      }
    });

    // Analyze Apify usage
    const apifyUsage = await this.prisma.apifyRunMetrics.findMany({
      where: {
        startedAt: { gte: startDate, lte: endDate },
        platform: platforms ? { in: platforms } : undefined
      },
      select: {
        platform: true,
        costUsd: true,
        status: true,
        startedAt: true,
        duration: true,
        datasetItemCount: true
      }
    });

    // Group by platform and analyze
    const platformGroups = new Map<string, any>();

    // Process API usage
    apiUsage.forEach(usage => {
      const key = `${usage.platform}-API`;
      if (!platformGroups.has(key)) {
        platformGroups.set(key, {
          platform: usage.platform,
          serviceType: ServiceType.API,
          costs: [],
          requests: [],
          errors: []
        });
      }
      
      const group = platformGroups.get(key)!;
      group.costs.push({ cost: usage.cost, timestamp: usage.timestamp, tokens: usage.tokensUsed || 0 });
      group.requests.push({ timestamp: usage.timestamp, statusCode: usage.statusCode });
      if (usage.error) group.errors.push({ timestamp: usage.timestamp, error: usage.error });
    });

    // Process Apify usage
    apifyUsage.forEach(usage => {
      const key = `${usage.platform}-SCRAPING`;
      if (!platformGroups.has(key)) {
        platformGroups.set(key, {
          platform: usage.platform,
          serviceType: ServiceType.SCRAPING,
          costs: [],
          requests: [],
          errors: []
        });
      }
      
      const group = platformGroups.get(key)!;
      group.costs.push({ 
        cost: usage.costUsd || 0, 
        timestamp: usage.startedAt, 
        duration: usage.duration,
        itemCount: usage.datasetItemCount
      });
      group.requests.push({ timestamp: usage.startedAt, status: usage.status });
      if (usage.status === 'FAILED') group.errors.push({ timestamp: usage.startedAt, status: usage.status });
    });

    // Analyze each platform group
    for (const [key, group] of platformGroups.entries()) {
      const currentPeriodCosts = group.costs.filter((c: any) => c.timestamp >= midDate);
      const previousPeriodCosts = group.costs.filter((c: any) => c.timestamp < midDate);

      const currentPeriodCost = currentPeriodCosts.reduce((sum: number, c: any) => sum + c.cost, 0);
      const previousPeriodCost = previousPeriodCosts.reduce((sum: number, c: any) => sum + c.cost, 0);

      const trendPercentage = previousPeriodCost > 0 ? 
        ((currentPeriodCost - previousPeriodCost) / previousPeriodCost) * 100 : 0;

      // Calculate usage metrics
      const requestCount = group.requests.length;
      const tokenUsage = group.costs.reduce((sum: number, c: any) => sum + (c.tokens || 0), 0);
      const averageRequestCost = requestCount > 0 ? currentPeriodCost / requestCount : 0;

      // Peak usage hours
      const hourlyUsage = new Array(24).fill(0);
      group.requests.forEach((r: any) => {
        const hour = new Date(r.timestamp).getHours();
        hourlyUsage[hour]++;
      });
      const peakUsageHours = hourlyUsage
        .map((count, hour) => ({ hour, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3)
        .map(h => h.hour);

      // Efficiency metrics
      const successfulRequests = group.requests.filter((r: any) => 
        r.statusCode ? r.statusCode < 400 : r.status === 'SUCCEEDED'
      ).length;
      const successRate = requestCount > 0 ? (successfulRequests / requestCount) * 100 : 0;
      const errorRate = requestCount > 0 ? (group.errors.length / requestCount) * 100 : 0;

      // Calculate cost per result
      const totalResults = group.serviceType === ServiceType.API ? 
        tokenUsage : 
        group.costs.reduce((sum: number, c: any) => sum + (c.itemCount || 0), 0);
      const costPerResult = totalResults > 0 ? currentPeriodCost / totalResults : 0;

      analyses.push({
        platform: group.platform,
        serviceType: group.serviceType,
        currentPeriodCost,
        previousPeriodCost,
        trendPercentage,
        usage: {
          requestCount,
          tokenUsage,
          averageRequestCost,
          peakUsageHours
        },
        efficiency: {
          costPerResult,
          successRate,
          errorRate,
          retryRate: 0 // TODO: Calculate retry rate
        },
        recommendations: []
      });
    }

    return analyses;
  }

  /**
   * Generate platform-specific recommendations
   */
  private async generatePlatformRecommendations(analysis: CostAnalysis): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];
    const currentCost = analysis.currentPeriodCost;

    // High cost optimization
    if (currentCost > 1000) {
      recommendations.push({
        id: `high-cost-${analysis.platform}-${analysis.serviceType}`,
        platform: analysis.platform,
        serviceType: analysis.serviceType,
        optimizationType: OptimizationType.REDUCE_FREQUENCY,
        currentCost,
        projectedCost: currentCost * 0.8,
        potentialSavings: currentCost * 0.2,
        savingsPercentage: 20,
        recommendation: `High cost detected ($${currentCost.toFixed(2)}/month). Consider reducing request frequency or implementing more aggressive caching.`,
        impact: OptimizationImpact.LOW,
        implementationEffort: 'MEDIUM',
        riskLevel: 'LOW',
        priority: 8,
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });
    }

    // Low success rate optimization
    if (analysis.efficiency.successRate < 90) {
      const savingsFromFailures = currentCost * (analysis.efficiency.errorRate / 100);
      recommendations.push({
        id: `low-success-${analysis.platform}-${analysis.serviceType}`,
        platform: analysis.platform,
        serviceType: analysis.serviceType,
        optimizationType: OptimizationType.REDUCE_FREQUENCY,
        currentCost,
        projectedCost: currentCost - savingsFromFailures,
        potentialSavings: savingsFromFailures,
        savingsPercentage: (savingsFromFailures / currentCost) * 100,
        recommendation: `Low success rate (${analysis.efficiency.successRate.toFixed(1)}%). Improve error handling and retry logic to avoid wasted API calls.`,
        impact: OptimizationImpact.LOW,
        implementationEffort: 'MEDIUM',
        riskLevel: 'LOW',
        priority: 7,
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });
    }

    // High cost per result optimization
    if (analysis.efficiency.costPerResult > 0.1) {
      const projectedSavings = currentCost * 0.15;
      recommendations.push({
        id: `high-cost-per-result-${analysis.platform}-${analysis.serviceType}`,
        platform: analysis.platform,
        serviceType: analysis.serviceType,
        optimizationType: OptimizationType.CACHE_OPTIMIZATION,
        currentCost,
        projectedCost: currentCost - projectedSavings,
        potentialSavings: projectedSavings,
        savingsPercentage: 15,
        recommendation: `High cost per result ($${analysis.efficiency.costPerResult.toFixed(3)}). Implement better caching strategies to reduce redundant requests.`,
        impact: OptimizationImpact.LOW,
        implementationEffort: 'LOW',
        riskLevel: 'LOW',
        priority: 6,
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });
    }

    // Rising cost trend optimization
    if (analysis.trendPercentage > 20) {
      const trendSavings = currentCost * 0.1;
      recommendations.push({
        id: `rising-trend-${analysis.platform}-${analysis.serviceType}`,
        platform: analysis.platform,
        serviceType: analysis.serviceType,
        optimizationType: OptimizationType.OPTIMIZE_TIMING,
        currentCost,
        projectedCost: currentCost - trendSavings,
        potentialSavings: trendSavings,
        savingsPercentage: 10,
        recommendation: `Cost increasing by ${analysis.trendPercentage.toFixed(1)}%. Review usage patterns and implement cost controls.`,
        impact: OptimizationImpact.MEDIUM,
        implementationEffort: 'HIGH',
        riskLevel: 'MEDIUM',
        priority: 9,
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });
    }

    // Peak usage optimization
    if (analysis.usage.peakUsageHours.length > 0) {
      const peakSavings = currentCost * 0.05;
      recommendations.push({
        id: `peak-usage-${analysis.platform}-${analysis.serviceType}`,
        platform: analysis.platform,
        serviceType: analysis.serviceType,
        optimizationType: OptimizationType.OPTIMIZE_TIMING,
        currentCost,
        projectedCost: currentCost - peakSavings,
        potentialSavings: peakSavings,
        savingsPercentage: 5,
        recommendation: `Peak usage detected during hours: ${analysis.usage.peakUsageHours.join(', ')}. Consider load balancing or off-peak processing.`,
        impact: OptimizationImpact.LOW,
        implementationEffort: 'MEDIUM',
        riskLevel: 'LOW',
        priority: 4,
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });
    }

    return recommendations;
  }

  /**
   * Generate cost forecasts
   */
  private async generateCostForecasts(
    platforms?: string[],
    serviceTypes?: ServiceType[]
  ): Promise<CostForecastData[]> {
    const forecasts: CostForecastData[] = [];
    
    // Get historical data for forecasting
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90); // 90 days of history

    const analyses = await this.analyzeCostPatterns(platforms, serviceTypes);

    for (const analysis of analyses) {
      // Simple trend-based forecasting
      const currentCost = analysis.currentPeriodCost;
      const trendMultiplier = 1 + (analysis.trendPercentage / 100);
      
      // Apply trend with dampening factor
      const weeklyForecast = currentCost * 0.25 * Math.min(trendMultiplier, 1.5);
      const monthlyForecast = currentCost * Math.min(trendMultiplier, 2.0);
      const quarterlyForecast = currentCost * 3 * Math.min(trendMultiplier, 1.8);

      // Calculate confidence based on data quality
      const confidence = Math.min(90, Math.max(50, 
        90 - (Math.abs(analysis.trendPercentage) * 0.5) - (analysis.efficiency.errorRate * 0.3)
      ));

      // Determine trend direction
      let trendDirection: TrendDirection;
      if (analysis.trendPercentage > 10) trendDirection = TrendDirection.INCREASING;
      else if (analysis.trendPercentage < -10) trendDirection = TrendDirection.DECREASING;
      else if (Math.abs(analysis.trendPercentage) < 5) trendDirection = TrendDirection.STABLE;
      else trendDirection = TrendDirection.VOLATILE;

      forecasts.push({
        platform: analysis.platform,
        serviceType: analysis.serviceType,
        currentCost,
        weeklyForecast,
        monthlyForecast,
        quarterlyForecast,
        confidence,
        trendDirection
      });

      // Store forecast in database
      await this.prisma.costForecast.create({
        data: {
          platform: analysis.platform,
          serviceType: analysis.serviceType,
          forecastPeriod: ForecastPeriod.MONTHLY,
          currentCost,
          forecastedCost: monthlyForecast,
          confidence,
          basedOnDays: 30,
          trendDirection,
          forecastDate: new Date(),
          validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        }
      });
    }

    return forecasts;
  }

  /**
   * Store recommendations in database
   */
  private async storeRecommendations(recommendations: OptimizationRecommendation[]): Promise<void> {
    for (const rec of recommendations) {
      await this.prisma.costOptimization.upsert({
        where: { id: rec.id },
        update: {
          currentCost: rec.currentCost,
          projectedCost: rec.projectedCost,
          potentialSavings: rec.potentialSavings,
          recommendation: rec.recommendation,
          validUntil: rec.validUntil,
          metadata: {
            savingsPercentage: rec.savingsPercentage,
            implementationEffort: rec.implementationEffort,
            riskLevel: rec.riskLevel,
            priority: rec.priority
          }
        },
        create: {
          id: rec.id,
          platform: rec.platform,
          serviceType: rec.serviceType,
          optimizationType: rec.optimizationType,
          currentCost: rec.currentCost,
          projectedCost: rec.projectedCost,
          potentialSavings: rec.potentialSavings,
          recommendation: rec.recommendation,
          impact: rec.impact,
          validUntil: rec.validUntil,
          metadata: {
            savingsPercentage: rec.savingsPercentage,
            implementationEffort: rec.implementationEffort,
            riskLevel: rec.riskLevel,
            priority: rec.priority
          }
        }
      });
    }
  }

  /**
   * Calculate platform breakdown
   */
  private calculatePlatformBreakdown(
    recommendations: OptimizationRecommendation[], 
    analyses: CostAnalysis[]
  ): { platform: string; currentCost: number; potentialSavings: number; recommendationCount: number; }[] {
    const platformMap = new Map<string, { currentCost: number; potentialSavings: number; recommendationCount: number; }>();

    // Initialize with current costs
    analyses.forEach(analysis => {
      if (!platformMap.has(analysis.platform)) {
        platformMap.set(analysis.platform, {
          currentCost: 0,
          potentialSavings: 0,
          recommendationCount: 0
        });
      }
      const platform = platformMap.get(analysis.platform)!;
      platform.currentCost += analysis.currentPeriodCost;
    });

    // Add recommendations
    recommendations.forEach(rec => {
      if (!platformMap.has(rec.platform)) {
        platformMap.set(rec.platform, {
          currentCost: rec.currentCost,
          potentialSavings: 0,
          recommendationCount: 0
        });
      }
      const platform = platformMap.get(rec.platform)!;
      platform.potentialSavings += rec.potentialSavings;
      platform.recommendationCount += 1;
    });

    return Array.from(platformMap.entries())
      .map(([platform, data]) => ({ platform, ...data }))
      .sort((a, b) => b.potentialSavings - a.potentialSavings);
  }

  /**
   * Get optimization recommendations by status
   */
  async getRecommendations(
    status?: OptimizationStatus,
    platform?: string
  ): Promise<CostOptimization[]> {
    return await this.prisma.costOptimization.findMany({
      where: {
        status,
        platform,
        validUntil: { gte: new Date() }
      },
      orderBy: [
        { potentialSavings: 'desc' },
        { createdAt: 'desc' }
      ]
    });
  }

  /**
   * Update recommendation status
   */
  async updateRecommendationStatus(
    id: string, 
    status: OptimizationStatus
  ): Promise<CostOptimization> {
    return await this.prisma.costOptimization.update({
      where: { id },
      data: { 
        status,
        implementedAt: status === OptimizationStatus.IMPLEMENTED ? new Date() : undefined
      }
    });
  }
}