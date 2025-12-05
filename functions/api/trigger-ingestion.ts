// Manual trigger endpoint for feed ingestion
// Access at: /api/trigger-ingestion
import type { Env } from '../types';

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
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
