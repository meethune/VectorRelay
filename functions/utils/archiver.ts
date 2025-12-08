/**
 * Threat Archiver
 *
 * Archives old threats from D1 to R2 to save database storage.
 * Runs monthly via cron job, enforces quota limits.
 */

import { Env } from '../types';
import { archiveThreat } from './r2-storage';
import { getR2Usage, logQuotaWarning } from './r2-quota';

// Archive threats older than this many days
const ARCHIVE_AGE_DAYS = 90;

// Maximum threats to archive per run (safety limit)
const MAX_ARCHIVE_PER_RUN = 100;

/**
 * Archive old threats from D1 to R2
 * Returns statistics about the archival process
 */
export async function archiveOldThreats(env: Env): Promise<{
  checked: number;
  archived: number;
  failed: number;
  skipped: number;
  quotaExceeded: boolean;
  errors: string[];
}> {
  const stats = {
    checked: 0,
    archived: 0,
    failed: 0,
    skipped: 0,
    quotaExceeded: false,
    errors: [] as string[],
  };

  // Check if R2 archiving is enabled
  const archiveEnabled = env.R2_ARCHIVE_ENABLED !== 'false';
  if (!archiveEnabled) {
    console.log('[Archiver] R2 archiving is disabled, skipping');
    stats.errors.push('R2 archiving disabled via R2_ARCHIVE_ENABLED env var');
    return stats;
  }

  // Check current R2 quota status
  const usage = await getR2Usage(env);
  logQuotaWarning(usage);

  if (usage.status === 'critical') {
    console.error('[Archiver] R2 quota critical, skipping archival');
    stats.quotaExceeded = true;
    stats.errors.push('R2 quota at critical level (>80% of free tier)');
    return stats;
  }

  // Calculate cutoff date (90 days ago)
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - ARCHIVE_AGE_DAYS);
  const cutoffTimestamp = Math.floor(cutoffDate.getTime() / 1000);

  console.log(
    `[Archiver] Starting archival of threats older than ${cutoffDate.toISOString()}`
  );

  try {
    // Find old threats that haven't been archived yet
    const result = await env.DB.prepare(
      `
      SELECT
        t.id,
        t.feed_source,
        t.title,
        t.url,
        t.content,
        t.published_at,
        s.tldr,
        s.category,
        s.severity,
        s.threat_actors,
        s.affected_sectors
      FROM threats t
      LEFT JOIN summaries s ON t.id = s.threat_id
      WHERE t.published_at < ?
        AND (t.archived IS NULL OR t.archived = 0)
      ORDER BY t.published_at ASC
      LIMIT ?
    `
    )
      .bind(cutoffTimestamp, MAX_ARCHIVE_PER_RUN)
      .all();

    if (!result.success || !result.results) {
      stats.errors.push('Failed to query old threats from D1');
      return stats;
    }

    const threats = result.results;
    stats.checked = threats.length;

    if (threats.length === 0) {
      console.log('[Archiver] No threats to archive');
      return stats;
    }

    console.log(`[Archiver] Found ${threats.length} threats to archive`);

    // Archive each threat
    for (const threat of threats) {
      const threatData: any = {
        id: threat.id,
        feed_source: threat.feed_source || 'unknown',
        title: threat.title,
        url: threat.url,
        content: threat.content,
        published_at: new Date(Number(threat.published_at) * 1000).toISOString(),
      };

      // Add AI analysis if available
      if (threat.tldr) {
        threatData.ai_analysis = {
          summary: threat.tldr,
          category: threat.category,
          severity: threat.severity,
          threat_actors: threat.threat_actors ? JSON.parse(String(threat.threat_actors)) : [],
          affected_sectors: threat.affected_sectors
            ? JSON.parse(String(threat.affected_sectors))
            : [],
        };
      }

      // Get IOCs for this threat
      const iocsResult = await env.DB.prepare(
        `SELECT ioc_type, ioc_value, context FROM iocs WHERE threat_id = ?`
      )
        .bind(threat.id)
        .all();

      if (iocsResult.success && iocsResult.results) {
        threatData.iocs = iocsResult.results;
      }

      // Archive to R2
      const archiveResult = await archiveThreat(env, threatData);

      if (archiveResult.success && archiveResult.r2Key) {
        // Update D1 record
        const updateResult = await env.DB.prepare(
          `
          UPDATE threats
          SET archived = 1,
              r2_key = ?,
              content = NULL
          WHERE id = ?
        `
        )
          .bind(archiveResult.r2Key, threat.id)
          .run();

        if (updateResult.success) {
          stats.archived++;
          console.log(`[Archiver] ✓ Archived threat ${threat.id} to ${archiveResult.r2Key}`);
        } else {
          stats.failed++;
          stats.errors.push(`Failed to update D1 for threat ${threat.id}`);
        }
      } else {
        // Archive failed (likely quota exceeded)
        if (archiveResult.error?.includes('quota exceeded')) {
          stats.quotaExceeded = true;
          console.error('[Archiver] Quota exceeded, stopping archival');
          break; // Stop processing
        }

        stats.skipped++;
        stats.errors.push(
          `Failed to archive ${threat.id}: ${archiveResult.error || 'unknown error'}`
        );
      }
    }

    // Final quota check
    const finalUsage = await getR2Usage(env);
    logQuotaWarning(finalUsage);

    console.log('[Archiver] Archival complete:', {
      checked: stats.checked,
      archived: stats.archived,
      failed: stats.failed,
      skipped: stats.skipped,
      quotaStatus: finalUsage.status,
    });

    return stats;
  } catch (error) {
    console.error('[Archiver] Fatal error:', error);
    stats.errors.push(error instanceof Error ? error.message : 'Unknown error');
    return stats;
  }
}

/**
 * Restore a threat from R2 back to D1
 * Useful if you need to "unarchive" a threat
 */
export async function restoreThreat(env: Env, threatId: string): Promise<boolean> {
  try {
    // Get threat metadata from D1
    const result = await env.DB.prepare(
      'SELECT r2_key FROM threats WHERE id = ? AND archived = 1'
    )
      .bind(threatId)
      .first();

    if (!result || !result.r2_key) {
      console.error(`[Archiver] Threat ${threatId} not found or not archived`);
      return false;
    }

    const r2Key = String(result.r2_key);

    // Retrieve from R2
    const { retrieveArchivedThreat } = await import('./r2-storage');
    const archivedData = await retrieveArchivedThreat(env, r2Key);

    if (!archivedData) {
      console.error(`[Archiver] Failed to retrieve threat ${threatId} from R2`);
      return false;
    }

    // Restore content to D1
    const updateResult = await env.DB.prepare(
      `
      UPDATE threats
      SET archived = 0,
          r2_key = NULL,
          content = ?
      WHERE id = ?
    `
    )
      .bind(archivedData.content, threatId)
      .run();

    if (!updateResult.success) {
      console.error(`[Archiver] Failed to restore threat ${threatId} to D1`);
      return false;
    }

    console.log(`[Archiver] ✓ Restored threat ${threatId} from R2 to D1`);
    return true;
  } catch (error) {
    console.error('[Archiver] Error restoring threat:', error);
    return false;
  }
}
