/**
 * Security Test Fixtures
 *
 * Mock data for testing security functions
 */

import type { Env } from '../../functions/types';

// Mock KV data for rate limiting
export const MOCK_RATE_LIMIT_DATA_NEW = null;

export const MOCK_RATE_LIMIT_DATA_ACTIVE = {
  count: 5,
  resetAt: Math.floor(Date.now() / 1000) + 60, // 1 minute from now
};

export const MOCK_RATE_LIMIT_DATA_EXPIRED = {
  count: 10,
  resetAt: Math.floor(Date.now() / 1000) - 60, // 1 minute ago (expired)
};

export const MOCK_RATE_LIMIT_DATA_AT_LIMIT = {
  count: 10,
  resetAt: Math.floor(Date.now() / 1000) + 60,
};

export const MOCK_RATE_LIMIT_DATA_OVER_LIMIT = {
  count: 15,
  resetAt: Math.floor(Date.now() / 1000) + 60,
};

// Mock Request headers for IP extraction
export function createMockRequest(headers: Record<string, string> = {}): Request {
  return new Request('https://example.com/api/test', {
    headers: new Headers(headers),
  });
}

export const MOCK_REQUEST_WITH_CF_IP = createMockRequest({
  'CF-Connecting-IP': '203.0.113.100',
});

export const MOCK_REQUEST_WITH_X_FORWARDED = createMockRequest({
  'X-Forwarded-For': '203.0.113.101, 198.51.100.1',
});

export const MOCK_REQUEST_WITH_X_REAL_IP = createMockRequest({
  'X-Real-IP': '203.0.113.102',
});

export const MOCK_REQUEST_NO_IP = createMockRequest({});

// Mock Responses for header testing
export function createMockResponse(
  body: any = { success: true },
  options: {
    status?: number;
    statusText?: string;
    headers?: Record<string, string>;
  } = {}
): Response {
  return new Response(JSON.stringify(body), {
    status: options.status || 200,
    statusText: options.statusText || 'OK',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
}

export const MOCK_JSON_RESPONSE = createMockResponse();

export const MOCK_HTML_RESPONSE = new Response('<html><body>Test</body></html>', {
  status: 200,
  headers: { 'Content-Type': 'text/html' },
});

// Valid and invalid test inputs
export const VALID_THREAT_IDS = [
  '1a2b3c4d5e',
  'abcdef123456',
  'ZYXWVU987654',
  'test1234',
];

export const INVALID_THREAT_IDS = [
  '',                           // Empty
  'abc',                        // Too short
  'a'.repeat(25),              // Too long
  'test-id-123',               // Contains hyphen
  'test_id_123',               // Contains underscore
  'test id 123',               // Contains space
  'test@id',                   // Contains special char
  '../../etc/passwd',          // Path traversal attempt
];

export const VALID_SEARCH_QUERIES = [
  'ransomware',
  'APT28',
  'CVE-2024-1234',
  'malware attack on healthcare sector',
  'a',                         // Min length (1 char)
  'x'.repeat(500),            // Max length (500 chars)
];

export const INVALID_SEARCH_QUERIES = [
  '',                         // Empty string
  'x'.repeat(501),           // Too long (501 chars)
];

export const VALID_CATEGORIES = [
  'ransomware',
  'apt',
  'phishing',
  'malware',
  'zero_day',
  'RANSOMWARE',              // Case insensitive
  'Apt',                     // Mixed case
];

export const INVALID_CATEGORIES = [
  'invalid_category',
  'spam',
  'virus',
  '',
  'INVALID',
];

export const VALID_SEVERITIES = [
  'critical',
  'high',
  'medium',
  'low',
  'info',
  'CRITICAL',                // Case insensitive
  'High',                    // Mixed case
];

export const INVALID_SEVERITIES = [
  'extreme',
  'moderate',
  '',
  'unknown',
];

// Sanitization test cases
export const SANITIZATION_TEST_CASES = [
  {
    input: 'normal text',
    expected: 'normal text',
    description: 'Normal text unchanged',
  },
  {
    input: '  text with spaces  ',
    expected: 'text with spaces',
    description: 'Trim whitespace',
  },
  {
    input: 'text\0with\0nulls',
    expected: 'textwithnulls',
    description: 'Remove null bytes',
  },
  {
    input: '  \0\0text\0\0  ',
    expected: 'text',
    description: 'Remove nulls and trim',
  },
];
