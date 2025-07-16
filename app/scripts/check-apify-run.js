#!/usr/bin/env node

/**
 * Check status of a specific Apify run to see detailed error information
 */

const fetch = require('node-fetch');

async function checkRun(runId) {
  try {
    const response = await fetch(`https://api.apify.com/v2/actor-runs/${runId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.APIFY_API_KEY || 'apify_api_7OapYH3ggYsPPebs6GoXQUudMvMarI4wQw9o'}`
      }
    });
    
    if (!response.ok) {
      console.error('Failed to fetch run status:', response.status, response.statusText);
      return;
    }
    
    const data = await response.json();
    console.log('Run Status:', JSON.stringify(data, null, 2));
    
    // Check for failure details
    if (data.data?.status === 'FAILED') {
      console.log('\n❌ Run failed with details:');
      console.log('Exit code:', data.data.exitCode);
      console.log('Status message:', data.data.statusMessage);
      
      // Get logs
      const logResponse = await fetch(`https://api.apify.com/v2/actor-runs/${runId}/log`, {
        headers: {
          'Authorization': `Bearer ${process.env.APIFY_API_KEY || 'your_apify_api_key_here'}`
        }
      });
      
      if (logResponse.ok) {
        const logText = await logResponse.text();
        console.log('\nLast 20 lines of log:');
        const lines = logText.split('\n');
        const lastLines = lines.slice(-20);
        lastLines.forEach(line => console.log(line));
      }
    }
    
  } catch (error) {
    console.error('Error checking run:', error);
  }
}

// Get runId from command line or use the most recent one from logs
const runId = process.argv[2] || 'uiKRrdd0sQRABdV9t'; // Last run ID from logs
checkRun(runId);