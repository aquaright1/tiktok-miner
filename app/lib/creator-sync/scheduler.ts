import { PrismaClient } from '@prisma/client';
import { JobPriority } from './types';
import { CreatorSyncService } from './service';
import { logger } from '../logger';

export interface SchedulerOptions {
  checkInterval?: number; // How often to check for scheduled syncs (ms)
  batchSize?: number; // How many creators to schedule at once
}

export class CreatorSyncScheduler {
  private db: PrismaClient;
  private syncService: CreatorSyncService;
  private checkInterval: number;
  private batchSize: number;
  private isRunning: boolean = false;
  private timer?: NodeJS.Timeout;

  constructor(
    db: PrismaClient,
    syncService: CreatorSyncService,
    options: SchedulerOptions = {}
  ) {
    this.db = db;
    this.syncService = syncService;
    this.checkInterval = options.checkInterval || 60000; // 1 minute default
    this.batchSize = options.batchSize || 50;
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Scheduler is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting creator sync scheduler');
    
    // Initial check
    await this.checkAndSchedule();
    
    // Set up recurring checks
    this.timer = setInterval(
      () => this.checkAndSchedule(),
      this.checkInterval
    );
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    logger.info('Stopping creator sync scheduler');
  }

  private async checkAndSchedule(): Promise<void> {
    try {
      logger.debug('Checking for creators to sync');
      
      // Get creators that need syncing
      const creatorsToSync = await this.getCreatorsToSync();
      
      if (creatorsToSync.length === 0) {
        logger.debug('No creators need syncing at this time');
        return;
      }

      logger.info(`Scheduling sync for ${creatorsToSync.length} creators`);

      // Schedule sync jobs
      for (const creator of creatorsToSync) {
        const priority = this.calculatePriority(creator);
        await this.syncService.scheduleCreatorSync(creator.id, priority);
      }
    } catch (error) {
      logger.error('Error in scheduler check cycle:', error);
    }
  }

  private async getCreatorsToSync() {
    const now = new Date();
    
    // Get creators that haven't been synced or are due for sync
    const creators = await this.db.creatorProfile.findMany({
      where: {
        OR: [
          { lastSync: null },
          { 
            lastSync: {
              lt: this.getMinLastSyncTime(),
            },
          },
        ],
      },
      orderBy: [
        { followerCount: 'desc' }, // Prioritize by follower count
        { lastSync: 'asc' }, // Then by oldest sync
      ],
      take: this.batchSize,
    });

    return creators;
  }

  private getMinLastSyncTime(): Date {
    // Get the minimum last sync time based on the longest sync interval (weekly)
    const minTime = new Date();
    minTime.setHours(minTime.getHours() - 168); // 1 week ago
    return minTime;
  }

  private calculatePriority(creator: any): JobPriority {
    const hoursSinceLastSync = creator.lastSync
      ? (Date.now() - creator.lastSync.getTime()) / (1000 * 60 * 60)
      : Infinity;

    // Priority based on follower count and engagement
    if (creator.followerCount > 1000000 || creator.engagementRate > 5) {
      return JobPriority.HIGH; // Hot creators
    } else if (creator.followerCount > 10000 || creator.engagementRate > 2) {
      return JobPriority.NORMAL; // Normal creators
    } else {
      return JobPriority.LOW; // Cold creators
    }
  }

  async initializeCreatorSchedules(): Promise<void> {
    logger.info('Initializing creator sync schedules');
    
    // Get all creators
    const creators = await this.db.creatorProfile.findMany({
      select: {
        id: true,
        followerCount: true,
        engagementRate: true,
        lastSync: true,
      },
    });

    let scheduled = 0;
    for (const creator of creators) {
      const priority = this.calculatePriority(creator);
      
      // Only schedule if not recently synced
      if (this.shouldScheduleSync(creator, priority)) {
        await this.syncService.scheduleCreatorSync(creator.id, priority);
        scheduled++;
      }
    }

    logger.info(`Initialized schedules for ${scheduled} creators`);
  }

  private shouldScheduleSync(creator: any, priority: JobPriority): boolean {
    if (!creator.lastSync) return true;

    const hoursSinceLastSync = 
      (Date.now() - creator.lastSync.getTime()) / (1000 * 60 * 60);

    switch (priority) {
      case JobPriority.HIGH:
        return hoursSinceLastSync >= 4;
      case JobPriority.NORMAL:
        return hoursSinceLastSync >= 24;
      case JobPriority.LOW:
        return hoursSinceLastSync >= 168;
      default:
        return true;
    }
  }
}