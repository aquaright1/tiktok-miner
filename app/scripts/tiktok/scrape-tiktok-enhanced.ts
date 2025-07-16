#!/usr/bin/env node

/**
 * Enhanced TikTok scraper with detailed post data from last 30 days
 */

const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load .env file
dotenv.config({ path: path.join(__dirname, '.env') });

const { ActorManager } = require('./lib/apify/actor-manager');

async function scrapeEnhancedTikTokData() {
  console.log('🚀 Starting enhanced TikTok scraping with 30-day post data...\n');
  
  try {
    // Create actor manager
    const actorManager = new ActorManager({
      apiKey: process.env.APIFY_API_KEY,
    });
    
    // Load the enhanced configuration
    const config = JSON.parse(fs.readFileSync('../tiktok-scraper-config.json', 'utf8'));
    
    console.log('📝 Configuration loaded:');
    console.log(`   - Search queries: ${config.searchQueries.join(', ')}`);
    console.log(`   - Max videos per profile: ${config.maxVideosPerProfile}`);
    console.log(`   - Min followers: ${config.minFollowers}`);
    console.log('   - Enhanced data: Posts, likes, shares for last 30 days\n');
    
    // Run the scraper with enhanced configuration
    const result = await actorManager.runActor('tiktok', config);
    
    console.log('📊 Scraping initiated:', {
      runId: result.runId,
      status: result.status,
    });
    
    // Wait for completion and get results
    if (result.datasetId) {
      console.log('\n⏳ Waiting for scraping to complete...');
      
      // Poll for completion (simplified version)
      let attempts = 0;
      const maxAttempts = 30; // 15 minutes max
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds
        
        try {
          const profiles = await actorManager.getRunDataset(result.datasetId);
          
          if (profiles.length > 0) {
            console.log(`\n✅ Found ${profiles.length} profiles with enhanced data!`);
            break;
          }
          
          attempts++;
          console.log(`   Attempt ${attempts}/${maxAttempts} - Still scraping...`);
        } catch (error) {
          console.log(`   Attempt ${attempts}/${maxAttempts} - Still processing...`);
          attempts++;
        }
      }
      
      // Get final results
      const profiles = await actorManager.getRunDataset(result.datasetId);
      
      if (profiles.length > 0) {
        console.log(`\n🎉 Scraping complete! Found ${profiles.length} profiles\n`);
        
        // Save detailed results
        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `tiktok-enhanced-${timestamp}.json`;
        
        // Process and save results
        const processedProfiles = profiles.map(profile => ({
          // Basic profile info
          username: profile.authorMeta?.name || profile['authorMeta.name'],
          displayName: profile.authorMeta?.nickName || profile['authorMeta.nickName'],
          bio: profile.authorMeta?.signature || profile['authorMeta.signature'],
          followers: profile.authorMeta?.fans || profile['authorMeta.fans'],
          following: profile.authorMeta?.following || profile['authorMeta.following'],
          verified: profile.authorMeta?.verified || profile['authorMeta.verified'],
          
          // Enhanced engagement metrics (last 30 days)
          engagementMetrics: profile.engagementMetrics || {},
          
          // Detailed posts from last 30 days
          postsLast30Days: profile.postsLast30Days || [],
          
          // Content analysis
          contentAnalysis: profile.contentAnalysis || {},
          
          // Scraping metadata
          scrapedAt: new Date().toISOString(),
          dataSource: 'apify-enhanced'
        }));
        
        fs.writeFileSync(filename, JSON.stringify(processedProfiles, null, 2));
        console.log(`📁 Saved enhanced data to: ${filename}\n`);
        
        // Display sample results
        console.log('🏆 Sample results:\n');
        processedProfiles.slice(0, 3).forEach((profile, i) => {
          console.log(`${i + 1}. @${profile.username} (${profile.followers?.toLocaleString()} followers)`);
          console.log(`   Posts in last 30 days: ${profile.contentAnalysis?.postsInLast30Days || 0}`);
          console.log(`   Total engagement: ${profile.contentAnalysis?.totalEngagementLast30Days?.toLocaleString() || 0}`);
          console.log(`   Avg posts per day: ${profile.contentAnalysis?.avgPostsPerDay || 0}`);
          console.log(`   Engagement rate: ${profile.engagementMetrics?.engagementRate || 0}%`);
          
          if (profile.postsLast30Days && profile.postsLast30Days.length > 0) {
            const topPost = profile.postsLast30Days[0];
            console.log(`   Sample post: "${topPost.text?.substring(0, 60)}..."`);
            console.log(`   Post engagement: ${topPost.likes} likes, ${topPost.comments} comments, ${topPost.shares} shares`);
          }
          console.log('');
        });
        
        // Summary statistics
        const totalPosts = processedProfiles.reduce((sum, profile) => 
          sum + (profile.contentAnalysis?.postsInLast30Days || 0), 0);
        const totalEngagement = processedProfiles.reduce((sum, profile) => 
          sum + (profile.contentAnalysis?.totalEngagementLast30Days || 0), 0);
        
        console.log('📈 Summary Statistics:');
        console.log(`   Total creators: ${processedProfiles.length}`);
        console.log(`   Total posts (last 30 days): ${totalPosts}`);
        console.log(`   Total engagement: ${totalEngagement.toLocaleString()}`);
        console.log(`   Avg posts per creator: ${(totalPosts / processedProfiles.length).toFixed(1)}`);
        console.log(`   Avg engagement per creator: ${(totalEngagement / processedProfiles.length).toLocaleString()}`);
        
      } else {
        console.log('❌ No profiles found matching the criteria');
      }
    }
    
  } catch (error) {
    if (error.message.includes('Monthly usage hard limit exceeded')) {
      console.log('\n❌ Apify Monthly Limit Exceeded');
      console.log('Your Apify account has reached its monthly usage limit.');
      console.log('The scraper will work again when your monthly limit resets.');
      console.log('\n💡 In the meantime, you can:');
      console.log('   - Use the existing scraped data (90 profiles already imported)');
      console.log('   - Wait for the monthly limit reset');
      console.log('   - Upgrade your Apify plan for higher limits');
    } else {
      console.error('❌ Scraping failed:', error.message);
    }
  }
}

// Show usage information
console.log('🔧 Enhanced TikTok Scraper Configuration:');
console.log('   ✅ Filters creators with 5000+ followers');
console.log('   ✅ Filters by keywords: AI, tech, career, recruiter, recruiting');
console.log('   ✅ Collects posts from last 30 days only');
console.log('   ✅ Includes detailed engagement metrics (likes, comments, shares)');
console.log('   ✅ Provides content analysis and statistics');
console.log('   ✅ Exports structured data for easy import\n');

// Run the scraper
scrapeEnhancedTikTokData();