// Test endpoint to verify all bindings are working
import type { Env } from '../../types';
import { validateApiKey, unauthorizedResponse } from '../../utils/auth';

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  // Security: Disable test endpoint in production
  if (env.ENVIRONMENT === 'production') {
    return Response.json({
      error: 'Test endpoints are disabled in production'
    }, { status: 404 });
  }

  // Security: Require API key authentication even in development
  if (!validateApiKey(request, env)) {
    return unauthorizedResponse();
  }

  const results: Record<string, any> = {};

  // Test D1
  try {
    const dbTest = await env.DB.prepare('SELECT COUNT(*) as count FROM feed_sources').first();
    results.d1 = { status: 'OK', feed_sources: dbTest?.count };
  } catch (e) {
    results.d1 = { status: 'ERROR', error: e instanceof Error ? e.message : String(e) };
  }

  // Test KV
  try {
    await env.CACHE.put('test-key', 'test-value', { expirationTtl: 60 });
    const value = await env.CACHE.get('test-key');
    results.kv = { status: value === 'test-value' ? 'OK' : 'MISMATCH' };
  } catch (e) {
    results.kv = { status: 'ERROR', error: e instanceof Error ? e.message : String(e) };
  }

  // Test Workers AI
  try {
    results.ai = { status: env.AI ? 'OK' : 'NOT_BOUND' };
  } catch (e) {
    results.ai = { status: 'ERROR', error: e instanceof Error ? e.message : String(e) };
  }

  // Test Vectorize
  try {
    results.vectorize = { status: env.VECTORIZE_INDEX ? 'OK' : 'NOT_BOUND' };
  } catch (e) {
    results.vectorize = { status: 'ERROR', error: e instanceof Error ? e.message : String(e) };
  }

  // Test Analytics
  try {
    results.analytics = { status: env.ANALYTICS ? 'OK' : 'NOT_BOUND' };
  } catch (e) {
    results.analytics = { status: 'ERROR', error: e instanceof Error ? e.message : String(e) };
  }

  return Response.json(results, { status: 200 });
};
