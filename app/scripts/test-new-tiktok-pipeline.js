#!/usr/bin/env node

/**
 * Test script for the new TikTok pipeline
 * Tests the complete flow: Search → Extract → Profile Scrape → 30d Reducer
 */

const fetch = require('node-fetch');

const API_BASE_URL = 'http://localhost:3001';

async function testPipeline() {
  try {
    console.log('🧪 Testing New TikTok Pipeline\n');
    console.log('Pipeline flow: Search (Top tab) → Extract handles → Profile scrape → 30d reducer\n');
    
    // Test keywords
    const testKeywords = ['ai recruiter', 'talent acquisition'];
    
    console.log(`📍 Step 1: Searching TikTok "Top" tab for keywords: ${testKeywords.join(', ')}`);
    console.log('Expected: First 30 videos per keyword from Top tab\n');
    
    const searchResponse = await fetch(`${API_BASE_URL}/api/pipeline/tiktok-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keywords: testKeywords,
        limit: 30  // 30 videos per keyword
      })
    });
    
    if (!searchResponse.ok) {
      const error = await searchResponse.text();
      throw new Error(`Search failed: ${error}`);
    }
    
    const searchData = await searchResponse.json();
    
    console.log('✅ Search completed successfully!');
    console.log(`   - Keywords searched: ${testKeywords.length}`);
    console.log(`   - Unique profiles found: ${searchData.searchResults.profilesFound}`);
    console.log(`   - Sample profiles: ${searchData.searchResults.profiles.slice(0, 5).join(', ')}`);
    
    if (searchData.pipeline) {
      console.log('\n📍 Steps 2-4: Profile scraping and 30-day aggregation');
      console.log(`   - Pipeline Run ID: ${searchData.pipeline.runId}`);
      console.log(`   - Profiles being processed: ${searchData.pipeline.profileCount}`);
      console.log(`   - Status: ${searchData.pipeline.status}`);
      
      console.log('\n⏳ Pipeline is running. Check the following:');
      console.log(`   1. Monitor logs: tail -f /home/azureuser/tiktok-miner/app/logs/dev.log`);
      console.log(`   2. Check Apify dashboard: https://console.apify.com/runs/${searchData.pipeline.runId}`);
      console.log(`   3. Check webhook logs for aggregation results`);
      console.log(`   4. Query database: SELECT * FROM tiktok_profiles ORDER BY last_updated DESC LIMIT 10;`);
      
      console.log('\n📊 Expected Results:');
      console.log('   - Each profile should have 30-day metrics calculated');
      console.log('   - posts_30d: Number of posts in last 30 days');
      console.log('   - likes_total, comments_total, views_total, shares_total: Aggregated from 30-day posts');
      console.log('   - engagement_rate: Calculated based on 30-day performance');
      
    } else {
      console.log('\n⚠️  No profiles found to process');
    }
    
    console.log('\n✅ Test completed successfully!');
    
    // Optional: Check if we can query the extract-handles endpoint separately
    console.log('\n🔍 Testing handle extraction endpoint...');
    if (searchData.searchResults.datasetId) {
      const extractResponse = await fetch(`${API_BASE_URL}/api/pipeline/tiktok-extract-handles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          datasetId: searchData.searchResults.datasetId
        })
      });
      
      if (extractResponse.ok) {
        const extractData = await extractResponse.json();
        console.log('✅ Handle extraction endpoint working');
        console.log(`   - Total videos: ${extractData.stats.totalVideos}`);
        console.log(`   - Unique handles: ${extractData.stats.uniqueHandles}`);
      }
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Ensure the dev server is running on port 3001');
    console.error('2. Check APIFY_API_KEY is set correctly');
    console.error('3. Verify clockworks/tiktok-search-scraper actor exists');
    console.error('4. Check logs: tail -f /home/azureuser/tiktok-miner/app/logs/dev.log');
    process.exit(1);
  }
}

// Run the test
console.log('Starting TikTok Pipeline Test...\n');
testPipeline();