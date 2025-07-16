-- Add new columns to JobDescription table with safe defaults
ALTER TABLE "JobDescription"
ADD COLUMN IF NOT EXISTS "title" TEXT,
ADD COLUMN IF NOT EXISTS "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "frameworks" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "otherKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "seniority" TEXT,
ADD COLUMN IF NOT EXISTS "yearsOfExperience" INTEGER,
ADD COLUMN IF NOT EXISTS "parsingMethod" TEXT NOT NULL DEFAULT 'traditional';

-- Update existing records to have default values
UPDATE "JobDescription"
SET
  "languages" = ARRAY[]::TEXT[]
WHERE "languages" IS NULL;

UPDATE "JobDescription"
SET
  "frameworks" = ARRAY[]::TEXT[]
WHERE "frameworks" IS NULL;

UPDATE "JobDescription"
SET
  "otherKeywords" = ARRAY[]::TEXT[]
WHERE "otherKeywords" IS NULL;

UPDATE "JobDescription"
SET
  "parsingMethod" = 'traditional'
WHERE "parsingMethod" IS NULL;