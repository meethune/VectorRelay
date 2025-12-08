import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Env } from '../../../functions/types';

// Mock dependencies
vi.mock('../../../functions/utils/r2-storage', () => ({
  getR2Stats: vi.fn(),
}));

vi.mock('../../../functions/utils/archiver', () => ({
  archiveOldThreats: vi.fn(),
}));

vi.mock('../../../functions/utils/security', () => ({
  securityMiddleware: vi.fn(),
  wrapResponse: vi.fn((response: Response) => response),
}));

vi.mock('../../../functions/utils/auth', () => ({
  validateApiKey: vi.fn(),
  unauthorizedResponse: vi.fn(() => new Response('Unauthorized', { status: 401 })),
}));

import { getR2Stats } from '../../../functions/utils/r2-storage';
import { archiveOldThreats } from '../../../functions/utils/archiver';
import { securityMiddleware, wrapResponse } from '../../../functions/utils/security';
import { validateApiKey, unauthorizedResponse } from '../../../functions/utils/auth';
import { onRequestGet, onRequestPost } from '../../../functions/api/archive';

describe('Archive API', () => {
  function createMockEnv(overrides?: Partial<Env>): Env {
    return {
      DB: {
        prepare: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({ count: 0 }),
        }),
      } as any,
      AI: {} as any,
      VECTORIZE_INDEX: {} as any,
      CACHE: {} as any,
      ANALYTICS: {} as any,
      THREAT_ARCHIVE: {} as any,
      ASSETS: {} as any,
      AI_GATEWAY_ID: 'test-gateway-id',
      ENVIRONMENT: 'development',
      ...overrides,
    } as any;
  }

  function createMockRequest(method: string = 'GET'): Request {
    return new Request('https://example.com/api/archive', { method });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: security check passes
    (securityMiddleware as any).mockResolvedValue({
      allowed: true,
      rateLimitInfo: {
        remaining: 99,
        resetAt: Date.now() + 60000,
      },
    });
    // Default: R2 stats
    (getR2Stats as any).mockResolvedValue({
      objectCount: 100,
      totalSize: 50000000, // 50MB
      status: 'healthy',
      percentUsed: 0.5,
    });
  });

  describe('GET /api/archive', () => {
    it('should return archive statistics successfully', async () => {
      const env = createMockEnv();

      let callCount = 0;
      (env.DB.prepare as any).mockImplementation(() => ({
        first: vi.fn().mockResolvedValue(
          callCount++ === 0 ? { count: 50 } : { count: 200 }
        ),
      }));

      const request = createMockRequest();
      const response = await onRequestGet({ request, env } as any);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.r2).toBeDefined();
      expect(data.threats).toBeDefined();
      expect(data.threats.total).toBe(200);
      expect(data.threats.archived).toBe(50);
      expect(data.threats.active).toBe(150);
      expect(data.threats.archivePercent).toBe('25.0');
    });

    it('should return R2 stats from getR2Stats', async () => {
      (getR2Stats as any).mockResolvedValue({
        objectCount: 150,
        totalSize: 75000000,
        status: 'warning',
        percentUsed: 0.75,
      });

      const env = createMockEnv();
      const request = createMockRequest();
      const response = await onRequestGet({ request, env } as any);

      const data = await response.json();
      expect(data.r2.objectCount).toBe(150);
      expect(data.r2.totalSize).toBe(75000000);
      expect(data.r2.status).toBe('warning');
      expect(data.r2.percentUsed).toBe(0.75);
    });

    it('should handle zero threats gracefully', async () => {
      const env = createMockEnv();

      (env.DB.prepare as any).mockReturnValue({
        first: vi.fn().mockResolvedValue({ count: 0 }),
      });

      const request = createMockRequest();
      const response = await onRequestGet({ request, env } as any);

      const data = await response.json();
      expect(data.threats.total).toBe(0);
      expect(data.threats.archived).toBe(0);
      expect(data.threats.active).toBe(0);
      expect(data.threats.archivePercent).toBe('0.0');
    });

    it('should handle null database results', async () => {
      const env = createMockEnv();

      (env.DB.prepare as any).mockReturnValue({
        first: vi.fn().mockResolvedValue(null),
      });

      const request = createMockRequest();
      const response = await onRequestGet({ request, env } as any);

      const data = await response.json();
      expect(data.threats.total).toBe(0);
      expect(data.threats.archived).toBe(0);
    });

    it('should calculate archive percentage correctly', async () => {
      const env = createMockEnv();

      let callCount = 0;
      (env.DB.prepare as any).mockImplementation(() => ({
        first: vi.fn().mockResolvedValue(
          callCount++ === 0 ? { count: 75 } : { count: 100 }
        ),
      }));

      const request = createMockRequest();
      const response = await onRequestGet({ request, env } as any);

      const data = await response.json();
      expect(data.threats.archivePercent).toBe('75.0');
    });

    it('should apply security middleware with rate limiting', async () => {
      const env = createMockEnv();
      const request = createMockRequest();

      await onRequestGet({ request, env } as any);

      expect(securityMiddleware).toHaveBeenCalledWith(request, env, 'archive-stats', {
        rateLimit: { limit: 100, window: 600 },
        cacheMaxAge: 60,
        cachePrivacy: 'public',
      });
    });

    it('should return 429 when rate limit exceeded', async () => {
      (securityMiddleware as any).mockResolvedValue({
        allowed: false,
        response: new Response('Rate limit exceeded', { status: 429 }),
      });

      const env = createMockEnv();
      const request = createMockRequest();
      const response = await onRequestGet({ request, env } as any);

      expect(response.status).toBe(429);
    });

    it('should wrap response with cache headers', async () => {
      const env = createMockEnv();
      const request = createMockRequest();

      await onRequestGet({ request, env } as any);

      expect(wrapResponse).toHaveBeenCalledWith(
        expect.any(Response),
        expect.objectContaining({
          rateLimit: expect.objectContaining({
            limit: 100,
            remaining: 99,
          }),
          cacheMaxAge: 60,
          cachePrivacy: 'public',
        })
      );
    });

    it('should handle errors gracefully', async () => {
      (getR2Stats as any).mockRejectedValue(new Error('R2 connection failed'));

      const env = createMockEnv();
      const request = createMockRequest();
      const response = await onRequestGet({ request, env } as any);

      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data.error).toBe('Failed to get archive statistics');
      expect(data.message).toBe('R2 connection failed');
    });

    it('should not cache error responses', async () => {
      (getR2Stats as any).mockRejectedValue(new Error('Error'));

      const env = createMockEnv();
      const request = createMockRequest();
      await onRequestGet({ request, env } as any);

      expect(wrapResponse).toHaveBeenCalledWith(expect.any(Response), {
        cacheMaxAge: 0,
      });
    });
  });

  describe('POST /api/archive', () => {
    it('should return 403 in production environment', async () => {
      const env = createMockEnv({ ENVIRONMENT: 'production' });
      const request = createMockRequest('POST');

      const response = await onRequestPost({ request, env } as any);

      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data.error).toBe('Manual archival disabled in production');
      expect(data.message).toContain('automatically');
    });

    it('should require API key in development', async () => {
      (validateApiKey as any).mockReturnValue(false);

      const env = createMockEnv();
      const request = createMockRequest('POST');

      const response = await onRequestPost({ request, env } as any);

      expect(response.status).toBe(401);
      expect(validateApiKey).toHaveBeenCalledWith(request, env);
    });

    it('should trigger archival successfully with valid API key', async () => {
      (validateApiKey as any).mockReturnValue(true);
      (archiveOldThreats as any).mockResolvedValue({
        checked: 100,
        archived: 50,
        failed: 2,
        skipped: 48,
        quotaExceeded: false,
        errors: [],
      });

      const env = createMockEnv();
      const request = createMockRequest('POST');

      const response = await onRequestPost({ request, env } as any);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.stats.archived).toBe(50);
      expect(data.stats.failed).toBe(2);
      expect(data.stats.skipped).toBe(48);
      expect(data.message).toContain('Archived 50 threats');
    });

    it('should call archiveOldThreats with env', async () => {
      (validateApiKey as any).mockReturnValue(true);
      (archiveOldThreats as any).mockResolvedValue({
        checked: 0,
        archived: 0,
        failed: 0,
        skipped: 0,
        quotaExceeded: false,
        errors: [],
      });

      const env = createMockEnv();
      const request = createMockRequest('POST');

      await onRequestPost({ request, env } as any);

      expect(archiveOldThreats).toHaveBeenCalledWith(env);
    });

    it('should return archival statistics in response', async () => {
      (validateApiKey as any).mockReturnValue(true);
      (archiveOldThreats as any).mockResolvedValue({
        checked: 200,
        archived: 180,
        failed: 5,
        skipped: 15,
        quotaExceeded: false,
        errors: ['Error 1', 'Error 2'],
      });

      const env = createMockEnv();
      const request = createMockRequest('POST');

      const response = await onRequestPost({ request, env } as any);

      const data = await response.json();
      expect(data.stats.checked).toBe(200);
      expect(data.stats.archived).toBe(180);
      expect(data.stats.errors).toHaveLength(2);
    });

    it('should handle archival errors gracefully', async () => {
      (validateApiKey as any).mockReturnValue(true);
      (archiveOldThreats as any).mockRejectedValue(new Error('Archival process failed'));

      const env = createMockEnv();
      const request = createMockRequest('POST');

      const response = await onRequestPost({ request, env } as any);

      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data.error).toBe('Archival failed');
      expect(data.message).toBe('Archival process failed');
    });

    it('should handle quota exceeded scenario', async () => {
      (validateApiKey as any).mockReturnValue(true);
      (archiveOldThreats as any).mockResolvedValue({
        checked: 100,
        archived: 10,
        failed: 0,
        skipped: 90,
        quotaExceeded: true,
        errors: ['R2 quota at critical level'],
      });

      const env = createMockEnv();
      const request = createMockRequest('POST');

      const response = await onRequestPost({ request, env } as any);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.stats.quotaExceeded).toBe(true);
      expect(data.stats.skipped).toBe(90);
    });

    it('should work in staging environment', async () => {
      (validateApiKey as any).mockReturnValue(true);
      (archiveOldThreats as any).mockResolvedValue({
        checked: 50,
        archived: 50,
        failed: 0,
        skipped: 0,
        quotaExceeded: false,
        errors: [],
      });

      const env = createMockEnv({ ENVIRONMENT: 'staging' });
      const request = createMockRequest('POST');

      const response = await onRequestPost({ request, env } as any);

      expect(response.status).toBe(200);
      expect(archiveOldThreats).toHaveBeenCalled();
    });

    it('should work when ENVIRONMENT is undefined (default to dev)', async () => {
      (validateApiKey as any).mockReturnValue(true);
      (archiveOldThreats as any).mockResolvedValue({
        checked: 10,
        archived: 10,
        failed: 0,
        skipped: 0,
        quotaExceeded: false,
        errors: [],
      });

      const env = createMockEnv();
      delete (env as any).ENVIRONMENT;

      const request = createMockRequest('POST');

      const response = await onRequestPost({ request, env } as any);

      expect(response.status).toBe(200);
    });
  });
});
