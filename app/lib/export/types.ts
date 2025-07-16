/**
 * Export Service Type Definitions
 */

export type ExportFormat = 'csv' | 'json' | 'excel'

export interface ExportOptions {
  format: ExportFormat
  fields: ExportField[]
  filters?: ExportFilter
  pagination?: {
    page: number
    pageSize: number
  }
}

export interface ExportField {
  key: string
  label: string
  type: 'string' | 'number' | 'date' | 'boolean' | 'array' | 'object'
  formatter?: (value: any) => string
  nested?: string // For accessing nested properties like 'profile.username'
}

export interface ExportFilter {
  platform?: string
  minFollowers?: number
  maxFollowers?: number
  minEngagement?: number
  maxEngagement?: number
  dateRange?: {
    start: Date
    end: Date
  }
}

export interface ExportJob {
  id: string
  userId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  format: ExportFormat
  totalRecords: number
  processedRecords: number
  progress: number
  downloadUrl?: string
  error?: string
  createdAt: Date
  completedAt?: Date
  expiresAt?: Date
}

export interface ExportResult {
  success: boolean
  data?: Buffer | string
  filename: string
  mimeType: string
  error?: string
}

export abstract class ExportHandler {
  abstract format: ExportFormat
  abstract mimeType: string
  abstract fileExtension: string

  abstract export(data: any[], fields: ExportField[]): Promise<ExportResult>
  
  protected extractFieldValue(record: any, field: ExportField): any {
    try {
      let value = record
      
      // Handle nested properties
      if (field.nested) {
        const parts = field.nested.split('.')
        for (const part of parts) {
          value = value?.[part]
        }
      } else {
        value = value[field.key]
      }
      
      // Apply formatter if provided
      if (field.formatter) {
        return field.formatter(value)
      }
      
      // Default formatting based on type
      switch (field.type) {
        case 'date':
          return value ? new Date(value).toISOString() : ''
        case 'boolean':
          return value ? 'Yes' : 'No'
        case 'array':
          return Array.isArray(value) ? value.join(', ') : ''
        case 'object':
          return typeof value === 'object' ? JSON.stringify(value) : ''
        default:
          return value ?? ''
      }
    } catch (error) {
      console.error(`Error extracting field ${field.key}:`, error)
      return ''
    }
  }
}

// Predefined export field configurations
export const CREATOR_EXPORT_FIELDS: ExportField[] = [
  { key: 'id', label: 'ID', type: 'string' },
  { key: 'name', label: 'Name', type: 'string' },
  { key: 'username', label: 'Username', type: 'string' },
  { key: 'platform', label: 'Platform', type: 'string' },
  { key: 'followerCount', label: 'Followers', type: 'number' },
  { key: 'engagementRate', label: 'Engagement Rate (%)', type: 'number' },
  { key: 'avgLikes', label: 'Avg. Likes', type: 'number' },
  { key: 'avgComments', label: 'Avg. Comments', type: 'number' },
  { key: 'postFrequency', label: 'Posts/Week', type: 'number' },
  { key: 'niche', label: 'Niche', type: 'string' },
  { key: 'location', label: 'Location', type: 'string' },
  { key: 'profileUrl', label: 'Profile URL', type: 'string' },
  { key: 'lastSync', label: 'Last Synced', type: 'date' },
  { key: 'createdAt', label: 'Added Date', type: 'date' }
]

export const ANALYTICS_EXPORT_FIELDS: ExportField[] = [
  { key: 'date', label: 'Date', type: 'date' },
  { key: 'followers', label: 'Followers', type: 'number' },
  { key: 'engagement', label: 'Engagement Rate', type: 'number' },
  { key: 'views', label: 'Views', type: 'number' },
  { key: 'likes', label: 'Likes', type: 'number' },
  { key: 'comments', label: 'Comments', type: 'number' },
  { key: 'shares', label: 'Shares', type: 'number' }
]