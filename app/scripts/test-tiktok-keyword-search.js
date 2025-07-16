#!/usr/bin/env node

/**
 * Test TikTok keyword search functionality
 * Tests just Step A of the pipeline - searching for videos by keyword
 */

const fetch = require('node-fetch');

const API_BASE_URL = 'http://localhost:3000';

async function testKeywordSearch() {
  try {
    console.log('🔍 Testing TikTok Keyword Search (Step A)\n');
    
    const keywords = ['ai recruiter', 'talent acquisition'];
    const videosPerKeyword = 5;
    
    console.log(`📍 Searching TikTok Video/Popular tab for keywords: ${keywords.join(', ')}`);
    console.log(`   Requesting ${videosPerKeyword} videos per keyword\n`);
    
    const response = await fetch(`${API_BASE_URL}/api/pipeline/tiktok-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keywords,
        limit: videosPerKeyword
      })
    });
    
    const responseText = await response.text();
    
    if (!response.ok) {
      console.error('❌ Search failed with status:', response.status);
      console.error('Response:', responseText);
      return;
    }
    
    const data = JSON.parse(responseText);
    
    console.log('✅ Search completed!');
    console.log(`   - Total unique creators found: ${data.searchResults.profilesFound}`);
    
    if (data.searchResults.profiles && data.searchResults.profiles.length > 0) {
      console.log(`\n📊 Creator handles extracted from videos:`);
      data.searchResults.profiles.forEach((profile, i) => {
        console.log(`   ${i + 1}. @${profile}`);
      });
      
      console.log(`\n✨ Success! The keyword search is working and extracting creator handles from video results.`);
    } else {
      console.log('\n⚠️  No profiles found. Possible issues:');
      console.log('   - The actor might be failing to scrape');
      console.log('   - The keywords might not have results');
      console.log('   - The input format might be incorrect');
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Check if server is running on port 3000');
    console.error('2. Check logs: tail -f logs/dev.log | grep -i "tiktok"');
    console.error('3. Verify the actor clockworks/tiktok-scraper is accessible');
  }
}

// Run the test
console.log('Starting TikTok Keyword Search Test...\n');
testKeywordSearch();