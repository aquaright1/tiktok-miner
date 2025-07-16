#!/usr/bin/env node

// Debug script to check the actual data structure from Apify
const fetch = require('node-fetch');

const APIFY_API_KEY = process.env.APIFY_API_KEY || 'your_apify_api_key_here';

async function debugApifyData() {
  try {
    // Get most recent run
    const runsResponse = await fetch('https://api.apify.com/v2/acts/clockworks~tiktok-profile-scraper/runs?limit=1', {
      headers: {
        'Authorization': `Bearer ${APIFY_API_KEY}`
      }
    });
    
    const runs = await runsResponse.json();
    if (runs.data.items.length === 0) {
      console.log('No recent runs found');
      return;
    }
    
    const latestRun = runs.data.items[0];
    console.log('Latest run:', latestRun.id);
    console.log('Status:', latestRun.status);
    console.log('Dataset ID:', latestRun.defaultDatasetId);
    
    if (latestRun.status !== 'SUCCEEDED') {
      console.log('Run not completed yet');
      return;
    }
    
    // Fetch first few items from dataset
    const dataResponse = await fetch(`https://api.apify.com/v2/datasets/${latestRun.defaultDatasetId}/items?limit=3`, {
      headers: {
        'Authorization': `Bearer ${APIFY_API_KEY}`
      }
    });
    
    const items = await dataResponse.json();
    console.log('\nFound', items.length, 'items\n');
    
    if (items.length > 0) {
      console.log('First item structure:');
      console.log('===================');
      
      const firstItem = items[0];
      console.log('\nTop-level keys:', Object.keys(firstItem));
      
      // Check for video metrics
      console.log('\nVideo metrics fields:');
      console.log('- diggCount:', firstItem.diggCount);
      console.log('- commentCount:', firstItem.commentCount);
      console.log('- playCount:', firstItem.playCount);
      console.log('- shareCount:', firstItem.shareCount);
      console.log('- createTime:', firstItem.createTime);
      console.log('- createTimeISO:', firstItem.createTimeISO);
      
      // Check stats object
      console.log('\nstats object:', firstItem.stats);
      
      // Check authorMeta
      console.log('\nauthorMeta:', JSON.stringify(firstItem.authorMeta, null, 2));
      
      // Check authorStats
      console.log('\nauthorStats:', firstItem.authorStats);
      
      // Show full first item
      console.log('\n\nFull first item (trimmed):');
      console.log(JSON.stringify({
        ...firstItem,
        desc: firstItem.desc ? firstItem.desc.substring(0, 100) + '...' : '',
      }, null, 2));
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

debugApifyData();