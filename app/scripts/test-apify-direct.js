#!/usr/bin/env node

/**
 * Test Apify API directly with the exact input format from pipeline instructions
 */

const fetch = require('node-fetch');

async function testApifyDirect() {
  const searchInput = {
    "hashtags": ["collegeconsulting"],  // Try hashtags instead of search queries
    "resultsPerPage": 5,  // X videos per keyword
    "proxyCountryCode": "None",
    "excludePinnedPosts": false,
    "scrapeRelatedVideos": false,
    "shouldDownloadAvatars": false,
    "shouldDownloadCovers": false,
    "shouldDownloadMusicCovers": false,
    "shouldDownloadSlideshowImages": false,
    "shouldDownloadSubtitles": false,
    "shouldDownloadVideos": false,
    "profileScrapeSections": ["videos"],
    "profileSorting": "Popular",
    "maxProfilesPerQuery": 10
  };

  console.log('Testing Apify API directly with input:');
  console.log(JSON.stringify(searchInput, null, 2));

  try {
    const response = await fetch('https://api.apify.com/v2/acts/clockworks~tiktok-scraper/runs', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.APIFY_API_KEY || 'your_apify_api_key_here'}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input: searchInput })
    });
    
    const data = await response.json();
    console.log('\nApify API response:');
    console.log(JSON.stringify(data, null, 2));
    
    if (data.data?.id) {
      console.log(`\nRun started with ID: ${data.data.id}`);
      console.log(`Check status at: https://console.apify.com/view/runs/${data.data.id}`);
    }
    
  } catch (error) {
    console.error('Direct API test failed:', error);
  }
}

testApifyDirect();