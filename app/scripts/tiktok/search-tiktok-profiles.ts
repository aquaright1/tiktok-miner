#!/usr/bin/env node

/**
 * Script to search TikTok profiles by keywords using Apify
 * 
 * Usage: npx tsx app/scripts/search-tiktok-profiles.ts
 */

import { createActorManager } from '../lib/apify';
import { logger } from '../lib/logger';

async function searchTikTokProfiles() {
  try {
    // Initialize the actor manager
    const actorManager = createActorManager();

    // Define search keywords
    const keywords = [
      "AI",
      "tech", 
      "career",
      "recruiter",
      "recruiting"
    ];

    logger.info('Starting TikTok profile search', { keywords });

    // Search for profiles
    const result = await actorManager.searchTikTokProfiles(keywords, {
      resultsPerPage: 100,
      maxProfilesPerQuery: 50,
    });

    logger.info('Search initiated successfully', {
      runId: result.runId,
      status: result.status,
      datasetId: result.datasetId,
    });

    // Wait for the run to complete and get results
    if (result.status === 'SUCCEEDED' && result.datasetId) {
      logger.info('Fetching search results...');
      const profiles = await actorManager.getRunDataset(result.datasetId);
      
      logger.info(`Found ${profiles.length} profiles`);
      
      // Display sample results
      profiles.slice(0, 5).forEach((profile: any, index: number) => {
        logger.info(`Profile ${index + 1}:`, {
          username: profile.authorMeta?.name,
          displayName: profile.authorMeta?.nickName,
          followers: profile.authorStats?.followerCount,
          bio: profile.authorMeta?.signature,
        });
      });
    } else {
      logger.warn('Search is still running or failed', { status: result.status });
    }

  } catch (error) {
    logger.error('Failed to search TikTok profiles', { error });
    process.exit(1);
  }
}

// Run the search
searchTikTokProfiles();