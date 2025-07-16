-- Create enum types
CREATE TYPE "ATSStage" AS ENUM ('NONE', 'CONSIDERED', 'OUTREACHED', 'INTRO', 'ROUND1', 'ROUND2', 'OFFER');
CREATE TYPE "PipelineStatus" AS ENUM ('NONE', 'ACTIVE', 'REJECTED', 'ACCEPTED');
CREATE TYPE "CandidateType" AS ENUM ('ENGINEERING_CANDIDATE', 'CREATOR');
CREATE TYPE "SyncStatus" AS ENUM ('PENDING', 'SYNCING', 'COMPLETED', 'FAILED', 'RATE_LIMITED');

-- Create Candidate table
CREATE TABLE IF NOT EXISTS "Candidate" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "githubUserId" TEXT,
  "linkedinUserId" TEXT,
  "matchScore" DOUBLE PRECISION,
  "status" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "jobDescriptionId" TEXT,
  "atsStage" "ATSStage" DEFAULT 'NONE',
  "pipelineStatus" "PipelineStatus" DEFAULT 'NONE',
  "stageUpdatedAt" TIMESTAMP(3),
  "candidateType" "CandidateType" DEFAULT 'ENGINEERING_CANDIDATE'
);

-- Create indexes for Candidate
CREATE INDEX IF NOT EXISTS "Candidate_githubUserId_idx" ON "Candidate"("githubUserId");
CREATE INDEX IF NOT EXISTS "Candidate_candidateType_idx" ON "Candidate"("candidateType");

-- Create CreatorProfile table
CREATE TABLE IF NOT EXISTS "CreatorProfile" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "candidateId" TEXT UNIQUE NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "bio" TEXT,
  "profileImageUrl" TEXT,
  "category" TEXT,
  "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "isVerified" BOOLEAN DEFAULT false,
  "platformIdentifiers" JSONB NOT NULL,
  "compositeEngagementScore" DOUBLE PRECISION,
  "totalReach" INTEGER DEFAULT 0,
  "averageEngagementRate" DOUBLE PRECISION,
  "contentFrequency" DOUBLE PRECISION,
  "audienceQualityScore" DOUBLE PRECISION,
  "lastSync" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "syncStatus" TEXT DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for CreatorProfile
CREATE INDEX IF NOT EXISTS "CreatorProfile_category_idx" ON "CreatorProfile"("category");
CREATE INDEX IF NOT EXISTS "CreatorProfile_compositeEngagementScore_idx" ON "CreatorProfile"("compositeEngagementScore");
CREATE INDEX IF NOT EXISTS "CreatorProfile_totalReach_idx" ON "CreatorProfile"("totalReach");

-- Add updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updatedAt columns
CREATE TRIGGER update_Candidate_updated_at BEFORE UPDATE ON "Candidate"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    
CREATE TRIGGER update_CreatorProfile_updated_at BEFORE UPDATE ON "CreatorProfile"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add foreign key constraint
ALTER TABLE "CreatorProfile" 
    ADD CONSTRAINT "CreatorProfile_candidateId_fkey" 
    FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") 
    ON DELETE RESTRICT ON UPDATE CASCADE;