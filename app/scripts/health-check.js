#!/usr/bin/env node

/**
 * Simple Health Check Script
 * Run this to verify the TikTok Miner app is working properly
 */

const { spawn } = require('child_process');
const http = require('http');

console.log('🔍 TikTok Miner App Health Check\n');

// Check if app is running
function checkAppRunning() {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/creators',
      timeout: 5000
    }, (res) => {
      resolve(res.statusCode === 200);
    });

    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

// Check environment variables
function checkEnvironment() {
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY'
  ];

  const missing = required.filter(env => !process.env[env]);
  
  if (missing.length > 0) {
    console.log('❌ Missing environment variables:', missing.join(', '));
    return false;
  }

  console.log('✅ Environment variables configured');
  return true;
}

// Run tests
async function runTests() {
  return new Promise((resolve) => {
    console.log('🧪 Running health tests...');
    
    const testProcess = spawn('npm', ['test', '--', '__tests__/app-health-check.test.js', '--silent'], {
      stdio: 'pipe',
      cwd: process.cwd()
    });

    let testOutput = '';
    
    testProcess.stdout.on('data', (data) => {
      testOutput += data.toString();
    });

    testProcess.stderr.on('data', (data) => {
      testOutput += data.toString();
    });

    testProcess.on('close', (code) => {
      if (code === 0) {
        console.log('✅ All health tests passed');
        resolve(true);
      } else {
        console.log('❌ Some health tests failed');
        console.log('Test output:', testOutput);
        resolve(false);
      }
    });
  });
}

// Main health check
async function main() {
  let allGood = true;

  // 1. Check environment
  if (!checkEnvironment()) {
    allGood = false;
  }

  // 2. Check if app is running
  console.log('🌐 Checking if app is running...');
  const appRunning = await checkAppRunning();
  
  if (appRunning) {
    console.log('✅ App is running on http://localhost:3000');
  } else {
    console.log('❌ App is not running on port 3000');
    console.log('💡 Try running: npm run dev');
    allGood = false;
  }

  // 3. Run tests
  const testsPass = await runTests();
  if (!testsPass) {
    allGood = false;
  }

  // Summary
  console.log('\n📊 Health Check Summary:');
  console.log('========================');
  console.log(`Environment: ${checkEnvironment() ? '✅ OK' : '❌ FAILED'}`);
  console.log(`App Running: ${appRunning ? '✅ OK' : '❌ FAILED'}`);
  console.log(`Tests: ${testsPass ? '✅ PASSED' : '❌ FAILED'}`);
  
  if (allGood) {
    console.log('\n🎉 App is healthy and ready to use!');
    console.log('🚀 Visit: http://localhost:3000/creators');
    process.exit(0);
  } else {
    console.log('\n⚠️  App has issues that need attention');
    console.log('📖 Check the troubleshooting guide in CLAUDE.md');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Health check failed:', error.message);
    process.exit(1);
  });
}

module.exports = { checkAppRunning, checkEnvironment, runTests };