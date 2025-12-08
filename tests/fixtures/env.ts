import { vi } from 'vitest';
import type { Env } from '../../functions/types';

/**
 * Create a mock Cloudflare Workers environment for testing
 * Includes mocked D1, Vectorize, R2, Cache, Analytics bindings
 */
export function createMockEnv(overrides?: Partial<Env>): Env {
  return {
    DB: {
      prepare: vi.fn().mockReturnThis(),
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({ success: true }),
      first: vi.fn().mockResolvedValue(null),
      all: vi.fn().mockResolvedValue({ results: [] }),
      dump: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
      batch: vi.fn().mockResolvedValue([]),
      exec: vi.fn().mockResolvedValue({ count: 0, duration: 0 }),
    } as any,
    AI: {
      run: vi.fn().mockResolvedValue({ response: 'mock AI response' }),
    } as any,
    VECTORIZE_INDEX: {
      insert: vi.fn().mockResolvedValue({}),
      query: vi.fn().mockResolvedValue({ matches: [] }),
      getByIds: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockResolvedValue({}),
      deleteByIds: vi.fn().mockResolvedValue({}),
    } as any,
    CACHE: {
      match: vi.fn().mockResolvedValue(undefined),
      put: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(false),
    } as any,
    ANALYTICS: {
      writeDataPoint: vi.fn().mockResolvedValue(undefined),
    } as any,
    THREAT_ARCHIVE: {
      put: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue(null),
      delete: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue({ objects: [] }),
      head: vi.fn().mockResolvedValue(null),
    } as any,
    ASSETS: {
      fetch: vi.fn().mockResolvedValue(new Response('mock asset')),
    } as any,
    AI_GATEWAY_ID: 'test-gateway-id',
    API_KEY: 'test-api-key-12345',
    R2_ARCHIVE_ENABLED: 'true',
    ...overrides,
  } as any;
}

/**
 * Reset all mocks in a mock environment
 */
export function resetMockEnv(env: Env): void {
  vi.clearAllMocks();
}
