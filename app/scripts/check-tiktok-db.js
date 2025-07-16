#!/usr/bin/env node

// Direct database check without Prisma to avoid prepared statement conflicts
const { Pool } = require('pg');

// Parse connection string from environment
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/database';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function checkTikTokProfiles() {
  const client = await pool.connect();
  
  try {
    // Check total count
    const countResult = await client.query('SELECT COUNT(*) FROM tiktok_profiles');
    const totalCount = parseInt(countResult.rows[0].count);
    
    console.log(`\n📊 Total TikTok profiles in database: ${totalCount}`);
    
    // Get recent profiles
    const recentResult = await client.query(`
      SELECT username, follower_count, total_videos, engagement_rate, posts_30d, category, "lastUpdated"
      FROM tiktok_profiles
      ORDER BY "lastUpdated" DESC
      LIMIT 10
    `);
    
    if (recentResult.rows.length > 0) {
      console.log('\n📱 Recent TikTok profiles:\n');
      recentResult.rows.forEach(profile => {
        console.log(`✓ @${profile.username}`);
        console.log(`  Followers: ${profile.follower_count?.toLocaleString() || 'N/A'}`);
        console.log(`  Total videos: ${profile.total_videos || 'N/A'}`);
        console.log(`  30-day posts: ${profile.posts_30d || 'N/A'}`);
        console.log(`  Engagement rate: ${profile.engagement_rate?.toFixed(2) || 'N/A'}%`);
        if (profile.category) {
          console.log(`  Category: ${profile.category}`);
        }
        console.log(`  Last updated: ${profile.lastUpdated}`);
        console.log('');
      });
    }
    
    // Check for specific users if provided
    const userToCheck = process.argv[2];
    if (userToCheck) {
      const userResult = await client.query(
        'SELECT * FROM tiktok_profiles WHERE username = $1',
        [userToCheck]
      );
      
      if (userResult.rows.length > 0) {
        const profile = userResult.rows[0];
        console.log(`\n✅ Found user @${userToCheck} in database!`);
        console.log(`  Followers: ${profile.follower_count?.toLocaleString() || 'N/A'}`);
        console.log(`  30-day posts: ${profile.posts_30d || 0}`);
        console.log(`  30-day likes: ${profile.likes_total?.toLocaleString() || 0}`);
        console.log(`  30-day comments: ${profile.comments_total?.toLocaleString() || 0}`);
        console.log(`  30-day views: ${profile.views_total?.toLocaleString() || 0}`);
        console.log(`  30-day shares: ${profile.shares_total?.toLocaleString() || 0}`);
        console.log(`  Engagement rate: ${profile.engagement_rate?.toFixed(2) || 0}%`);
        if (profile.category) {
          console.log(`  Category: ${profile.category}`);
        }
      } else {
        console.log(`\n❌ User @${userToCheck} not found in database`);
      }
    }
    
  } catch (error) {
    console.error('❌ Database error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkTikTokProfiles().catch(console.error);