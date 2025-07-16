export enum QueueName {
  SCRAPING = 'scraping',
  DISCOVERY = 'discovery',
  CREATOR_SYNC = 'creator-sync',
  WEBHOOK_PROCESSING = 'webhook-processing',
  COST_ALLOCATION = 'cost-allocation',
  DATA_PROCESSING = 'data-processing',
}

export enum JobPriority {
  LOW = 1,
  NORMAL = 5,
  HIGH = 10,
  CRITICAL = 20,
}

export enum JobStatus {
  WAITING = 'waiting',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  FAILED = 'failed',
  DELAYED = 'delayed',
  PAUSED = 'paused',
}

export interface QueueHealth {
  queueName: QueueName;
  status: 'healthy' | 'degraded' | 'unhealthy';
  metrics: QueueMetrics;
  errors: string[];
  lastCheck: Date;
}

export interface QueueMetrics {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
  totalJobs: number;
  avgProcessingTime: number;
  throughput: number;
  lastProcessedAt?: Date;
}

export interface QueueConfig {
  name: QueueName;
  concurrency: number;
  maxRetries: number;
  retryDelay: number;
  removeOnComplete: number;
  removeOnFail: number;
  defaultJobOptions: {
    removeOnComplete: number;
    removeOnFail: number;
    attempts: number;
    backoff: {
      type: 'exponential';
      delay: number;
    };
  };
}

export interface JobData {
  id?: string;
  type: string;
  payload: any;
  priority?: JobPriority;
  delay?: number;
  attempts?: number;
  metadata?: Record<string, any>;
}

export interface QueueWorkerOptions {
  concurrency: number;
  maxRetries: number;
  retryDelay: number;
}