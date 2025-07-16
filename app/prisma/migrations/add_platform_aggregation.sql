-- Create PlatformProfile model for storing platform-specific data
CREATE TABLE IF NOT EXISTS "PlatformProfile" (
    "id" TEXT NOT NULL,
    "creatorProfileId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "followerCount" INTEGER NOT NULL DEFAULT 0,
    "followingCount" INTEGER,
    "postCount" INTEGER,
    "engagementRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "profileData" JSONB,
    "metrics" JSONB,
    "lastSync" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformProfile_pkey" PRIMARY KEY ("id")
);

-- Create unique index for creator + platform combination
CREATE UNIQUE INDEX "PlatformProfile_creatorProfileId_platform_key" ON "PlatformProfile"("creatorProfileId", "platform");

-- Add foreign key constraint
ALTER TABLE "PlatformProfile" ADD CONSTRAINT "PlatformProfile_creatorProfileId_fkey" 
    FOREIGN KEY ("creatorProfileId") REFERENCES "CreatorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add aggregatedData column to CreatorProfile if it doesn't exist
ALTER TABLE "CreatorProfile" 
    ADD COLUMN IF NOT EXISTS "aggregatedData" JSONB;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS "PlatformProfile_platform_idx" ON "PlatformProfile"("platform");
CREATE INDEX IF NOT EXISTS "PlatformProfile_engagementRate_idx" ON "PlatformProfile"("engagementRate");
CREATE INDEX IF NOT EXISTS "CreatorProfile_aggregatedData_idx" ON "CreatorProfile" USING GIN("aggregatedData");

-- Create a view for aggregated creator metrics
CREATE OR REPLACE VIEW "CreatorAggregatedMetrics" AS
SELECT 
    cp.id,
    cp.username,
    cp.platform as primary_platform,
    cp."followerCount" as total_followers,
    cp."engagementRate" as avg_engagement_rate,
    cp."aggregatedData"->>'compositeScore' as composite_score,
    cp."aggregatedData"->'compositeScore'->>'tier' as tier,
    cp."aggregatedData"->'insights'->>'strongestPlatform' as strongest_platform,
    COUNT(pp.id) as platform_count,
    cp."lastSync"
FROM "CreatorProfile" cp
LEFT JOIN "PlatformProfile" pp ON cp.id = pp."creatorProfileId"
GROUP BY cp.id, cp.username, cp.platform, cp."followerCount", cp."engagementRate", cp."aggregatedData", cp."lastSync";