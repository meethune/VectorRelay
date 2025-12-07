/**
 * Logging Utilities for VectorRelay
 *
 * Provides standardized logging functions with structured output.
 * Ensures consistent error logging across the application.
 *
 * Features:
 * - Structured JSON logging
 * - Automatic error extraction
 * - Context support for additional metadata
 * - Timestamp inclusion
 * - Stack trace capture
 *
 * @example
 * ```typescript
 * logError('Failed to fetch data', error, { userId: '123', endpoint: '/api/data' });
 * logWarning('Rate limit approaching', { limit: 100, current: 95 });
 * logInfo('User action', { action: 'login', userId: '123' });
 * ```
 */

/**
 * Additional context for log entries
 * Can include any relevant metadata
 */
export interface LogContext {
  [key: string]: unknown;
}

/**
 * Structured log entry format
 */
interface LogEntry {
  level: 'error' | 'warning' | 'info' | 'debug';
  message: string;
  timestamp: string;
  error?: string;
  stack?: string;
  [key: string]: unknown;
}

/**
 * Logs an error with structured output
 *
 * @param message - Human-readable error message
 * @param error - Error object or error message
 * @param context - Additional context/metadata
 * @returns The structured log entry for further processing if needed
 *
 * @example
 * ```typescript
 * try {
 *   await riskyOperation();
 * } catch (error) {
 *   logError('Operation failed', error, { operationId: '123' });
 * }
 * ```
 */
export function logError(
  message: string,
  error: unknown,
  context?: LogContext
): LogEntry {
  const logEntry: LogEntry = {
    level: 'error',
    message,
    timestamp: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    ...context,
  };

  console.error(JSON.stringify(logEntry));
  return logEntry;
}

/**
 * Logs a warning with structured output
 *
 * @param message - Human-readable warning message
 * @param context - Additional context/metadata
 * @returns The structured log entry
 *
 * @example
 * ```typescript
 * logWarning('Cache miss', { key: 'user-123', ttl: 300 });
 * ```
 */
export function logWarning(message: string, context?: LogContext): LogEntry {
  const logEntry: LogEntry = {
    level: 'warning',
    message,
    timestamp: new Date().toISOString(),
    ...context,
  };

  console.warn(JSON.stringify(logEntry));
  return logEntry;
}

/**
 * Logs an informational message with structured output
 *
 * @param message - Human-readable info message
 * @param context - Additional context/metadata
 * @returns The structured log entry
 *
 * @example
 * ```typescript
 * logInfo('User logged in', { userId: '123', ip: '1.2.3.4' });
 * ```
 */
export function logInfo(message: string, context?: LogContext): LogEntry {
  const logEntry: LogEntry = {
    level: 'info',
    message,
    timestamp: new Date().toISOString(),
    ...context,
  };

  console.log(JSON.stringify(logEntry));
  return logEntry;
}

/**
 * Logs a debug message with structured output
 * Use for development/troubleshooting
 *
 * @param message - Human-readable debug message
 * @param context - Additional context/metadata
 * @returns The structured log entry
 *
 * @example
 * ```typescript
 * logDebug('Cache hit', { key: 'user-123', value: {...} });
 * ```
 */
export function logDebug(message: string, context?: LogContext): LogEntry {
  const logEntry: LogEntry = {
    level: 'debug',
    message,
    timestamp: new Date().toISOString(),
    ...context,
  };

  console.debug(JSON.stringify(logEntry));
  return logEntry;
}
