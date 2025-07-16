import { CreatorSearchService } from '@/lib/services/creator-search';

jest.mock('@/lib/prisma', () => ({
  creator: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
}));

describe('CreatorSearchService', () => {
  let service: CreatorSearchService;

  beforeEach(() => {
    service = new CreatorSearchService();
    jest.clearAllMocks();
  });

  describe('searchCreators', () => {
    const mockCreators = [
      {
        id: 1,
        username: 'testuser1',
        platform: 'tiktok',
        followers: 10000,
        engagementRate: 5.5,
        verified: true,
      },
      {
        id: 2,
        username: 'testuser2',
        platform: 'instagram',
        followers: 20000,
        engagementRate: 4.2,
        verified: false,
      },
    ];

    beforeEach(() => {
      const { creator } = require('@/lib/prisma');
      creator.findMany.mockResolvedValue(mockCreators);
      creator.count.mockResolvedValue(2);
    });

    it('should search creators with basic parameters', async () => {
      const result = await service.searchCreators({
        query: 'test',
        page: 1,
        limit: 10,
      });

      expect(result).toHaveProperty('creators');
      expect(result).toHaveProperty('totalCount');
      expect(result).toHaveProperty('totalPages');
      expect(result.creators).toHaveLength(2);
    });

    it('should filter by platform', async () => {
      await service.searchCreators({
        platforms: ['tiktok'],
        page: 1,
        limit: 10,
      });

      const { creator } = require('@/lib/prisma');
      expect(creator.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            platform: {
              in: ['tiktok'],
            },
          }),
        })
      );
    });

    it('should filter by follower range', async () => {
      await service.searchCreators({
        minFollowers: 1000,
        maxFollowers: 50000,
        page: 1,
        limit: 10,
      });

      const { creator } = require('@/lib/prisma');
      expect(creator.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            followers: {
              gte: 1000,
              lte: 50000,
            },
          }),
        })
      );
    });

    it('should filter by engagement rate', async () => {
      await service.searchCreators({
        minEngagementRate: 2.0,
        maxEngagementRate: 8.0,
        page: 1,
        limit: 10,
      });

      const { creator } = require('@/lib/prisma');
      expect(creator.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            engagementRate: {
              gte: 2.0,
              lte: 8.0,
            },
          }),
        })
      );
    });

    it('should filter by verified status', async () => {
      await service.searchCreators({
        verified: true,
        page: 1,
        limit: 10,
      });

      const { creator } = require('@/lib/prisma');
      expect(creator.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            verified: true,
          }),
        })
      );
    });

    it('should handle text search', async () => {
      await service.searchCreators({
        query: 'fashion',
        page: 1,
        limit: 10,
      });

      const { creator } = require('@/lib/prisma');
      expect(creator.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ username: expect.objectContaining({ contains: 'fashion' }) }),
              expect.objectContaining({ displayName: expect.objectContaining({ contains: 'fashion' }) }),
              expect.objectContaining({ bio: expect.objectContaining({ contains: 'fashion' }) }),
            ]),
          }),
        })
      );
    });

    it('should handle sorting', async () => {
      await service.searchCreators({
        sortBy: 'followers',
        sortOrder: 'desc',
        page: 1,
        limit: 10,
      });

      const { creator } = require('@/lib/prisma');
      expect(creator.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: {
            followers: 'desc',
          },
        })
      );
    });

    it('should handle pagination', async () => {
      await service.searchCreators({
        page: 3,
        limit: 20,
      });

      const { creator } = require('@/lib/prisma');
      expect(creator.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 40, // (3-1) * 20
          take: 20,
        })
      );
    });

    it('should calculate total pages correctly', async () => {
      const { creator } = require('@/lib/prisma');
      creator.count.mockResolvedValue(85);

      const result = await service.searchCreators({
        page: 1,
        limit: 10,
      });

      expect(result.totalPages).toBe(9); // Math.ceil(85 / 10)
    });

    it('should handle database errors', async () => {
      const { creator } = require('@/lib/prisma');
      creator.findMany.mockRejectedValue(new Error('Database error'));

      await expect(service.searchCreators({
        page: 1,
        limit: 10,
      })).rejects.toThrow('Database error');
    });

    it('should handle empty results', async () => {
      const { creator } = require('@/lib/prisma');
      creator.findMany.mockResolvedValue([]);
      creator.count.mockResolvedValue(0);

      const result = await service.searchCreators({
        page: 1,
        limit: 10,
      });

      expect(result.creators).toHaveLength(0);
      expect(result.totalCount).toBe(0);
      expect(result.totalPages).toBe(0);
    });
  });

  describe('getCreatorsByPlatform', () => {
    it('should retrieve creators by platform', async () => {
      const mockCreators = [
        { id: 1, username: 'tiktok_user', platform: 'tiktok' },
        { id: 2, username: 'tiktok_user2', platform: 'tiktok' },
      ];

      const { creator } = require('@/lib/prisma');
      creator.findMany.mockResolvedValue(mockCreators);

      const result = await service.getCreatorsByPlatform('tiktok');

      expect(result).toHaveLength(2);
      expect(creator.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { platform: 'tiktok' },
        })
      );
    });
  });

  describe('getTrendingCreators', () => {
    it('should retrieve trending creators', async () => {
      const mockCreators = [
        { id: 1, username: 'trending1', engagementRate: 8.5 },
        { id: 2, username: 'trending2', engagementRate: 7.8 },
      ];

      const { creator } = require('@/lib/prisma');
      creator.findMany.mockResolvedValue(mockCreators);

      const result = await service.getTrendingCreators();

      expect(result).toHaveLength(2);
      expect(creator.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            engagementRate: { gte: 5.0 },
          }),
          orderBy: { engagementRate: 'desc' },
          take: 20,
        })
      );
    });
  });
});