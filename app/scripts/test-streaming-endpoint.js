#!/usr/bin/env node

/**
 * Test script for the streaming pipeline endpoint
 * This demonstrates how to consume the Server-Sent Events from the API
 */

const fetch = require('node-fetch');

async function testStreamingEndpoint() {
  const API_URL = 'http://localhost:3000/api/scraper/run-pipeline';
  
  const keywords = [
    'test keyword 1',
    'test keyword 2'
  ].join('\n');

  console.log('Testing streaming endpoint with keywords:', keywords.split('\n'));
  console.log('---');

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ keywords }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Error response:', error);
      return;
    }

    // Check if we got SSE response
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('text/event-stream')) {
      console.error('Expected SSE response, got:', contentType);
      const body = await response.text();
      console.error('Response body:', body);
      return;
    }

    console.log('Connected to SSE stream...');
    console.log('---');

    // Process the stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        console.log('---');
        console.log('Stream completed');
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const event = JSON.parse(line.slice(6));
            
            // Format output based on event type
            switch (event.type) {
              case 'output':
                console.log(`[OUTPUT${event.keyword ? ` - ${event.keyword}` : ''}] ${event.data}`);
                break;
              case 'error':
                console.error(`[ERROR${event.keyword ? ` - ${event.keyword}` : ''}] ${event.data}`);
                break;
              case 'progress':
                console.log(`[PROGRESS] ${event.data.keyword}: ${event.data.status}`);
                break;
              case 'complete':
                console.log(`[COMPLETE] ${event.data.summary}`);
                if (event.data.keyword) {
                  console.log(`  - Keyword: ${event.data.keyword}, Success: ${event.data.success}`);
                }
                break;
              default:
                console.log(`[${event.type.toUpperCase()}]`, event.data);
            }
          } catch (e) {
            console.error('Failed to parse event:', line);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error testing streaming endpoint:', error);
  }
}

// Run the test
console.log('Starting streaming endpoint test...');
testStreamingEndpoint().catch(console.error);