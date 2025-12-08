-- Migration: Fix three egregiously misclassified threats
-- Date: 2025-12-08
-- Purpose: Delete summaries/IOCs for specific misclassified threats to trigger re-analysis

-- These threats are clearly misclassified as "other":
-- 1. j0b2o7mvcj: "Chinese Hackers Exploiting React2Shell Vulnerability" → should be vulnerability/zero_day
-- 2. beorilp0ie: "WordPress RCE Exploited in the Wild" → should be web_security
-- 3. 1ltbnh4723l: "Silver Fox Spreads ValleyRAT Malware" → should be malware

-- Delete IOCs for these threats (will be re-extracted)
DELETE FROM iocs
WHERE threat_id IN ('j0b2o7mvcj', 'beorilp0ie', '1ltbnh4723l');

-- Delete summaries for these threats (will trigger re-analysis)
DELETE FROM summaries
WHERE threat_id IN ('j0b2o7mvcj', 'beorilp0ie', '1ltbnh4723l');

-- Verify deletion
SELECT
  'Summaries deleted:' as status,
  3 - COUNT(*) as count
FROM summaries
WHERE threat_id IN ('j0b2o7mvcj', 'beorilp0ie', '1ltbnh4723l');
