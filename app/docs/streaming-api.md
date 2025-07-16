# Streaming Pipeline API Documentation

## Overview

The `/api/scraper/run-pipeline` endpoint has been updated to support Server-Sent Events (SSE) for real-time streaming of bash script output. This allows the frontend to display progress and output as the pipeline executes.

## API Endpoint

**URL**: `/api/scraper/run-pipeline`  
**Method**: `POST`  
**Content-Type**: `application/json`  
**Response Type**: `text/event-stream` (SSE)

### Request Body

```json
{
  "keywords": "keyword1\nkeyword2\nkeyword3"
}
```

### Response Format

The endpoint returns a stream of Server-Sent Events. Each event is a JSON object with the following structure:

```typescript
type SSEEvent = 
  | { type: 'output'; data: string; keyword?: string }
  | { type: 'error'; data: string; keyword?: string }
  | { type: 'complete'; data: { success: boolean; keyword?: string; summary?: string } }
  | { type: 'progress'; data: { keyword: string; status: string } };
```

### Event Types

1. **output**: Standard output from the bash script
2. **error**: Error messages or stderr output
3. **progress**: Status updates for each keyword being processed
4. **complete**: Completion events for individual keywords or the entire pipeline

## Client-Side Usage

### Using the Streaming Client Library

```typescript
import { streamPipelineExecution } from '@/lib/streaming-client';

// Start streaming
const abortController = await streamPipelineExecution(keywords, {
  onOutput: (line, keyword) => {
    console.log(`[${keyword}] ${line}`);
  },
  onError: (error, keyword) => {
    console.error(`[${keyword}] Error: ${error}`);
  },
  onProgress: (keyword, status) => {
    console.log(`Progress: ${keyword} - ${status}`);
  },
  onComplete: (data) => {
    console.log(`Completed: ${data.summary}`);
  },
  onStreamEnd: () => {
    console.log('Stream finished');
  }
});

// Stop streaming if needed
abortController.abort();
```

### React Component Example

```tsx
import { useState, useRef } from 'react';
import { streamPipelineExecution } from '@/lib/streaming-client';

export function PipelineRunner() {
  const [output, setOutput] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const abortControllerRef = useRef<AbortController>();

  const runPipeline = async (keywords: string) => {
    setIsRunning(true);
    setOutput([]);
    
    try {
      abortControllerRef.current = await streamPipelineExecution(keywords, {
        onOutput: (line, keyword) => {
          setOutput(prev => [...prev, `[${keyword || 'SYSTEM'}] ${line}`]);
        },
        onError: (error, keyword) => {
          setOutput(prev => [...prev, `ERROR [${keyword || 'SYSTEM'}]: ${error}`]);
        },
        onProgress: (keyword, status) => {
          setOutput(prev => [...prev, `PROGRESS: ${keyword} - ${status}`]);
        },
        onComplete: (data) => {
          if (data.summary) {
            setOutput(prev => [...prev, `COMPLETE: ${data.summary}`]);
          }
        },
        onStreamEnd: () => {
          setIsRunning(false);
        }
      });
    } catch (error) {
      console.error('Failed to start pipeline:', error);
      setIsRunning(false);
    }
  };

  const stopPipeline = () => {
    abortControllerRef.current?.abort();
    setIsRunning(false);
  };

  return (
    <div>
      <button onClick={() => runPipeline('test keyword')} disabled={isRunning}>
        {isRunning ? 'Running...' : 'Run Pipeline'}
      </button>
      {isRunning && (
        <button onClick={stopPipeline}>Stop</button>
      )}
      <div className="output-console">
        {output.map((line, idx) => (
          <div key={idx}>{line}</div>
        ))}
      </div>
    </div>
  );
}
```

## Testing

To test the streaming endpoint:

```bash
# Using the test script
node scripts/test-streaming-endpoint.js

# Or using curl
curl -X POST http://localhost:3000/api/scraper/run-pipeline \
  -H "Content-Type: application/json" \
  -d '{"keywords": "test keyword"}'
```

## Implementation Details

The streaming implementation uses:

1. **ReadableStream**: Native Web API for streaming data
2. **TextEncoder**: Converts strings to Uint8Array for streaming
3. **Child Process Spawn**: Captures stdout/stderr in real-time
4. **Line Buffering**: Ensures complete lines are sent as events

## Notes

- The stream automatically handles line buffering to ensure complete messages
- Each keyword is processed sequentially to avoid overwhelming the system
- The endpoint includes a 10-minute timeout for each keyword
- ANSI color codes from the bash script are preserved in the output
- The `X-Accel-Buffering: no` header ensures Nginx doesn't buffer the stream