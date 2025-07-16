#!/usr/bin/env node

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/database';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function debugMetrics() {
  const client = await pool.connect();
  
  try {
    // Get a sample profile with metrics
    const result = await client.query(`
      SELECT 
        username,
        follower_count,
        posts_30d,
        views_total,
        likes_total,
        comments_total,
        shares_total,
        engagement_rate,
        "lastUpdated"
      FROM tiktok_profiles
      WHERE username IN ('zachking', 'example_user', 'wfhmuva')
      ORDER BY "lastUpdated" DESC
    `);
    
    console.log('📊 Raw database metrics:\n');
    result.rows.forEach(row => {
      console.log(`@${row.username}:`);
      console.log(`  Followers: ${row.follower_count?.toLocaleString()}`);
      console.log(`  30-day posts: ${row.posts_30d}`);
      console.log(`  Total views: ${row.views_total}`);
      console.log(`  Total likes: ${row.likes_total}`);
      console.log(`  Total comments: ${row.comments_total}`);
      console.log(`  Total shares: ${row.shares_total}`);
      console.log(`  Engagement rate: ${row.engagement_rate}%`);
      console.log(`  Last updated: ${row.lastUpdated}`);
      console.log('');
    });
    
  } finally {
    client.release();
    await pool.end();
  }
}

debugMetrics().catch(console.error);