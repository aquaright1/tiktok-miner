#!/usr/bin/env node

// Check if a user exists via API endpoint
const fetch = require('node-fetch');

async function checkUserViaAPI(username) {
  try {
    console.log(`🔍 Checking for user: ${username}\n`);
    
    // Create a simple API endpoint to check the user
    const response = await fetch(`http://localhost:3000/api/creators?search=${username}&limit=50`);
    
    if (!response.ok) {
      console.log('❌ API request failed:', response.status, response.statusText);
      return;
    }
    
    const data = await response.json();
    
    if (data.creators && data.creators.length > 0) {
      console.log(`✅ Found ${data.creators.length} creators matching "${username}":`);
      
      data.creators.forEach((creator, i) => {
        console.log(`${i + 1}. @${creator.username} (${creator.platform})`);
        console.log(`   Name: ${creator.name || 'N/A'}`);
        console.log(`   Followers: ${creator.followerCount?.toLocaleString() || 0}`);
        console.log(`   Platform: ${creator.platform}`);
        console.log(`   URL: ${creator.profileUrl || 'N/A'}`);
        console.log('');
      });
    } else {
      console.log(`❌ No creators found matching "${username}"`);
      console.log('🔍 Checking total TikTok creators...');
      
      // Get total TikTok count
      const totalResponse = await fetch(`http://localhost:3000/api/creators?platform=tiktok&limit=100`);
      if (totalResponse.ok) {
        const totalData = await totalResponse.json();
        console.log(`📊 Total TikTok creators in system: ${totalData.creators?.length || 0}`);
        
        if (totalData.creators && totalData.creators.length > 0) {
          console.log('🔍 Recent TikTok creators:');
          totalData.creators.slice(0, 5).forEach((creator, i) => {
            console.log(`  ${i + 1}. @${creator.username}`);
          });
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

const username = process.argv[2] || 'sajjaadkhader';
checkUserViaAPI(username);