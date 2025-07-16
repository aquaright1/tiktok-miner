# Multi-Platform Data Aggregation Engine

The aggregation engine normalizes and combines data from multiple social media platforms to create unified creator profiles with composite scoring.

## Features

- **Data Normalization**: Standardizes metrics across different platforms
- **Composite Scoring**: Creates unified 0-100 score with tier classification
- **Content Analysis**: Identifies themes and cross-platform patterns
- **Audience Quality**: Assesses engagement authenticity and relevance
- **Growth Metrics**: Tracks momentum and projects future performance
- **Monetary Valuation**: Estimates sponsorship value ranges

## Architecture

```
DataAggregationEngine
├── DataNormalizer      # Standardizes metrics across platforms
├── CompositeScorer     # Calculates unified scores and tiers
├── ContentAnalyzer     # Analyzes themes and patterns
└── Storage Optimizer   # Efficiently stores aggregated data
```

## Usage

### CLI Commands

```bash
# Aggregate single creator
npm run cli aggregate --id <creatorId>
npm run cli aggregate --username <username>

# Aggregate by tier
npm run cli aggregate --tier gold

# Aggregate all creators
npm run cli aggregate --all

# Compare creators
npm run cli aggregate compare <id1> <id2> <id3>
```

### Programmatic Usage

```typescript
import { DataAggregationEngine } from '@/lib/aggregation';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const engine = new DataAggregationEngine(db);

// Aggregate single creator
const data = await engine.aggregateCreatorData('creator-id', {
  analyzeContentThemes: true,
  includeHistoricalData: false,
  platforms: ['instagram', 'tiktok', 'twitter']
});

// Compare multiple creators
const comparison = await engine.compareCreators(['id1', 'id2', 'id3']);
```

## Data Types

### NormalizedMetrics
- `totalReach`: Estimated unique audience size
- `averageEngagementRate`: Platform-weighted engagement
- `contentFrequency`: Posting patterns and consistency
- `audienceQuality`: Authenticity and relevance scores
- `growthRate`: Momentum and trajectory
- `platformDistribution`: Primary platform and weights

### CompositeScore
- `overallScore`: 0-100 unified score
- `breakdown`: Individual component scores
- `tier`: Platinum, Gold, Silver, Bronze, or Emerging
- `confidence`: Data quality indicator

### CreatorInsights
- `strongestPlatform`: Best performing platform
- `contentThemes`: Top 5 content categories
- `audienceOverlap`: Cross-platform audience percentage
- `recommendedActions`: Optimization suggestions
- `estimatedValue`: Sponsorship price ranges

## Scoring Algorithm

### Score Components
1. **Reach (25%)**: Logarithmic scale based on total followers
2. **Engagement (25%)**: Platform-normalized engagement rates
3. **Consistency (20%)**: Posting frequency and pattern stability
4. **Audience Quality (20%)**: Authenticity and relevance metrics
5. **Growth (10%)**: Momentum and trajectory indicators

### Tier Classification
- **Platinum**: 85+ score with 100K+ reach
- **Gold**: 70+ score or 65+ with 50K+ reach
- **Silver**: 55+ score or 50+ with 10K+ reach
- **Bronze**: 40+ score or 35+ with 5K+ reach
- **Emerging**: All others with growth potential

## Platform Normalization

Different platforms have different baseline engagement rates. The engine normalizes these:

- **Instagram**: 1.0x (baseline)
- **TikTok**: 0.6x (typically higher raw engagement)
- **Twitter**: 2.5x (typically lower raw engagement)

## Content Theme Analysis

The engine identifies content themes through:
- Hashtag analysis
- Caption/description keywords
- Engagement patterns per theme
- Cross-platform theme consistency

## Audience Quality Assessment

Quality metrics include:
- **Engagement-to-Follower Ratio**: Active audience percentage
- **Authenticity Score**: Bot detection and pattern analysis
- **Relevance Score**: Content consistency and hashtag focus
- **Cross-Platform Synergy**: Username consistency and cross-promotion

## Performance Optimization

- Batch processing for multiple creators
- Caching of platform API responses
- Parallel data fetching across platforms
- Efficient JSON storage in PostgreSQL

## Error Handling

The engine gracefully handles:
- Missing platform data
- API rate limits
- Stale data (with confidence reduction)
- Platform-specific errors

## Testing

```bash
# Run aggregation tests
npm test lib/aggregation

# Specific test suites
npm test data-normalizer.test.ts
npm test composite-scorer.test.ts
```