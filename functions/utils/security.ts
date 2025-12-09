// Security utilities for VectorRelay
// Includes rate limiting, security headers, and input validation

import type { Env } from '../types';
import { THREAT_CATEGORIES, THREAT_SEVERITIES } from '../constants';
import { logError } from './logger';
import { createEnumValidator, createStringValidator } from './validation';

/**
 * Rate Limiting using KV
 *
 * Uses a sliding window algorithm with KV storage
 * Key format: ratelimit:{endpoint}:{ip}
 *
 * ⚠️ KNOWN LIMITATION - Race Condition:
 * This implementation has a read-modify-write race condition where concurrent
 * requests can bypass the rate limit. For example, if limit=10 and count=9,
 * two concurrent requests may both:
 * 1. Read count=9
 * 2. Increment to count=10
 * 3. Both succeed (11 total requests)
 *
 * This is acceptable for the current threat model (low-impact API abuse).
 * For production-critical rate limiting, use Durable Objects with atomic
 * operations (see Phase 3 TODO.md - Real-time Features).
 *
 * Mitigation: IP-based blocking for detected abuse patterns (see blockAbusiveIP)
 *
 * TODO (Phase 3): Replace with Durable Objects for atomic rate limiting
 * @see TODO.md Phase 3.1 - Real-time Features (Durable Objects)
 */
export async function checkRateLimit(
  env: Env,
  identifier: string, // IP address or user identifier
  endpoint: string,
  limit: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const now = Math.floor(Date.now() / 1000);
  const key = `ratelimit:${endpoint}:${identifier}`;

  try {
    // Get current count from KV (⚠️ race condition possible here)
    const data = await env.CACHE.get(key, 'json') as { count: number; resetAt: number } | null;

    if (!data || data.resetAt < now) {
      // No data or window expired - create new window
      const resetAt = now + windowSeconds;
      await env.CACHE.put(key, JSON.stringify({ count: 1, resetAt }), {
        expirationTtl: windowSeconds,
      });

      return {
        allowed: true,
        remaining: limit - 1,
        resetAt,
      };
    }

    // Window still active
    if (data.count >= limit) {
      // Rate limit exceeded
      return {
        allowed: false,
        remaining: 0,
        resetAt: data.resetAt,
      };
    }

    // Increment counter
    const newCount = data.count + 1;
    await env.CACHE.put(key, JSON.stringify({ count: newCount, resetAt: data.resetAt }), {
      expirationTtl: data.resetAt - now,
    });

    return {
      allowed: true,
      remaining: limit - newCount,
      resetAt: data.resetAt,
    };
  } catch (error) {
    // If rate limiting fails, allow the request (fail open)
    logError('Rate limit check failed', error, {
      endpoint,
      identifier,
    });
    return {
      allowed: true,
      remaining: limit,
      resetAt: now + windowSeconds,
    };
  }
}

/**
 * Get client IP address from request
 *
 * SECURITY: Only trusts CF-Connecting-IP set by Cloudflare.
 * X-Forwarded-For and X-Real-IP can be spoofed by attackers to bypass
 * IP-based rate limiting and blocking.
 *
 * For Cloudflare Workers/Pages, CF-Connecting-IP is always set and trusted.
 * If running outside Cloudflare, this will return 'unknown' - implement
 * alternative IP detection for non-Cloudflare deployments.
 */
export function getClientIP(request: Request): string {
  // ONLY trust CF-Connecting-IP (set by Cloudflare, cannot be spoofed)
  const cfIP = request.headers.get('CF-Connecting-IP');
  if (cfIP) {
    // Validate IP format (basic check)
    if (isValidIP(cfIP)) {
      return cfIP;
    }
  }

  // Return unknown if not on Cloudflare or invalid IP
  // Do NOT use X-Forwarded-For or X-Real-IP (can be spoofed)
  return 'unknown';
}

/**
 * Validate IP address format (IPv4 or IPv6)
 */
function isValidIP(ip: string): boolean {
  // IPv4: xxx.xxx.xxx.xxx
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  // IPv6: simplified check (full validation is complex)
  const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;

  if (ipv4Regex.test(ip)) {
    // Validate each octet is 0-255
    const octets = ip.split('.');
    return octets.every(octet => {
      const num = parseInt(octet, 10);
      return num >= 0 && num <= 255;
    });
  }

  return ipv6Regex.test(ip);
}

/**
 * Add rate limit headers to response
 */
export function addRateLimitHeaders(
  response: Response,
  limit: number,
  remaining: number,
  resetAt: number
): Response {
  const headers = new Headers(response.headers);
  headers.set('X-RateLimit-Limit', limit.toString());
  headers.set('X-RateLimit-Remaining', remaining.toString());
  headers.set('X-RateLimit-Reset', resetAt.toString());

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Create rate limit exceeded response
 */
export function rateLimitExceededResponse(resetAt: number): Response {
  const retryAfter = resetAt - Math.floor(Date.now() / 1000);

  return new Response(JSON.stringify({
    error: 'Rate limit exceeded',
    message: 'Too many requests. Please try again later.',
    retryAfter: retryAfter > 0 ? retryAfter : 0,
  }), {
    status: 429,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': retryAfter.toString(),
    },
  });
}

/**
 * Add security headers to response
 *
 * Implements OWASP recommended security headers
 */
export function addSecurityHeaders(response: Response, isHTML: boolean = false): Response {
  const headers = new Headers(response.headers);

  // Prevent MIME type sniffing
  headers.set('X-Content-Type-Options', 'nosniff');

  // Prevent clickjacking
  headers.set('X-Frame-Options', 'DENY');

  // Enable XSS protection (legacy browsers)
  headers.set('X-XSS-Protection', '1; mode=block');

  // Control referrer information
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Disable FLoC (privacy)
  headers.set('Permissions-Policy', 'interest-cohort=()');

  // Force HTTPS (HSTS) - 1 year, include subdomains
  headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

  // Modern isolation headers
  headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
  headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  headers.set('Cross-Origin-Resource-Policy', 'same-origin');

  // Content Security Policy
  const contentType = headers.get('Content-Type');
  if (isHTML || (contentType && contentType.includes('text/html'))) {
    // Comprehensive CSP for HTML responses
    headers.set('Content-Security-Policy',
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +  // TODO: Remove unsafe-inline/eval in production
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: https:; " +
      "font-src 'self' data:; " +
      "connect-src 'self' https://api.cloudflare.com; " +
      "frame-ancestors 'none'; " +
      "base-uri 'self'; " +
      "form-action 'self'"
    );
  } else if (contentType && contentType.includes('application/json')) {
    // Strict CSP for API responses
    headers.set('Content-Security-Policy', "default-src 'none'");
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Add cache headers to response
 */
export function addCacheHeaders(
  response: Response,
  maxAge: number,
  privacy: 'public' | 'private' = 'public'
): Response {
  const headers = new Headers(response.headers);

  if (maxAge > 0) {
    headers.set('Cache-Control', `${privacy}, max-age=${maxAge}`);
  } else {
    headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Allowed origins for CORS (configurable via environment)
 *
 * SECURITY: Never use wildcard '*' in production as it allows any site
 * to make requests and potentially exfiltrate data.
 *
 * Default allowlist for development. In production, set via environment variable:
 * ALLOWED_ORIGINS="https://yourdomain.com,https://app.yourdomain.com"
 */
const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5173',    // Vite dev server
  'http://localhost:8788',    // Wrangler dev
  'http://localhost:3000',    // Alternative dev port
];

/**
 * Validate origin against allowlist
 *
 * @param origin - The Origin header from the request
 * @param allowedOrigins - Array of allowed origins (optional, uses env.ALLOWED_ORIGINS or defaults)
 * @returns The validated origin or null if not allowed
 */
export function validateOrigin(origin: string | null, allowedOrigins?: string[]): string | null {
  if (!origin) return null;

  const allowed = allowedOrigins || DEFAULT_ALLOWED_ORIGINS;

  // Check if origin is in allowlist
  if (allowed.includes(origin)) {
    return origin;
  }

  return null;
}

/**
 * Add CORS headers to response
 *
 * SECURITY CHANGE: No longer accepts wildcard '*' by default.
 * Validates origin against allowlist before setting CORS headers.
 *
 * For public APIs that need to allow all origins, explicitly pass '*'
 * to the origin parameter, but understand the security implications:
 * - Any website can make requests to your API
 * - Cannot use credentials (cookies, auth headers) with wildcard
 * - Susceptible to CSRF attacks
 *
 * @param response - The response to add headers to
 * @param origin - Specific origin to allow, or '*' for wildcard (use with caution)
 * @param methods - Allowed HTTP methods
 * @param allowedHeaders - Allowed request headers
 */
export function addCORSHeaders(
  response: Response,
  origin: string,  // ⚠️ NO DEFAULT - must be explicit
  methods: string = 'GET, POST, OPTIONS',
  allowedHeaders: string = 'Content-Type, Authorization'
): Response {
  const headers = new Headers(response.headers);

  // Only set CORS headers if origin is provided
  if (origin) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Methods', methods);
    headers.set('Access-Control-Allow-Headers', allowedHeaders);
    headers.set('Access-Control-Max-Age', '86400'); // 24 hours

    // If using credentials, origin cannot be '*'
    if (origin !== '*') {
      headers.set('Access-Control-Allow-Credentials', 'true');
    }
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Handle CORS preflight requests (OPTIONS)
 *
 * SECURITY: Use validateOrigin() to check the request origin before calling this.
 *
 * Example usage in an API endpoint:
 *
 * export const onRequestOptions: PagesFunction<Env> = async ({ request }) => {
 *   const requestOrigin = request.headers.get('Origin');
 *   const validatedOrigin = validateOrigin(requestOrigin);
 *
 *   if (!validatedOrigin) {
 *     return new Response('Origin not allowed', { status: 403 });
 *   }
 *
 *   return handleCORSPreflight(validatedOrigin);
 * };
 *
 * export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
 *   const requestOrigin = request.headers.get('Origin');
 *   const validatedOrigin = validateOrigin(requestOrigin);
 *
 *   const response = Response.json({ data: 'example' });
 *   return wrapResponse(response, {
 *     cors: validatedOrigin ? { origin: validatedOrigin } : undefined,
 *     cacheMaxAge: 300
 *   });
 * };
 */
export function handleCORSPreflight(
  origin: string,  // ⚠️ NO DEFAULT - must be validated origin
  methods: string = 'GET, POST, OPTIONS',
  allowedHeaders: string = 'Content-Type, Authorization'
): Response {
  return addCORSHeaders(
    new Response(null, { status: 204 }),
    origin,
    methods,
    allowedHeaders
  );
}

/**
 * Input Validation
 */

/**
 * Validate threat ID format
 * Threat IDs are base36-encoded cyrb53 hashes (alphanumeric, typically 10-15 characters)
 */
export const validateThreatId = createStringValidator({
  minLength: 8,
  maxLength: 20,
  pattern: /^[a-z0-9]+$/i,
  fieldName: 'threat ID',
});

/**
 * Validate search query
 */
const searchQueryValidator = createStringValidator({
  minLength: 1,
  maxLength: 500,
  fieldName: 'search query',
});

export function validateSearchQuery(query: string): { valid: boolean; error?: string } {
  if (!query || typeof query !== 'string') {
    return { valid: false, error: 'Query is required' };
  }

  const isValid = searchQueryValidator(query);

  if (!isValid) {
    if (query.length < 1) {
      return { valid: false, error: 'Query must be at least 1 character' };
    }
    if (query.length > 500) {
      return { valid: false, error: 'Query must be 500 characters or less' };
    }
    return { valid: false, error: 'Invalid query format' };
  }

  return { valid: true };
}

/**
 * Validate enum values
 */
export const validateCategory = createEnumValidator(
  THREAT_CATEGORIES,
  'threat category',
  { caseSensitive: false }
);

export const validateSeverity = createEnumValidator(
  THREAT_SEVERITIES,
  'threat severity',
  { caseSensitive: false }
);

/**
 * Sanitize string input to prevent injection attacks
 * (Already using parameterized queries, but extra safety)
 */
export function sanitizeInput(input: string): string {
  // Remove null bytes
  let sanitized = input.replace(/\0/g, '');

  // Trim whitespace
  sanitized = sanitized.trim();

  return sanitized;
}

/**
 * Combined security middleware
 *
 * Applies IP blocking, rate limiting, security headers, and cache headers
 */
export async function securityMiddleware(
  request: Request,
  env: Env,
  endpoint: string,
  options: {
    rateLimit?: { limit: number; window: number };
    cacheMaxAge?: number;
    cachePrivacy?: 'public' | 'private';
  } = {}
): Promise<{ allowed: boolean; response?: Response; rateLimitInfo?: any }> {
  const ip = getClientIP(request);

  // Check if IP is blocked (highest priority)
  if (await isIPBlocked(env, ip)) {
    const response = blockedIPResponse('Your IP has been blocked for abuse');
    const secureResponse = addSecurityHeaders(response);

    return {
      allowed: false,
      response: secureResponse,
    };
  }

  // Check rate limit if configured
  if (options.rateLimit) {
    const rateLimitResult = await checkRateLimit(
      env,
      ip,
      endpoint,
      options.rateLimit.limit,
      options.rateLimit.window
    );

    if (!rateLimitResult.allowed) {
      const response = rateLimitExceededResponse(rateLimitResult.resetAt);
      const secureResponse = addSecurityHeaders(response);

      return {
        allowed: false,
        response: secureResponse,
      };
    }

    return {
      allowed: true,
      rateLimitInfo: rateLimitResult,
    };
  }

  return { allowed: true };
}

/**
 * Wrap response with all security enhancements
 */
export function wrapResponse(
  response: Response,
  options: {
    rateLimit?: { limit: number; remaining: number; resetAt: number };
    cacheMaxAge?: number;
    cachePrivacy?: 'public' | 'private';
    cors?: { origin?: string; methods?: string; allowedHeaders?: string };
  } = {}
): Response {
  let wrapped = response;

  // Add security headers
  wrapped = addSecurityHeaders(wrapped);

  // Add CORS headers if provided
  if (options.cors) {
    wrapped = addCORSHeaders(
      wrapped,
      options.cors.origin,
      options.cors.methods,
      options.cors.allowedHeaders
    );
  }

  // Add rate limit headers if provided
  if (options.rateLimit) {
    wrapped = addRateLimitHeaders(
      wrapped,
      options.rateLimit.limit,
      options.rateLimit.remaining,
      options.rateLimit.resetAt
    );
  }

  // Add cache headers if provided
  if (options.cacheMaxAge !== undefined) {
    wrapped = addCacheHeaders(
      wrapped,
      options.cacheMaxAge,
      options.cachePrivacy || 'public'
    );
  }

  return wrapped;
}

/**
 * IP Blocking for Abuse Prevention
 *
 * Temporarily or permanently block abusive IP addresses.
 * Uses KV storage with TTL for temporary blocks.
 *
 * Key format: blocklist:ip:{ip}
 */

/**
 * Check if IP is blocked
 *
 * @param env - Cloudflare environment
 * @param ip - IP address to check
 * @returns true if IP is blocked, false otherwise
 */
export async function isIPBlocked(env: Env, ip: string): Promise<boolean> {
  if (ip === 'unknown') return false; // Don't block unknown IPs

  const key = `blocklist:ip:${ip}`;

  try {
    const blocked = await env.CACHE.get(key);
    return blocked !== null;
  } catch (error) {
    logError('Failed to check IP blocklist', error, { ip });
    return false; // Fail open
  }
}

/**
 * Block an IP address
 *
 * @param env - Cloudflare environment
 * @param ip - IP address to block
 * @param durationSeconds - Block duration in seconds (0 = permanent until manual removal)
 * @param reason - Reason for blocking (for logging/auditing)
 */
export async function blockIP(
  env: Env,
  ip: string,
  durationSeconds: number = 3600,
  reason: string = 'abuse_detected'
): Promise<void> {
  if (ip === 'unknown') return; // Don't block unknown IPs

  const key = `blocklist:ip:${ip}`;
  const blockData = {
    ip,
    reason,
    blockedAt: Math.floor(Date.now() / 1000),
    expiresAt: durationSeconds > 0 ? Math.floor(Date.now() / 1000) + durationSeconds : null,
  };

  try {
    if (durationSeconds > 0) {
      // Temporary block with TTL
      await env.CACHE.put(key, JSON.stringify(blockData), {
        expirationTtl: durationSeconds,
      });
    } else {
      // Permanent block (no TTL - requires manual removal)
      await env.CACHE.put(key, JSON.stringify(blockData));
    }

    logError(`IP blocked: ${ip}`, new Error(reason), {
      ip,
      reason,
      durationSeconds,
      permanent: durationSeconds === 0,
    });
  } catch (error) {
    logError('Failed to block IP', error, { ip, reason });
  }
}

/**
 * Unblock an IP address
 *
 * @param env - Cloudflare environment
 * @param ip - IP address to unblock
 */
export async function unblockIP(env: Env, ip: string): Promise<void> {
  const key = `blocklist:ip:${ip}`;

  try {
    await env.CACHE.delete(key);
  } catch (error) {
    logError('Failed to unblock IP', error, { ip });
  }
}

/**
 * Create blocked response
 *
 * @param reason - Reason for blocking
 * @returns HTTP 403 Forbidden response
 */
export function blockedIPResponse(reason: string = 'IP blocked for abuse'): Response {
  return new Response(JSON.stringify({
    error: 'Access denied',
    message: reason,
  }), {
    status: 403,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
