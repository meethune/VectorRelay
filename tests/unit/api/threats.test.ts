import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Env } from '../../../functions/types';

// Mock security middleware
vi.mock('../../../functions/utils/security', () => ({
  securityMiddleware: vi.fn(),
  wrapResponse: vi.fn((response: Response) => response),
  validateCategory: vi.fn((category: string) =>
    ['malware', 'phishing', 'ransomware', 'apt', 'vulnerability', 'exploit', 'other'].includes(category)
  ),
  validateSeverity: vi.fn((severity: string) =>
    ['critical', 'high', 'medium', 'low', 'info'].includes(severity)
  ),
}));

import { securityMiddleware, wrapResponse, validateCategory, validateSeverity } from '../../../functions/utils/security';
import { onRequestGet } from '../../../functions/api/threats';

describe('Threats API', () => {
  function createMockEnv(dbResults?: any): Env {
    return {
      DB: {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue(dbResults?.all || { results: [] }),
            first: vi.fn().mockResolvedValue(dbResults?.first || { total: 0 }),
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
    } as any;
  }

  function createMockRequest(params: Record<string, string> = {}): Request {
    const url = new URL('https://example.com/api/threats');
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    return new Request(url.toString());
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

  describe('GET /api/threats', () => {
    it('should return threats with default pagination', async () => {
      const mockThreats = [
        {
          id: 1,
          title: 'Test Threat 1',
          source: 'Blog A',
          published_at: 1700000000,
          tldr: 'Test TLDR',
          key_points: '["Point 1", "Point 2"]',
          category: 'malware',
          severity: 'high',
          affected_sectors: '["Finance"]',
          threat_actors: '["APT1"]',
        },
      ];

      const env = createMockEnv({
        all: { results: mockThreats },
        first: { total: 100 },
      });

      const request = createMockRequest();
      const response = await onRequestGet({ request, env } as any);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.threats).toHaveLength(1);
      expect(data.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 100,
        total_pages: 5,
      });
    });

    it('should parse JSON fields correctly', async () => {
      const mockThreat = {
        id: 1,
        title: 'Test Threat',
        key_points: '["Point 1", "Point 2", "Point 3"]',
        affected_sectors: '["Finance", "Healthcare"]',
        threat_actors: '["APT29", "APT28"]',
      };

      const env = createMockEnv({
        all: { results: [mockThreat] },
        first: { total: 1 },
      });

      const request = createMockRequest();
      const response = await onRequestGet({ request, env } as any);

      const data = await response.json();
      expect(data.threats[0].key_points).toEqual(['Point 1', 'Point 2', 'Point 3']);
      expect(data.threats[0].affected_sectors).toEqual(['Finance', 'Healthcare']);
      expect(data.threats[0].threat_actors).toEqual(['APT29', 'APT28']);
    });

    it('should handle null JSON fields', async () => {
      const mockThreat = {
        id: 1,
        title: 'Test Threat',
        key_points: null,
        affected_sectors: null,
        threat_actors: null,
      };

      const env = createMockEnv({
        all: { results: [mockThreat] },
        first: { total: 1 },
      });

      const request = createMockRequest();
      const response = await onRequestGet({ request, env } as any);

      const data = await response.json();
      expect(data.threats[0].key_points).toEqual([]);
      expect(data.threats[0].affected_sectors).toEqual([]);
      expect(data.threats[0].threat_actors).toEqual([]);
    });

    it('should respect pagination parameters', async () => {
      const env = createMockEnv({
        all: { results: [] },
        first: { total: 100 },
      });

      const request = createMockRequest({ page: '3', limit: '10' });
      await onRequestGet({ request, env } as any);

      expect(env.DB.prepare).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT ? OFFSET ?')
      );

      const bindCall = (env.DB.prepare as any).mock.results[0].value.bind;
      expect(bindCall).toHaveBeenCalledWith(10, 20); // limit 10, offset 20 (page 3)
    });

    it('should cap limit at 50', async () => {
      const env = createMockEnv({
        all: { results: [] },
        first: { total: 100 },
      });

      const request = createMockRequest({ limit: '100' });
      await onRequestGet({ request, env } as any);

      const bindCall = (env.DB.prepare as any).mock.results[0].value.bind;
      expect(bindCall).toHaveBeenCalledWith(50, 0); // capped at 50
    });

    it('should enforce minimum page of 1', async () => {
      const env = createMockEnv({
        all: { results: [] },
        first: { total: 100 },
      });

      const request = createMockRequest({ page: '0' });
      const response = await onRequestGet({ request, env } as any);

      const data = await response.json();
      expect(data.pagination.page).toBe(1);
    });

    it('should enforce minimum limit of 1', async () => {
      const env = createMockEnv({
        all: { results: [] },
        first: { total: 100 },
      });

      const request = createMockRequest({ limit: '0' });
      await onRequestGet({ request, env } as any);

      const bindCall = (env.DB.prepare as any).mock.results[0].value.bind;
      expect(bindCall).toHaveBeenCalledWith(1, 0); // minimum 1
    });

    it('should filter by category', async () => {
      const env = createMockEnv({
        all: { results: [] },
        first: { total: 10 },
      });

      const request = createMockRequest({ category: 'malware' });
      await onRequestGet({ request, env } as any);

      expect(env.DB.prepare).toHaveBeenCalledWith(
        expect.stringContaining('AND s.category = ?')
      );

      const bindCall = (env.DB.prepare as any).mock.results[0].value.bind;
      expect(bindCall).toHaveBeenCalledWith('malware', 20, 0);
    });

    it('should filter by severity', async () => {
      const env = createMockEnv({
        all: { results: [] },
        first: { total: 15 },
      });

      const request = createMockRequest({ severity: 'critical' });
      await onRequestGet({ request, env } as any);

      expect(env.DB.prepare).toHaveBeenCalledWith(
        expect.stringContaining('AND s.severity = ?')
      );

      const bindCall = (env.DB.prepare as any).mock.results[0].value.bind;
      expect(bindCall).toHaveBeenCalledWith('critical', 20, 0);
    });

    it('should filter by source', async () => {
      const env = createMockEnv({
        all: { results: [] },
        first: { total: 5 },
      });

      const request = createMockRequest({ source: 'Security Blog A' });
      await onRequestGet({ request, env } as any);

      expect(env.DB.prepare).toHaveBeenCalledWith(
        expect.stringContaining('AND t.source = ?')
      );

      const bindCall = (env.DB.prepare as any).mock.results[0].value.bind;
      expect(bindCall).toHaveBeenCalledWith('Security Blog A', 20, 0);
    });

    it('should combine multiple filters', async () => {
      const env = createMockEnv({
        all: { results: [] },
        first: { total: 3 },
      });

      const request = createMockRequest({
        category: 'ransomware',
        severity: 'high',
        source: 'Blog B',
      });
      await onRequestGet({ request, env } as any);

      const query = (env.DB.prepare as any).mock.calls[0][0];
      expect(query).toContain('AND s.category = ?');
      expect(query).toContain('AND s.severity = ?');
      expect(query).toContain('AND t.source = ?');

      const bindCall = (env.DB.prepare as any).mock.results[0].value.bind;
      expect(bindCall).toHaveBeenCalledWith('ransomware', 'high', 'Blog B', 20, 0);
    });

    it('should reject invalid category', async () => {
      const env = createMockEnv();
      const request = createMockRequest({ category: 'invalid-category' });

      const response = await onRequestGet({ request, env } as any);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid category value');
    });

    it('should reject invalid severity', async () => {
      const env = createMockEnv();
      const request = createMockRequest({ severity: 'invalid-severity' });

      const response = await onRequestGet({ request, env } as any);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid severity value');
    });

    it('should apply security middleware with rate limiting', async () => {
      const env = createMockEnv();
      const request = createMockRequest();

      await onRequestGet({ request, env } as any);

      expect(securityMiddleware).toHaveBeenCalledWith(request, env, 'threats', {
        rateLimit: { limit: 200, window: 600 },
        cacheMaxAge: 300,
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

    it('should wrap response with security headers', async () => {
      const env = createMockEnv({
        all: { results: [] },
        first: { total: 0 },
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

    it('should calculate total pages correctly', async () => {
      const env = createMockEnv({
        all: { results: [] },
        first: { total: 47 },
      });

      const request = createMockRequest({ limit: '10' });
      const response = await onRequestGet({ request, env } as any);

      const data = await response.json();
      expect(data.pagination.total_pages).toBe(5); // Math.ceil(47 / 10)
    });

    it('should handle empty results', async () => {
      const env = createMockEnv({
        all: { results: [] },
        first: { total: 0 },
      });

      const request = createMockRequest();
      const response = await onRequestGet({ request, env } as any);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.threats).toEqual([]);
      expect(data.pagination.total).toBe(0);
      expect(data.pagination.total_pages).toBe(0);
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
      expect(data.error).toBe('Failed to fetch threats');
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

    it('should not cache invalid parameter responses', async () => {
      const env = createMockEnv();
      const request = createMockRequest({ category: 'invalid' });

      await onRequestGet({ request, env } as any);

      expect(wrapResponse).toHaveBeenCalledWith(expect.any(Response), {
        cacheMaxAge: 0,
      });
    });

    it('should order threats by published_at DESC', async () => {
      const env = createMockEnv({
        all: { results: [] },
        first: { total: 0 },
      });

      const request = createMockRequest();
      await onRequestGet({ request, env } as any);

      expect(env.DB.prepare).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY t.published_at DESC')
      );
    });

    it('should handle large page numbers', async () => {
      const env = createMockEnv({
        all: { results: [] },
        first: { total: 1000 },
      });

      const request = createMockRequest({ page: '100', limit: '20' });
      const response = await onRequestGet({ request, env } as any);

      const data = await response.json();
      expect(data.pagination.page).toBe(100);

      const bindCall = (env.DB.prepare as any).mock.results[0].value.bind;
      expect(bindCall).toHaveBeenCalledWith(20, 1980); // offset = (100-1) * 20
    });
  });
});
