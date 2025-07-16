import { PrismaClient } from '@prisma/client';
import { 
  Budget, 
  BudgetAllocation, 
  BudgetAlert, 
  CostAllocation,
  BudgetType,
  BudgetStatus,
  ServiceType,
  AllocationPriority,
  BudgetAlertType
} from '@prisma/client';
import { logger } from '../logger';

export interface CreateBudgetRequest {
  name: string;
  description?: string;
  budgetType: BudgetType;
  totalAmount: number;
  startDate: Date;
  endDate: Date;
  autoRenewal?: boolean;
  createdBy?: string;
  allocations?: {
    platform: string;
    serviceType: ServiceType;
    allocatedAmount: number;
    priority?: AllocationPriority;
  }[];
}

export interface UpdateBudgetRequest {
  name?: string;
  description?: string;
  totalAmount?: number;
  startDate?: Date;
  endDate?: Date;
  status?: BudgetStatus;
  autoRenewal?: boolean;
  alertThreshold80?: boolean;
  alertThreshold90?: boolean;
  alertThreshold100?: boolean;
}

export interface BudgetSummary {
  budget: Budget;
  allocations: BudgetAllocation[];
  totalSpent: number;
  totalRemaining: number;
  spentPercentage: number;
  alerts: BudgetAlert[];
  projectedEndDate?: Date;
  burnRate: number; // Daily burn rate
}

export interface CostAllocationRequest {
  budgetId: string;
  platform: string;
  serviceType: ServiceType;
  costAmount: number;
  description?: string;
  costDate?: Date;
  apiUsageId?: string;
  apifyRunId?: string;
  metadata?: any;
}

export interface BudgetAnalytics {
  totalBudgets: number;
  activeBudgets: number;
  totalAllocated: number;
  totalSpent: number;
  totalRemaining: number;
  averageSpentPercentage: number;
  budgetsExceeded: number;
  budgetsNearLimit: number;
  topSpendingPlatforms: {
    platform: string;
    totalSpent: number;
    percentage: number;
  }[];
  monthlyTrend: {
    month: string;
    totalSpent: number;
    budgetUtilization: number;
  }[];
}

export class BudgetManager {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Create a new budget with optional allocations
   */
  async createBudget(request: CreateBudgetRequest): Promise<Budget> {
    try {
      // Validate allocation amounts don't exceed budget
      if (request.allocations) {
        const totalAllocation = request.allocations.reduce((sum, allocation) => sum + allocation.allocatedAmount, 0);
        if (totalAllocation > request.totalAmount) {
          throw new Error(`Total allocation amount (${totalAllocation}) exceeds budget total (${request.totalAmount})`);
        }
      }

      const budget = await this.prisma.budget.create({
        data: {
          name: request.name,
          description: request.description,
          budgetType: request.budgetType,
          totalAmount: request.totalAmount,
          remainingAmount: request.totalAmount,
          startDate: request.startDate,
          endDate: request.endDate,
          autoRenewal: request.autoRenewal || false,
          createdBy: request.createdBy,
          budgetAllocations: request.allocations ? {
            create: request.allocations.map(allocation => ({
              platform: allocation.platform,
              serviceType: allocation.serviceType,
              allocatedAmount: allocation.allocatedAmount,
              remainingAmount: allocation.allocatedAmount,
              priority: allocation.priority || 'MEDIUM',
            }))
          } : undefined
        },
        include: {
          budgetAllocations: true,
          budgetAlerts: true,
          costAllocations: true,
        }
      });

      logger.info('Budget created successfully', {
        budgetId: budget.id,
        name: budget.name,
        totalAmount: budget.totalAmount,
        allocationsCount: request.allocations?.length || 0
      });

      return budget;
    } catch (error) {
      logger.error('Failed to create budget', { error, request });
      throw error;
    }
  }

  /**
   * Get budget with full details
   */
  async getBudget(budgetId: string): Promise<BudgetSummary | null> {
    try {
      const budget = await this.prisma.budget.findUnique({
        where: { id: budgetId },
        include: {
          budgetAllocations: true,
          budgetAlerts: {
            where: { isResolved: false },
            orderBy: { createdAt: 'desc' },
            take: 10
          },
          costAllocations: {
            orderBy: { costDate: 'desc' },
            take: 100
          }
        }
      });

      if (!budget) {
        return null;
      }

      // Calculate spending metrics
      const totalSpent = budget.costAllocations.reduce((sum, cost) => sum + cost.costAmount, 0);
      const totalRemaining = budget.totalAmount - totalSpent;
      const spentPercentage = (totalSpent / budget.totalAmount) * 100;

      // Calculate burn rate (daily average)
      const daysSinceStart = Math.max(1, Math.floor((Date.now() - budget.startDate.getTime()) / (1000 * 60 * 60 * 24)));
      const burnRate = totalSpent / daysSinceStart;

      // Project end date based on current burn rate
      const projectedEndDate = burnRate > 0 ? new Date(Date.now() + (totalRemaining / burnRate) * 24 * 60 * 60 * 1000) : undefined;

      return {
        budget,
        allocations: budget.budgetAllocations,
        totalSpent,
        totalRemaining,
        spentPercentage,
        alerts: budget.budgetAlerts,
        projectedEndDate,
        burnRate
      };
    } catch (error) {
      logger.error('Failed to get budget', { error, budgetId });
      throw error;
    }
  }

  /**
   * Update budget details
   */
  async updateBudget(budgetId: string, updates: UpdateBudgetRequest): Promise<Budget> {
    try {
      const budget = await this.prisma.budget.update({
        where: { id: budgetId },
        data: {
          ...updates,
          remainingAmount: updates.totalAmount ? updates.totalAmount - (await this.getTotalSpent(budgetId)) : undefined
        },
        include: {
          budgetAllocations: true,
          budgetAlerts: true,
          costAllocations: true,
        }
      });

      logger.info('Budget updated successfully', {
        budgetId,
        updates: Object.keys(updates)
      });

      return budget;
    } catch (error) {
      logger.error('Failed to update budget', { error, budgetId, updates });
      throw error;
    }
  }

  /**
   * List all budgets with optional filters
   */
  async listBudgets(filters?: {
    status?: BudgetStatus;
    budgetType?: BudgetType;
    startDate?: Date;
    endDate?: Date;
  }): Promise<Budget[]> {
    try {
      const budgets = await this.prisma.budget.findMany({
        where: {
          status: filters?.status,
          budgetType: filters?.budgetType,
          startDate: filters?.startDate ? { gte: filters.startDate } : undefined,
          endDate: filters?.endDate ? { lte: filters.endDate } : undefined,
        },
        include: {
          budgetAllocations: true,
          budgetAlerts: {
            where: { isResolved: false },
            take: 5
          },
          _count: {
            select: {
              costAllocations: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      return budgets;
    } catch (error) {
      logger.error('Failed to list budgets', { error, filters });
      throw error;
    }
  }

  /**
   * Allocate cost to a budget
   */
  async allocateCost(request: CostAllocationRequest): Promise<CostAllocation> {
    try {
      const budget = await this.prisma.budget.findUnique({
        where: { id: request.budgetId },
        include: { budgetAllocations: true }
      });

      if (!budget) {
        throw new Error('Budget not found');
      }

      if (budget.status !== 'ACTIVE') {
        throw new Error('Cannot allocate cost to inactive budget');
      }

      // Create cost allocation
      const costAllocation = await this.prisma.costAllocation.create({
        data: {
          budgetId: request.budgetId,
          platform: request.platform,
          serviceType: request.serviceType,
          costAmount: request.costAmount,
          description: request.description,
          costDate: request.costDate || new Date(),
          apiUsageId: request.apiUsageId,
          apifyRunId: request.apifyRunId,
          metadata: request.metadata
        }
      });

      // Update budget spent amounts
      await this.updateBudgetSpentAmounts(request.budgetId);

      // Update allocation spent amounts
      await this.updateAllocationSpentAmounts(request.budgetId, request.platform, request.serviceType);

      // Check for budget alerts
      await this.checkBudgetAlerts(request.budgetId);

      logger.info('Cost allocated successfully', {
        budgetId: request.budgetId,
        platform: request.platform,
        serviceType: request.serviceType,
        costAmount: request.costAmount
      });

      return costAllocation;
    } catch (error) {
      logger.error('Failed to allocate cost', { error, request });
      throw error;
    }
  }

  /**
   * Get budget analytics
   */
  async getBudgetAnalytics(
    startDate?: Date,
    endDate?: Date
  ): Promise<BudgetAnalytics> {
    try {
      const whereClause = {
        ...(startDate && { startDate: { gte: startDate } }),
        ...(endDate && { endDate: { lte: endDate } })
      };

      const budgets = await this.prisma.budget.findMany({
        where: whereClause,
        include: {
          budgetAllocations: true,
          costAllocations: true,
          budgetAlerts: true
        }
      });

      const totalBudgets = budgets.length;
      const activeBudgets = budgets.filter(b => b.status === 'ACTIVE').length;
      const totalAllocated = budgets.reduce((sum, b) => sum + b.totalAmount, 0);
      const totalSpent = budgets.reduce((sum, b) => sum + b.spentAmount, 0);
      const totalRemaining = totalAllocated - totalSpent;
      const averageSpentPercentage = totalAllocated > 0 ? (totalSpent / totalAllocated) * 100 : 0;
      const budgetsExceeded = budgets.filter(b => b.spentAmount > b.totalAmount).length;
      const budgetsNearLimit = budgets.filter(b => (b.spentAmount / b.totalAmount) > 0.8 && b.spentAmount <= b.totalAmount).length;

      // Top spending platforms
      const platformSpending = new Map<string, number>();
      budgets.forEach(budget => {
        budget.costAllocations.forEach(cost => {
          platformSpending.set(cost.platform, (platformSpending.get(cost.platform) || 0) + cost.costAmount);
        });
      });

      const topSpendingPlatforms = Array.from(platformSpending.entries())
        .map(([platform, totalSpent]) => ({
          platform,
          totalSpent,
          percentage: (totalSpent / totalSpent) * 100
        }))
        .sort((a, b) => b.totalSpent - a.totalSpent)
        .slice(0, 10);

      // Monthly trend (last 12 months)
      const monthlyTrend = await this.calculateMonthlyTrend(12);

      return {
        totalBudgets,
        activeBudgets,
        totalAllocated,
        totalSpent,
        totalRemaining,
        averageSpentPercentage,
        budgetsExceeded,
        budgetsNearLimit,
        topSpendingPlatforms,
        monthlyTrend
      };
    } catch (error) {
      logger.error('Failed to get budget analytics', { error });
      throw error;
    }
  }

  /**
   * Check and create budget alerts
   */
  private async checkBudgetAlerts(budgetId: string): Promise<void> {
    const budget = await this.prisma.budget.findUnique({
      where: { id: budgetId },
      include: {
        budgetAlerts: {
          where: { isResolved: false }
        }
      }
    });

    if (!budget) return;

    const spentPercentage = (budget.spentAmount / budget.totalAmount) * 100;
    const alertsToCreate: BudgetAlertType[] = [];

    // Check alert thresholds
    if (budget.alertThreshold80 && spentPercentage >= 80 && !budget.budgetAlerts.some(a => a.alertType === BudgetAlertType.THRESHOLD_80)) {
      alertsToCreate.push(BudgetAlertType.THRESHOLD_80);
    }
    if (budget.alertThreshold90 && spentPercentage >= 90 && !budget.budgetAlerts.some(a => a.alertType === BudgetAlertType.THRESHOLD_90)) {
      alertsToCreate.push(BudgetAlertType.THRESHOLD_90);
    }
    if (budget.alertThreshold100 && spentPercentage >= 100 && !budget.budgetAlerts.some(a => a.alertType === BudgetAlertType.THRESHOLD_100)) {
      alertsToCreate.push(BudgetAlertType.THRESHOLD_100);
    }

    // Create alerts
    for (const alertType of alertsToCreate) {
      await this.prisma.budgetAlert.create({
        data: {
          budgetId: budget.id,
          alertType,
          threshold: alertType === BudgetAlertType.THRESHOLD_80 ? 80 : 
                    alertType === BudgetAlertType.THRESHOLD_90 ? 90 : 100,
          currentSpent: budget.spentAmount,
          budgetTotal: budget.totalAmount,
          message: `Budget "${budget.name}" has reached ${spentPercentage.toFixed(1)}% of allocated amount ($${budget.spentAmount.toFixed(2)} / $${budget.totalAmount.toFixed(2)})`,
          metadata: {
            spentPercentage,
            remainingAmount: budget.totalAmount - budget.spentAmount
          }
        }
      });
    }
  }

  /**
   * Update budget spent amounts
   */
  private async updateBudgetSpentAmounts(budgetId: string): Promise<void> {
    const totalSpent = await this.getTotalSpent(budgetId);
    
    await this.prisma.budget.update({
      where: { id: budgetId },
      data: {
        spentAmount: totalSpent,
        remainingAmount: { decrement: totalSpent }
      }
    });
  }

  /**
   * Update allocation spent amounts
   */
  private async updateAllocationSpentAmounts(budgetId: string, platform: string, serviceType: ServiceType): Promise<void> {
    const allocation = await this.prisma.budgetAllocation.findFirst({
      where: {
        budgetId,
        platform,
        serviceType
      }
    });

    if (!allocation) return;

    const totalSpent = await this.prisma.costAllocation.aggregate({
      where: {
        budgetId,
        platform,
        serviceType
      },
      _sum: {
        costAmount: true
      }
    });

    const spentAmount = totalSpent._sum.costAmount || 0;

    await this.prisma.budgetAllocation.update({
      where: { id: allocation.id },
      data: {
        spentAmount,
        remainingAmount: allocation.allocatedAmount - spentAmount
      }
    });
  }

  /**
   * Get total spent for a budget
   */
  private async getTotalSpent(budgetId: string): Promise<number> {
    const result = await this.prisma.costAllocation.aggregate({
      where: { budgetId },
      _sum: { costAmount: true }
    });

    return result._sum.costAmount || 0;
  }

  /**
   * Calculate monthly trend
   */
  private async calculateMonthlyTrend(months: number): Promise<{ month: string; totalSpent: number; budgetUtilization: number; }[]> {
    const trends = [];
    const now = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

      const monthlySpend = await this.prisma.costAllocation.aggregate({
        where: {
          costDate: {
            gte: monthStart,
            lte: monthEnd
          }
        },
        _sum: { costAmount: true }
      });

      const monthlyBudgets = await this.prisma.budget.aggregate({
        where: {
          startDate: { lte: monthEnd },
          endDate: { gte: monthStart }
        },
        _sum: { totalAmount: true }
      });

      const totalSpent = monthlySpend._sum.costAmount || 0;
      const totalBudget = monthlyBudgets._sum.totalAmount || 0;
      const budgetUtilization = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

      trends.push({
        month: monthStart.toISOString().slice(0, 7),
        totalSpent,
        budgetUtilization
      });
    }

    return trends;
  }
}