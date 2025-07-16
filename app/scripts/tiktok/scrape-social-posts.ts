#!/usr/bin/env tsx
/**
 * Social Media Posts Scraper
 * Scrapes posts, likes, shares, and engagement metrics from Instagram, YouTube, and LinkedIn
 * using Apify for the last 30 days
 */

import { ApifyClient } from './app/lib/apify/client';
import { loadApifyConfig, getActorConfig } from './app/lib/apify/config';
import { logger } from './app/lib/logger';
import fs from 'fs';
import path from 'path';

interface ScrapingConfig {
  platform: string;
  actorId: string;
  input: any;
  outputFile: string;
}

async function loadScrapingConfig(platform: string): Promise<ScrapingConfig> {
  const configPath = path.join(__dirname, `${platform}-posts-scraper-config.json`);
  
  if (!fs.existsSync(configPath)) {
    throw new Error(`Configuration file not found: ${configPath}`);
  }
  
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  
  return {
    platform,
    actorId: config.actorId,
    input: config.input,
    outputFile: `${platform}-posts-scraped-${new Date().toISOString().split('T')[0]}.json`
  };
}

async function scrapePostsFromPlatform(
  client: ApifyClient,
  config: ScrapingConfig,
  searchQuery?: string
): Promise<any[]> {
  try {
    logger.info(`Starting ${config.platform} posts scraping`, { 
      actorId: config.actorId,
      searchQuery 
    });

    // Customize input based on search query
    const input = { ...config.input };
    
    if (searchQuery) {
      if (config.platform === 'instagram') {
        input.search = searchQuery;
      } else if (config.platform === 'youtube') {
        input.searchKeywords = searchQuery;
      } else if (config.platform === 'linkedin') {
        input.searchKeywords = searchQuery;
      }
    }

    // Start the actor
    const result = await client.callActor({
      actorId: config.actorId,
      input,
      waitForFinish: 3600, // 1 hour timeout
      timeoutSecs: 3600,
      memoryMbytes: 1024,
    });

    if (!result.datasetId) {
      logger.error(`No dataset ID returned for ${config.platform}`);
      return [];
    }

    // Get all scraped data
    const scrapedData = await client.getAllDatasetItems(result.datasetId);
    
    logger.info(`Successfully scraped ${scrapedData.length} posts from ${config.platform}`);
    
    // Save to file
    const outputPath = path.join(__dirname, config.outputFile);
    fs.writeFileSync(outputPath, JSON.stringify(scrapedData, null, 2));
    
    logger.info(`Saved ${config.platform} posts to ${outputPath}`);
    
    return scrapedData;
  } catch (error) {
    logger.error(`Failed to scrape ${config.platform} posts`, { error });
    throw error;
  }
}

async function main() {
  try {
    // Load Apify configuration
    const apifyConfig = loadApifyConfig();
    const client = new ApifyClient(apifyConfig);
    
    // Validate API key
    const isValid = await client.validateApiKey();
    if (!isValid) {
      throw new Error('Invalid Apify API key');
    }
    
    // Get search query from command line arguments
    const searchQuery = process.argv[2];
    const platforms = process.argv.slice(3);
    
    if (!searchQuery) {
      console.log('Usage: npx tsx scrape-social-posts.ts <search-query> [platforms...]');
      console.log('Example: npx tsx scrape-social-posts.ts "artificial intelligence" instagram youtube linkedin');
      console.log('Available platforms: instagram, youtube, linkedin');
      process.exit(1);
    }
    
    // Default to all platforms if none specified
    const targetPlatforms = platforms.length > 0 ? platforms : ['instagram', 'youtube', 'linkedin'];
    
    logger.info('Starting social media posts scraping', {
      searchQuery,
      platforms: targetPlatforms,
    });
    
    const results = [];
    
    // Process each platform
    for (const platform of targetPlatforms) {
      try {
        const config = await loadScrapingConfig(platform);
        const scrapedData = await scrapePostsFromPlatform(client, config, searchQuery);
        
        results.push({
          platform,
          count: scrapedData.length,
          data: scrapedData,
          outputFile: config.outputFile,
        });
        
        // Add delay between platforms to avoid rate limits
        if (targetPlatforms.indexOf(platform) < targetPlatforms.length - 1) {
          logger.info('Waiting 10 seconds before next platform...');
          await new Promise(resolve => setTimeout(resolve, 10000));
        }
        
      } catch (error) {
        logger.error(`Failed to scrape ${platform}`, { error });
        results.push({
          platform,
          count: 0,
          error: error.message,
          outputFile: null,
        });
      }
    }
    
    // Save combined results
    const summaryPath = path.join(__dirname, `social-posts-summary-${new Date().toISOString().split('T')[0]}.json`);
    fs.writeFileSync(summaryPath, JSON.stringify({
      searchQuery,
      scrapedAt: new Date().toISOString(),
      results,
      totalPosts: results.reduce((sum, r) => sum + r.count, 0),
    }, null, 2));
    
    // Print summary
    console.log('\n=== SCRAPING SUMMARY ===');
    console.log(`Search Query: "${searchQuery}"`);
    console.log(`Scraped at: ${new Date().toISOString()}`);
    console.log('');
    
    results.forEach(result => {
      console.log(`${result.platform.toUpperCase()}:`);
      if (result.error) {
        console.log(`  ❌ Error: ${result.error}`);
      } else {
        console.log(`  ✅ Posts scraped: ${result.count}`);
        console.log(`  📁 Output file: ${result.outputFile}`);
      }
      console.log('');
    });
    
    const totalPosts = results.reduce((sum, r) => sum + r.count, 0);
    console.log(`📊 Total posts scraped: ${totalPosts}`);
    console.log(`📋 Summary saved to: ${summaryPath}`);
    
  } catch (error) {
    logger.error('Scraping failed', { error });
    console.error('❌ Scraping failed:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}