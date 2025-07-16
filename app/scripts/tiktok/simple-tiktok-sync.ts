#!/usr/bin/env node

/**
 * Simple TikTok sync using the existing infrastructure
 * 
 * Usage: npx tsx app/scripts/simple-tiktok-sync.ts
 */

import { UnifiedTikTokService } from '../lib/services/tiktok-service-factory';
import { prisma } from '../lib/db';
import { logger } from '../lib/logger';

async function simpleTikTokSync() {
  try {
    logger.info('Starting TikTok sync using Apify infrastructure...');
    
    // Initialize the TikTok service (will use Apify if configured)
    const tiktokService = new UnifiedTikTokService();
    logger.info(`Using ${tiktokService.isUsingApify() ? 'Apify' : 'API'} mode`);
    
    // Search for profiles
    const keywords = ['AI', 'tech', 'career', 'recruiter', 'recruiting'];
    logger.info(`Searching for profiles with keywords: ${keywords.join(', ')}`);
    
    const profiles = await tiktokService.searchProfiles(keywords, 50);
    logger.info(`Found ${profiles.length} profiles`);
    
    // Filter profiles with 5000+ followers and keywords in bio
    const filteredProfiles = profiles.filter(profile => {
      if (profile.followerCount < 5000) return false;
      
      const bio = (profile.signature || '').toLowerCase();
      return keywords.some(keyword => bio.includes(keyword.toLowerCase()));
    });
    
    logger.info(`Filtered to ${filteredProfiles.length} profiles with 5000+ followers and keywords in bio`);
    
    // Save to database
    let savedCount = 0;
    for (const profile of filteredProfiles) {
      try {
        await prisma.creatorProfile.upsert({
          where: { username: profile.uniqueId },
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
        logger.info(`✓ Saved @${profile.uniqueId} (${profile.followerCount.toLocaleString()} followers)`);
      } catch (error) {
        logger.error(`✗ Failed to save @${profile.uniqueId}:`, error);
      }
    }
    
    logger.info(`\nSync complete! Saved ${savedCount} profiles to database.`);
    logger.info('\nView results at:');
    logger.info('- http://localhost:3000/creators (if server is running)');
    logger.info('- Or query database directly with Prisma Studio');
    
  } catch (error) {
    logger.error('Sync failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the sync
simpleTikTokSync()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));