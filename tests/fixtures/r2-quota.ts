/**
 * R2 Quota Test Fixtures
 *
 * Mock data for testing R2 quota tracking and enforcement
 */

import type { R2Usage } from '../../functions/utils/r2-quota';

// Current month for testing (December 2025)
export const CURRENT_MONTH = '2025-12';

// Mock R2 usage states

export const MOCK_USAGE_EMPTY: R2Usage = {
  month: CURRENT_MONTH,
  storageGB: 0,
  classAOps: 0,
  classBOps: 0,
  threatsArchived: 0,
  lastUpdated: new Date('2025-12-08T10:00:00Z').toISOString(),
  status: 'healthy',
};

export const MOCK_USAGE_HEALTHY: R2Usage = {
  month: CURRENT_MONTH,
  storageGB: 2.5, // 31% of 8GB limit
  classAOps: 100_000, // 12.5% of 800K limit
  classBOps: 1_000_000, // 12.5% of 8M limit
  threatsArchived: 5000,
  lastUpdated: new Date('2025-12-08T10:00:00Z').toISOString(),
  status: 'healthy',
};

export const MOCK_USAGE_WARNING: R2Usage = {
  month: CURRENT_MONTH,
  storageGB: 6.0, // 75% of 8GB limit (above 70% warning threshold)
  classAOps: 600_000, // 75% of 800K limit
  classBOps: 6_000_000, // 75% of 8M limit
  threatsArchived: 15000,
  lastUpdated: new Date('2025-12-08T10:00:00Z').toISOString(),
  status: 'warning',
};

export const MOCK_USAGE_CRITICAL: R2Usage = {
  month: CURRENT_MONTH,
  storageGB: 7.5, // 93.75% of 8GB limit (above 80% critical threshold)
  classAOps: 750_000, // 93.75% of 800K limit
  classBOps: 7_500_000, // 93.75% of 8M limit
  threatsArchived: 25000,
  lastUpdated: new Date('2025-12-08T10:00:00Z').toISOString(),
  status: 'critical',
};

export const MOCK_USAGE_STORAGE_EXCEEDED: R2Usage = {
  month: CURRENT_MONTH,
  storageGB: 8.1, // Exceeds 8GB limit
  classAOps: 100_000,
  classBOps: 1_000_000,
  threatsArchived: 30000,
  lastUpdated: new Date('2025-12-08T10:00:00Z').toISOString(),
  status: 'critical',
};

export const MOCK_USAGE_CLASS_A_EXCEEDED: R2Usage = {
  month: CURRENT_MONTH,
  storageGB: 2.0,
  classAOps: 850_000, // Exceeds 800K limit
  classBOps: 1_000_000,
  threatsArchived: 5000,
  lastUpdated: new Date('2025-12-08T10:00:00Z').toISOString(),
  status: 'critical',
};

export const MOCK_USAGE_CLASS_B_EXCEEDED: R2Usage = {
  month: CURRENT_MONTH,
  storageGB: 2.0,
  classAOps: 100_000,
  classBOps: 9_000_000, // Exceeds 8M limit
  threatsArchived: 5000,
  lastUpdated: new Date('2025-12-08T10:00:00Z').toISOString(),
  status: 'critical',
};

// Quota limits for reference in tests
export const QUOTA_LIMITS = {
  STORAGE_GB: 8,
  CLASS_A_OPS: 800_000,
  CLASS_B_OPS: 8_000_000,
  WARNING_THRESHOLD: 0.7,
  CRITICAL_THRESHOLD: 0.8,
};
