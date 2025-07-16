# API Gateway

A comprehensive API Gateway service for managing social media API integrations with rate limiting, authentication, and monitoring capabilities.

## Features

- **Multi-Platform Support**: YouTube, Twitter, and Instagram API integration
- **Rate Limiting**: Platform-specific rate limiting with configurable windows and limits
- **API Key Management**: Secure API key generation, validation, and permission management
- **Request Routing**: Flexible request routing with path parameters and transformations
- **Error Handling**: Automatic retry logic with exponential backoff and circuit breakers
- **Monitoring**: Health checks, metrics collection, and audit logging
- **Caching**: Built-in caching support for reducing API calls
- **Security**: API key encryption and request/response sanitization

## Installation

```typescript
import { APIGateway } from '@/lib/api-gateway';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const gateway = new APIGateway({ prisma });
```

## Configuration

The API Gateway can be configured through environment variables or programmatically:

### Environment Variables

```bash
# Rate Limiting
API_GATEWAY_YOUTUBE_RATE_WINDOW_MS=86400000      # 24 hours
API_GATEWAY_YOUTUBE_RATE_MAX_REQUESTS=10000
API_GATEWAY_TWITTER_RATE_WINDOW_MS=2592000000    # 30 days
API_GATEWAY_TWITTER_RATE_MAX_REQUESTS=500000
API_GATEWAY_INSTAGRAM_RATE_WINDOW_MS=3600000     # 1 hour
API_GATEWAY_INSTAGRAM_RATE_MAX_REQUESTS=200

# Encryption
API_GATEWAY_ENCRYPTION_SECRET_KEY=your-32-char-secret-key

# Monitoring
API_GATEWAY_MONITORING_ENABLED=true
API_GATEWAY_LOG_LEVEL=info

# Retry Configuration
API_GATEWAY_RETRY_MAX_ATTEMPTS=3
API_GATEWAY_RETRY_INITIAL_DELAY_MS=1000
API_GATEWAY_RETRY_MAX_DELAY_MS=60000
API_GATEWAY_RETRY_BACKOFF_MULTIPLIER=2

# Platform API Keys
YOUTUBE_API_KEY=your-youtube-api-key
TWITTER_API_KEY=your-twitter-api-key
INSTAGRAM_API_KEY=your-instagram-api-key
```

### Programmatic Configuration

```typescript
const gateway = new APIGateway({
  prisma,
  config: {
    rateLimiting: {
      youtube: {
        windowMs: 86400000,
        maxRequests: 10000
      }
    },
    monitoring: {
      enabled: true,
      logLevel: 'debug'
    }
  }
});
```

## Usage

### 1. Register Routes

```typescript
gateway.registerRoute({
  path: '/youtube/channels/:channelId',
  methods: ['GET'],
  platform: 'youtube',
  targetEndpoint: 'channels',
  rateLimit: {
    windowMs: 60000,
    maxRequests: 10
  },
  cache: {
    ttl: 300000, // 5 minutes
    key: (req) => `youtube:channel:${req.params.channelId}`
  }
});
```

### 2. Register Platform Handlers

```typescript
import { YouTubeService } from '@/lib/platform-api/youtube-service';

const youtubeService = new YouTubeService(config);
gateway.registerPlatformHandler('youtube', youtubeService);
```

### 3. Create API Keys

```typescript
const { key, keyData } = await gateway.createAPIKey({
  name: 'My Application',
  permissions: ['youtube:get', 'twitter:get'],
  rateLimits: {
    requestsPerHour: 100,
    requestsPerDay: 1000
  },
  expiresIn: 30 // days
});
```

### 4. Make Requests

```typescript
const response = await gateway.handleRequest({
  platform: 'youtube',
  endpoint: '/youtube/channels/UC_x5XG1OV2P6uZZ5FSM9Ttw',
  method: 'GET',
  apiKey: 'sk_your_api_key',
  params: {
    part: 'snippet,statistics'
  }
});
```

## API Key Permissions

Permissions follow the format `platform:method`:

- `youtube:get` - Read access to YouTube API
- `twitter:get` - Read access to Twitter API
- `instagram:get` - Read access to Instagram API
- `*` - Full access to all platforms and methods

## Health Monitoring

```typescript
// Get overall health status
const health = await gateway.getHealth();

// Get detailed health with service latencies
const detailed = await gateway.getDetailedHealth();

// Get gateway metrics
const metrics = gateway.getMetrics();
```

## Error Handling

The gateway automatically handles various error scenarios:

- **Rate Limiting**: Returns 429 with retry-after header
- **Invalid API Key**: Returns 401
- **Insufficient Permissions**: Returns 403
- **Service Unavailable**: Returns 503 with circuit breaker
- **Network Errors**: Automatic retry with exponential backoff

## Audit Logging

```typescript
// Get audit logs with filters
const logs = gateway.getAuditLogs({
  startTime: new Date(Date.now() - 3600000), // Last hour
  platform: 'youtube',
  statusCode: 200
});

// Export audit logs
const exportedLogs = gateway.exportAuditLogs();
```

## Circuit Breaker

The gateway includes circuit breaker functionality to prevent cascading failures:

```typescript
const circuitBreaker = errorHandler.createCircuitBreaker('youtube-api', {
  failureThreshold: 5,      // Open after 5 failures
  resetTimeout: 60000,      // Try again after 1 minute
  monitoringPeriod: 300000  // Monitor over 5 minutes
});
```

## Rate Limiting Strategies

### Window-based Rate Limiting (YouTube, Instagram)
- Fixed time windows with request counts
- Resets at window expiration

### Token Bucket Rate Limiting (Twitter)
- More flexible, allows burst traffic
- Tokens refill at a constant rate

## Best Practices

1. **API Key Security**
   - Store API keys securely (never in code)
   - Rotate keys regularly
   - Use minimal required permissions

2. **Rate Limit Management**
   - Monitor rate limit usage
   - Implement caching to reduce API calls
   - Use batch operations where available

3. **Error Handling**
   - Always handle rate limit errors gracefully
   - Implement fallback strategies
   - Log errors for debugging

4. **Performance**
   - Enable caching for frequently accessed data
   - Use connection pooling
   - Monitor latency metrics

## Testing

```typescript
// Run tests
npm test lib/api-gateway

// Integration tests
npm run test:integration lib/api-gateway
```

## Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│   API Client    │────▶│  API Gateway │────▶│ Platform APIs   │
└─────────────────┘     └──────────────┘     └─────────────────┘
                               │
                               ├── Rate Limiter
                               ├── API Key Manager
                               ├── Request Router
                               ├── Error Handler
                               ├── Cache Layer
                               └── Health Monitor
```

## License

MIT