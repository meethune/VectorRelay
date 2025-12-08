import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Use happy-dom for DOM simulation (lighter than jsdom)
    environment: 'happy-dom',

    // Test file patterns
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['node_modules', 'dist', '.wrangler'],

    // Global test setup
    globals: true,

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      // Explicitly include only tested backend code
      include: [
        'functions/api/*.ts',
        'functions/utils/*.ts',
        'functions/constants.ts',
      ],
      exclude: [
        'node_modules/**',
        'dist/**',
        '.wrangler/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData/**',
        'tests/**',
      ],
      // Target 80%+ coverage for backend utilities and API endpoints
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75, // Slightly lower for branch coverage (error paths)
        statements: 80,
      },
    },

    // Test timeout (useful for async operations)
    testTimeout: 10000,

    // Hooks timeout
    hookTimeout: 10000,

    // Parallel execution
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
      },
    },

    // Mock handling
    mockReset: true,
    restoreMocks: true,
    clearMocks: true,
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@functions': path.resolve(__dirname, './functions'),
    },
  },
});
