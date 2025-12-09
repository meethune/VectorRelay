// API endpoint to fetch feed sources from the database
import type { PagesFunction } from '@cloudflare/workers-types';
import type { Env } from '../types';
import {
  securityMiddleware,
  wrapResponse,
  validateOrigin,
  handleCORSPreflight,
} from '../utils/security';

interface FeedSource {
  id: number;
  name: string;
  url: string;
  type: string;
  enabled: number;
}

// Handle CORS preflight requests
export const onRequestOptions: PagesFunction<Env> = async ({ request, env }) => {
  const requestOrigin = request.headers.get('Origin');
  const validatedOrigin = validateOrigin(requestOrigin, env);

  if (!validatedOrigin) {
    return new Response('Origin not allowed', { status: 403 });
  }

  return handleCORSPreflight(validatedOrigin);
};

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  // Validate CORS origin
  const requestOrigin = request.headers.get('Origin');
  const validatedOrigin = validateOrigin(requestOrigin, env);

  // Apply rate limiting and security checks
  const securityCheck = await securityMiddleware(request, env, 'sources', {
    rateLimit: { limit: 200, window: 600 }, // 200 requests per 10 minutes (same as /api/threats and /api/stats)
    cacheMaxAge: 300, // 5 minutes cache
  });

  // If rate limit exceeded, return error response
  if (!securityCheck.allowed) {
    return securityCheck.response!;
  }

  try {
    // Query all enabled feed sources from the database
    const result = await env.DB.prepare(
      'SELECT id, name, url, type, enabled FROM feed_sources WHERE enabled = 1 ORDER BY name ASC'
    ).all<FeedSource>();

    if (!result.success) {
      throw new Error('Failed to fetch feed sources');
    }

    const response = new Response(
      JSON.stringify({
        sources: result.results || [],
        count: result.results?.length || 0,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    // Apply security headers, CORS, rate limit headers, and cache headers
    return wrapResponse(response, {
      rateLimit: {
        limit: 200,
        remaining: securityCheck.rateLimitInfo!.remaining,
        resetAt: securityCheck.rateLimitInfo!.resetAt,
      },
      cacheMaxAge: 300, // 5 minutes
      cachePrivacy: 'public',
      cors: validatedOrigin ? { origin: validatedOrigin } : undefined,
    });
  } catch (error) {
    console.error('Error fetching sources:', error);
    const errorResponse = new Response(
      JSON.stringify({
        error: 'Failed to fetch sources',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );

    // Apply security headers to error response
    return wrapResponse(errorResponse, {
      cacheMaxAge: 0,
      cors: validatedOrigin ? { origin: validatedOrigin } : undefined,
    });
  }
};
