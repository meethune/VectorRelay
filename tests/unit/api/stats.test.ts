import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Env, DashboardStats } from '../../../functions/types';

// Mock security middleware
vi.mock('../../../functions/utils/security', () => ({
  securityMiddleware: vi.fn(),
  wrapResponse: vi.fn((response: Response) => response),
  validateOrigin: vi.fn((origin: string | null) => origin),
  handleCORSPreflight: vi.fn((origin: string) => new Response(null, { status: 204 })),
}));

import { securityMiddleware, wrapResponse } from '../../../functions/utils/security';
import { onRequestGet } from '../../../functions/api/stats';

describe('Stats API', () => {
  function createMockEnv(dbResults?: any): Env {
    return {
      DB: {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(dbResults?.first || null),
            all: vi.fn().mockResolvedValue(dbResults?.all || { results: [] }),
          }),
          first: vi.fn().mockResolvedValue(dbResults?.first || null),
          all: vi.fn().mockResolvedValue(dbResults?.all || { results: [] }),
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
    return new Request('https://example.com/api/stats');
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

  describe('GET /api/stats', () => {
    it('should return dashboard statistics successfully', async () => {
      const mockStats = {
        total: 1000,
        count: 50,
        category: 'malware',
        severity: 'high',
        source: 'Security Blog A',
      };

      const env = createMockEnv();

      // Mock different queries
      let queryCount = 0;
      (env.DB.prepare as any).mockImplementation(() => ({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(
            queryCount === 0 ? { total: 1000 } : { count: 50 }
          ),
          all: vi.fn().mockResolvedValue({
            results:
              queryCount < 3
                ? []
                : queryCount === 3
                ? [{ category: 'malware', count: 30 }, { category: 'phishing', count: 20 }]
                : queryCount === 4
                ? [{ severity: 'high', count: 25 }, { severity: 'critical', count: 15 }]
                : queryCount === 5
                ? [{ source: 'Blog A', count: 40 }, { source: 'Blog B', count: 10 }]
                : [
                    {
                      week_start: '2025-12-01',
                      key_insights: '["Insight 1", "Insight 2"]',
                      severity_distribution: '{"high": 10, "critical": 5}',
                    },
                  ],
          }),
        }),
        first: vi.fn().mockImplementation(() => {
          const result = queryCount === 0 ? { total: 1000 } : { count: 50 };
          queryCount++;
          return Promise.resolve(result);
        }),
        all: vi.fn().mockImplementation(() => {
          const results =
            queryCount === 3
              ? [{ category: 'malware', count: 30 }, { category: 'phishing', count: 20 }]
              : queryCount === 4
              ? [{ severity: 'high', count: 25 }, { severity: 'critical', count: 15 }]
              : queryCount === 5
              ? [{ source: 'Blog A', count: 40 }, { source: 'Blog B', count: 10 }]
              : [
                  {
                    week_start: '2025-12-01',
                    key_insights: '["Insight 1", "Insight 2"]',
                    severity_distribution: '{"high": 10, "critical": 5}',
                  },
                ];
          queryCount++;
          return Promise.resolve({ results });
        }),
      }));

      const request = createMockRequest();
      const response = await onRequestGet({ request, env } as any);

      expect(response.status).toBe(200);

      const data = (await response.json()) as DashboardStats;
      expect(data.total_threats).toBe(1000);
      expect(data.threats_today).toBe(50);
      expect(data.threats_this_week).toBe(50);
      expect(data.category_breakdown).toBeDefined();
      expect(data.severity_breakdown).toBeDefined();
      expect(data.top_sources).toBeDefined();
      expect(data.recent_trends).toBeDefined();
    });

    it('should return empty stats when database is empty', async () => {
      const env = createMockEnv();

      (env.DB.prepare as any).mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null),
          all: vi.fn().mockResolvedValue({ results: [] }),
        }),
        first: vi.fn().mockResolvedValue(null),
        all: vi.fn().mockResolvedValue({ results: [] }),
      });

      const request = createMockRequest();
      const response = await onRequestGet({ request, env } as any);

      expect(response.status).toBe(200);

      const data = (await response.json()) as DashboardStats;
      expect(data.total_threats).toBe(0);
      expect(data.threats_today).toBe(0);
      expect(data.threats_this_week).toBe(0);
      expect(data.category_breakdown).toEqual({});
      expect(data.severity_breakdown).toEqual({});
      expect(data.top_sources).toEqual([]);
    });

    it('should apply security middleware with rate limiting', async () => {
      const env = createMockEnv();
      const request = createMockRequest();

      await onRequestGet({ request, env } as any);

      expect(securityMiddleware).toHaveBeenCalledWith(request, env, 'stats', {
        rateLimit: { limit: 200, window: 600 },
        cacheMaxAge: 300,
        cachePrivacy: 'public',
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

    it('should wrap response with security headers', async () => {
      const env = createMockEnv();
      const request = createMockRequest();

      (env.DB.prepare as any).mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({ total: 100 }),
          all: vi.fn().mockResolvedValue({ results: [] }),
        }),
        first: vi.fn().mockResolvedValue({ total: 100 }),
        all: vi.fn().mockResolvedValue({ results: [] }),
      });

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

    it('should handle database errors gracefully', async () => {
      const env = createMockEnv();
      const request = createMockRequest();

      (env.DB.prepare as any).mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const response = await onRequestGet({ request, env } as any);

      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data.error).toBe('Failed to fetch statistics');
    });

    it('should parse category breakdown correctly', async () => {
      const env = createMockEnv();

      let queryCount = 0;
      (env.DB.prepare as any).mockImplementation(() => ({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({ total: 100 }),
          all: vi.fn().mockImplementation(() => {
            if (queryCount === 0) {
              queryCount++;
              return Promise.resolve({
                results: [
                  { category: 'malware', count: 50 },
                  { category: 'phishing', count: 30 },
                  { category: 'ransomware', count: 20 },
                ],
              });
            }
            queryCount++;
            return Promise.resolve({ results: [] });
          }),
        }),
        first: vi.fn().mockResolvedValue({ total: 100 }),
        all: vi.fn().mockImplementation(() => {
          if (queryCount === 0) {
            queryCount++;
            return Promise.resolve({
              results: [
                { category: 'malware', count: 50 },
                { category: 'phishing', count: 30 },
                { category: 'ransomware', count: 20 },
              ],
            });
          }
          queryCount++;
          return Promise.resolve({ results: [] });
        }),
      }));

      const request = createMockRequest();
      const response = await onRequestGet({ request, env } as any);

      const data = (await response.json()) as DashboardStats;
      expect(data.category_breakdown.malware).toBe(50);
      expect(data.category_breakdown.phishing).toBe(30);
      expect(data.category_breakdown.ransomware).toBe(20);
    });

    it('should parse severity breakdown correctly', async () => {
      const env = createMockEnv();

      let queryCount = 0;
      (env.DB.prepare as any).mockImplementation(() => ({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({ total: 100 }),
          all: vi.fn().mockImplementation(() => {
            if (queryCount === 0) {
              queryCount++;
              return Promise.resolve({ results: [] }); // categories
            } else if (queryCount === 1) {
              queryCount++;
              return Promise.resolve({
                results: [
                  { severity: 'critical', count: 25 },
                  { severity: 'high', count: 40 },
                  { severity: 'medium', count: 30 },
                  { severity: 'low', count: 5 },
                ],
              });
            }
            queryCount++;
            return Promise.resolve({ results: [] });
          }),
        }),
        first: vi.fn().mockResolvedValue({ total: 100 }),
        all: vi.fn().mockImplementation(() => {
          if (queryCount === 0) {
            queryCount++;
            return Promise.resolve({ results: [] });
          } else if (queryCount === 1) {
            queryCount++;
            return Promise.resolve({
              results: [
                { severity: 'critical', count: 25 },
                { severity: 'high', count: 40 },
                { severity: 'medium', count: 30 },
                { severity: 'low', count: 5 },
              ],
            });
          }
          queryCount++;
          return Promise.resolve({ results: [] });
        }),
      }));

      const request = createMockRequest();
      const response = await onRequestGet({ request, env } as any);

      const data = (await response.json()) as DashboardStats;
      expect(data.severity_breakdown.critical).toBe(25);
      expect(data.severity_breakdown.high).toBe(40);
      expect(data.severity_breakdown.medium).toBe(30);
      expect(data.severity_breakdown.low).toBe(5);
    });

    it('should return top sources correctly', async () => {
      const env = createMockEnv();

      let queryCount = 0;
      (env.DB.prepare as any).mockImplementation(() => ({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({ total: 100 }),
          all: vi.fn().mockImplementation(() => {
            if (queryCount === 0) {
              queryCount++;
              return Promise.resolve({ results: [] }); // categories
            } else if (queryCount === 1) {
              queryCount++;
              return Promise.resolve({ results: [] }); // severities
            } else if (queryCount === 2) {
              queryCount++;
              return Promise.resolve({
                results: [
                  { source: 'Security Blog A', count: 50 },
                  { source: 'Security Blog B', count: 30 },
                  { source: 'Security Blog C', count: 20 },
                ],
              });
            }
            queryCount++;
            return Promise.resolve({ results: [] });
          }),
        }),
        first: vi.fn().mockResolvedValue({ total: 100 }),
        all: vi.fn().mockImplementation(() => {
          if (queryCount < 2) {
            queryCount++;
            return Promise.resolve({ results: [] });
          } else if (queryCount === 2) {
            queryCount++;
            return Promise.resolve({
              results: [
                { source: 'Security Blog A', count: 50 },
                { source: 'Security Blog B', count: 30 },
                { source: 'Security Blog C', count: 20 },
              ],
            });
          }
          queryCount++;
          return Promise.resolve({ results: [] });
        }),
      }));

      const request = createMockRequest();
      const response = await onRequestGet({ request, env } as any);

      const data = (await response.json()) as DashboardStats;
      expect(data.top_sources).toHaveLength(3);
      expect(data.top_sources[0]).toEqual({ source: 'Security Blog A', count: 50 });
    });

    it('should parse recent trends with JSON fields', async () => {
      const env = createMockEnv();

      let queryCount = 0;
      (env.DB.prepare as any).mockImplementation(() => ({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({ total: 100 }),
          all: vi.fn().mockImplementation(() => {
            if (queryCount < 3) {
              queryCount++;
              return Promise.resolve({ results: [] });
            } else if (queryCount === 3) {
              queryCount++;
              return Promise.resolve({
                results: [
                  {
                    week_start: '2025-12-01',
                    key_insights: '["Ransomware spike", "APT activity"]',
                    severity_distribution: '{"critical": 10, "high": 25}',
                  },
                ],
              });
            }
            queryCount++;
            return Promise.resolve({ results: [] });
          }),
        }),
        first: vi.fn().mockResolvedValue({ total: 100 }),
        all: vi.fn().mockImplementation(() => {
          if (queryCount < 3) {
            queryCount++;
            return Promise.resolve({ results: [] });
          } else if (queryCount === 3) {
            queryCount++;
            return Promise.resolve({
              results: [
                {
                  week_start: '2025-12-01',
                  key_insights: '["Ransomware spike", "APT activity"]',
                  severity_distribution: '{"critical": 10, "high": 25}',
                },
              ],
            });
          }
          queryCount++;
          return Promise.resolve({ results: [] });
        }),
      }));

      const request = createMockRequest();
      const response = await onRequestGet({ request, env } as any);

      const data = (await response.json()) as DashboardStats;
      expect(data.recent_trends).toHaveLength(1);
      expect(data.recent_trends[0].key_insights).toEqual(['Ransomware spike', 'APT activity']);
      expect(data.recent_trends[0].severity_distribution).toEqual({ critical: 10, high: 25 });
    });

    it('should handle null JSON fields in trends', async () => {
      const env = createMockEnv();

      let queryCount = 0;
      (env.DB.prepare as any).mockImplementation(() => ({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({ total: 100 }),
          all: vi.fn().mockImplementation(() => {
            if (queryCount < 3) {
              queryCount++;
              return Promise.resolve({ results: [] });
            } else if (queryCount === 3) {
              queryCount++;
              return Promise.resolve({
                results: [
                  {
                    week_start: '2025-12-01',
                    key_insights: null,
                    severity_distribution: null,
                  },
                ],
              });
            }
            queryCount++;
            return Promise.resolve({ results: [] });
          }),
        }),
        first: vi.fn().mockResolvedValue({ total: 100 }),
        all: vi.fn().mockImplementation(() => {
          if (queryCount < 3) {
            queryCount++;
            return Promise.resolve({ results: [] });
          } else if (queryCount === 3) {
            queryCount++;
            return Promise.resolve({
              results: [
                {
                  week_start: '2025-12-01',
                  key_insights: null,
                  severity_distribution: null,
                },
              ],
            });
          }
          queryCount++;
          return Promise.resolve({ results: [] });
        }),
      }));

      const request = createMockRequest();
      const response = await onRequestGet({ request, env } as any);

      const data = (await response.json()) as DashboardStats;
      expect(data.recent_trends[0].key_insights).toEqual([]);
      expect(data.recent_trends[0].severity_distribution).toEqual({});
    });

    it('should not cache error responses', async () => {
      const env = createMockEnv();
      const request = createMockRequest();

      (env.DB.prepare as any).mockImplementation(() => {
        throw new Error('Database error');
      });

      await onRequestGet({ request, env } as any);

      expect(wrapResponse).toHaveBeenCalledWith(expect.any(Response), {
        cacheMaxAge: 0,
      });
    });
  });
});
