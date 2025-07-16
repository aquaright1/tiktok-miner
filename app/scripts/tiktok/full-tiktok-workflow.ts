#!/usr/bin/env node

/**
 * Complete workflow using all infrastructure components
 * 
 * Usage: npx tsx app/scripts/full-tiktok-workflow.ts
 */

import { logger } from '../lib/logger';

async function runFullWorkflow() {
  logger.info('Starting full TikTok workflow using infrastructure...');
  
  // Step 1: Search for profiles using the API
  logger.info('\n1. Searching for profiles...');
  const searchResponse = await fetch('http://localhost:3000/api/creators/tiktok/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      keywords: ['AI', 'tech', 'career', 'recruiter', 'recruiting'],
      limit: 50
    })
  });
  
  const searchData = await searchResponse.json();
  logger.info(`Found ${searchData.count} profiles`);
  
  // Step 2: Filter profiles with 5000+ followers and keywords in bio
  const filteredProfiles = searchData.data.filter((profile: any) => {
    const bio = profile.signature?.toLowerCase() || '';
    const keywords = ['ai', 'tech', 'career', 'recruiter', 'recruiting'];
    return profile.fans >= 5000 && keywords.some(k => bio.includes(k));
  });
  
  logger.info(`\n2. Filtered to ${filteredProfiles.length} profiles with 5000+ followers`);
  
  // Step 3: Sync each profile to get full data
  logger.info('\n3. Syncing profiles to database...');
  for (const profile of filteredProfiles) {
    try {
      const syncResponse = await fetch('http://localhost:3000/api/creators/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: 'tiktok',
          username: profile.uniqueId || profile.name
        })
      });
      
      if (syncResponse.ok) {
        logger.info(`✓ Synced @${profile.uniqueId || profile.name}`);
      }
    } catch (error) {
      logger.error(`✗ Failed to sync @${profile.uniqueId || profile.name}:`, error);
    }
  }
  
  // Step 4: View results in the UI
  logger.info('\n4. View results at:');
  logger.info('   - Creator List: http://localhost:3000/creators');
  logger.info('   - Analytics: http://localhost:3000/creator-analysis');
  logger.info('   - API Monitoring: http://localhost:3000/api-monitoring');
  
  // Step 5: Check monitoring stats
  const monitoringResponse = await fetch('http://localhost:3000/api/monitoring/usage-stats');
  const stats = await monitoringResponse.json();
  logger.info('\n5. Usage stats:', stats);
}

runFullWorkflow().catch(error => {
  logger.error('Workflow failed:', error);
  process.exit(1);
});