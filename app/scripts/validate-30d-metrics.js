#!/usr/bin/env node

/**
 * Validation script for 30-day metrics collection
 */

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/database';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function validateMetrics() {
  console.log('🔍 Validating 30-day metrics in database\n');
  
  const client = await pool.connect();
  
  try {
    // 1. Check profiles with non-zero metrics
    const metricsResult = await client.query(`
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
      WHERE (views_total > 0 OR likes_total > 0 OR comments_total > 0 OR shares_total > 0)
      ORDER BY "lastUpdated" DESC
      LIMIT 10
    `);
    
    console.log(`📊 Profiles with 30-day metrics: ${metricsResult.rows.length}\n`);
    
    if (metricsResult.rows.length === 0) {
      console.log('❌ No profiles found with 30-day metrics');
      console.log('   This indicates the pipeline is not collecting metrics properly');
    } else {
      console.log('✅ Found profiles with metrics:\n');
      
      metricsResult.rows.forEach(row => {
        console.log(`@${row.username}:`);
        console.log(`  Followers: ${row.follower_count?.toLocaleString()}`);
        console.log(`  30-day posts: ${row.posts_30d}`);
        console.log(`  30-day views: ${row.views_total?.toLocaleString()}`);
        console.log(`  30-day likes: ${row.likes_total?.toLocaleString()}`);
        console.log(`  30-day comments: ${row.comments_total?.toLocaleString()}`);
        console.log(`  30-day shares: ${row.shares_total?.toLocaleString()}`);
        console.log(`  Engagement rate: ${row.engagement_rate?.toFixed(2)}%`);
        console.log(`  Last updated: ${new Date(row.lastUpdated).toLocaleString()}`);
        console.log('');
      });
    }
    
    // 2. Check recent updates
    const recentResult = await client.query(`
      SELECT COUNT(*) as count 
      FROM tiktok_profiles 
      WHERE "lastUpdated" > NOW() - INTERVAL '1 hour'
    `);
    
    console.log(`\n📅 Recent updates (last hour): ${recentResult.rows[0].count}`);
    
    // 3. Check engagement rate distribution
    const engagementResult = await client.query(`
      SELECT 
        COUNT(CASE WHEN engagement_rate = 0 THEN 1 END) as zero_engagement,
        COUNT(CASE WHEN engagement_rate > 0 AND engagement_rate < 1 THEN 1 END) as low_engagement,
        COUNT(CASE WHEN engagement_rate >= 1 AND engagement_rate < 5 THEN 1 END) as medium_engagement,
        COUNT(CASE WHEN engagement_rate >= 5 THEN 1 END) as high_engagement
      FROM tiktok_profiles
    `);
    
    const dist = engagementResult.rows[0];
    console.log('\n📈 Engagement Rate Distribution:');
    console.log(`  0%: ${dist.zero_engagement} profiles`);
    console.log(`  0-1%: ${dist.low_engagement} profiles`);
    console.log(`  1-5%: ${dist.medium_engagement} profiles`);
    console.log(`  5%+: ${dist.high_engagement} profiles`);
    
    // 4. Summary
    console.log('\n📋 Summary:');
    if (metricsResult.rows.length > 0) {
      console.log('✅ 30-day metrics collection is working');
      console.log('✅ Engagement rates are being calculated');
      console.log(`✅ Found ${metricsResult.rows.length} profiles with valid metrics`);
    } else {
      console.log('❌ No profiles have 30-day metrics');
      console.log('❌ Need to run the pipeline to collect data');
    }
    
  } finally {
    client.release();
    await pool.end();
  }
}

validateMetrics().catch(console.error);