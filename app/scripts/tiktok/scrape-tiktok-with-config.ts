import { ApifyClient } from 'apify-client';
import { readFileSync, writeFileSync } from 'fs';

async function scrapeTikTokWithConfig() {
  console.log('🎯 Starting TikTok scraping with config file...\n');

  // Read the configuration
  const configPath = '/home/azureuser/tiktok-miner/data/configs/tiktok-scraper-config.json';
  const config = JSON.parse(readFileSync(configPath, 'utf-8'));
  
  // Fix the profileScrapeSections - it needs at least one item
  if (!config.profileScrapeSections || config.profileScrapeSections.length === 0) {
    config.profileScrapeSections = ['videos'];  // Scrape videos from profiles
  }
  
  console.log('📋 Configuration loaded:');
  console.log(`   Search queries: ${config.searchQueries.join(', ')}`);
  console.log(`   Results per page: ${config.resultsPerPage}`);
  console.log(`   Max profiles per query: ${config.maxProfilesPerQuery}\n`);

  // Initialize Apify client
  const client = new ApifyClient({
    token: process.env.APIFY_API_KEY || 'your_apify_api_key_here'
  });

  // TikTok Scraper Actor ID (from your .env file)
  const actorId = process.env.APIFY_TIKTOK_SCRAPER_ID || 'GdWCkxBtKWOsKjdch';

  try {
    console.log('🚀 Starting Apify actor run...');
    
    // Run the actor with the config
    const run = await client.actor(actorId).call(config);
    
    console.log(`✅ Actor run started with ID: ${run.id}`);
    console.log(`   Status: ${run.status}`);
    console.log(`   Dataset ID: ${run.defaultDatasetId}`);
    
    // Wait for the run to finish
    console.log('\n⏳ Waiting for scraping to complete...');
    await client.run(run.id).waitForFinish();
    
    console.log('✅ Scraping completed! Fetching results...\n');
    
    // Get the results from the dataset
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    
    console.log(`📊 Found ${items.length} results`);
    
    // Process and display the first 5 results
    const profiles: any[] = [];
    const displayLimit = Math.min(5, items.length);
    
    for (let i = 0; i < displayLimit; i++) {
      const item = items[i];
      console.log(`\n👤 Profile ${i + 1}:`);
      console.log(`   Username: @${item.authorMeta?.name || item.username || 'N/A'}`);
      console.log(`   Nickname: ${item.authorMeta?.nickName || item.nickname || 'N/A'}`);
      console.log(`   Bio: ${(item.authorMeta?.signature || item.signature || 'N/A').substring(0, 100)}...`);
      console.log(`   Followers: ${(item.authorMeta?.fans || item.followers || 0).toLocaleString()}`);
      console.log(`   Following: ${(item.authorMeta?.following || item.following || 0).toLocaleString()}`);
      console.log(`   Hearts: ${(item.authorMeta?.heart || item.hearts || 0).toLocaleString()}`);
      console.log(`   Videos: ${(item.authorMeta?.video || item.videoCount || 0).toLocaleString()}`);
      
      profiles.push({
        username: item.authorMeta?.name || item.username,
        nickname: item.authorMeta?.nickName || item.nickname,
        bio: item.authorMeta?.signature || item.signature,
        followers: item.authorMeta?.fans || item.followers || 0,
        following: item.authorMeta?.following || item.following || 0,
        hearts: item.authorMeta?.heart || item.hearts || 0,
        videoCount: item.authorMeta?.video || item.videoCount || 0,
        verified: item.authorMeta?.verified || item.verified || false,
        avatar: item.authorMeta?.avatar || item.avatarThumb,
        scrapedAt: new Date().toISOString()
      });
    }
    
    // Save all results to file
    const outputFile = `tiktok-scraped-profiles-${new Date().toISOString().split('T')[0]}.json`;
    writeFileSync(outputFile, JSON.stringify({
      config: config,
      totalResults: items.length,
      profiles: items.map(item => ({
        username: item.authorMeta?.name || item.username,
        nickname: item.authorMeta?.nickName || item.nickname,
        bio: item.authorMeta?.signature || item.signature,
        followers: item.authorMeta?.fans || item.followers || 0,
        following: item.authorMeta?.following || item.following || 0,
        hearts: item.authorMeta?.heart || item.hearts || 0,
        videoCount: item.authorMeta?.video || item.videoCount || 0,
        verified: item.authorMeta?.verified || item.verified || false,
        avatar: item.authorMeta?.avatar || item.avatarThumb,
        scrapedAt: new Date().toISOString()
      }))
    }, null, 2));
    
    console.log(`\n💾 Full results saved to: ${outputFile}`);
    
    // Summary statistics
    const totalFollowers = profiles.reduce((sum, p) => sum + p.followers, 0);
    const avgFollowers = Math.round(totalFollowers / profiles.length);
    
    console.log('\n📈 Summary Statistics:');
    console.log(`   Total profiles scraped: ${items.length}`);
    console.log(`   Profiles displayed: ${displayLimit}`);
    console.log(`   Average followers (first 5): ${avgFollowers.toLocaleString()}`);
    console.log(`   Run cost: ${run.usageUsd ? `$${run.usageUsd.toFixed(4)}` : 'N/A'}`);
    
    return profiles;
    
  } catch (error) {
    console.error('❌ Error during scraping:', error);
    throw error;
  }
}

// Run the scraper
scrapeTikTokWithConfig()
  .then(() => {
    console.log('\n✅ All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });