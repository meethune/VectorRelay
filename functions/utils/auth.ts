// Authentication utilities for management endpoints
import type { Env } from '../types';

/**
 * Validate API key for management endpoints
 * Only allows requests from GitHub Actions or other authorized clients
 */
export function validateApiKey(request: Request, env: Env): boolean {
  // Get API key from Authorization header or X-API-Key header
  const authHeader = request.headers.get('Authorization');
  const apiKeyHeader = request.headers.get('X-API-Key');

  // Extract key from "Bearer <key>" format or direct key
  const providedKey = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : authHeader || apiKeyHeader;

  if (!providedKey) {
    return false;
  }

  // Compare with secret stored in Cloudflare Pages
  // API_SECRET should be set via: npx wrangler pages secret put API_SECRET --project-name=threat-intel-dashboard
  return providedKey === env.API_SECRET;
}

/**
 * Return 401 Unauthorized response
 */
export function unauthorizedResponse(): Response {
  return Response.json({
    error: 'Unauthorized',
    message: 'Valid API key required. This endpoint is restricted to authorized clients only.'
  }, {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Bearer realm="Management API"'
    }
  });
}
