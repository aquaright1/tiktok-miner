import { ExportService } from '@/lib/export/export-service';
import { ExportFormat, ExportField } from '@/lib/export/types';

jest.mock('@/lib/db', () => ({
  prisma: {
    candidate: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('@/lib/export/handlers/csv-handler', () => ({
  CSVExportHandler: jest.fn().mockImplementation(() => ({
    format: 'csv',
    export: jest.fn().mockResolvedValue({
      filename: 'export.csv',
      data: Buffer.from('id,name,platform\n1,test,tiktok'),
      size: 100,
      recordCount: 1,
    }),
  })),
}));

jest.mock('@/lib/export/handlers/json-handler', () => ({
  JSONExportHandler: jest.fn().mockImplementation(() => ({
    format: 'json',
    export: jest.fn().mockResolvedValue({
      filename: 'export.json',
      data: Buffer.from('[{"id":1,"name":"test","platform":"tiktok"}]'),
      size: 150,
      recordCount: 1,
    }),
  })),
}));

jest.mock('@/lib/export/handlers/excel-handler', () => ({
  ExcelExportHandler: jest.fn().mockImplementation(() => ({
    format: 'excel',
    export: jest.fn().mockResolvedValue({
      filename: 'export.xlsx',
      data: Buffer.from('mock excel data'),
      size: 200,
      recordCount: 1,
    }),
  })),
}));

describe('ExportService', () => {
  let exportService: ExportService;

  beforeEach(() => {
    exportService = new ExportService();
    jest.clearAllMocks();
  });

  describe('exportCreators', () => {
    const mockCandidates = [
      {
        id: '1',
        createdAt: new Date(),
        creatorProfile: {
          username: 'testuser',
          platform: 'tiktok',
          followerCount: 1000,
          engagementRate: 5.5,
          metrics: { avgLikes: 100, avgComments: 10, postFrequency: 5 },
          profileData: { niche: 'tech' },
          lastSync: new Date(),
        },
        githubUser: {
          name: 'Test User',
          location: 'USA',
        },
      },
    ];

    beforeEach(() => {
      const { prisma } = require('@/lib/db');
      prisma.candidate.findMany.mockResolvedValue(mockCandidates);
    });

    it('should export creators in CSV format', async () => {
      const result = await exportService.exportCreators(
        ['1'],
        {
          format: ExportFormat.CSV,
          fields: [ExportField.USERNAME, ExportField.PLATFORM, ExportField.FOLLOWERS],
        }
      );

      expect(result).toHaveProperty('filename');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('recordCount');
      expect((result as any).filename).toBe('export.csv');
    });

    it('should export creators in JSON format', async () => {
      const result = await exportService.exportCreators(
        ['1'],
        {
          format: ExportFormat.JSON,
          fields: [ExportField.USERNAME, ExportField.PLATFORM, ExportField.FOLLOWERS],
        }
      );

      expect(result).toHaveProperty('filename');
      expect(result).toHaveProperty('data');
      expect((result as any).filename).toBe('export.json');
    });

    it('should export creators in Excel format', async () => {
      const result = await exportService.exportCreators(
        ['1'],
        {
          format: ExportFormat.EXCEL,
          fields: [ExportField.USERNAME, ExportField.PLATFORM, ExportField.FOLLOWERS],
        }
      );

      expect(result).toHaveProperty('filename');
      expect(result).toHaveProperty('data');
      expect((result as any).filename).toBe('export.xlsx');
    });

    it('should create a job for large exports', async () => {
      const largeCreatorIds = Array.from({ length: 150 }, (_, i) => `creator-${i}`);
      
      const result = await exportService.exportCreators(
        largeCreatorIds,
        {
          format: ExportFormat.CSV,
          fields: [ExportField.USERNAME, ExportField.PLATFORM],
        }
      );

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('totalRecords');
      expect((result as any).status).toBe('pending');
      expect((result as any).totalRecords).toBe(150);
    });

    it('should handle unsupported export format', async () => {
      await expect(
        exportService.exportCreators(
          ['1'],
          {
            format: 'unsupported' as ExportFormat,
            fields: [ExportField.USERNAME],
          }
        )
      ).rejects.toThrow('Unsupported export format');
    });

    it('should handle database errors gracefully', async () => {
      const { prisma } = require('@/lib/db');
      prisma.candidate.findMany.mockRejectedValue(new Error('Database error'));

      await expect(
        exportService.exportCreators(
          ['1'],
          {
            format: ExportFormat.CSV,
            fields: [ExportField.USERNAME],
          }
        )
      ).rejects.toThrow('Export failed');
    });
  });

  describe('exportCreatorAnalytics', () => {
    it('should export analytics data', async () => {
      const dateRange = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-07'),
      };

      const result = await exportService.exportCreatorAnalytics(
        'creator-1',
        dateRange,
        {
          format: ExportFormat.CSV,
          fields: [ExportField.USERNAME, ExportField.ENGAGEMENT_RATE],
        }
      );

      expect(result).toHaveProperty('filename');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('recordCount');
    });

    it('should handle analytics export errors', async () => {
      const dateRange = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-07'),
      };

      await expect(
        exportService.exportCreatorAnalytics(
          'invalid-creator',
          dateRange,
          {
            format: 'invalid' as ExportFormat,
            fields: [ExportField.USERNAME],
          }
        )
      ).rejects.toThrow('Unsupported export format');
    });
  });

  describe('exportSearchResults', () => {
    beforeEach(() => {
      const { prisma } = require('@/lib/db');
      prisma.candidate.findMany.mockResolvedValue([
        {
          id: '1',
          createdAt: new Date(),
          creatorProfile: {
            username: 'searchuser',
            platform: 'instagram',
            followerCount: 5000,
            engagementRate: 3.2,
            profileData: { niche: 'lifestyle' },
            lastSync: new Date(),
          },
          githubUser: {
            name: 'Search User',
            location: 'Canada',
          },
        },
      ]);
    });

    it('should export search results', async () => {
      const searchParams = {
        platform: 'instagram',
        minFollowers: 1000,
        limit: 50,
      };

      const result = await exportService.exportSearchResults(
        searchParams,
        {
          format: ExportFormat.JSON,
          fields: [ExportField.USERNAME, ExportField.PLATFORM, ExportField.FOLLOWERS],
        }
      );

      expect(result).toHaveProperty('filename');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('recordCount');
    });

    it('should handle search export errors', async () => {
      const { prisma } = require('@/lib/db');
      prisma.candidate.findMany.mockRejectedValue(new Error('Search error'));

      await expect(
        exportService.exportSearchResults(
          { platform: 'tiktok' },
          {
            format: ExportFormat.CSV,
            fields: [ExportField.USERNAME],
          }
        )
      ).rejects.toThrow('Search export failed');
    });
  });

  describe('job management', () => {
    it('should track export jobs', async () => {
      const largeCreatorIds = Array.from({ length: 120 }, (_, i) => `creator-${i}`);
      
      const job = await exportService.exportCreators(
        largeCreatorIds,
        {
          format: ExportFormat.CSV,
          fields: [ExportField.USERNAME],
        }
      );

      const retrievedJob = exportService.getJob((job as any).id);
      
      expect(retrievedJob).toBeDefined();
      expect(retrievedJob?.id).toBe((job as any).id);
      expect(retrievedJob?.status).toBe('pending');
    });

    it('should return undefined for non-existent job', () => {
      const job = exportService.getJob('non-existent-job');
      expect(job).toBeUndefined();
    });
  });

  describe('profile URL building', () => {
    it('should build correct profile URLs', () => {
      const testCases = [
        { platform: 'youtube', username: 'testchannel', expected: 'https://youtube.com/@testchannel' },
        { platform: 'twitter', username: 'testuser', expected: 'https://twitter.com/testuser' },
        { platform: 'instagram', username: 'testgram', expected: 'https://instagram.com/testgram' },
        { platform: 'tiktok', username: 'testtok', expected: 'https://tiktok.com/@testtok' },
        { platform: 'unknown', username: 'test', expected: '' },
      ];

      // Access private method through type assertion
      const service = exportService as any;
      
      testCases.forEach(({ platform, username, expected }) => {
        const result = service.buildProfileUrl(platform, username);
        expect(result).toBe(expected);
      });
    });
  });
});