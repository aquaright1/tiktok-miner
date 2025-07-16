-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Convert CreatorMetricsHistory to hypertable
-- This assumes the table has already been created by Prisma migrate
SELECT create_hypertable(
  '"CreatorMetricsHistory"',
  'timestamp',
  if_not_exists => TRUE,
  chunk_time_interval => INTERVAL '7 days'
);

-- Convert EngagementAnalytics to hypertable
SELECT create_hypertable(
  '"EngagementAnalytics"',
  'timestamp',
  if_not_exists => TRUE,
  chunk_time_interval => INTERVAL '1 day'
);

-- Create indexes for time-based queries
CREATE INDEX IF NOT EXISTS idx_creator_metrics_history_time_desc 
ON "CreatorMetricsHistory"(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_engagement_analytics_time_desc 
ON "EngagementAnalytics"(timestamp DESC);

-- Set up compression policy for CreatorMetricsHistory (compress data older than 30 days)
ALTER TABLE "CreatorMetricsHistory" SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'creatorProfileId,platform',
  timescaledb.compress_orderby = 'timestamp DESC'
);

SELECT add_compression_policy('"CreatorMetricsHistory"', INTERVAL '30 days');

-- Set up compression policy for EngagementAnalytics (compress data older than 7 days)
ALTER TABLE "EngagementAnalytics" SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'creatorProfileId',
  timescaledb.compress_orderby = 'timestamp DESC'
);

SELECT add_compression_policy('"EngagementAnalytics"', INTERVAL '7 days');

-- Create continuous aggregates for common queries

-- Daily creator metrics summary
CREATE MATERIALIZED VIEW IF NOT EXISTS creator_metrics_daily
WITH (timescaledb.continuous) AS
SELECT
  creatorProfileId,
  platform,
  time_bucket('1 day', timestamp) AS day,
  AVG(followerCount) AS avg_followers,
  AVG(engagementRate) AS avg_engagement_rate,
  MAX(followerCount) AS max_followers,
  MIN(followerCount) AS min_followers,
  SUM(followerGrowth) AS total_follower_growth,
  COUNT(*) AS data_points
FROM "CreatorMetricsHistory"
GROUP BY creatorProfileId, platform, day
WITH NO DATA;

-- Refresh the continuous aggregate with data from the last 90 days
SELECT add_continuous_aggregate_policy('creator_metrics_daily',
  start_offset => INTERVAL '90 days',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour');

-- Hourly engagement patterns
CREATE MATERIALIZED VIEW IF NOT EXISTS engagement_patterns_hourly
WITH (timescaledb.continuous) AS
SELECT
  creatorProfileId,
  time_bucket('1 hour', timestamp) AS hour,
  SUM(hourlyLikes) AS total_likes,
  SUM(hourlyComments) AS total_comments,
  SUM(hourlyShares) AS total_shares,
  SUM(hourlyViews) AS total_views,
  AVG(avgContentScore) AS avg_content_score,
  COUNT(*) AS data_points
FROM "EngagementAnalytics"
GROUP BY creatorProfileId, hour
WITH NO DATA;

-- Refresh the continuous aggregate
SELECT add_continuous_aggregate_policy('engagement_patterns_hourly',
  start_offset => INTERVAL '30 days',
  end_offset => INTERVAL '10 minutes',
  schedule_interval => INTERVAL '30 minutes');

-- Set up data retention policies

-- Keep raw metrics data for 1 year, then drop
SELECT add_retention_policy('"CreatorMetricsHistory"', INTERVAL '1 year');

-- Keep engagement analytics for 6 months
SELECT add_retention_policy('"EngagementAnalytics"', INTERVAL '6 months');

-- Create helper functions for analytics

-- Function to calculate growth rate over a period
CREATE OR REPLACE FUNCTION calculate_growth_rate(
  p_creator_id TEXT,
  p_platform TEXT,
  p_metric TEXT,
  p_period INTERVAL
) RETURNS NUMERIC AS $$
DECLARE
  current_value NUMERIC;
  previous_value NUMERIC;
  growth_rate NUMERIC;
BEGIN
  -- Get current value
  EXECUTE format('
    SELECT %I FROM "CreatorMetricsHistory"
    WHERE "creatorProfileId" = $1 AND platform = $2
    ORDER BY timestamp DESC LIMIT 1
  ', p_metric) INTO current_value USING p_creator_id, p_platform;
  
  -- Get previous value
  EXECUTE format('
    SELECT %I FROM "CreatorMetricsHistory"
    WHERE "creatorProfileId" = $1 AND platform = $2
      AND timestamp <= NOW() - $3
    ORDER BY timestamp DESC LIMIT 1
  ', p_metric) INTO previous_value USING p_creator_id, p_platform, p_period;
  
  IF previous_value IS NULL OR previous_value = 0 THEN
    RETURN NULL;
  END IF;
  
  growth_rate := ((current_value - previous_value) / previous_value) * 100;
  RETURN ROUND(growth_rate, 2);
END;
$$ LANGUAGE plpgsql;

-- Function to identify trending creators
CREATE OR REPLACE FUNCTION get_trending_creators(
  p_platform TEXT DEFAULT NULL,
  p_days INTEGER DEFAULT 7,
  p_limit INTEGER DEFAULT 10
) RETURNS TABLE (
  creator_id TEXT,
  platform TEXT,
  follower_growth_rate NUMERIC,
  engagement_growth_rate NUMERIC,
  current_followers INTEGER,
  current_engagement_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH recent_metrics AS (
    SELECT DISTINCT ON (cmh."creatorProfileId", cmh.platform)
      cmh."creatorProfileId",
      cmh.platform,
      cmh."followerCount",
      cmh."engagementRate",
      cmh.timestamp
    FROM "CreatorMetricsHistory" cmh
    WHERE cmh.timestamp > NOW() - INTERVAL '1 day'
      AND (p_platform IS NULL OR cmh.platform = p_platform)
    ORDER BY cmh."creatorProfileId", cmh.platform, cmh.timestamp DESC
  ),
  growth_metrics AS (
    SELECT 
      rm."creatorProfileId",
      rm.platform,
      rm."followerCount" as current_followers,
      rm."engagementRate" as current_engagement,
      calculate_growth_rate(
        rm."creatorProfileId", 
        rm.platform, 
        'followerCount', 
        make_interval(days => p_days)
      ) as follower_growth,
      calculate_growth_rate(
        rm."creatorProfileId", 
        rm.platform, 
        'engagementRate', 
        make_interval(days => p_days)
      ) as engagement_growth
    FROM recent_metrics rm
  )
  SELECT 
    gm."creatorProfileId",
    gm.platform,
    COALESCE(gm.follower_growth, 0),
    COALESCE(gm.engagement_growth, 0),
    gm.current_followers,
    gm.current_engagement
  FROM growth_metrics gm
  WHERE gm.follower_growth IS NOT NULL 
    OR gm.engagement_growth IS NOT NULL
  ORDER BY 
    COALESCE(gm.follower_growth, 0) + COALESCE(gm.engagement_growth, 0) DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;