// Client-side caching utility using localStorage
// Implements a simple key-value cache with TTL (time-to-live)

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface CacheOptions {
  ttl: number; // Time-to-live in milliseconds
  keyPrefix?: string; // Optional prefix for cache keys
}

/**
 * Fetch data with client-side caching
 *
 * @param key - Unique cache key (will be prefixed with keyPrefix if provided)
 * @param fetcher - Async function that fetches the data
 * @param options - Cache options (ttl, keyPrefix)
 * @returns The cached or freshly fetched data
 *
 * @example
 * const stats = await fetchWithCache(
 *   'dashboard-stats',
 *   async () => {
 *     const res = await fetch('/api/stats');
 *     return res.json();
 *   },
 *   { ttl: 5 * 60 * 1000, keyPrefix: 'threat-intel' }
 * );
 */
export async function fetchWithCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions
): Promise<T> {
  const { ttl, keyPrefix = 'cache' } = options;
  const cacheKey = `${keyPrefix}:${key}`;

  try {
    // Try to get cached data
    const cached = localStorage.getItem(cacheKey);

    if (cached) {
      try {
        const entry: CacheEntry<T> = JSON.parse(cached);
        const age = Date.now() - entry.timestamp;

        // Return cached data if still valid
        if (age < ttl && entry.data !== null && entry.data !== undefined) {
          return entry.data;
        }
      } catch (parseError) {
        // Invalid cache entry, remove it
        localStorage.removeItem(cacheKey);
      }
    }
  } catch (error) {
    // localStorage might be disabled or unavailable
    console.warn('Cache read failed:', error);
  }

  // Fetch fresh data
  const freshData = await fetcher();

  // Cache the fresh data
  try {
    const entry: CacheEntry<T> = {
      data: freshData,
      timestamp: Date.now(),
    };
    localStorage.setItem(cacheKey, JSON.stringify(entry));
  } catch (error) {
    // localStorage might be full or disabled
    console.warn('Cache write failed:', error);
  }

  return freshData;
}

/**
 * Invalidate (clear) a cached entry
 *
 * @param key - Cache key to invalidate
 * @param keyPrefix - Optional prefix (must match the one used when caching)
 *
 * @example
 * invalidateCache('dashboard-stats', 'threat-intel');
 */
export function invalidateCache(key: string, keyPrefix: string = 'cache'): void {
  const cacheKey = `${keyPrefix}:${key}`;
  try {
    localStorage.removeItem(cacheKey);
  } catch (error) {
    console.warn('Cache invalidation failed:', error);
  }
}

/**
 * Clear all cache entries with a specific prefix
 *
 * @param keyPrefix - Prefix to match (defaults to 'cache')
 *
 * @example
 * clearCacheByPrefix('threat-intel');
 */
export function clearCacheByPrefix(keyPrefix: string = 'cache'): void {
  try {
    const keysToRemove: string[] = [];
    const prefix = `${keyPrefix}:`;

    // Find all keys with this prefix
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        keysToRemove.push(key);
      }
    }

    // Remove them
    keysToRemove.forEach(key => localStorage.removeItem(key));
  } catch (error) {
    console.warn('Cache clear failed:', error);
  }
}

/**
 * Get cache statistics
 *
 * @param keyPrefix - Prefix to match (defaults to 'cache')
 * @returns Object with cache statistics
 */
export function getCacheStats(keyPrefix: string = 'cache'): {
  totalEntries: number;
  totalSize: number; // Approximate size in bytes
  entries: Array<{ key: string; age: number; size: number }>;
} {
  const stats = {
    totalEntries: 0,
    totalSize: 0,
    entries: [] as Array<{ key: string; age: number; size: number }>,
  };

  try {
    const prefix = `${keyPrefix}:`;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        const value = localStorage.getItem(key);
        if (value) {
          const size = new Blob([value]).size;
          stats.totalSize += size;
          stats.totalEntries++;

          try {
            const entry: CacheEntry<unknown> = JSON.parse(value);
            const age = Date.now() - entry.timestamp;
            stats.entries.push({ key, age, size });
          } catch {
            // Invalid entry, just count the size
            stats.entries.push({ key, age: -1, size });
          }
        }
      }
    }
  } catch (error) {
    console.warn('Failed to get cache stats:', error);
  }

  return stats;
}

// Common cache TTL values (in milliseconds)
export const CacheTTL = {
  ONE_MINUTE: 60 * 1000,
  FIVE_MINUTES: 5 * 60 * 1000,
  TEN_MINUTES: 10 * 60 * 1000,
  FIFTEEN_MINUTES: 15 * 60 * 1000,
  THIRTY_MINUTES: 30 * 60 * 1000,
  ONE_HOUR: 60 * 60 * 1000,
  ONE_DAY: 24 * 60 * 60 * 1000,
} as const;
