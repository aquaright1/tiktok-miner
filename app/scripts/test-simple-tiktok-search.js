#!/usr/bin/env node

/**
 * Simple test for TikTok search using existing scraper endpoint
 */

const fetch = require('node-fetch');

const API_BASE_URL = 'http://localhost:3001';

async function testSimpleSearch() {
  try {
    console.log('🧪 Testing TikTok Search via Scraper Endpoint\n');
    
    const keywords = ['work from home', 'remote jobs'];
    
    console.log(`📍 Searching for TikTok profiles with keywords: ${keywords.join(', ')}`);
    
    const response = await fetch(`${API_BASE_URL}/api/scraper/scrape`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keywords,
        platforms: ['tiktok'],
        limit: 10
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Scraper failed: ${error}`);
    }
    
    const data = await response.json();
    
    console.log('\n✅ Search completed!');
    console.log(`   - Total profiles found: ${data.profiles.length}`);
    console.log(`   - TikTok profiles: ${data.profiles.filter(p => p.platform === 'tiktok').length}`);
    
    if (data.profiles.length > 0) {
      console.log('\n📊 Sample profiles:');
      data.profiles.slice(0, 5).forEach(profile => {
        console.log(`   - @${profile.username} (${profile.followerCount.toLocaleString()} followers)`);
      });
      
      // Now run these through the 30-day pipeline
      const tiktokProfiles = data.profiles
        .filter(p => p.platform === 'tiktok')
        .map(p => p.username);
      
      if (tiktokProfiles.length > 0) {
        console.log(`\n📍 Running ${tiktokProfiles.length} profiles through 30-day pipeline...`);
        
        const pipelineResponse = await fetch(`${API_BASE_URL}/api/pipeline/tiktok-30d`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profiles: tiktokProfiles
          })
        });
        
        if (pipelineResponse.ok) {
          const pipelineData = await pipelineResponse.json();
          console.log(`✅ Pipeline started: Run ID ${pipelineData.runId}`);
        }
      }
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  }
}

console.log('Starting TikTok Search Test...\n');
testSimpleSearch();