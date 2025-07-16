-- Create enum types if they don't exist
DO $$ BEGIN
    CREATE TYPE "ATSStage" AS ENUM ('NONE', 'CONSIDERED', 'OUTREACHED', 'INTRO', 'ROUND1', 'ROUND2', 'OFFER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "PipelineStatus" AS ENUM ('NONE', 'ACTIVE', 'REJECTED', 'ACCEPTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "CandidateType" AS ENUM ('ENGINEERING_CANDIDATE', 'CREATOR');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "SyncStatus" AS ENUM ('PENDING', 'SYNCING', 'COMPLETED', 'FAILED', 'RATE_LIMITED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

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

-- Add updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add trigger for updatedAt column
DROP TRIGGER IF EXISTS update_Candidate_updated_at ON "Candidate";
CREATE TRIGGER update_Candidate_updated_at BEFORE UPDATE ON "Candidate"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add foreign key constraint if it doesn't exist
DO $$ BEGIN
    ALTER TABLE "CreatorProfile" 
        ADD CONSTRAINT "CreatorProfile_candidateId_fkey" 
        FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") 
        ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;