-- WARNING: This will delete ALL records from the Creator table
-- Make sure you have a backup before running this script

-- Delete all records from the Creator table
DELETE FROM "Creator";

-- Optional: Reset the auto-increment ID (if using serial/identity columns)
-- This is PostgreSQL syntax
-- ALTER SEQUENCE "Creator_id_seq" RESTART WITH 1;

-- Verify the table is empty
SELECT COUNT(*) as remaining_records FROM "Creator";