export interface Creator {
  id: string
  name: string
  username: string
  avatarUrl?: string
  platform: string
  followerCount: number
  engagementRate: number
  niche?: string
  location?: string
  profileUrl: string
  lastSync: Date
  metrics?: any
  profileData?: any
  // Extended fields for detail view
  totalFollowers?: number
  avgLikes?: number
  avgComments?: number
  postFrequency?: number
  lastSyncedAt?: Date
  isPipelined?: boolean
  platforms?: string[]
  // Additional fields
  bio?: string
  tags?: string[]
  category?: string
  totalHearts?: number
  postCount?: number
  videoCount?: number
  following?: number
  followingCount?: number
  avgLikesPerPost?: number
  avgLikesPerVideo?: number
  isVerified?: boolean
}

export interface CreatorPost {
  id: string
  creatorId: string
  platform: string
  postUrl: string
  thumbnailUrl?: string
  caption?: string
  likes: number
  comments: number
  shares?: number
  createdAt: Date
}