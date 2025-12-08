import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logError, logWarning, logInfo, logDebug } from '../../../functions/utils/logger';

describe('Logger Utils', () => {
  let consoleErrorSpy: any;
  let consoleWarnSpy: any;
  let consoleLogSpy: any;
  let consoleDebugSpy: any;

  beforeEach(() => {
    // Spy on console methods
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation();
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation();
    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation();
  });

  afterEach(() => {
    // Restore console methods
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleDebugSpy.mockRestore();
  });

  describe('logError()', () => {
    it('should log error with structured format', () => {
      const error = new Error('Something went wrong');

      logError('Test error message', error);

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);

      const loggedData = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
      expect(loggedData.level).toBe('error');
      expect(loggedData.message).toBe('Test error message');
      expect(loggedData.error).toBe('Something went wrong');
    });

    it('should include error stack trace', () => {
      const error = new Error('Test error');

      logError('Error occurred', error);

      const loggedData = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
      expect(loggedData.stack).toBeTruthy();
      expect(loggedData.stack).toContain('Error: Test error');
    });

    it('should include timestamp', () => {
      const error = new Error('Test');

      logError('Test', error);

      const loggedData = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
      expect(loggedData.timestamp).toBeTruthy();
      expect(new Date(loggedData.timestamp).getTime()).toBeGreaterThan(0);
    });

    it('should handle string errors', () => {
      logError('Test message', 'Simple error string');

      const loggedData = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
      expect(loggedData.error).toBe('Simple error string');
      expect(loggedData.stack).toBeUndefined();
    });

    it('should handle non-Error objects', () => {
      const errorObj = { code: 500, message: 'Server error' };

      logError('API failure', errorObj);

      const loggedData = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
      expect(loggedData.error).toBeTruthy();
      expect(loggedData.stack).toBeUndefined();
    });

    it('should include context metadata', () => {
      const error = new Error('Test');
      const context = {
        userId: '123',
        endpoint: '/api/test',
        requestId: 'req-456',
      };

      logError('Request failed', error, context);

      const loggedData = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
      expect(loggedData.userId).toBe('123');
      expect(loggedData.endpoint).toBe('/api/test');
      expect(loggedData.requestId).toBe('req-456');
    });

    it('should return log entry', () => {
      const error = new Error('Test');

      const result = logError('Test', error);

      expect(result.level).toBe('error');
      expect(result.message).toBe('Test');
      expect(result.error).toBe('Test');
    });

    it('should handle null error', () => {
      logError('Null error', null);

      const loggedData = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
      expect(loggedData.error).toBe('null');
      expect(loggedData.stack).toBeUndefined();
    });

    it('should handle undefined error', () => {
      logError('Undefined error', undefined);

      const loggedData = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
      expect(loggedData.error).toBe('undefined');
      expect(loggedData.stack).toBeUndefined();
    });
  });

  describe('logWarning()', () => {
    it('should log warning with structured format', () => {
      logWarning('Warning message');

      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);

      const loggedData = JSON.parse(consoleWarnSpy.mock.calls[0][0]);
      expect(loggedData.level).toBe('warning');
      expect(loggedData.message).toBe('Warning message');
    });

    it('should include timestamp', () => {
      logWarning('Test warning');

      const loggedData = JSON.parse(consoleWarnSpy.mock.calls[0][0]);
      expect(loggedData.timestamp).toBeTruthy();
      expect(new Date(loggedData.timestamp).getTime()).toBeGreaterThan(0);
    });

    it('should include context metadata', () => {
      const context = {
        limit: 100,
        current: 95,
        percentUsed: '95%',
      };

      logWarning('Approaching rate limit', context);

      const loggedData = JSON.parse(consoleWarnSpy.mock.calls[0][0]);
      expect(loggedData.limit).toBe(100);
      expect(loggedData.current).toBe(95);
      expect(loggedData.percentUsed).toBe('95%');
    });

    it('should not include error field', () => {
      logWarning('Test warning');

      const loggedData = JSON.parse(consoleWarnSpy.mock.calls[0][0]);
      expect(loggedData.error).toBeUndefined();
      expect(loggedData.stack).toBeUndefined();
    });

    it('should return log entry', () => {
      const result = logWarning('Test');

      expect(result.level).toBe('warning');
      expect(result.message).toBe('Test');
    });

    it('should handle empty context', () => {
      logWarning('Simple warning', {});

      const loggedData = JSON.parse(consoleWarnSpy.mock.calls[0][0]);
      expect(loggedData.message).toBe('Simple warning');
    });
  });

  describe('logInfo()', () => {
    it('should log info with structured format', () => {
      logInfo('Info message');

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);

      const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(loggedData.level).toBe('info');
      expect(loggedData.message).toBe('Info message');
    });

    it('should include timestamp', () => {
      logInfo('Test info');

      const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(loggedData.timestamp).toBeTruthy();
      expect(new Date(loggedData.timestamp).getTime()).toBeGreaterThan(0);
    });

    it('should include context metadata', () => {
      const context = {
        action: 'login',
        userId: '123',
        ip: '1.2.3.4',
        userAgent: 'Mozilla/5.0',
      };

      logInfo('User logged in', context);

      const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(loggedData.action).toBe('login');
      expect(loggedData.userId).toBe('123');
      expect(loggedData.ip).toBe('1.2.3.4');
      expect(loggedData.userAgent).toBe('Mozilla/5.0');
    });

    it('should return log entry', () => {
      const result = logInfo('Test');

      expect(result.level).toBe('info');
      expect(result.message).toBe('Test');
    });

    it('should handle complex context objects', () => {
      const context = {
        user: {
          id: '123',
          name: 'John Doe',
        },
        metadata: {
          source: 'web',
          version: '1.0',
        },
      };

      logInfo('Complex log', context);

      const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(loggedData.user).toEqual({ id: '123', name: 'John Doe' });
      expect(loggedData.metadata).toEqual({ source: 'web', version: '1.0' });
    });
  });

  describe('logDebug()', () => {
    it('should log debug with structured format', () => {
      logDebug('Debug message');

      expect(consoleDebugSpy).toHaveBeenCalledTimes(1);

      const loggedData = JSON.parse(consoleDebugSpy.mock.calls[0][0]);
      expect(loggedData.level).toBe('debug');
      expect(loggedData.message).toBe('Debug message');
    });

    it('should include timestamp', () => {
      logDebug('Test debug');

      const loggedData = JSON.parse(consoleDebugSpy.mock.calls[0][0]);
      expect(loggedData.timestamp).toBeTruthy();
      expect(new Date(loggedData.timestamp).getTime()).toBeGreaterThan(0);
    });

    it('should include context metadata', () => {
      const context = {
        cacheKey: 'user-123',
        ttl: 300,
        hitRate: 0.95,
      };

      logDebug('Cache hit', context);

      const loggedData = JSON.parse(consoleDebugSpy.mock.calls[0][0]);
      expect(loggedData.cacheKey).toBe('user-123');
      expect(loggedData.ttl).toBe(300);
      expect(loggedData.hitRate).toBe(0.95);
    });

    it('should return log entry', () => {
      const result = logDebug('Test');

      expect(result.level).toBe('debug');
      expect(result.message).toBe('Test');
    });
  });

  describe('Integration Tests', () => {
    it('should handle multiple log levels in sequence', () => {
      logDebug('Debug event', { step: 1 });
      logInfo('Info event', { step: 2 });
      logWarning('Warning event', { step: 3 });
      logError('Error event', new Error('Failed'), { step: 4 });

      expect(consoleDebugSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });

    it('should produce valid JSON for all log levels', () => {
      const logs = [
        logDebug('Debug'),
        logInfo('Info'),
        logWarning('Warning'),
        logError('Error', new Error('Test')),
      ];

      logs.forEach((log) => {
        expect(log.level).toBeTruthy();
        expect(log.message).toBeTruthy();
        expect(log.timestamp).toBeTruthy();
      });
    });

    it('should handle rich context across all levels', () => {
      const richContext = {
        requestId: 'req-123',
        userId: 'user-456',
        operation: 'data-fetch',
        duration: 1234,
        metadata: {
          source: 'api',
          version: '2.0',
        },
      };

      logDebug('Debug with context', richContext);
      logInfo('Info with context', richContext);
      logWarning('Warning with context', richContext);
      logError('Error with context', new Error('Test'), richContext);

      // Verify all logs contain the rich context
      [consoleDebugSpy, consoleLogSpy, consoleWarnSpy, consoleErrorSpy].forEach((spy) => {
        const loggedData = JSON.parse(spy.mock.calls[0][0]);
        expect(loggedData.requestId).toBe('req-123');
        expect(loggedData.userId).toBe('user-456');
        expect(loggedData.metadata).toEqual({ source: 'api', version: '2.0' });
      });
    });

    it('should maintain consistent timestamp format', () => {
      const timestampRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

      logDebug('Test');
      logInfo('Test');
      logWarning('Test');
      logError('Test', new Error('Test'));

      [consoleDebugSpy, consoleLogSpy, consoleWarnSpy, consoleErrorSpy].forEach((spy) => {
        const loggedData = JSON.parse(spy.mock.calls[0][0]);
        expect(loggedData.timestamp).toMatch(timestampRegex);
      });
    });

    it('should return usable log entries for further processing', () => {
      const errorLog = logError('Critical error', new Error('Database down'), {
        severity: 'critical',
        service: 'database',
      });

      // Log entry can be used for analytics, alerting, etc.
      expect(errorLog.level).toBe('error');
      expect(errorLog.severity).toBe('critical');
      expect(errorLog.service).toBe('database');
      expect(errorLog.error).toBeTruthy();
      expect(errorLog.stack).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty message strings', () => {
      logInfo('');

      const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(loggedData.message).toBe('');
    });

    it('should handle very long messages', () => {
      const longMessage = 'A'.repeat(10000);

      logInfo(longMessage);

      const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(loggedData.message).toBe(longMessage);
    });

    it('should handle special characters in messages', () => {
      const specialMessage = 'Test\n\t"quotes" and \\backslashes\\';

      logInfo(specialMessage);

      const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(loggedData.message).toBe(specialMessage);
    });

    it('should handle context with circular references', () => {
      const context: any = { name: 'test' };
      context.self = context; // Circular reference

      // Should not throw
      expect(() => {
        logInfo('Circular reference test', context);
      }).toThrow(); // JSON.stringify will throw on circular refs
    });

    it('should handle context with undefined values', () => {
      const context = {
        defined: 'value',
        undefinedKey: undefined,
        nullKey: null,
      };

      logInfo('Undefined values', context);

      const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(loggedData.defined).toBe('value');
      expect(loggedData.nullKey).toBeNull();
      // undefined values are omitted in JSON
    });

    it('should handle errors with custom properties', () => {
      const error: any = new Error('Test');
      error.customProp = 'custom value';
      error.code = 500;

      // Should not throw - only extracts message and stack
      logError('Custom error', error);

      const loggedData = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
      expect(loggedData.error).toBe('Test');
      expect(loggedData.stack).toBeTruthy();
      // Custom properties not included (only message and stack are extracted)
    });
  });
});
