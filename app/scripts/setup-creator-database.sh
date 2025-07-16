#!/bin/bash

# Database setup script for creator models and TimescaleDB

set -e

echo "🚀 Setting up creator database models..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if we're in the app directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: This script must be run from the app directory${NC}"
    exit 1
fi

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check dependencies
echo -e "${YELLOW}Checking dependencies...${NC}"

if ! command_exists npx; then
    echo -e "${RED}Error: npx is not installed. Please install Node.js/npm first.${NC}"
    exit 1
fi

# Install required packages if not already installed
echo -e "${YELLOW}Installing required packages...${NC}"
npm install --save-dev @faker-js/faker --legacy-peer-deps

# Step 1: Generate Prisma client
echo -e "${YELLOW}Generating Prisma client...${NC}"
npx prisma generate

# Step 2: Create and apply database migrations
echo -e "${YELLOW}Creating database migrations...${NC}"
npx prisma migrate dev --name add_creator_models --create-only

# Step 3: Apply the migrations
echo -e "${YELLOW}Applying migrations...${NC}"
npx prisma migrate deploy

# Step 4: Check if TimescaleDB is available
echo -e "${YELLOW}Checking TimescaleDB availability...${NC}"
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}Warning: DATABASE_URL not set. Skipping TimescaleDB setup.${NC}"
    SKIP_TIMESCALE=true
else
    # Test if we can connect and TimescaleDB is available
    npx prisma db execute --file ./prisma/migrations/enable_timescaledb.sql 2>/dev/null && {
        echo -e "${GREEN}✅ TimescaleDB setup completed${NC}"
    } || {
        echo -e "${YELLOW}⚠️  TimescaleDB not available or setup failed. Continuing without time-series features.${NC}"
        SKIP_TIMESCALE=true
    }
fi

# Step 5: Apply custom SQL migrations
if [ "$SKIP_TIMESCALE" != "true" ]; then
    echo -e "${YELLOW}Applying custom SQL migrations...${NC}"
    npx prisma db execute --file ./prisma/migrations/add_creator_models.sql
    echo -e "${GREEN}✅ Custom SQL migrations applied${NC}"
fi

# Step 6: Seed the database (optional)
read -p "Do you want to seed the database with sample creator data? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Seeding database...${NC}"
    npx ts-node --transpile-only prisma/seed-creators.ts
    echo -e "${GREEN}✅ Database seeded successfully${NC}"
fi

# Step 7: Verify the setup
echo -e "${YELLOW}Verifying database setup...${NC}"
npx prisma db pull --print 2>&1 | grep -E "(CreatorProfile|YoutubeMetrics|TwitterMetrics|InstagramMetrics|TiktokMetrics|LinkedinMetrics)" && {
    echo -e "${GREEN}✅ All creator models verified in database${NC}"
} || {
    echo -e "${RED}⚠️  Some models may not have been created properly${NC}"
}

echo -e "${GREEN}🎉 Database setup completed!${NC}"

# Print next steps
echo
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Update your .env file with proper DATABASE_URL if not already done"
echo "2. Run 'npm run dev' to start the application"
echo "3. Access the creator profiles at /app/creators"
echo "4. Use the API monitoring dashboard at /app/api-monitoring"

# Create a simple test script
cat > test-creator-models.ts << 'EOF'
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testModels() {
  try {
    // Test basic queries
    const creatorCount = await prisma.creatorProfile.count();
    console.log(`✅ Found ${creatorCount} creators in database`);
    
    // Test with metrics
    const creatorsWithMetrics = await prisma.creatorProfile.findMany({
      take: 5,
      include: {
        youtubeMetrics: true,
        twitterMetrics: true,
        instagramMetrics: true,
        tiktokMetrics: true,
        linkedinMetrics: true
      }
    });
    
    console.log(`✅ Successfully queried creators with platform metrics`);
    
    // Test time-series if available
    const metricsHistory = await prisma.creatorMetricsHistory.count();
    console.log(`✅ Found ${metricsHistory} historical metric entries`);
    
  } catch (error) {
    console.error('❌ Error testing models:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testModels();
EOF

echo
echo -e "${YELLOW}To test the models, run:${NC}"
echo "npx ts-node --transpile-only test-creator-models.ts"