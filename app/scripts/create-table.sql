-- Create instagram_profiles table as per instructions
CREATE TABLE IF NOT EXISTS instagram_profiles (
    username        VARCHAR PRIMARY KEY,
    posts_30d       INTEGER NOT NULL,
    likes_total     INTEGER NOT NULL,
    comments_total  INTEGER NOT NULL,
    views_total     INTEGER NOT NULL,
    shares_total    INTEGER NOT NULL
);

-- Show table info
\d instagram_profiles;