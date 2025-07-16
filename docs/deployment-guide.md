# Shadow Bee Deployment Guide

This guide covers deploying Shadow Bee to production environments with proper configuration, security, and monitoring.

## Prerequisites

- Node.js 18+ or Bun runtime
- PostgreSQL 14+ database
- Redis 6+ for job queues
- Domain name with SSL certificate
- Cloud storage (S3 or compatible) for exports

## Environment Setup

### 1. Database Configuration

#### PostgreSQL Setup
```sql
-- Create database and user
CREATE DATABASE tiktok_miner_production;
CREATE USER tiktok_miner_user WITH ENCRYPTED PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE tiktok_miner_production TO tiktok_miner_user;

-- Enable required extensions
\c tiktok_miner_production
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
```

#### Prisma Migrations
```bash
# Set production database URL
export DATABASE_URL="postgresql://tiktok_miner_user:secure_password@localhost:5432/tiktok_miner_production"

# Run migrations
bunx prisma migrate deploy

# Seed initial data (optional)
bunx prisma db seed
```

### 2. Redis Configuration

```bash
# Install Redis
sudo apt-get install redis-server

# Configure Redis for production
sudo nano /etc/redis/redis.conf
```

Recommended Redis settings:
```conf
# Enable persistence
save 900 1
save 300 10
save 60 10000

# Set memory policy
maxmemory 2gb
maxmemory-policy allkeys-lru

# Enable AOF
appendonly yes
appendfsync everysec

# Security
requirepass your_redis_password
```

### 3. Environment Variables

Create `.env.production`:
```bash
# Application
NODE_ENV=production
PORT=3000
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=generate_with_openssl_rand_base64_32

# Database
DATABASE_URL=postgresql://user:pass@host:5432/tiktok_miner_production
REDIS_URL=redis://:password@localhost:6379

# API Keys (see API_SETUP_GUIDE.md for obtaining these)
GITHUB_TOKEN=ghp_xxxxxxxxxxxx
OPENAI_API_KEY=sk-xxxxxxxxxxxx
PERPLEXITY_API_KEY=pplx-xxxxxxxxxxxx

# Social Media APIs
INSTAGRAM_CLIENT_ID=xxxxxxxxxxxx
INSTAGRAM_CLIENT_SECRET=xxxxxxxxxxxx
TIKTOK_CLIENT_KEY=xxxxxxxxxxxx
TIKTOK_CLIENT_SECRET=xxxxxxxxxxxx
TWITTER_BEARER_TOKEN=xxxxxxxxxxxx
YOUTUBE_API_KEY=xxxxxxxxxxxx

# Email Configuration
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=SG.xxxxxxxxxxxx

# Storage (for exports)
AWS_ACCESS_KEY_ID=xxxxxxxxxxxx
AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxx
AWS_REGION=us-east-1
S3_BUCKET_NAME=tiktok-miner-exports

# Monitoring
SENTRY_DSN=https://xxxx@sentry.io/xxxx
LOG_LEVEL=info
```

## Deployment Options

### Option 1: Docker Deployment

Create `Dockerfile`:
```dockerfile
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy dependency files
COPY app/package*.json ./
COPY app/prisma ./prisma/

# Install dependencies
RUN npm ci --only=production

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY app/ .

# Generate Prisma client
RUN npx prisma generate

# Build Next.js
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["node", "server.js"]
```

Create `docker-compose.yml`:
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    env_file:
      - .env.production
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  postgres:
    image: postgres:14-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
          POSTGRES_DB: tiktok_miner_production
    POSTGRES_USER: tiktok_miner_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - /etc/letsencrypt:/etc/letsencrypt
    depends_on:
      - app
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

### Option 2: PM2 Deployment

Install PM2:
```bash
npm install -g pm2
```

Create `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [{
          name: 'tiktok-miner',
    script: 'npm',
    args: 'start',
    cwd: './app',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }, {
          name: 'tiktok-miner-worker',
    script: './app/workers/discovery-worker.js',
    instances: 2,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production'
    }
  }]
};
```

Start with PM2:
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Option 3: Vercel Deployment

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Configure `vercel.json`:
```json
{
  "buildCommand": "cd app && npm run build",
  "outputDirectory": "app/.next",
  "framework": "nextjs",
  "env": {
    "DATABASE_URL": "@database_url",
    "REDIS_URL": "@redis_url"
  }
}
```

3. Deploy:
```bash
vercel --prod
```

## Nginx Configuration

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API rate limiting
    location /api/ {
        limit_req zone=api burst=10 nodelay;
        proxy_pass http://localhost:3000;
    }
}
```

## Post-Deployment Steps

### 1. Database Optimization

```sql
-- Create indexes for performance
CREATE INDEX idx_creators_composite_score ON creators(composite_score DESC);
CREATE INDEX idx_creators_platform ON creators USING GIN(platform_identifiers);
CREATE INDEX idx_platform_metrics_creator ON platform_metrics(creator_id);
CREATE INDEX idx_discovery_logs_timestamp ON discovery_logs(created_at);

-- Analyze tables
ANALYZE creators;
ANALYZE platform_metrics;
```

### 2. Set Up Monitoring

#### Application Monitoring (Sentry)
```javascript
// app/lib/monitoring.ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  profilesSampleRate: 0.1,
});
```

#### Health Checks
```javascript
// app/api/health/route.ts
export async function GET() {
  const checks = {
    database: await checkDatabase(),
    redis: await checkRedis(),
    apis: await checkAPIs(),
  };
  
  const healthy = Object.values(checks).every(check => check.healthy);
  
  return Response.json({
    status: healthy ? 'healthy' : 'unhealthy',
    checks,
    timestamp: new Date().toISOString(),
  }, {
    status: healthy ? 200 : 503,
  });
}
```

### 3. Set Up Backups

```bash
# Database backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/postgres"
DB_NAME="tiktok_miner_production"

# Create backup
pg_dump $DB_NAME | gzip > $BACKUP_DIR/backup_$DATE.sql.gz

# Upload to S3
aws s3 cp $BACKUP_DIR/backup_$DATE.sql.gz s3://tiktok-miner-backups/postgres/

# Clean old backups (keep 30 days)
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete
```

Add to crontab:
```bash
0 2 * * * /path/to/backup.sh
```

### 4. Configure Auto-scaling

For AWS EC2:
```bash
# Create AMI from configured instance
aws ec2 create-image --instance-id i-xxxxx --name "tiktok-miner-v1.0"

# Create launch template
aws ec2 create-launch-template --launch-template-name tiktok-miner-template \
  --version-description "v1.0" \
  --launch-template-data file://template.json

# Create auto-scaling group
aws autoscaling create-auto-scaling-group \
  --auto-scaling-group-name tiktok-miner-asg \
  --launch-template LaunchTemplateName=tiktok-miner-template \
  --min-size 2 --max-size 10 --desired-capacity 3
```

## Security Checklist

- [ ] SSL/TLS certificate installed and auto-renewal configured
- [ ] Environment variables secured and not in version control
- [ ] Database credentials rotated from defaults
- [ ] API keys have minimum required permissions
- [ ] Rate limiting configured on API endpoints
- [ ] CORS properly configured
- [ ] Security headers implemented
- [ ] Regular security updates scheduled
- [ ] Backup encryption enabled
- [ ] Monitoring and alerting configured
- [ ] DDoS protection enabled (CloudFlare/AWS Shield)
- [ ] WAF rules configured
- [ ] Secrets scanning in CI/CD pipeline
- [ ] Dependency vulnerability scanning

## Performance Optimization

### 1. Enable Caching

```javascript
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=60, s-maxage=300',
          },
        ],
      },
    ];
  },
};
```

### 2. Configure CDN

```bash
# CloudFlare configuration
# - Enable Auto Minify for JS/CSS/HTML
# - Enable Brotli compression
# - Configure Page Rules for /api/* to bypass cache
# - Enable Argo Smart Routing for better performance
```

### 3. Database Connection Pooling

```javascript
// lib/prisma.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Check DATABASE_URL format
   - Verify PostgreSQL is running
   - Check firewall rules
   - Verify SSL mode settings

2. **Redis Connection Issues**
   - Verify Redis password
   - Check Redis memory usage
   - Review Redis logs
   - Test connection with redis-cli

3. **API Rate Limits**
   - Monitor API usage dashboards
   - Implement request queuing
   - Add caching layer
   - Consider upgrading API tiers

4. **Memory Issues**
   - Increase Node.js heap size
   - Implement pagination
   - Optimize database queries
   - Add memory monitoring

## Maintenance

### Weekly Tasks
- Review error logs
- Check API quota usage
- Monitor database size
- Review security alerts

### Monthly Tasks
- Update dependencies
- Rotate API keys
- Review and optimize slow queries
- Test backup restoration

### Quarterly Tasks
- Security audit
- Performance review
- Cost optimization
- Disaster recovery drill