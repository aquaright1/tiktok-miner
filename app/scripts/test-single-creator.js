#!/usr/bin/env node

/**
 * Quick test script to verify 30-day metrics for a single creator
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

async function testSingleCreator() {
  const creator = 'cristiano';
  console.log(`🧪 Testing 30-day metrics for @${creator}\n`);
  
  try {
    // Run the pipeline
    console.log('1️⃣  Running pipeline...');
    const { stdout, stderr } = await execAsync(`./run-tiktok-pipeline.sh "${creator}"`, {
      timeout: 60000 // 60 second timeout
    });
    
    // Show relevant output
    const lines = stdout.split('\n');
    const relevantLines = lines.filter(line => 
      line.includes('30d') || 
      line.includes('Likes:') || 
      line.includes('Comments:') || 
      line.includes('Views:') || 
      line.includes('Shares:') ||
      line.includes('✓ @')
    );
    
    console.log('\n📊 Pipeline output:');
    relevantLines.forEach(line => console.log(line));
    
    // Check database
    console.log('\n2️⃣  Checking database...');
    const { stdout: dbOutput } = await execAsync(`node scripts/check-tiktok-db.js "${creator}"`);
    
    // Show only metrics lines
    const dbLines = dbOutput.split('\n');
    const metricsLines = dbLines.filter(line => 
      line.includes('30-day') || 
      line.includes('engagement rate')
    );
    
    console.log('\n📊 Database metrics:');
    metricsLines.forEach(line => console.log(line));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testSingleCreator().catch(console.error);