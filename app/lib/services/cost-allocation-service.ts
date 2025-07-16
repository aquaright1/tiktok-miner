import { PrismaClient } from '@prisma/client';
import { BudgetManager } from './budget-manager';
import { logger } from '@/lib/logger';

export interface CostAllocationRule {
  id: string;
  platform: string;
  serviceType: string;
  budgetId: string;
  allocationPercentage: number;
  isActive: boolean;
  priority: number;
}

export interface ApiCostRecord {
  id: string;
  platform: string;
  model?: string;
  endpoint: string;
  timestamp: Date;
  cost: number;
  userId?: string;
  requestId?: string;
  tokensUsed?: number;
}

export class CostAllocationService {
  private prisma: PrismaClient;
  private budgetManager: BudgetManager;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.budgetManager = new BudgetManager(prisma);
  }

  /**
   * Automatically allocate API costs to budgets based on rules
   */
  async allocateApiCosts(apiCosts: ApiCostRecord[]): Promise<void> {
    for (const apiCost of apiCosts) {
      await this.allocateSingleCost(apiCost);
    }
  }

  /**
   * Allocate a single API cost to appropriate budgets
   */
  async allocateSingleCost(apiCost: ApiCostRecord): Promise<void> {
    try {
      // Get allocation rules for this platform
      const rules = await this.getCostAllocationRules(apiCost.platform);
      
      if (rules.length === 0) {
        logger.warn(`No allocation rules found for platform: ${apiCost.platform}`);
        return;
      }

      // Calculate allocations based on rules
      const allocations = this.calculateAllocations(apiCost, rules);

      // Apply allocations to budgets
      for (const allocation of allocations) {
        try {
          await this.budgetManager.allocateCost({
            budgetId: allocation.budgetId,
            platform: apiCost.platform,
            serviceType: this.determineServiceType(apiCost),
            costAmount: allocation.amount,
            description: `API cost allocation from ${apiCost.endpoint}`,
            metadata: {
              originalCostId: apiCost.id,
              requestId: apiCost.requestId,
              tokensUsed: apiCost.tokensUsed,
              model: apiCost.model,
              allocationPercentage: allocation.percentage,
            },
          });
        } catch (error) {
          logger.error(`Failed to allocate cost to budget ${allocation.budgetId}`, {
            error,
            apiCost,
            allocation,
          });
        }
      }
    } catch (error) {
      logger.error('Failed to allocate single cost', { error, apiCost });
    }
  }

  /**
   * Get cost allocation rules for a platform
   */
  private async getCostAllocationRules(platform: string): Promise<CostAllocationRule[]> {
    // For now, return default rules - in a real implementation, this would come from the database
    const defaultRules: CostAllocationRule[] = [
      {
        id: 'default-ai-budget',
        platform: 'openai',
        serviceType: 'AI_GENERATION',
        budgetId: 'ai-monthly-budget',
        allocationPercentage: 100,
        isActive: true,
        priority: 1,
      },
      {
        id: 'default-instagram-budget',
        platform: 'instagram',
        serviceType: 'SOCIAL_MEDIA_API',
        budgetId: 'social-media-budget',
        allocationPercentage: 100,
        isActive: true,
        priority: 1,
      },
      {
        id: 'default-apify-budget',
        platform: 'apify',
        serviceType: 'WEB_SCRAPING',
        budgetId: 'scraping-budget',
        allocationPercentage: 100,
        isActive: true,
        priority: 1,
      },
    ];

    return defaultRules.filter(rule => rule.platform === platform && rule.isActive);
  }

  /**
   * Calculate cost allocations based on rules
   */
  private calculateAllocations(
    apiCost: ApiCostRecord,
    rules: CostAllocationRule[]
  ): Array<{ budgetId: string; amount: number; percentage: number }> {
    const allocations: Array<{ budgetId: string; amount: number; percentage: number }> = [];

    // Sort rules by priority
    const sortedRules = rules.sort((a, b) => a.priority - b.priority);

    let remainingCost = apiCost.cost;
    let remainingPercentage = 100;

    for (const rule of sortedRules) {
      if (remainingCost <= 0) break;

      const effectivePercentage = Math.min(rule.allocationPercentage, remainingPercentage);
      const allocationAmount = (apiCost.cost * effectivePercentage) / 100;

      allocations.push({
        budgetId: rule.budgetId,
        amount: allocationAmount,
        percentage: effectivePercentage,
      });

      remainingCost -= allocationAmount;
      remainingPercentage -= effectivePercentage;
    }

    return allocations;
  }

  /**
   * Determine service type based on API cost details
   */
  private determineServiceType(apiCost: ApiCostRecord): string {
    const { platform, endpoint, model } = apiCost;

    // Map platforms to service types
    const platformServiceMap: Record<string, string> = {
      openai: 'AI_GENERATION',
      anthropic: 'AI_GENERATION',
      instagram: 'SOCIAL_MEDIA_API',
      youtube: 'SOCIAL_MEDIA_API',
      twitter: 'SOCIAL_MEDIA_API',
      tiktok: 'SOCIAL_MEDIA_API',
      linkedin: 'SOCIAL_MEDIA_API',
      apify: 'WEB_SCRAPING',
    };

    // Check for specific model types
    if (model?.includes('gpt') || model?.includes('claude')) {
      return 'AI_GENERATION';
    }

    // Check for endpoint patterns
    if (endpoint.includes('/scraping/') || endpoint.includes('/actors/')) {
      return 'WEB_SCRAPING';
    }

    return platformServiceMap[platform] || 'OTHER';
  }

  /**
   * Process recent API usage and allocate costs
   */
  async processRecentApiUsage(hoursBack: number = 1): Promise<void> {
    const cutoffTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

    try {
      // Get recent API usage that hasn't been allocated yet
      const recentUsage = await this.prisma.apiUsage.findMany({
        where: {
          timestamp: { gte: cutoffTime },
          // Add a field to track if cost has been allocated
          // For now, we'll process all recent usage
        },
        select: {
          id: true,
          platform: true,
          model: true,
          endpoint: true,
          timestamp: true,
          cost: true,
          userId: true,
          requestId: true,
          tokensUsed: true,
        },
      });

      if (recentUsage.length === 0) {
        logger.info('No recent API usage found for cost allocation');
        return;
      }

      logger.info(`Processing ${recentUsage.length} recent API usage records for cost allocation`);

      // Convert to ApiCostRecord format
      const apiCosts: ApiCostRecord[] = recentUsage.map(usage => ({
        id: usage.id,
        platform: usage.platform,
        model: usage.model || undefined,
        endpoint: usage.endpoint,
        timestamp: usage.timestamp,
        cost: usage.cost,
        userId: usage.userId || undefined,
        requestId: usage.requestId || undefined,
        tokensUsed: usage.tokensUsed || undefined,
      }));

      // Allocate costs to budgets
      await this.allocateApiCosts(apiCosts);

      logger.info('Completed cost allocation for recent API usage');
    } catch (error) {
      logger.error('Failed to process recent API usage for cost allocation', { error });
    }
  }

  /**
   * Get cost allocation statistics
   */
  async getCostAllocationStats(budgetId?: string): Promise<{
    totalAllocated: number;
    allocationsByPlatform: Record<string, number>;
    allocationsByServiceType: Record<string, number>;
    recentAllocations: Array<{
      platform: string;
      amount: number;
      timestamp: Date;
    }>;
  }> {
    try {
      const whereClause = budgetId ? { budgetId } : {};

      const allocations = await this.prisma.costAllocation.findMany({
        where: whereClause,
        include: {
          budget: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 100,
      });

      const totalAllocated = allocations.reduce((sum, allocation) => sum + allocation.costAmount, 0);

      const allocationsByPlatform = allocations.reduce((acc, allocation) => {
        acc[allocation.platform] = (acc[allocation.platform] || 0) + allocation.costAmount;
        return acc;
      }, {} as Record<string, number>);

      const allocationsByServiceType = allocations.reduce((acc, allocation) => {
        acc[allocation.serviceType] = (acc[allocation.serviceType] || 0) + allocation.costAmount;
        return acc;
      }, {} as Record<string, number>);

      const recentAllocations = allocations.slice(0, 10).map(allocation => ({
        platform: allocation.platform,
        amount: allocation.costAmount,
        timestamp: allocation.createdAt,
      }));

      return {
        totalAllocated,
        allocationsByPlatform,
        allocationsByServiceType,
        recentAllocations,
      };
    } catch (error) {
      logger.error('Failed to get cost allocation stats', { error });
      return {
        totalAllocated: 0,
        allocationsByPlatform: {},
        allocationsByServiceType: {},
        recentAllocations: [],
      };
    }
  }
}