import { PrismaClient, ApiAlert, ApiAlertType, ApiUsage } from '@prisma/client';
import { logger } from '../logger';

export interface AlertConfig {
  platform: string;
  alertType: ApiAlertType;
  threshold: number;
  window?: '1h' | '24h';
  cooldownMinutes?: number;
  enabled: boolean;
  notificationChannels?: string[];
}

export interface AlertRule {
  name: string;
  description: string;
  evaluate: (usage: any) => Promise<boolean>;
  getMessage: (usage: any) => string;
  alertType: ApiAlertType;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export class APIAlertManager {
  private prisma: PrismaClient;
  private defaultConfigs: AlertConfig[] = [
    // Rate limit alerts
    { platform: 'all', alertType: ApiAlertType.RATE_LIMIT_WARNING, threshold: 80, window: '1h', cooldownMinutes: 60, enabled: true },
    { platform: 'all', alertType: ApiAlertType.RATE_LIMIT_CRITICAL, threshold: 95, window: '1h', cooldownMinutes: 30, enabled: true },
    
    // Cost alerts
    { platform: 'all', alertType: ApiAlertType.COST_WARNING, threshold: 80, window: '24h', cooldownMinutes: 360, enabled: true },
    { platform: 'all', alertType: ApiAlertType.COST_CRITICAL, threshold: 95, window: '24h', cooldownMinutes: 180, enabled: true },
    
    // Error rate alerts
    { platform: 'all', alertType: ApiAlertType.ERROR_RATE_HIGH, threshold: 10, window: '1h', cooldownMinutes: 120, enabled: true },
  ];

  private customRules: AlertRule[] = [
    {
      name: 'Spike Detection',
      description: 'Alert when usage spikes more than 200% compared to average',
      evaluate: async (usage) => {
        const spike = usage.current > usage.average * 2;
        return spike && usage.current > 100; // Only alert for significant spikes
      },
      getMessage: (usage) => `Usage spike detected: ${usage.current} requests (${((usage.current / usage.average - 1) * 100).toFixed(0)}% increase)`,
      alertType: ApiAlertType.RATE_LIMIT_WARNING,
      severity: 'high'
    },
    {
      name: 'Budget Burn Rate',
      description: 'Alert when daily spend exceeds monthly budget pace',
      evaluate: async (usage) => {
        const dailyBudget = usage.monthlyBudget / 30;
        return usage.dailyCost > dailyBudget * 1.5;
      },
      getMessage: (usage) => `High burn rate: $${usage.dailyCost.toFixed(2)}/day exceeds budget pace by ${((usage.dailyCost / (usage.monthlyBudget / 30) - 1) * 100).toFixed(0)}%`,
      alertType: ApiAlertType.COST_WARNING,
      severity: 'high'
    },
    {
      name: 'Consecutive Errors',
      description: 'Alert on consecutive API errors',
      evaluate: async (usage) => {
        return usage.consecutiveErrors >= 5;
      },
      getMessage: (usage) => `${usage.consecutiveErrors} consecutive errors detected for ${usage.platform}`,
      alertType: ApiAlertType.ERROR_RATE_HIGH,
      severity: 'critical'
    }
  ];

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || new PrismaClient();
  }

  async evaluateAlerts(platform?: string): Promise<ApiAlert[]> {
    const alerts: ApiAlert[] = [];
    const configs = await this.getActiveConfigs(platform);

    for (const config of configs) {
      try {
        const shouldAlert = await this.shouldTriggerAlert(config);
        if (shouldAlert) {
          const alert = await this.createAlert(config);
          if (alert) alerts.push(alert);
        }
      } catch (error) {
        logger.error(`Failed to evaluate alert for ${config.platform}/${config.alertType}:`, error);
      }
    }

    // Evaluate custom rules
    const customAlerts = await this.evaluateCustomRules(platform);
    alerts.push(...customAlerts);

    return alerts;
  }

  private async shouldTriggerAlert(config: AlertConfig): Promise<boolean> {
    // Check if in cooldown period
    const recentAlert = await this.prisma.apiAlert.findFirst({
      where: {
        platform: config.platform === 'all' ? undefined : config.platform,
        alertType: config.alertType,
        createdAt: {
          gte: new Date(Date.now() - (config.cooldownMinutes || 60) * 60 * 1000)
        }
      }
    });

    if (recentAlert) return false;

    // Get usage metrics based on alert type
    const window = config.window || '1h';
    const usage = await this.getUsageMetrics(config.platform, window);

    switch (config.alertType) {
      case ApiAlertType.RATE_LIMIT_WARNING:
      case ApiAlertType.RATE_LIMIT_CRITICAL:
        return this.checkRateLimitThreshold(usage, config.threshold);
      
      case ApiAlertType.COST_WARNING:
      case ApiAlertType.COST_CRITICAL:
        return this.checkCostThreshold(usage, config.threshold);
      
      case ApiAlertType.ERROR_RATE_HIGH:
        return this.checkErrorRate(usage, config.threshold);
      
      default:
        return false;
    }
  }

  private async checkRateLimitThreshold(usage: any, threshold: number): Promise<boolean> {
    if (!usage.rateLimit) return false;
    const percentageUsed = (usage.requestCount / usage.rateLimit) * 100;
    return percentageUsed >= threshold;
  }

  private async checkCostThreshold(usage: any, threshold: number): Promise<boolean> {
    if (!usage.costLimit) return false;
    const percentageUsed = (usage.totalCost / usage.costLimit) * 100;
    return percentageUsed >= threshold;
  }

  private async checkErrorRate(usage: any, threshold: number): Promise<boolean> {
    if (usage.requestCount === 0) return false;
    const errorRate = (usage.errorCount / usage.requestCount) * 100;
    return errorRate >= threshold;
  }

  private async getUsageMetrics(platform: string, window: '1h' | '24h'): Promise<any> {
    const now = new Date();
    const windowStart = new Date(
      window === '1h' 
        ? now.getTime() - 60 * 60 * 1000
        : now.getTime() - 24 * 60 * 60 * 1000
    );

    const where = platform === 'all' ? {
      timestamp: { gte: windowStart }
    } : {
      platform,
      timestamp: { gte: windowStart }
    };

    const [usage, errors, limits] = await Promise.all([
      this.prisma.apiUsage.aggregate({
        where,
        _count: { id: true },
        _sum: { cost: true, tokensUsed: true }
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
      platform === 'all' ? null : this.prisma.apiLimit.findFirst({
        where: { platform, isActive: true }
      })
    ]);

    return {
      platform,
      window,
      requestCount: usage._count.id,
      totalCost: usage._sum.cost || 0,
      totalTokens: usage._sum.tokensUsed || 0,
      errorCount: errors,
      rateLimit: limits ? (window === '1h' ? limits.rateLimitHourly : limits.rateLimitDaily) : null,
      costLimit: 100, // Default $100 daily limit, should be configurable
      timestamp: now
    };
  }

  private async createAlert(config: AlertConfig): Promise<ApiAlert | null> {
    try {
      const usage = await this.getUsageMetrics(config.platform, config.window || '1h');
      const message = this.generateAlertMessage(config, usage);

      const alert = await this.prisma.apiAlert.create({
        data: {
          platform: config.platform === 'all' ? 'All Platforms' : config.platform,
          alertType: config.alertType,
          threshold: config.threshold,
          message,
          metadata: {
            usage,
            config,
            triggeredAt: new Date().toISOString()
          }
        }
      });

      // Send notifications
      await this.sendNotifications(alert, config.notificationChannels);

      return alert;
    } catch (error) {
      logger.error('Failed to create alert:', error);
      return null;
    }
  }

  private generateAlertMessage(config: AlertConfig, usage: any): string {
    const platform = config.platform === 'all' ? 'All platforms' : config.platform;
    
    switch (config.alertType) {
      case ApiAlertType.RATE_LIMIT_WARNING:
        return `${platform}: API rate limit at ${((usage.requestCount / usage.rateLimit) * 100).toFixed(1)}% (${config.threshold}% threshold)`;
      
      case ApiAlertType.RATE_LIMIT_CRITICAL:
        return `CRITICAL: ${platform} API rate limit at ${((usage.requestCount / usage.rateLimit) * 100).toFixed(1)}% - immediate action required`;
      
      case ApiAlertType.COST_WARNING:
        return `${platform}: API costs at $${usage.totalCost.toFixed(2)} (${config.threshold}% of limit)`;
      
      case ApiAlertType.COST_CRITICAL:
        return `CRITICAL: ${platform} API costs at $${usage.totalCost.toFixed(2)} - budget nearly exhausted`;
      
      case ApiAlertType.ERROR_RATE_HIGH:
        const errorRate = (usage.errorCount / usage.requestCount) * 100;
        return `${platform}: High error rate detected (${errorRate.toFixed(1)}% errors in last ${config.window})`;
      
      default:
        return `${platform}: Alert triggered for ${config.alertType}`;
    }
  }

  private async evaluateCustomRules(platform?: string): Promise<ApiAlert[]> {
    const alerts: ApiAlert[] = [];

    for (const rule of this.customRules) {
      try {
        const usage = await this.getCustomRuleUsage(rule, platform);
        const shouldAlert = await rule.evaluate(usage);

        if (shouldAlert) {
          const alert = await this.prisma.apiAlert.create({
            data: {
              platform: platform || 'All Platforms',
              alertType: rule.alertType,
              threshold: 0,
              message: rule.getMessage(usage),
              metadata: {
                ruleName: rule.name,
                severity: rule.severity,
                usage
              }
            }
          });
          alerts.push(alert);
        }
      } catch (error) {
        logger.error(`Failed to evaluate custom rule ${rule.name}:`, error);
      }
    }

    return alerts;
  }

  private async getCustomRuleUsage(rule: AlertRule, platform?: string): Promise<any> {
    // Implement custom usage gathering based on rule requirements
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const baseWhere = platform ? { platform } : {};

    switch (rule.name) {
      case 'Spike Detection':
        const [current, historical] = await Promise.all([
          this.prisma.apiUsage.count({
            where: { ...baseWhere, timestamp: { gte: oneHourAgo } }
          }),
          this.prisma.apiUsage.count({
            where: { ...baseWhere, timestamp: { gte: oneDayAgo, lt: oneHourAgo } }
          })
        ]);
        return {
          current,
          average: historical / 23, // 23 hours of historical data
          platform
        };

      case 'Budget Burn Rate':
        const dailyCost = await this.prisma.apiUsage.aggregate({
          where: { ...baseWhere, timestamp: { gte: oneDayAgo } },
          _sum: { cost: true }
        });
        return {
          dailyCost: dailyCost._sum.cost || 0,
          monthlyBudget: 500, // Should be configurable
          platform
        };

      case 'Consecutive Errors':
        const recentErrors = await this.prisma.apiUsage.findMany({
          where: {
            ...baseWhere,
            timestamp: { gte: oneHourAgo },
            OR: [
              { statusCode: { gte: 400 } },
              { error: { not: null } }
            ]
          },
          orderBy: { timestamp: 'desc' },
          take: 10
        });
        
        let consecutiveErrors = 0;
        for (const error of recentErrors) {
          if (error.error || (error.statusCode && error.statusCode >= 400)) {
            consecutiveErrors++;
          } else {
            break;
          }
        }
        
        return { consecutiveErrors, platform };

      default:
        return {};
    }
  }

  private async sendNotifications(alert: ApiAlert, channels?: string[]): Promise<void> {
    // Implement notification sending logic
    // This could include email, Slack, webhook, etc.
    logger.info(`Alert created: ${alert.message}`);
    
    if (channels && channels.length > 0) {
      // Send to specified channels
      for (const channel of channels) {
        logger.info(`Sending alert to ${channel}: ${alert.message}`);
        // Implement actual notification sending
      }
    }
  }

  async getActiveConfigs(platform?: string): Promise<AlertConfig[]> {
    if (platform) {
      return this.defaultConfigs.filter(
        config => config.enabled && (config.platform === 'all' || config.platform === platform)
      );
    }
    return this.defaultConfigs.filter(config => config.enabled);
  }

  async updateAlertConfig(
    platform: string,
    alertType: ApiAlertType,
    updates: Partial<AlertConfig>
  ): Promise<void> {
    const configIndex = this.defaultConfigs.findIndex(
      config => config.platform === platform && config.alertType === alertType
    );
    
    if (configIndex !== -1) {
      this.defaultConfigs[configIndex] = {
        ...this.defaultConfigs[configIndex],
        ...updates
      };
    } else {
      this.defaultConfigs.push({
        platform,
        alertType,
        threshold: 80,
        window: '1h',
        cooldownMinutes: 60,
        enabled: true,
        ...updates
      });
    }
  }

  async resolveAlert(alertId: string, resolution?: string): Promise<void> {
    await this.prisma.apiAlert.update({
      where: { id: alertId },
      data: {
        isResolved: true,
        resolvedAt: new Date(),
        metadata: {
          resolution,
          resolvedBy: 'system'
        }
      }
    });
  }

  async getAlertHistory(
    platform?: string,
    startDate?: Date,
    endDate?: Date,
    limit: number = 100
  ): Promise<ApiAlert[]> {
    return this.prisma.apiAlert.findMany({
      where: {
        platform: platform || undefined,
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
  }

  async getAlertStats(platform?: string): Promise<{
    totalAlerts: number;
    activeAlerts: number;
    alertsByType: Record<string, number>;
    avgResolutionTime: number;
  }> {
    const where = platform ? { platform } : {};

    const [total, active, byType, resolutionTimes] = await Promise.all([
      this.prisma.apiAlert.count({ where }),
      this.prisma.apiAlert.count({ where: { ...where, isResolved: false } }),
      this.prisma.apiAlert.groupBy({
        by: ['alertType'],
        where,
        _count: { id: true }
      }),
      this.prisma.apiAlert.findMany({
        where: { ...where, isResolved: true, resolvedAt: { not: null } },
        select: {
          createdAt: true,
          resolvedAt: true
        }
      })
    ]);

    const alertsByType = byType.reduce((acc, item) => {
      acc[item.alertType] = item._count.id;
      return acc;
    }, {} as Record<string, number>);

    const avgResolutionTime = resolutionTimes.length > 0
      ? resolutionTimes.reduce((sum, alert) => {
          const resolutionTime = alert.resolvedAt!.getTime() - alert.createdAt.getTime();
          return sum + resolutionTime;
        }, 0) / resolutionTimes.length / (1000 * 60) // Convert to minutes
      : 0;

    return {
      totalAlerts: total,
      activeAlerts: active,
      alertsByType,
      avgResolutionTime
    };
  }

  async close(): Promise<void> {
    await this.prisma.$disconnect();
  }
}