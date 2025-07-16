-- Enable PostgreSQL full-text search extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Create a function to generate searchable text
CREATE OR REPLACE FUNCTION generate_creator_search_text(
  p_name TEXT,
  p_bio TEXT,
  p_category TEXT,
  p_tags TEXT[]
) RETURNS TEXT AS $$
BEGIN
  RETURN COALESCE(p_name, '') || ' ' || 
         COALESCE(p_bio, '') || ' ' || 
         COALESCE(p_category, '') || ' ' || 
         COALESCE(array_to_string(p_tags, ' '), '');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add a generated column for full-text search
ALTER TABLE "CreatorProfile" 
ADD COLUMN IF NOT EXISTS search_text tsvector 
GENERATED ALWAYS AS (
  to_tsvector('english', 
    generate_creator_search_text(
      name, 
      bio, 
      category, 
      tags
    )
  )
) STORED;

-- Create GIN index for full-text search
CREATE INDEX IF NOT EXISTS idx_creator_profile_search_text 
ON "CreatorProfile" USING gin(search_text);

-- Create trigram indexes for fuzzy search
CREATE INDEX IF NOT EXISTS idx_creator_profile_name_trgm 
ON "CreatorProfile" USING gin(name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_creator_profile_bio_trgm 
ON "CreatorProfile" USING gin(bio gin_trgm_ops);

-- Create indexes for platform-specific searches
CREATE INDEX IF NOT EXISTS idx_youtube_metrics_channel_search 
ON "YoutubeMetrics" USING gin(to_tsvector('english', "channelName" || ' ' || COALESCE(description, '')));

CREATE INDEX IF NOT EXISTS idx_twitter_metrics_search 
ON "TwitterMetrics" USING gin(to_tsvector('english', username || ' ' || "displayName" || ' ' || COALESCE(bio, '')));

CREATE INDEX IF NOT EXISTS idx_instagram_metrics_search 
ON "InstagramMetrics" USING gin(to_tsvector('english', username || ' ' || COALESCE("fullName", '') || ' ' || COALESCE(bio, '')));

CREATE INDEX IF NOT EXISTS idx_tiktok_metrics_search 
ON "TiktokMetrics" USING gin(to_tsvector('english', username || ' ' || COALESCE(nickname, '') || ' ' || COALESCE(bio, '')));

CREATE INDEX IF NOT EXISTS idx_linkedin_metrics_search 
ON "LinkedinMetrics" USING gin(to_tsvector('english', "publicId" || ' ' || "fullName" || ' ' || COALESCE(headline, '') || ' ' || COALESCE(summary, '')));

-- Create a function for ranked full-text search
CREATE OR REPLACE FUNCTION search_creators(
  search_query TEXT,
  result_limit INT DEFAULT 50
) RETURNS TABLE (
  id TEXT,
  name TEXT,
  bio TEXT,
  category TEXT,
  tags TEXT[],
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cp.id,
    cp.name,
    cp.bio,
    cp.category,
    cp.tags,
    ts_rank(cp.search_text, plainto_tsquery('english', search_query)) AS rank
  FROM "CreatorProfile" cp
  WHERE cp.search_text @@ plainto_tsquery('english', search_query)
  ORDER BY rank DESC
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;

-- Create a function for fuzzy search with similarity
CREATE OR REPLACE FUNCTION fuzzy_search_creators(
  search_query TEXT,
  similarity_threshold REAL DEFAULT 0.3,
  result_limit INT DEFAULT 50
) RETURNS TABLE (
  id TEXT,
  name TEXT,
  bio TEXT,
  category TEXT,
  tags TEXT[],
  similarity REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cp.id,
    cp.name,
    cp.bio,
    cp.category,
    cp.tags,
    GREATEST(
      similarity(cp.name, search_query),
      similarity(COALESCE(cp.bio, ''), search_query)
    ) AS similarity
  FROM "CreatorProfile" cp
  WHERE 
    similarity(cp.name, search_query) > similarity_threshold OR
    similarity(COALESCE(cp.bio, ''), search_query) > similarity_threshold
  ORDER BY similarity DESC
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;

-- Create a materialized view for popular search terms
CREATE MATERIALIZED VIEW IF NOT EXISTS popular_search_terms AS
WITH tag_counts AS (
  SELECT 
    unnest(tags) as term,
    'tag' as term_type,
    COUNT(*) as usage_count
  FROM "CreatorProfile"
  GROUP BY unnest(tags)
),
category_counts AS (
  SELECT 
    category as term,
    'category' as term_type,
    COUNT(*) as usage_count
  FROM "CreatorProfile"
  WHERE category IS NOT NULL
  GROUP BY category
)
SELECT * FROM tag_counts
UNION ALL
SELECT * FROM category_counts
ORDER BY usage_count DESC;

-- Create index on the materialized view
CREATE INDEX IF NOT EXISTS idx_popular_search_terms 
ON popular_search_terms(term, term_type);

-- Create a function to refresh search-related materialized views
CREATE OR REPLACE FUNCTION refresh_search_indexes() RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY popular_search_terms;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON FUNCTION search_creators IS 'Performs ranked full-text search on creator profiles';
COMMENT ON FUNCTION fuzzy_search_creators IS 'Performs fuzzy search with similarity matching on creator profiles';
COMMENT ON FUNCTION refresh_search_indexes IS 'Refreshes all search-related materialized views';