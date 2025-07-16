import { PrismaClient } from '@prisma/client';
import { CreatorSyncService } from './service';
import { CreatorSyncScheduler } from './scheduler';
import { CreatorSyncReporter } from './reporter';
import { Platform } from '../platform-api/types';
import {
  JobType,
  JobPriority,
  JobStatus,
  DiscoveryOptions,
  SyncOptions,
  CreatorSyncResult,
  QueueStats,
} from './types';

export * from './types';
export { CreatorSyncService } from './service';
export { CreatorSyncScheduler } from './scheduler';
export { CreatorSyncReporter } from './reporter';

export interface CreatorSyncSystemOptions {
  db: PrismaClient;
  queueConcurrency?: number;
  schedulerInterval?: number;
  autoStart?: boolean;
}

export class CreatorSyncSystem {
  private service: CreatorSyncService;
  private scheduler: CreatorSyncScheduler;
  private reporter: CreatorSyncReporter;
  private db: PrismaClient;

  constructor(options: CreatorSyncSystemOptions) {
    this.db = options.db;
    
    // Initialize service
    this.service = new CreatorSyncService(this.db);
    
    // Initialize scheduler
    this.scheduler = new CreatorSyncScheduler(
      this.db,
      this.service,
      { checkInterval: options.schedulerInterval }
    );
    
    // Initialize reporter
    this.reporter = new CreatorSyncReporter(
      this.db,
      (this.service as any).queue // Access private queue for reporting
    );

    if (options.autoStart) {
      this.start();
    }
  }

  async start(): Promise<void> {
    await this.service.start();
    await this.scheduler.start();
    await this.scheduler.initializeCreatorSchedules();
  }

  async stop(): Promise<void> {
    await this.scheduler.stop();
    await this.service.stop();
  }

  // Creator discovery
  async discoverCreators(options: DiscoveryOptions): Promise<string> {
    return this.service.discoverCreators(options);
  }

  // Manual sync
  async syncCreator(
    creatorId: string,
    priority: JobPriority = JobPriority.NORMAL
  ): Promise<string> {
    return this.service.syncCreatorProfile(creatorId, priority);
  }

  // Batch sync
  async syncAllCreators(platform?: Platform): Promise<string[]> {
    const creators = await this.db.creatorProfile.findMany({
      where: platform ? { platform } : undefined,
      select: { id: true },
    });

    const jobIds: string[] = [];
    for (const creator of creators) {
      const jobId = await this.service.syncCreatorProfile(
        creator.id,
        JobPriority.LOW
      );
      jobIds.push(jobId);
    }

    return jobIds;
  }

  // Get system status
  async getStatus(): Promise<{
    queueStats: QueueStats;
    isRunning: boolean;
  }> {
    const queueStats = await this.service.getQueueStats();
    return {
      queueStats,
      isRunning: true, // Would track actual state
    };
  }

  // Generate report
  async generateReport() {
    return this.reporter.generateReport();
  }

  // Get report summary
  async getReportSummary(): Promise<string> {
    return this.reporter.generateSummaryText();
  }

  // Clear completed jobs
  async clearCompletedJobs(): Promise<number> {
    return this.service.clearCompletedJobs();
  }
}

// Singleton instance for convenience
let syncSystem: CreatorSyncSystem | null = null;

export function initializeCreatorSync(
  db: PrismaClient,
  options?: Partial<CreatorSyncSystemOptions>
): CreatorSyncSystem {
  if (syncSystem) {
    throw new Error('Creator sync system already initialized');
  }

  syncSystem = new CreatorSyncSystem({
    db,
    queueConcurrency: options?.queueConcurrency || 5,
    schedulerInterval: options?.schedulerInterval || 60000,
    autoStart: options?.autoStart ?? true,
  });

  return syncSystem;
}

export function getCreatorSync(): CreatorSyncSystem {
  if (!syncSystem) {
    throw new Error('Creator sync system not initialized');
  }
  return syncSystem;
}