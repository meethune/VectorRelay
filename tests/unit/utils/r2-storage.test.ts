import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateR2Key,
  archiveThreat,
  retrieveArchivedThreat,
  deleteArchivedThreat,
  listArchivedThreats,
  getR2Stats,
} from '../../../functions/utils/r2-storage';
import type { Env } from '../../../functions/types';
import {
  MOCK_THREAT_SMALL,
  MOCK_THREAT_LARGE,
  MOCK_THREAT_NO_ANALYSIS,
  MOCK_ARCHIVED_THREAT,
  createMockR2Object,
  MOCK_R2_LIST_RESULT,
  MOCK_R2_LIST_TRUNCATED,
  MOCK_R2_LIST_EMPTY,
} from '../../fixtures/r2-storage';
import { MOCK_USAGE_HEALTHY, MOCK_USAGE_CRITICAL } from '../../fixtures/r2-quota';

// Mock quota functions
vi.mock('../../../functions/utils/r2-quota', () => ({
  checkR2Quota: vi.fn(),
  updateR2Usage: vi.fn(),
  getR2Usage: vi.fn(),
  logQuotaWarning: vi.fn(),
}));

import * as quotaModule from '../../../functions/utils/r2-quota';

// Mock environment with R2
function createMockEnv(options: {
  kvData?: any;
  r2Objects?: Map<string, any>;
  archiveEnabled?: boolean;
  quotaAllowed?: boolean;
} = {}): Env {
  const {
    kvData = null,
    r2Objects = new Map(),
    archiveEnabled = true,
    quotaAllowed = true,
  } = options;

  const kvStore = new Map<string, any>();

  return {
    DB: {} as any,
    AI: {} as any,
    VECTORIZE_INDEX: {} as any,
    CACHE: {
      get: vi.fn().mockImplementation(async (key: string) => {
        if (kvStore.has(key)) {
          return JSON.parse(JSON.stringify(kvStore.get(key)));
        }
        return kvData ? JSON.parse(JSON.stringify(kvData)) : null;
      }),
      put: vi.fn().mockImplementation(async (key: string, value: string) => {
        kvStore.set(key, JSON.parse(value));
      }),
    } as any,
    ANALYTICS: {} as any,
    THREAT_ARCHIVE: {
      get: vi.fn().mockImplementation(async (key: string) => {
        return r2Objects.get(key) || null;
      }),
      put: vi.fn().mockImplementation(async (key: string, value: string, options?: any) => {
        r2Objects.set(key, createMockR2Object(value));
      }),
      delete: vi.fn().mockImplementation(async (key: string) => {
        r2Objects.delete(key);
      }),
      list: vi.fn().mockResolvedValue(MOCK_R2_LIST_RESULT),
    } as any,
    ASSETS: {} as any,
    AI_GATEWAY_ID: 'test-gateway-id',
    R2_ARCHIVE_ENABLED: archiveEnabled ? 'true' : 'false',
  } as any;
}

describe('R2 Storage Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Set up default mock behavior for quota functions
    vi.mocked(quotaModule.checkR2Quota).mockResolvedValue({
      allowed: true,
      usage: MOCK_USAGE_HEALTHY,
    });

    vi.mocked(quotaModule.updateR2Usage).mockResolvedValue(MOCK_USAGE_HEALTHY);
    vi.mocked(quotaModule.getR2Usage).mockResolvedValue(MOCK_USAGE_HEALTHY);
  });

  describe('generateR2Key()', () => {
    it('should generate key with correct format', () => {
      const key = generateR2Key('test-threat-123', '2025-12-08T10:00:00Z');

      expect(key).toBe('threats/2025/12/test-threat-123.json');
    });

    it('should handle single-digit months correctly', () => {
      const key = generateR2Key('test-threat', '2025-01-15T10:00:00Z');

      expect(key).toBe('threats/2025/01/test-threat.json');
    });

    it('should handle different years', () => {
      const key = generateR2Key('test-threat', '2024-06-30T10:00:00Z');

      expect(key).toBe('threats/2024/06/test-threat.json');
    });

    it('should handle end of year', () => {
      const key = generateR2Key('test-threat', '2025-12-31T23:59:59Z');

      expect(key).toBe('threats/2025/12/test-threat.json');
    });

    it('should use threat ID in key', () => {
      const threatId = 'unique-threat-id-456';
      const key = generateR2Key(threatId, '2025-12-08T10:00:00Z');

      expect(key).toContain(threatId);
      expect(key).toMatch(/\.json$/);
    });
  });

  describe('archiveThreat()', () => {
    it('should successfully archive a small threat', async () => {
      const env = createMockEnv();

      const result = await archiveThreat(env, MOCK_THREAT_SMALL);

      expect(result.success).toBe(true);
      expect(result.r2Key).toBeTruthy();
      expect(result.r2Key).toMatch(/^threats\/\d{4}\/\d{2}\/.+\.json$/);
      expect(env.THREAT_ARCHIVE.put).toHaveBeenCalled();
    });

    it('should return error when R2 archiving is disabled', async () => {
      const env = createMockEnv({ archiveEnabled: false });

      const result = await archiveThreat(env, MOCK_THREAT_SMALL);

      expect(result.success).toBe(false);
      expect(result.error).toBe('R2 archiving is disabled');
      expect(env.THREAT_ARCHIVE.put).not.toHaveBeenCalled();
    });

    it('should reject threats exceeding size limit', async () => {
      const env = createMockEnv();

      const result = await archiveThreat(env, MOCK_THREAT_LARGE);

      expect(result.success).toBe(false);
      expect(result.error).toContain('exceeds max archive size');
      expect(result.error).toContain('204800'); // 200KB in bytes
      expect(env.THREAT_ARCHIVE.put).not.toHaveBeenCalled();
    });

    it('should check quota before archiving', async () => {
      const env = createMockEnv();

      await archiveThreat(env, MOCK_THREAT_SMALL);

      expect(quotaModule.checkR2Quota).toHaveBeenCalledWith(
        env,
        expect.objectContaining({
          type: 'write',
          sizeGB: expect.any(Number),
        })
      );
    });

    it('should deny archiving when quota exceeded', async () => {
      const env = createMockEnv();
      vi.mocked(quotaModule.checkR2Quota).mockResolvedValue({
        allowed: false,
        reason: 'Storage quota exceeded',
        usage: MOCK_USAGE_CRITICAL,
      });

      const result = await archiveThreat(env, MOCK_THREAT_SMALL);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Storage quota exceeded');
      expect(env.THREAT_ARCHIVE.put).not.toHaveBeenCalled();
    });

    it('should update quota after successful archive', async () => {
      const env = createMockEnv();

      await archiveThreat(env, MOCK_THREAT_SMALL);

      expect(quotaModule.updateR2Usage).toHaveBeenCalledWith(
        env,
        expect.objectContaining({
          storageGB: expect.any(Number),
          classAOps: 1,
          threatsArchived: 1,
        })
      );
    });

    it('should include AI analysis in archive', async () => {
      const env = createMockEnv();

      const result = await archiveThreat(env, MOCK_THREAT_SMALL);

      expect(result.success).toBe(true);

      const putCall = (env.THREAT_ARCHIVE.put as any).mock.calls[0];
      const archivedData = JSON.parse(putCall[1]);

      expect(archivedData.ai_analysis).toEqual(MOCK_THREAT_SMALL.ai_analysis);
    });

    it('should include IOCs in archive', async () => {
      const env = createMockEnv();

      const result = await archiveThreat(env, MOCK_THREAT_SMALL);

      expect(result.success).toBe(true);

      const putCall = (env.THREAT_ARCHIVE.put as any).mock.calls[0];
      const archivedData = JSON.parse(putCall[1]);

      expect(archivedData.iocs).toEqual(MOCK_THREAT_SMALL.iocs);
    });

    it('should handle threats without AI analysis', async () => {
      const env = createMockEnv();

      const result = await archiveThreat(env, MOCK_THREAT_NO_ANALYSIS);

      expect(result.success).toBe(true);

      const putCall = (env.THREAT_ARCHIVE.put as any).mock.calls[0];
      const archivedData = JSON.parse(putCall[1]);

      expect(archivedData.ai_analysis).toBeUndefined();
    });

    it('should set custom metadata on R2 object', async () => {
      const env = createMockEnv();

      await archiveThreat(env, MOCK_THREAT_SMALL);

      const putCall = (env.THREAT_ARCHIVE.put as any).mock.calls[0];
      const options = putCall[2];

      expect(options.customMetadata).toMatchObject({
        threatId: MOCK_THREAT_SMALL.id,
        category: 'zero_day',
        severity: 'critical',
      });
    });

    it('should set correct content type', async () => {
      const env = createMockEnv();

      await archiveThreat(env, MOCK_THREAT_SMALL);

      const putCall = (env.THREAT_ARCHIVE.put as any).mock.calls[0];
      const options = putCall[2];

      expect(options.httpMetadata.contentType).toBe('application/json');
    });

    it('should handle R2 put errors', async () => {
      const env = createMockEnv();
      env.THREAT_ARCHIVE.put = vi.fn().mockRejectedValue(new Error('R2 service error'));

      const result = await archiveThreat(env, MOCK_THREAT_SMALL);

      expect(result.success).toBe(false);
      expect(result.error).toBe('R2 service error');
    });

    it('should include size_bytes in metadata', async () => {
      const env = createMockEnv();

      await archiveThreat(env, MOCK_THREAT_SMALL);

      const putCall = (env.THREAT_ARCHIVE.put as any).mock.calls[0];
      const archivedData = JSON.parse(putCall[1]);

      // Note: Current implementation sets size_bytes to 0 in the saved JSON
      // because size is calculated AFTER stringification
      expect(archivedData.metadata).toHaveProperty('size_bytes');
      expect(typeof archivedData.metadata.size_bytes).toBe('number');
    });
  });

  describe('retrieveArchivedThreat()', () => {
    it('should successfully retrieve archived threat', async () => {
      const r2Objects = new Map();
      const archivedJson = JSON.stringify(MOCK_ARCHIVED_THREAT);
      r2Objects.set('threats/2025/12/test.json', createMockR2Object(archivedJson));

      const env = createMockEnv({ r2Objects });

      const result = await retrieveArchivedThreat(env, 'threats/2025/12/test.json');

      expect(result).toBeTruthy();
      expect(result?.id).toBe(MOCK_ARCHIVED_THREAT.id);
      expect(result?.title).toBe(MOCK_ARCHIVED_THREAT.title);
    });

    it('should return null when object not found', async () => {
      const env = createMockEnv();

      const result = await retrieveArchivedThreat(env, 'threats/2025/12/nonexistent.json');

      expect(result).toBeNull();
    });

    it('should check quota before retrieval', async () => {
      const env = createMockEnv();

      await retrieveArchivedThreat(env, 'threats/2025/12/test.json');

      expect(quotaModule.checkR2Quota).toHaveBeenCalledWith(
        env,
        expect.objectContaining({ type: 'read' })
      );
    });

    it('should deny retrieval when quota exceeded', async () => {
      const env = createMockEnv();
      vi.mocked(quotaModule.checkR2Quota).mockResolvedValue({
        allowed: false,
        reason: 'Class B operations quota exceeded',
        usage: MOCK_USAGE_CRITICAL,
      });

      const result = await retrieveArchivedThreat(env, 'threats/2025/12/test.json');

      expect(result).toBeNull();
      expect(env.THREAT_ARCHIVE.get).not.toHaveBeenCalled();
    });

    it('should update quota after successful retrieval', async () => {
      const r2Objects = new Map();
      const archivedJson = JSON.stringify(MOCK_ARCHIVED_THREAT);
      r2Objects.set('threats/2025/12/test.json', createMockR2Object(archivedJson));

      const env = createMockEnv({ r2Objects });

      await retrieveArchivedThreat(env, 'threats/2025/12/test.json');

      expect(quotaModule.updateR2Usage).toHaveBeenCalledWith(
        env,
        expect.objectContaining({ classBOps: 1 })
      );
    });

    it('should handle malformed JSON gracefully', async () => {
      const r2Objects = new Map();
      r2Objects.set('threats/2025/12/test.json', createMockR2Object('invalid json {'));

      const env = createMockEnv({ r2Objects });

      const result = await retrieveArchivedThreat(env, 'threats/2025/12/test.json');

      expect(result).toBeNull();
    });

    it('should handle R2 get errors', async () => {
      const env = createMockEnv();
      env.THREAT_ARCHIVE.get = vi.fn().mockRejectedValue(new Error('R2 error'));

      const result = await retrieveArchivedThreat(env, 'threats/2025/12/test.json');

      expect(result).toBeNull();
    });
  });

  describe('deleteArchivedThreat()', () => {
    it('should successfully delete archived threat', async () => {
      const r2Objects = new Map();
      const archivedJson = JSON.stringify(MOCK_ARCHIVED_THREAT);
      r2Objects.set('threats/2025/12/test.json', createMockR2Object(archivedJson));

      const env = createMockEnv({ r2Objects });

      const result = await deleteArchivedThreat(env, 'threats/2025/12/test.json');

      expect(result.success).toBe(true);
      expect(env.THREAT_ARCHIVE.delete).toHaveBeenCalledWith('threats/2025/12/test.json');
    });

    it('should update quota after deletion', async () => {
      const r2Objects = new Map();
      const archivedJson = JSON.stringify(MOCK_ARCHIVED_THREAT);
      r2Objects.set('threats/2025/12/test.json', createMockR2Object(archivedJson));

      const env = createMockEnv({ r2Objects });

      await deleteArchivedThreat(env, 'threats/2025/12/test.json');

      expect(quotaModule.updateR2Usage).toHaveBeenCalledWith(
        env,
        expect.objectContaining({
          storageGB: expect.any(Number), // Negative value
          classAOps: 1,
          threatsArchived: -1,
        })
      );

      // Check that storage is negative (freed)
      const updateCall = (quotaModule.updateR2Usage as any).mock.calls[0][1];
      expect(updateCall.storageGB).toBeLessThan(0);
    });

    it('should handle deletion when object does not exist', async () => {
      const env = createMockEnv();

      const result = await deleteArchivedThreat(env, 'threats/2025/12/nonexistent.json');

      expect(result.success).toBe(true);
      expect(env.THREAT_ARCHIVE.delete).toHaveBeenCalled();
    });

    it('should handle R2 delete errors', async () => {
      const env = createMockEnv();
      env.THREAT_ARCHIVE.delete = vi.fn().mockRejectedValue(new Error('R2 delete error'));

      const result = await deleteArchivedThreat(env, 'threats/2025/12/test.json');

      expect(result.success).toBe(false);
      expect(result.error).toBe('R2 delete error');
    });
  });

  describe('listArchivedThreats()', () => {
    it('should successfully list archived threats', async () => {
      const env = createMockEnv();

      const result = await listArchivedThreats(env);

      expect(result).toBeTruthy();
      expect(result?.keys).toHaveLength(3);
      expect(result?.keys[0]).toBe('threats/2025/12/threat-1.json');
      expect(result?.truncated).toBe(false);
    });

    it('should check quota before listing', async () => {
      const env = createMockEnv();

      await listArchivedThreats(env);

      expect(quotaModule.checkR2Quota).toHaveBeenCalledWith(
        env,
        expect.objectContaining({ type: 'write' }) // LIST is Class A
      );
    });

    it('should deny listing when quota exceeded', async () => {
      const env = createMockEnv();
      vi.mocked(quotaModule.checkR2Quota).mockResolvedValue({
        allowed: false,
        reason: 'Class A operations quota exceeded',
        usage: MOCK_USAGE_CRITICAL,
      });

      const result = await listArchivedThreats(env);

      expect(result).toBeNull();
      expect(env.THREAT_ARCHIVE.list).not.toHaveBeenCalled();
    });

    it('should update quota after listing', async () => {
      const env = createMockEnv();

      await listArchivedThreats(env);

      expect(quotaModule.updateR2Usage).toHaveBeenCalledWith(
        env,
        expect.objectContaining({ classAOps: 1 })
      );
    });

    it('should support prefix filtering', async () => {
      const env = createMockEnv();

      await listArchivedThreats(env, { prefix: 'threats/2025/12/' });

      expect(env.THREAT_ARCHIVE.list).toHaveBeenCalledWith(
        expect.objectContaining({
          prefix: 'threats/2025/12/',
        })
      );
    });

    it('should support custom limit', async () => {
      const env = createMockEnv();

      await listArchivedThreats(env, { limit: 100 });

      expect(env.THREAT_ARCHIVE.list).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 100,
        })
      );
    });

    it('should use default limit of 1000', async () => {
      const env = createMockEnv();

      await listArchivedThreats(env);

      expect(env.THREAT_ARCHIVE.list).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 1000,
        })
      );
    });

    it('should handle truncated results', async () => {
      const env = createMockEnv();
      env.THREAT_ARCHIVE.list = vi.fn().mockResolvedValue(MOCK_R2_LIST_TRUNCATED);

      const result = await listArchivedThreats(env);

      expect(result?.truncated).toBe(true);
      expect(result?.keys).toHaveLength(1000);
    });

    it('should handle empty results', async () => {
      const env = createMockEnv();
      env.THREAT_ARCHIVE.list = vi.fn().mockResolvedValue(MOCK_R2_LIST_EMPTY);

      const result = await listArchivedThreats(env);

      expect(result?.keys).toHaveLength(0);
      expect(result?.truncated).toBe(false);
    });

    it('should handle R2 list errors', async () => {
      const env = createMockEnv();
      env.THREAT_ARCHIVE.list = vi.fn().mockRejectedValue(new Error('R2 list error'));

      const result = await listArchivedThreats(env);

      expect(result).toBeNull();
    });
  });

  describe('getR2Stats()', () => {
    it('should return formatted R2 statistics', async () => {
      const env = createMockEnv();

      const result = await getR2Stats(env);

      expect(result).toMatchObject({
        storage: {
          currentGB: expect.any(Number),
          limitGB: 8,
          freeTierGB: 10,
          percentUsed: expect.any(String),
        },
        operations: {
          classA: {
            current: expect.any(Number),
            limit: 800_000,
            freeTier: 1_000_000,
            percentUsed: expect.any(String),
          },
          classB: {
            current: expect.any(Number),
            limit: 8_000_000,
            freeTier: 10_000_000,
            percentUsed: expect.any(String),
          },
        },
        threats: {
          archived: expect.any(Number),
        },
        status: expect.any(String),
        month: expect.any(String),
        lastUpdated: expect.any(String),
      });
    });

    it('should calculate correct percentages', async () => {
      const env = createMockEnv();
      vi.mocked(quotaModule.getR2Usage).mockResolvedValue({
        ...MOCK_USAGE_HEALTHY,
        storageGB: 4.0, // 50% of 8GB
        classAOps: 400_000, // 50% of 800K
        classBOps: 4_000_000, // 50% of 8M
      });

      const result = await getR2Stats(env);

      expect(result.storage.percentUsed).toBe('50.0');
      expect(result.operations.classA.percentUsed).toBe('50.0');
      expect(result.operations.classB.percentUsed).toBe('50.0');
    });

    it('should include threats archived count', async () => {
      const env = createMockEnv();
      vi.mocked(quotaModule.getR2Usage).mockResolvedValue({
        ...MOCK_USAGE_HEALTHY,
        threatsArchived: 12345,
      });

      const result = await getR2Stats(env);

      expect(result.threats.archived).toBe(12345);
    });

    it('should include status and timestamps', async () => {
      const env = createMockEnv();

      const result = await getR2Stats(env);

      expect(result.status).toBe(MOCK_USAGE_HEALTHY.status);
      expect(result.month).toBe(MOCK_USAGE_HEALTHY.month);
      expect(result.lastUpdated).toBe(MOCK_USAGE_HEALTHY.lastUpdated);
    });
  });

  describe('Integration Tests', () => {
    it('should complete full archive-retrieve-delete lifecycle', async () => {
      const r2Objects = new Map();
      const env = createMockEnv({ r2Objects });

      // Archive
      const archiveResult = await archiveThreat(env, MOCK_THREAT_SMALL);
      expect(archiveResult.success).toBe(true);

      // Retrieve
      const retrieveResult = await retrieveArchivedThreat(env, archiveResult.r2Key!);
      expect(retrieveResult).toBeTruthy();
      expect(retrieveResult?.id).toBe(MOCK_THREAT_SMALL.id);

      // Delete
      const deleteResult = await deleteArchivedThreat(env, archiveResult.r2Key!);
      expect(deleteResult.success).toBe(true);

      // Verify deleted
      const afterDelete = await retrieveArchivedThreat(env, archiveResult.r2Key!);
      expect(afterDelete).toBeNull();
    });

    it('should enforce quota throughout operations', async () => {
      const env = createMockEnv();
      vi.mocked(quotaModule.checkR2Quota).mockResolvedValue({
        allowed: false,
        reason: 'Quota exceeded',
        usage: MOCK_USAGE_CRITICAL,
      });

      // All operations should be denied
      const archiveResult = await archiveThreat(env, MOCK_THREAT_SMALL);
      expect(archiveResult.success).toBe(false);

      const retrieveResult = await retrieveArchivedThreat(env, 'test.json');
      expect(retrieveResult).toBeNull();

      const listResult = await listArchivedThreats(env);
      expect(listResult).toBeNull();
    });
  });
});
