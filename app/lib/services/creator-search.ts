import { prisma } from '@/lib/prisma';
import { Prisma, CreatorProfile } from '@prisma/client';

export interface SearchOptions {
  query: string;
  filters?: {
    platform?: string;
    category?: string;
    tags?: string[];
    minFollowers?: number;
    maxFollowers?: number;
    minEngagement?: number;
    maxEngagement?: number;
    verified?: boolean;
  };
  sort?: {
    by: 'relevance' | 'followers' | 'engagement' | 'recent';
    order: 'asc' | 'desc';
  };
  pagination?: {
    page: number;
    limit: number;
  };
  searchType?: 'fulltext' | 'fuzzy' | 'combined';
}

export interface SearchResult {
  creators: any[];
  total: number;
  facets: {
    categories: Array<{ value: string; count: number }>;
    platforms: Array<{ value: string; count: number }>;
    tags: Array<{ value: string; count: number }>;
  };
  suggestions: string[];
}

export class CreatorSearchService {
  /**
   * Perform a comprehensive search on creators
   */
  async search(options: SearchOptions): Promise<SearchResult> {
    const { 
      query, 
      filters = {}, 
      sort = { by: 'relevance', order: 'desc' },
      pagination = { page: 1, limit: 20 },
      searchType = 'combined'
    } = options;

    // Build base where clause
    const where = this.buildWhereClause(query, filters);

    // Perform search based on type
    let creatorIds: string[] = [];
    
    if (query && searchType !== 'fuzzy') {
      // Full-text search
      const fullTextResults = await prisma.$queryRaw<Array<{ id: string; rank: number }>>`
        SELECT id, rank FROM search_creators(${query}, ${pagination.limit * 2})
      `;
      creatorIds = fullTextResults.map(r => r.id);
    }

    if (query && (searchType === 'fuzzy' || searchType === 'combined')) {
      // Fuzzy search
      const fuzzyResults = await prisma.$queryRaw<Array<{ id: string; similarity: number }>>`
        SELECT id, similarity FROM fuzzy_search_creators(${query}, 0.3, ${pagination.limit * 2})
      `;
      
      // Combine with full-text results if combined search
      if (searchType === 'combined') {
        const fuzzyIds = fuzzyResults.map(r => r.id);
        // Merge results, prioritizing full-text matches
        creatorIds = [...new Set([...creatorIds, ...fuzzyIds])];
      } else {
        creatorIds = fuzzyResults.map(r => r.id);
      }
    }

    // If we have search results, add them to the where clause
    if (creatorIds.length > 0 && query) {
      where.id = { in: creatorIds };
    }

    // Get total count
    const total = await prisma.creatorProfile.count({ where });

    // Get paginated results
    const creators = await prisma.creatorProfile.findMany({
      where,
      include: {
        youtubeMetrics: true,
        twitterMetrics: true,
        instagramMetrics: true,
        tiktokMetrics: true,
        linkedinMetrics: true
      },
      orderBy: this.buildOrderBy(sort, creatorIds),
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit
    });

    // Get facets
    const facets = await this.getFacets(where);

    // Get search suggestions
    const suggestions = await this.getSearchSuggestions(query);

    return {
      creators: this.transformCreators(creators),
      total,
      facets,
      suggestions
    };
  }

  /**
   * Build where clause for Prisma query
   */
  private buildWhereClause(query: string, filters: any): Prisma.CreatorProfileWhereInput {
    const where: Prisma.CreatorProfileWhereInput = {};

    // Basic text search (fallback if full-text search returns no results)
    if (query && !filters.useFullTextOnly) {
      where.OR = [
        { name: { contains: query, mode: 'insensitive' } },
        { bio: { contains: query, mode: 'insensitive' } },
        { tags: { hasSome: [query] } }
      ];
    }

    // Category filter
    if (filters.category) {
      where.category = filters.category;
    }

    // Tags filter
    if (filters.tags && filters.tags.length > 0) {
      where.tags = { hasSome: filters.tags };
    }

    // Verified filter
    if (filters.verified !== undefined) {
      where.isVerified = filters.verified;
    }

    // Engagement filter
    if (filters.minEngagement !== undefined || filters.maxEngagement !== undefined) {
      where.compositeEngagementScore = {
        gte: filters.minEngagement,
        lte: filters.maxEngagement
      };
    }

    // Followers filter
    if (filters.minFollowers !== undefined || filters.maxFollowers !== undefined) {
      where.totalReach = {
        gte: filters.minFollowers,
        lte: filters.maxFollowers
      };
    }

    // Platform filter
    if (filters.platform) {
      switch (filters.platform.toLowerCase()) {
        case 'youtube':
          where.youtubeMetrics = { isNot: null };
          break;
        case 'twitter':
          where.twitterMetrics = { isNot: null };
          break;
        case 'instagram':
          where.instagramMetrics = { isNot: null };
          break;
        case 'tiktok':
          where.tiktokMetrics = { isNot: null };
          break;
        case 'linkedin':
          where.linkedinMetrics = { isNot: null };
          break;
      }
    }

    return where;
  }

  /**
   * Build order by clause
   */
  private buildOrderBy(
    sort: { by: string; order: 'asc' | 'desc' },
    searchResultIds: string[]
  ): Prisma.CreatorProfileOrderByWithRelationInput {
    // If we have search results and sorting by relevance, maintain search order
    if (sort.by === 'relevance' && searchResultIds.length > 0) {
      // Prisma doesn't support custom ordering directly, so we'll handle this in post-processing
      return { updatedAt: 'desc' };
    }

    switch (sort.by) {
      case 'followers':
        return { totalReach: sort.order };
      case 'engagement':
        return { compositeEngagementScore: sort.order };
      case 'recent':
        return { updatedAt: sort.order };
      default:
        return { updatedAt: 'desc' };
    }
  }

  /**
   * Get facets for search results
   */
  private async getFacets(where: Prisma.CreatorProfileWhereInput) {
    // Get category facets
    const categoryFacets = await prisma.creatorProfile.groupBy({
      by: ['category'],
      where: {
        ...where,
        category: { not: null }
      },
      _count: true
    });

    // Get platform facets
    const [youtube, twitter, instagram, tiktok, linkedin] = await Promise.all([
      prisma.creatorProfile.count({ where: { ...where, youtubeMetrics: { isNot: null } } }),
      prisma.creatorProfile.count({ where: { ...where, twitterMetrics: { isNot: null } } }),
      prisma.creatorProfile.count({ where: { ...where, instagramMetrics: { isNot: null } } }),
      prisma.creatorProfile.count({ where: { ...where, tiktokMetrics: { isNot: null } } }),
      prisma.creatorProfile.count({ where: { ...where, linkedinMetrics: { isNot: null } } })
    ]);

    // Get top tags
    const creators = await prisma.creatorProfile.findMany({
      where,
      select: { tags: true },
      take: 1000
    });

    const tagCounts = creators
      .flatMap(c => c.tags)
      .reduce((acc, tag) => {
        acc[tag] = (acc[tag] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    const topTags = Object.entries(tagCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20)
      .map(([value, count]) => ({ value, count }));

    return {
      categories: categoryFacets
        .filter(c => c.category)
        .map(c => ({ value: c.category!, count: c._count }))
        .sort((a, b) => b.count - a.count),
      platforms: [
        { value: 'youtube', count: youtube },
        { value: 'twitter', count: twitter },
        { value: 'instagram', count: instagram },
        { value: 'tiktok', count: tiktok },
        { value: 'linkedin', count: linkedin }
      ].filter(p => p.count > 0),
      tags: topTags
    };
  }

  /**
   * Get search suggestions
   */
  private async getSearchSuggestions(query: string): Promise<string[]> {
    if (!query || query.length < 2) {
      return [];
    }

    // Get popular terms that match the query
    const suggestions = await prisma.$queryRaw<Array<{ term: string }>>`
      SELECT term 
      FROM popular_search_terms
      WHERE term ILIKE ${`%${query}%`}
      ORDER BY usage_count DESC
      LIMIT 10
    `;

    return suggestions.map(s => s.term);
  }

  /**
   * Transform creators for response
   */
  private transformCreators(creators: any[]): any[] {
    return creators.map(creator => ({
      id: creator.id,
      name: creator.name,
      bio: creator.bio,
      profileImageUrl: creator.profileImageUrl,
      category: creator.category,
      tags: creator.tags,
      isVerified: creator.isVerified,
      metrics: {
        totalReach: creator.totalReach,
        engagementScore: creator.compositeEngagementScore,
        engagementRate: creator.averageEngagementRate,
        contentFrequency: creator.contentFrequency,
        audienceQuality: creator.audienceQualityScore
      },
      platforms: this.extractPlatformData(creator),
      lastSync: creator.lastSync,
      syncStatus: creator.syncStatus
    }));
  }

  /**
   * Extract platform data from creator
   */
  private extractPlatformData(creator: any) {
    const platforms: any = {};

    if (creator.youtubeMetrics) {
      platforms.youtube = {
        subscribers: creator.youtubeMetrics.subscriberCount,
        videos: creator.youtubeMetrics.videoCount,
        views: creator.youtubeMetrics.viewCount?.toString(),
        engagement: creator.youtubeMetrics.engagementRate
      };
    }

    if (creator.twitterMetrics) {
      platforms.twitter = {
        followers: creator.twitterMetrics.followerCount,
        tweets: creator.twitterMetrics.tweetCount,
        engagement: creator.twitterMetrics.engagementRate,
        verified: creator.twitterMetrics.isVerified
      };
    }

    if (creator.instagramMetrics) {
      platforms.instagram = {
        followers: creator.instagramMetrics.followerCount,
        posts: creator.instagramMetrics.mediaCount,
        engagement: creator.instagramMetrics.engagementRate,
        verified: creator.instagramMetrics.isVerified
      };
    }

    if (creator.tiktokMetrics) {
      platforms.tiktok = {
        followers: creator.tiktokMetrics.followerCount,
        videos: creator.tiktokMetrics.videoCount,
        likes: creator.tiktokMetrics.heartCount?.toString(),
        engagement: creator.tiktokMetrics.engagementRate
      };
    }

    if (creator.linkedinMetrics) {
      platforms.linkedin = {
        followers: creator.linkedinMetrics.followerCount,
        connections: creator.linkedinMetrics.connectionCount,
        posts: creator.linkedinMetrics.postCount,
        engagement: creator.linkedinMetrics.engagementRate
      };
    }

    return platforms;
  }

  /**
   * Refresh search indexes
   */
  async refreshSearchIndexes(): Promise<void> {
    await prisma.$executeRaw`SELECT refresh_search_indexes()`;
  }
}