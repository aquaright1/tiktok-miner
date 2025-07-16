# Shadow Bee MCP Server

A Model Context Protocol (MCP) server that exposes Shadow Bee's CLI functionality as tools for Large Language Models. 
This server provides structured access to GitHub talent discovery and analysis features.

## Overview

The MCP server translates CLI functionality into type-safe tools that LLMs can interact with directly.
It uses Zod schemas for validation and provides consistent error handling across all tools.

## Architecture

```
app/cli/mcp/
├── server.ts           # Core MCP server with validation
├── index.ts            # Entry point with logging
├── tools/
│   ├── types.ts        # Shared McpTool interface
│   ├── index.ts        # Tool exports
│   └── [tool-name].ts  # Individual tools
└── package.json        # Dependencies and scripts
```

## Key Principles

### 1. Centralized Validation
- All input validation happens in `server.ts` using Zod schemas
- Individual tools should not include validation logic
- Validation errors are handled consistently

### 2. Direct Handler Usage
- Import and use actual handler functions from `app/cli/handlers/`
- Never spawn CLI processes from tool handlers
- This provides better performance and error handling

### 3. Simple Tool Structure
- Each tool exports a single object conforming to `McpTool<T>`
- Return simple `{success: boolean, data?: any, error?: string}` structure

## Creating New Tools

### Step 1: Create Tool File

```typescript
import { z } from 'zod';
import { McpTool } from './types';
import { actualHandlerFunction } from '../../handlers/handler-file';

const ToolInputSchema = z.object({
  required_param: z.string().describe('Description of parameter'),
  optional_param: z.string().optional().describe('Optional parameter'),
});

export const toolNameTool: McpTool<typeof ToolInputSchema> = {
  name: 'tool-name',
  description: 'Brief description of what this tool does',
  inputSchema: ToolInputSchema,
  handler: async (args) => {
    const result = await actualHandlerFunction(args.required_param, args.optional_param);
    return { success: true, data: result };
  }
};
```

### Step 2: Add to Tool Index

```typescript
import { toolNameTool } from './tool-name';

export const allTools = [
  helpTool,
  trendingReposTool,
  toolNameTool,  // Add your new tool here
];
```

## Guidelines

### Input Schema Design
- Use descriptive field names and comprehensive descriptions
- Include validation constraints (min, max, enum values)
- Set sensible defaults where appropriate

### Tool Descriptions
- Keep descriptions to 2-3 lines usually, at most 5 lines if there's important info to communicate.
- Include what the tool does and what data it returns
- Mention key features or usage context if important

### Error Handling
- Don't catch errors in individual tools - let them bubble up
- The server handles all errors consistently
- Focus on business logic, not error formatting

### Return Values
```typescript
// ✅ Success case
return { success: true, data: actualData };

// ❌ Don't add unnecessary metadata
return { success: true, data: actualData, metadata: {}, summary: "..." };
```

## Development

```bash
# Build the server
bun run build

# Run with inspector for testing
bun run start:inspect

# Run normally
bun run start
```

## Testing

Use `bun run start:inspect` to test tools interactively.
Check logs in `.logs/` directory for detailed error information.

## Best Practices

- ✅ Use actual handler functions, never spawn processes
- ✅ Define comprehensive Zod schemas with descriptions
- ✅ Write clear, brief tool descriptions (2-3 lines)
- ✅ Return simple `{success, data/error}` structure
- ✅ Let server handle all validation and errors
- ❌ Don't include validation logic in individual tools
- ❌ Don't catch and format errors in tool handlers
- ❌ **NEVER implement database logic directly in MCP tools**
- ✅ Always import and use CLI handlers - it's fine if they use Prisma

## Important: Use CLI Handlers

MCP tools should always import and use the CLI handlers from `/handlers/`. The handlers can use Prisma or any other database access - that's their job. The MCP tools should just:

1. Import the appropriate handler function
2. Call it with the validated arguments
3. Return the result in a structured format

Example:
```typescript
import { analyzeRepository } from '../../handlers/analyze-repo';

// In the handler:
const result = await analyzeRepository(owner, repo, options);
return {
  success: true,
  data: result || { message: 'Operation completed successfully' }
};
```

## Setup for Cursor and Claude Desktop

### Cursor IDE Setup

To use the Shadow Bee MCP server with Cursor IDE, create or update the `.cursor/mcp.json` file in your project root:

```json
{
  "mcpServers": {
    "tiktok-miner": {
      "command": "bun",
      "args": ["run", "--directory", "/path/to/tiktok-miner/app/cli/mcp", "dev"]
    }
  }
}
```

**Important Notes:**
- Replace `/path/to/tiktok-miner` with the actual absolute path to your TikTok Miner project
- Ensure `bun` is installed and available in your PATH
- The MCP server will automatically start when you use Cursor with this configuration - you might need to reload the window.

### Claude Code Setup

For Claude Code, create or update the `.mcp.json` file in your project root:

```json
{
  "mcpServers": {
    "tiktok-miner": {
      "command": "bun",
      "args": ["run", "--directory", "/path/to/tiktok-miner/app/cli/mcp", "dev"]
    }
  }
}
```

### Configuration Requirements

1. **Bun Runtime**: Ensure bun is installed and available in your system PATH
2. **Project Path**: Update the directory path to match your Shadow Bee installation
3. **Development Mode**: The `dev` script runs the server in development mode with hot reloading
4. **Database**: Ensure your Shadow Bee database is properly configured and accessible

### Verification

After setup, you can verify the MCP server is working by:

1. **Cursor**: Open Cursor and check that the Shadow Bee tools are available in the AI assistant
2. **Claude Code**: Restart Claude Code and verify by asking /mcp
3. **Logs**: Check the `.logs/` directory in the MCP server folder for any startup errors