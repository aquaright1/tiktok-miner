# Shadow Bee Testing Guide

This guide covers the comprehensive testing strategy for Shadow Bee, including unit tests, integration tests, end-to-end tests, and performance testing.

## Test Infrastructure

Shadow Bee uses a modern testing stack optimized for both developer experience and CI/CD pipelines.

### Testing Tools

- **Jest**: Unit and integration testing framework
- **React Testing Library**: Component testing
- **Playwright**: End-to-end testing
- **Supertest**: API endpoint testing
- **Mock Service Worker (MSW)**: API mocking
- **Faker.js**: Test data generation

## Running Tests

### Quick Commands

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test suites
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests
npm run test:e2e          # End-to-end tests
npm run test:performance  # Performance benchmarks

# Run tests in watch mode
npm test -- --watch

# Run tests for specific file/pattern
npm test -- creator-ranking
npm test -- --testPathPattern=aggregation
```

### Test Configuration Files

- `jest.config.js` - Main Jest configuration
- `jest.config.integration.js` - Integration test config
- `jest.config.performance.js` - Performance test config
- `playwright.config.ts` - E2E test configuration

## Unit Testing

### Creator Service Tests

Example: `__tests__/services/creator-ranking.test.ts`

```typescript
import { CreatorRankingService } from '@/lib/services/creator-ranking';
import { mockCreatorData } from '@/__mocks__/creator-data';

describe('CreatorRankingService', () => {
  let service: CreatorRankingService;

  beforeEach(() => {
    service = new CreatorRankingService();
  });

  describe('calculateEngagementRate', () => {
    it('should calculate engagement rate correctly', () => {
      const metrics = {
        followers: 10000,
        likes: 500,
        comments: 100,
        shares: 50,
      };

      const rate = service.calculateEngagementRate(metrics);
      expect(rate).toBe(6.5); // (500+100+50)/10000 * 100
    });

    it('should handle zero followers', () => {
      const metrics = {
        followers: 0,
        likes: 100,
        comments: 20,
        shares: 10,
      };

      const rate = service.calculateEngagementRate(metrics);
      expect(rate).toBe(0);
    });
  });

  describe('rankCreators', () => {
    it('should rank creators by composite score', () => {
      const creators = mockCreatorData(5);
      const ranked = service.rankCreators(creators);

      expect(ranked).toHaveLength(5);
      expect(ranked[0].compositeScore).toBeGreaterThanOrEqual(
        ranked[1].compositeScore
      );
    });
  });
});
```

### Data Aggregation Tests

Example: `__tests__/aggregation/composite-scorer.test.ts`

```typescript
import { CompositeScorer } from '@/lib/aggregation/composite-scorer';

describe('CompositeScorer', () => {
  let scorer: CompositeScorer;

  beforeEach(() => {
    scorer = new CompositeScorer();
  });

  describe('calculateScore', () => {
    it('should return score between 0 and 100', () => {
      const metrics = {
        engagementRate: 5.5,
        followerCount: 50000,
        contentFrequency: 3.5,
        audienceQuality: 0.85,
      };

      const score = scorer.calculateScore(metrics);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should classify tiers correctly', () => {
      const testCases = [
        { score: 95, expectedTier: 'platinum' },
        { score: 82, expectedTier: 'gold' },
        { score: 68, expectedTier: 'silver' },
        { score: 52, expectedTier: 'bronze' },
        { score: 25, expectedTier: 'emerging' },
      ];

      testCases.forEach(({ score, expectedTier }) => {
        const tier = scorer.getTier(score);
        expect(tier).toBe(expectedTier);
      });
    });
  });
});
```

## Integration Testing

### Database Integration Tests

Example: `__tests__/integration/creator-repository.test.ts`

```typescript
import { PrismaClient } from '@prisma/client';
import { CreatorRepository } from '@/lib/repositories/creator-repository';

describe('CreatorRepository Integration', () => {
  let prisma: PrismaClient;
  let repository: CreatorRepository;

  beforeAll(async () => {
    // Use test database
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    prisma = new PrismaClient();
    repository = new CreatorRepository(prisma);
    
    // Run migrations
    await prisma.$executeRaw`DELETE FROM "Creator"`;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should create and retrieve creator', async () => {
    const creatorData = {
      name: 'Test Creator',
      platformIdentifiers: {
        instagram: 'testcreator',
        youtube: 'UC123456',
      },
      compositeScore: 75.5,
      tier: 'gold',
    };

    const created = await repository.create(creatorData);
    expect(created.id).toBeDefined();

    const retrieved = await repository.findById(created.id);
    expect(retrieved?.name).toBe('Test Creator');
    expect(retrieved?.compositeScore).toBe(75.5);
  });

  it('should search creators by platform', async () => {
    const results = await repository.searchByPlatform('instagram', {
      minFollowers: 1000,
      maxFollowers: 100000,
    });

    expect(Array.isArray(results)).toBe(true);
  });
});
```

### API Integration Tests

Example: `__tests__/integration/api/creators.test.ts`

```typescript
import request from 'supertest';
import { createMocks } from 'node-mocks-http';
import handler from '@/app/api/creators/route';

describe('GET /api/creators', () => {
  it('should return paginated creators', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      query: {
        page: '1',
        limit: '10',
        platform: 'instagram',
      },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const data = JSON.parse(res._getData());
    expect(data).toHaveProperty('creators');
    expect(data).toHaveProperty('total');
    expect(data).toHaveProperty('page');
    expect(data.creators).toHaveLength(10);
  });

  it('should filter by tier', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      query: {
        tier: 'gold',
      },
    });

    await handler(req, res);

    const data = JSON.parse(res._getData());
    expect(data.creators.every((c: any) => c.tier === 'gold')).toBe(true);
  });
});
```

## End-to-End Testing

### Playwright Configuration

`playwright.config.ts`:
```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
});
```

### E2E Test Examples

`e2e/creator-discovery.spec.ts`:
```typescript
import { test, expect } from '@playwright/test';

test.describe('Creator Discovery Flow', () => {
  test('should search and view creator profile', async ({ page }) => {
    await page.goto('/creators');

    // Search for creators
    await page.fill('[data-testid="search-input"]', 'fitness');
    await page.click('[data-testid="search-button"]');

    // Wait for results
    await page.waitForSelector('[data-testid="creator-card"]');
    const results = await page.$$('[data-testid="creator-card"]');
    expect(results.length).toBeGreaterThan(0);

    // Click first result
    await results[0].click();

    // Verify profile page
    await expect(page).toHaveURL(/\/creators\/[\w-]+/);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('[data-testid="engagement-chart"]')).toBeVisible();
  });

  test('should start discovery pipeline', async ({ page }) => {
    await page.goto('/admin/discovery');

    // Start pipeline
    await page.click('[data-testid="start-pipeline"]');
    
    // Verify status
    await expect(page.locator('[data-testid="pipeline-status"]')).toHaveText('Running');
    
    // Check for job progress
    await page.waitForSelector('[data-testid="job-progress"]', { timeout: 10000 });
  });
});
```

### Page Object Model

`e2e/pages/CreatorProfilePage.ts`:
```typescript
import { Page, Locator } from '@playwright/test';

export class CreatorProfilePage {
  readonly page: Page;
  readonly profileHeader: Locator;
  readonly engagementChart: Locator;
  readonly platformTabs: Locator;
  readonly exportButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.profileHeader = page.locator('[data-testid="profile-header"]');
    this.engagementChart = page.locator('[data-testid="engagement-chart"]');
    this.platformTabs = page.locator('[data-testid="platform-tabs"]');
    this.exportButton = page.locator('[data-testid="export-button"]');
  }

  async goto(creatorId: string) {
    await this.page.goto(`/creators/${creatorId}`);
  }

  async selectPlatform(platform: string) {
    await this.platformTabs.locator(`button:has-text("${platform}")`).click();
  }

  async exportData(format: 'csv' | 'json') {
    await this.exportButton.click();
    await this.page.click(`[data-testid="export-${format}"]`);
  }
}
```

## Performance Testing

### Load Testing with k6

`performance/load-test.js`:
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 },
    { duration: '1m', target: 50 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.1'],
  },
};

export default function () {
  // Test creator search
  const searchRes = http.get('http://localhost:3000/api/creators?query=fitness');
  check(searchRes, {
    'search status is 200': (r) => r.status === 200,
    'search response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);

  // Test creator profile
  const profileRes = http.get('http://localhost:3000/api/creators/123');
  check(profileRes, {
    'profile status is 200': (r) => r.status === 200,
    'profile has data': (r) => JSON.parse(r.body).creator !== null,
  });
}
```

### Database Performance Tests

`__tests__/performance/database.test.ts`:
```typescript
describe('Database Performance', () => {
  it('should handle bulk creator queries efficiently', async () => {
    const start = Date.now();
    
    const results = await prisma.creator.findMany({
      where: {
        compositeScore: { gte: 70 },
        tier: { in: ['platinum', 'gold'] },
      },
      include: {
        platformMetrics: true,
      },
      take: 100,
    });

    const duration = Date.now() - start;
    
    expect(duration).toBeLessThan(100); // Should complete in < 100ms
    expect(results.length).toBeGreaterThan(0);
  });

  it('should aggregate metrics efficiently', async () => {
    const start = Date.now();
    
    const aggregated = await prisma.platformMetric.groupBy({
      by: ['platform'],
      _avg: {
        engagementRate: true,
        followersCount: true,
      },
      _count: true,
    });

    const duration = Date.now() - start;
    
    expect(duration).toBeLessThan(200); // Should complete in < 200ms
  });
});
```

## Mocking Strategies

### API Mocking with MSW

`__mocks__/handlers.ts`:
```typescript
import { rest } from 'msw';

export const handlers = [
  // Mock Instagram API
  rest.get('https://graph.instagram.com/:userId', (req, res, ctx) => {
    return res(
      ctx.json({
        id: req.params.userId,
        username: 'mockuser',
        followers_count: 50000,
        media_count: 150,
      })
    );
  }),

  // Mock YouTube API
  rest.get('https://www.googleapis.com/youtube/v3/channels', (req, res, ctx) => {
    return res(
      ctx.json({
        items: [{
          id: 'UC123456',
          statistics: {
            subscriberCount: '100000',
            viewCount: '5000000',
            videoCount: '200',
          },
        }],
      })
    );
  }),
];
```

### Database Mocking

`__mocks__/prisma.ts`:
```typescript
import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';

import prisma from '@/lib/prisma';

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockDeep<PrismaClient>(),
}));

beforeEach(() => {
  mockReset(prismaMock);
});

export const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
```

## Test Data Management

### Test Fixtures

`__fixtures__/creators.ts`:
```typescript
export const creatorFixtures = {
  platinumCreator: {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Top Fitness Influencer',
    compositeScore: 92.5,
    tier: 'platinum',
    platformIdentifiers: {
      instagram: 'topfitness',
      youtube: 'UCfitness123',
    },
  },
  goldCreator: {
    id: '223e4567-e89b-12d3-a456-426614174001',
    name: 'Rising Tech Creator',
    compositeScore: 78.3,
    tier: 'gold',
    platformIdentifiers: {
      twitter: 'techcreator',
      youtube: 'UCtech456',
    },
  },
};
```

### Test Data Factories

`__tests__/factories/creator.factory.ts`:
```typescript
import { faker } from '@faker-js/faker';
import { Creator, PlatformMetric } from '@prisma/client';

export const createMockCreator = (overrides?: Partial<Creator>): Creator => ({
  id: faker.datatype.uuid(),
  name: faker.person.fullName(),
  email: faker.internet.email(),
  bio: faker.lorem.paragraph(),
  profileImageUrl: faker.image.avatar(),
  platformIdentifiers: {
    instagram: faker.internet.userName(),
    youtube: `UC${faker.string.alphanumeric(12)}`,
  },
  compositeScore: faker.number.float({ min: 0, max: 100 }),
  tier: faker.helpers.arrayElement(['platinum', 'gold', 'silver', 'bronze', 'emerging']),
  tags: faker.helpers.arrayElements(['fitness', 'tech', 'fashion', 'food'], 2),
  verified: faker.datatype.boolean(),
  createdAt: faker.date.past(),
  updatedAt: faker.date.recent(),
  ...overrides,
});

export const createMockPlatformMetric = (
  creatorId: string,
  platform: string
): PlatformMetric => ({
  id: faker.datatype.uuid(),
  creatorId,
  platform,
  followersCount: faker.number.int({ min: 1000, max: 1000000 }),
  engagementRate: faker.number.float({ min: 0.5, max: 15 }),
  averageViews: faker.number.int({ min: 100, max: 100000 }),
  postsCount: faker.number.int({ min: 10, max: 1000 }),
  lastPostDate: faker.date.recent(),
  platformSpecific: {},
  createdAt: faker.date.past(),
  updatedAt: faker.date.recent(),
});
```

## CI/CD Testing

### GitHub Actions Workflow

`.github/workflows/test.yml`:
```yaml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Setup test database
        run: |
          npx prisma migrate deploy
          npx prisma db seed
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
      
      - name: Run unit tests
        run: npm run test:unit -- --coverage
      
      - name: Run integration tests
        run: npm run test:integration
        env:
          TEST_DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
      
      - name: Run E2E tests
        run: npm run test:e2e
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: |
            coverage/
            playwright-report/
            test-results/
```

## Test Coverage Goals

### Coverage Targets

- **Overall**: > 80%
- **Critical Paths**: > 90%
  - Creator ranking algorithms
  - Data aggregation engine
  - Discovery pipeline
  - API endpoints
- **UI Components**: > 70%
- **Utilities**: > 95%

### Coverage Report

After running tests with coverage:

```bash
npm run test:coverage
```

View the HTML report:
```bash
open coverage/lcov-report/index.html
```

## Best Practices

### 1. Test Organization
- Group related tests in describe blocks
- Use clear, descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)
- Keep tests focused and independent

### 2. Test Data
- Use factories for consistent test data
- Avoid hardcoded values
- Clean up test data after each test
- Use realistic data ranges

### 3. Async Testing
- Always await async operations
- Use proper async matchers
- Set appropriate timeouts
- Handle promise rejections

### 4. Mocking
- Mock external dependencies
- Keep mocks close to reality
- Update mocks when APIs change
- Use partial mocks when possible

### 5. Performance
- Run tests in parallel when possible
- Use test databases for integration tests
- Optimize slow tests
- Monitor test execution time

## Debugging Tests

### VSCode Configuration

`.vscode/launch.json`:
```json
{
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Jest Debug",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": [
        "--runInBand",
        "--testPathPattern=${file}"
      ],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
```

### Debugging Tips
- Use `test.only` to run single test
- Add `console.log` for quick debugging
- Use `debug()` from Testing Library
- Enable verbose mode: `npm test -- --verbose`
- Check test logs in CI artifacts