#!/usr/bin/env node

// Script to fetch Apify run data and save to database
const fetch = require('node-fetch');
const { Pool } = require('pg');

const APIFY_API_KEY = process.env.APIFY_API_KEY || 'your_apify_api_key_here';
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/database';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function fetchApifyRun(runId) {
  console.log(`\n📊 Fetching Apify run: ${runId}`);
  
  // Get run details
  const runResponse = await fetch(`https://api.apify.com/v2/actor-runs/${runId}`, {
    headers: {
      'Authorization': `Bearer ${APIFY_API_KEY}`
    }
  });
  
  if (!runResponse.ok) {
    throw new Error(`Failed to fetch run: ${runResponse.statusText}`);
  }
  
  const runData = await runResponse.json();
  console.log(`✅ Run status: ${runData.data.status}`);
  console.log(`📁 Dataset ID: ${runData.data.defaultDatasetId}`);
  
  if (runData.data.status !== 'SUCCEEDED') {
    throw new Error(`Run not completed. Status: ${runData.data.status}`);
  }
  
  return runData.data.defaultDatasetId;
}

async function fetchDatasetItems(datasetId) {
  console.log(`\n📊 Fetching dataset items: ${datasetId}`);
  
  const response = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?limit=1000`, {
    headers: {
      'Authorization': `Bearer ${APIFY_API_KEY}`
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch dataset: ${response.statusText}`);
  }
  
  const items = await response.json();
  console.log(`✅ Found ${items.length} items`);
  
  return items;
}

async function aggregateProfileData(videos) {
  console.log(`\n📊 Aggregating profile data from ${videos.length} videos`);
  
  // Debug: Check first video structure
  if (videos.length > 0) {
    console.log('\n🔍 Sample video data structure:');
    console.log('authorMeta keys:', Object.keys(videos[0].authorMeta || {}));
    console.log('authorStats keys:', Object.keys(videos[0].authorStats || {}));
    console.log('Sample authorMeta:', videos[0].authorMeta);
  }
  
  const profileMap = new Map();
  
  videos.forEach(video => {
    if (!video.authorMeta?.name) return;
    
    const username = video.authorMeta.name;
    
    if (!profileMap.has(username)) {
      // Try to get stats from either authorStats or authorMeta
      const followerCount = video.authorStats?.followerCount || 
                           video.authorMeta?.fans || 
                           video.authorMeta?.followers || 0;
      const followingCount = video.authorStats?.followingCount || 
                            video.authorMeta?.following || 0;
      const totalVideos = video.authorStats?.videoCount || 
                         video.authorMeta?.video || 0;
      const totalHearts = video.authorStats?.heartCount || 
                         video.authorMeta?.heart || 
                         video.authorMeta?.digg || 0;
      
      profileMap.set(username, {
        username,
        fullName: video.authorMeta.nickName || username,
        avatarUrl: video.authorMeta.avatar || '',
        bio: video.authorMeta.signature || '',
        verified: video.authorMeta.verified || false,
        followerCount,
        followingCount,
        totalVideos,
        totalHearts,
        posts30d: 0,
        viewsTotal: 0,
        likesTotal: 0,
        commentsTotal: 0,
        sharesTotal: 0,
        videos: []
      });
    }
    
    const profile = profileMap.get(username);
    
    // Add video to profile
    profile.videos.push({
      createTime: video.createTime,
      createTimeISO: video.createTimeISO,
      desc: video.desc || ''
    });
    
    // Update totals - metrics are at the top level
    profile.viewsTotal += video.playCount || 0;
    profile.likesTotal += video.diggCount || 0;
    profile.commentsTotal += video.commentCount || 0;
    profile.sharesTotal += video.shareCount || 0;
  });
  
  // Calculate 30-day posts and engagement rate
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
  
  profileMap.forEach(profile => {
    // Count 30-day posts
    profile.posts30d = profile.videos.filter(v => 
      new Date(v.createTime * 1000).getTime() > thirtyDaysAgo
    ).length;
    
    // Calculate engagement rate
    profile.engagementRate = profile.viewsTotal > 0 
      ? ((profile.likesTotal + profile.commentsTotal + profile.sharesTotal) / profile.viewsTotal) * 100
      : 0;
  });
  
  const profiles = Array.from(profileMap.values());
  console.log(`✅ Aggregated ${profiles.length} unique profiles`);
  
  return profiles;
}

async function saveProfilesToDatabase(profiles, category = null) {
  console.log(`\n💾 Saving ${profiles.length} profiles to database`);
  
  const client = await pool.connect();
  let savedCount = 0;
  
  try {
    for (const profile of profiles) {
      try {
        await client.query(`
          INSERT INTO tiktok_profiles (
            username, nick_name, avatar, signature, verified,
            follower_count, following_count, total_videos, total_hearts,
            posts_30d, views_total, likes_total, comments_total, shares_total,
            engagement_rate, category, "lastUpdated"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
          ON CONFLICT (username) DO UPDATE SET
            nick_name = EXCLUDED.nick_name,
            avatar = EXCLUDED.avatar,
            signature = EXCLUDED.signature,
            verified = EXCLUDED.verified,
            follower_count = EXCLUDED.follower_count,
            following_count = EXCLUDED.following_count,
            total_videos = EXCLUDED.total_videos,
            total_hearts = EXCLUDED.total_hearts,
            posts_30d = EXCLUDED.posts_30d,
            views_total = EXCLUDED.views_total,
            likes_total = EXCLUDED.likes_total,
            comments_total = EXCLUDED.comments_total,
            shares_total = EXCLUDED.shares_total,
            engagement_rate = EXCLUDED.engagement_rate,
            category = EXCLUDED.category,
            "lastUpdated" = EXCLUDED."lastUpdated"
        `, [
          profile.username,
          profile.fullName,
          profile.avatarUrl,
          profile.bio,
          profile.verified,
          profile.followerCount,
          profile.followingCount,
          profile.totalVideos,
          profile.totalHearts,
          profile.posts30d,
          profile.viewsTotal,
          profile.likesTotal,
          profile.commentsTotal,
          profile.sharesTotal,
          profile.engagementRate,
          category,
          new Date()
        ]);
        
        savedCount++;
        console.log(`✅ Saved @${profile.username} - ${profile.followerCount.toLocaleString()} followers, ${profile.posts30d} posts (30d), ${profile.engagementRate.toFixed(2)}% engagement`);
        
      } catch (error) {
        console.error(`❌ Failed to save @${profile.username}:`, error.message);
      }
    }
    
    console.log(`\n✅ Successfully saved ${savedCount}/${profiles.length} profiles`);
    
  } finally {
    client.release();
    await pool.end();
  }
  
  return savedCount;
}

async function main() {
  const runId = process.argv[2];
  const category = process.argv[3] || null; // Optional category parameter
  
  if (!runId) {
    console.error('❌ Usage: node fetch-and-save-apify-run.js <RUN_ID> [CATEGORY]');
    process.exit(1);
  }
  
  try {
    // Fetch run and get dataset ID
    const datasetId = await fetchApifyRun(runId);
    
    // Fetch dataset items
    const videos = await fetchDatasetItems(datasetId);
    
    // Aggregate profile data
    const profiles = await aggregateProfileData(videos);
    
    // Save to database
    const savedCount = await saveProfilesToDatabase(profiles, category);
    
    console.log('\n✅ Done!');
    process.exit(savedCount > 0 ? 0 : 1);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();