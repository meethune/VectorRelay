/**
 * API Response Helpers for VectorRelay
 *
 * Provides utilities for creating standardized API responses with
 * proper headers, caching, and rate limiting.
 *
 * Features:
 * - Standardized JSON responses
 * - Automatic header management
 * - Rate limit headers
 * - Cache control headers
 * - CORS support
 * - Type-safe responses
 *
 * @example
 * ```typescript
 * return createJsonResponse({ data: threats }, {
 *   status: 200,
 *   rateLimit: { limit: 100, remaining: 95, resetAt: timestamp },
 *   cacheMaxAge: 300
 * });
 * ```
 */

import { wrapResponse } from './security';

/**
 * Options for creating JSON responses
 */
export interface JsonResponseOptions {
  /**
   * HTTP status code (default: 200)
   */
  status?: number;

  /**
   * Rate limit information to include in headers
   */
  rateLimit?: {
    limit: number;
    remaining: number;
    resetAt: number;
  };

  /**
   * Cache max-age in seconds
   */
  cacheMaxAge?: number;

  /**
   * Cache privacy setting ('public' or 'private')
   * Default: 'public'
   */
  cachePrivacy?: 'public' | 'private';

  /**
   * CORS configuration
   */
  cors?: {
    origin?: string;
    methods?: string;
    allowedHeaders?: string;
  };
}

/**
 * Creates a standardized JSON response with proper headers
 *
 * This function wraps Response.json() and adds common headers like
 * rate limiting, caching, and CORS automatically.
 *
 * @param data - The data to return as JSON
 * @param options - Response configuration options
 * @returns A Response object with proper headers
 *
 * @example
 * ```typescript
 * // Simple response
 * return createJsonResponse({ message: 'Success' });
 *
 * // With rate limiting and caching
 * return createJsonResponse({ data: items }, {
 *   status: 200,
 *   rateLimit: { limit: 100, remaining: 95, resetAt: Date.now() + 3600000 },
 *   cacheMaxAge: 300
 * });
 *
 * // With CORS
 * return createJsonResponse({ data }, {
 *   cors: { origin: '*' }
 * });
 * ```
 */
export function createJsonResponse<T>(
  data: T,
  options?: JsonResponseOptions
): Response {
  // Create base JSON response
  const response = Response.json(data, {
    status: options?.status || 200,
  });

  // Apply security headers, rate limits, caching via wrapResponse
  return wrapResponse(response, {
    rateLimit: options?.rateLimit,
    cacheMaxAge: options?.cacheMaxAge,
    cachePrivacy: options?.cachePrivacy,
    cors: options?.cors,
  });
}

/**
 * Creates a standardized error response
 *
 * @param message - Error message
 * @param status - HTTP status code (default: 500)
 * @param details - Optional additional error details
 * @returns A Response object with error information
 *
 * @example
 * ```typescript
 * return createErrorResponse('Not found', 404);
 * return createErrorResponse('Invalid input', 400, { field: 'email' });
 * ```
 */
export function createErrorResponse(
  message: string,
  status = 500,
  details?: Record<string, unknown>
): Response {
  return createJsonResponse(
    {
      error: message,
      status,
      ...details,
    },
    { status }
  );
}

/**
 * Creates a standardized success response
 *
 * @param data - The data to return
 * @param options - Response options
 * @returns A Response object
 *
 * @example
 * ```typescript
 * return createSuccessResponse({ threats: [...] }, { cacheMaxAge: 300 });
 * ```
 */
export function createSuccessResponse<T>(
  data: T,
  options?: Omit<JsonResponseOptions, 'status'>
): Response {
  return createJsonResponse(data, { ...options, status: 200 });
}

/**
 * Creates a paginated response with metadata
 *
 * @param data - Array of items
 * @param pagination - Pagination metadata
 * @param options - Response options
 * @returns A Response object with data and pagination info
 *
 * @example
 * ```typescript
 * return createPaginatedResponse(threats, {
 *   page: 1,
 *   limit: 20,
 *   total: 150,
 *   totalPages: 8
 * });
 * ```
 */
export function createPaginatedResponse<T>(
  data: T[],
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  },
  options?: Omit<JsonResponseOptions, 'status'>
): Response {
  return createJsonResponse(
    {
      data,
      pagination,
    },
    { ...options, status: 200 }
  );
}
