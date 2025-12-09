import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Env } from '../../../functions/types';

// Mock security middleware
vi.mock('../../../functions/utils/security', () => ({
  securityMiddleware: vi.fn(),
  wrapResponse: vi.fn((response: Response) => response),
  validateOrigin: vi.fn((origin: string | null) => origin),
  handleCORSPreflight: vi.fn((origin: string) => new Response(null, { status: 204 })),
}));

import { securityMiddleware, wrapResponse } from '../../../functions/utils/security';
import { onRequestGet } from '../../../functions/api/sources';

describe('Sources API', () => {
  function createMockEnv(dbResults?: any): Env {
    return {
      DB: {
        prepare: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue(dbResults || { success: true, results: [] }),
        }),
      } as any,
      AI: {} as any,
      VECTORIZE_INDEX: {} as any,
      CACHE: {} as any,
      ANALYTICS: {} as any,
      THREAT_ARCHIVE: {} as any,
      ASSETS: {} as any,
      AI_GATEWAY_ID: 'test-gateway-id',
    } as any;
  }

  function createMockRequest(): Request {
    return new Request('https://example.com/api/sources');
  }

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: security check passes
    (securityMiddleware as any).mockResolvedValue({
      allowed: true,
      rateLimitInfo: {
        remaining: 199,
        resetAt: Date.now() + 60000,
      },
    });
  });

  describe('GET /api/sources', () => {
    it('should return feed sources successfully', async () => {
      const mockSources = [
        {
          id: 1,
          name: 'Security Blog A',
          url: 'https://securityblog.com/feed',
          type: 'rss',
          enabled: 1,
        },
        {
          id: 2,
          name: 'Security Blog B',
          url: 'https://anotherblog.com/atom',
          type: 'atom',
          enabled: 1,
        },
      ];

      const env = createMockEnv({
        success: true,
        results: mockSources,
      });

      const request = createMockRequest();
      const response = await onRequestGet({ request, env } as any);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.sources).toHaveLength(2);
      expect(data.count).toBe(2);
      expect(data.sources[0].name).toBe('Security Blog A');
      expect(data.sources[1].name).toBe('Security Blog B');
    });

    it('should return empty array when no sources exist', async () => {
      const env = createMockEnv({
        success: true,
        results: [],
      });

      const request = createMockRequest();
      const response = await onRequestGet({ request, env } as any);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.sources).toEqual([]);
      expect(data.count).toBe(0);
    });

    it('should query only enabled sources', async () => {
      const env = createMockEnv({
        success: true,
        results: [],
      });

      const request = createMockRequest();
      await onRequestGet({ request, env } as any);

      expect(env.DB.prepare).toHaveBeenCalledWith(
        'SELECT id, name, url, type, enabled FROM feed_sources WHERE enabled = 1 ORDER BY name ASC'
      );
    });

    it('should apply security middleware with rate limiting', async () => {
      const env = createMockEnv();
      const request = createMockRequest();

      await onRequestGet({ request, env } as any);

      expect(securityMiddleware).toHaveBeenCalledWith(request, env, 'sources', {
        rateLimit: { limit: 200, window: 600 },
        cacheMaxAge: 300,
      });
    });

    it('should return 429 when rate limit exceeded', async () => {
      const env = createMockEnv();
      const request = createMockRequest();

      (securityMiddleware as any).mockResolvedValue({
        allowed: false,
        response: new Response('Rate limit exceeded', { status: 429 }),
      });

      const response = await onRequestGet({ request, env } as any);

      expect(response.status).toBe(429);
    });

    it('should wrap response with security headers and cache', async () => {
      const env = createMockEnv({
        success: true,
        results: [],
      });

      const request = createMockRequest();
      await onRequestGet({ request, env } as any);

      expect(wrapResponse).toHaveBeenCalledWith(
        expect.any(Response),
        expect.objectContaining({
          rateLimit: expect.objectContaining({
            limit: 200,
            remaining: 199,
          }),
          cacheMaxAge: 300,
          cachePrivacy: 'public',
        })
      );
    });

    it('should handle database query failures', async () => {
      const env = createMockEnv({
        success: false,
      });

      const request = createMockRequest();
      const response = await onRequestGet({ request, env } as any);

      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data.error).toBe('Failed to fetch sources');
    });

    it('should handle database errors gracefully', async () => {
      const env = createMockEnv();

      (env.DB.prepare as any).mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const request = createMockRequest();
      const response = await onRequestGet({ request, env } as any);

      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data.error).toBe('Failed to fetch sources');
      expect(data.message).toBe('Database connection failed');
    });

    it('should not cache error responses', async () => {
      const env = createMockEnv();

      (env.DB.prepare as any).mockImplementation(() => {
        throw new Error('Database error');
      });

      const request = createMockRequest();
      await onRequestGet({ request, env } as any);

      expect(wrapResponse).toHaveBeenCalledWith(expect.any(Response), {
        cacheMaxAge: 0,
      });
    });

    it('should handle null results gracefully', async () => {
      const env = createMockEnv({
        success: true,
        results: null,
      });

      const request = createMockRequest();
      const response = await onRequestGet({ request, env } as any);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.sources).toEqual([]);
      expect(data.count).toBe(0);
    });

    it('should return sources ordered by name', async () => {
      const mockSources = [
        { id: 1, name: 'A Blog', url: 'https://a.com/feed', type: 'rss', enabled: 1 },
        { id: 2, name: 'B Blog', url: 'https://b.com/feed', type: 'rss', enabled: 1 },
        { id: 3, name: 'C Blog', url: 'https://c.com/feed', type: 'atom', enabled: 1 },
      ];

      const env = createMockEnv({
        success: true,
        results: mockSources,
      });

      const request = createMockRequest();
      const response = await onRequestGet({ request, env } as any);

      const data = await response.json();
      expect(data.sources[0].name).toBe('A Blog');
      expect(data.sources[1].name).toBe('B Blog');
      expect(data.sources[2].name).toBe('C Blog');
    });

    it('should return all source fields', async () => {
      const mockSource = {
        id: 1,
        name: 'Security Blog',
        url: 'https://example.com/feed',
        type: 'rss',
        enabled: 1,
      };

      const env = createMockEnv({
        success: true,
        results: [mockSource],
      });

      const request = createMockRequest();
      const response = await onRequestGet({ request, env } as any);

      const data = await response.json();
      const source = data.sources[0];
      expect(source.id).toBe(1);
      expect(source.name).toBe('Security Blog');
      expect(source.url).toBe('https://example.com/feed');
      expect(source.type).toBe('rss');
      expect(source.enabled).toBe(1);
    });

    it('should handle large number of sources', async () => {
      const mockSources = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        name: `Blog ${i + 1}`,
        url: `https://blog${i + 1}.com/feed`,
        type: i % 2 === 0 ? 'rss' : 'atom',
        enabled: 1,
      }));

      const env = createMockEnv({
        success: true,
        results: mockSources,
      });

      const request = createMockRequest();
      const response = await onRequestGet({ request, env } as any);

      const data = await response.json();
      expect(data.sources).toHaveLength(100);
      expect(data.count).toBe(100);
    });
  });
});
