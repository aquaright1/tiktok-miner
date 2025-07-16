#!/usr/bin/env node

/**
 * Test script to manually fetch and save TikTok profile data
 * This tests the complete flow from Apify to database
 */

const fetch = require('node-fetch');
const { Pool } = require('pg');

const APIFY_API_KEY = process.env.APIFY_API_KEY || 'your_apify_api_key_here';
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/database';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function testFetchAndSave() {
  console.log('🧪 Testing TikTok data fetch and save\n');
  
  try {
    // 1. Start a simple Apify run for one profile
    console.log('1️⃣  Starting Apify run for @cristiano...');
    const startResponse = await fetch('https://api.apify.com/v2/acts/clockworks~tiktok-profile-scraper/runs', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${APIFY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        profiles: ['cristiano'],
        shouldDownloadVideos: false,
        resultsPerPage: 30
      })
    });
    
    const runData = await startResponse.json();
    const runId = runData.data.id;
    console.log(`✅ Started run: ${runId}`);
    
    // 2. Wait for completion
    console.log('⏳ Waiting for run to complete...');
    let status = 'RUNNING';
    let attempts = 0;
    
    while (status === 'RUNNING' && attempts < 60) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const statusResponse = await fetch(`https://api.apify.com/v2/actor-runs/${runId}`, {
        headers: { 'Authorization': `Bearer ${APIFY_API_KEY}` }
      });
      
      const statusData = await statusResponse.json();
      status = statusData.data.status;
      attempts++;
      
      if (attempts % 5 === 0) {
        console.log(`  Status: ${status} (${attempts * 2}s elapsed)`);
      }
    }
    
    if (status !== 'SUCCEEDED') {
      throw new Error(`Run failed with status: ${status}`);
    }
    
    console.log(`✅ Run completed successfully`);
    
    // 3. Fetch the data
    console.log('\n2️⃣  Fetching dataset...');
    const { data: { defaultDatasetId } } = await (await fetch(`https://api.apify.com/v2/actor-runs/${runId}`, {
      headers: { 'Authorization': `Bearer ${APIFY_API_KEY}` }
    })).json();
    
    const dataResponse = await fetch(`https://api.apify.com/v2/datasets/${defaultDatasetId}/items`, {
      headers: { 'Authorization': `Bearer ${APIFY_API_KEY}` }
    });
    
    const videos = await dataResponse.json();
    console.log(`✅ Found ${videos.length} videos`);
    
    // 4. Aggregate the data
    console.log('\n3️⃣  Aggregating profile data...');
    
    let profile = {
      username: 'cristiano',
      fullName: '',
      avatarUrl: '',
      bio: '',
      verified: false,
      followerCount: 0,
      followingCount: 0,
      totalVideos: 0,
      totalHearts: 0,
      posts30d: 0,
      viewsTotal: 0,
      likesTotal: 0,
      commentsTotal: 0,
      sharesTotal: 0
    };
    
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    
    videos.forEach((video, index) => {
      // First video, get profile metadata
      if (index === 0 && video.authorMeta) {
        profile.fullName = video.authorMeta.nickName || video.authorMeta.name;
        profile.avatarUrl = video.authorMeta.avatar || '';
        profile.bio = video.authorMeta.signature || '';
        profile.verified = video.authorMeta.verified || false;
        profile.followerCount = video.authorMeta.fans || 0;
        profile.followingCount = video.authorMeta.following || 0;
        profile.totalVideos = video.authorMeta.video || 0;
        profile.totalHearts = video.authorMeta.heart || 0;
      }
      
      // Count 30-day posts
      if (video.createTime && new Date(video.createTime * 1000).getTime() > thirtyDaysAgo) {
        profile.posts30d++;
      }
      
      // Aggregate metrics
      profile.viewsTotal += video.playCount || 0;
      profile.likesTotal += video.diggCount || 0;
      profile.commentsTotal += video.commentCount || 0;
      profile.sharesTotal += video.shareCount || 0;
    });
    
    // Calculate engagement rate
    profile.engagementRate = profile.viewsTotal > 0 
      ? ((profile.likesTotal + profile.commentsTotal + profile.sharesTotal) / profile.viewsTotal) * 100
      : 0;
    
    console.log('\n📊 Aggregated profile:');
    console.log(`  Username: @${profile.username}`);
    console.log(`  Followers: ${profile.followerCount.toLocaleString()}`);
    console.log(`  30-day posts: ${profile.posts30d}`);
    console.log(`  30-day views: ${profile.viewsTotal.toLocaleString()}`);
    console.log(`  30-day likes: ${profile.likesTotal.toLocaleString()}`);
    console.log(`  30-day comments: ${profile.commentsTotal.toLocaleString()}`);
    console.log(`  30-day shares: ${profile.sharesTotal.toLocaleString()}`);
    console.log(`  Engagement rate: ${profile.engagementRate.toFixed(2)}%`);
    
    // 5. Save to database
    console.log('\n4️⃣  Saving to database...');
    const client = await pool.connect();
    
    try {
      await client.query(`
        INSERT INTO tiktok_profiles (
          username, nick_name, avatar, signature, verified,
          follower_count, following_count, total_videos, total_hearts,
          posts_30d, views_total, likes_total, comments_total, shares_total,
          engagement_rate, "lastUpdated"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
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
        new Date()
      ]);
      
      console.log('✅ Saved to database successfully');
      
      // 6. Verify the save
      console.log('\n5️⃣  Verifying database save...');
      const verifyResult = await client.query(
        'SELECT username, follower_count, posts_30d, views_total, likes_total, comments_total, shares_total, engagement_rate FROM tiktok_profiles WHERE username = $1',
        ['cristiano']
      );
      
      if (verifyResult.rows.length > 0) {
        const saved = verifyResult.rows[0];
        console.log('✅ Verified in database:');
        console.log(`  Followers: ${saved.follower_count?.toLocaleString()}`);
        console.log(`  30-day posts: ${saved.posts_30d}`);
        console.log(`  30-day views: ${saved.views_total?.toLocaleString()}`);
        console.log(`  30-day likes: ${saved.likes_total?.toLocaleString()}`);
        console.log(`  30-day comments: ${saved.comments_total?.toLocaleString()}`);
        console.log(`  30-day shares: ${saved.shares_total?.toLocaleString()}`);
        console.log(`  Engagement rate: ${saved.engagement_rate?.toFixed(2)}%`);
      }
      
    } finally {
      client.release();
    }
    
    console.log('\n✅ Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await pool.end();
  }
}

testFetchAndSave().catch(console.error);