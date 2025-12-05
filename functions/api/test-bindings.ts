// Test endpoint to verify all bindings are working
import type { Env } from '../types';

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
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
