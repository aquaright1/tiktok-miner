#!/usr/bin/env node

/**
 * Test script to verify 30-day metrics collection
 * Tests a small set of creators to ensure the pipeline is working correctly
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const TEST_CREATORS = [
  'cristiano',      // Large account (Cristiano Ronaldo)
  'khaby.lame',     // Very large account
  'zachking',       // Medium-large account
  'gordonramsayofficial', // Celebrity chef
  'charlidamelio'   // Top creator
];

async function runTest() {
  console.log('🧪 Testing TikTok 30-day metrics collection\n');
  console.log('Test creators:', TEST_CREATORS.join(', '));
  console.log('\n' + '='.repeat(80) + '\n');

  for (const creator of TEST_CREATORS) {
    console.log(`\n📊 Testing creator: @${creator}`);
    console.log('-'.repeat(50));
    
    try {
      // Run the pipeline for this creator
      console.log('1️⃣  Starting pipeline...');
      const { stdout, stderr } = await execAsync(`./run-tiktok-pipeline.sh "${creator}"`);
      
      // Extract key information from output
      const lines = stdout.split('\n');
      
      // Look for the profile data in the output
      const profileFound = lines.find(line => line.includes(`✓ @${creator}`));
      if (profileFound) {
        console.log('✅ Profile found and processed');
        
        // Extract metrics from the next few lines
        const startIndex = lines.indexOf(profileFound);
        if (startIndex !== -1) {
          for (let i = startIndex; i < Math.min(startIndex + 4, lines.length); i++) {
            if (lines[i].trim()) {
              console.log(lines[i]);
            }
          }
        }
      } else {
        console.log('❌ Profile not found in output');
      }
      
      // Also check database directly
      console.log('\n2️⃣  Checking database directly...');
      const { stdout: dbCheck } = await execAsync(`node scripts/check-tiktok-db.js "${creator}"`);
      console.log(dbCheck);
      
    } catch (error) {
      console.error(`❌ Error testing ${creator}:`, error.message);
    }
    
    // Wait a bit between tests to avoid rate limiting
    if (TEST_CREATORS.indexOf(creator) < TEST_CREATORS.length - 1) {
      console.log('\n⏳ Waiting 5 seconds before next test...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ Test completed!');
  console.log('\n📌 Summary:');
  console.log('- If you see 30-day metrics (likes, comments, views, shares) for each creator,');
  console.log('  the pipeline is working correctly.');
  console.log('- If metrics are missing or 0, there may be an issue with the data collection.');
}

// Run the test
runTest().catch(console.error);