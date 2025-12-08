import { describe, it, expect } from 'vitest';
import {
  createJsonResponse,
  createErrorResponse,
  createSuccessResponse,
  createPaginatedResponse,
} from '../../../functions/utils/response-helper';

describe('Response Helper Utils', () => {
  describe('createJsonResponse()', () => {
    it('should create basic JSON response', async () => {
      const data = { message: 'Hello' };
      const response = createJsonResponse(data);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toContain('application/json');

      const body = await response.json();
      expect(body).toEqual(data);
    });

    it('should support custom status code', async () => {
      const response = createJsonResponse({ data: 'test' }, { status: 201 });

      expect(response.status).toBe(201);
    });

    it('should include security headers', () => {
      const response = createJsonResponse({ test: true });

      // Security headers from wrapResponse
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    });

    it('should add rate limit headers when provided', () => {
      const response = createJsonResponse(
        { data: 'test' },
        {
          rateLimit: {
            limit: 100,
            remaining: 95,
            resetAt: 1733672000,
          },
        }
      );

      expect(response.headers.get('X-RateLimit-Limit')).toBe('100');
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('95');
      expect(response.headers.get('X-RateLimit-Reset')).toBe('1733672000');
    });

    it('should add cache headers when provided', () => {
      const response = createJsonResponse(
        { data: 'test' },
        {
          cacheMaxAge: 300,
          cachePrivacy: 'public',
        }
      );

      expect(response.headers.get('Cache-Control')).toBe('public, max-age=300');
    });

    it('should add CORS headers when provided', () => {
      const response = createJsonResponse(
        { data: 'test' },
        {
          cors: {
            origin: 'https://example.com',
          },
        }
      );

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com');
    });

    it('should combine all options', () => {
      const now = Math.floor(Date.now() / 1000);
      const response = createJsonResponse(
        { data: 'test' },
        {
          status: 201,
          rateLimit: { limit: 100, remaining: 50, resetAt: now },
          cacheMaxAge: 600,
          cachePrivacy: 'private',
          cors: { origin: '*' },
        }
      );

      expect(response.status).toBe(201);
      expect(response.headers.get('X-RateLimit-Limit')).toBe('100');
      expect(response.headers.get('Cache-Control')).toBe('private, max-age=600');
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    });

    it('should handle complex data structures', async () => {
      const complexData = {
        threats: [
          { id: '1', title: 'Threat 1', severity: 'critical' },
          { id: '2', title: 'Threat 2', severity: 'high' },
        ],
        metadata: {
          total: 2,
          timestamp: new Date().toISOString(),
        },
      };

      const response = createJsonResponse(complexData);
      const body = await response.json();

      expect(body).toEqual(complexData);
    });

    it('should handle null data', async () => {
      const response = createJsonResponse(null);
      const body = await response.json();

      expect(body).toBeNull();
    });

    it('should handle empty object', async () => {
      const response = createJsonResponse({});
      const body = await response.json();

      expect(body).toEqual({});
    });

    it('should handle arrays', async () => {
      const data = [1, 2, 3, 4, 5];
      const response = createJsonResponse(data);
      const body = await response.json();

      expect(body).toEqual(data);
    });
  });

  describe('createErrorResponse()', () => {
    it('should create error response with default status 500', async () => {
      const response = createErrorResponse('Internal server error');

      expect(response.status).toBe(500);

      const body = await response.json();
      expect(body.error).toBe('Internal server error');
      expect(body.status).toBe(500);
    });

    it('should support custom status code', async () => {
      const response = createErrorResponse('Not found', 404);

      expect(response.status).toBe(404);

      const body = await response.json();
      expect(body.error).toBe('Not found');
      expect(body.status).toBe(404);
    });

    it('should include additional details', async () => {
      const response = createErrorResponse('Validation error', 400, {
        field: 'email',
        constraint: 'Invalid format',
      });

      const body = await response.json();
      expect(body.error).toBe('Validation error');
      expect(body.field).toBe('email');
      expect(body.constraint).toBe('Invalid format');
    });

    it('should include security headers', () => {
      const response = createErrorResponse('Error');

      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    });

    it('should handle 400 Bad Request', async () => {
      const response = createErrorResponse('Bad request', 400);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe('Bad request');
    });

    it('should handle 401 Unauthorized', async () => {
      const response = createErrorResponse('Unauthorized', 401);
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.error).toBe('Unauthorized');
    });

    it('should handle 403 Forbidden', async () => {
      const response = createErrorResponse('Forbidden', 403);
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body.error).toBe('Forbidden');
    });

    it('should handle 404 Not Found', async () => {
      const response = createErrorResponse('Not found', 404);
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error).toBe('Not found');
    });

    it('should handle 429 Too Many Requests', async () => {
      const response = createErrorResponse('Rate limit exceeded', 429);
      const body = await response.json();

      expect(response.status).toBe(429);
      expect(body.error).toBe('Rate limit exceeded');
    });

    it('should handle 500 Internal Server Error', async () => {
      const response = createErrorResponse('Internal error');
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toBe('Internal error');
    });

    it('should handle 503 Service Unavailable', async () => {
      const response = createErrorResponse('Service unavailable', 503);
      const body = await response.json();

      expect(response.status).toBe(503);
      expect(body.error).toBe('Service unavailable');
    });
  });

  describe('createSuccessResponse()', () => {
    it('should create 200 response', async () => {
      const data = { result: 'success' };
      const response = createSuccessResponse(data);

      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body).toEqual(data);
    });

    it('should support cache options', () => {
      const response = createSuccessResponse(
        { data: 'test' },
        { cacheMaxAge: 600 }
      );

      expect(response.status).toBe(200);
      expect(response.headers.get('Cache-Control')).toBe('public, max-age=600');
    });

    it('should support rate limit headers', () => {
      const response = createSuccessResponse(
        { data: 'test' },
        {
          rateLimit: { limit: 1000, remaining: 999, resetAt: Date.now() },
        }
      );

      expect(response.headers.get('X-RateLimit-Limit')).toBe('1000');
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('999');
    });

    it('should support CORS options', () => {
      const response = createSuccessResponse(
        { data: 'test' },
        { cors: { origin: 'https://app.example.com' } }
      );

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example.com');
    });

    it('should always return 200 regardless of other options', () => {
      const response = createSuccessResponse({ data: 'test' }, {
        cacheMaxAge: 300,
        rateLimit: { limit: 100, remaining: 50, resetAt: Date.now() },
      });

      expect(response.status).toBe(200);
    });
  });

  describe('createPaginatedResponse()', () => {
    it('should create paginated response with data and metadata', async () => {
      const items = [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
        { id: 3, name: 'Item 3' },
      ];

      const response = createPaginatedResponse(items, {
        page: 1,
        limit: 3,
        total: 10,
        totalPages: 4,
      });

      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.data).toEqual(items);
      expect(body.pagination).toEqual({
        page: 1,
        limit: 3,
        total: 10,
        totalPages: 4,
      });
    });

    it('should handle empty data array', async () => {
      const response = createPaginatedResponse([], {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
      });

      const body = await response.json();
      expect(body.data).toEqual([]);
      expect(body.pagination.total).toBe(0);
    });

    it('should handle first page', async () => {
      const items = Array.from({ length: 20 }, (_, i) => ({ id: i }));

      const response = createPaginatedResponse(items, {
        page: 1,
        limit: 20,
        total: 100,
        totalPages: 5,
      });

      const body = await response.json();
      expect(body.pagination.page).toBe(1);
      expect(body.data.length).toBe(20);
    });

    it('should handle last page', async () => {
      const items = Array.from({ length: 10 }, (_, i) => ({ id: i + 90 }));

      const response = createPaginatedResponse(items, {
        page: 5,
        limit: 20,
        total: 100,
        totalPages: 5,
      });

      const body = await response.json();
      expect(body.pagination.page).toBe(5);
      expect(body.data.length).toBe(10);
    });

    it('should support cache options', () => {
      const response = createPaginatedResponse(
        [{ id: 1 }],
        { page: 1, limit: 1, total: 1, totalPages: 1 },
        { cacheMaxAge: 120 }
      );

      expect(response.headers.get('Cache-Control')).toBe('public, max-age=120');
    });

    it('should support rate limit headers', () => {
      const response = createPaginatedResponse(
        [{ id: 1 }],
        { page: 1, limit: 1, total: 1, totalPages: 1 },
        { rateLimit: { limit: 50, remaining: 49, resetAt: Date.now() } }
      );

      expect(response.headers.get('X-RateLimit-Limit')).toBe('50');
    });

    it('should always return 200 status', () => {
      const response = createPaginatedResponse(
        [{ id: 1 }],
        { page: 1, limit: 1, total: 1, totalPages: 1 }
      );

      expect(response.status).toBe(200);
    });
  });

  describe('Integration Tests', () => {
    it('should handle full API response workflow - success', async () => {
      const data = {
        threats: [
          { id: '1', title: 'Threat 1', severity: 'critical' },
          { id: '2', title: 'Threat 2', severity: 'high' },
        ],
      };

      const response = createSuccessResponse(data, {
        cacheMaxAge: 300,
        rateLimit: {
          limit: 100,
          remaining: 95,
          resetAt: Math.floor(Date.now() / 1000) + 3600,
        },
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('Cache-Control')).toBeTruthy();
      expect(response.headers.get('X-RateLimit-Limit')).toBe('100');

      const body = await response.json();
      expect(body.threats).toHaveLength(2);
    });

    it('should handle full API response workflow - error', async () => {
      const response = createErrorResponse('Invalid request', 400, {
        validationErrors: ['Field "email" is required'],
      });

      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.error).toBe('Invalid request');
      expect(body.validationErrors).toEqual(['Field "email" is required']);
    });

    it('should handle pagination workflow', async () => {
      const threats = Array.from({ length: 20 }, (_, i) => ({
        id: `threat-${i}`,
        title: `Threat ${i}`,
      }));

      const response = createPaginatedResponse(
        threats,
        {
          page: 2,
          limit: 20,
          total: 150,
          totalPages: 8,
        },
        {
          cacheMaxAge: 600,
          cachePrivacy: 'public',
        }
      );

      const body = await response.json();
      expect(body.data).toHaveLength(20);
      expect(body.pagination.page).toBe(2);
      expect(body.pagination.totalPages).toBe(8);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large data payloads', async () => {
      const largeArray = Array.from({ length: 10000 }, (_, i) => ({ id: i }));
      const response = createJsonResponse(largeArray);

      const body = await response.json();
      expect(body).toHaveLength(10000);
    });

    it('should handle special characters in error messages', async () => {
      const response = createErrorResponse(
        'Error: "Invalid" <input> & special chars',
        400
      );

      const body = await response.json();
      expect(body.error).toContain('"Invalid"');
      expect(body.error).toContain('<input>');
      expect(body.error).toContain('&');
    });

    it('should handle unicode in responses', async () => {
      const response = createJsonResponse({
        message: '你好世界 🌍',
        emoji: '🔐🚀✨',
      });

      const body = await response.json();
      expect(body.message).toBe('你好世界 🌍');
      expect(body.emoji).toBe('🔐🚀✨');
    });

    it('should handle nested objects deeply', async () => {
      const deepData = {
        level1: {
          level2: {
            level3: {
              level4: {
                value: 'deep value',
              },
            },
          },
        },
      };

      const response = createJsonResponse(deepData);
      const body = await response.json();

      expect(body.level1.level2.level3.level4.value).toBe('deep value');
    });

    it('should handle pagination with zero total', async () => {
      const response = createPaginatedResponse([], {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
      });

      const body = await response.json();
      expect(body.data).toEqual([]);
      expect(body.pagination.total).toBe(0);
      expect(body.pagination.totalPages).toBe(0);
    });
  });
});
