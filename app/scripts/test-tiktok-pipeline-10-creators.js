#!/usr/bin/env node

/**
 * Test TikTok Pipeline - Add 10 creators to database
 * Uses the new pipeline: epctex/tiktok-search-scraper → extract handles → profile scraper → 30d reducer
 */

const fetch = require('node-fetch');

const API_BASE_URL = 'http://localhost:3000';

async function testPipeline() {
  try {
    console.log('🚀 Testing TikTok Pipeline - Adding 10 Creators\n');
    console.log('Pipeline: Search Top tab → Extract handles → Profile scrape → 30d aggregation\n');
    
    // Step 1: Search for videos in Popular section
    const keywords = ['ai recruiter', 'talent acquisition'];  // Multiple keywords to get more creators
    const videosPerKeyword = 5;  // 5 videos per keyword as per instructions
    
    console.log(`📍 Step 1: Searching TikTok "Popular" section for keywords: ${keywords.join(', ')}`);
    console.log(`   Requesting ${videosPerKeyword} popular videos per keyword...\n`);
    
    const searchResponse = await fetch(`${API_BASE_URL}/api/pipeline/tiktok-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keywords,
        limit: videosPerKeyword
      })
    });
    
    if (!searchResponse.ok) {
      const error = await searchResponse.text();
      throw new Error(`Search failed: ${error}`);
    }
    
    const searchData = await searchResponse.json();
    
    console.log('✅ Search completed!');
    console.log(`   - Videos found: ${searchData.searchResults.videosFound || 'N/A'}`);
    console.log(`   - Unique creators found: ${searchData.searchResults.profilesFound}`);
    
    if (searchData.searchResults.profiles && searchData.searchResults.profiles.length > 0) {
      const profilesToAdd = searchData.searchResults.profiles.slice(0, 10);
      console.log(`   - First 10 creators: ${profilesToAdd.join(', ')}`);
      
      if (searchData.pipeline) {
        console.log('\n📍 Step 2-4: Pipeline running automatically');
        console.log(`   - Pipeline Run ID: ${searchData.pipeline.runId}`);
        console.log(`   - Processing ${searchData.pipeline.profileCount} profiles`);
        console.log(`   - Status: ${searchData.pipeline.status}`);
        
        console.log('\n⏳ Pipeline is processing the creators. Monitor progress:');
        console.log(`   1. Apify Console: https://console.apify.com/runs/${searchData.pipeline.runId}`);
        console.log(`   2. Check logs: tail -f /home/azureuser/tiktok-miner/app/logs/dev.log | grep -i tiktok`);
        console.log(`   3. Query database in 2-3 minutes:`);
        console.log(`      SELECT username, posts_30d, likes_total, views_total FROM tiktok_profiles ORDER BY last_updated DESC LIMIT 10;`);
        
        // Wait a bit and check if we can see early results
        console.log('\n⏳ Waiting 30 seconds before checking for early results...');
        await new Promise(resolve => setTimeout(resolve, 30000));
        
        // Check if any profiles have been added
        const checkResponse = await fetch(`${API_BASE_URL}/api/creators?table=tiktok_profiles&limit=10`);
        if (checkResponse.ok) {
          const checkData = await checkResponse.json();
          if (checkData.creators && checkData.creators.length > 0) {
            console.log(`\n✅ Found ${checkData.creators.length} profiles in database!`);
            console.log('Latest profiles:');
            checkData.creators.slice(0, 5).forEach(creator => {
              console.log(`   - @${creator.username}: ${creator.posts30d || 0} posts, ${creator.followerCount.toLocaleString()} followers`);
            });
          }
        }
      }
    } else {
      console.log('\n⚠️  No profiles found. The search might have failed or returned no results.');
    }
    
    console.log('\n✅ Test completed!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Check if dev server is running on port 3001');
    console.error('2. Verify new API key is loaded (restart server if needed)');
    console.error('3. Check if epctex/tiktok-search-scraper actor exists');
    console.error('4. Monitor logs: tail -f logs/dev.log');
  }
}

// Run the test
console.log('Starting TikTok Pipeline Test...\n');
testPipeline();