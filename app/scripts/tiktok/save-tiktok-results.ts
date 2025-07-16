#!/usr/bin/env node

/**
 * Save TikTok search results to JSON file
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load .env file
dotenv.config({ path: path.join(__dirname, '.env') });

import { ActorManager } from './lib/apify/actor-manager';

async function saveTikTokResults() {
  console.log('\n🚀 Starting TikTok profile search...\n');
  
  try {
    // Create actor manager
    const actorManager = new ActorManager({
      apiKey: process.env.APIFY_API_KEY!,
    });
    
    // Search for profiles
    const keywords = ['AI', 'tech', 'career', 'recruiter', 'recruiting'];
    console.log(`Searching for profiles with keywords: ${keywords.join(', ')}\n`);
    
    const result = await actorManager.searchTikTokProfiles(keywords, {
      maxProfilesPerQuery: 50,
      resultsPerPage: 100,
    });
    
    console.log('Actor run:', {
      runId: result.runId,
      status: result.status,
    });
    
    // Get results
    if (result.datasetId) {
      console.log('\nFetching results...');
      const profiles = await actorManager.getRunDataset(result.datasetId);
      console.log(`Found ${profiles.length} total profiles\n`);
      
      // Filter profiles
      const filtered = profiles.filter((p: any) => {
        const fans = p.authorMeta?.fans || p['authorMeta.fans'] || 0;
        const bio = (p.authorMeta?.signature || p['authorMeta.signature'] || '').toLowerCase();
        const hasKeyword = keywords.some(k => bio.includes(k.toLowerCase()));
        return fans >= 5000 && hasKeyword;
      });
      
      console.log(`Filtered to ${filtered.length} profiles with 5000+ followers and keywords in bio\n`);
      
      // Transform to cleaner format
      const cleanProfiles = filtered.map((p: any) => ({
        username: p.authorMeta?.name || p['authorMeta.name'],
        displayName: p.authorMeta?.nickName || p['authorMeta.nickName'],
        followers: p.authorMeta?.fans || p['authorMeta.fans'],
        bio: p.authorMeta?.signature || p['authorMeta.signature'],
        avatar: p.authorMeta?.avatar || p['authorMeta.avatar'],
        verified: p.authorMeta?.verified || p['authorMeta.verified'] || false,
        videos: p.authorMeta?.video || p['authorMeta.video'] || 0,
        profileUrl: `https://www.tiktok.com/@${p.authorMeta?.name || p['authorMeta.name']}`,
      }));
      
      // Sort by followers
      cleanProfiles.sort((a, b) => b.followers - a.followers);
      
      // Save to file
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `tiktok-profiles-${timestamp}.json`;
      fs.writeFileSync(filename, JSON.stringify(cleanProfiles, null, 2));
      
      console.log(`✅ Saved ${cleanProfiles.length} profiles to ${filename}\n`);
      
      // Display top 10
      console.log('Top 10 profiles by followers:\n');
      cleanProfiles.slice(0, 10).forEach((p, i) => {
        console.log(`${i + 1}. @${p.username} - ${p.followers.toLocaleString()} followers`);
        console.log(`   ${p.bio?.substring(0, 100)}...`);
        console.log('');
      });
    }
    
  } catch (error) {
    console.error('Search failed:', error);
  }
}

// Run the search
saveTikTokResults();