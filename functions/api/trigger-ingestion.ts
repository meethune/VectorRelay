// Manual trigger endpoint for feed ingestion
// Access at: /api/trigger-ingestion
// Requires authentication via API key
import type { Env } from '../types';
import { validateApiKey, unauthorizedResponse } from '../utils/auth';

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  // Security: Disable management endpoints in production
  // Cron triggers handle automatic ingestion; manual triggers not needed in prod
  if (env.ENVIRONMENT === 'production') {
    return new Response(JSON.stringify({
      error: 'Endpoint disabled',
      message: 'This endpoint is disabled in production. Feed ingestion runs automatically via cron triggers.',
      cron_schedule: '0 */6 * * * (every 6 hours)'
    }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // In development, require API key
  if (!validateApiKey(request, env)) {
    return unauthorizedResponse();
  }

  try {
    console.log('Manual trigger: Starting feed ingestion...');

    // Import and run the scheduled function logic
    const { onSchedule } = await import('../scheduled');

    // Call the scheduled function
    await onSchedule({ env } as any);

    return new Response(JSON.stringify({
      success: true,
      message: 'Feed ingestion triggered successfully! Data will appear in a few minutes.',
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Manual trigger error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
