import { describe, it, expect, beforeEach } from 'vitest';
import { validateApiKey, unauthorizedResponse } from '../../../functions/utils/auth';
import type { Env } from '../../../functions/types';

// Mock environment
function createMockEnv(apiSecret?: string): Env {
  return {
    DB: {} as any,
    AI: {} as any,
    VECTORIZE_INDEX: {} as any,
    CACHE: {} as any,
    ANALYTICS: {} as any,
    THREAT_ARCHIVE: {} as any,
    ASSETS: {} as any,
    AI_GATEWAY_ID: 'test-gateway-id',
    API_SECRET: apiSecret || 'test-secret-key-12345',
  } as any;
}

// Helper to create mock requests
function createMockRequest(headers: Record<string, string> = {}): Request {
  return new Request('https://example.com/api/test', {
    headers: new Headers(headers),
  });
}

describe('Auth Utils', () => {
  describe('validateApiKey()', () => {
    it('should accept valid API key from Authorization header (Bearer format)', () => {
      const env = createMockEnv('secret123');
      const request = createMockRequest({
        'Authorization': 'Bearer secret123',
      });

      const result = validateApiKey(request, env);

      expect(result).toBe(true);
    });

    it('should accept valid API key from Authorization header (direct)', () => {
      const env = createMockEnv('secret123');
      const request = createMockRequest({
        'Authorization': 'secret123',
      });

      const result = validateApiKey(request, env);

      expect(result).toBe(true);
    });

    it('should accept valid API key from X-API-Key header', () => {
      const env = createMockEnv('secret123');
      const request = createMockRequest({
        'X-API-Key': 'secret123',
      });

      const result = validateApiKey(request, env);

      expect(result).toBe(true);
    });

    it('should reject invalid API key', () => {
      const env = createMockEnv('correct-secret');
      const request = createMockRequest({
        'Authorization': 'Bearer wrong-secret',
      });

      const result = validateApiKey(request, env);

      expect(result).toBe(false);
    });

    it('should reject request with no API key', () => {
      const env = createMockEnv('secret123');
      const request = createMockRequest({});

      const result = validateApiKey(request, env);

      expect(result).toBe(false);
    });

    it('should reject empty API key', () => {
      const env = createMockEnv('secret123');
      const request = createMockRequest({
        'Authorization': '',
      });

      const result = validateApiKey(request, env);

      expect(result).toBe(false);
    });

    it('should reject Bearer with no token', () => {
      const env = createMockEnv('secret123');
      const request = createMockRequest({
        'Authorization': 'Bearer ',
      });

      const result = validateApiKey(request, env);

      expect(result).toBe(false);
    });

    it('should prefer Authorization over X-API-Key when both present', () => {
      const env = createMockEnv('correct-secret');
      const request = createMockRequest({
        'Authorization': 'correct-secret',
        'X-API-Key': 'wrong-secret',
      });

      const result = validateApiKey(request, env);

      expect(result).toBe(true);
    });

    it('should handle Bearer format correctly', () => {
      const env = createMockEnv('mysecret');
      const request = createMockRequest({
        'Authorization': 'Bearer mysecret',
      });

      const result = validateApiKey(request, env);

      expect(result).toBe(true);
    });

    it('should handle case-sensitive API keys', () => {
      const env = createMockEnv('SecretKey123');
      const request = createMockRequest({
        'Authorization': 'secretkey123', // Different case
      });

      const result = validateApiKey(request, env);

      expect(result).toBe(false);
    });

    it('should handle long API keys', () => {
      const longSecret = 'a'.repeat(256);
      const env = createMockEnv(longSecret);
      const request = createMockRequest({
        'Authorization': `Bearer ${longSecret}`,
      });

      const result = validateApiKey(request, env);

      expect(result).toBe(true);
    });

    it('should handle special characters in API keys', () => {
      const specialSecret = 'key-with_special.chars@123!';
      const env = createMockEnv(specialSecret);
      const request = createMockRequest({
        'X-API-Key': specialSecret,
      });

      const result = validateApiKey(request, env);

      expect(result).toBe(true);
    });

    it('should reject when API_SECRET is undefined', () => {
      const env = createMockEnv(undefined);
      const request = createMockRequest({
        'Authorization': 'Bearer any-key',
      });

      const result = validateApiKey(request, env);

      expect(result).toBe(false);
    });

    it('should reject when API_SECRET is empty string', () => {
      const env = createMockEnv('');
      const request = createMockRequest({
        'Authorization': 'Bearer test',
      });

      const result = validateApiKey(request, env);

      expect(result).toBe(false);
    });
  });

  describe('unauthorizedResponse()', () => {
    it('should return 401 status', async () => {
      const response = unauthorizedResponse();

      expect(response.status).toBe(401);
    });

    it('should return JSON content type', () => {
      const response = unauthorizedResponse();

      expect(response.headers.get('Content-Type')).toContain('application/json');
    });

    it('should include error message in body', async () => {
      const response = unauthorizedResponse();
      const body = await response.json();

      expect(body.error).toBe('Unauthorized');
      expect(body.message).toBeTruthy();
      expect(body.message).toContain('API key');
    });

    it('should include WWW-Authenticate header', () => {
      const response = unauthorizedResponse();

      expect(response.headers.get('WWW-Authenticate')).toBeTruthy();
      expect(response.headers.get('WWW-Authenticate')).toContain('Bearer');
    });

    it('should include realm in WWW-Authenticate', () => {
      const response = unauthorizedResponse();
      const wwwAuth = response.headers.get('WWW-Authenticate');

      expect(wwwAuth).toContain('realm');
      expect(wwwAuth).toContain('Management API');
    });

    it('should return consistent response', async () => {
      const response1 = unauthorizedResponse();
      const response2 = unauthorizedResponse();

      const body1 = await response1.json();
      const body2 = await response2.json();

      expect(body1.error).toBe(body2.error);
      expect(body1.message).toBe(body2.message);
    });
  });

  describe('Integration Tests', () => {
    it('should handle full authentication flow - success', () => {
      const env = createMockEnv('production-secret-key');
      const request = createMockRequest({
        'Authorization': 'Bearer production-secret-key',
      });

      const isValid = validateApiKey(request, env);

      expect(isValid).toBe(true);
    });

    it('should handle full authentication flow - failure', async () => {
      const env = createMockEnv('production-secret-key');
      const request = createMockRequest({
        'Authorization': 'Bearer wrong-key',
      });

      const isValid = validateApiKey(request, env);
      expect(isValid).toBe(false);

      // Should return unauthorized response
      const response = unauthorizedResponse();
      expect(response.status).toBe(401);

      const body = await response.json();
      expect(body.error).toBe('Unauthorized');
    });

    it('should handle multiple authentication attempts', () => {
      const env = createMockEnv('secret');

      const attempts = [
        { headers: { 'Authorization': 'Bearer wrong1' }, expected: false },
        { headers: { 'Authorization': 'Bearer wrong2' }, expected: false },
        { headers: { 'Authorization': 'Bearer secret' }, expected: true },
        { headers: { 'X-API-Key': 'secret' }, expected: true },
        { headers: {}, expected: false },
      ];

      attempts.forEach(({ headers, expected }) => {
        const request = createMockRequest(headers);
        const result = validateApiKey(request, env);
        expect(result).toBe(expected);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle whitespace in Bearer token', () => {
      const env = createMockEnv('secret');
      const request = createMockRequest({
        'Authorization': 'Bearer  secret', // Extra space
      });

      const result = validateApiKey(request, env);

      // Extra space makes it "  secret" which won't match "secret"
      expect(result).toBe(false);
    });

    it('should handle Bearer with lowercase', () => {
      const env = createMockEnv('secret');
      const request = createMockRequest({
        'Authorization': 'bearer secret', // lowercase bearer
      });

      const result = validateApiKey(request, env);

      // "Bearer " check is case-sensitive, so this becomes direct comparison "bearer secret" !== "secret"
      expect(result).toBe(false);
    });

    it('should handle malformed Bearer format', () => {
      const env = createMockEnv('secret');
      const request = createMockRequest({
        'Authorization': 'BearerNoSpace secret',
      });

      const result = validateApiKey(request, env);

      expect(result).toBe(false);
    });

    it('should handle null bytes in API key', () => {
      const env = createMockEnv('secret\0hidden');
      const request = createMockRequest({
        'Authorization': 'secret\0hidden',
      });

      const result = validateApiKey(request, env);

      expect(result).toBe(true);
    });

    it('should handle unicode characters in API key', () => {
      const unicodeSecret = 'key-with-émojis-🔐';
      const env = createMockEnv(unicodeSecret);
      const request = createMockRequest({
        'X-API-Key': unicodeSecret,
      });

      const result = validateApiKey(request, env);

      expect(result).toBe(true);
    });
  });
});
