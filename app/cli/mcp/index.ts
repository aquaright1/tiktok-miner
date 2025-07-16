#!/usr/bin/env node

/**
 * Shadow Bee MCP Server Entry Point
 * 
 * This is the main entry point for the Shadow Bee MCP server that exposes
 * CLI functionality as MCP tools for use with Claude and other LLMs.
 * 
 * Note: The MCP protocol requires clean JSON communication via stdout/stderr.
 * All logging is automatically redirected to files when running in MCP mode.
 */

// Suppress console methods in MCP mode to prevent CLI utilities from polluting stdout
// This only affects console.log/warn/etc, not Winston file logging
const isMcpMode = process.argv.some(arg => arg.includes('mcp')) || 
                  process.env.MCP_SERVER === 'true' ||
                  require.main?.filename?.includes('mcp');

if (isMcpMode) {
  // Suppress console methods that CLI utilities might use
  console.log = () => {};
  console.info = () => {};
  console.warn = () => {};
  console.error = () => {};
  console.debug = () => {};
}

import dotenv from 'dotenv';
import { TikTokMinerMcpServer, setupGracefulShutdown } from './server';
import { logInfo, logError } from './lib/utils/logger';
import { allTools } from './tools';

// Load environment variables
dotenv.config();

async function main() {
  try {
    logInfo('Starting Shadow Bee MCP Server...');

    // Create MCP server
          const server = new TikTokMinerMcpServer({
      name: 'tiktok-miner-mcp-server',
      version: '1.0.0',
      tools: allTools
    });
    
    logInfo(`Loaded ${allTools.length} tools: ${allTools.map(t => t.name).join(', ')}`);

    // Setup graceful shutdown handling
    setupGracefulShutdown(server);

    // Start the server
    await server.start();

    logInfo('Shadow Bee MCP Server is running and ready to receive requests');
    
  } catch (error) {
    logError(`Failed to start MCP server: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

// Run the server if this file is executed directly
if (require.main === module) {
  main().catch((error) => {
    logError(`Unhandled error in main: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}

// Export for testing
export { main };