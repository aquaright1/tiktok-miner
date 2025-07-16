#!/usr/bin/env node

/**
 * Script to sync TikTok profiles via the API (uses existing infrastructure)
 * 
 * Usage: npx tsx app/scripts/sync-tiktok-via-api.ts
 */

import { createActorManager } from '../lib/apify';
import { UnifiedTikTokService } from '../lib/services/tiktok-service-factory';
import { prisma } from '../lib/db';
import { logger } from '../lib/logger';

async function syncTikTokProfiles() {
  try {
    // Initialize services
    const tiktokService = new UnifiedTikTokService();
    
    // Your search keywords
    const keywords = ['AI', 'tech', 'career', 'recruiter', 'recruiting'];
    
    logger.info(`Searching for TikTok profiles with keywords: ${keywords.join(', ')}`);
    
    // Search for profiles
    const profiles = await tiktokService.searchProfiles(keywords, 100);
    
    logger.info(`Found ${profiles.length} profiles from Apify`);
    
    // Filter by followers and bio keywords
    const filteredProfiles = profiles.filter(profile => {
      if (profile.followerCount < 5000) return false;
      
      const bio = profile.signature?.toLowerCase() || '';
      return keywords.some(keyword => bio.includes(keyword.toLowerCase()));
    });
    
    logger.info(`Filtered to ${filteredProfiles.length} profiles with 5000+ followers and keywords in bio`);
    
    // Import to database
    for (const profile of filteredProfiles) {
      try {
        // Check if exists
        const existing = await prisma.creatorProfile.findFirst({
          where: {
            OR: [
              { username: profile.uniqueId },
              { 
                platformIdentifiers: {
                  path: ['tiktok', 'username'],
                  equals: profile.uniqueId
                }
              }
            ]
          }
        });
        
        const creatorData = {
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
        };
        
        if (existing) {
          await prisma.creatorProfile.update({
            where: { id: existing.id },
            data: {
              ...creatorData,
              updatedAt: new Date()
            }
          });
          logger.info(`Updated: @${profile.uniqueId}`);
        } else {
          await prisma.creatorProfile.create({
            data: creatorData
          });
          logger.info(`Created: @${profile.uniqueId}`);
        }
      } catch (error) {
        logger.error(`Failed to import @${profile.uniqueId}:`, error);
      }
    }
    
    logger.info('Sync completed successfully');
    
  } catch (error) {
    logger.error('Sync failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the sync
syncTikTokProfiles();