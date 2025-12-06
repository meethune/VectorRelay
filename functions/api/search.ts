// API: Search threats (keyword + semantic)
import type { Env } from '../types';
import { semanticSearch } from '../utils/ai-processor';
import { securityMiddleware, wrapResponse, validateSearchQuery } from '../utils/security';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
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

  // Security: Validate query using utility
  if (!query) {
    const errorResponse = Response.json({ error: 'Query parameter "q" is required' }, { status: 400 });
    return wrapResponse(errorResponse, { cacheMaxAge: 0 });
  }

  const validation = validateSearchQuery(query);
  if (!validation.valid) {
    const errorResponse = Response.json({ error: validation.error }, { status: 400 });
    return wrapResponse(errorResponse, { cacheMaxAge: 0 });
  }

  try {
    let threatIds: string[] = [];

    if (mode === 'semantic') {
      // Semantic search using embeddings
      const results = await semanticSearch(env, query, limit);
      threatIds = results.map((r) => r.id);

      if (threatIds.length === 0) {
        return Response.json({ threats: [], count: 0, mode: 'semantic' });
      }
    }

    // Build SQL query
    let sqlQuery = '';
    let params: any[] = [];

    if (mode === 'semantic' && threatIds.length > 0) {
      // Fetch threats by IDs from semantic search
      const placeholders = threatIds.map(() => '?').join(',');
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
      params = threatIds;
    } else {
      // Keyword search
      const searchTerm = `%${query}%`;
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
    const now = Math.floor(Date.now() / 1000);
    env.DB.prepare('INSERT INTO search_history (query, result_count, searched_at) VALUES (?, ?, ?)')
      .bind(query, threats.length, now)
      .run()
      .catch(err => console.error('Failed to log search:', err));

    const response = Response.json({
      threats,
      count: threats.length,
      mode,
      query,
    });

    // Wrap response with security headers and cache
    return wrapResponse(response, {
      rateLimit: {
        limit: rateLimit.limit,
        remaining: securityCheck.rateLimitInfo!.remaining,
        resetAt: securityCheck.rateLimitInfo!.resetAt,
      },
      cacheMaxAge: 60, // Cache for 1 minute
      cachePrivacy: 'private',
    });
  } catch (error) {
    console.error('Error searching threats:', {
      error: error instanceof Error ? error.message : String(error),
      query,
      mode,
      stack: error instanceof Error ? error.stack : undefined,
    });
    const errorResponse = Response.json({ error: 'Search failed' }, { status: 500 });
    return wrapResponse(errorResponse, { cacheMaxAge: 0 });
  }
};
