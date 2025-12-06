// Security utilities for VectorRelay
// Includes rate limiting, security headers, and input validation

import type { Env } from '../types';

/**
 * Rate Limiting using KV
 *
 * Uses a sliding window algorithm with KV storage
 * Key format: ratelimit:{endpoint}:{ip}
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
    // Get current count from KV
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
    console.error('Rate limit check failed:', error);
    return {
      allowed: true,
      remaining: limit,
      resetAt: now + windowSeconds,
    };
  }
}

/**
 * Get client IP address from request
 */
export function getClientIP(request: Request): string {
  // Cloudflare sets CF-Connecting-IP header
  const cfIP = request.headers.get('CF-Connecting-IP');
  if (cfIP) return cfIP;

  // Fallback headers
  const xForwardedFor = request.headers.get('X-Forwarded-For');
  if (xForwardedFor) {
    return xForwardedFor.split(',')[0].trim();
  }

  const xRealIP = request.headers.get('X-Real-IP');
  if (xRealIP) return xRealIP;

  // Last resort - return placeholder
  return 'unknown';
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
export function addSecurityHeaders(response: Response): Response {
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

  // Content Security Policy for API responses
  // Only set for non-HTML responses to avoid breaking the frontend
  const contentType = headers.get('Content-Type');
  if (contentType && contentType.includes('application/json')) {
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
 * Input Validation
 */

/**
 * Validate threat ID format
 * Threat IDs are SHA-256 hashes (64 hex characters)
 */
export function validateThreatId(id: string): boolean {
  if (!id || typeof id !== 'string') return false;

  // Threat IDs should be 64 character hex strings (SHA-256)
  return /^[a-f0-9]{64}$/i.test(id);
}

/**
 * Validate search query
 */
export function validateSearchQuery(query: string): { valid: boolean; error?: string } {
  if (!query || typeof query !== 'string') {
    return { valid: false, error: 'Query is required' };
  }

  if (query.length < 1) {
    return { valid: false, error: 'Query must be at least 1 character' };
  }

  if (query.length > 500) {
    return { valid: false, error: 'Query must be 500 characters or less' };
  }

  return { valid: true };
}

/**
 * Validate enum values
 */
export function validateCategory(category: string): boolean {
  const validCategories = [
    'ransomware',
    'apt',
    'vulnerability',
    'phishing',
    'malware',
    'data_breach',
    'ddos',
    'supply_chain',
    'insider_threat',
    'other',
  ];

  return validCategories.includes(category);
}

export function validateSeverity(severity: string): boolean {
  const validSeverities = ['critical', 'high', 'medium', 'low', 'info'];
  return validSeverities.includes(severity);
}

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
 * Applies rate limiting, security headers, and cache headers
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
  // Check rate limit if configured
  if (options.rateLimit) {
    const ip = getClientIP(request);
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
  } = {}
): Response {
  let wrapped = response;

  // Add security headers
  wrapped = addSecurityHeaders(wrapped);

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
