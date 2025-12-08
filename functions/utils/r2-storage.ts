/**
 * R2 Storage Utility
 *
 * Safe wrapper for R2 operations with quota enforcement and error handling.
 * All operations check quota limits before executing to prevent billing overages.
 */

import { Env, ThreatIntelligence, AIAnalysisResult, IOC } from '../types';
import {
  checkR2Quota,
  updateR2Usage,
  logQuotaWarning,
  getR2Usage,
} from './r2-quota';

// Maximum size per archived threat (200 KB)
const MAX_ARCHIVE_SIZE_BYTES = 200 * 1024;

/**
 * Archived threat data structure
 */
export interface ArchivedThreat {
  id: string;
  title: string;
  content: string;
  url: string;
  published_at: string;
  feed_source: string;
  raw_feed_data?: unknown;
  ai_analysis?: AIAnalysisResult;
  iocs?: IOC[];
  archived_at: string;
  metadata: {
    feed_source: string;
    original_url: string;
    size_bytes: number;
    category?: string;
    severity?: string;
  };
}

/**
 * Generate R2 key for threat archive
 * Format: threats/{year}/{month}/{threat_id}.json
 */
export function generateR2Key(threatId: string, publishedAt: string): string {
  const date = new Date(publishedAt);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');

  return `threats/${year}/${month}/${threatId}.json`;
}

/**
 * Archive a threat to R2 storage
 * Returns the R2 key if successful, null if quota exceeded
 */
export async function archiveThreat(
  env: Env,
  threat: ThreatIntelligence & {
    ai_analysis?: AIAnalysisResult;
    iocs?: IOC[];
  }
): Promise<{ success: boolean; r2Key?: string; error?: string }> {
  // Check if R2 archiving is enabled
  const archiveEnabled = env.R2_ARCHIVE_ENABLED !== 'false';
  if (!archiveEnabled) {
    return {
      success: false,
      error: 'R2 archiving is disabled',
    };
  }

  // Prepare archive data
  const archiveData: ArchivedThreat = {
    id: threat.id,
    title: threat.title,
    content: threat.content || '',
    url: threat.url,
    published_at: threat.published_at,
    feed_source: threat.feed_source,
    ai_analysis: threat.ai_analysis,
    iocs: threat.iocs,
    archived_at: new Date().toISOString(),
    metadata: {
      feed_source: threat.feed_source,
      original_url: threat.url,
      size_bytes: 0,
      category: threat.ai_analysis?.category,
      severity: threat.ai_analysis?.severity,
    },
  };

  // Serialize to JSON
  const jsonData = JSON.stringify(archiveData, null, 2);
  const sizeBytes = new TextEncoder().encode(jsonData).length;
  archiveData.metadata.size_bytes = sizeBytes;

  // Check size limit
  if (sizeBytes > MAX_ARCHIVE_SIZE_BYTES) {
    console.warn(`[R2] Threat ${threat.id} too large to archive: ${sizeBytes} bytes`);
    return {
      success: false,
      error: `Threat exceeds max archive size (${MAX_ARCHIVE_SIZE_BYTES} bytes): ${sizeBytes} bytes`,
    };
  }

  // Convert bytes to GB
  const sizeGB = sizeBytes / (1024 * 1024 * 1024);

  // Check quota before writing
  const quotaCheck = await checkR2Quota(env, {
    type: 'write',
    sizeGB,
  });

  if (!quotaCheck.allowed) {
    console.error('[R2] Quota exceeded, cannot archive threat:', quotaCheck.reason);
    logQuotaWarning(quotaCheck.usage);
    return {
      success: false,
      error: quotaCheck.reason,
    };
  }

  // Generate R2 key
  const r2Key = generateR2Key(threat.id, threat.published_at);

  try {
    // Write to R2
    await env.THREAT_ARCHIVE.put(r2Key, jsonData, {
      httpMetadata: {
        contentType: 'application/json',
      },
      customMetadata: {
        threatId: threat.id,
        category: threat.ai_analysis?.category || 'unknown',
        severity: threat.ai_analysis?.severity || 'unknown',
        archivedAt: archiveData.archived_at,
      },
    });

    // Update quota counters
    await updateR2Usage(env, {
      storageGB: sizeGB,
      classAOps: 1, // PUT is Class A
      threatsArchived: 1,
    });

    console.log(`[R2] Archived threat ${threat.id} to ${r2Key} (${sizeBytes} bytes)`);

    return {
      success: true,
      r2Key,
    };
  } catch (error) {
    console.error('[R2] Failed to archive threat:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Retrieve archived threat from R2
 * Returns null if not found or quota exceeded
 */
export async function retrieveArchivedThreat(
  env: Env,
  r2Key: string
): Promise<ArchivedThreat | null> {
  // Check quota before reading
  const quotaCheck = await checkR2Quota(env, { type: 'read' });

  if (!quotaCheck.allowed) {
    console.error('[R2] Quota exceeded, cannot retrieve threat:', quotaCheck.reason);
    logQuotaWarning(quotaCheck.usage);
    return null;
  }

  try {
    // Try to get from R2
    const object = await env.THREAT_ARCHIVE.get(r2Key);

    if (!object) {
      return null;
    }

    // Update quota counter
    await updateR2Usage(env, {
      classBOps: 1, // GET is Class B
    });

    // Parse JSON
    const jsonData = await object.text();
    const threat = JSON.parse(jsonData) as ArchivedThreat;

    return threat;
  } catch (error) {
    console.error('[R2] Failed to retrieve archived threat:', error);
    return null;
  }
}

/**
 * Delete archived threat from R2
 */
export async function deleteArchivedThreat(
  env: Env,
  r2Key: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get object to calculate storage freed
    const object = await env.THREAT_ARCHIVE.get(r2Key);

    if (object) {
      const sizeBytes = (await object.arrayBuffer()).byteLength;
      const sizeGB = sizeBytes / (1024 * 1024 * 1024);

      // Delete from R2
      await env.THREAT_ARCHIVE.delete(r2Key);

      // Update quota (reduce storage, add delete operation)
      await updateR2Usage(env, {
        storageGB: -sizeGB, // Reduce storage
        classAOps: 1, // DELETE is Class A
        threatsArchived: -1,
      });

      console.log(`[R2] Deleted archived threat ${r2Key} (freed ${sizeBytes} bytes)`);
    } else {
      // Object not found, just try to delete anyway
      await env.THREAT_ARCHIVE.delete(r2Key);
    }

    return { success: true };
  } catch (error) {
    console.error('[R2] Failed to delete archived threat:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * List archived threats for a specific time period
 * Use sparingly - LIST operations count toward Class A quota
 */
export async function listArchivedThreats(
  env: Env,
  options?: {
    prefix?: string; // e.g., 'threats/2025/01/'
    limit?: number;
  }
): Promise<{ keys: string[]; truncated: boolean } | null> {
  // Check quota before listing
  const quotaCheck = await checkR2Quota(env, { type: 'write' }); // LIST is Class A

  if (!quotaCheck.allowed) {
    console.error('[R2] Quota exceeded, cannot list threats:', quotaCheck.reason);
    logQuotaWarning(quotaCheck.usage);
    return null;
  }

  try {
    const listed = await env.THREAT_ARCHIVE.list({
      prefix: options?.prefix,
      limit: options?.limit || 1000,
    });

    // Update quota counter
    await updateR2Usage(env, {
      classAOps: 1, // LIST is Class A
    });

    return {
      keys: listed.objects.map((obj) => obj.key),
      truncated: listed.truncated,
    };
  } catch (error) {
    console.error('[R2] Failed to list archived threats:', error);
    return null;
  }
}

/**
 * Get R2 usage statistics for monitoring
 */
export async function getR2Stats(env: Env) {
  const usage = await getR2Usage(env);

  return {
    storage: {
      currentGB: usage.storageGB,
      limitGB: 8, // Our safety limit
      freeTierGB: 10,
      percentUsed: ((usage.storageGB / 8) * 100).toFixed(1),
    },
    operations: {
      classA: {
        current: usage.classAOps,
        limit: 800_000,
        freeTier: 1_000_000,
        percentUsed: ((usage.classAOps / 800_000) * 100).toFixed(1),
      },
      classB: {
        current: usage.classBOps,
        limit: 8_000_000,
        freeTier: 10_000_000,
        percentUsed: ((usage.classBOps / 8_000_000) * 100).toFixed(1),
      },
    },
    threats: {
      archived: usage.threatsArchived,
    },
    status: usage.status,
    month: usage.month,
    lastUpdated: usage.lastUpdated,
  };
}
