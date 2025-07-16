import { prisma } from '@/lib/prisma';

export interface QuotaUsage {
  used: number;
  limit: number;
  remaining: number;
  resetDate: Date;
  percentUsed: number;
}

export class MonthlyQuotaTracker {
  constructor(
    private platform: string,
    private monthlyLimit: number
  ) {}

  /**
   * Check if quota is available before making requests
   */
  async checkQuota(requiredUnits: number = 1): Promise<boolean> {
    const usage = await this.getCurrentUsage();
    
    if (usage.remaining < requiredUnits) {
      throw new Error(
        `Insufficient ${this.platform} API quota. Required: ${requiredUnits}, Available: ${usage.remaining}`
      );
    }
    
    return true;
  }

  /**
   * Record API usage
   */
  async recordUsage(units: number = 1): Promise<void> {
    try {
      // Record in database
      await prisma.apiUsage.create({
        data: {
          platform: this.platform,
          tokensUsed: units,
          timestamp: new Date(),
          endpoint: 'general',
          cost: 0 // Twitter API is free within limits
        }
      });
    } catch (error) {
      console.error(`Failed to record ${this.platform} API usage:`, error);
    }
  }

  /**
   * Get current month's usage
   */
  async getCurrentUsage(): Promise<QuotaUsage> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    
    // Get usage for current month
    const usage = await prisma.apiUsage.aggregate({
      where: {
        platform: this.platform,
        timestamp: {
          gte: startOfMonth,
          lte: endOfMonth
        }
      },
      _sum: {
        tokensUsed: true
      }
    });
    
    const used = usage._sum.tokensUsed || 0;
    const remaining = Math.max(0, this.monthlyLimit - used);
    const percentUsed = (used / this.monthlyLimit) * 100;
    
    return {
      used,
      limit: this.monthlyLimit,
      remaining,
      resetDate: new Date(now.getFullYear(), now.getMonth() + 1, 1),
      percentUsed: parseFloat(percentUsed.toFixed(2))
    };
  }

  /**
   * Get usage history
   */
  async getUsageHistory(days: number = 30): Promise<Array<{date: Date; usage: number}>> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const usage = await prisma.apiUsage.groupBy({
      by: ['timestamp'],
      where: {
        platform: this.platform,
        timestamp: {
          gte: startDate
        }
      },
      _sum: {
        tokensUsed: true
      },
      orderBy: {
        timestamp: 'asc'
      }
    });
    
    return usage.map(item => ({
      date: item.timestamp,
      usage: item._sum.tokensUsed || 0
    }));
  }

  /**
   * Check if approaching quota limit
   */
  async isApproachingLimit(thresholdPercent: number = 80): Promise<boolean> {
    const usage = await this.getCurrentUsage();
    return usage.percentUsed >= thresholdPercent;
  }

  /**
   * Get estimated days until quota reset
   */
  async getDaysUntilReset(): Promise<number> {
    const usage = await this.getCurrentUsage();
    const now = new Date();
    const msUntilReset = usage.resetDate.getTime() - now.getTime();
    return Math.ceil(msUntilReset / (1000 * 60 * 60 * 24));
  }

  /**
   * Get daily usage rate
   */
  async getDailyUsageRate(): Promise<number> {
    const now = new Date();
    const dayOfMonth = now.getDate();
    const usage = await this.getCurrentUsage();
    
    return usage.used / dayOfMonth;
  }

  /**
   * Predict if quota will last until reset
   */
  async predictQuotaSufficiency(): Promise<{
    willLastUntilReset: boolean;
    estimatedDepletionDate?: Date;
    recommendedDailyLimit?: number;
  }> {
    const usage = await this.getCurrentUsage();
    const dailyRate = await this.getDailyUsageRate();
    const daysUntilReset = await this.getDaysUntilReset();
    
    const projectedUsage = usage.used + (dailyRate * daysUntilReset);
    const willLastUntilReset = projectedUsage <= this.monthlyLimit;
    
    let estimatedDepletionDate: Date | undefined;
    let recommendedDailyLimit: number | undefined;
    
    if (!willLastUntilReset) {
      const remainingDays = usage.remaining / dailyRate;
      estimatedDepletionDate = new Date();
      estimatedDepletionDate.setDate(estimatedDepletionDate.getDate() + Math.floor(remainingDays));
      
      recommendedDailyLimit = Math.floor(usage.remaining / daysUntilReset);
    }
    
    return {
      willLastUntilReset,
      estimatedDepletionDate,
      recommendedDailyLimit
    };
  }
}

/**
 * Daily quota tracker for APIs with daily limits
 */
export class DailyQuotaTracker extends MonthlyQuotaTracker {
  constructor(platform: string, dailyLimit: number) {
    super(platform, dailyLimit);
  }

  async getCurrentUsage(): Promise<QuotaUsage> {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    
    const usage = await prisma.apiUsage.aggregate({
      where: {
        platform: this.platform,
        timestamp: {
          gte: startOfDay,
          lte: endOfDay
        }
      },
      _sum: {
        tokensUsed: true
      }
    });
    
    const used = usage._sum.tokensUsed || 0;
    const remaining = Math.max(0, this['monthlyLimit'] - used); // monthlyLimit is actually dailyLimit
    const percentUsed = (used / this['monthlyLimit']) * 100;
    
    // Reset at midnight
    const resetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    
    return {
      used,
      limit: this['monthlyLimit'],
      remaining,
      resetDate,
      percentUsed: parseFloat(percentUsed.toFixed(2))
    };
  }
}