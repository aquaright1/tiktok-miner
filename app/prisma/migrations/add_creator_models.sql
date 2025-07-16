-- This migration adds comprehensive creator profile and metrics tracking
-- Run this after the initial Prisma migration

-- Add any custom constraints or triggers

-- Ensure platform identifiers are valid JSON
ALTER TABLE "CreatorProfile"
ADD CONSTRAINT valid_platform_identifiers
CHECK (jsonb_typeof("platformIdentifiers") = 'object');

-- Ensure engagement scores are between 0 and 100
ALTER TABLE "CreatorProfile"
ADD CONSTRAINT valid_engagement_score
CHECK ("compositeEngagementScore" IS NULL OR ("compositeEngagementScore" >= 0 AND "compositeEngagementScore" <= 100));

ALTER TABLE "CreatorProfile"
ADD CONSTRAINT valid_audience_quality_score
CHECK ("audienceQualityScore" IS NULL OR ("audienceQualityScore" >= 0 AND "audienceQualityScore" <= 100));

-- Add triggers for auto-updating calculated fields

-- Function to update composite engagement score
CREATE OR REPLACE FUNCTION update_composite_engagement_score()
RETURNS TRIGGER AS $$
DECLARE
  youtube_engagement FLOAT;
  twitter_engagement FLOAT;
  instagram_engagement FLOAT;
  tiktok_engagement FLOAT;
  linkedin_engagement FLOAT;
  platform_count INT := 0;
  total_engagement FLOAT := 0;
BEGIN
  -- Get engagement rates from each platform
  SELECT "engagementRate" INTO youtube_engagement
  FROM "YoutubeMetrics" WHERE "creatorProfileId" = NEW.id;
  
  SELECT "engagementRate" INTO twitter_engagement
  FROM "TwitterMetrics" WHERE "creatorProfileId" = NEW.id;
  
  SELECT "engagementRate" INTO instagram_engagement
  FROM "InstagramMetrics" WHERE "creatorProfileId" = NEW.id;
  
  SELECT "engagementRate" INTO tiktok_engagement
  FROM "TiktokMetrics" WHERE "creatorProfileId" = NEW.id;
  
  SELECT "engagementRate" INTO linkedin_engagement
  FROM "LinkedinMetrics" WHERE "creatorProfileId" = NEW.id;
  
  -- Calculate weighted average
  IF youtube_engagement IS NOT NULL THEN
    total_engagement := total_engagement + youtube_engagement;
    platform_count := platform_count + 1;
  END IF;
  
  IF twitter_engagement IS NOT NULL THEN
    total_engagement := total_engagement + twitter_engagement;
    platform_count := platform_count + 1;
  END IF;
  
  IF instagram_engagement IS NOT NULL THEN
    total_engagement := total_engagement + instagram_engagement;
    platform_count := platform_count + 1;
  END IF;
  
  IF tiktok_engagement IS NOT NULL THEN
    total_engagement := total_engagement + tiktok_engagement;
    platform_count := platform_count + 1;
  END IF;
  
  IF linkedin_engagement IS NOT NULL THEN
    total_engagement := total_engagement + linkedin_engagement;
    platform_count := platform_count + 1;
  END IF;
  
  IF platform_count > 0 THEN
    NEW."compositeEngagementScore" := total_engagement / platform_count;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update total reach
CREATE OR REPLACE FUNCTION update_total_reach()
RETURNS TRIGGER AS $$
DECLARE
  youtube_subs INT;
  twitter_followers INT;
  instagram_followers INT;
  tiktok_followers INT;
  linkedin_followers INT;
BEGIN
  -- Get follower counts from each platform
  SELECT "subscriberCount" INTO youtube_subs
  FROM "YoutubeMetrics" WHERE "creatorProfileId" = NEW.id;
  
  SELECT "followerCount" INTO twitter_followers
  FROM "TwitterMetrics" WHERE "creatorProfileId" = NEW.id;
  
  SELECT "followerCount" INTO instagram_followers
  FROM "InstagramMetrics" WHERE "creatorProfileId" = NEW.id;
  
  SELECT "followerCount" INTO tiktok_followers
  FROM "TiktokMetrics" WHERE "creatorProfileId" = NEW.id;
  
  SELECT "followerCount" INTO linkedin_followers
  FROM "LinkedinMetrics" WHERE "creatorProfileId" = NEW.id;
  
  -- Calculate total reach
  NEW."totalReach" := COALESCE(youtube_subs, 0) + 
                     COALESCE(twitter_followers, 0) + 
                     COALESCE(instagram_followers, 0) + 
                     COALESCE(tiktok_followers, 0) + 
                     COALESCE(linkedin_followers, 0);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers on platform metrics tables to update creator profile
CREATE OR REPLACE FUNCTION update_creator_profile_metrics()
RETURNS TRIGGER AS $$
BEGIN
  -- Force update of the creator profile to recalculate metrics
  UPDATE "CreatorProfile"
  SET "updatedAt" = NOW()
  WHERE id = NEW."creatorProfileId";
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER update_creator_metrics_on_youtube_change
AFTER INSERT OR UPDATE ON "YoutubeMetrics"
FOR EACH ROW EXECUTE FUNCTION update_creator_profile_metrics();

CREATE TRIGGER update_creator_metrics_on_twitter_change
AFTER INSERT OR UPDATE ON "TwitterMetrics"
FOR EACH ROW EXECUTE FUNCTION update_creator_profile_metrics();

CREATE TRIGGER update_creator_metrics_on_instagram_change
AFTER INSERT OR UPDATE ON "InstagramMetrics"
FOR EACH ROW EXECUTE FUNCTION update_creator_profile_metrics();

CREATE TRIGGER update_creator_metrics_on_tiktok_change
AFTER INSERT OR UPDATE ON "TiktokMetrics"
FOR EACH ROW EXECUTE FUNCTION update_creator_profile_metrics();

CREATE TRIGGER update_creator_metrics_on_linkedin_change
AFTER INSERT OR UPDATE ON "LinkedinMetrics"
FOR EACH ROW EXECUTE FUNCTION update_creator_profile_metrics();

-- Apply triggers to CreatorProfile
CREATE TRIGGER calculate_composite_engagement
BEFORE INSERT OR UPDATE ON "CreatorProfile"
FOR EACH ROW EXECUTE FUNCTION update_composite_engagement_score();

CREATE TRIGGER calculate_total_reach
BEFORE INSERT OR UPDATE ON "CreatorProfile"
FOR EACH ROW EXECUTE FUNCTION update_total_reach();

-- Add partitioning for high-volume tables (optional, for very large datasets)
-- This would partition CreatorMetricsHistory by month
-- ALTER TABLE "CreatorMetricsHistory" PARTITION BY RANGE (timestamp);

-- Create initial partitions (example for current and next 3 months)
-- CREATE TABLE "CreatorMetricsHistory_2024_01" PARTITION OF "CreatorMetricsHistory"
--   FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
-- CREATE TABLE "CreatorMetricsHistory_2024_02" PARTITION OF "CreatorMetricsHistory"
--   FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');
-- etc...