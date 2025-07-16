#!/usr/bin/env node

/**
 * TikTok Keyword Search Script
 * 
 * This script reads keywords from a text file and runs the TikTok search pipeline
 * to find profiles based on those keywords, then processes them through the 30-day metrics pipeline.
 * 
 * Usage: node scripts/tiktok-keyword-search.js <keywords-file> [options]
 * 
 * Options:
 *   --limit <number>     Max profiles per keyword (default: 10)
 *   --port <number>      Server port (default: 3001)
 *   --wait <seconds>     Wait time for pipeline completion (default: 120)
 *   --help               Show help
 * 
 * Example:
 *   node scripts/tiktok-keyword-search.js keywords.txt --limit 15 --wait 180
 */

const fs = require('fs');
const path = require('path');

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    keywordsFile: null,
    limit: 10,
    port: 3001,
    wait: 120,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--limit') {
      options.limit = parseInt(args[++i]);
    } else if (arg === '--port') {
      options.port = parseInt(args[++i]);
    } else if (arg === '--wait') {
      options.wait = parseInt(args[++i]);
    } else if (!options.keywordsFile && !arg.startsWith('--')) {
      options.keywordsFile = arg;
    }
  }

  return options;
}

// Show help information
function showHelp() {
  console.log(`
TikTok Keyword Search Script

Usage: node scripts/tiktok-keyword-search.js <keywords-file> [options]

Arguments:
  keywords-file        Path to text file containing keywords (one per line)

Options:
  --limit <number>     Max profiles per keyword (default: 10)
  --port <number>      Server port (default: 3001)
  --wait <seconds>     Wait time for pipeline completion (default: 120)
  --help, -h           Show this help message

Examples:
  node scripts/tiktok-keyword-search.js keywords.txt
  node scripts/tiktok-keyword-search.js keywords.txt --limit 15 --wait 180
  node scripts/tiktok-keyword-search.js tech-keywords.txt --limit 5

Keywords File Format:
  Each line should contain one keyword. Lines starting with # are ignored.
  
  Example keywords.txt:
  # Tech recruiting keywords
  tech recruiter
  software engineer
  coding bootcamp
  remote work
  #techjobs
  #remotework
  developer jobs
  `);
}

// Read keywords from file
function readKeywords(filePath) {
  try {
    const absolutePath = path.resolve(filePath);
    
    if (!fs.existsSync(absolutePath)) {
      console.error(`❌ Error: File not found: ${absolutePath}`);
      process.exit(1);
    }

    const content = fs.readFileSync(absolutePath, 'utf8');
    const keywords = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'))  // Remove empty lines and comments
      .filter(line => line.length > 0);

    if (keywords.length === 0) {
      console.error(`❌ Error: No valid keywords found in ${filePath}`);
      process.exit(1);
    }

    return keywords;
  } catch (error) {
    console.error(`❌ Error reading file: ${error.message}`);
    process.exit(1);
  }
}

// Run the TikTok search pipeline
async function runTikTokSearch(keywords, options) {
  const baseUrl = `http://localhost:${options.port}`;
  
  try {
    console.log(`🚀 Starting TikTok search for ${keywords.length} keywords...`);
    console.log(`📍 Keywords: ${keywords.slice(0, 3).join(', ')}${keywords.length > 3 ? ` (+${keywords.length - 3} more)` : ''}`);
    console.log(`⚙️  Limit per keyword: ${options.limit}`);
    console.log(`🕐 Wait time: ${options.wait}s`);
    console.log('');

    const response = await fetch(`${baseUrl}/api/pipeline/tiktok-search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        keywords: keywords,
        limit: options.limit
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Search failed: ${error}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(`Search failed: ${data.error || 'Unknown error'}`);
    }

    console.log(`✅ Search completed successfully!`);
    console.log(`🔍 Found ${data.searchResults.profilesFound} unique profiles`);
    
    if (data.pipeline && data.pipeline.runId) {
      console.log(`📊 Started 30-day metrics pipeline: ${data.pipeline.runId}`);
      console.log(`👥 Processing ${data.pipeline.profileCount} profiles`);
      
      // Wait for pipeline completion
      console.log(`\n⏳ Waiting ${options.wait}s for pipeline to complete...`);
      await new Promise(resolve => setTimeout(resolve, options.wait * 1000));
      
      // Check results
      console.log('\n📈 Checking pipeline results...');
      const resultsResponse = await fetch(`${baseUrl}/api/pipeline/tiktok-30d`);
      
      if (resultsResponse.ok) {
        const results = await resultsResponse.json();
        const activeProfiles = results.profiles.filter(p => p.posts30d > 0);
        
        console.log(`\n🎯 Pipeline Results:`);
        console.log(`📊 Total profiles in database: ${results.profiles.length}`);
        console.log(`🔥 Active profiles (30d posts): ${activeProfiles.length}`);
        
        if (activeProfiles.length > 0) {
          console.log(`\n🏆 Top 5 profiles by engagement:`);
          activeProfiles
            .sort((a, b) => b.engagementRate - a.engagementRate)
            .slice(0, 5)
            .forEach((profile, index) => {
              console.log(`${index + 1}. @${profile.username} (${profile.nickName})`);
              console.log(`   👥 ${profile.followerCount.toLocaleString()} followers`);
              console.log(`   📝 ${profile.posts30d} posts (30d)`);
              console.log(`   💡 ${profile.engagementRate.toFixed(2)}% engagement`);
              console.log('');
            });
        }
      } else {
        console.log('⚠️  Could not fetch pipeline results');
      }
    } else {
      console.log(`ℹ️  No profiles found to process`);
    }

    return data;

  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    
    // Check if server is running
    try {
      const healthResponse = await fetch(`${baseUrl}/api/health`);
      if (!healthResponse.ok) {
        console.error(`💡 Hint: Make sure the server is running on port ${options.port}`);
      }
    } catch {
      console.error(`💡 Hint: Make sure the server is running on port ${options.port}`);
      console.error(`   Run: cd app && npm run dev`);
    }
    
    process.exit(1);
  }
}

// Main function
async function main() {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    return;
  }

  if (!options.keywordsFile) {
    console.error('❌ Error: Keywords file is required');
    console.error('Usage: node scripts/tiktok-keyword-search.js <keywords-file> [options]');
    console.error('Run with --help for more information');
    process.exit(1);
  }

  // Validate options
  if (options.limit < 1 || options.limit > 100) {
    console.error('❌ Error: Limit must be between 1 and 100');
    process.exit(1);
  }

  if (options.wait < 10 || options.wait > 600) {
    console.error('❌ Error: Wait time must be between 10 and 600 seconds');
    process.exit(1);
  }

  const keywords = readKeywords(options.keywordsFile);
  
  console.log('📋 TikTok Keyword Search Pipeline');
  console.log('================================');
  console.log(`📁 Keywords file: ${options.keywordsFile}`);
  console.log(`🏷️  Keywords loaded: ${keywords.length}`);
  console.log('');

  await runTikTokSearch(keywords, options);
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  });
}

module.exports = { main, readKeywords, runTikTokSearch };