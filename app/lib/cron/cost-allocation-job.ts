import { PrismaClient } from '@prisma/client';
import { CostAllocationService } from '@/lib/services/cost-allocation-service';
import { logger } from '@/lib/logger';

const prisma = new PrismaClient();
const costAllocationService = new CostAllocationService(prisma);

/**
 * Hourly job to allocate recent API costs to budgets
 */
export async function runCostAllocationJob(): Promise<void> {
  const startTime = Date.now();
  
  try {
    logger.info('Starting cost allocation job');

    // Process costs from the last 2 hours to handle any delays
    await costAllocationService.processRecentApiUsage(2);

    const duration = Date.now() - startTime;
    logger.info(`Cost allocation job completed successfully`, { duration });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Cost allocation job failed', { error, duration });
    throw error;
  }
}

/**
 * Daily job to generate optimization recommendations
 */
export async function runOptimizationJob(): Promise<void> {
  const startTime = Date.now();
  
  try {
    logger.info('Starting optimization job');

    // Import CostOptimizer here to avoid circular dependencies
    const { CostOptimizer } = await import('@/lib/services/cost-optimizer');
    const costOptimizer = new CostOptimizer(prisma);

    // Generate optimization recommendations for all platforms
    const report = await costOptimizer.generateOptimizationRecommendations();

    const duration = Date.now() - startTime;
    logger.info(`Optimization job completed successfully`, { 
      duration,
      recommendationsGenerated: report.recommendations.length,
      potentialSavings: report.totalPotentialSavings
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Optimization job failed', { error, duration });
    throw error;
  }
}

/**
 * Weekly job to clean up old data and generate reports
 */
export async function runWeeklyCleanupJob(): Promise<void> {
  const startTime = Date.now();
  
  try {
    logger.info('Starting weekly cleanup job');

    // Clean up old cost forecasts (older than 90 days)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);

    await prisma.costForecast.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate
        }
      }
    });

    // Clean up resolved alerts older than 30 days
    const alertCutoff = new Date();
    alertCutoff.setDate(alertCutoff.getDate() - 30);

    await prisma.budgetAlert.deleteMany({
      where: {
        status: 'RESOLVED',
        resolvedAt: {
          lt: alertCutoff
        }
      }
    });

    // Generate weekly cost allocation stats
    const stats = await costAllocationService.getCostAllocationStats();

    const duration = Date.now() - startTime;
    logger.info(`Weekly cleanup job completed successfully`, { 
      duration,
      totalAllocated: stats.totalAllocated,
      platformsCount: Object.keys(stats.allocationsByPlatform).length
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Weekly cleanup job failed', { error, duration });
    throw error;
  }
}

// Export a function to run all jobs based on schedule
export async function runScheduledJob(jobType: 'cost-allocation' | 'optimization' | 'cleanup'): Promise<void> {
  switch (jobType) {
    case 'cost-allocation':
      await runCostAllocationJob();
      break;
    case 'optimization':
      await runOptimizationJob();
      break;
    case 'cleanup':
      await runWeeklyCleanupJob();
      break;
    default:
      throw new Error(`Unknown job type: ${jobType}`);
  }
}