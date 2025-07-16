import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { logInfo, logError, logToolExecution, logToolResult, logToolError } from './lib/utils/logger';
import { McpTool } from './tools/types';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { z } from 'zod';

interface McpServerOptions {
  name: string;
  version: string;
  tools: McpTool<any>[];
}

export class TikTokMinerMcpServer {
  private server: Server;
  private tools: Map<string, McpTool> = new Map();

  constructor(options: McpServerOptions) {
    const { name, version, tools } = options;

    // Initialize the MCP server
    this.server = new Server(
      { name, version },
      { capabilities: { tools: {} } }
    );

    // Register all tools
    tools.forEach(tool => {
      this.tools.set(tool.name, tool);
    });

    this.setupHandlers();
    logInfo(`Initialized ${name} v${version} with ${tools.length} tools`);
  }



  private setupHandlers(): void {
    // Handle list_tools requests
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = Array.from(this.tools.values()).map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: zodToJsonSchema(tool.inputSchema),
      }));

      return { tools };
    });

    // Handle call_tool requests
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      const tool = this.tools.get(name);
      if (!tool) {
        logError(`Tool not found: ${name}`);
        throw new Error(`Tool not found: ${name}`);
      }

      try {
        const startTime = Date.now();
        logToolExecution(name, args);
        
        // Validate input using tool's schema
        const validatedArgs = tool.inputSchema.parse(args || {});
        
        // Call the tool handler with validated args
        const result = await tool.handler(validatedArgs);
        
        const duration = Date.now() - startTime;
        logToolResult(name, true, duration);
        
        return {
          content: [
            {
              type: 'text',
              text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // Handle validation errors specifically
        if (error instanceof z.ZodError) {
          const validationErrors = error.issues.map(i => ({ path: i.path.join('.'), message: i.message }));
          const errorMessage = `Invalid input parameters: ${validationErrors.map(e => `${e.path}: ${e.message}`).join(', ')}`;
          logToolError(name, errorMessage);
          
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ success: false, error: 'Validation Error', details: validationErrors }, null, 2),
              },
            ],
            isError: true,
          };
        }
        
        logToolError(name, errorMessage);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: false, error: errorMessage }, null, 2),
            },
          ],
          isError: true,
        };
      }
    });
  }

  async start(): Promise<void> {
    try {
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      logInfo('Shadow Bee MCP server started successfully');
    } catch (error) {
      logError(`Failed to start MCP server: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      await this.server.close();
      logInfo('Shadow Bee MCP server stopped gracefully');
    } catch (error) {
      logError(`Error stopping MCP server: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
}

export function setupGracefulShutdown(server: TikTokMinerMcpServer): void {
  const shutdown = async (signal: string) => {
    logInfo(`Received ${signal}, shutting down gracefully...`);
    try {
      await server.stop();
      process.exit(0);
    } catch (error) {
      logError(`Error during shutdown: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGQUIT', () => shutdown('SIGQUIT'));
}