# MCP Server Troubleshooting Guide

This document covers common issues with the Shadow Bee MCP Server and their solutions.

## Critical Bug: JSON Parsing Errors

### Problem Description

**Symptoms:**
```bash
Error from MCP server: SyntaxError: Unexpected token 'infos not valid JSON
    at JSON.parse (<anonymous>)
    at deserializeMessage...
```

**Root Cause:**
The MCP (Model Context Protocol) requires clean JSON communication over stdout/stderr. Any non-JSON output (logs, console messages, etc.) breaks the protocol parser.

### What Was Causing the Issue

1. **Winston Logger Output**: The Winston logger was configured to write to console, sending formatted log messages to stdout/stderr
2. **Debug Logging Level**: `LOG_LEVEL: 'debug'` in config caused extensive logging output
3. **CLI Utility Functions**: Functions in `lib/utils/display.ts` and `lib/utils/output.ts` used direct `console.log` calls
4. **Schema Validation Warnings**: `console.warn` calls in validation functions

### The Fix

#### 1. Smart Winston Configuration (`lib/utils/logger.ts`)

**Before:**
```typescript
// Always wrote to console
transports: [
  new transports.Console({
    format: winstonFormat.combine(
      winstonFormat.colorize(),
      winstonFormat.simple()
    )
  })
]
```

**After:**
```typescript
// Detects MCP mode and redirects to files
const isMcpMode = process.argv.some(arg => arg.includes('mcp')) || 
                  process.env.MCP_SERVER === 'true' ||
                  require.main?.filename?.includes('mcp');

if (isMcpMode) {
  // Write to files instead of console
  loggerTransports.push(
    new transports.File({
      filename: path.join(logsDir, 'mcp-server.log'),
      format: fileFormat,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5
    })
  );
}
```

#### 2. Console Method Suppression (`cli/mcp/index.ts`)

**Added early in startup:**
```typescript
// Suppress console methods in MCP mode
const isMcpMode = process.argv.some(arg => arg.includes('mcp')) || 
                  process.env.MCP_SERVER === 'true';

if (isMcpMode) {
  console.log = () => {};
  console.info = () => {};
  console.warn = () => {};
  console.error = () => {};
  console.debug = () => {};
}
```

#### 3. Clean Schema Validation (`cli/mcp/schemas/index.ts`)

**Before:**
```typescript
console.warn(`Output validation warning: ${result.error.message}`);
```

**After:**
```typescript
// Output validation warning suppressed for MCP protocol compatibility
```

### Results

- ✅ **Clean MCP Protocol**: No JSON parsing errors
- ✅ **Preserved Logging**: All logs saved to `.logs/mcp-server.log`
- ✅ **Error Tracking**: Separate `.logs/mcp-server-error.log` for critical issues
- ✅ **Automatic Detection**: No manual configuration needed

## Monitoring Your MCP Server

### Log Files Location
```
app/.logs/
├── mcp-server.log          # All logs (JSON format)
└── mcp-server-error.log    # Error logs only
```

### Useful Commands

```bash
# View real-time logs
tail -f .logs/mcp-server.log

# Check for errors
cat .logs/mcp-server-error.log

# Monitor tool execution
tail -f .logs/mcp-server.log | grep "Executing tool"

# Check server startup
head -20 .logs/mcp-server.log

# Monitor in pretty format (requires jq)
tail -f .logs/mcp-server.log | jq -r '.timestamp + " " + .level + ": " + .message'
```

## Other Common Issues

### 1. GitHub Token Errors

**Symptoms:**
```bash
Error: No GitHub tokens available
```

**Solution:**
Ensure your `.env` file contains:
```bash
GITHUB_TOKEN=ghp_your_token_here
# or
GITHUB_TOKENS=token1,token2,token3
```

Also ensure that the script running the mcp has access to the env.

### 2. Port Already in Use

**Symptoms:**
```bash
❌ Proxy Server PORT IS IN USE at port 6277 ❌
```

**Solution:**
```bash
# Kill existing MCP processes
pkill -f mcp
pkill -f inspector

# Wait a moment and try again
sleep 2
bun run mcp:inspect
```

### 3. Database Connection Issues

**Symptoms:**
```bash
Database connection failed
```

**Solution:**
Check your `.env` file for:
```bash
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
```

## Environment Detection

The system automatically detects MCP mode using:

```typescript
const isMcpMode = process.argv.some(arg => arg.includes('mcp')) || 
                  process.env.MCP_SERVER === 'true' ||
                  require.main?.filename?.includes('mcp');
```

You can also manually force MCP mode:
```bash
MCP_SERVER=true node cli/mcp/build/index.js
```