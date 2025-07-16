import { v4 as uuidv4 } from 'uuid'
import { prisma } from '@/lib/db'
import { 
  ExportOptions, 
  ExportJob, 
  ExportResult, 
  ExportHandler,
  ExportFormat,
  ExportField
} from './types'
import { CSVExportHandler } from './handlers/csv-handler'
import { JSONExportHandler } from './handlers/json-handler'
import { ExcelExportHandler } from './handlers/excel-handler'

export class ExportService {
  private handlers: Map<ExportFormat, ExportHandler>
  private jobs: Map<string, ExportJob>

  constructor() {
    this.handlers = new Map()
    this.jobs = new Map()
    
    // Register default handlers
    this.registerHandler(new CSVExportHandler())
    this.registerHandler(new JSONExportHandler())
    this.registerHandler(new ExcelExportHandler())
  }

  registerHandler(handler: ExportHandler) {
    this.handlers.set(handler.format, handler)
  }

  async exportCreators(
    creatorIds: string[],
    options: ExportOptions,
    userId?: string
  ): Promise<ExportJob | ExportResult> {
    const jobId = uuidv4()
    
    // For large exports, create a job and process asynchronously
    if (creatorIds.length > 100) {
      const job = this.createJob(jobId, userId || 'anonymous', options.format, creatorIds.length)
      
      // Process in background (in production, this would be a queue job)
      this.processExportJob(jobId, creatorIds, options).catch(error => {
        this.updateJobStatus(jobId, 'failed', { error: error.message })
      })
      
      return job
    }
    
    // For small exports, process immediately
    try {
      const creators = await this.fetchCreatorsWithMetrics(creatorIds, options)
      const handler = this.handlers.get(options.format)
      
      if (!handler) {
        throw new Error(`Unsupported export format: ${options.format}`)
      }
      
      return await handler.export(creators, options.fields)
    } catch (error) {
      throw new Error(`Export failed: ${error.message}`)
    }
  }

  async exportCreatorAnalytics(
    creatorId: string,
    dateRange: { start: Date; end: Date },
    options: ExportOptions
  ): Promise<ExportResult> {
    try {
      const analytics = await this.fetchCreatorAnalytics(creatorId, dateRange)
      const handler = this.handlers.get(options.format)
      
      if (!handler) {
        throw new Error(`Unsupported export format: ${options.format}`)
      }
      
      return await handler.export(analytics, options.fields)
    } catch (error) {
      throw new Error(`Analytics export failed: ${error.message}`)
    }
  }

  async exportSearchResults(
    searchParams: any,
    options: ExportOptions
  ): Promise<ExportResult> {
    try {
      const results = await this.searchCreators(searchParams)
      const handler = this.handlers.get(options.format)
      
      if (!handler) {
        throw new Error(`Unsupported export format: ${options.format}`)
      }
      
      return await handler.export(results, options.fields)
    } catch (error) {
      throw new Error(`Search export failed: ${error.message}`)
    }
  }

  getJob(jobId: string): ExportJob | undefined {
    return this.jobs.get(jobId)
  }

  private createJob(
    jobId: string,
    userId: string,
    format: ExportFormat,
    totalRecords: number
  ): ExportJob {
    const job: ExportJob = {
      id: jobId,
      userId,
      status: 'pending',
      format,
      totalRecords,
      processedRecords: 0,
      progress: 0,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    }
    
    this.jobs.set(jobId, job)
    return job
  }

  private updateJobStatus(
    jobId: string,
    status: ExportJob['status'],
    updates: Partial<ExportJob> = {}
  ) {
    const job = this.jobs.get(jobId)
    if (job) {
      Object.assign(job, { status, ...updates })
      
      if (status === 'completed' || status === 'failed') {
        job.completedAt = new Date()
      }
    }
  }

  private async processExportJob(
    jobId: string,
    creatorIds: string[],
    options: ExportOptions
  ) {
    this.updateJobStatus(jobId, 'processing')
    
    const batchSize = 50
    const batches = []
    
    for (let i = 0; i < creatorIds.length; i += batchSize) {
      batches.push(creatorIds.slice(i, i + batchSize))
    }
    
    const allCreators = []
    let processedRecords = 0
    
    for (const batch of batches) {
      const creators = await this.fetchCreatorsWithMetrics(batch, options)
      allCreators.push(...creators)
      
      processedRecords += batch.length
      const progress = Math.round((processedRecords / creatorIds.length) * 100)
      
      this.updateJobStatus(jobId, 'processing', {
        processedRecords,
        progress
      })
    }
    
    // Generate export
    const handler = this.handlers.get(options.format)
    if (!handler) {
      throw new Error(`Unsupported export format: ${options.format}`)
    }
    
    const result = await handler.export(allCreators, options.fields)
    
    // In production, upload to S3 and generate download URL
    const downloadUrl = await this.uploadExportFile(result)
    
    this.updateJobStatus(jobId, 'completed', {
      downloadUrl,
      processedRecords: creatorIds.length,
      progress: 100
    })
  }

  private async fetchCreatorsWithMetrics(
    creatorIds: string[],
    options: ExportOptions
  ): Promise<any[]> {
    const candidates = await prisma.candidate.findMany({
      where: {
        id: { in: creatorIds },
        candidateType: 'CREATOR'
      },
      include: {
        creatorProfile: true
      }
    })
    
    // Transform to match expected format
    return candidates.map(candidate => {
      const profile = candidate.creatorProfile
      
      return {
        id: candidate.id,
        name: profile?.username || 'Unknown',
        username: profile?.username || '',
        platform: profile?.platform || '',
        followerCount: profile?.followerCount || 0,
        engagementRate: profile?.engagementRate || 0,
        avgLikes: (profile?.metrics as any)?.avgLikes || 0,
        avgComments: (profile?.metrics as any)?.avgComments || 0,
        postFrequency: (profile?.metrics as any)?.postFrequency || 0,
        niche: (profile?.profileData as any)?.niche || '',
        location: '',
        profileUrl: this.buildProfileUrl(profile?.platform || '', profile?.username || ''),
        lastSync: profile?.lastSync || new Date(),
        createdAt: candidate.createdAt
      }
    })
  }

  private async fetchCreatorAnalytics(
    creatorId: string,
    dateRange: { start: Date; end: Date }
  ): Promise<any[]> {
    // In production, this would fetch from TimescaleDB
    // For now, return mock data
    const days = Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24))
    const analytics = []
    
    for (let i = 0; i < days; i++) {
      const date = new Date(dateRange.start.getTime() + i * 24 * 60 * 60 * 1000)
      analytics.push({
        date,
        followers: Math.floor(50000 + Math.random() * 1000),
        engagement: parseFloat((3 + Math.random() * 2).toFixed(2)),
        views: Math.floor(100000 + Math.random() * 50000),
        likes: Math.floor(5000 + Math.random() * 2000),
        comments: Math.floor(500 + Math.random() * 200),
        shares: Math.floor(100 + Math.random() * 50)
      })
    }
    
    return analytics
  }

  private async searchCreators(searchParams: any): Promise<any[]> {
    // Implement search logic
    const candidates = await prisma.candidate.findMany({
      where: {
        candidateType: 'CREATOR',
        // Add search filters based on searchParams
      },
      include: {
        creatorProfile: true
      },
      take: searchParams.limit || 100
    })
    
    return this.transformCandidatesToCreators(candidates)
  }

  private transformCandidatesToCreators(candidates: any[]): any[] {
    return candidates.map(candidate => {
      const profile = candidate.creatorProfile
      
      return {
        id: candidate.id,
        name: profile?.username || 'Unknown',
        username: profile?.username || '',
        platform: profile?.platform || '',
        followerCount: profile?.followerCount || 0,
        engagementRate: profile?.engagementRate || 0,
        niche: (profile?.profileData as any)?.niche || '',
        location: '',
        lastSync: profile?.lastSync || new Date(),
        createdAt: candidate.createdAt
      }
    })
  }

  private buildProfileUrl(platform: string, username: string): string {
    switch (platform.toLowerCase()) {
      case 'youtube':
        return `https://youtube.com/@${username}`
      case 'twitter':
        return `https://twitter.com/${username}`
      case 'instagram':
        return `https://instagram.com/${username}`
      case 'tiktok':
        return `https://tiktok.com/@${username}`
      default:
        return ''
    }
  }

  private async uploadExportFile(result: ExportResult): Promise<string> {
    // In production, upload to S3 or similar service
    // For now, return a mock URL
    return `https://exports.example.com/${uuidv4()}/${result.filename}`
  }
}

// Singleton instance
export const exportService = new ExportService()