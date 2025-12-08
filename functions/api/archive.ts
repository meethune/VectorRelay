/**
 * Archive API Endpoints
 *
 * Handles R2 quota monitoring and archive statistics
 * GET /api/archive - Get archive statistics and R2 quota status
 * POST /api/archive - Manually trigger archival (dev only)
 */

import type { Env } from '../types';
import { getR2Stats } from '../utils/r2-storage';
import { archiveOldThreats } from '../utils/archiver';
import { securityMiddleware, wrapResponse } from '../utils/security';
import { validateApiKey, unauthorizedResponse } from '../utils/auth';

/**
 * GET /api/archive
 * Get R2 usage statistics and quota status
 */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  // Apply security middleware
  const securityCheck = await securityMiddleware(request, env, 'archive-stats', {
    rateLimit: { limit: 100, window: 600 }, // 100 requests per 10 minutes
    cacheMaxAge: 60, // Cache for 1 minute
    cachePrivacy: 'public',
  });

  if (!securityCheck.allowed) {
    return securityCheck.response!;
  }
  try {
    const stats = await getR2Stats(env);

    // Get count of archived threats from D1
    const archivedCountResult = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM threats WHERE archived = 1'
    ).first<{ count: number }>();

    const archivedCount = archivedCountResult?.count || 0;

    // Get total threats
    const totalCountResult = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM threats'
    ).first<{ count: number }>();
    const totalCount = totalCountResult?.count || 0;

    const response = Response.json({
      r2: stats,
      threats: {
        total: totalCount,
        archived: archivedCount,
        active: Number(totalCount) - Number(archivedCount),
        archivePercent: totalCount
          ? ((Number(archivedCount) / Number(totalCount)) * 100).toFixed(1)
          : '0.0',
      },
    });

    return wrapResponse(response, {
      rateLimit: {
        limit: 100,
        remaining: securityCheck.rateLimitInfo!.remaining,
        resetAt: securityCheck.rateLimitInfo!.resetAt,
      },
      cacheMaxAge: 60,
      cachePrivacy: 'public',
    });
  } catch (error) {
    console.error('[API] Error getting archive stats:', error);
    const errorResponse = Response.json(
      {
        error: 'Failed to get archive statistics',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
    return wrapResponse(errorResponse, { cacheMaxAge: 0 });
  }
};

/**
 * POST /api/archive
 * Manually trigger archival process (development/admin only)
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  // Security: Disable manual archival in production
  // Archival happens automatically on 1st of month via cron job
  if (env.ENVIRONMENT === 'production') {
    return Response.json(
      {
        error: 'Manual archival disabled in production',
        message: 'Archival runs automatically on the 1st of each month via cron trigger',
      },
      { status: 403 }
    );
  }

  // In development, require API key
  if (!validateApiKey(request, env)) {
    return unauthorizedResponse();
  }

  try {
    console.log('[API] Manual archival triggered');

    const stats = await archiveOldThreats(env);

    return Response.json({
      success: true,
      stats,
      message: `Archived ${stats.archived} threats, ${stats.failed} failed, ${stats.skipped} skipped`,
    });
  } catch (error) {
    console.error('[API] Error running archival:', error);
    return Response.json(
      {
        error: 'Archival failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
};
