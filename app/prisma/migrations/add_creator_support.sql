-- CreateEnum
CREATE TYPE "CandidateType" AS ENUM ('ENGINEERING_CANDIDATE', 'CREATOR');

-- AlterTable
ALTER TABLE "Candidate" ADD COLUMN "candidateType" "CandidateType" NOT NULL DEFAULT 'ENGINEERING_CANDIDATE';

-- CreateTable
CREATE TABLE "CreatorProfile" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "followerCount" INTEGER NOT NULL,
    "engagementRate" DOUBLE PRECISION NOT NULL,
    "lastSync" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "profileData" JSONB,
    "metrics" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreatorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CreatorProfile_candidateId_key" ON "CreatorProfile"("candidateId");

-- AddForeignKey
ALTER TABLE "CreatorProfile" ADD CONSTRAINT "CreatorProfile_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;