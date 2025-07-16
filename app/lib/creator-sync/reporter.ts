import { PrismaClient } from '@prisma/client';
import { CreatorSyncQueue } from './queue';
import { Platform } from '../platform-api/types';
import { JobStatus, JobType, QueueStats } from './types';
import { logger } from '../logger';

export interface SyncReport {
  timestamp: Date;
  queueStats: QueueStats;
  platformStats: PlatformSyncStats[];
  recentSync: RecentSyncInfo[];
  syncHealth: SyncHealthMetrics;
  errors: ErrorSummary[];
}

export interface PlatformSyncStats {
  platform: Platform;
  totalCreators: number;
  syncedToday: number;
  syncedThisWeek: number;
  needingSync: number;
  avgEngagementRate: number;
  totalFollowers: number;
}

export interface RecentSyncInfo {
  creatorId: string;
  username: string;
  platform: Platform;
  syncedAt: Date;
  followerCount: number;
  engagementRate: number;
  status: 'success' | 'failed';
}

export interface SyncHealthMetrics {
  successRate: number;
  avgSyncTime: number;
  failedSyncs24h: number;
  pendingJobs: number;
  oldestPendingJob?: Date;
}

export interface ErrorSummary {
  platform: Platform;
  errorType: string;
  count: number;
  lastOccurred: Date;
}

export class CreatorSyncReporter {
  private db: PrismaClient;
  private queue: CreatorSyncQueue;

  constructor(db: PrismaClient, queue: CreatorSyncQueue) {
    this.db = db;
    this.queue = queue;
  }

  async generateReport(): Promise<SyncReport> {
    const [
      queueStats,
      platformStats,
      recentSync,
      syncHealth,
      errors,
    ] = await Promise.all([
      this.queue.getStats(),
      this.getPlatformStats(),
      this.getRecentSyncs(),
      this.getSyncHealth(),
      this.getErrorSummary(),
    ]);

    const report: SyncReport = {
      timestamp: new Date(),
      queueStats,
      platformStats,
      recentSync,
      syncHealth,
      errors,
    };

    logger.info('Sync report generated', {
      pendingJobs: queueStats.pending,
      successRate: syncHealth.successRate,
    });

    return report;
  }

  private async getPlatformStats(): Promise<PlatformSyncStats[]> {
    const platforms = Object.values(Platform);
    const stats: PlatformSyncStats[] = [];

    for (const platform of platforms) {
      const now = new Date();
      const todayStart = new Date(now.setHours(0, 0, 0, 0));
      const weekStart = new Date(now.setDate(now.getDate() - 7));

      const [
        totalCreators,
        syncedToday,
        syncedThisWeek,
        needingSync,
        aggregates,
      ] = await Promise.all([
        // Total creators
        this.db.creatorProfile.count({
          where: { platform },
        }),
        // Synced today
        this.db.creatorProfile.count({
          where: {
            platform,
            lastSync: { gte: todayStart },
          },
        }),
        // Synced this week
        this.db.creatorProfile.count({
          where: {
            platform,
            lastSync: { gte: weekStart },
          },
        }),
        // Needing sync (not synced in last 24h for normal priority)
        this.db.creatorProfile.count({
          where: {
            platform,
            OR: [
              { lastSync: null },
              { lastSync: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
            ],
          },
        }),
        // Aggregates
        this.db.creatorProfile.aggregate({
          where: { platform },
          _avg: { engagementRate: true },
          _sum: { followerCount: true },
        }),
      ]);

      stats.push({
        platform,
        totalCreators,
        syncedToday,
        syncedThisWeek,
        needingSync,
        avgEngagementRate: aggregates._avg.engagementRate || 0,
        totalFollowers: aggregates._sum.followerCount || 0,
      });
    }

    return stats;
  }

  private async getRecentSyncs(limit: number = 10): Promise<RecentSyncInfo[]> {
    const recentProfiles = await this.db.creatorProfile.findMany({
      where: {
        lastSync: { not: null },
      },
      orderBy: { lastSync: 'desc' },
      take: limit,
      select: {
        id: true,
        username: true,
        platform: true,
        lastSync: true,
        followerCount: true,
        engagementRate: true,
      },
    });

    return recentProfiles.map(profile => ({
      creatorId: profile.id,
      username: profile.username,
      platform: profile.platform as Platform,
      syncedAt: profile.lastSync!,
      followerCount: profile.followerCount,
      engagementRate: profile.engagementRate,
      status: 'success' as const, // Would need job tracking for accurate status
    }));
  }

  private async getSyncHealth(): Promise<SyncHealthMetrics> {
    const queueStats = this.queue.getStats();
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // This is a simplified version - in production you'd track job history
    const failedSyncs24h = 0; // Would query job history table

    return {
      successRate: queueStats.successRate,
      avgSyncTime: queueStats.avgProcessingTime,
      failedSyncs24h,
      pendingJobs: queueStats.pending,
      oldestPendingJob: undefined, // Would check queue for oldest job
    };
  }

  private async getErrorSummary(): Promise<ErrorSummary[]> {
    // In a production system, you'd store and query error logs
    // This is a placeholder implementation
    return [];
  }

  async generateSummaryText(): Promise<string> {
    const report = await this.generateReport();
    
    const summary = [
      '📊 Creator Sync Report',
      `Generated: ${report.timestamp.toISOString()}`,
      '',
      '🔄 Queue Status:',
      `  • Pending: ${report.queueStats.pending}`,
      `  • Processing: ${report.queueStats.processing}`,
      `  • Completed: ${report.queueStats.completed}`,
      `  • Failed: ${report.queueStats.failed}`,
      `  • Success Rate: ${report.queueStats.successRate.toFixed(1)}%`,
      '',
      '📱 Platform Statistics:',
    ];

    for (const platform of report.platformStats) {
      summary.push(
        `  ${platform.platform}:`,
        `    • Total: ${platform.totalCreators}`,
        `    • Synced Today: ${platform.syncedToday}`,
        `    • Needing Sync: ${platform.needingSync}`,
        `    • Avg Engagement: ${platform.avgEngagementRate.toFixed(2)}%`
      );
    }

    summary.push(
      '',
      '🏥 Sync Health:',
      `  • Success Rate: ${report.syncHealth.successRate.toFixed(1)}%`,
      `  • Avg Sync Time: ${(report.syncHealth.avgSyncTime / 1000).toFixed(1)}s`,
      `  • Pending Jobs: ${report.syncHealth.pendingJobs}`
    );

    if (report.errors.length > 0) {
      summary.push('', '❌ Recent Errors:');
      for (const error of report.errors) {
        summary.push(
          `  • ${error.platform}: ${error.errorType} (${error.count} times)`
        );
      }
    }

    return summary.join('\n');
  }

  async logDailyReport(): Promise<void> {
    const summary = await this.generateSummaryText();
    logger.info('Daily Sync Report\n' + summary);
  }
}