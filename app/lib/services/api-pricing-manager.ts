import { PrismaClient, ApiPricing } from '@prisma/client';
import { logger } from '../logger';

export interface PricingTier {
  platform: string;
  model: string;
  inputPricePerToken: number;
  outputPricePerToken: number;
  pricePerRequest?: number;
  minimumCharge?: number;
  tier: string;
  notes?: string;
}

// Current pricing as of 2024 (prices per 1K tokens)
export const CURRENT_PRICING: PricingTier[] = [
  // OpenAI
  { platform: 'OpenAI', model: 'gpt-4o', inputPricePerToken: 0.005 / 1000, outputPricePerToken: 0.015 / 1000, tier: 'premium' },
  { platform: 'OpenAI', model: 'gpt-4o-mini', inputPricePerToken: 0.00015 / 1000, outputPricePerToken: 0.0006 / 1000, tier: 'standard' },
  { platform: 'OpenAI', model: 'gpt-4-turbo', inputPricePerToken: 0.01 / 1000, outputPricePerToken: 0.03 / 1000, tier: 'premium' },
  { platform: 'OpenAI', model: 'gpt-4', inputPricePerToken: 0.03 / 1000, outputPricePerToken: 0.06 / 1000, tier: 'premium' },
  { platform: 'OpenAI', model: 'gpt-3.5-turbo', inputPricePerToken: 0.0005 / 1000, outputPricePerToken: 0.0015 / 1000, tier: 'standard' },
  
  // Anthropic Claude
  { platform: 'Anthropic', model: 'claude-3-opus', inputPricePerToken: 0.015 / 1000, outputPricePerToken: 0.075 / 1000, tier: 'premium' },
  { platform: 'Anthropic', model: 'claude-3-sonnet', inputPricePerToken: 0.003 / 1000, outputPricePerToken: 0.015 / 1000, tier: 'standard' },
  { platform: 'Anthropic', model: 'claude-3-haiku', inputPricePerToken: 0.00025 / 1000, outputPricePerToken: 0.00125 / 1000, tier: 'economy' },
  { platform: 'Anthropic', model: 'claude-2.1', inputPricePerToken: 0.008 / 1000, outputPricePerToken: 0.024 / 1000, tier: 'standard' },
  
  // Google
  { platform: 'Google', model: 'gemini-pro', inputPricePerToken: 0.00025 / 1000, outputPricePerToken: 0.0005 / 1000, tier: 'standard' },
  { platform: 'Google', model: 'gemini-pro-vision', inputPricePerToken: 0.00025 / 1000, outputPricePerToken: 0.0005 / 1000, tier: 'standard' },
  { platform: 'Google', model: 'gemini-1.5-pro', inputPricePerToken: 0.00125 / 1000, outputPricePerToken: 0.005 / 1000, tier: 'premium' },
  
  // Social Media Platform API Pricing (estimated based on tier pricing)
  { platform: 'Instagram', model: 'basic-display', inputPricePerToken: 0, outputPricePerToken: 0, pricePerRequest: 0, tier: 'free', notes: 'Free tier: 200 calls/hour' },
  { platform: 'Instagram', model: 'graph-api', inputPricePerToken: 0, outputPricePerToken: 0, pricePerRequest: 0.001, tier: 'standard', notes: 'Business tier' },
  
  { platform: 'TikTok', model: 'research-api', inputPricePerToken: 0, outputPricePerToken: 0, pricePerRequest: 0.01, tier: 'research', notes: '$299/month for 30k requests' },
  { platform: 'TikTok', model: 'basic-api', inputPricePerToken: 0, outputPricePerToken: 0, pricePerRequest: 0, tier: 'free', notes: 'Free tier: 100 calls/day' },
  
  { platform: 'Twitter', model: 'essential', inputPricePerToken: 0, outputPricePerToken: 0, pricePerRequest: 0.0002, tier: 'essential', notes: '$100/month for 500k tweets' },
  { platform: 'Twitter', model: 'elevated', inputPricePerToken: 0, outputPricePerToken: 0, pricePerRequest: 0.001, tier: 'elevated', notes: 'Higher rate limits' },
  
  // Apify Platform Pricing
  { platform: 'Apify', model: 'compute-units', inputPricePerToken: 0.25 / 1000, outputPricePerToken: 0, pricePerRequest: 0, tier: 'standard', notes: '$0.25 per 1K compute units' },
  { platform: 'Apify', model: 'dataset-operations', inputPricePerToken: 0.005 / 1000, outputPricePerToken: 0, pricePerRequest: 0, tier: 'standard', notes: '$0.005 per 1K operations' },
  { platform: 'Apify', model: 'storage-gb', inputPricePerToken: 0.20, outputPricePerToken: 0, pricePerRequest: 0, tier: 'standard', notes: '$0.20 per GB per month' },
  { platform: 'Apify', model: 'proxy-residential', inputPricePerToken: 12.0 / 1000000, outputPricePerToken: 0, pricePerRequest: 0, tier: 'premium', notes: '$12 per GB' },
  { platform: 'Apify', model: 'proxy-datacenter', inputPricePerToken: 0.80 / 1000000, outputPricePerToken: 0, pricePerRequest: 0, tier: 'standard', notes: '$0.80 per GB' },
  
  // Apify Actor Pricing (estimated)
  { platform: 'Apify', model: 'instagram-scraper', inputPricePerToken: 0.001, outputPricePerToken: 0, pricePerRequest: 0.05, tier: 'standard', notes: 'Avg $0.05 per profile' },
  { platform: 'Apify', model: 'tiktok-scraper', inputPricePerToken: 0.001, outputPricePerToken: 0, pricePerRequest: 0.04, tier: 'standard', notes: 'Avg $0.04 per profile' },
  { platform: 'Apify', model: 'youtube-scraper', inputPricePerToken: 0.001, outputPricePerToken: 0, pricePerRequest: 0.06, tier: 'standard', notes: 'Avg $0.06 per channel' },
  { platform: 'Apify', model: 'twitter-scraper', inputPricePerToken: 0.001, outputPricePerToken: 0, pricePerRequest: 0.03, tier: 'standard', notes: 'Avg $0.03 per profile' },
];

export class APIPricingManager {
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || new PrismaClient();
  }

  async initializePricing(): Promise<void> {
    try {
      for (const pricing of CURRENT_PRICING) {
        const existing = await this.prisma.apiPricing.findFirst({
          where: {
            platform: pricing.platform,
            model: pricing.model,
            isActive: true
          }
        });

        if (!existing) {
          await this.prisma.apiPricing.create({
            data: {
              platform: pricing.platform,
              model: pricing.model,
              pricePerToken: pricing.outputPricePerToken, // Default to output price for backward compatibility
              pricePerRequest: pricing.pricePerRequest,
              pricingTier: pricing.tier,
              isActive: true,
              effectiveFrom: new Date()
            }
          });
          logger.info(`Initialized pricing for ${pricing.platform}/${pricing.model}`);
        }
      }
    } catch (error) {
      logger.error('Failed to initialize pricing:', error);
      throw error;
    }
  }

  async calculateCost(
    platform: string,
    model: string,
    inputTokens: number = 0,
    outputTokens: number = 0,
    requests: number = 1
  ): Promise<{ tokenCost: number; requestCost: number; totalCost: number; breakdown: string }> {
    const pricing = CURRENT_PRICING.find(
      p => p.platform === platform && p.model === model
    );

    if (!pricing) {
      logger.warn(`No pricing found for ${platform}/${model}, using default`);
      return {
        tokenCost: 0,
        requestCost: 0,
        totalCost: 0,
        breakdown: 'No pricing information available'
      };
    }

    const inputCost = inputTokens * pricing.inputPricePerToken;
    const outputCost = outputTokens * pricing.outputPricePerToken;
    const tokenCost = inputCost + outputCost;
    const requestCost = (pricing.pricePerRequest || 0) * requests;
    const totalCost = tokenCost + requestCost;

    const breakdown = [
      tokenCost > 0 && `Tokens: $${tokenCost.toFixed(6)} (${inputTokens} in @ $${(pricing.inputPricePerToken * 1000).toFixed(4)}/1K + ${outputTokens} out @ $${(pricing.outputPricePerToken * 1000).toFixed(4)}/1K)`,
      requestCost > 0 && `Requests: $${requestCost.toFixed(6)} (${requests} @ $${pricing.pricePerRequest?.toFixed(4)}/req)`,
      pricing.minimumCharge && totalCost < pricing.minimumCharge && `Minimum charge: $${pricing.minimumCharge.toFixed(4)}`,
      pricing.notes
    ].filter(Boolean).join(' | ');

    const finalCost = pricing.minimumCharge ? Math.max(totalCost, pricing.minimumCharge) : totalCost;

    return {
      tokenCost,
      requestCost,
      totalCost: finalCost,
      breakdown
    };
  }

  async estimateMonthlyCost(
    usage: Array<{
      platform: string;
      model: string;
      dailyInputTokens: number;
      dailyOutputTokens: number;
      dailyRequests: number;
    }>
  ): Promise<{
    totalMonthlyCost: number;
    platformBreakdown: Record<string, number>;
    recommendations: string[];
  }> {
    let totalMonthlyCost = 0;
    const platformBreakdown: Record<string, number> = {};
    const recommendations: string[] = [];

    for (const item of usage) {
      const dailyCost = await this.calculateCost(
        item.platform,
        item.model,
        item.dailyInputTokens,
        item.dailyOutputTokens,
        item.dailyRequests
      );
      
      const monthlyCost = dailyCost.totalCost * 30;
      totalMonthlyCost += monthlyCost;
      
      const key = `${item.platform}/${item.model}`;
      platformBreakdown[key] = monthlyCost;

      // Generate optimization recommendations
      const pricing = CURRENT_PRICING.find(
        p => p.platform === item.platform && p.model === item.model
      );
      
      if (pricing && pricing.tier === 'premium') {
        const cheaperAlternative = CURRENT_PRICING.find(
          p => p.platform === item.platform && p.tier !== 'premium'
        );
        if (cheaperAlternative) {
          const alternativeCost = await this.calculateCost(
            cheaperAlternative.platform,
            cheaperAlternative.model,
            item.dailyInputTokens,
            item.dailyOutputTokens,
            item.dailyRequests
          );
          const savings = (dailyCost.totalCost - alternativeCost.totalCost) * 30;
          if (savings > 10) {
            recommendations.push(
              `Consider using ${cheaperAlternative.model} instead of ${item.model} to save ~$${savings.toFixed(2)}/month`
            );
          }
        }
      }

      // Check for high token usage
      if (item.dailyInputTokens + item.dailyOutputTokens > 1000000) {
        recommendations.push(
          `High token usage detected for ${item.platform}/${item.model}. Consider implementing caching or prompt optimization.`
        );
      }
    }

    // Sort recommendations by potential savings
    recommendations.sort((a, b) => {
      const savingsA = parseFloat(a.match(/\$(\d+\.?\d*)/)?.[1] || '0');
      const savingsB = parseFloat(b.match(/\$(\d+\.?\d*)/)?.[1] || '0');
      return savingsB - savingsA;
    });

    return {
      totalMonthlyCost,
      platformBreakdown,
      recommendations: recommendations.slice(0, 5) // Top 5 recommendations
    };
  }

  async updatePricing(
    platform: string,
    model: string,
    newPricing: Partial<PricingTier>
  ): Promise<ApiPricing> {
    // Deactivate old pricing
    await this.prisma.apiPricing.updateMany({
      where: {
        platform,
        model,
        isActive: true
      },
      data: {
        isActive: false,
        effectiveTo: new Date()
      }
    });

    // Create new pricing
    return this.prisma.apiPricing.create({
      data: {
        platform,
        model,
        pricePerToken: newPricing.outputPricePerToken || 0,
        pricePerRequest: newPricing.pricePerRequest,
        pricingTier: newPricing.tier,
        isActive: true,
        effectiveFrom: new Date()
      }
    });
  }

  async getPricingHistory(
    platform: string,
    model: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<ApiPricing[]> {
    return this.prisma.apiPricing.findMany({
      where: {
        platform,
        model,
        effectiveFrom: startDate ? { gte: startDate } : undefined,
        effectiveTo: endDate ? { lte: endDate } : undefined
      },
      orderBy: {
        effectiveFrom: 'desc'
      }
    });
  }

  async close(): Promise<void> {
    await this.prisma.$disconnect();
  }
}