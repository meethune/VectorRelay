// API: Get threats with filtering and pagination
import type { Env, ThreatWithSummary } from '../types';
import {
  securityMiddleware,
  wrapResponse,
  validateCategory,
  validateSeverity,
  validateOrigin,
  handleCORSPreflight,
} from '../utils/security';

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

  // Apply security middleware
  const securityCheck = await securityMiddleware(request, env, 'threats', {
    rateLimit: { limit: 200, window: 600 }, // 200 requests per 10 minutes
    cacheMaxAge: 300, // Cache for 5 minutes
    cachePrivacy: 'public',
  });

  if (!securityCheck.allowed) {
    return securityCheck.response!;
  }

  const url = new URL(request.url);

  // Security: Validate and cap pagination parameters
  const requestedPage = parseInt(url.searchParams.get('page') || '1');
  const page = Math.max(requestedPage, 1); // Min page 1

  const requestedLimit = parseInt(url.searchParams.get('limit') || '20');
  const limit = Math.min(Math.max(requestedLimit, 1), 50); // Min 1, Max 50

  const category = url.searchParams.get('category');
  const severity = url.searchParams.get('severity');
  const source = url.searchParams.get('source');

  // Security: Validate enum values
  if (category && !validateCategory(category)) {
    const errorResponse = Response.json({ error: 'Invalid category value' }, { status: 400 });
    return wrapResponse(errorResponse, {
      cacheMaxAge: 0,
      cors: validatedOrigin ? { origin: validatedOrigin } : undefined,
    });
  }

  if (severity && !validateSeverity(severity)) {
    const errorResponse = Response.json({ error: 'Invalid severity value' }, { status: 400 });
    return wrapResponse(errorResponse, {
      cacheMaxAge: 0,
      cors: validatedOrigin ? { origin: validatedOrigin } : undefined,
    });
  }

  const offset = (page - 1) * limit;

  try {
    // Build query with filters
    let query = `
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
      WHERE 1=1
    `;

    const params: any[] = [];

    if (category) {
      query += ' AND s.category = ?';
      params.push(category);
    }

    if (severity) {
      query += ' AND s.severity = ?';
      params.push(severity);
    }

    if (source) {
      query += ' AND t.source = ?';
      params.push(source);
    }

    query += ' ORDER BY t.published_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    // Execute query
    const result = await env.DB.prepare(query).bind(...params).all();

    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) as total FROM threats t LEFT JOIN summaries s ON t.id = s.threat_id WHERE 1=1';
    const countParams: any[] = [];

    if (category) {
      countQuery += ' AND s.category = ?';
      countParams.push(category);
    }

    if (severity) {
      countQuery += ' AND s.severity = ?';
      countParams.push(severity);
    }

    if (source) {
      countQuery += ' AND t.source = ?';
      countParams.push(source);
    }

    const countResult = await env.DB.prepare(countQuery).bind(...countParams).first<{ total: number }>();
    const total = countResult?.total || 0;

    // Parse JSON fields
    const threats = result.results.map((row: any) => ({
      ...row,
      key_points: row.key_points ? JSON.parse(row.key_points) : [],
      affected_sectors: row.affected_sectors ? JSON.parse(row.affected_sectors) : [],
      threat_actors: row.threat_actors ? JSON.parse(row.threat_actors) : [],
    }));

    const response = Response.json({
      threats,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    });

    // Wrap response with security headers, CORS, and cache
    return wrapResponse(response, {
      rateLimit: {
        limit: 200,
        remaining: securityCheck.rateLimitInfo!.remaining,
        resetAt: securityCheck.rateLimitInfo!.resetAt,
      },
      cacheMaxAge: 300,
      cachePrivacy: 'public',
      cors: validatedOrigin ? { origin: validatedOrigin } : undefined,
    });
  } catch (error) {
    console.error('Error fetching threats:', {
      error: error instanceof Error ? error.message : String(error),
      page,
      limit,
      category,
      severity,
      source,
      stack: error instanceof Error ? error.stack : undefined,
    });
    const errorResponse = Response.json({ error: 'Failed to fetch threats' }, { status: 500 });
    return wrapResponse(errorResponse, {
      cacheMaxAge: 0,
      cors: validatedOrigin ? { origin: validatedOrigin } : undefined,
    });
  }
};
