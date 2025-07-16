import { CompositeScorer } from '@/lib/aggregation/composite-scorer';
import { NormalizedMetrics, PlatformData, CreatorTier } from '@/lib/aggregation/types';

describe('Engagement Rate Calculations', () => {
  let scorer: CompositeScorer;

  beforeEach(() => {
    scorer = new CompositeScorer();
  });

  const mockPlatformData: PlatformData[] = [
    {
      platform: 'tiktok',
      posts: Array(10).fill({
        id: '1',
        likes: 100,
        comments: 10,
        shares: 5,
        timestamp: new Date(),
      }),
      lastUpdated: new Date(),
    },
  ];

  describe('scoreEngagement', () => {
    it('should score high engagement rates correctly', () => {
      const mockMetrics: NormalizedMetrics = {
        totalReach: 10000,
        averageEngagementRate: 10,
        contentConsistency: 0.8,
        audienceQuality: {
          overallScore: 80,
          authenticity: 0.9,
          engagement: 0.8,
          demographics: 0.7,
        },
        growthRate: 5,
        contentFrequency: {
          postsPerWeek: 5,
          lastPostDate: new Date(),
        },
        platformDistribution: {
          platformWeights: { tiktok: 1 },
          diversityScore: 0.5,
        },
      };

      const result = scorer.calculateCompositeScore(mockMetrics, mockPlatformData);
      
      expect(result.breakdown.engagement).toBe(25); // Max engagement score
      expect(result.overallScore).toBeGreaterThan(60);
    });

    it('should score medium engagement rates correctly', () => {
      const mockMetrics: NormalizedMetrics = {
        totalReach: 10000,
        averageEngagementRate: 5,
        contentConsistency: 0.6,
        audienceQuality: {
          overallScore: 60,
          authenticity: 0.7,
          engagement: 0.6,
          demographics: 0.5,
        },
        growthRate: 3,
        contentFrequency: {
          postsPerWeek: 3,
          lastPostDate: new Date(),
        },
        platformDistribution: {
          platformWeights: { tiktok: 1 },
          diversityScore: 0.5,
        },
      };

      const result = scorer.calculateCompositeScore(mockMetrics, mockPlatformData);
      
      expect(result.breakdown.engagement).toBe(20);
      expect(result.overallScore).toBeGreaterThan(40);
      expect(result.overallScore).toBeLessThan(80);
    });

    it('should score low engagement rates correctly', () => {
      const mockMetrics: NormalizedMetrics = {
        totalReach: 10000,
        averageEngagementRate: 0.5,
        contentConsistency: 0.4,
        audienceQuality: {
          overallScore: 40,
          authenticity: 0.5,
          engagement: 0.4,
          demographics: 0.3,
        },
        growthRate: 0,
        contentFrequency: {
          postsPerWeek: 1,
          lastPostDate: new Date(),
        },
        platformDistribution: {
          platformWeights: { tiktok: 1 },
          diversityScore: 0.5,
        },
      };

      const result = scorer.calculateCompositeScore(mockMetrics, mockPlatformData);
      
      expect(result.breakdown.engagement).toBe(6);
      expect(result.overallScore).toBeLessThan(50);
    });

    it('should handle zero engagement rate', () => {
      const mockMetrics: NormalizedMetrics = {
        totalReach: 10000,
        averageEngagementRate: 0,
        contentConsistency: 0.2,
        audienceQuality: {
          overallScore: 20,
          authenticity: 0.3,
          engagement: 0.2,
          demographics: 0.1,
        },
        growthRate: -5,
        contentFrequency: {
          postsPerWeek: 0.5,
          lastPostDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
        platformDistribution: {
          platformWeights: { tiktok: 1 },
          diversityScore: 0.5,
        },
      };

      const result = scorer.calculateCompositeScore(mockMetrics, mockPlatformData);
      
      expect(result.breakdown.engagement).toBe(0);
      expect(result.tier).toBe(CreatorTier.EMERGING);
    });
  });

  describe('calculateNicheScore', () => {
    it('should prioritize engagement for niche creators', () => {
      const mockMetrics: NormalizedMetrics = {
        totalReach: 5000, // Small reach
        averageEngagementRate: 8, // High engagement
        contentConsistency: 0.9,
        audienceQuality: {
          overallScore: 85,
          authenticity: 0.9,
          engagement: 0.85,
          demographics: 0.8,
        },
        growthRate: 10,
        contentFrequency: {
          postsPerWeek: 5,
          lastPostDate: new Date(),
        },
        platformDistribution: {
          platformWeights: { tiktok: 1 },
          diversityScore: 0.5,
        },
      };

      const nicheScore = scorer.calculateNicheScore(mockMetrics, 5);
      
      expect(nicheScore).toBeGreaterThan(80);
    });

    it('should penalize large reach for niche scoring', () => {
      const mockMetrics: NormalizedMetrics = {
        totalReach: 500000, // Large reach
        averageEngagementRate: 3,
        contentConsistency: 0.7,
        audienceQuality: {
          overallScore: 70,
          authenticity: 0.7,
          engagement: 0.7,
          demographics: 0.7,
        },
        growthRate: 5,
        contentFrequency: {
          postsPerWeek: 3,
          lastPostDate: new Date(),
        },
        platformDistribution: {
          platformWeights: { tiktok: 1 },
          diversityScore: 0.5,
        },
      };

      const nicheScore = scorer.calculateNicheScore(mockMetrics, 5);
      
      expect(nicheScore).toBeLessThan(70); // Should be penalized for large reach
    });
  });

  describe('Platform-specific engagement calculations', () => {
    it('should handle platform-specific base rates', () => {
      // Test base rates as documented in CLAUDE.md
      const baseRates = {
        instagram: 3.25,
        tiktok: 6.75,
        youtube: 2.45,
        github: 1.25,
      };

      Object.entries(baseRates).forEach(([platform, expectedRate]) => {
        const mockMetrics: NormalizedMetrics = {
          totalReach: 10000,
          averageEngagementRate: expectedRate,
          contentConsistency: 0.8,
          audienceQuality: {
            overallScore: 80,
            authenticity: 0.8,
            engagement: 0.8,
            demographics: 0.8,
          },
          growthRate: 5,
          contentFrequency: {
            postsPerWeek: 5,
            lastPostDate: new Date(),
          },
          platformDistribution: {
            platformWeights: { [platform]: 1 },
            diversityScore: 0.5,
          },
        };

        const result = scorer.calculateCompositeScore(mockMetrics, mockPlatformData);
        
        // Should achieve reasonable scoring for platform-appropriate rates
        expect(result.overallScore).toBeGreaterThan(40);
        expect(result.breakdown.engagement).toBeGreaterThan(10);
      });
    });

    it('should handle follower-based adjustments', () => {
      // Test follower adjustments as documented in CLAUDE.md
      const followerTiers = [
        { count: 50000, adjustment: 1.0 }, // <100K = 100%
        { count: 500000, adjustment: 0.9 }, // >100K = 90%
        { count: 5000000, adjustment: 0.75 }, // >1M = 75%
        { count: 50000000, adjustment: 0.6 }, // >10M = 60%
      ];

      followerTiers.forEach(({ count, adjustment }) => {
        const baseEngagement = 5.0;
        const expectedEngagement = baseEngagement * adjustment;
        
        const mockMetrics: NormalizedMetrics = {
          totalReach: count,
          averageEngagementRate: expectedEngagement,
          contentConsistency: 0.8,
          audienceQuality: {
            overallScore: 80,
            authenticity: 0.8,
            engagement: 0.8,
            demographics: 0.8,
          },
          growthRate: 5,
          contentFrequency: {
            postsPerWeek: 5,
            lastPostDate: new Date(),
          },
          platformDistribution: {
            platformWeights: { tiktok: 1 },
            diversityScore: 0.5,
          },
        };

        const result = scorer.calculateCompositeScore(mockMetrics, mockPlatformData);
        
        // Should achieve consistent scoring across follower tiers
        expect(result.overallScore).toBeGreaterThan(50);
        expect(result.breakdown.engagement).toBeGreaterThan(15);
      });
    });
  });

  describe('Tier determination', () => {
    it('should assign correct tiers based on score and reach', () => {
      const testCases = [
        { score: 90, reach: 500000, expectedTier: CreatorTier.PLATINUM },
        { score: 75, reach: 75000, expectedTier: CreatorTier.GOLD },
        { score: 60, reach: 25000, expectedTier: CreatorTier.SILVER },
        { score: 45, reach: 8000, expectedTier: CreatorTier.BRONZE },
        { score: 30, reach: 1000, expectedTier: CreatorTier.EMERGING },
      ];

      testCases.forEach(({ score, reach, expectedTier }) => {
        const mockMetrics: NormalizedMetrics = {
          totalReach: reach,
          averageEngagementRate: score / 10, // Rough mapping
          contentConsistency: 0.8,
          audienceQuality: {
            overallScore: score,
            authenticity: 0.8,
            engagement: 0.8,
            demographics: 0.8,
          },
          growthRate: 5,
          contentFrequency: {
            postsPerWeek: 5,
            lastPostDate: new Date(),
          },
          platformDistribution: {
            platformWeights: { tiktok: 1 },
            diversityScore: 0.5,
          },
        };

        const result = scorer.calculateCompositeScore(mockMetrics, mockPlatformData);
        
        expect(result.tier).toBe(expectedTier);
      });
    });
  });
});