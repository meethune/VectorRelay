import { describe, it, expect, vi, beforeEach } from 'vitest';
import { archiveOldThreats, restoreThreat } from '../../../functions/utils/archiver';
import type { Env } from '../../../functions/types';

// Mock the r2-storage and r2-quota modules
vi.mock('../../../functions/utils/r2-storage', () => ({
  archiveThreat: vi.fn(),
  retrieveArchivedThreat: vi.fn(),
}));

vi.mock('../../../functions/utils/r2-quota', () => ({
  getR2Usage: vi.fn(),
  logQuotaWarning: vi.fn(),
}));

import { archiveThreat, retrieveArchivedThreat } from '../../../functions/utils/r2-storage';
import { getR2Usage, logQuotaWarning } from '../../../functions/utils/r2-quota';

describe('Archiver Utils', () => {
  function createMockEnv(overrides?: Partial<Env>): Env {
    return {
      DB: {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({ success: true, results: [] }),
            first: vi.fn().mockResolvedValue(null),
            run: vi.fn().mockResolvedValue({ success: true }),
          }),
        }),
      } as any,
      AI: {} as any,
      VECTORIZE_INDEX: {} as any,
      CACHE: {} as any,
      ANALYTICS: {} as any,
      THREAT_ARCHIVE: {} as any,
      ASSETS: {} as any,
      AI_GATEWAY_ID: 'test-gateway-id',
      R2_ARCHIVE_ENABLED: 'true',
      ...overrides,
    } as any;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: R2 quota is OK
    (getR2Usage as any).mockResolvedValue({
      status: 'healthy',
      percentUsed: 50,
    });
    (logQuotaWarning as any).mockReturnValue(undefined);
  });

  describe('archiveOldThreats()', () => {
    it('should return early when R2 archiving is disabled', async () => {
      const env = createMockEnv({ R2_ARCHIVE_ENABLED: 'false' });

      const result = await archiveOldThreats(env);

      expect(result.checked).toBe(0);
      expect(result.archived).toBe(0);
      expect(result.errors).toContain('R2 archiving disabled via R2_ARCHIVE_ENABLED env var');
      expect(env.DB.prepare).not.toHaveBeenCalled();
    });

    it('should return early when R2 quota is critical', async () => {
      (getR2Usage as any).mockResolvedValue({
        status: 'critical',
        percentUsed: 85,
      });

      const env = createMockEnv();

      const result = await archiveOldThreats(env);

      expect(result.checked).toBe(0);
      expect(result.quotaExceeded).toBe(true);
      expect(result.errors).toContain('R2 quota at critical level (>80% of free tier)');
    });

    it('should return empty stats when no threats to archive', async () => {
      const env = createMockEnv();

      const result = await archiveOldThreats(env);

      expect(result.checked).toBe(0);
      expect(result.archived).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.skipped).toBe(0);
      expect(result.quotaExceeded).toBe(false);
    });

    it('should archive old threats successfully', async () => {
      const mockThreats = [
        {
          id: 'threat-1',
          feed_source: 'Security Blog A',
          title: 'Old Threat',
          url: 'https://example.com/old-threat',
          content: 'Threat content',
          published_at: 1640000000, // Old timestamp
          tldr: 'Summary of threat',
          category: 'malware',
          severity: 'high',
          threat_actors: JSON.stringify(['APT28']),
          affected_sectors: JSON.stringify(['Healthcare']),
        },
      ];

      const env = createMockEnv();

      // Mock IOCs query
      const iocsResult = {
        success: true,
        results: [
          { ioc_type: 'ip', ioc_value: '192.0.2.10', context: 'C2 server' },
        ],
      };

      let callCount = 0;
      (env.DB.prepare as any).mockImplementation(() => ({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue(callCount++ === 0 ? { success: true, results: mockThreats } : iocsResult),
          run: vi.fn().mockResolvedValue({ success: true }),
        }),
      }));

      (archiveThreat as any).mockResolvedValue({
        success: true,
        r2Key: 'archived/2024/threat-1.json',
      });

      const result = await archiveOldThreats(env);

      expect(result.checked).toBe(1);
      expect(result.archived).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.skipped).toBe(0);
      expect(archiveThreat).toHaveBeenCalledWith(
        env,
        expect.objectContaining({
          id: 'threat-1',
          title: 'Old Threat',
        })
      );
    });

    it('should include AI analysis when available', async () => {
      const mockThreat = {
        id: 'threat-1',
        feed_source: 'Security Blog A',
        title: 'Analyzed Threat',
        url: 'https://example.com/threat',
        content: 'Content',
        published_at: 1640000000,
        tldr: 'AI Summary',
        category: 'ransomware',
        severity: 'critical',
        threat_actors: JSON.stringify(['LockBit']),
        affected_sectors: JSON.stringify(['Healthcare', 'Finance']),
      };

      const env = createMockEnv();
      let callCount = 0;
      (env.DB.prepare as any).mockImplementation(() => ({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue(
            callCount++ === 0
              ? { success: true, results: [mockThreat] }
              : { success: true, results: [] }
          ),
          run: vi.fn().mockResolvedValue({ success: true }),
        }),
      }));

      (archiveThreat as any).mockResolvedValue({
        success: true,
        r2Key: 'archived/threat-1.json',
      });

      await archiveOldThreats(env);

      expect(archiveThreat).toHaveBeenCalledWith(
        env,
        expect.objectContaining({
          ai_analysis: {
            summary: 'AI Summary',
            category: 'ransomware',
            severity: 'critical',
            threat_actors: ['LockBit'],
            affected_sectors: ['Healthcare', 'Finance'],
          },
        })
      );
    });

    it('should handle archival failures', async () => {
      const mockThreat = {
        id: 'threat-1',
        feed_source: 'Source',
        title: 'Threat',
        url: 'https://example.com/threat',
        content: 'Content',
        published_at: 1640000000,
      };

      const env = createMockEnv();
      let callCount = 0;
      (env.DB.prepare as any).mockImplementation(() => ({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue(
            callCount++ === 0
              ? { success: true, results: [mockThreat] }
              : { success: true, results: [] }
          ),
          run: vi.fn().mockResolvedValue({ success: true }),
        }),
      }));

      (archiveThreat as any).mockResolvedValue({
        success: false,
        error: 'R2 write failed',
      });

      const result = await archiveOldThreats(env);

      expect(result.checked).toBe(1);
      expect(result.archived).toBe(0);
      expect(result.skipped).toBe(1);
      expect(result.errors).toContain('Failed to archive threat-1: R2 write failed');
    });

    it('should stop archiving when quota is exceeded', async () => {
      const mockThreats = [
        { id: 'threat-1', feed_source: 'Source', title: 'T1', url: 'https://example.com/1', content: 'C1', published_at: 1640000000 },
        { id: 'threat-2', feed_source: 'Source', title: 'T2', url: 'https://example.com/2', content: 'C2', published_at: 1640000000 },
      ];

      const env = createMockEnv();
      let callCount = 0;
      (env.DB.prepare as any).mockImplementation(() => ({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue(
            callCount++ === 0
              ? { success: true, results: mockThreats }
              : { success: true, results: [] }
          ),
          run: vi.fn().mockResolvedValue({ success: true }),
        }),
      }));

      // Archive fails with quota error
      (archiveThreat as any).mockResolvedValue({
        success: false,
        error: 'R2 quota exceeded',
      });

      const result = await archiveOldThreats(env);

      expect(result.checked).toBe(2);
      expect(result.quotaExceeded).toBe(true);
      // When quota is exceeded, the loop breaks immediately without incrementing skipped
      expect(result.skipped).toBe(0);
      // Should stop after first quota error
      expect(archiveThreat).toHaveBeenCalledTimes(1);
    });

    it('should handle D1 update failures', async () => {
      const mockThreat = {
        id: 'threat-1',
        feed_source: 'Source',
        title: 'Threat',
        url: 'https://example.com/threat',
        content: 'Content',
        published_at: 1640000000,
      };

      const env = createMockEnv();
      let callCount = 0;
      (env.DB.prepare as any).mockImplementation(() => ({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue(
            callCount++ === 0
              ? { success: true, results: [mockThreat] }
              : { success: true, results: [] }
          ),
          run: vi.fn().mockResolvedValue({ success: false }), // D1 update fails
        }),
      }));

      (archiveThreat as any).mockResolvedValue({
        success: true,
        r2Key: 'archived/threat-1.json',
      });

      const result = await archiveOldThreats(env);

      expect(result.checked).toBe(1);
      expect(result.archived).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.errors).toContain('Failed to update D1 for threat threat-1');
    });

    it('should handle database query failures', async () => {
      const env = createMockEnv();
      (env.DB.prepare as any).mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({ success: false }),
        }),
      });

      const result = await archiveOldThreats(env);

      expect(result.errors).toContain('Failed to query old threats from D1');
    });

    it('should handle fatal errors gracefully', async () => {
      const env = createMockEnv();
      (env.DB.prepare as any).mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const result = await archiveOldThreats(env);

      expect(result.errors).toContain('Database connection failed');
      expect(result.checked).toBe(0);
    });

    it('should check quota before and after archival', async () => {
      const mockThreat = {
        id: 'threat-1',
        feed_source: 'Source',
        title: 'Threat',
        url: 'https://example.com/threat',
        content: 'Content',
        published_at: 1640000000,
      };

      const env = createMockEnv();
      let callCount = 0;
      (env.DB.prepare as any).mockImplementation(() => ({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue(
            callCount++ === 0
              ? { success: true, results: [mockThreat] }
              : { success: true, results: [] }
          ),
          run: vi.fn().mockResolvedValue({ success: true }),
        }),
      }));

      (archiveThreat as any).mockResolvedValue({
        success: true,
        r2Key: 'archived/threat-1.json',
      });

      await archiveOldThreats(env);

      // Should check quota at start and end
      expect(getR2Usage).toHaveBeenCalledTimes(2);
      expect(logQuotaWarning).toHaveBeenCalledTimes(2);
    });

    it('should limit archival to MAX_ARCHIVE_PER_RUN', async () => {
      const env = createMockEnv();

      await archiveOldThreats(env);

      // Check that LIMIT clause is 100
      const prepareCall = (env.DB.prepare as any).mock.calls[0][0];
      expect(prepareCall).toContain('LIMIT ?');

      const bindCall = (env.DB.prepare as any).mock.results[0].value.bind.mock.calls[0];
      expect(bindCall[1]).toBe(100); // MAX_ARCHIVE_PER_RUN
    });
  });

  describe('restoreThreat()', () => {
    it('should restore archived threat successfully', async () => {
      const env = createMockEnv();

      // Mock D1 query for threat
      (env.DB.prepare as any).mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({
            r2_key: 'archived/2024/threat-1.json',
          }),
        }),
      });

      // Mock R2 retrieval
      (retrieveArchivedThreat as any).mockResolvedValue({
        id: 'threat-1',
        content: 'Archived content',
      });

      // Mock D1 update
      let callCount = 0;
      (env.DB.prepare as any).mockImplementation(() => ({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(
            callCount++ === 0 ? { r2_key: 'archived/2024/threat-1.json' } : null
          ),
          run: vi.fn().mockResolvedValue({ success: true }),
        }),
      }));

      const result = await restoreThreat(env, 'threat-1');

      expect(result).toBe(true);
      expect(retrieveArchivedThreat).toHaveBeenCalledWith(
        env,
        'archived/2024/threat-1.json'
      );
    });

    it('should return false when threat not found', async () => {
      const env = createMockEnv();

      (env.DB.prepare as any).mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null),
        }),
      });

      const result = await restoreThreat(env, 'nonexistent');

      expect(result).toBe(false);
      expect(retrieveArchivedThreat).not.toHaveBeenCalled();
    });

    it('should return false when threat not archived', async () => {
      const env = createMockEnv();

      (env.DB.prepare as any).mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({
            r2_key: null, // Not archived
          }),
        }),
      });

      const result = await restoreThreat(env, 'threat-1');

      expect(result).toBe(false);
    });

    it('should return false when R2 retrieval fails', async () => {
      const env = createMockEnv();

      (env.DB.prepare as any).mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({
            r2_key: 'archived/threat-1.json',
          }),
        }),
      });

      (retrieveArchivedThreat as any).mockResolvedValue(null);

      const result = await restoreThreat(env, 'threat-1');

      expect(result).toBe(false);
    });

    it('should return false when D1 update fails', async () => {
      const env = createMockEnv();

      let callCount = 0;
      (env.DB.prepare as any).mockImplementation(() => ({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(
            callCount++ === 0 ? { r2_key: 'archived/threat-1.json' } : null
          ),
          run: vi.fn().mockResolvedValue({ success: false }),
        }),
      }));

      (retrieveArchivedThreat as any).mockResolvedValue({
        content: 'Content',
      });

      const result = await restoreThreat(env, 'threat-1');

      expect(result).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      const env = createMockEnv();

      (env.DB.prepare as any).mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = await restoreThreat(env, 'threat-1');

      expect(result).toBe(false);
    });
  });

  describe('Integration Tests', () => {
    it('should archive multiple threats with IOCs', async () => {
      const mockThreats = [
        {
          id: 'threat-1',
          feed_source: 'Blog A',
          title: 'Threat 1',
          url: 'https://example.com/1',
          content: 'Content 1',
          published_at: 1640000000,
          tldr: 'Summary 1',
          category: 'malware',
          severity: 'high',
        },
        {
          id: 'threat-2',
          feed_source: 'Blog B',
          title: 'Threat 2',
          url: 'https://example.com/2',
          content: 'Content 2',
          published_at: 1640000000,
          tldr: 'Summary 2',
          category: 'phishing',
          severity: 'medium',
        },
      ];

      const env = createMockEnv();
      let queryCount = 0;

      (env.DB.prepare as any).mockImplementation(() => ({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({
            success: true,
            results: queryCount++ === 0 ? mockThreats : [],
          }),
          run: vi.fn().mockResolvedValue({ success: true }),
        }),
      }));

      (archiveThreat as any).mockResolvedValue({
        success: true,
        r2Key: 'archived/threat.json',
      });

      const result = await archiveOldThreats(env);

      expect(result.checked).toBe(2);
      expect(result.archived).toBe(2);
      expect(result.failed).toBe(0);
      expect(archiveThreat).toHaveBeenCalledTimes(2);
    });

    it('should handle mixed success and failure', async () => {
      const mockThreats = [
        {
          id: 'threat-success',
          feed_source: 'Source',
          title: 'Success',
          url: 'https://example.com/success',
          content: 'Content',
          published_at: 1640000000,
        },
        {
          id: 'threat-fail',
          feed_source: 'Source',
          title: 'Fail',
          url: 'https://example.com/fail',
          content: 'Content',
          published_at: 1640000000,
        },
      ];

      const env = createMockEnv();
      let queryCount = 0;
      const runMock = vi.fn()
        .mockResolvedValueOnce({ success: true })  // First threat update succeeds
        .mockResolvedValueOnce({ success: false }); // Second threat update fails

      (env.DB.prepare as any).mockImplementation(() => ({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({
            success: true,
            results: queryCount++ === 0 ? mockThreats : [],
          }),
          run: runMock,
        }),
      }));

      (archiveThreat as any)
        .mockResolvedValueOnce({ success: true, r2Key: 'archived/success.json' })
        .mockResolvedValueOnce({ success: true, r2Key: 'archived/fail.json' });

      const result = await archiveOldThreats(env);

      expect(result.checked).toBe(2);
      expect(result.archived).toBe(1);
      expect(result.failed).toBe(1);
    });
  });
});
