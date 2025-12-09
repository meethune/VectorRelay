// API: Dashboard statistics
import type { Env, DashboardStats } from '../types';
import {
  securityMiddleware,
  wrapResponse,
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
  const securityCheck = await securityMiddleware(request, env, 'stats', {
    rateLimit: { limit: 200, window: 600 }, // 200 requests per 10 minutes
    cacheMaxAge: 300, // Cache for 5 minutes
    cachePrivacy: 'public',
  });

  if (!securityCheck.allowed) {
    return securityCheck.response!;
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    const oneDayAgo = now - 86400;
    const oneWeekAgo = now - 604800;

    // Get total threats
    const totalResult = await env.DB.prepare('SELECT COUNT(*) as total FROM threats').first<{
      total: number;
    }>();
    const total_threats = totalResult?.total || 0;

    // Get threats today
    const todayResult = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM threats WHERE published_at >= ?'
    )
      .bind(oneDayAgo)
      .first<{ count: number }>();
    const threats_today = todayResult?.count || 0;

    // Get threats this week
    const weekResult = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM threats WHERE published_at >= ?'
    )
      .bind(oneWeekAgo)
      .first<{ count: number }>();
    const threats_this_week = weekResult?.count || 0;

    // Category breakdown (last 30 days)
    const thirtyDaysAgo = now - 2592000;
    const categoryResult = await env.DB.prepare(
      `SELECT s.category, COUNT(*) as count
       FROM summaries s
       JOIN threats t ON s.threat_id = t.id
       WHERE t.published_at >= ?
       GROUP BY s.category`
    )
      .bind(thirtyDaysAgo)
      .all();

    const category_breakdown: Record<string, number> = {};
    categoryResult.results.forEach((row: any) => {
      category_breakdown[row.category] = row.count;
    });

    // Severity breakdown (last 30 days)
    const severityResult = await env.DB.prepare(
      `SELECT s.severity, COUNT(*) as count
       FROM summaries s
       JOIN threats t ON s.threat_id = t.id
       WHERE t.published_at >= ?
       GROUP BY s.severity`
    )
      .bind(thirtyDaysAgo)
      .all();

    const severity_breakdown: Record<string, number> = {};
    severityResult.results.forEach((row: any) => {
      severity_breakdown[row.severity] = row.count;
    });

    // Top sources (last 30 days)
    const sourcesResult = await env.DB.prepare(
      `SELECT source, COUNT(*) as count
       FROM threats
       WHERE published_at >= ?
       GROUP BY source
       ORDER BY count DESC
       LIMIT 10`
    )
      .bind(thirtyDaysAgo)
      .all();

    const top_sources = sourcesResult.results.map((row: any) => ({
      source: row.source,
      count: row.count,
    }));

    // Recent trends
    const trendsResult = await env.DB.prepare(
      'SELECT * FROM trends ORDER BY week_start DESC LIMIT 4'
    ).all();

    const recent_trends = trendsResult.results.map((row: any) => ({
      ...row,
      key_insights: row.key_insights ? JSON.parse(row.key_insights) : [],
      severity_distribution: row.severity_distribution ? JSON.parse(row.severity_distribution) : {},
    }));

    const stats: DashboardStats = {
      total_threats,
      threats_today,
      threats_this_week,
      category_breakdown,
      severity_breakdown,
      top_sources,
      recent_trends,
    };

    const response = Response.json(stats);

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
    console.error('Error fetching stats:', error);
    const errorResponse = Response.json({ error: 'Failed to fetch statistics' }, { status: 500 });
    return wrapResponse(errorResponse, {
      cacheMaxAge: 0, // Don't cache errors
      cors: validatedOrigin ? { origin: validatedOrigin } : undefined,
    });
  }
};
