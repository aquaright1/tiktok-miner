import { PrismaClient } from '@prisma/client';
import { Platform } from '../platform-api/types';
import { DuplicateCheckResult, CreatorDiscoveryData } from './types';
import { logger } from '../logger';

export class DuplicateDetector {
  private db: PrismaClient;
  private cache: Map<string, string> = new Map(); // platform-username -> creatorId

  constructor(db: PrismaClient) {
    this.db = db;
  }

  /**
   * Check if a creator already exists
   */
  async checkDuplicate(
    data: CreatorDiscoveryData
  ): Promise<DuplicateCheckResult> {
    try {
      // Check cache first
      const cacheKey = `${data.platform}-${data.identifier.toLowerCase()}`;
      if (this.cache.has(cacheKey)) {
        return {
          isDuplicate: true,
          existingCreatorId: this.cache.get(cacheKey),
          matchType: 'exact',
          confidence: 1.0,
        };
      }

      // Check exact match
      const exactMatch = await this.findExactMatch(data);
      if (exactMatch) {
        this.cache.set(cacheKey, exactMatch.id);
        return {
          isDuplicate: true,
          existingCreatorId: exactMatch.id,
          matchType: 'exact',
          confidence: 1.0,
        };
      }

      // Check similar creators
      const similarMatch = await this.findSimilarMatch(data);
      if (similarMatch) {
        return {
          isDuplicate: true,
          existingCreatorId: similarMatch.id,
          matchType: 'similar',
          confidence: similarMatch.confidence,
        };
      }

      // Check cross-platform matches
      const crossPlatformMatch = await this.findCrossPlatformMatch(data);
      if (crossPlatformMatch) {
        return {
          isDuplicate: true,
          existingCreatorId: crossPlatformMatch.id,
          matchType: 'cross-platform',
          confidence: crossPlatformMatch.confidence,
        };
      }

      return {
        isDuplicate: false,
        confidence: 1.0,
      };
    } catch (error) {
      logger.error('Duplicate check failed', error);
      // On error, assume not duplicate to avoid blocking discovery
      return {
        isDuplicate: false,
        confidence: 0.5,
      };
    }
  }

  /**
   * Find exact match by platform and username
   */
  private async findExactMatch(
    data: CreatorDiscoveryData
  ): Promise<any | null> {
    // Check main creator profile
    const mainMatch = await this.db.creatorProfile.findFirst({
      where: {
        platform: data.platform,
        username: {
          equals: data.identifier,
          mode: 'insensitive',
        },
      },
    });

    if (mainMatch) {
      return mainMatch;
    }

    // Check platform profiles
    const platformMatch = await this.db.platformProfile.findFirst({
      where: {
        platform: data.platform,
        username: {
          equals: data.identifier,
          mode: 'insensitive',
        },
      },
      include: {
        creatorProfile: true,
      },
    });

    return platformMatch?.creatorProfile || null;
  }

  /**
   * Find similar creators (fuzzy matching)
   */
  private async findSimilarMatch(
    data: CreatorDiscoveryData
  ): Promise<{ id: string; confidence: number } | null> {
    // Normalize username
    const normalized = this.normalizeUsername(data.identifier);
    
    // Search for similar usernames
    const candidates = await this.db.creatorProfile.findMany({
      where: {
        platform: data.platform,
      },
      select: {
        id: true,
        username: true,
      },
    });

    for (const candidate of candidates) {
      const candidateNormalized = this.normalizeUsername(candidate.username);
      const similarity = this.calculateSimilarity(normalized, candidateNormalized);
      
      if (similarity > 0.85) {
        return {
          id: candidate.id,
          confidence: similarity,
        };
      }
    }

    return null;
  }

  /**
   * Find cross-platform matches
   */
  private async findCrossPlatformMatch(
    data: CreatorDiscoveryData
  ): Promise<{ id: string; confidence: number } | null> {
    // Skip if metadata doesn't have enough info
    if (!data.metadata) {
      return null;
    }

    // Look for creators with similar characteristics
    const normalizedUsername = this.normalizeUsername(data.identifier);
    
    // Search across all platforms
    const candidates = await this.db.creatorProfile.findMany({
      where: {
        platform: {
          not: data.platform,
        },
        followerCount: data.metadata.followerCount ? {
          gte: data.metadata.followerCount * 0.7,
          lte: data.metadata.followerCount * 1.3,
        } : undefined,
      },
      include: {
        platformProfiles: true,
      },
    });

    for (const candidate of candidates) {
      // Check username similarity
      const usernameSimilarity = this.calculateSimilarity(
        normalizedUsername,
        this.normalizeUsername(candidate.username)
      );

      // Check if they already have this platform
      const hasPlatform = candidate.platformProfiles?.some(
        p => p.platform === data.platform
      );

      if (usernameSimilarity > 0.7 && !hasPlatform) {
        // Additional checks could include:
        // - Similar bio/description
        // - Similar profile picture (if available)
        // - Similar content type
        
        const confidence = usernameSimilarity * 0.8; // Reduce confidence for cross-platform
        
        if (confidence > 0.6) {
          return {
            id: candidate.id,
            confidence,
          };
        }
      }
    }

    return null;
  }

  /**
   * Normalize username for comparison
   */
  private normalizeUsername(username: string): string {
    return username
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '') // Remove special characters
      .replace(/official$/, '') // Remove common suffixes
      .replace(/^the/, ''); // Remove common prefixes
  }

  /**
   * Calculate string similarity (Levenshtein distance based)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const maxLen = Math.max(str1.length, str2.length);
    if (maxLen === 0) return 1.0;

    const distance = this.levenshteinDistance(str1, str2);
    return 1 - (distance / maxLen);
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Merge duplicate creators
   */
  async mergeDuplicates(
    primaryId: string,
    duplicateId: string
  ): Promise<void> {
    logger.info(`Merging duplicate creator ${duplicateId} into ${primaryId}`);

    try {
      await this.db.$transaction(async (tx) => {
        // Get both creators
        const primary = await tx.creatorProfile.findUnique({
          where: { id: primaryId },
          include: { platformProfiles: true },
        });

        const duplicate = await tx.creatorProfile.findUnique({
          where: { id: duplicateId },
          include: { platformProfiles: true },
        });

        if (!primary || !duplicate) {
          throw new Error('Creator not found');
        }

        // Merge platform profiles
        for (const profile of duplicate.platformProfiles || []) {
          const existingProfile = primary.platformProfiles?.find(
            p => p.platform === profile.platform
          );

          if (!existingProfile) {
            // Move profile to primary creator
            await tx.platformProfile.update({
              where: { id: profile.id },
              data: { creatorProfileId: primaryId },
            });
          }
        }

        // Update primary creator with best data
        await tx.creatorProfile.update({
          where: { id: primaryId },
          data: {
            followerCount: Math.max(primary.followerCount, duplicate.followerCount),
            engagementRate: Math.max(primary.engagementRate || 0, duplicate.engagementRate || 0),
            // Merge other fields as needed
          },
        });

        // Delete duplicate
        await tx.creatorProfile.delete({
          where: { id: duplicateId },
        });
      });

      logger.info(`Successfully merged duplicate ${duplicateId} into ${primaryId}`);
    } catch (error) {
      logger.error(`Failed to merge duplicates`, error);
      throw error;
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    logger.info('Duplicate detector cache cleared');
  }

  /**
   * Batch check for duplicates
   */
  async batchCheckDuplicates(
    creators: CreatorDiscoveryData[]
  ): Promise<Map<string, DuplicateCheckResult>> {
    const results = new Map<string, DuplicateCheckResult>();

    // Pre-load cache with existing creators
    await this.preloadCache(creators.map(c => c.platform));

    // Check each creator
    for (const creator of creators) {
      const key = `${creator.platform}-${creator.identifier}`;
      const result = await this.checkDuplicate(creator);
      results.set(key, result);
    }

    return results;
  }

  /**
   * Preload cache for better performance
   */
  private async preloadCache(platforms: Platform[]): Promise<void> {
    const uniquePlatforms = [...new Set(platforms)];

    for (const platform of uniquePlatforms) {
      const creators = await this.db.creatorProfile.findMany({
        where: { platform },
        select: {
          id: true,
          username: true,
          platform: true,
        },
      });

      for (const creator of creators) {
        const key = `${creator.platform}-${creator.username.toLowerCase()}`;
        this.cache.set(key, creator.id);
      }
    }

    logger.info(`Preloaded ${this.cache.size} creators into cache`);
  }
}