import { Platform } from '../platform-api/types';

export enum JobType {
  DISCOVER_CREATORS = 'discover_creators',
  SYNC_CREATOR_PROFILE = 'sync_creator_profile',
  SYNC_CREATOR_POSTS = 'sync_creator_posts',
  CALCULATE_ENGAGEMENT = 'calculate_engagement',
}

export enum JobPriority {
  HIGH = 1,    // Hot creators - sync every 4 hours
  NORMAL = 2,  // Normal creators - sync daily
  LOW = 3,     // Cold creators - sync weekly
}

export enum JobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RETRYING = 'retrying',
}

export interface Job {
  id: string;
  type: JobType;
  priority: JobPriority;
  status: JobStatus;
  data: any;
  result?: any;
  error?: string;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  updatedAt: Date;
  scheduledFor?: Date;
  processedAt?: Date;
  completedAt?: Date;
}

export interface DiscoveryOptions {
  platform: Platform;
  hashtags?: string[];
  keywords?: string[];
  minFollowers?: number;
  maxFollowers?: number;
  location?: string;
  limit?: number;
}

export interface SyncOptions {
  creatorId: string;
  includeRecentPosts?: boolean;
  postsLimit?: number;
  forceRefresh?: boolean;
}

export interface CreatorSyncResult {
  creatorId: string;
  platform: Platform;
  username: string;
  followerCount: number;
  engagementRate: number;
  postsAnalyzed: number;
  lastSyncAt: Date;
  profileData: any;
  metrics?: any;
}

export interface SyncSchedule {
  creatorId: string;
  priority: JobPriority;
  lastSyncAt?: Date;
  nextSyncAt: Date;
  syncIntervalHours: number;
}

export interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  avgProcessingTime: number;
  successRate: number;
}