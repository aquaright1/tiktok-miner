import { PrismaClient } from '@prisma/client';
import { logger } from '@/lib/logger';

export interface CostPrediction {
  platform: string;
  serviceType: string;
  currentCost: number;
  predictedCost: number;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  timeframe: number; // days
  factors: string[];
  trend: 'INCREASING' | 'DECREASING' | 'STABLE';
}

export interface CostForecastRequest {
  platform?: string;
  serviceType?: string;
  forecastDays: number;
  includeSeasonality?: boolean;
}

export class PredictiveCostModel {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Generate cost predictions for platforms and services
   */
  async generateCostPredictions(request: CostForecastRequest): Promise<CostPrediction[]> {
    const { platform, serviceType, forecastDays, includeSeasonality = false } = request;

    try {
      // Get historical cost data for the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const historicalCosts = await this.prisma.apiUsage.findMany({
        where: {
          timestamp: { gte: thirtyDaysAgo },
          ...(platform && { platform }),
        },
        select: {
          platform: true,
          endpoint: true,
          cost: true,
          timestamp: true,
          tokensUsed: true,
        },
        orderBy: {
          timestamp: 'desc',
        },
      });

      if (historicalCosts.length === 0) {
        logger.warn('No historical cost data found for prediction');
        return [];
      }

      // Group costs by platform and service type
      const groupedCosts = this.groupCostsByPlatformAndService(historicalCosts);

      const predictions: CostPrediction[] = [];

      for (const [key, costs] of Object.entries(groupedCosts)) {
        const [platformName, serviceName] = key.split('::');
        
        if (serviceType && serviceName !== serviceType) {
          continue;
        }

        const prediction = await this.generateSinglePrediction(
          platformName,
          serviceName,
          costs,
          forecastDays,
          includeSeasonality
        );

        if (prediction) {
          predictions.push(prediction);
        }
      }

      // Store predictions in database
      await this.storePredictions(predictions);

      return predictions;
    } catch (error) {
      logger.error('Failed to generate cost predictions', { error });
      throw error;
    }
  }

  /**
   * Generate a single cost prediction for a platform/service
   */
  private async generateSinglePrediction(
    platform: string,
    serviceType: string,
    costs: Array<{ cost: number; timestamp: Date; tokensUsed?: number }>,
    forecastDays: number,
    includeSeasonality: boolean
  ): Promise<CostPrediction | null> {
    if (costs.length < 7) {
      // Need at least 7 days of data for reasonable prediction
      return null;
    }

    // Calculate daily costs
    const dailyCosts = this.aggregateCostsByDay(costs);
    
    // Apply different forecasting models
    const linearPrediction = this.linearForecast(dailyCosts, forecastDays);
    const exponentialPrediction = this.exponentialForecast(dailyCosts, forecastDays);
    const seasonalPrediction = includeSeasonality 
      ? this.seasonalForecast(dailyCosts, forecastDays)
      : null;

    // Combine predictions with weights
    const predictions = [
      { value: linearPrediction.predicted, weight: 0.4 },
      { value: exponentialPrediction.predicted, weight: 0.4 },
      ...(seasonalPrediction ? [{ value: seasonalPrediction.predicted, weight: 0.2 }] : []),
    ];

    const weightedPrediction = predictions.reduce(
      (sum, pred) => sum + pred.value * pred.weight,
      0
    ) / predictions.reduce((sum, pred) => sum + pred.weight, 0);

    const currentCost = dailyCosts.reduce((sum, cost) => sum + cost.amount, 0);
    const averageDailyCost = currentCost / dailyCosts.length;

    // Determine confidence based on data variance
    const variance = this.calculateVariance(dailyCosts.map(d => d.amount));
    const confidence = this.determineConfidence(variance, dailyCosts.length);

    // Determine trend
    const trend = this.determineTrend(dailyCosts);

    // Identify key factors affecting cost
    const factors = this.identifyFactors(dailyCosts, platform, serviceType);

    return {
      platform,
      serviceType,
      currentCost: currentCost,
      predictedCost: weightedPrediction,
      confidence,
      timeframe: forecastDays,
      factors,
      trend,
    };
  }

  /**
   * Linear regression forecast
   */
  private linearForecast(
    dailyCosts: Array<{ day: number; amount: number }>,
    forecastDays: number
  ): { predicted: number; slope: number } {
    const n = dailyCosts.length;
    const sumX = dailyCosts.reduce((sum, d) => sum + d.day, 0);
    const sumY = dailyCosts.reduce((sum, d) => sum + d.amount, 0);
    const sumXY = dailyCosts.reduce((sum, d) => sum + d.day * d.amount, 0);
    const sumX2 = dailyCosts.reduce((sum, d) => sum + d.day * d.day, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Predict for the next period
    const futureDays = Array.from({ length: forecastDays }, (_, i) => n + i + 1);
    const predicted = futureDays.reduce((sum, day) => sum + (slope * day + intercept), 0);

    return { predicted, slope };
  }

  /**
   * Exponential smoothing forecast
   */
  private exponentialForecast(
    dailyCosts: Array<{ day: number; amount: number }>,
    forecastDays: number
  ): { predicted: number; alpha: number } {
    const alpha = 0.3; // Smoothing parameter
    const values = dailyCosts.map(d => d.amount);
    
    let smoothed = values[0];
    for (let i = 1; i < values.length; i++) {
      smoothed = alpha * values[i] + (1 - alpha) * smoothed;
    }

    // Simple exponential forecast
    const predicted = smoothed * forecastDays;

    return { predicted, alpha };
  }

  /**
   * Seasonal forecast (simplified)
   */
  private seasonalForecast(
    dailyCosts: Array<{ day: number; amount: number }>,
    forecastDays: number
  ): { predicted: number; seasonalFactor: number } {
    // Simple seasonal adjustment based on day of week
    const weeklyPattern = this.calculateWeeklyPattern(dailyCosts);
    const averageCost = dailyCosts.reduce((sum, d) => sum + d.amount, 0) / dailyCosts.length;
    
    // Apply seasonal factors
    const seasonalFactor = weeklyPattern.reduce((sum, factor) => sum + factor, 0) / 7;
    const predicted = averageCost * seasonalFactor * forecastDays;

    return { predicted, seasonalFactor };
  }

  /**
   * Group costs by platform and service type
   */
  private groupCostsByPlatformAndService(
    costs: Array<{ platform: string; endpoint: string; cost: number; timestamp: Date; tokensUsed?: number }>
  ): Record<string, Array<{ cost: number; timestamp: Date; tokensUsed?: number }>> {
    const grouped: Record<string, Array<{ cost: number; timestamp: Date; tokensUsed?: number }>> = {};

    for (const cost of costs) {
      const serviceType = this.determineServiceTypeFromEndpoint(cost.endpoint);
      const key = `${cost.platform}::${serviceType}`;

      if (!grouped[key]) {
        grouped[key] = [];
      }

      grouped[key].push({
        cost: cost.cost,
        timestamp: cost.timestamp,
        tokensUsed: cost.tokensUsed,
      });
    }

    return grouped;
  }

  /**
   * Aggregate costs by day
   */
  private aggregateCostsByDay(
    costs: Array<{ cost: number; timestamp: Date }>
  ): Array<{ day: number; amount: number; date: Date }> {
    const dailyAggregates = new Map<string, { amount: number; date: Date }>();

    for (const cost of costs) {
      const dateKey = cost.timestamp.toISOString().split('T')[0];
      
      if (!dailyAggregates.has(dateKey)) {
        dailyAggregates.set(dateKey, { amount: 0, date: cost.timestamp });
      }

      const aggregate = dailyAggregates.get(dateKey)!;
      aggregate.amount += cost.cost;
    }

    return Array.from(dailyAggregates.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([_, data], index) => ({
        day: index + 1,
        amount: data.amount,
        date: data.date,
      }));
  }

  /**
   * Calculate variance for confidence determination
   */
  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return variance;
  }

  /**
   * Determine confidence level based on variance and data points
   */
  private determineConfidence(variance: number, dataPoints: number): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (dataPoints < 7) return 'LOW';
    if (dataPoints >= 30 && variance < 0.1) return 'HIGH';
    if (dataPoints >= 14 && variance < 0.5) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Determine cost trend
   */
  private determineTrend(dailyCosts: Array<{ amount: number }>): 'INCREASING' | 'DECREASING' | 'STABLE' {
    const firstHalf = dailyCosts.slice(0, Math.floor(dailyCosts.length / 2));
    const secondHalf = dailyCosts.slice(Math.floor(dailyCosts.length / 2));

    const firstAvg = firstHalf.reduce((sum, d) => sum + d.amount, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, d) => sum + d.amount, 0) / secondHalf.length;

    const changePercent = ((secondAvg - firstAvg) / firstAvg) * 100;

    if (changePercent > 10) return 'INCREASING';
    if (changePercent < -10) return 'DECREASING';
    return 'STABLE';
  }

  /**
   * Identify factors affecting cost
   */
  private identifyFactors(
    dailyCosts: Array<{ amount: number }>,
    platform: string,
    serviceType: string
  ): string[] {
    const factors: string[] = [];

    // Add platform-specific factors
    if (platform === 'openai' || platform === 'anthropic') {
      factors.push('Token usage patterns', 'Model selection', 'Request frequency');
    } else if (platform === 'apify') {
      factors.push('Scraping volume', 'Actor efficiency', 'Data complexity');
    } else {
      factors.push('API request volume', 'Rate limiting', 'Service usage');
    }

    // Add trend-based factors
    const variance = this.calculateVariance(dailyCosts.map(d => d.amount));
    if (variance > 0.5) {
      factors.push('High cost variability');
    }

    return factors;
  }

  /**
   * Calculate weekly pattern for seasonal adjustment
   */
  private calculateWeeklyPattern(dailyCosts: Array<{ amount: number; day: number }>): number[] {
    const weeklyTotals = new Array(7).fill(0);
    const weeklyCounts = new Array(7).fill(0);

    for (const cost of dailyCosts) {
      const dayOfWeek = cost.day % 7;
      weeklyTotals[dayOfWeek] += cost.amount;
      weeklyCounts[dayOfWeek]++;
    }

    return weeklyTotals.map((total, i) => 
      weeklyCounts[i] > 0 ? total / weeklyCounts[i] : 0
    );
  }

  /**
   * Determine service type from endpoint
   */
  private determineServiceTypeFromEndpoint(endpoint: string): string {
    if (endpoint.includes('chat') || endpoint.includes('completion')) {
      return 'AI_GENERATION';
    } else if (endpoint.includes('scraping') || endpoint.includes('actor')) {
      return 'WEB_SCRAPING';
    } else if (endpoint.includes('instagram') || endpoint.includes('twitter')) {
      return 'SOCIAL_MEDIA_API';
    }
    return 'OTHER';
  }

  /**
   * Store predictions in database
   */
  private async storePredictions(predictions: CostPrediction[]): Promise<void> {
    for (const prediction of predictions) {
      await this.prisma.costForecast.create({
        data: {
          platform: prediction.platform,
          serviceType: prediction.serviceType as any,
          forecastType: 'MACHINE_LEARNING',
          confidence: prediction.confidence,
          currentCost: prediction.currentCost,
          predictedCost: prediction.predictedCost,
          forecastPeriod: prediction.timeframe,
          forecastDate: new Date(Date.now() + prediction.timeframe * 24 * 60 * 60 * 1000),
          metadata: {
            trend: prediction.trend,
            factors: prediction.factors,
          },
        },
      });
    }
  }
}