import { GET, POST } from '@/app/api/creators/route';
import { NextRequest } from 'next/server';

jest.mock('@/lib/prisma', () => ({
  creator: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
}));

describe('/api/creators', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/creators', () => {
    it('should return creators list', async () => {
      const mockCreators = [
        {
          id: 1,
          username: 'testuser',
          platform: 'tiktok',
          followers: 1000,
          engagementRate: 5.5,
        },
      ];

      const { creator } = require('@/lib/prisma');
      creator.findMany.mockResolvedValue(mockCreators);
      creator.count.mockResolvedValue(1);

      const request = new NextRequest('http://localhost:3000/api/creators');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('creators');
      expect(data).toHaveProperty('totalCount');
      expect(data.creators).toEqual(mockCreators);
    });

    it('should handle platform filtering', async () => {
      const request = new NextRequest('http://localhost:3000/api/creators?platform=tiktok');
      const response = await GET(request);

      const { creator } = require('@/lib/prisma');
      expect(creator.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            platform: 'tiktok',
          }),
        })
      );
    });

    it('should handle pagination', async () => {
      const request = new NextRequest('http://localhost:3000/api/creators?page=2&limit=10');
      const response = await GET(request);

      const { creator } = require('@/lib/prisma');
      expect(creator.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        })
      );
    });
  });

  describe('POST /api/creators', () => {
    it('should handle search requests', async () => {
      const searchBody = {
        platforms: ['tiktok'],
        minFollowers: 1000,
        maxFollowers: 100000,
      };

      const request = new NextRequest('http://localhost:3000/api/creators', {
        method: 'POST',
        body: JSON.stringify(searchBody),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
    });

    it('should handle invalid search parameters', async () => {
      const invalidBody = {
        minFollowers: 'invalid',
      };

      const request = new NextRequest('http://localhost:3000/api/creators', {
        method: 'POST',
        body: JSON.stringify(invalidBody),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });
  });
});