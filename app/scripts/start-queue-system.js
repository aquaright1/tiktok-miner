// Import from TypeScript files - need to use ts-node or compile first
const path = require('path');
const { spawn } = require('child_process');

// Since we're dealing with TypeScript modules, let's use a different approach
async function testQueueViaAPI() {
  console.log('🚀 Testing Queue Management System via API...\n');
  
  // Start development server in background
  console.log('📦 Starting development server...');
  const server = spawn('npm', ['run', 'dev'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: process.cwd()
  });
  
  let serverReady = false;
  server.stdout.on('data', (data) => {
    const output = data.toString();
    if (output.includes('Ready in')) {
      serverReady = true;
    }
  });
  
  // Wait for server to be ready
  let attempts = 0;
  while (!serverReady && attempts < 30) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    attempts++;
  }
  
  if (!serverReady) {
    console.error('❌ Server failed to start within 30 seconds');
    server.kill();
    return;
  }
  
  console.log('✅ Development server started');
  
  try {
    const fetch = require('node-fetch');
    
    // Test queue health endpoint
    console.log('\n🔍 Testing queue health endpoint...');
    const healthResponse = await fetch('http://localhost:3000/api/queue/control/');
    const healthData = await healthResponse.json();
    
    if (healthResponse.ok) {
      console.log('✅ Queue health endpoint working');
      console.log('📊 Queue Health:', JSON.stringify(healthData, null, 2));
    } else {
      console.log('❌ Queue health endpoint error:', healthData);
    }
    
    // Test all queues endpoint
    console.log('\n🔍 Testing all queues endpoint...');
    const allQueuesResponse = await fetch('http://localhost:3000/api/queue/control/?all=true');
    const allQueuesData = await allQueuesResponse.json();
    
    if (allQueuesResponse.ok) {
      console.log('✅ All queues endpoint working');
      console.log('📊 All Queues Data:', JSON.stringify(allQueuesData, null, 2));
    } else {
      console.log('❌ All queues endpoint error:', allQueuesData);
    }
    
    console.log('\n🎉 Queue system API testing completed!');
    
  } catch (error) {
    console.error('❌ API testing failed:', error.message);
  } finally {
    console.log('\n🛑 Stopping development server...');
    server.kill();
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

async function startQueueSystem() {
  console.log('🚀 Starting TikTok Miner Queue Management System...\n');
  
  try {
    // Initialize queue manager
    console.log('📦 Initializing queue manager...');
    await queueManager.initialize();
    console.log('✅ Queue manager initialized successfully');
    
    // Get health status for all queues
    console.log('\n🔍 Checking queue health...');
    const healthStatuses = await queueManager.getHealthStatus();
    
    console.log('\n📊 Queue Status Report:');
    console.log('=' .repeat(50));
    
    healthStatuses.forEach(health => {
      console.log(`\n📋 Queue: ${health.queueName}`);
      console.log(`   Status: ${getStatusEmoji(health.status)} ${health.status.toUpperCase()}`);
      console.log(`   Metrics:`);
      console.log(`     - Waiting: ${health.metrics.waiting}`);
      console.log(`     - Active: ${health.metrics.active}`);
      console.log(`     - Completed: ${health.metrics.completed}`);
      console.log(`     - Failed: ${health.metrics.failed}`);
      console.log(`     - Total Jobs: ${health.metrics.totalJobs}`);
      console.log(`     - Avg Processing Time: ${Math.round(health.metrics.avgProcessingTime)}ms`);
      console.log(`     - Throughput: ${health.metrics.throughput} jobs/hour`);
      
      if (health.errors.length > 0) {
        console.log(`   ⚠️  Errors: ${health.errors.join(', ')}`);
      }
    });
    
    // Add a test job to verify queue is working
    console.log('\n🧪 Adding test job to verify queue functionality...');
    await queueManager.addJob(QueueName.SCRAPING, {
      type: 'test-job',
      payload: {
        message: 'Hello from queue system!',
        timestamp: new Date().toISOString(),
      },
      priority: JobPriority.LOW,
    });
    console.log('✅ Test job added successfully');
    
    // Wait a moment and check again
    await new Promise(resolve => setTimeout(resolve, 2000));
    const updatedHealth = await queueManager.getQueueMetrics(QueueName.SCRAPING);
    console.log(`\n📈 Updated metrics for scraping queue:`);
    console.log(`   - Waiting: ${updatedHealth.waiting}`);
    console.log(`   - Total Jobs: ${updatedHealth.totalJobs}`);
    
    console.log('\n🎉 Queue system is running and ready for tasks!');
    console.log('\n📋 Available Commands:');
    console.log('   - Test health: curl http://localhost:3000/api/queue/control/');
    console.log('   - Get all queues: curl "http://localhost:3000/api/queue/control/?all=true"');
    console.log('   - Pause queue: curl -X POST http://localhost:3000/api/queue/control/ -H "Content-Type: application/json" -d \'{"action":"pause"}\'');
    console.log('   - Resume queue: curl -X POST http://localhost:3000/api/queue/control/ -H "Content-Type: application/json" -d \'{"action":"resume"}\'');
    
  } catch (error) {
    console.error('❌ Failed to start queue system:', error.message);
    console.error('   Stack:', error.stack);
    process.exit(1);
  }
}

function getStatusEmoji(status) {
  switch (status) {
    case 'healthy': return '✅';
    case 'degraded': return '⚠️';
    case 'unhealthy': return '❌';
    default: return '❓';
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  testQueueViaAPI().catch(console.error);
}

module.exports = { startQueueSystem };