# Creator Discovery Architecture

## Overview

The Shadow Bee creator discovery system is a multi-platform social media analytics engine that discovers, evaluates, and monitors content creators across Instagram, TikTok, YouTube, Twitter, and LinkedIn. It provides unified scoring, automated discovery pipelines, and comprehensive analytics.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Frontend Layer                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────┐  │
│  │  Creator    │  │  Discovery  │  │  Analytics  │  │  Export  │  │
│  │  Profiles   │  │  Dashboard  │  │    Views    │  │   Tools  │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └──────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                  │
┌─────────────────────────────────────────────────────────────────────┐
│                          API Layer                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────┐  │
│  │   Creator   │  │  Discovery  │  │ Aggregation │  │  Export  │  │
│  │     API     │  │     API     │  │     API     │  │    API   │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └──────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                  │
┌─────────────────────────────────────────────────────────────────────┐
│                         Service Layer                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────┐  │
│  │  Platform   │  │ Aggregation │  │  Discovery  │  │  Export  │  │
│  │  Services   │  │   Engine    │  │  Pipeline   │  │ Service  │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └──────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                  │
┌─────────────────────────────────────────────────────────────────────┐
│                         Data Layer                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────┐  │
│  │ PostgreSQL  │  │    Redis    │  │    Cache    │  │   S3     │  │
│  │  Database   │  │    Queue    │  │   Layer     │  │ Storage  │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └──────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Platform Services

Each social media platform has a dedicated service that handles:
- API authentication and rate limiting
- Data fetching and transformation
- Platform-specific metric calculations

**Instagram Service** (`lib/services/instagram.ts`)
- OAuth 2.0 authentication flow
- Business account metrics retrieval
- Media performance analysis
- Rate limit: 200 requests/hour

**TikTok Service** (`lib/services/tiktok.ts`)
- OAuth 2.0 with scope management
- Video metrics and trends
- Creator analytics
- Rate limit: 1000 requests/day

**YouTube Service** (`lib/services/youtube.ts`)
- API key and OAuth authentication
- Channel statistics and video metrics
- Search functionality
- Quota: 10,000 units/day

**Twitter Service** (`lib/services/twitter.ts`)
- Bearer token authentication
- Tweet engagement metrics
- User timeline analysis
- Rate limit: 500,000 requests/month

### 2. Data Aggregation Engine

The aggregation engine (`lib/aggregation/`) normalizes and combines data from multiple platforms:

**Data Normalizer** (`data-normalizer.ts`)
```typescript
interface NormalizedMetrics {
  totalReach: number;
  averageEngagementRate: number;
  contentFrequency: number;
  audienceQuality: number;
  growthRate: number;
  platformDistribution: PlatformWeight[];
}
```

**Composite Scorer** (`composite-scorer.ts`)
- Weighted scoring algorithm (0-100 scale)
- Platform-specific weight adjustments
- Tier classification system:
  - Platinum (90-100): Top-tier creators
  - Gold (75-89): High-performing creators
  - Silver (60-74): Solid performers
  - Bronze (45-59): Emerging creators
  - Emerging (0-44): New or low-engagement creators

### 3. Discovery Pipeline

The automated discovery system (`lib/discovery/`) continuously finds and evaluates new creators:

**Queue Configuration** (`queue-config.ts`)
- BullMQ with Redis backend
- Configurable concurrency and retry logic
- Dead letter queue for failed jobs

**Job Scheduler** (`scheduler.ts`)
- Cron-based scheduling
- Job types:
  - Hourly: Trending discovery
  - Daily: Category exploration
  - Weekly: Deep discovery
  - Daily: Creator refresh

**Discovery Workflow**
1. **Trending Discovery**: Identifies trending topics and creators
2. **Evaluation**: Scores creators based on quality metrics
3. **Duplicate Detection**: Prevents duplicate profiles
4. **Storage**: Saves qualified creators to database
5. **Monitoring**: Tracks pipeline health and performance

### 4. Database Schema

**Creator Profile Model**
```prisma
model Creator {
  id                    String   @id @default(uuid())
  name                  String
  email                 String?
  bio                   String?
  profileImageUrl       String?
  platformIdentifiers   Json     // {instagram: "handle", tiktok: "id", ...}
  compositeScore        Float
  tier                  String   // platinum, gold, silver, bronze, emerging
  tags                  String[]
  category              String?
  location              String?
  verified              Boolean  @default(false)
  lastUpdated           DateTime
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  
  platformMetrics       PlatformMetric[]
  metricsHistory        MetricsHistory[]
  discoveryLogs         DiscoveryLog[]
}

model PlatformMetric {
  id                String   @id @default(uuid())
  creatorId         String
  platform          String   // instagram, tiktok, youtube, twitter, linkedin
  followersCount    Int
  engagementRate    Float
  averageViews      Int
  postsCount        Int
  lastPostDate      DateTime?
  platformSpecific  Json     // Platform-specific metrics
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  creator           Creator  @relation(fields: [creatorId], references: [id])
}
```

## API Endpoints

### Creator Endpoints
- `GET /api/creators` - List creators with filtering and pagination
- `GET /api/creators/:id` - Get creator profile with all metrics
- `POST /api/creators/search` - Search creators across platforms
- `PUT /api/creators/:id/refresh` - Manually refresh creator data

### Discovery Endpoints
- `GET /api/discovery/status` - Get pipeline status
- `POST /api/discovery/trigger` - Manually trigger discovery
- `GET /api/discovery/report` - Generate discovery report

### Aggregation Endpoints
- `POST /api/creators/:id/aggregate` - Aggregate creator data
- `GET /api/creators/:id/score` - Get composite score breakdown

## Rate Limiting Strategy

Each platform API has different rate limits that are managed by the API Gateway:

```typescript
const rateLimiters = {
  instagram: { windowMs: 3600000, max: 200 },      // 200/hour
  tiktok: { windowMs: 86400000, max: 1000 },       // 1000/day
  youtube: { windowMs: 86400000, max: 10000 },     // 10000 units/day
  twitter: { windowMs: 2592000000, max: 500000 },  // 500k/month
};
```

The system implements:
- Request queuing and throttling
- Exponential backoff for rate limit errors
- Quota tracking and predictive warnings
- Fallback to cached data when limits reached

## Performance Optimizations

### Caching Strategy
- Redis caching for frequently accessed creator profiles
- 15-minute cache for platform API responses
- Database query result caching
- CDN caching for profile images

### Database Optimizations
- Indexes on frequently queried fields
- Composite indexes for complex queries
- Materialized views for aggregated metrics
- TimescaleDB for time-series data

### Queue Optimizations
- Batch processing for similar jobs
- Priority queues for time-sensitive tasks
- Worker auto-scaling based on queue depth
- Job deduplication

## Security Considerations

### API Key Management
- Encrypted storage in environment variables
- Key rotation support
- Separate keys for development/production
- Audit logging for key usage

### Data Privacy
- PII encryption at rest
- Secure OAuth token storage
- GDPR compliance for creator data
- Data retention policies

### Rate Limit Protection
- Per-user rate limiting
- DDoS protection
- API key validation
- Request signature verification

## Monitoring and Alerting

### Metrics Tracked
- API usage per platform
- Discovery success rate
- Queue processing times
- Error rates by component
- Database query performance

### Alerting Thresholds
- API quota > 80% usage
- Queue depth > 1000 jobs
- Error rate > 5%
- Response time > 2 seconds
- Discovery rate < 10 creators/hour

## Future Enhancements

### Planned Features
1. Machine learning for creator quality prediction
2. Real-time webhook integration for instant updates
3. Advanced audience overlap analysis
4. Predictive trend identification
5. Multi-language content analysis

### Scalability Improvements
1. Horizontal scaling for discovery workers
2. Sharding for large creator databases
3. GraphQL API for efficient data fetching
4. Event-driven architecture
5. Microservices separation