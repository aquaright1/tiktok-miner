-- Performance optimization indexes for creator models
-- This migration adds comprehensive indexes for optimal query performance

-- ============================================
-- CreatorProfile Indexes
-- ============================================

-- Search indexes for filtering and sorting
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_creator_profile_name_search 
ON "CreatorProfile" USING gin(to_tsvector('english', name));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_creator_profile_bio_search 
ON "CreatorProfile" USING gin(to_tsvector('english', bio));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_creator_profile_tags 
ON "CreatorProfile" USING gin(tags);

-- Composite indexes for common query patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_creator_profile_category_engagement 
ON "CreatorProfile"(category, "compositeEngagementScore" DESC NULLS LAST);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_creator_profile_reach_engagement 
ON "CreatorProfile"("totalReach" DESC, "compositeEngagementScore" DESC NULLS LAST);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_creator_profile_sync_status 
ON "CreatorProfile"("syncStatus", "lastSync");

-- JSON index for platform identifiers
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_creator_profile_platforms 
ON "CreatorProfile" USING gin("platformIdentifiers");

-- ============================================
-- Platform Metrics Indexes
-- ============================================

-- YouTube Metrics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_youtube_metrics_channel_search 
ON "YoutubeMetrics" USING gin(to_tsvector('english', "channelName" || ' ' || COALESCE(description, '')));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_youtube_metrics_country 
ON "YoutubeMetrics"(country) WHERE country IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_youtube_metrics_top_creators 
ON "YoutubeMetrics"("subscriberCount" DESC, "engagementRate" DESC);

-- Twitter Metrics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_twitter_metrics_verified 
ON "TwitterMetrics"("isVerified", "followerCount" DESC) WHERE "isVerified" = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_twitter_metrics_bio_search 
ON "TwitterMetrics" USING gin(to_tsvector('english', COALESCE(bio, '')));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_twitter_metrics_location 
ON "TwitterMetrics"(location) WHERE location IS NOT NULL;

-- Instagram Metrics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_instagram_metrics_business 
ON "InstagramMetrics"("isBusinessAccount", "businessCategory") 
WHERE "isBusinessAccount" = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_instagram_metrics_verified_engagement 
ON "InstagramMetrics"("isVerified", "engagementRate" DESC) 
WHERE "isVerified" = true;

-- TikTok Metrics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tiktok_metrics_viral_potential 
ON "TiktokMetrics"("engagementRate" DESC, "averageViews" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tiktok_metrics_growth 
ON "TiktokMetrics"("dailyFollowerGrowth" DESC NULLS LAST) 
WHERE "dailyFollowerGrowth" IS NOT NULL;

-- LinkedIn Metrics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_linkedin_metrics_industry 
ON "LinkedinMetrics"(industry, "followerCount" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_linkedin_metrics_headline_search 
ON "LinkedinMetrics" USING gin(to_tsvector('english', COALESCE(headline, '')));

-- ============================================
-- Time-Series Indexes (if TimescaleDB is enabled)
-- ============================================

-- These are in addition to TimescaleDB's automatic time-based indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_metrics_history_creator_platform 
ON "CreatorMetricsHistory"("creatorProfileId", platform, timestamp DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_metrics_history_growth 
ON "CreatorMetricsHistory"("followerGrowth" DESC, timestamp DESC) 
WHERE "followerGrowth" > 0;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_engagement_analytics_creator 
ON "EngagementAnalytics"("creatorProfileId", timestamp DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_engagement_analytics_peak_patterns 
ON "EngagementAnalytics"("peakEngagementHour", "peakEngagementDay") 
WHERE "peakEngagementHour" IS NOT NULL;

-- ============================================
-- API Usage and Monitoring Indexes
-- ============================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_usage_cost_analysis 
ON "ApiUsage"(platform, model, timestamp DESC, cost DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_usage_errors 
ON "ApiUsage"("statusCode", timestamp DESC) 
WHERE "statusCode" >= 400;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_usage_slow_requests 
ON "ApiUsage"("responseTime" DESC, timestamp DESC) 
WHERE "responseTime" > 1000;

-- ============================================
-- Partial Indexes for Common Filters
-- ============================================

-- High-value creators (top 10% by reach)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_creator_profile_high_reach 
ON "CreatorProfile"("totalReach" DESC, "compositeEngagementScore" DESC) 
WHERE "totalReach" > 100000;

-- Rising stars (high engagement, lower reach)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_creator_profile_rising_stars 
ON "CreatorProfile"("compositeEngagementScore" DESC, "totalReach") 
WHERE "compositeEngagementScore" > 5 AND "totalReach" < 50000;

-- Recently synced creators
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_creator_profile_recent_sync 
ON "CreatorProfile"("lastSync" DESC) 
WHERE "lastSync" > NOW() - INTERVAL '7 days';

-- ============================================
-- Materialized Views for Complex Queries
-- ============================================

-- Top creators by category
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_top_creators_by_category AS
SELECT 
  category,
  cp.id,
  cp.name,
  cp."totalReach",
  cp."compositeEngagementScore",
  cp."audienceQualityScore",
  ROW_NUMBER() OVER (PARTITION BY category ORDER BY cp."compositeEngagementScore" DESC) as rank
FROM "CreatorProfile" cp
WHERE cp."compositeEngagementScore" IS NOT NULL
  AND cp.category IS NOT NULL;

CREATE UNIQUE INDEX ON mv_top_creators_by_category(category, rank);
CREATE INDEX ON mv_top_creators_by_category(id);

-- Multi-platform creators
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_multi_platform_creators AS
SELECT 
  cp.id,
  cp.name,
  cp."totalReach",
  COUNT(DISTINCT platform) as platform_count,
  ARRAY_AGG(DISTINCT platform ORDER BY platform) as platforms
FROM "CreatorProfile" cp
LEFT JOIN (
  SELECT "creatorProfileId", 'youtube' as platform FROM "YoutubeMetrics"
  UNION ALL
  SELECT "creatorProfileId", 'twitter' as platform FROM "TwitterMetrics"
  UNION ALL
  SELECT "creatorProfileId", 'instagram' as platform FROM "InstagramMetrics"
  UNION ALL
  SELECT "creatorProfileId", 'tiktok' as platform FROM "TiktokMetrics"
  UNION ALL
  SELECT "creatorProfileId", 'linkedin' as platform FROM "LinkedinMetrics"
) pm ON pm."creatorProfileId" = cp.id
GROUP BY cp.id, cp.name, cp."totalReach"
HAVING COUNT(DISTINCT platform) >= 2;

CREATE UNIQUE INDEX ON mv_multi_platform_creators(id);
CREATE INDEX ON mv_multi_platform_creators(platform_count DESC);

-- ============================================
-- Function-based Indexes
-- ============================================

-- Index for case-insensitive username searches
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_youtube_lower_channel_name 
ON "YoutubeMetrics"(LOWER("channelName"));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_twitter_lower_username 
ON "TwitterMetrics"(LOWER(username));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_instagram_lower_username 
ON "InstagramMetrics"(LOWER(username));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tiktok_lower_username 
ON "TiktokMetrics"(LOWER(username));

-- ============================================
-- Query Performance Functions
-- ============================================

-- Function to analyze index usage
CREATE OR REPLACE FUNCTION analyze_index_usage()
RETURNS TABLE(
  schemaname text,
  tablename text,
  indexname text,
  index_size text,
  index_scans bigint,
  avg_tuples_per_scan numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.schemaname::text,
    s.tablename::text,
    s.indexname::text,
    pg_size_pretty(pg_relation_size(s.indexrelid))::text as index_size,
    s.idx_scan as index_scans,
    CASE 
      WHEN s.idx_scan > 0 THEN ROUND((s.idx_tup_read::numeric / s.idx_scan), 2)
      ELSE 0
    END as avg_tuples_per_scan
  FROM pg_stat_user_indexes s
  WHERE s.idx_scan > 0
  ORDER BY s.idx_scan DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to suggest missing indexes
CREATE OR REPLACE FUNCTION suggest_missing_indexes()
RETURNS TABLE(
  table_name text,
  column_name text,
  query_count bigint,
  suggestion text
) AS $$
BEGIN
  RETURN QUERY
  WITH table_stats AS (
    SELECT 
      schemaname,
      tablename,
      seq_scan,
      seq_tup_read,
      idx_scan,
      idx_tup_fetch
    FROM pg_stat_user_tables
    WHERE seq_scan > idx_scan * 2
      AND seq_tup_read > 100000
  )
  SELECT 
    ts.tablename::text,
    'N/A'::text as column_name,
    ts.seq_scan as query_count,
    'Table has high sequential scan rate. Consider adding indexes.'::text as suggestion
  FROM table_stats ts
  ORDER BY ts.seq_scan DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Maintenance Commands
-- ============================================

-- Analyze tables to update statistics
ANALYZE "CreatorProfile";
ANALYZE "YoutubeMetrics";
ANALYZE "TwitterMetrics";
ANALYZE "InstagramMetrics";
ANALYZE "TiktokMetrics";
ANALYZE "LinkedinMetrics";
ANALYZE "CreatorMetricsHistory";
ANALYZE "EngagementAnalytics";

-- Create extension for advanced indexing if not exists
CREATE EXTENSION IF NOT EXISTS pg_trgm; -- For trigram similarity searches
CREATE EXTENSION IF NOT EXISTS btree_gin; -- For multi-column GIN indexes

-- Add trigram indexes for fuzzy search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_creator_profile_name_trgm 
ON "CreatorProfile" USING gin(name gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_youtube_channel_name_trgm 
ON "YoutubeMetrics" USING gin("channelName" gin_trgm_ops);

-- ============================================
-- Comments for Documentation
-- ============================================

COMMENT ON INDEX idx_creator_profile_category_engagement IS 'Optimizes category-based creator discovery queries';
COMMENT ON INDEX idx_creator_profile_reach_engagement IS 'Optimizes sorting by reach and engagement';
COMMENT ON INDEX idx_creator_profile_platforms IS 'Enables fast JSON queries on platform identifiers';
COMMENT ON INDEX idx_metrics_history_creator_platform IS 'Optimizes time-series queries for specific creators and platforms';
COMMENT ON MATERIALIZED VIEW mv_top_creators_by_category IS 'Pre-computed top creators per category, refresh daily';
COMMENT ON MATERIALIZED VIEW mv_multi_platform_creators IS 'Pre-computed list of creators active on multiple platforms';