// API: Search threats (keyword + semantic)
import type { Env } from '../types';
import { semanticSearch } from '../utils/ai-processor';
import {
  securityMiddleware,
  wrapResponse,
  validateSearchQuery,
  validateOrigin,
  handleCORSPreflight,
  sanitizeSearchQuery,
} from '../utils/security';

// Simple hash function for cache keys
function hashQuery(query: string): string {
  let hash = 0;
  for (let i = 0; i < query.length; i++) {
    const char = query.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
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
  const url = new URL(request.url);
  const query = url.searchParams.get('q');
  const mode = url.searchParams.get('mode') || 'keyword'; // keyword or semantic

  // Security: Stricter rate limit for search (especially semantic mode which uses AI)
  const rateLimit = mode === 'semantic'
    ? { limit: 50, window: 600 } // 50 semantic searches per 10 minutes (AI intensive)
    : { limit: 100, window: 600 }; // 100 keyword searches per 10 minutes

  const securityCheck = await securityMiddleware(request, env, `search-${mode}`, {
    rateLimit,
    cacheMaxAge: 60, // Cache searches for 1 minute
    cachePrivacy: 'private', // Private because results depend on query
  });

  if (!securityCheck.allowed) {
    return securityCheck.response!;
  }

  // Security: Hard cap on limit to prevent resource exhaustion
  const requestedLimit = parseInt(url.searchParams.get('limit') || '20');
  const limit = Math.min(Math.max(requestedLimit, 1), 50); // Min 1, Max 50

  // Security: Validate and sanitize query
  if (!query) {
    const errorResponse = Response.json({ error: 'Query parameter "q" is required' }, { status: 400 });
    return wrapResponse(errorResponse, {
      cacheMaxAge: 0,
      cors: validatedOrigin ? { origin: validatedOrigin } : undefined,
    });
  }

  const validation = validateSearchQuery(query);
  if (!validation.valid) {
    const errorResponse = Response.json({ error: validation.error }, { status: 400 });
    return wrapResponse(errorResponse, {
      cacheMaxAge: 0,
      cors: validatedOrigin ? { origin: validatedOrigin } : undefined,
    });
  }

  // Enhanced sanitization to prevent injection attacks
  const sanitizedQuery = sanitizeSearchQuery(query);

  try {
    let threatIds: string[] = [];
    let cacheHit = false;

    if (mode === 'semantic') {
      // Check cache first to avoid AI inference on repeat queries
      const cacheKey = `search:semantic:${hashQuery(sanitizedQuery)}:limit:${limit}`;
      const cached = await env.CACHE.get(cacheKey);

      if (cached) {
        // Cache hit - use cached results
        const cachedResults = JSON.parse(cached);
        threatIds = cachedResults.map((r: any) => r.id);
        cacheHit = true;
        console.log(`Cache hit for semantic search: "${sanitizedQuery}" (${threatIds.length} results)`);
      } else {
        // Cache miss - perform semantic search using embeddings
        const results = await semanticSearch(env, sanitizedQuery, limit);
        threatIds = results.map((r) => r.id);

        // Cache the results for 5 minutes
        await env.CACHE.put(cacheKey, JSON.stringify(results), {
          expirationTtl: 300, // 5 minutes
        });
        console.log(`Cache miss for semantic search: "${sanitizedQuery}" (${threatIds.length} results cached)`);
      }

      if (threatIds.length === 0) {
        return Response.json({ threats: [], count: 0, mode: 'semantic', cached: cacheHit });
      }
    }

    // Build SQL query
    let sqlQuery = '';
    let params: any[] = [];

    if (mode === 'semantic' && threatIds.length > 0) {
      // Security: Validate threat IDs and enforce hard cap to prevent SQL injection via array manipulation
      if (threatIds.length > 50) {
        threatIds = threatIds.slice(0, 50); // Hard cap at 50 IDs
      }

      // Security: Validate all IDs match expected format (alphanumeric, 8-20 chars)
      // This prevents SQL injection even if the source is compromised
      const validIds = threatIds.filter(id =>
        typeof id === 'string' &&
        id.length >= 8 &&
        id.length <= 20 &&
        /^[a-z0-9]+$/i.test(id)
      );

      if (validIds.length === 0) {
        return Response.json({ threats: [], count: 0, mode: 'semantic', cached: cacheHit });
      }

      // Fetch threats by IDs from semantic search
      const placeholders = validIds.map(() => '?').join(',');
      sqlQuery = `
        SELECT
          t.*,
          s.tldr,
          s.key_points,
          s.category,
          s.severity,
          s.affected_sectors,
          s.threat_actors
        FROM threats t
        LEFT JOIN summaries s ON t.id = s.threat_id
        WHERE t.id IN (${placeholders})
        ORDER BY t.published_at DESC
      `;
      params = validIds;
    } else {
      // Keyword search - use sanitized query
      const searchTerm = `%${sanitizedQuery}%`;
      sqlQuery = `
        SELECT
          t.*,
          s.tldr,
          s.key_points,
          s.category,
          s.severity,
          s.affected_sectors,
          s.threat_actors
        FROM threats t
        LEFT JOIN summaries s ON t.id = s.threat_id
        WHERE t.title LIKE ? OR t.content LIKE ? OR s.tldr LIKE ?
        ORDER BY t.published_at DESC
        LIMIT ?
      `;
      params = [searchTerm, searchTerm, searchTerm, limit];
    }

    const result = await env.DB.prepare(sqlQuery).bind(...params).all();

    // Parse JSON fields
    const threats = result.results.map((row: any) => ({
      ...row,
      key_points: row.key_points ? JSON.parse(row.key_points) : [],
      affected_sectors: row.affected_sectors ? JSON.parse(row.affected_sectors) : [],
      threat_actors: row.threat_actors ? JSON.parse(row.threat_actors) : [],
    }));

    // Log search for analytics (async, don't block response)
    // Use sanitized query for logging
    const now = Math.floor(Date.now() / 1000);
    env.DB.prepare('INSERT INTO search_history (query, result_count, searched_at) VALUES (?, ?, ?)')
      .bind(sanitizedQuery, threats.length, now)
      .run()
      .catch(err => console.error('Failed to log search:', err));

    const response = Response.json({
      threats,
      count: threats.length,
      mode,
      query,
      cached: mode === 'semantic' ? cacheHit : undefined,
    });

    // Wrap response with security headers, CORS, and cache
    return wrapResponse(response, {
      rateLimit: {
        limit: rateLimit.limit,
        remaining: securityCheck.rateLimitInfo!.remaining,
        resetAt: securityCheck.rateLimitInfo!.resetAt,
      },
      cacheMaxAge: 60, // Cache for 1 minute
      cachePrivacy: 'private',
      cors: validatedOrigin ? { origin: validatedOrigin } : undefined,
    });
  } catch (error) {
    console.error('Error searching threats:', {
      error: error instanceof Error ? error.message : String(error),
      query,
      mode,
      stack: error instanceof Error ? error.stack : undefined,
    });
    const errorResponse = Response.json({ error: 'Search failed' }, { status: 500 });
    return wrapResponse(errorResponse, {
      cacheMaxAge: 0,
      cors: validatedOrigin ? { origin: validatedOrigin } : undefined,
    });
  }
};
