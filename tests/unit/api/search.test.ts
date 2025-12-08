import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Env } from '../../../functions/types';

// Mock dependencies
vi.mock('../../../functions/utils/ai-processor', () => ({
  semanticSearch: vi.fn(),
}));

vi.mock('../../../functions/utils/security', () => ({
  securityMiddleware: vi.fn(),
  wrapResponse: vi.fn((response: Response) => response),
  validateSearchQuery: vi.fn((query: string) => {
    if (!query || query.length < 2) {
      return { valid: false, error: 'Query must be at least 2 characters' };
    }
    if (query.length > 200) {
      return { valid: false, error: 'Query must be less than 200 characters' };
    }
    return { valid: true };
  }),
}));

import { semanticSearch } from '../../../functions/utils/ai-processor';
import { securityMiddleware, wrapResponse, validateSearchQuery } from '../../../functions/utils/security';
import { onRequestGet } from '../../../functions/api/search';

describe('Search API', () => {
  function createMockEnv(dbResults?: any): Env {
    return {
      DB: {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue(dbResults?.all || { results: [] }),
            run: vi.fn().mockResolvedValue({}),
          }),
        }),
      } as any,
      AI: {} as any,
      VECTORIZE_INDEX: {} as any,
      CACHE: {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined),
      } as any,
      ANALYTICS: {} as any,
      THREAT_ARCHIVE: {} as any,
      ASSETS: {} as any,
      AI_GATEWAY_ID: 'test-gateway-id',
    } as any;
  }

  function createMockRequest(params: Record<string, string> = {}): Request {
    const url = new URL('https://example.com/api/search');
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
        remaining: 99,
        resetAt: Date.now() + 60000,
      },
    });
    // Default: semantic search returns empty
    (semanticSearch as any).mockResolvedValue([]);
  });

  describe('GET /api/search', () => {
    describe('Query Validation', () => {
      it('should require query parameter', async () => {
        const env = createMockEnv();
        const request = createMockRequest();

        const response = await onRequestGet({ request, env } as any);

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toBe('Query parameter "q" is required');
      });

      it('should validate query using validateSearchQuery', async () => {
        const env = createMockEnv();
        const request = createMockRequest({ q: 'a' });

        await onRequestGet({ request, env } as any);

        expect(validateSearchQuery).toHaveBeenCalledWith('a');
      });

      it('should reject invalid queries', async () => {
        const env = createMockEnv();
        const request = createMockRequest({ q: 'a' });

        const response = await onRequestGet({ request, env } as any);

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toBe('Query must be at least 2 characters');
      });

      it('should not cache invalid query responses', async () => {
        const env = createMockEnv();
        const request = createMockRequest({ q: 'a' });

        await onRequestGet({ request, env } as any);

        expect(wrapResponse).toHaveBeenCalledWith(expect.any(Response), {
          cacheMaxAge: 0,
        });
      });
    });

    describe('Keyword Search Mode', () => {
      it('should perform keyword search by default', async () => {
        const mockThreats = [
          {
            id: '1',
            title: 'Malware Alert',
            content: 'Test content',
            key_points: '["Point 1"]',
            affected_sectors: '["Finance"]',
            threat_actors: '["APT1"]',
          },
        ];

        const env = createMockEnv({
          all: { results: mockThreats },
        });

        const request = createMockRequest({ q: 'malware' });
        const response = await onRequestGet({ request, env } as any);

        expect(response.status).toBe(200);

        const data = await response.json();
        expect(data.mode).toBe('keyword');
        expect(data.threats).toHaveLength(1);
        expect(data.query).toBe('malware');
      });

      it('should search title, content, and tldr', async () => {
        const env = createMockEnv({
          all: { results: [] },
        });

        const request = createMockRequest({ q: 'ransomware' });
        await onRequestGet({ request, env } as any);

        expect(env.DB.prepare).toHaveBeenCalledWith(
          expect.stringContaining('WHERE t.title LIKE ? OR t.content LIKE ? OR s.tldr LIKE ?')
        );

        const bindCall = (env.DB.prepare as any).mock.results[0].value.bind;
        expect(bindCall).toHaveBeenCalledWith('%ransomware%', '%ransomware%', '%ransomware%', 20);
      });

      it('should apply limit to keyword search', async () => {
        const env = createMockEnv({
          all: { results: [] },
        });

        const request = createMockRequest({ q: 'test', limit: '10' });
        await onRequestGet({ request, env } as any);

        const bindCall = (env.DB.prepare as any).mock.results[0].value.bind;
        expect(bindCall).toHaveBeenCalledWith('%test%', '%test%', '%test%', 10);
      });

      it('should cap limit at 50', async () => {
        const env = createMockEnv({
          all: { results: [] },
        });

        const request = createMockRequest({ q: 'test', limit: '100' });
        await onRequestGet({ request, env } as any);

        const bindCall = (env.DB.prepare as any).mock.results[0].value.bind;
        expect(bindCall).toHaveBeenCalledWith('%test%', '%test%', '%test%', 50);
      });

      it('should apply different rate limit for keyword search', async () => {
        const env = createMockEnv();
        const request = createMockRequest({ q: 'test' });

        await onRequestGet({ request, env } as any);

        expect(securityMiddleware).toHaveBeenCalledWith(
          request,
          env,
          'search-keyword',
          expect.objectContaining({
            rateLimit: { limit: 100, window: 600 },
          })
        );
      });
    });

    describe('Semantic Search Mode', () => {
      it('should perform semantic search when mode=semantic', async () => {
        (semanticSearch as any).mockResolvedValue([
          { id: 'threat123', score: 0.95 },
          { id: 'threat456', score: 0.85 },
        ]);

        const mockThreats = [
          {
            id: 'threat123',
            title: 'APT Attack',
            key_points: '["Point 1"]',
            affected_sectors: '[]',
            threat_actors: '[]',
          },
          {
            id: 'threat456',
            title: 'Ransomware Campaign',
            key_points: '[]',
            affected_sectors: '[]',
            threat_actors: '[]',
          },
        ];

        const env = createMockEnv({
          all: { results: mockThreats },
        });

        const request = createMockRequest({ q: 'advanced persistent threat', mode: 'semantic' });
        const response = await onRequestGet({ request, env } as any);

        expect(response.status).toBe(200);
        expect(semanticSearch).toHaveBeenCalledWith(env, 'advanced persistent threat', 20);

        const data = await response.json();
        expect(data.mode).toBe('semantic');
        expect(data.threats).toHaveLength(2);
        expect(data.cached).toBe(false);
      });

      it('should use cache for semantic search', async () => {
        const cachedResults = [
          { id: 'threat789', score: 0.9 },
        ];

        const env = createMockEnv({
          all: {
            results: [
              {
                id: 'threat789',
                title: 'Cached Threat',
                key_points: '[]',
                affected_sectors: '[]',
                threat_actors: '[]',
              },
            ],
          },
        });

        (env.CACHE.get as any).mockResolvedValue(JSON.stringify(cachedResults));

        const request = createMockRequest({ q: 'cached query', mode: 'semantic' });
        const response = await onRequestGet({ request, env } as any);

        const data = await response.json();
        expect(data.cached).toBe(true);
        expect(semanticSearch).not.toHaveBeenCalled(); // Should use cache, not call AI
      });

      it('should cache semantic search results', async () => {
        (semanticSearch as any).mockResolvedValue([
          { id: 'threat123', score: 0.95 },
        ]);

        const env = createMockEnv({
          all: {
            results: [
              {
                id: 'threat123',
                title: 'Test',
                key_points: '[]',
                affected_sectors: '[]',
                threat_actors: '[]',
              },
            ],
          },
        });

        const request = createMockRequest({ q: 'test query', mode: 'semantic' });
        await onRequestGet({ request, env } as any);

        expect(env.CACHE.put).toHaveBeenCalledWith(
          expect.stringMatching(/^search:semantic:/),
          expect.any(String),
          { expirationTtl: 300 }
        );
      });

      it('should return empty results when semantic search finds nothing', async () => {
        (semanticSearch as any).mockResolvedValue([]);

        const env = createMockEnv();
        const request = createMockRequest({ q: 'nothing found', mode: 'semantic' });
        const response = await onRequestGet({ request, env } as any);

        const data = await response.json();
        expect(data.threats).toEqual([]);
        expect(data.count).toBe(0);
        expect(env.DB.prepare).not.toHaveBeenCalled(); // Should short-circuit
      });

      it('should validate threat IDs for semantic search', async () => {
        (semanticSearch as any).mockResolvedValue([
          { id: 'validid123', score: 0.95 },
          { id: 'invalid-id-with-dashes', score: 0.85 }, // Invalid: has dashes
          { id: 'short', score: 0.80 }, // Invalid: too short
          { id: 'a'.repeat(21), score: 0.75 }, // Invalid: too long
          { id: "'; DROP TABLE threats;--", score: 0.70 }, // Invalid: SQL injection attempt
        ]);

        const env = createMockEnv({
          all: { results: [] },
        });

        const request = createMockRequest({ q: 'test', mode: 'semantic' });
        await onRequestGet({ request, env } as any);

        const query = (env.DB.prepare as any).mock.calls[0][0];
        expect(query).toContain('WHERE t.id IN (?)'); // Only 1 valid ID
      });

      it('should cap semantic threat IDs at 50', async () => {
        const ids = Array.from({ length: 60 }, (_, i) => ({
          id: `validid${i.toString().padStart(3, '0')}`,
          score: 1.0 - i * 0.01,
        }));

        (semanticSearch as any).mockResolvedValue(ids);

        const env = createMockEnv({
          all: { results: [] },
        });

        const request = createMockRequest({ q: 'test', mode: 'semantic' });
        await onRequestGet({ request, env } as any);

        const query = (env.DB.prepare as any).mock.calls[0][0];
        const placeholders = query.match(/\?/g);
        expect(placeholders).toHaveLength(50); // Capped at 50
      });

      it('should apply stricter rate limit for semantic search', async () => {
        const env = createMockEnv();
        const request = createMockRequest({ q: 'test', mode: 'semantic' });

        await onRequestGet({ request, env } as any);

        expect(securityMiddleware).toHaveBeenCalledWith(
          request,
          env,
          'search-semantic',
          expect.objectContaining({
            rateLimit: { limit: 50, window: 600 },
          })
        );
      });
    });

    describe('Response Parsing', () => {
      it('should parse JSON fields', async () => {
        const mockThreat = {
          id: '1',
          title: 'Test',
          key_points: '["Point 1", "Point 2"]',
          affected_sectors: '["Finance", "Healthcare"]',
          threat_actors: '["APT29"]',
        };

        const env = createMockEnv({
          all: { results: [mockThreat] },
        });

        const request = createMockRequest({ q: 'test' });
        const response = await onRequestGet({ request, env } as any);

        const data = await response.json();
        expect(data.threats[0].key_points).toEqual(['Point 1', 'Point 2']);
        expect(data.threats[0].affected_sectors).toEqual(['Finance', 'Healthcare']);
        expect(data.threats[0].threat_actors).toEqual(['APT29']);
      });

      it('should handle null JSON fields', async () => {
        const mockThreat = {
          id: '1',
          title: 'Test',
          key_points: null,
          affected_sectors: null,
          threat_actors: null,
        };

        const env = createMockEnv({
          all: { results: [mockThreat] },
        });

        const request = createMockRequest({ q: 'test' });
        const response = await onRequestGet({ request, env } as any);

        const data = await response.json();
        expect(data.threats[0].key_points).toEqual([]);
        expect(data.threats[0].affected_sectors).toEqual([]);
        expect(data.threats[0].threat_actors).toEqual([]);
      });
    });

    describe('Search History Logging', () => {
      it('should log search to history', async () => {
        const env = createMockEnv({
          all: { results: [] },
        });

        const request = createMockRequest({ q: 'test query' });
        await onRequestGet({ request, env } as any);

        // Should be called twice: once for main query, once for history logging
        expect(env.DB.prepare).toHaveBeenCalledWith(
          'INSERT INTO search_history (query, result_count, searched_at) VALUES (?, ?, ?)'
        );
      });

      it('should not block response on logging failure', async () => {
        const env = createMockEnv({
          all: { results: [] },
        });

        // Make logging fail
        const mockRun = vi.fn().mockRejectedValue(new Error('Logging failed'));
        (env.DB.prepare as any).mockImplementation((query: string) => {
          if (query.includes('INSERT INTO search_history')) {
            return { bind: vi.fn().mockReturnValue({ run: mockRun }) };
          }
          return {
            bind: vi.fn().mockReturnValue({
              all: vi.fn().mockResolvedValue({ results: [] }),
            }),
          };
        });

        const request = createMockRequest({ q: 'test' });
        const response = await onRequestGet({ request, env } as any);

        expect(response.status).toBe(200); // Should still succeed
      });
    });

    describe('Rate Limiting and Caching', () => {
      it('should return 429 when rate limit exceeded', async () => {
        (securityMiddleware as any).mockResolvedValue({
          allowed: false,
          response: new Response('Rate limit exceeded', { status: 429 }),
        });

        const env = createMockEnv();
        const request = createMockRequest({ q: 'test' });
        const response = await onRequestGet({ request, env } as any);

        expect(response.status).toBe(429);
      });

      it('should wrap response with security headers', async () => {
        const env = createMockEnv({
          all: { results: [] },
        });

        const request = createMockRequest({ q: 'test' });
        await onRequestGet({ request, env } as any);

        expect(wrapResponse).toHaveBeenCalledWith(
          expect.any(Response),
          expect.objectContaining({
            rateLimit: expect.objectContaining({
              limit: 100,
              remaining: 99,
            }),
            cacheMaxAge: 60,
            cachePrivacy: 'private',
          })
        );
      });
    });

    describe('Error Handling', () => {
      it('should handle database errors gracefully', async () => {
        const env = createMockEnv();
        (env.DB.prepare as any).mockImplementation(() => {
          throw new Error('Database connection failed');
        });

        const request = createMockRequest({ q: 'test' });
        const response = await onRequestGet({ request, env } as any);

        expect(response.status).toBe(500);

        const data = await response.json();
        expect(data.error).toBe('Search failed');
      });

      it('should handle semantic search errors gracefully', async () => {
        (semanticSearch as any).mockRejectedValue(new Error('AI service unavailable'));

        const env = createMockEnv();
        const request = createMockRequest({ q: 'test', mode: 'semantic' });
        const response = await onRequestGet({ request, env } as any);

        expect(response.status).toBe(500);

        const data = await response.json();
        expect(data.error).toBe('Search failed');
      });

      it('should not cache error responses', async () => {
        const env = createMockEnv();
        (env.DB.prepare as any).mockImplementation(() => {
          throw new Error('Database error');
        });

        const request = createMockRequest({ q: 'test' });
        await onRequestGet({ request, env } as any);

        expect(wrapResponse).toHaveBeenCalledWith(expect.any(Response), {
          cacheMaxAge: 0,
        });
      });
    });
  });
});
