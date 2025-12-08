# Database Migrations

This directory contains SQL migrations for the VectorRelay threat intelligence database.

## Applying Migrations

### Production Database

```bash
# Apply migration to production database
wrangler d1 execute threat-intel-db --file=migrations/001_database_optimizations.sql
```

### Local Development Database

```bash
# Apply migration to local development database
wrangler d1 execute threat-intel-db --local --file=migrations/001_database_optimizations.sql
```

## Migration 001: Database Optimizations

**Created:** 2025-12-07
**Purpose:** Add composite indexes and UNIQUE constraints for better performance

### Changes

1. **Composite Indexes:**
   - `idx_summaries_category_severity_date` - Optimizes filtered queries (category + severity + date)
   - `idx_iocs_type_value` - Optimizes IOC lookups by type and value
   - `idx_summaries_category_generated` - Optimizes related threats queries

2. **UNIQUE Constraint:**
   - Adds `UNIQUE(threat_id, ioc_type, ioc_value)` to `iocs` table
   - Prevents duplicate IOC storage
   - Deduplicates existing data during migration

### Expected Performance Improvements

- Dashboard filtered queries: **3-5x faster**
- IOC lookups: **2-3x faster**
- Related threats: **2x faster**
- Storage: **~5-10% reduction** (eliminates duplicates)

### Verification

After applying migration, verify it worked:

```bash
# Check composite index exists
wrangler d1 execute threat-intel-db --command="SELECT name FROM sqlite_master WHERE type='index' AND name='idx_summaries_category_severity_date';"

# Verify UNIQUE constraint
wrangler d1 execute threat-intel-db --command="SELECT sql FROM sqlite_master WHERE type='table' AND name='iocs';"

# Count total IOCs
wrangler d1 execute threat-intel-db --command="SELECT COUNT(*) as total_iocs FROM iocs;"
```

### Rollback

If you need to rollback this migration:

```bash
# Drop the new indexes
wrangler d1 execute threat-intel-db --command="DROP INDEX IF EXISTS idx_summaries_category_severity_date;"
wrangler d1 execute threat-intel-db --command="DROP INDEX IF EXISTS idx_iocs_type_value;"
wrangler d1 execute threat-intel-db --command="DROP INDEX IF EXISTS idx_summaries_category_generated;"

# Recreate iocs table without UNIQUE constraint (revert to original schema)
# Note: This is complex and should only be done if absolutely necessary
```

## Future Migrations

When adding new migrations:
1. Create a new file: `00X_migration_name.sql`
2. Document changes in this README
3. Test locally first with `--local` flag
4. Apply to production after validation
5. Update version number in sequence
