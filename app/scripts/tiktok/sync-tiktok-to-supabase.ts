#!/usr/bin/env node

/**
 * Sync TikTok profiles to Supabase using Apify
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env file
dotenv.config({ path: path.join(__dirname, '.env') });

import { PrismaClient } from '@prisma/client';
import { ActorManager } from './lib/apify/actor-manager';

const prisma = new PrismaClient();

async function syncTikTokToSupabase() {
  console.log('\n🚀 Starting TikTok to Supabase sync...\n');
  
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
      
      // Save to database
      let savedCount = 0;
      for (const profile of filtered) {
        const username = profile.authorMeta?.name || profile['authorMeta.name'];
        const fans = profile.authorMeta?.fans || profile['authorMeta.fans'];
        const bio = profile.authorMeta?.signature || profile['authorMeta.signature'];
        const avatar = profile.authorMeta?.avatar || profile['authorMeta.avatar'];
        const verified = profile.authorMeta?.verified || profile['authorMeta.verified'] || false;
        const video = profile.authorMeta?.video || profile['authorMeta.video'] || 0;
        
        try {
          const result = await prisma.creatorProfile.upsert({
            where: { username },
            update: {
              name: username,
              bio: bio || '',
              profileImageUrl: avatar || '',
              totalReach: fans,
              isVerified: verified,
              platformIdentifiers: {
                tiktok: {
                  username,
                  url: `https://www.tiktok.com/@${username}`
                }
              },
              metrics: {
                followerCount: fans,
                postCount: video,
                engagementRate: 0
              },
              updatedAt: new Date()
            },
            create: {
              username,
              name: username,
              bio: bio || '',
              profileImageUrl: avatar || '',
              totalReach: fans,
              isVerified: verified,
              category: 'tiktok',
              platformIdentifiers: {
                tiktok: {
                  username,
                  url: `https://www.tiktok.com/@${username}`
                }
              },
              metrics: {
                followerCount: fans,
                postCount: video,
                engagementRate: 0
              }
            }
          });
          
          savedCount++;
          console.log(`✅ Saved @${username} (${fans.toLocaleString()} followers)`);
        } catch (error: any) {
          console.error(`❌ Failed to save @${username}: ${error.message}`);
        }
      }
      
      console.log(`\n✨ Sync complete! Saved ${savedCount} profiles to Supabase.\n`);
    }
    
  } catch (error) {
    console.error('Sync failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the sync
syncTikTokToSupabase();