#!/usr/bin/env node

const query = process.argv[2] || 'work from home';
const limit = parseInt(process.argv[3]) || 20;

console.log(`🔍 Starting TikTok pipeline for query: "${query}" (limit: ${limit})`);

async function runPipeline() {
  try {
    // Step 1: Scrape profiles
    console.log('\n📡 Scraping TikTok profiles...');
    const scrapeResponse = await fetch('http://localhost:3001/api/scraper/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keywords: [query],
        platforms: ['tiktok'],
        limit
      })
    });

    if (!scrapeResponse.ok) {
      throw new Error(`Scraping failed: ${scrapeResponse.statusText}`);
    }

    const scrapeData = await scrapeResponse.json();
    
    if (!scrapeData.success || !scrapeData.profiles || scrapeData.profiles.length === 0) {
      console.log('❌ No profiles found');
      return;
    }

    console.log(`✅ Found ${scrapeData.profiles.length} profiles`);
    console.log('\nTop 5 profiles:');
    scrapeData.profiles.slice(0, 5).forEach(p => {
      console.log(`  - @${p.username} (${p.followerCount.toLocaleString()} followers)`);
    });

    // Step 2: Save profiles to database
    console.log('\n💾 Saving profiles to database...');
    const saveResponse = await fetch('http://localhost:3001/api/scraper/save-profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scrapeData)
    });

    if (!saveResponse.ok) {
      throw new Error(`Saving failed: ${saveResponse.statusText}`);
    }

    const saveData = await saveResponse.json();
    
    if (saveData.success) {
      console.log(`✅ Successfully saved ${saveData.stats.saved} profiles`);
      if (saveData.stats.failed > 0) {
        console.log(`⚠️  Failed to save ${saveData.stats.failed} profiles`);
      }
    } else {
      console.log('❌ Failed to save profiles');
    }

    // Step 3: Optional - Run 30-day pipeline for detailed metrics
    console.log('\n📊 Running 30-day metrics pipeline (this may take a while)...');
    const pipelineResponse = await fetch('http://localhost:3001/api/pipeline/tiktok-30d', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profiles: scrapeData.profiles.map(p => p.username).slice(0, 10) // Limit to 10 for speed
      })
    });

    if (pipelineResponse.ok) {
      const pipelineData = await pipelineResponse.json();
      console.log(`✅ Started 30-day pipeline: ${pipelineData.runId}`);
      console.log('   Check webhook logs for completion status');
    } else {
      console.log('⚠️  30-day pipeline failed to start (optional)');
    }

    console.log('\n🎉 Pipeline complete!');
    console.log(`   View profiles at: http://localhost:3001/creators`);

  } catch (error) {
    console.error('❌ Pipeline error:', error.message);
    process.exit(1);
  }
}

runPipeline();