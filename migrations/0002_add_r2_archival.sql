-- Migration 0002: Add R2 Archival Support
-- Adds columns to support archiving old threats to R2 storage

-- Add feed_source column (referenced in code but missing from schema)
ALTER TABLE threats ADD COLUMN feed_source TEXT;

-- Add archived flag (0 = active in D1, 1 = archived to R2)
ALTER TABLE threats ADD COLUMN archived INTEGER DEFAULT 0;

-- Add R2 key pointer for archived threats
ALTER TABLE threats ADD COLUMN r2_key TEXT;

-- Create index for querying archived threats
CREATE INDEX IF NOT EXISTS idx_threats_archived ON threats(archived);

-- Create index for R2 key lookups
CREATE INDEX IF NOT EXISTS idx_threats_r2_key ON threats(r2_key);

-- Update existing rows to set feed_source from source column
UPDATE threats SET feed_source = source WHERE feed_source IS NULL;

-- Add comment: After this migration, the application will:
-- 1. Store new threats with full content in D1
-- 2. Monthly cron job archives threats older than 90 days to R2
-- 3. D1 keeps lightweight metadata for archived threats
-- 4. Full content retrieved from R2 on-demand when needed
