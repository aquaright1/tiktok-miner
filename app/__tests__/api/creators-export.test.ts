import { GET } from '@/app/api/creators/export/route';
import { NextRequest } from 'next/server';

jest.mock('@/lib/prisma', () => ({
  creator: {
    findMany: jest.fn(),
  },
}));

describe('/api/creators/export', () => {
  const mockCreators = [
    {
      id: 1,
      username: 'testuser1',
      platform: 'tiktok',
      followers: 10000,
      engagementRate: 5.5,
      verified: true,
      displayName: 'Test User 1',
      bio: 'Test bio 1',
      location: 'Test Location 1',
      createdAt: new Date('2023-01-01'),
      updatedAt: new Date('2023-01-01'),
    },
    {
      id: 2,
      username: 'testuser2',
      platform: 'instagram',
      followers: 20000,
      engagementRate: 4.2,
      verified: false,
      displayName: 'Test User 2',
      bio: 'Test bio 2',
      location: 'Test Location 2',
      createdAt: new Date('2023-01-02'),
      updatedAt: new Date('2023-01-02'),
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    const { creator } = require('@/lib/prisma');
    creator.findMany.mockResolvedValue(mockCreators);
  });

  it('should export creators as CSV', async () => {
    const request = new NextRequest('http://localhost:3000/api/creators/export?format=csv');
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/csv');
    expect(response.headers.get('content-disposition')).toContain('attachment; filename=creators-');

    const csvContent = await response.text();
    expect(csvContent).toContain('username,platform,followers,engagementRate');
    expect(csvContent).toContain('testuser1,tiktok,10000,5.5');
    expect(csvContent).toContain('testuser2,instagram,20000,4.2');
  });

  it('should export creators as JSON', async () => {
    const request = new NextRequest('http://localhost:3000/api/creators/export?format=json');
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/json');
    expect(response.headers.get('content-disposition')).toContain('attachment; filename=creators-');

    const jsonContent = await response.json();
    expect(jsonContent).toHaveLength(2);
    expect(jsonContent[0]).toMatchObject({
      username: 'testuser1',
      platform: 'tiktok',
      followers: 10000,
      engagementRate: 5.5,
    });
  });

  it('should handle platform filtering in export', async () => {
    const request = new NextRequest('http://localhost:3000/api/creators/export?format=csv&platform=tiktok');
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

  it('should handle date range filtering in export', async () => {
    const request = new NextRequest('http://localhost:3000/api/creators/export?format=csv&startDate=2023-01-01&endDate=2023-01-31');
    const response = await GET(request);

    const { creator } = require('@/lib/prisma');
    expect(creator.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: expect.objectContaining({
            gte: expect.any(Date),
            lte: expect.any(Date),
          }),
        }),
      })
    );
  });

  it('should handle invalid format parameter', async () => {
    const request = new NextRequest('http://localhost:3000/api/creators/export?format=invalid');
    const response = await GET(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toHaveProperty('error');
  });

  it('should handle database errors', async () => {
    const { creator } = require('@/lib/prisma');
    creator.findMany.mockRejectedValue(new Error('Database error'));

    const request = new NextRequest('http://localhost:3000/api/creators/export?format=csv');
    const response = await GET(request);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data).toHaveProperty('error');
  });

  it('should handle empty results', async () => {
    const { creator } = require('@/lib/prisma');
    creator.findMany.mockResolvedValue([]);

    const request = new NextRequest('http://localhost:3000/api/creators/export?format=csv');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const csvContent = await response.text();
    expect(csvContent).toContain('username,platform,followers,engagementRate');
    expect(csvContent.split('\n')).toHaveLength(2); // Header + empty line
  });
});