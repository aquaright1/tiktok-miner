#!/usr/bin/env node

/**
 * TikTok sync using the Apify infrastructure
 * Run from app directory: npx tsx run-tiktok-sync.ts
 */

import { UnifiedTikTokService } from './lib/services/tiktok-service-factory';
import { prisma } from './lib/db';
import { logger } from './lib/logger';

async function runTikTokSync() {
  try {
    logger.info('Starting TikTok sync using Apify infrastructure...');
    
    // Check if Apify is configured
    if (!process.env.APIFY_API_KEY) {
      logger.error('APIFY_API_KEY not found in environment variables');
      logger.info('Please add APIFY_API_KEY to your .env file');
      process.exit(1);
    }
    
    // Initialize the TikTok service
    const tiktokService = new UnifiedTikTokService();
    logger.info(`Using ${tiktokService.isUsingApify() ? 'Apify' : 'API'} mode`);
    
    if (!tiktokService.isUsingApify()) {
      logger.warn('TikTok Apify mode is not enabled. Set USE_TIKTOK_APIFY=true in .env');
    }
    
    // Search for profiles
    const keywords = ['AI', 'tech', 'career', 'recruiter', 'recruiting'];
    logger.info(`Searching for profiles with keywords: ${keywords.join(', ')}`);
    
    const profiles = await tiktokService.searchProfiles(keywords, 50);
    logger.info(`Found ${profiles.length} profiles from Apify`);
    
    // Filter profiles
    const filteredProfiles = profiles.filter(profile => {
      const hasEnoughFollowers = profile.followerCount >= 5000;
      const bio = (profile.signature || '').toLowerCase();
      const hasKeywordInBio = keywords.some(keyword => bio.includes(keyword.toLowerCase()));
      
      if (!hasEnoughFollowers) {
        logger.debug(`Skipping @${profile.uniqueId}: only ${profile.followerCount} followers`);
      } else if (!hasKeywordInBio) {
        logger.debug(`Skipping @${profile.uniqueId}: no keywords in bio`);
      }
      
      return hasEnoughFollowers && hasKeywordInBio;
    });
    
    logger.info(`Filtered to ${filteredProfiles.length} profiles with 5000+ followers and keywords in bio`);
    
    // Display filtered profiles
    logger.info('\nFiltered profiles:');
    filteredProfiles.forEach((profile, index) => {
      logger.info(`${index + 1}. @${profile.uniqueId} - ${profile.followerCount.toLocaleString()} followers`);
      logger.info(`   Bio: ${profile.signature?.substring(0, 100)}...`);
    });
    
    // Save to database
    logger.info('\nSaving to database...');
    let savedCount = 0;
    
    for (const profile of filteredProfiles) {
      try {
        const result = await prisma.creatorProfile.upsert({
          where: { 
            username: profile.uniqueId 
          },
          update: {
            name: profile.nickname || profile.uniqueId,
            bio: profile.signature || '',
            profileImageUrl: profile.avatarUrl || '',
            totalReach: profile.followerCount,
            isVerified: profile.verified || false,
            platformIdentifiers: {
              tiktok: {
                id: profile.id,
                username: profile.uniqueId,
                url: profile.profileUrl || `https://www.tiktok.com/@${profile.uniqueId}`
              }
            },
            metrics: {
              followerCount: profile.followerCount,
              postCount: profile.videoCount || 0,
              engagementRate: 0
            },
            updatedAt: new Date()
          },
          create: {
            username: profile.uniqueId,
            name: profile.nickname || profile.uniqueId,
            bio: profile.signature || '',
            profileImageUrl: profile.avatarUrl || '',
            totalReach: profile.followerCount,
            isVerified: profile.verified || false,
            category: 'tiktok',
            platformIdentifiers: {
              tiktok: {
                id: profile.id,
                username: profile.uniqueId,
                url: profile.profileUrl || `https://www.tiktok.com/@${profile.uniqueId}`
              }
            },
            metrics: {
              followerCount: profile.followerCount,
              postCount: profile.videoCount || 0,
              engagementRate: 0
            }
          }
        });
        
        savedCount++;
        logger.info(`✓ Saved @${profile.uniqueId}`);
      } catch (error: any) {
        logger.error(`✗ Failed to save @${profile.uniqueId}: ${error.message}`);
      }
    }
    
    logger.info(`\n✅ Sync complete! Saved ${savedCount}/${filteredProfiles.length} profiles to database.`);
    
  } catch (error: any) {
    logger.error('Sync failed:', error);
    logger.error('Error details:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the sync
runTikTokSync()
  .then(() => {
    logger.info('Done!');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Fatal error:', error);
    process.exit(1);
  });