#!/usr/bin/env node

/**
 * Test script to add 10 TikTok creators to the database
 * Uses a simple approach: provide handles directly and run through 30-day pipeline
 */

const fetch = require('node-fetch');

const API_BASE_URL = 'http://localhost:3000';

// List of popular TikTok creators in tech/recruiting space
const TIKTOK_HANDLES = [
  'careertok',
  'resumegenius',
  'workitdaily',
  'thejobsauce',
  'hrbitch',
  'corporatenatalie',
  'thecareercoachuk',
  'aimhirerecruiting',
  'recruitertips',
  'techjobadvice'
];

async function addCreatorsToDatabase() {
  try {
    console.log('🚀 Adding 10 TikTok Creators to Database\n');
    console.log('Creators to add:', TIKTOK_HANDLES.join(', '));
    console.log('\n📍 Running TikTok 30-day pipeline...\n');
    
    const pipelineResponse = await fetch(`${API_BASE_URL}/api/pipeline/tiktok-30d`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profiles: TIKTOK_HANDLES
      })
    });
    
    if (!pipelineResponse.ok) {
      const error = await pipelineResponse.text();
      throw new Error(`Pipeline failed: ${error}`);
    }
    
    const pipelineData = await pipelineResponse.json();
    
    console.log('✅ Pipeline started successfully!');
    console.log(`   - Run ID: ${pipelineData.runId}`);
    console.log(`   - Processing ${pipelineData.profileCount} profiles`);
    console.log(`   - Status: ${pipelineData.status}`);
    
    console.log('\n⏳ The pipeline is now running. It will:');
    console.log('   1. Scrape each profile to get their recent videos');
    console.log('   2. Filter videos from the last 30 days');
    console.log('   3. Calculate engagement metrics (likes, comments, views, shares)');
    console.log('   4. Save the data to the tiktok_profiles table');
    
    console.log('\n📊 Monitor progress:');
    console.log(`   - Apify Console: https://console.apify.com/runs/${pipelineData.runId}`);
    console.log(`   - Check logs: tail -f logs/dev.log | grep -i tiktok`);
    console.log(`   - Query database in 2-3 minutes:`);
    console.log(`     SELECT username, posts_30d, likes_total, views_total, follower_count`);
    console.log(`     FROM tiktok_profiles`);
    console.log(`     WHERE username IN ('${TIKTOK_HANDLES.join("', '")}');`);
    
    // Wait a bit and check early results
    console.log('\n⏳ Waiting 45 seconds to check for early results...');
    await new Promise(resolve => setTimeout(resolve, 45000));
    
    // Check if any profiles have been added
    const checkResponse = await fetch(`${API_BASE_URL}/api/creators?table=tiktok_profiles&limit=20`);
    if (checkResponse.ok) {
      const checkData = await checkResponse.json();
      if (checkData.creators && checkData.creators.length > 0) {
        console.log(`\n✅ Found ${checkData.creators.length} profiles in database!`);
        
        // Check specifically for our added profiles
        const ourProfiles = checkData.creators.filter(c => 
          TIKTOK_HANDLES.includes(c.username)
        );
        
        if (ourProfiles.length > 0) {
          console.log(`\n🎉 Successfully added ${ourProfiles.length} of our profiles:`);
          ourProfiles.forEach(creator => {
            console.log(`   - @${creator.username}:`);
            console.log(`     • ${creator.posts30d || 0} posts in last 30 days`);
            console.log(`     • ${(creator.likesTotal || 0).toLocaleString()} total likes`);
            console.log(`     • ${(creator.viewsTotal || 0).toLocaleString()} total views`);
            console.log(`     • ${(creator.followerCount || 0).toLocaleString()} followers`);
          });
        }
      }
    }
    
    console.log('\n✅ Test completed! The pipeline will continue running in the background.');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Check if dev server is running on port 3000');
    console.error('2. Verify Apify API key is valid');
    console.error('3. Check if clockworks/tiktok-profile-scraper actor is accessible');
    console.error('4. Monitor logs: tail -f logs/dev.log');
  }
}

// Run the test
console.log('Starting TikTok Creator Addition Test...\n');
addCreatorsToDatabase();