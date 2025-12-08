/**
 * R2 Quota Tracking and Enforcement
 *
 * CRITICAL: R2 requires billing account and charges for overages.
 * This utility enforces conservative limits (80% of free tier) to prevent billing.
 *
 * Free Tier Limits:
 * - Storage: 10 GB/month
 * - Class A Ops (write, list): 1M/month
 * - Class B Ops (read): 10M/month
 *
 * Our Safety Limits (80%):
 * - Storage: 8 GB
 * - Class A Ops: 800K/month
 * - Class B Ops: 8M/month
 */

import { Env } from '../types';

// Safety limits - 80% of free tier to prevent billing
const LIMITS = {
  STORAGE_GB: 8, // 80% of 10GB free tier
  CLASS_A_OPS: 800_000, // 80% of 1M free tier
  CLASS_B_OPS: 8_000_000, // 80% of 10M free tier
  WARNING_THRESHOLD: 0.7, // Warn at 70%
  CRITICAL_THRESHOLD: 0.8, // Stop at 80%
};

export interface R2Usage {
  month: string; // Format: '2025-12'
  storageGB: number;
  classAOps: number;
  classBOps: number;
  threatsArchived: number;
  lastUpdated: string; // ISO timestamp
  status: 'healthy' | 'warning' | 'critical';
}

/**
 * Get current month key for quota tracking
 */
function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Get KV key for current month's usage
 */
function getUsageKey(): string {
  return `r2:usage:${getCurrentMonth()}`;
}

/**
 * Get current R2 usage from KV
 * Resets automatically on new month
 */
export async function getR2Usage(env: Env): Promise<R2Usage> {
  const key = getUsageKey();
  const cached = await env.CACHE.get(key, 'json');

  if (cached) {
    return cached as R2Usage;
  }

  // Initialize new month
  const usage: R2Usage = {
    month: getCurrentMonth(),
    storageGB: 0,
    classAOps: 0,
    classBOps: 0,
    threatsArchived: 0,
    lastUpdated: new Date().toISOString(),
    status: 'healthy',
  };

  await env.CACHE.put(key, JSON.stringify(usage), {
    // Expire at end of month + 1 day
    expirationTtl: 60 * 60 * 24 * 32,
  });

  return usage;
}

/**
 * Update R2 usage counters
 */
export async function updateR2Usage(
  env: Env,
  updates: {
    storageGB?: number;
    classAOps?: number;
    classBOps?: number;
    threatsArchived?: number;
  }
): Promise<R2Usage> {
  const usage = await getR2Usage(env);

  // Apply updates
  if (updates.storageGB !== undefined) {
    usage.storageGB = Math.max(0, usage.storageGB + updates.storageGB);
  }
  if (updates.classAOps !== undefined) {
    usage.classAOps += updates.classAOps;
  }
  if (updates.classBOps !== undefined) {
    usage.classBOps += updates.classBOps;
  }
  if (updates.threatsArchived !== undefined) {
    usage.threatsArchived += updates.threatsArchived;
  }

  usage.lastUpdated = new Date().toISOString();

  // Calculate status
  const storagePercent = usage.storageGB / LIMITS.STORAGE_GB;
  const classAPercent = usage.classAOps / LIMITS.CLASS_A_OPS;
  const classBPercent = usage.classBOps / LIMITS.CLASS_B_OPS;
  const maxPercent = Math.max(storagePercent, classAPercent, classBPercent);

  if (maxPercent >= LIMITS.CRITICAL_THRESHOLD) {
    usage.status = 'critical';
  } else if (maxPercent >= LIMITS.WARNING_THRESHOLD) {
    usage.status = 'warning';
  } else {
    usage.status = 'healthy';
  }

  // Save to KV
  await env.CACHE.put(getUsageKey(), JSON.stringify(usage), {
    expirationTtl: 60 * 60 * 24 * 32,
  });

  return usage;
}

/**
 * Check if we can perform R2 operations without exceeding quota
 * Returns true if safe, false if quota would be exceeded
 */
export async function checkR2Quota(
  env: Env,
  operation: {
    type: 'write' | 'read';
    sizeGB?: number; // For write operations
  }
): Promise<{ allowed: boolean; reason?: string; usage: R2Usage }> {
  const usage = await getR2Usage(env);

  // Check storage limit (for writes)
  if (operation.type === 'write' && operation.sizeGB) {
    const newStorage = usage.storageGB + operation.sizeGB;
    if (newStorage >= LIMITS.STORAGE_GB) {
      return {
        allowed: false,
        reason: `Storage quota exceeded: ${usage.storageGB.toFixed(2)}GB / ${LIMITS.STORAGE_GB}GB. Cannot add ${operation.sizeGB.toFixed(3)}GB.`,
        usage,
      };
    }
  }

  // Check Class A operations (writes, lists)
  if (operation.type === 'write') {
    if (usage.classAOps >= LIMITS.CLASS_A_OPS) {
      return {
        allowed: false,
        reason: `Class A operations quota exceeded: ${usage.classAOps} / ${LIMITS.CLASS_A_OPS}`,
        usage,
      };
    }
  }

  // Check Class B operations (reads)
  if (operation.type === 'read') {
    if (usage.classBOps >= LIMITS.CLASS_B_OPS) {
      return {
        allowed: false,
        reason: `Class B operations quota exceeded: ${usage.classBOps} / ${LIMITS.CLASS_B_OPS}`,
        usage,
      };
    }
  }

  // All checks passed
  return {
    allowed: true,
    usage,
  };
}

/**
 * Log quota warning if approaching limits
 */
export function logQuotaWarning(usage: R2Usage): void {
  if (usage.status === 'critical') {
    console.error('[R2 QUOTA CRITICAL]', {
      storageGB: usage.storageGB,
      storageLimit: LIMITS.STORAGE_GB,
      storagePercent: ((usage.storageGB / LIMITS.STORAGE_GB) * 100).toFixed(1) + '%',
      classAOps: usage.classAOps,
      classALimit: LIMITS.CLASS_A_OPS,
      classAPercent: ((usage.classAOps / LIMITS.CLASS_A_OPS) * 100).toFixed(1) + '%',
    });
  } else if (usage.status === 'warning') {
    console.warn('[R2 QUOTA WARNING]', {
      storageGB: usage.storageGB,
      storageLimit: LIMITS.STORAGE_GB,
      classAOps: usage.classAOps,
      classALimit: LIMITS.CLASS_A_OPS,
    });
  }
}

/**
 * Get quota status for dashboard
 */
export function getQuotaStatus(usage: R2Usage) {
  return {
    storage: {
      current: usage.storageGB,
      limit: LIMITS.STORAGE_GB,
      percent: ((usage.storageGB / LIMITS.STORAGE_GB) * 100).toFixed(1),
    },
    classA: {
      current: usage.classAOps,
      limit: LIMITS.CLASS_A_OPS,
      percent: ((usage.classAOps / LIMITS.CLASS_A_OPS) * 100).toFixed(1),
    },
    classB: {
      current: usage.classBOps,
      limit: LIMITS.CLASS_B_OPS,
      percent: ((usage.classBOps / LIMITS.CLASS_B_OPS) * 100).toFixed(1),
    },
    threatsArchived: usage.threatsArchived,
    status: usage.status,
    month: usage.month,
    lastUpdated: usage.lastUpdated,
  };
}
