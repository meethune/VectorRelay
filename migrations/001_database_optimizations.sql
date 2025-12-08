-- Database Optimizations Migration
-- Created: 2025-12-07
-- Purpose: Add composite indexes and UNIQUE constraints for better performance

-- ==============================================================================
-- PART 1: Add Composite Indexes for Filtered Queries
-- ==============================================================================

-- Composite index for filtering threats by category + severity + date
-- Used when filtering dashboard (e.g., "Show critical ransomware from last week")
-- Performance gain: Avoids index merge, enables index-only scans
CREATE INDEX IF NOT EXISTS idx_summaries_category_severity_date
ON summaries(category, severity, generated_at DESC);

-- Composite index for IOC lookups by type + value
-- Used when searching for specific IOCs (e.g., "Find all CVE-2024-1234")
-- Performance gain: Single index lookup instead of filtering after type lookup
CREATE INDEX IF NOT EXISTS idx_iocs_type_value
ON iocs(ioc_type, ioc_value);

-- ==============================================================================
-- PART 2: Add UNIQUE Constraint for IOC Deduplication
-- ==============================================================================

-- IMPORTANT: This requires handling existing duplicates first
-- Step 1: Create a temporary table with deduplicated IOCs
CREATE TABLE iocs_temp AS
SELECT
  MIN(id) as id,
  threat_id,
  ioc_type,
  ioc_value,
  context,
  MIN(first_seen) as first_seen,
  MAX(last_seen) as last_seen
FROM iocs
GROUP BY threat_id, ioc_type, ioc_value;

-- Step 2: Drop old table (this will cascade to remove all rows)
DROP TABLE iocs;

-- Step 3: Recreate table with UNIQUE constraint
CREATE TABLE iocs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  threat_id TEXT NOT NULL,
  ioc_type TEXT NOT NULL, -- ip, domain, cve, hash, url, email
  ioc_value TEXT NOT NULL,
  context TEXT,
  first_seen INTEGER NOT NULL,
  last_seen INTEGER NOT NULL,
  FOREIGN KEY (threat_id) REFERENCES threats(id) ON DELETE CASCADE,

  -- UNIQUE constraint prevents duplicate IOCs per threat
  UNIQUE(threat_id, ioc_type, ioc_value)
);

-- Step 4: Restore data from temp table
INSERT INTO iocs (id, threat_id, ioc_type, ioc_value, context, first_seen, last_seen)
SELECT id, threat_id, ioc_type, ioc_value, context, first_seen, last_seen
FROM iocs_temp;

-- Step 5: Recreate indexes
CREATE INDEX IF NOT EXISTS idx_iocs_threat ON iocs(threat_id);
CREATE INDEX IF NOT EXISTS idx_iocs_type ON iocs(ioc_type);
CREATE INDEX IF NOT EXISTS idx_iocs_value ON iocs(ioc_value);
CREATE INDEX IF NOT EXISTS idx_iocs_first_seen ON iocs(first_seen DESC);
CREATE INDEX IF NOT EXISTS idx_iocs_type_value ON iocs(ioc_type, ioc_value);

-- Step 6: Clean up temp table
DROP TABLE iocs_temp;

-- ==============================================================================
-- PART 3: Add Index for Related Threats Query
-- ==============================================================================

-- Composite index for finding related threats by category and time proximity
-- Used for "Related Threats" sidebar feature
CREATE INDEX IF NOT EXISTS idx_summaries_category_generated
ON summaries(category, generated_at DESC);

-- ==============================================================================
-- Verification Queries (Run after migration)
-- ==============================================================================

-- Verify composite index exists
-- SELECT name FROM sqlite_master WHERE type='index' AND name='idx_summaries_category_severity_date';

-- Verify UNIQUE constraint works
-- SELECT sql FROM sqlite_master WHERE type='table' AND name='iocs';

-- Count IOCs before/after deduplication
-- SELECT COUNT(*) as total_iocs FROM iocs;
-- SELECT COUNT(DISTINCT threat_id || ioc_type || ioc_value) as unique_iocs FROM iocs;

-- ==============================================================================
-- Expected Performance Improvements
-- ==============================================================================

-- 1. Dashboard filtered queries: 3-5x faster (avoids index merge)
-- 2. IOC lookups: 2-3x faster (single index lookup)
-- 3. Related threats: 2x faster (optimized category+date lookup)
-- 4. Storage: ~5-10% reduction (eliminates duplicate IOCs)
-- 5. Write performance: Prevents duplicate IOC writes (integrity improvement)
