import { 
  PlatformData, 
  ContentTheme, 
  CreatorInsights,
  MonetaryValue 
} from './types';
import { Platform, Post } from '../platform-api/types';
import { logger } from '../logger';

export class ContentAnalyzer {
  private commonThemes = [
    'lifestyle', 'fashion', 'beauty', 'fitness', 'food', 'travel',
    'tech', 'gaming', 'education', 'business', 'entertainment',
    'music', 'art', 'photography', 'sports', 'parenting', 'pets',
    'diy', 'home', 'automotive', 'finance', 'health', 'wellness'
  ];

  analyzeContent(platformsData: PlatformData[]): {
    themes: ContentTheme[];
    insights: Partial<CreatorInsights>;
  } {
    const allPosts = platformsData.flatMap(data => 
      data.posts.map(post => ({ ...post, platform: data.platform }))
    );

    const themes = this.extractContentThemes(allPosts);
    const strongestPlatform = this.identifyStrongestPlatform(platformsData);
    const audienceOverlap = this.estimateAudienceOverlap(platformsData);
    const recommendations = this.generateRecommendations(platformsData, themes);
    const monetaryValue = this.estimateMonetaryValue(platformsData);

    return {
      themes,
      insights: {
        strongestPlatform,
        contentThemes: themes.slice(0, 5).map(t => t.theme),
        audienceOverlap,
        recommendedActions: recommendations,
        estimatedValue: monetaryValue,
      },
    };
  }

  private extractContentThemes(posts: Array<Post & { platform: Platform }>): ContentTheme[] {
    const themeMap = new Map<string, ContentTheme>();

    for (const post of posts) {
      const detectedThemes = this.detectPostThemes(post);
      
      for (const theme of detectedThemes) {
        const existing = themeMap.get(theme) || {
          theme,
          frequency: 0,
          engagement: 0,
          platforms: [],
        };

        existing.frequency++;
        existing.engagement += post.engagementRate || 0;
        
        if (!existing.platforms.includes(post.platform)) {
          existing.platforms.push(post.platform);
        }

        themeMap.set(theme, existing);
      }
    }

    // Calculate average engagement per theme
    const themes = Array.from(themeMap.values()).map(theme => ({
      ...theme,
      engagement: theme.frequency > 0 ? theme.engagement / theme.frequency : 0,
    }));

    // Sort by frequency and engagement
    return themes.sort((a, b) => {
      const scoreA = a.frequency * 0.6 + a.engagement * 0.4;
      const scoreB = b.frequency * 0.6 + b.engagement * 0.4;
      return scoreB - scoreA;
    });
  }

  private detectPostThemes(post: Post): string[] {
    const themes: string[] = [];
    const content = (post.content || '').toLowerCase();
    const hashtags = (post.hashtags || []).map(h => h.toLowerCase());

    // Check content and hashtags for theme keywords
    for (const theme of this.commonThemes) {
      if (
        content.includes(theme) ||
        hashtags.some(tag => tag.includes(theme))
      ) {
        themes.push(theme);
      }
    }

    // Special theme detection based on patterns
    if (this.detectFitnessContent(content, hashtags)) themes.push('fitness');
    if (this.detectFashionContent(content, hashtags)) themes.push('fashion');
    if (this.detectFoodContent(content, hashtags)) themes.push('food');
    if (this.detectTechContent(content, hashtags)) themes.push('tech');
    if (this.detectTravelContent(content, hashtags)) themes.push('travel');

    // Remove duplicates
    return [...new Set(themes)];
  }

  private detectFitnessContent(content: string, hashtags: string[]): boolean {
    const fitnessKeywords = ['workout', 'gym', 'exercise', 'training', 'muscle', 'cardio', 'yoga', 'pilates'];
    return fitnessKeywords.some(keyword => 
      content.includes(keyword) || hashtags.some(tag => tag.includes(keyword))
    );
  }

  private detectFashionContent(content: string, hashtags: string[]): boolean {
    const fashionKeywords = ['outfit', 'style', 'wear', 'dress', 'clothes', 'ootd', 'fashion', 'designer'];
    return fashionKeywords.some(keyword => 
      content.includes(keyword) || hashtags.some(tag => tag.includes(keyword))
    );
  }

  private detectFoodContent(content: string, hashtags: string[]): boolean {
    const foodKeywords = ['recipe', 'cooking', 'food', 'meal', 'restaurant', 'chef', 'delicious', 'foodie'];
    return foodKeywords.some(keyword => 
      content.includes(keyword) || hashtags.some(tag => tag.includes(keyword))
    );
  }

  private detectTechContent(content: string, hashtags: string[]): boolean {
    const techKeywords = ['tech', 'software', 'app', 'code', 'programming', 'ai', 'gadget', 'device'];
    return techKeywords.some(keyword => 
      content.includes(keyword) || hashtags.some(tag => tag.includes(keyword))
    );
  }

  private detectTravelContent(content: string, hashtags: string[]): boolean {
    const travelKeywords = ['travel', 'trip', 'vacation', 'explore', 'destination', 'journey', 'wanderlust'];
    return travelKeywords.some(keyword => 
      content.includes(keyword) || hashtags.some(tag => tag.includes(keyword))
    );
  }

  private identifyStrongestPlatform(platformsData: PlatformData[]): Platform {
    let strongestPlatform = platformsData[0].platform;
    let highestScore = 0;

    for (const data of platformsData) {
      // Score based on engagement rate and follower count
      const score = data.metrics.averageEngagementRate * 
        Math.log10(data.profile.followerCount + 1);

      if (score > highestScore) {
        highestScore = score;
        strongestPlatform = data.platform;
      }
    }

    return strongestPlatform;
  }

  private estimateAudienceOverlap(platformsData: PlatformData[]): number {
    if (platformsData.length < 2) return 0;

    // Estimate based on username similarity and cross-mentions
    const usernames = platformsData.map(d => d.profile.username.toLowerCase());
    const sameUsername = usernames.every(u => u === usernames[0]);

    let baseOverlap = sameUsername ? 30 : 15;

    // Check for cross-platform mentions
    let crossMentions = 0;
    for (const data of platformsData) {
      const mentions = data.posts.flatMap(p => p.mentions || []).map(m => m.toLowerCase());
      const otherUsernames = usernames.filter(u => u !== data.profile.username.toLowerCase());
      
      crossMentions += mentions.filter(m => 
        otherUsernames.some(u => m.includes(u))
      ).length;
    }

    // Increase overlap based on cross-mentions
    const mentionBonus = Math.min(20, crossMentions * 2);
    
    // Consider posting time correlation
    const timeCorrelation = this.calculatePostingTimeCorrelation(platformsData);
    const timeBonus = timeCorrelation * 30;

    return Math.min(80, baseOverlap + mentionBonus + timeBonus);
  }

  private calculatePostingTimeCorrelation(platformsData: PlatformData[]): number {
    const postTimes = platformsData.map(data => 
      data.posts.map(p => p.createdAt.getTime())
    );

    if (postTimes.length < 2) return 0;

    // Simple correlation: check if posts happen within same time windows
    let correlatedPosts = 0;
    let totalComparisons = 0;
    const timeWindow = 3 * 60 * 60 * 1000; // 3 hours

    for (let i = 0; i < postTimes.length - 1; i++) {
      for (let j = i + 1; j < postTimes.length; j++) {
        for (const time1 of postTimes[i]) {
          for (const time2 of postTimes[j]) {
            if (Math.abs(time1 - time2) < timeWindow) {
              correlatedPosts++;
            }
            totalComparisons++;
          }
        }
      }
    }

    return totalComparisons > 0 ? correlatedPosts / totalComparisons : 0;
  }

  private generateRecommendations(
    platformsData: PlatformData[],
    themes: ContentTheme[]
  ): string[] {
    const recommendations: string[] = [];

    // Platform-specific recommendations
    const platforms = platformsData.map(d => d.platform);
    if (!platforms.includes(Platform.TIKTOK)) {
      recommendations.push('Consider expanding to TikTok for younger audience reach');
    }
    if (!platforms.includes(Platform.TWITTER)) {
      recommendations.push('Add Twitter presence for real-time engagement and news sharing');
    }

    // Engagement recommendations
    const avgEngagement = platformsData.reduce(
      (sum, d) => sum + d.metrics.averageEngagementRate,
      0
    ) / platformsData.length;

    if (avgEngagement < 2) {
      recommendations.push('Focus on increasing engagement through interactive content and consistent posting');
    }

    // Content frequency recommendations
    const totalPosts = platformsData.reduce((sum, d) => sum + d.posts.length, 0);
    const avgPostsPerPlatform = totalPosts / platformsData.length;
    
    if (avgPostsPerPlatform < 10) {
      recommendations.push('Increase posting frequency to maintain audience interest');
    }

    // Theme consistency recommendations
    if (themes.length > 0 && themes[0].frequency < totalPosts * 0.3) {
      recommendations.push('Develop more focused content strategy around top-performing themes');
    }

    // Cross-platform recommendations
    const crossPlatformPosts = this.identifyCrossPlatformOpportunities(platformsData);
    if (crossPlatformPosts > 0) {
      recommendations.push(`Repurpose ${crossPlatformPosts} high-performing posts across platforms`);
    }

    // Growth recommendations
    for (const data of platformsData) {
      if (data.profile.followerCount < 10000 && data.metrics.averageEngagementRate > 5) {
        recommendations.push(`High engagement on ${data.platform} - invest in growth strategies`);
      }
    }

    return recommendations.slice(0, 5); // Top 5 recommendations
  }

  private identifyCrossPlatformOpportunities(platformsData: PlatformData[]): number {
    if (platformsData.length < 2) return 0;

    let opportunities = 0;

    // Find high-performing posts that aren't on all platforms
    for (const data of platformsData) {
      const highPerformers = data.posts.filter(p => 
        p.engagementRate && p.engagementRate > data.metrics.averageEngagementRate * 1.5
      );

      // Assume each high performer could be reused on other platforms
      opportunities += highPerformers.length * (platformsData.length - 1);
    }

    return Math.min(opportunities, 10); // Cap at 10
  }

  private estimateMonetaryValue(platformsData: PlatformData[]): MonetaryValue {
    // Calculate based on total reach and engagement
    const totalReach = platformsData.reduce(
      (sum, d) => sum + d.profile.followerCount,
      0
    );
    const avgEngagement = platformsData.reduce(
      (sum, d) => sum + d.metrics.averageEngagementRate,
      0
    ) / platformsData.length;

    // Base calculation using industry standards
    // Micro-influencer: $100-$500 per post
    // Mid-tier: $500-$5,000 per post
    // Macro: $5,000-$10,000 per post
    // Mega: $10,000+ per post

    let minRate: number;
    let maxRate: number;

    if (totalReach >= 1000000) {
      minRate = 10000;
      maxRate = 50000;
    } else if (totalReach >= 100000) {
      minRate = 5000;
      maxRate = 10000;
    } else if (totalReach >= 50000) {
      minRate = 2000;
      maxRate = 5000;
    } else if (totalReach >= 10000) {
      minRate = 500;
      maxRate = 2000;
    } else if (totalReach >= 5000) {
      minRate = 250;
      maxRate = 500;
    } else {
      minRate = 100;
      maxRate = 250;
    }

    // Adjust based on engagement rate
    const engagementMultiplier = Math.min(2, 1 + (avgEngagement - 2) * 0.2);
    minRate *= engagementMultiplier;
    maxRate *= engagementMultiplier;

    // Adjust based on platform diversity
    const platformMultiplier = 1 + (platformsData.length - 1) * 0.2;
    minRate *= platformMultiplier;
    maxRate *= platformMultiplier;

    // Calculate confidence based on data quality
    let confidence = 0.7;
    const totalPosts = platformsData.reduce((sum, d) => sum + d.posts.length, 0);
    if (totalPosts > 50) confidence += 0.1;
    if (platformsData.length >= 3) confidence += 0.1;
    if (avgEngagement > 3) confidence += 0.1;

    return {
      sponsorshipRange: {
        min: Math.round(minRate),
        max: Math.round(maxRate),
      },
      currency: 'USD',
      confidence: Math.min(1, confidence),
    };
  }
}