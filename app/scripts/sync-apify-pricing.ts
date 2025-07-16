import { PrismaClient } from '@prisma/client';
import { CURRENT_PRICING } from '../lib/services/api-pricing-manager';

const prisma = new PrismaClient();

async function syncApifyPricing() {
  console.log('Syncing Apify pricing to database...');
  
  try {
    // Get Apify pricing entries
    const apifyPricing = CURRENT_PRICING.filter(p => p.platform === 'Apify');
    
    console.log(`Found ${apifyPricing.length} Apify pricing entries`);
    
    for (const pricing of apifyPricing) {
      // Check if pricing already exists
      const existing = await prisma.apiPricing.findFirst({
        where: {
          platform: pricing.platform,
          model: pricing.model,
          isActive: true,
        }
      });
      
      if (existing) {
        // Update existing pricing
        await prisma.apiPricing.update({
          where: { id: existing.id },
          data: {
            pricePerToken: pricing.inputPricePerToken || pricing.outputPricePerToken || 0,
            pricePerRequest: pricing.pricePerRequest,
            pricingTier: pricing.tier,
            effectiveFrom: new Date(),
          }
        });
        console.log(`Updated pricing for ${pricing.platform}/${pricing.model}`);
      } else {
        // Create new pricing
        await prisma.apiPricing.create({
          data: {
            platform: pricing.platform,
            model: pricing.model,
            pricePerToken: pricing.inputPricePerToken || pricing.outputPricePerToken || 0,
            pricePerRequest: pricing.pricePerRequest,
            pricingTier: pricing.tier,
            isActive: true,
            effectiveFrom: new Date(),
          }
        });
        console.log(`Created pricing for ${pricing.platform}/${pricing.model}`);
      }
    }
    
    console.log('Apify pricing sync completed successfully');
  } catch (error) {
    console.error('Error syncing Apify pricing:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the sync
syncApifyPricing();