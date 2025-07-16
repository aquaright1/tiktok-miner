"use server"

import { createClient } from '@/utils/supabase/server'
import { Creator } from "@/lib/types/creator"
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Calculate realistic engagement rates based on platform and follower count
function calculateEngagementRate(platform: string, followerCount: number): number {
  // Base engagement rates by platform (as decimals)
  const baseRates = {
    instagram: 0.0325,  // 3.25%
    tiktok: 0.0675,     // 6.75% (higher engagement)
    youtube: 0.0245,    // 2.45%
    twitter: 0.0155,    // 1.55%
  };

  let baseRate = baseRates[platform.toLowerCase() as keyof typeof baseRates] || 0.025; // Default 2.5%

  // Adjust for follower count (larger accounts typically have lower engagement rates)
  if (followerCount > 10000000) {
    baseRate *= 0.6; // Large accounts: 60% of base rate
  } else if (followerCount > 1000000) {
    baseRate *= 0.75; // Medium-large accounts: 75% of base rate
  } else if (followerCount > 100000) {
    baseRate *= 0.9; // Medium accounts: 90% of base rate
  }
  // Small accounts keep full base rate

  // Add some variation (±20%)
  const variation = (Math.random() - 0.5) * 0.4; // -0.2 to +0.2
  baseRate = baseRate * (1 + variation);

  // Ensure minimum and maximum bounds
  return Math.max(0.005, Math.min(0.15, baseRate)); // Between 0.5% and 15%
}

interface GetCreatorsParams {
  search?: string
  platform?: string
  minFollowers?: number
  maxFollowers?: number
  page?: number
  pageSize?: number
}

export async function getCreators({
  search = "",
  platform,
  minFollowers = 0,
  maxFollowers = 1000000,
  page = 1,
  pageSize = 20
}: GetCreatorsParams) {
  try {
    console.log(`Fetching creators with search: ${search}, platform: ${platform}, minFollowers: ${minFollowers}, maxFollowers: ${maxFollowers}, page: ${page}, pageSize: ${pageSize}`)
    
    const supabase = createClient()
    
    // Query sample_creators table
    let query = supabase
      .from('sample_creators')
      .select('*', { count: 'exact' })
    
    // Add search filter
    if (search) {
      query = query.or(`name.ilike.%${search}%,username.ilike.%${search}%,description.ilike.%${search}%`)
    }
    
    // Add platform filter
    if (platform) {
      query = query.eq('platform', platform)
    }
    
    // Add follower count filters
    if (minFollowers > 0) {
      query = query.gte('total_reach', minFollowers)
    }
    if (maxFollowers < 1000000) {
      query = query.lte('total_reach', maxFollowers)
    }
    
    // Add pagination
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    
    const { data, error, count } = await query
      .range(from, to)
      .order('total_reach', { ascending: false })
    
    if (error) {
      throw error
    }
    
    // Transform data to match Creator interface
    const creators: Creator[] = (data || []).map((creator, index) => {
      const identifiers = creator.platform_identifiers || {}
      
      // Build profile URL based on platform
      let profileUrl = ""
      let username = creator.username
      
      switch (creator.platform) {
        case 'instagram':
          profileUrl = `https://instagram.com/${username}`
          break
        case 'twitter':
          profileUrl = `https://twitter.com/${username}`
          break
        case 'tiktok':
          profileUrl = `https://tiktok.com/@${username}`
          break
        case 'youtube':
          if (identifiers.youtube?.channelId) {
            profileUrl = `https://youtube.com/channel/${identifiers.youtube.channelId}`
          } else {
            profileUrl = `https://youtube.com/@${username}`
          }
          break
        case 'github':
          profileUrl = `https://github.com/${username}`
          break
        default:
          profileUrl = `https://${creator.platform}.com/${username}`
      }

      return {
        id: creator.id.toString(),
        name: creator.name,
        username: creator.username,
        avatarUrl: undefined, // Not available in sample data
        platform: creator.platform,
        followerCount: creator.total_reach,
        engagementRate: calculateEngagementRate(creator.platform, creator.total_reach),
        niche: creator.category,
        location: undefined, // Not available in sample data
        profileUrl,
        lastSync: creator.updated_at ? new Date(creator.updated_at) : new Date(creator.inserted_at),
        metrics: {},
        profileData: creator.platform_identifiers
      }
    })
    
    return {
      creators,
      total: count || 0,
      page,
      pageSize
    }
  } catch (error) {
    console.error("Error fetching creators:", error)
    return {
      creators: [],
      total: 0,
      page,
      pageSize
    }
  }
}

export async function getCreatorById(id: string): Promise<Creator | null> {
  try {
    const supabase = createClient()
    
    const { data: creator, error } = await supabase
      .from('sample_creators')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !creator) {
      console.error("Creator not found:", error)
      return null
    }

    const identifiers = creator.platform_identifiers || {}
    
    // Build profile URL based on platform
    let profileUrl = ""
    let username = creator.username
    
    switch (creator.platform) {
      case 'instagram':
        profileUrl = `https://instagram.com/${username}`
        break
      case 'twitter':
        profileUrl = `https://twitter.com/${username}`
        break
      case 'tiktok':
        profileUrl = `https://tiktok.com/@${username}`
        break
      case 'youtube':
        if (identifiers.youtube?.channelId) {
          profileUrl = `https://youtube.com/channel/${identifiers.youtube.channelId}`
        } else {
          profileUrl = `https://youtube.com/@${username}`
        }
        break
      case 'github':
        profileUrl = `https://github.com/${username}`
        break
      default:
        profileUrl = `https://${creator.platform}.com/${username}`
    }

    // Calculate additional metrics
    const engagementRate = calculateEngagementRate(creator.platform, creator.total_reach || 0)
    const avgLikes = Math.round(creator.total_reach * engagementRate * 0.007)
    const avgComments = Math.round(creator.total_reach * engagementRate * 0.003)
    const postFrequency = 3 // Default post frequency

    return {
      id: creator.id.toString(),
      name: creator.name,
      username: creator.username,
      avatarUrl: undefined, // Not available in sample data
      platform: creator.platform,
      followerCount: creator.total_reach,
      engagementRate,
      niche: creator.category,
      location: undefined, // Not available in sample data
      profileUrl,
      lastSync: creator.updated_at ? new Date(creator.updated_at) : new Date(creator.inserted_at),
      metrics: {},
      profileData: creator.platform_identifiers,
      // Extended fields
      totalFollowers: creator.total_reach,
      avgLikes,
      avgComments,
      postFrequency,
      lastSyncedAt: creator.updated_at ? new Date(creator.updated_at) : new Date(creator.inserted_at),
      isPipelined: false, // Default to false for sample data
      platforms: [creator.platform]
    }
  } catch (error) {
    console.error("Error fetching creator by id:", error)
    return null
  }
}

export async function getCreatorPosts(creatorId: string) {
  try {
    // Get creator profile to find platform identifiers
    const creator = await prisma.creatorProfile.findUnique({
      where: {
        id: creatorId
      }
    })

    if (!creator) {
      throw new Error("Creator not found")
    }

    const posts: any[] = []

    // Fetch Instagram posts if available
    const platformIds = creator.platformIdentifiers as any;
    if (platformIds?.instagram?.username) {
      try {
        const { UnifiedInstagramService } = await import('@/lib/services/instagram-service-factory')
        const instagramService = new UnifiedInstagramService()
        
        const username = platformIds.instagram.username as string
        const mediaResponse = await instagramService.getUserMedia(username, 12) // Get last 12 posts
        
        // Transform Instagram media to our post format
        const instagramPosts = mediaResponse.data.map((media: any) => ({
          id: media.id,
          creatorId,
          platform: "instagram",
          postUrl: media.permalink,
          thumbnailUrl: media.thumbnailUrl || media.mediaUrl,
          caption: media.caption || "",
          likes: media.likeCount,
          comments: media.commentCount,
          shares: 0, // Instagram doesn't provide share count
          mediaType: media.mediaType,
          createdAt: new Date(media.timestamp)
        }))
        
        posts.push(...instagramPosts)
      } catch (error) {
        console.error("Error fetching Instagram posts:", error)
      }
    }

    // TODO: Add other platforms when their scrapers are ready

    // Sort posts by date (newest first)
    posts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

    // If no posts were fetched, return mock data as fallback
    if (posts.length === 0) {
      return [
        {
          id: "mock-1",
          creatorId,
          platform: "instagram",
          postUrl: "https://instagram.com/p/mock1",
          thumbnailUrl: "https://picsum.photos/300/300?random=1",
          caption: "No posts available yet",
          likes: 0,
          comments: 0,
          shares: 0,
          createdAt: new Date()
        }
      ]
    }

    return posts
  } catch (error) {
    console.error("Error fetching creator posts:", error)
    throw new Error("Failed to fetch creator posts")
  }
}

export async function syncCreator(creatorId: string) {
  try {
    // Get creator profile to find platform identifiers
    const creator = await prisma.creatorProfile.findUnique({
      where: {
        id: creatorId
      },
      include: {
        instagramMetrics: true,
        youtubeMetrics: true,
        twitterMetrics: true,
        tiktokMetrics: true,
      }
    })

    if (!creator) {
      throw new Error("Creator not found")
    }

    // Import the Instagram service
    const { UnifiedInstagramService } = await import('@/lib/services/instagram-service-factory')
    const instagramService = new UnifiedInstagramService()
    
    const updatedPlatforms: string[] = []

    // Sync Instagram if username is available
    const platformIds = creator.platformIdentifiers as any;
    if (platformIds?.instagram?.username) {
      try {
        const username = platformIds.instagram.username as string
        const profile = await instagramService.getUserProfile(username)
        
        // Update Instagram metrics
        await prisma.instagramMetrics.upsert({
          where: { creatorProfileId: creator.id },
          create: {
            creatorProfileId: creator.id,
            username: profile.username,
            fullName: profile.name,
            bio: profile.biography,
            followerCount: profile.followerCount,
            followingCount: profile.followingCount,
            mediaCount: profile.mediaCount,
            profilePictureUrl: profile.profilePictureUrl,
            isVerified: profile.isVerified,
            isBusinessAccount: profile.isBusinessAccount,
            businessCategory: profile.businessCategory,
            website: profile.website,
            engagementRate: 0, // Will be calculated from posts
            averageLikes: 0,
            averageComments: 0,
            lastSync: new Date()
          },
          update: {
            fullName: profile.name,
            bio: profile.biography,
            followerCount: profile.followerCount,
            followingCount: profile.followingCount,
            mediaCount: profile.mediaCount,
            profilePictureUrl: profile.profilePictureUrl,
            isVerified: profile.isVerified,
            isBusinessAccount: profile.isBusinessAccount,
            businessCategory: profile.businessCategory,
            website: profile.website,
            lastSync: new Date()
          }
        })

        // Update total reach in creator profile
        await prisma.creatorProfile.update({
          where: { id: creator.id },
          data: {
            totalReach: profile.followerCount,
            profileImageUrl: profile.profilePictureUrl,
            bio: profile.biography,
            isVerified: profile.isVerified
          }
        })

        updatedPlatforms.push('Instagram')
      } catch (error) {
        console.error("Error syncing Instagram:", error)
      }
    }

    // TODO: Add similar sync for other platforms when their Apify scrapers are ready

    // Update last sync time
    await prisma.creatorProfile.update({
      where: {
        id: creatorId
      },
      data: {
        lastSync: new Date(),
        syncStatus: 'COMPLETED'
      }
    })

    return { 
      success: true, 
      message: `Creator sync completed. Updated platforms: ${updatedPlatforms.join(', ') || 'None'}`,
      updatedPlatforms 
    }
  } catch (error) {
    console.error("Error syncing creator:", error)
    
    // Update sync status to failed
    try {
      await prisma.creatorProfile.update({
        where: { id: creatorId },
        data: { syncStatus: 'FAILED' }
      })
    } catch {}
    
    throw new Error("Failed to sync creator")
  }
}


export async function getCreatorRanking(creatorId: string) {
  try {
    const { CreatorRankingService } = await import('@/lib/services/creator-ranking')
    const { CreatorRankingCache } = await import('@/lib/services/creator-ranking-cache')
    
    // Check cache first
    const cachedScore = await CreatorRankingCache.getCachedScore(creatorId)
    if (cachedScore) {
      return cachedScore
    }
    
    // Calculate new score
    const rankingService = new CreatorRankingService()
    const creator = await getCreatorById(creatorId)
    if (!creator) {
      throw new Error("Creator not found")
    }
    
    const scoreBreakdown = rankingService.calculateScore(creator)
    
    // Cache the result
    await CreatorRankingCache.setCachedScore(creatorId, scoreBreakdown)
    
    return scoreBreakdown
  } catch (error) {
    console.error("Error calculating creator ranking:", error)
    throw new Error("Failed to calculate creator ranking")
  }
}

export async function getRankedCreators({
  search = "",
  platform,
  minFollowers = 0,
  maxFollowers = 1000000,
  page = 1,
  pageSize = 20
}: GetCreatorsParams) {
  try {
    const { CreatorRankingService } = await import('@/lib/services/creator-ranking')
    const rankingService = new CreatorRankingService()
    
    // Get creators using existing function
    const result = await getCreators({
      search,
      platform,
      minFollowers,
      maxFollowers,
      page,
      pageSize
    })
    
    // Calculate scores for all creators
    const scores = rankingService.calculateBatchScores(result.creators)
    
    // Add scores to creators and sort by score
    const rankedCreators = result.creators
      .map(creator => ({
        ...creator,
        rankingScore: scores.get(creator.id)?.totalScore || 0,
        scoreBreakdown: scores.get(creator.id)
      }))
      .sort((a, b) => b.rankingScore - a.rankingScore)
    
    return {
      ...result,
      creators: rankedCreators
    }
  } catch (error) {
    console.error("Error fetching ranked creators:", error)
    throw new Error("Failed to fetch ranked creators")
  }
}


export async function getCreatorMetricsHistory(creatorId: string) {
  try {
    // For now, return mock data. In production, this would fetch from TimescaleDB
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    
    // Generate mock data points for the last 30 days
    const dataPoints = []
    let currentFollowers = 50000
    let currentEngagement = 3.5
    
    for (let i = 0; i < 30; i++) {
      const date = new Date(thirtyDaysAgo.getTime() + i * 24 * 60 * 60 * 1000)
      
      // Add some variation to make it realistic
      currentFollowers += Math.floor(Math.random() * 500) - 100
      currentEngagement += (Math.random() * 0.4) - 0.2
      currentEngagement = Math.max(1, Math.min(10, currentEngagement))
      
      dataPoints.push({
        date: date.toISOString(),
        followers: currentFollowers,
        engagement: parseFloat(currentEngagement.toFixed(2)),
        views: Math.floor(currentFollowers * (Math.random() * 2 + 1)),
        likes: Math.floor(currentFollowers * currentEngagement * 0.01 * (Math.random() * 0.3 + 0.7)),
        comments: Math.floor(currentFollowers * currentEngagement * 0.001 * (Math.random() * 0.3 + 0.7))
      })
    }
    
    return {
      daily: dataPoints,
      summary: {
        followerGrowth: {
          absolute: currentFollowers - 50000,
          percentage: ((currentFollowers - 50000) / 50000) * 100
        },
        averageEngagement: currentEngagement,
        totalViews: dataPoints.reduce((sum, dp) => sum + dp.views, 0),
        totalLikes: dataPoints.reduce((sum, dp) => sum + dp.likes, 0),
        totalComments: dataPoints.reduce((sum, dp) => sum + dp.comments, 0)
      }
    }
  } catch (error) {
    console.error("Error fetching creator metrics history:", error)
    return {
      daily: [],
      summary: {
        followerGrowth: { absolute: 0, percentage: 0 },
        averageEngagement: 0,
        totalViews: 0,
        totalLikes: 0,
        totalComments: 0
      }
    }
  }
}


export async function getCreatorVideos(creatorId: string) {
  try {
    // For now, return mock data. In production, this would call YouTube API
    const mockVideos = []
    const titles = [
      'Building My Dream Setup',
      'Day in the Life of a Content Creator',
      'Top 10 Tips for Growing Your Channel',
      'Behind the Scenes: How I Create Content',
      'Q&A: Answering Your Questions',
      'My Biggest Mistakes as a Creator',
      'Equipment Tour 2024',
      'Collaboration with Amazing Creators',
      'Monthly Favorites and Recommendations',
      'The Truth About Content Creation'
    ]

    for (let i = 0; i < 20; i++) {
      const views = Math.floor(Math.random() * 500000) + 10000
      const likes = Math.floor(views * (Math.random() * 0.08 + 0.02))
      const comments = Math.floor(likes * (Math.random() * 0.1 + 0.05))
      
      mockVideos.push({
        id: `video-${i}`,
        title: titles[i % titles.length] + (i >= 10 ? ` Part ${Math.floor(i / 10) + 1}` : ''),
        thumbnail: `https://picsum.photos/320/180?random=${i}`,
        views,
        likes,
        comments,
        duration: Math.floor(Math.random() * 1200) + 180, // 3-20 minutes
        publishedAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
        engagementRate: ((likes + comments) / views * 100),
        url: `https://youtube.com/watch?v=mock${i}`
      })
    }

    return mockVideos.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
  } catch (error) {
    console.error("Error fetching creator videos:", error)
    throw new Error("Failed to fetch creator videos")
  }
}

export async function exportCreators(
  creatorIds: string[],
  format: 'csv' | 'json' | 'excel' = 'csv'
) {
  try {
    const { exportService, CREATOR_EXPORT_FIELDS } = await import('@/lib/export')
    
    const result = await exportService.exportCreators(
      creatorIds,
      {
        format,
        fields: CREATOR_EXPORT_FIELDS
      }
    )
    
    // If it's a direct result (small export)
    if ('success' in result && result.success) {
      return {
        success: true,
        data: result.data,
        filename: result.filename,
        mimeType: result.mimeType
      }
    }
    
    // If it's a job (large export)
    if ('id' in result) {
      return {
        success: true,
        jobId: result.id,
        status: result.status
      }
    }
    
    throw new Error('Export failed')
  } catch (error) {
    console.error("Error exporting creators:", error)
    throw new Error("Failed to export creators")
  }
}

// Removed getCreatorConversionStats function as it relates to hiring