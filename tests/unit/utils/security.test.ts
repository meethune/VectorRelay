import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  checkRateLimit,
  getClientIP,
  addRateLimitHeaders,
  addSecurityHeaders,
  addCacheHeaders,
  addCORSHeaders,
  handleCORSPreflight,
  rateLimitExceededResponse,
  validateThreatId,
  validateSearchQuery,
  validateCategory,
  validateSeverity,
  sanitizeInput,
  securityMiddleware,
  wrapResponse,
} from '../../../functions/utils/security';
import type { Env } from '../../../functions/types';
import {
  MOCK_RATE_LIMIT_DATA_NEW,
  MOCK_RATE_LIMIT_DATA_ACTIVE,
  MOCK_RATE_LIMIT_DATA_EXPIRED,
  MOCK_RATE_LIMIT_DATA_AT_LIMIT,
  MOCK_REQUEST_WITH_CF_IP,
  MOCK_REQUEST_WITH_X_FORWARDED,
  MOCK_REQUEST_WITH_X_REAL_IP,
  MOCK_REQUEST_NO_IP,
  createMockRequest,
  createMockResponse,
  MOCK_JSON_RESPONSE,
  MOCK_HTML_RESPONSE,
  VALID_THREAT_IDS,
  INVALID_THREAT_IDS,
  VALID_SEARCH_QUERIES,
  INVALID_SEARCH_QUERIES,
  VALID_CATEGORIES,
  INVALID_CATEGORIES,
  VALID_SEVERITIES,
  INVALID_SEVERITIES,
  SANITIZATION_TEST_CASES,
} from '../../fixtures/security';

// Mock environment
function createMockEnv(kvData: any = null): Env {
  return {
    DB: {} as any,
    AI: {} as any,
    VECTORIZE_INDEX: {} as any,
    CACHE: {
      get: vi.fn().mockResolvedValue(kvData),
      put: vi.fn().mockResolvedValue(undefined),
    } as any,
    ANALYTICS: {} as any,
    THREAT_ARCHIVE: {} as any,
    ASSETS: {} as any,
    AI_GATEWAY_ID: 'test-gateway-id',
  };
}

describe('Security Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkRateLimit()', () => {
    it('should allow request and create new window when no data exists', async () => {
      const env = createMockEnv(MOCK_RATE_LIMIT_DATA_NEW);

      const result = await checkRateLimit(env, '203.0.113.1', 'test-endpoint', 10, 60);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9); // limit - 1
      expect(result.resetAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
      expect(env.CACHE.put).toHaveBeenCalled();
    });

    it('should allow request when window has expired', async () => {
      const env = createMockEnv(MOCK_RATE_LIMIT_DATA_EXPIRED);

      const result = await checkRateLimit(env, '203.0.113.1', 'test-endpoint', 10, 60);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
      expect(env.CACHE.put).toHaveBeenCalled();
    });

    it('should allow request and increment counter when under limit', async () => {
      const env = createMockEnv(MOCK_RATE_LIMIT_DATA_ACTIVE);

      const result = await checkRateLimit(env, '203.0.113.1', 'test-endpoint', 10, 60);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4); // 10 - 6 (current count is 5, incremented to 6)
      expect(env.CACHE.put).toHaveBeenCalled();
    });

    it('should deny request when rate limit is reached', async () => {
      const env = createMockEnv(MOCK_RATE_LIMIT_DATA_AT_LIMIT);

      const result = await checkRateLimit(env, '203.0.113.1', 'test-endpoint', 10, 60);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(env.CACHE.put).not.toHaveBeenCalled();
    });

    it('should fail open when KV throws error', async () => {
      const env = createMockEnv();
      env.CACHE.get = vi.fn().mockRejectedValue(new Error('KV error'));

      const result = await checkRateLimit(env, '203.0.113.1', 'test-endpoint', 10, 60);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(10);
    });

    it('should use correct KV key format', async () => {
      const env = createMockEnv(MOCK_RATE_LIMIT_DATA_NEW);

      await checkRateLimit(env, '203.0.113.1', 'api/threats', 10, 60);

      expect(env.CACHE.get).toHaveBeenCalledWith('ratelimit:api/threats:203.0.113.1', 'json');
    });

    it('should set correct TTL for new window', async () => {
      const env = createMockEnv(MOCK_RATE_LIMIT_DATA_NEW);

      await checkRateLimit(env, '203.0.113.1', 'test-endpoint', 10, 120);

      const putCall = (env.CACHE.put as any).mock.calls[0];
      expect(putCall[2]).toMatchObject({
        expirationTtl: 120,
      });
    });
  });

  describe('getClientIP()', () => {
    it('should extract IP from CF-Connecting-IP header', () => {
      const ip = getClientIP(MOCK_REQUEST_WITH_CF_IP);
      expect(ip).toBe('203.0.113.100');
    });

    it('should extract IP from X-Forwarded-For header when CF header missing', () => {
      const ip = getClientIP(MOCK_REQUEST_WITH_X_FORWARDED);
      expect(ip).toBe('203.0.113.101'); // First IP in the list
    });

    it('should extract IP from X-Real-IP header when others missing', () => {
      const ip = getClientIP(MOCK_REQUEST_WITH_X_REAL_IP);
      expect(ip).toBe('203.0.113.102');
    });

    it('should return "unknown" when no IP headers present', () => {
      const ip = getClientIP(MOCK_REQUEST_NO_IP);
      expect(ip).toBe('unknown');
    });

    it('should prioritize CF-Connecting-IP over other headers', () => {
      const request = createMockRequest({
        'CF-Connecting-IP': '203.0.113.100',
        'X-Forwarded-For': '203.0.113.101',
        'X-Real-IP': '203.0.113.102',
      });

      const ip = getClientIP(request);
      expect(ip).toBe('203.0.113.100');
    });

    it('should handle X-Forwarded-For with multiple IPs and whitespace', () => {
      const request = createMockRequest({
        'X-Forwarded-For': '  203.0.113.101  , 198.51.100.1, 192.0.2.1  ',
      });

      const ip = getClientIP(request);
      expect(ip).toBe('203.0.113.101');
    });
  });

  describe('addRateLimitHeaders()', () => {
    it('should add rate limit headers to response', () => {
      const response = createMockResponse();
      const now = Math.floor(Date.now() / 1000);

      const wrapped = addRateLimitHeaders(response, 100, 50, now + 60);

      expect(wrapped.headers.get('X-RateLimit-Limit')).toBe('100');
      expect(wrapped.headers.get('X-RateLimit-Remaining')).toBe('50');
      expect(wrapped.headers.get('X-RateLimit-Reset')).toBe((now + 60).toString());
    });

    it('should preserve existing headers', () => {
      const response = createMockResponse({}, {
        headers: { 'X-Custom-Header': 'test-value' },
      });

      const wrapped = addRateLimitHeaders(response, 100, 50, Date.now());

      expect(wrapped.headers.get('X-Custom-Header')).toBe('test-value');
      expect(wrapped.headers.get('Content-Type')).toBe('application/json');
    });
  });

  describe('rateLimitExceededResponse()', () => {
    it('should return 429 response with correct headers', async () => {
      const resetAt = Math.floor(Date.now() / 1000) + 60;
      const response = rateLimitExceededResponse(resetAt);

      expect(response.status).toBe(429);
      expect(response.headers.get('Content-Type')).toBe('application/json');
      expect(response.headers.get('Retry-After')).toBeTruthy();

      const body = await response.json();
      expect(body.error).toBe('Rate limit exceeded');
      expect(body.retryAfter).toBeGreaterThanOrEqual(0);
    });

    it('should handle negative retry-after values', async () => {
      const resetAt = Math.floor(Date.now() / 1000) - 10; // In the past
      const response = rateLimitExceededResponse(resetAt);

      const body = await response.json();
      expect(body.retryAfter).toBe(0);
    });
  });

  describe('addSecurityHeaders()', () => {
    it('should add all security headers to response', () => {
      const response = createMockResponse();
      const wrapped = addSecurityHeaders(response);

      expect(wrapped.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(wrapped.headers.get('X-Frame-Options')).toBe('DENY');
      expect(wrapped.headers.get('X-XSS-Protection')).toBe('1; mode=block');
      expect(wrapped.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
      expect(wrapped.headers.get('Permissions-Policy')).toBe('interest-cohort=()');
    });

    it('should add CSP header for JSON responses', () => {
      const response = createMockResponse();
      const wrapped = addSecurityHeaders(response);

      expect(wrapped.headers.get('Content-Security-Policy')).toBe("default-src 'none'");
    });

    it('should not add CSP header for HTML responses', () => {
      const wrapped = addSecurityHeaders(MOCK_HTML_RESPONSE);

      expect(wrapped.headers.get('Content-Security-Policy')).toBeNull();
    });
  });

  describe('addCacheHeaders()', () => {
    it('should add cache headers with public visibility', () => {
      const response = createMockResponse();
      const wrapped = addCacheHeaders(response, 300, 'public');

      expect(wrapped.headers.get('Cache-Control')).toBe('public, max-age=300');
    });

    it('should add cache headers with private visibility', () => {
      const response = createMockResponse();
      const wrapped = addCacheHeaders(response, 300, 'private');

      expect(wrapped.headers.get('Cache-Control')).toBe('private, max-age=300');
    });

    it('should default to public visibility when not specified', () => {
      const response = createMockResponse();
      const wrapped = addCacheHeaders(response, 300);

      expect(wrapped.headers.get('Cache-Control')).toBe('public, max-age=300');
    });

    it('should set no-cache headers when maxAge is 0', () => {
      const response = createMockResponse();
      const wrapped = addCacheHeaders(response, 0);

      expect(wrapped.headers.get('Cache-Control')).toBe('no-store, no-cache, must-revalidate');
    });

    it('should set no-cache headers when maxAge is negative', () => {
      const response = createMockResponse();
      const wrapped = addCacheHeaders(response, -1);

      expect(wrapped.headers.get('Cache-Control')).toBe('no-store, no-cache, must-revalidate');
    });
  });

  describe('addCORSHeaders()', () => {
    it('should add CORS headers with default values', () => {
      const response = createMockResponse();
      const wrapped = addCORSHeaders(response);

      expect(wrapped.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(wrapped.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, OPTIONS');
      expect(wrapped.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, Authorization');
      expect(wrapped.headers.get('Access-Control-Max-Age')).toBe('86400');
    });

    it('should add CORS headers with custom origin', () => {
      const response = createMockResponse();
      const wrapped = addCORSHeaders(response, 'https://example.com');

      expect(wrapped.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com');
    });

    it('should add CORS headers with custom methods', () => {
      const response = createMockResponse();
      const wrapped = addCORSHeaders(response, '*', 'GET, POST, PUT, DELETE');

      expect(wrapped.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, PUT, DELETE');
    });

    it('should add CORS headers with custom allowed headers', () => {
      const response = createMockResponse();
      const wrapped = addCORSHeaders(response, '*', 'GET, POST', 'Content-Type, X-API-Key');

      expect(wrapped.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, X-API-Key');
    });
  });

  describe('handleCORSPreflight()', () => {
    it('should return 204 response with CORS headers', () => {
      const response = handleCORSPreflight();

      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, OPTIONS');
    });

    it('should accept custom CORS configuration', () => {
      const response = handleCORSPreflight(
        'https://example.com',
        'GET, POST, PUT',
        'Content-Type, X-Custom-Header'
      );

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com');
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, PUT');
      expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, X-Custom-Header');
    });
  });

  describe('validateThreatId()', () => {
    it('should validate correct threat IDs', () => {
      VALID_THREAT_IDS.forEach(id => {
        expect(validateThreatId(id)).toBe(true);
      });
    });

    it('should reject invalid threat IDs', () => {
      INVALID_THREAT_IDS.forEach(id => {
        expect(validateThreatId(id)).toBe(false);
      });
    });
  });

  describe('validateSearchQuery()', () => {
    it('should validate correct search queries', () => {
      VALID_SEARCH_QUERIES.forEach(query => {
        const result = validateSearchQuery(query);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });
    });

    it('should reject empty search queries', () => {
      const result = validateSearchQuery('');
      expect(result.valid).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('should reject queries that are too long', () => {
      const longQuery = 'x'.repeat(501);
      const result = validateSearchQuery(longQuery);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('500 characters');
    });

    it('should reject non-string inputs', () => {
      const result = validateSearchQuery(null as any);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Query is required');
    });

    it('should accept whitespace-only queries as technically valid', () => {
      // Note: '   ' has 3 characters, so it passes minLength validation
      // The sanitizeInput function should be used separately to clean inputs
      const result = validateSearchQuery('   ');
      expect(result.valid).toBe(true);
    });
  });

  describe('validateCategory()', () => {
    it('should validate correct threat categories', () => {
      VALID_CATEGORIES.forEach(category => {
        expect(validateCategory(category)).toBe(true);
      });
    });

    it('should reject invalid threat categories', () => {
      INVALID_CATEGORIES.forEach(category => {
        expect(validateCategory(category)).toBe(false);
      });
    });

    it('should be case insensitive', () => {
      expect(validateCategory('RANSOMWARE')).toBe(true);
      expect(validateCategory('Phishing')).toBe(true);
      expect(validateCategory('apt')).toBe(true);
    });
  });

  describe('validateSeverity()', () => {
    it('should validate correct severity levels', () => {
      VALID_SEVERITIES.forEach(severity => {
        expect(validateSeverity(severity)).toBe(true);
      });
    });

    it('should reject invalid severity levels', () => {
      INVALID_SEVERITIES.forEach(severity => {
        expect(validateSeverity(severity)).toBe(false);
      });
    });

    it('should be case insensitive', () => {
      expect(validateSeverity('CRITICAL')).toBe(true);
      expect(validateSeverity('High')).toBe(true);
      expect(validateSeverity('medium')).toBe(true);
    });
  });

  describe('sanitizeInput()', () => {
    it('should sanitize inputs correctly', () => {
      SANITIZATION_TEST_CASES.forEach(testCase => {
        const result = sanitizeInput(testCase.input);
        expect(result).toBe(testCase.expected);
      });
    });
  });

  describe('securityMiddleware()', () => {
    it('should allow request when no rate limit configured', async () => {
      const env = createMockEnv();
      const request = createMockRequest();

      const result = await securityMiddleware(request, env, 'test-endpoint', {});

      expect(result.allowed).toBe(true);
      expect(result.response).toBeUndefined();
    });

    it('should check rate limit when configured', async () => {
      const env = createMockEnv(MOCK_RATE_LIMIT_DATA_ACTIVE);
      const request = MOCK_REQUEST_WITH_CF_IP;

      const result = await securityMiddleware(request, env, 'test-endpoint', {
        rateLimit: { limit: 10, window: 60 },
      });

      expect(result.allowed).toBe(true);
      expect(result.rateLimitInfo).toBeTruthy();
      expect(env.CACHE.get).toHaveBeenCalled();
    });

    it('should deny request when rate limit exceeded', async () => {
      const env = createMockEnv(MOCK_RATE_LIMIT_DATA_AT_LIMIT);
      const request = MOCK_REQUEST_WITH_CF_IP;

      const result = await securityMiddleware(request, env, 'test-endpoint', {
        rateLimit: { limit: 10, window: 60 },
      });

      expect(result.allowed).toBe(false);
      expect(result.response).toBeTruthy();
      expect(result.response?.status).toBe(429);
    });

    it('should add security headers to rate limit response', async () => {
      const env = createMockEnv(MOCK_RATE_LIMIT_DATA_AT_LIMIT);
      const request = MOCK_REQUEST_WITH_CF_IP;

      const result = await securityMiddleware(request, env, 'test-endpoint', {
        rateLimit: { limit: 10, window: 60 },
      });

      expect(result.response?.headers.get('X-Content-Type-Options')).toBe('nosniff');
    });
  });

  describe('wrapResponse()', () => {
    it('should add only security headers when no options provided', () => {
      const response = createMockResponse();
      const wrapped = wrapResponse(response);

      expect(wrapped.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(wrapped.headers.get('X-Frame-Options')).toBe('DENY');
    });

    it('should add rate limit headers when provided', () => {
      const response = createMockResponse();
      const wrapped = wrapResponse(response, {
        rateLimit: { limit: 100, remaining: 50, resetAt: Date.now() },
      });

      expect(wrapped.headers.get('X-RateLimit-Limit')).toBe('100');
      expect(wrapped.headers.get('X-RateLimit-Remaining')).toBe('50');
    });

    it('should add cache headers when provided', () => {
      const response = createMockResponse();
      const wrapped = wrapResponse(response, {
        cacheMaxAge: 300,
        cachePrivacy: 'private',
      });

      expect(wrapped.headers.get('Cache-Control')).toBe('private, max-age=300');
    });

    it('should add CORS headers when provided', () => {
      const response = createMockResponse();
      const wrapped = wrapResponse(response, {
        cors: { origin: 'https://example.com' },
      });

      expect(wrapped.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com');
    });

    it('should add all headers when all options provided', () => {
      const response = createMockResponse();
      const now = Math.floor(Date.now() / 1000);

      const wrapped = wrapResponse(response, {
        rateLimit: { limit: 100, remaining: 50, resetAt: now },
        cacheMaxAge: 300,
        cachePrivacy: 'public',
        cors: { origin: 'https://example.com' },
      });

      expect(wrapped.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(wrapped.headers.get('X-RateLimit-Limit')).toBe('100');
      expect(wrapped.headers.get('Cache-Control')).toBe('public, max-age=300');
      expect(wrapped.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com');
    });
  });
});
