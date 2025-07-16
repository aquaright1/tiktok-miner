-- CreateEnum
CREATE TYPE "ApiAlertType" AS ENUM ('RATE_LIMIT_WARNING', 'RATE_LIMIT_CRITICAL', 'COST_WARNING', 'COST_CRITICAL', 'ERROR_RATE_HIGH');

-- CreateTable
CREATE TABLE "ApiUsage" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "model" TEXT,
    "endpoint" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tokensUsed" INTEGER DEFAULT 0,
    "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "userId" TEXT,
    "requestId" TEXT,
    "responseTime" INTEGER,
    "statusCode" INTEGER,
    "error" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiLimit" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "model" TEXT,
    "rateLimitHourly" INTEGER,
    "rateLimitDaily" INTEGER,
    "tokenLimitHourly" INTEGER,
    "tokenLimitDaily" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiPricing" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "pricePerToken" DOUBLE PRECISION NOT NULL,
    "pricePerRequest" DOUBLE PRECISION,
    "pricingTier" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiPricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiAlert" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "alertType" "ApiAlertType" NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "message" TEXT NOT NULL,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApiUsage_requestId_key" ON "ApiUsage"("requestId");

-- CreateIndex
CREATE INDEX "ApiUsage_platform_timestamp_idx" ON "ApiUsage"("platform", "timestamp");

-- CreateIndex
CREATE INDEX "ApiUsage_userId_idx" ON "ApiUsage"("userId");

-- CreateIndex
CREATE INDEX "ApiUsage_createdAt_idx" ON "ApiUsage"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApiLimit_platform_model_key" ON "ApiLimit"("platform", "model");

-- CreateIndex
CREATE INDEX "ApiLimit_platform_idx" ON "ApiLimit"("platform");

-- CreateIndex
CREATE UNIQUE INDEX "ApiPricing_platform_model_effectiveFrom_key" ON "ApiPricing"("platform", "model", "effectiveFrom");

-- CreateIndex
CREATE INDEX "ApiPricing_platform_model_idx" ON "ApiPricing"("platform", "model");

-- CreateIndex
CREATE INDEX "ApiAlert_platform_alertType_isResolved_idx" ON "ApiAlert"("platform", "alertType", "isResolved");

-- CreateIndex
CREATE INDEX "ApiAlert_createdAt_idx" ON "ApiAlert"("createdAt");

-- AddForeignKey
ALTER TABLE "ApiUsage" ADD CONSTRAINT "ApiUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;