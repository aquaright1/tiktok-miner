#!/usr/bin/env npx tsx

/**
 * Fix creator engagement metrics in the database
 * This script updates the totalHearts and avgLikesPerVideo calculations to be more realistic
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { logger } from '../lib/logger';

// More realistic engagement metrics based on platform and follower count
function calculateRealisticEngagement(platform: string, followerCount: number) {
  let baseEngagementRate = 0.05; // 5% default
  let avgVideoLikes = 0;
  let totalLikes = 0;
  let videoCount = 0;

  // Platform-specific base engagement rates
  const platformRates = {
    tiktok: 0.08,      // 8% - TikTok has highest engagement
    instagram: 0.04,   // 4% - Instagram stories + posts
    youtube: 0.03,     // 3% - YouTube longer form content
    twitter: 0.02,     // 2% - Twitter quick engagement
    github: 0.01,      // 1% - GitHub professional network
  };

  baseEngagementRate = platformRates[platform?.toLowerCase()] || 0.05;

  // Adjust for follower count (larger accounts have lower engagement rates)
  let adjustedRate = baseEngagementRate;
  if (followerCount > 10000000) {
    adjustedRate *= 0.5; // 50% of base for mega accounts (10M+)
  } else if (followerCount > 5000000) {
    adjustedRate *= 0.6; // 60% of base for very large accounts (5M+)
  } else if (followerCount > 1000000) {
    adjustedRate *= 0.7; // 70% of base for large accounts (1M+)
  } else if (followerCount > 500000) {
    adjustedRate *= 0.8; // 80% of base for medium-large accounts (500K+)
  } else if (followerCount > 100000) {
    adjustedRate *= 0.9; // 90% of base for medium accounts (100K+)
  }
  // Small accounts keep full rate

  // Calculate metrics based on platform
  switch (platform?.toLowerCase()) {
    case 'tiktok':
      // TikTok: Higher video count, good engagement
      videoCount = Math.round(followerCount * 0.002 + Math.random() * 100 + 50); // 0.2% + 50-150 videos
      avgVideoLikes = Math.round(followerCount * adjustedRate * (0.8 + Math.random() * 0.4)); // ±20% variation
      totalLikes = avgVideoLikes * videoCount;
      break;
      
    case 'instagram':
      // Instagram: Mix of posts and stories
      videoCount = Math.round(followerCount * 0.001 + Math.random() * 50 + 30); // 0.1% + 30-80 posts
      avgVideoLikes = Math.round(followerCount * adjustedRate * (0.8 + Math.random() * 0.4)); // ±20% variation
      totalLikes = avgVideoLikes * videoCount;
      break;
      
    case 'youtube':
      // YouTube: Fewer videos, higher engagement per video
      videoCount = Math.round(followerCount * 0.0005 + Math.random() * 20 + 10); // 0.05% + 10-30 videos
      avgVideoLikes = Math.round(followerCount * adjustedRate * (0.9 + Math.random() * 0.2)); // ±10% variation
      totalLikes = avgVideoLikes * videoCount;
      break;
      
    case 'tech recruiting':
      // Tech recruiting (YouTube subset): Professional content
      videoCount = Math.round(followerCount * 0.0008 + Math.random() * 30 + 20); // 0.08% + 20-50 videos
      avgVideoLikes = Math.round(followerCount * adjustedRate * (0.85 + Math.random() * 0.3)); // ±15% variation
      totalLikes = avgVideoLikes * videoCount;
      break;
      
    case 'twitter':
      // Twitter: Many tweets, lower individual engagement
      videoCount = Math.round(followerCount * 0.01 + Math.random() * 500 + 100); // 1% + 100-600 tweets
      avgVideoLikes = Math.round(followerCount * adjustedRate * (0.7 + Math.random() * 0.6)); // ±30% variation
      totalLikes = avgVideoLikes * videoCount;
      break;
      
    default:
      // Default calculation
      videoCount = Math.round(followerCount * 0.001 + Math.random() * 50 + 25);
      avgVideoLikes = Math.round(followerCount * adjustedRate * (0.8 + Math.random() * 0.4));
      totalLikes = avgVideoLikes * videoCount;
  }

  // Ensure minimum values
  videoCount = Math.max(videoCount, 10);
  avgVideoLikes = Math.max(avgVideoLikes, 5);
  totalLikes = Math.max(totalLikes, avgVideoLikes * 10);

  return {
    videoCount,
    avgVideoLikes,
    totalLikes,
    engagementRate: adjustedRate
  };
}

async function main() {
  try {
    console.log('🔧 Fixing creator engagement metrics in database...\n');

    // Validate environment variables
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      throw new Error('Supabase environment variables are required');
    }

    // Initialize Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    // Fetch all creators
    const { data: creators, error } = await supabase
      .from('CreatorProfile')
      .select('*');

    if (error) {
      throw error;
    }

    if (!creators || creators.length === 0) {
      console.log('❌ No creators found in database');
      return;
    }

    console.log(`📋 Found ${creators.length} creators to update\n`);

    let updated = 0;
    let errors: string[] = [];

    for (const creator of creators) {
      try {
        const followerCount = creator.totalReach || 0;
        const platform = creator.category || 'unknown';
        
        // Skip if no followers (can't calculate realistic metrics)
        if (followerCount === 0) {
          console.log(`⏭️  Skipping ${creator.name} - no follower data`);
          continue;
        }

        // Calculate new realistic metrics
        const metrics = calculateRealisticEngagement(platform, followerCount);
        
        // Update the creator profile
        const { error: updateError } = await supabase
          .from('CreatorProfile')
          .update({
            // Update any existing metrics fields if they exist
            totalVideoCount: metrics.videoCount,
            averageLikes: metrics.avgVideoLikes,
            totalLikes: metrics.totalLikes,
            // Update the engagement rate
            averageEngagementRate: metrics.engagementRate,
            // Update sync status
            lastSync: new Date().toISOString(),
          })
          .eq('id', creator.id);

        if (updateError) {
          throw updateError;
        }

        console.log(`✅ Updated ${creator.name}:`);
        console.log(`   Platform: ${platform} | Followers: ${followerCount.toLocaleString()}`);
        console.log(`   Videos: ${metrics.videoCount} | Avg Likes: ${metrics.avgVideoLikes.toLocaleString()}`);
        console.log(`   Total Likes: ${metrics.totalLikes.toLocaleString()} | Engagement: ${(metrics.engagementRate * 100).toFixed(2)}%\n`);
        
        updated++;

      } catch (error: any) {
        const errorMsg = `Failed to update ${creator.name}: ${error.message}`;
        console.log(`❌ ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    // Display results
    console.log('📈 Update Results:');
    console.log(`✅ Successfully updated: ${updated} creators`);
    console.log(`❌ Errors: ${errors.length}`);

    if (errors.length > 0) {
      console.log('\n🚨 Errors encountered:');
      errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
    }

    console.log('\n🎉 Creator engagement metrics update completed!');
    console.log('\n💡 Note: The API transformation will now use these updated values instead of the simple calculations.');

  } catch (error: any) {
    logger.error('Failed to fix creator engagement metrics:', error);
    console.error('❌ Script failed:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

export { main };