import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getR2Usage,
  updateR2Usage,
  checkR2Quota,
  logQuotaWarning,
  getQuotaStatus,
} from '../../../functions/utils/r2-quota';
import type { Env } from '../../../functions/types';
import {
  MOCK_USAGE_EMPTY,
  MOCK_USAGE_HEALTHY,
  MOCK_USAGE_WARNING,
  MOCK_USAGE_CRITICAL,
  MOCK_USAGE_STORAGE_EXCEEDED,
  MOCK_USAGE_CLASS_A_EXCEEDED,
  MOCK_USAGE_CLASS_B_EXCEEDED,
  QUOTA_LIMITS,
} from '../../fixtures/r2-quota';

// Mock environment with stateful KV
function createMockEnv(initialKvData: any = null): Env {
  // Create a stateful KV store that tracks put/get operations
  const kvStore = new Map<string, any>();

  return {
    DB: {} as any,
    AI: {} as any,
    VECTORIZE_INDEX: {} as any,
    CACHE: {
      get: vi.fn().mockImplementation(async (key: string, type?: string) => {
        // Check if we have data for this key
        if (kvStore.has(key)) {
          return JSON.parse(JSON.stringify(kvStore.get(key))); // Deep copy on get
        }
        // Otherwise return initial data (for first call)
        return initialKvData ? JSON.parse(JSON.stringify(initialKvData)) : null;
      }),
      put: vi.fn().mockImplementation(async (key: string, value: string, options?: any) => {
        // Store the value (parse if JSON string)
        try {
          kvStore.set(key, JSON.parse(value));
        } catch {
          kvStore.set(key, value);
        }
      }),
    } as any,
    ANALYTICS: {} as any,
    THREAT_ARCHIVE: {} as any,
    ASSETS: {} as any,
    AI_GATEWAY_ID: 'test-gateway-id',
  };
}

describe('R2 Quota Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getR2Usage()', () => {
    it('should return cached usage when available', async () => {
      const env = createMockEnv(MOCK_USAGE_HEALTHY);

      const result = await getR2Usage(env);

      expect(result).toEqual(MOCK_USAGE_HEALTHY);
      expect(env.CACHE.get).toHaveBeenCalledWith(
        expect.stringMatching(/^r2:usage:/),
        'json'
      );
    });

    it('should initialize new month usage when cache is empty', async () => {
      const env = createMockEnv(null);

      const result = await getR2Usage(env);

      expect(result.month).toMatch(/^\d{4}-\d{2}$/); // Format: YYYY-MM
      expect(result.storageGB).toBe(0);
      expect(result.classAOps).toBe(0);
      expect(result.classBOps).toBe(0);
      expect(result.threatsArchived).toBe(0);
      expect(result.status).toBe('healthy');
      expect(env.CACHE.put).toHaveBeenCalled();
    });

    it('should set correct TTL when initializing', async () => {
      const env = createMockEnv(null);

      await getR2Usage(env);

      const putCall = (env.CACHE.put as any).mock.calls[0];
      expect(putCall[2]).toMatchObject({
        expirationTtl: 60 * 60 * 24 * 32, // 32 days
      });
    });

    it('should include timestamp in initialized usage', async () => {
      const env = createMockEnv(null);

      const result = await getR2Usage(env);

      expect(result.lastUpdated).toBeTruthy();
      expect(new Date(result.lastUpdated).getTime()).toBeGreaterThan(0);
    });
  });

  describe('updateR2Usage()', () => {
    it('should update storage correctly', async () => {
      const env = createMockEnv(MOCK_USAGE_HEALTHY);

      const result = await updateR2Usage(env, { storageGB: 1.5 });

      expect(result.storageGB).toBe(MOCK_USAGE_HEALTHY.storageGB + 1.5);
      expect(env.CACHE.put).toHaveBeenCalled();
    });

    it('should update Class A operations correctly', async () => {
      const env = createMockEnv(MOCK_USAGE_HEALTHY);

      const result = await updateR2Usage(env, { classAOps: 100 });

      expect(result.classAOps).toBe(MOCK_USAGE_HEALTHY.classAOps + 100);
    });

    it('should update Class B operations correctly', async () => {
      const env = createMockEnv(MOCK_USAGE_HEALTHY);

      const result = await updateR2Usage(env, { classBOps: 500 });

      expect(result.classBOps).toBe(MOCK_USAGE_HEALTHY.classBOps + 500);
    });

    it('should update threats archived count', async () => {
      const env = createMockEnv(MOCK_USAGE_HEALTHY);

      const result = await updateR2Usage(env, { threatsArchived: 10 });

      expect(result.threatsArchived).toBe(MOCK_USAGE_HEALTHY.threatsArchived + 10);
    });

    it('should handle negative storage updates (deletions)', async () => {
      const env = createMockEnv(MOCK_USAGE_HEALTHY);

      const result = await updateR2Usage(env, { storageGB: -0.5 });

      expect(result.storageGB).toBe(MOCK_USAGE_HEALTHY.storageGB - 0.5);
    });

    it('should not allow storage to go below zero', async () => {
      const env = createMockEnv(MOCK_USAGE_HEALTHY);

      const result = await updateR2Usage(env, { storageGB: -10 });

      expect(result.storageGB).toBe(0); // Should clamp to 0
    });

    it('should update multiple metrics at once', async () => {
      const env = createMockEnv(MOCK_USAGE_HEALTHY);

      const result = await updateR2Usage(env, {
        storageGB: 0.5,
        classAOps: 10,
        classBOps: 100,
        threatsArchived: 5,
      });

      expect(result.storageGB).toBe(MOCK_USAGE_HEALTHY.storageGB + 0.5);
      expect(result.classAOps).toBe(MOCK_USAGE_HEALTHY.classAOps + 10);
      expect(result.classBOps).toBe(MOCK_USAGE_HEALTHY.classBOps + 100);
      expect(result.threatsArchived).toBe(MOCK_USAGE_HEALTHY.threatsArchived + 5);
    });

    it('should update timestamp on change', async () => {
      const env = createMockEnv(MOCK_USAGE_HEALTHY);
      const beforeTime = new Date().toISOString();

      const result = await updateR2Usage(env, { classAOps: 1 });

      expect(result.lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(new Date(result.lastUpdated).getTime()).toBeGreaterThanOrEqual(
        new Date(beforeTime).getTime()
      );
    });

    it('should set status to healthy when below warning threshold', async () => {
      const env = createMockEnv(MOCK_USAGE_EMPTY);

      const result = await updateR2Usage(env, { storageGB: 1.0 }); // 12.5% of 8GB

      expect(result.status).toBe('healthy');
    });

    it('should set status to warning when above 70% threshold', async () => {
      const env = createMockEnv(MOCK_USAGE_EMPTY);

      // 72% of storage limit (5.76GB)
      const result = await updateR2Usage(env, { storageGB: 5.76 });

      expect(result.status).toBe('warning');
    });

    it('should set status to critical when above 80% threshold', async () => {
      const env = createMockEnv(MOCK_USAGE_EMPTY);

      // 85% of storage limit (6.8GB)
      const result = await updateR2Usage(env, { storageGB: 6.8 });

      expect(result.status).toBe('critical');
    });

    it('should use max percentage across all metrics for status', async () => {
      const env = createMockEnv(MOCK_USAGE_EMPTY);

      // Storage at 30%, Class A at 75% (should trigger warning)
      const result = await updateR2Usage(env, {
        storageGB: 2.4, // 30%
        classAOps: 600_000, // 75%
      });

      expect(result.status).toBe('warning');
    });

    it('should save updated usage to KV with correct TTL', async () => {
      const env = createMockEnv(MOCK_USAGE_HEALTHY);

      await updateR2Usage(env, { classAOps: 1 });

      expect(env.CACHE.put).toHaveBeenCalledWith(
        expect.stringMatching(/^r2:usage:/),
        expect.any(String),
        expect.objectContaining({
          expirationTtl: 60 * 60 * 24 * 32,
        })
      );
    });
  });

  describe('checkR2Quota()', () => {
    it('should allow write operation when under quota', async () => {
      const env = createMockEnv(MOCK_USAGE_HEALTHY);

      const result = await checkR2Quota(env, {
        type: 'write',
        sizeGB: 0.5,
      });

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should deny write when storage quota would be exceeded', async () => {
      const env = createMockEnv(MOCK_USAGE_CRITICAL);

      const result = await checkR2Quota(env, {
        type: 'write',
        sizeGB: 1.0, // Would push to 8.5GB
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Storage quota exceeded');
      expect(result.reason).toContain('7.5'); // Current storage
      expect(result.reason).toContain('8'); // Limit
    });

    it('should deny write when Class A operations quota exceeded', async () => {
      const env = createMockEnv(MOCK_USAGE_CLASS_A_EXCEEDED);

      const result = await checkR2Quota(env, {
        type: 'write',
        sizeGB: 0.1,
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Class A operations quota exceeded');
      expect(result.reason).toContain('850000'); // Current ops
      expect(result.reason).toContain('800000'); // Limit
    });

    it('should deny read when Class B operations quota exceeded', async () => {
      const env = createMockEnv(MOCK_USAGE_CLASS_B_EXCEEDED);

      const result = await checkR2Quota(env, { type: 'read' });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Class B operations quota exceeded');
      expect(result.reason).toContain('9000000'); // Current ops
      expect(result.reason).toContain('8000000'); // Limit
    });

    it('should allow read operation when under quota', async () => {
      const env = createMockEnv(MOCK_USAGE_HEALTHY);

      const result = await checkR2Quota(env, { type: 'read' });

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should return usage data in response', async () => {
      const env = createMockEnv(MOCK_USAGE_HEALTHY);

      const result = await checkR2Quota(env, { type: 'read' });

      expect(result.usage).toEqual(MOCK_USAGE_HEALTHY);
    });

    it('should check exact quota boundary (at limit should deny)', async () => {
      const env = createMockEnv({
        ...MOCK_USAGE_EMPTY,
        storageGB: 8.0, // Exactly at limit
      });

      const result = await checkR2Quota(env, {
        type: 'write',
        sizeGB: 0.001,
      });

      expect(result.allowed).toBe(false);
    });

    it('should allow write just under storage limit', async () => {
      const env = createMockEnv({
        ...MOCK_USAGE_EMPTY,
        storageGB: 7.999,
      });

      const result = await checkR2Quota(env, {
        type: 'write',
        sizeGB: 0.0001,
      });

      expect(result.allowed).toBe(true);
    });
  });

  describe('logQuotaWarning()', () => {
    it('should log critical warning when status is critical', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation();

      logQuotaWarning(MOCK_USAGE_CRITICAL);

      expect(consoleSpy).toHaveBeenCalledWith(
        '[R2 QUOTA CRITICAL]',
        expect.objectContaining({
          storageGB: 7.5,
          storageLimit: QUOTA_LIMITS.STORAGE_GB,
          classAOps: 750_000,
          classALimit: QUOTA_LIMITS.CLASS_A_OPS,
        })
      );

      consoleSpy.mockRestore();
    });

    it('should include percentage in critical warning', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation();

      logQuotaWarning(MOCK_USAGE_CRITICAL);

      expect(consoleSpy).toHaveBeenCalledWith(
        '[R2 QUOTA CRITICAL]',
        expect.objectContaining({
          storagePercent: expect.stringContaining('%'),
          classAPercent: expect.stringContaining('%'),
        })
      );

      consoleSpy.mockRestore();
    });

    it('should log warning when status is warning', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation();

      logQuotaWarning(MOCK_USAGE_WARNING);

      expect(consoleSpy).toHaveBeenCalledWith(
        '[R2 QUOTA WARNING]',
        expect.objectContaining({
          storageGB: 6.0,
          classAOps: 600_000,
        })
      );

      consoleSpy.mockRestore();
    });

    it('should not log when status is healthy', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation();
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation();

      logQuotaWarning(MOCK_USAGE_HEALTHY);

      expect(consoleErrorSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });
  });

  describe('getQuotaStatus()', () => {
    it('should return formatted quota status', () => {
      const result = getQuotaStatus(MOCK_USAGE_HEALTHY);

      expect(result).toMatchObject({
        storage: {
          current: MOCK_USAGE_HEALTHY.storageGB,
          limit: QUOTA_LIMITS.STORAGE_GB,
          percent: expect.any(String),
        },
        classA: {
          current: MOCK_USAGE_HEALTHY.classAOps,
          limit: QUOTA_LIMITS.CLASS_A_OPS,
          percent: expect.any(String),
        },
        classB: {
          current: MOCK_USAGE_HEALTHY.classBOps,
          limit: QUOTA_LIMITS.CLASS_B_OPS,
          percent: expect.any(String),
        },
        threatsArchived: MOCK_USAGE_HEALTHY.threatsArchived,
        status: MOCK_USAGE_HEALTHY.status,
        month: MOCK_USAGE_HEALTHY.month,
        lastUpdated: MOCK_USAGE_HEALTHY.lastUpdated,
      });
    });

    it('should calculate storage percentage correctly', () => {
      const result = getQuotaStatus(MOCK_USAGE_HEALTHY);

      // 2.5GB / 8GB = 31.25%
      expect(result.storage.percent).toBe('31.3');
    });

    it('should calculate Class A percentage correctly', () => {
      const result = getQuotaStatus(MOCK_USAGE_HEALTHY);

      // 100,000 / 800,000 = 12.5%
      expect(result.classA.percent).toBe('12.5');
    });

    it('should calculate Class B percentage correctly', () => {
      const result = getQuotaStatus(MOCK_USAGE_HEALTHY);

      // 1,000,000 / 8,000,000 = 12.5%
      expect(result.classB.percent).toBe('12.5');
    });

    it('should handle warning status correctly', () => {
      const result = getQuotaStatus(MOCK_USAGE_WARNING);

      expect(result.status).toBe('warning');
      expect(parseFloat(result.storage.percent)).toBeGreaterThan(70);
    });

    it('should handle critical status correctly', () => {
      const result = getQuotaStatus(MOCK_USAGE_CRITICAL);

      expect(result.status).toBe('critical');
      expect(parseFloat(result.storage.percent)).toBeGreaterThan(80);
    });

    it('should include threats archived count', () => {
      const result = getQuotaStatus(MOCK_USAGE_HEALTHY);

      expect(result.threatsArchived).toBe(5000);
    });

    it('should include month and timestamp', () => {
      const result = getQuotaStatus(MOCK_USAGE_HEALTHY);

      expect(result.month).toMatch(/^\d{4}-\d{2}$/);
      expect(result.lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('Integration Tests', () => {
    it('should track full write operation lifecycle', async () => {
      const env = createMockEnv(MOCK_USAGE_HEALTHY);

      // Check quota
      const quotaCheck = await checkR2Quota(env, {
        type: 'write',
        sizeGB: 0.5,
      });
      expect(quotaCheck.allowed).toBe(true);

      // Update usage after write
      const updatedUsage = await updateR2Usage(env, {
        storageGB: 0.5,
        classAOps: 1,
        threatsArchived: 1,
      });

      expect(updatedUsage.storageGB).toBe(MOCK_USAGE_HEALTHY.storageGB + 0.5);
      expect(updatedUsage.classAOps).toBe(MOCK_USAGE_HEALTHY.classAOps + 1);
      expect(updatedUsage.status).toBe('healthy');
    });

    it('should track full read operation lifecycle', async () => {
      const env = createMockEnv(MOCK_USAGE_HEALTHY);

      // Check quota
      const quotaCheck = await checkR2Quota(env, { type: 'read' });
      expect(quotaCheck.allowed).toBe(true);

      // Update usage after read
      const updatedUsage = await updateR2Usage(env, {
        classBOps: 1,
      });

      expect(updatedUsage.classBOps).toBe(MOCK_USAGE_HEALTHY.classBOps + 1);
      expect(updatedUsage.status).toBe('healthy');
    });

    it('should handle quota exhaustion scenario', async () => {
      const env = createMockEnv(MOCK_USAGE_CRITICAL);

      // Check quota - should be denied
      const quotaCheck = await checkR2Quota(env, {
        type: 'write',
        sizeGB: 1.0,
      });

      expect(quotaCheck.allowed).toBe(false);
      expect(quotaCheck.reason).toBeTruthy();

      // Log warning
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation();
      logQuotaWarning(quotaCheck.usage);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should transition from healthy to warning to critical', async () => {
      const env = createMockEnv(MOCK_USAGE_EMPTY);

      // Start healthy
      let usage = await updateR2Usage(env, { storageGB: 2.0 }); // 25%
      expect(usage.status).toBe('healthy');

      // Move to warning
      usage = await updateR2Usage(env, { storageGB: 4.0 }); // 75%
      expect(usage.status).toBe('warning');

      // Move to critical
      usage = await updateR2Usage(env, { storageGB: 1.0 }); // 87.5%
      expect(usage.status).toBe('critical');
    });
  });
});
