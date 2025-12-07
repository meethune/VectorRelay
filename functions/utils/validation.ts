// Generic validation utilities for VectorRelay
// Provides type-safe validators and type guards

import { logWarning } from './logger';

/**
 * Generic enum validator
 *
 * Creates a type-safe validator function for readonly arrays (enums)
 *
 * @example
 * const COLORS = ['red', 'green', 'blue'] as const;
 * const isValidColor = createEnumValidator(COLORS, 'color');
 * isValidColor('red'); // true
 * isValidColor('yellow'); // false (logs warning)
 */
export function createEnumValidator<T extends readonly string[]>(
  allowedValues: T,
  fieldName: string,
  options: {
    caseSensitive?: boolean;
    logInvalid?: boolean;
  } = {}
): (value: string) => value is T[number] {
  const { caseSensitive = true, logInvalid = true } = options;

  // Create lookup set for O(1) validation
  const valueSet = new Set(
    caseSensitive
      ? allowedValues
      : allowedValues.map((v) => v.toLowerCase())
  );

  return (value: string): value is T[number] => {
    if (!value || typeof value !== 'string') {
      if (logInvalid) {
        logWarning(`Invalid ${fieldName}: value must be a non-empty string`, {
          value,
          valueType: typeof value,
        });
      }
      return false;
    }

    const testValue = caseSensitive ? value : value.toLowerCase();
    const isValid = valueSet.has(testValue);

    if (!isValid && logInvalid) {
      logWarning(`Invalid ${fieldName}: "${value}" is not in allowed values`, {
        value,
        allowedValues: [...allowedValues],
      });
    }

    return isValid;
  };
}

/**
 * Generic array validator
 *
 * Validates that a value is an array and optionally validates each element
 *
 * @example
 * const isStringArray = createArrayValidator<string>((item) => typeof item === 'string');
 * isStringArray(['a', 'b', 'c']); // true
 * isStringArray(['a', 1, 'c']); // false
 */
export function createArrayValidator<T>(
  itemValidator?: (item: unknown) => item is T,
  options: {
    minLength?: number;
    maxLength?: number;
    fieldName?: string;
  } = {}
): (value: unknown) => value is T[] {
  const { minLength, maxLength, fieldName = 'array' } = options;

  return (value: unknown): value is T[] => {
    // Check if it's an array
    if (!Array.isArray(value)) {
      logWarning(`Invalid ${fieldName}: value must be an array`, {
        value,
        valueType: typeof value,
      });
      return false;
    }

    // Check length constraints
    if (minLength !== undefined && value.length < minLength) {
      logWarning(`Invalid ${fieldName}: array too short`, {
        actualLength: value.length,
        minLength,
      });
      return false;
    }

    if (maxLength !== undefined && value.length > maxLength) {
      logWarning(`Invalid ${fieldName}: array too long`, {
        actualLength: value.length,
        maxLength,
      });
      return false;
    }

    // Validate each item if validator provided
    if (itemValidator) {
      for (let i = 0; i < value.length; i++) {
        if (!itemValidator(value[i])) {
          logWarning(`Invalid ${fieldName}: invalid item at index ${i}`, {
            index: i,
            item: value[i],
          });
          return false;
        }
      }
    }

    return true;
  };
}

/**
 * String length validator
 *
 * Validates string length constraints
 *
 * @example
 * const validateUsername = createStringValidator({
 *   minLength: 3,
 *   maxLength: 20,
 *   fieldName: 'username'
 * });
 */
export function createStringValidator(options: {
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  fieldName?: string;
}): (value: unknown) => value is string {
  const { minLength, maxLength, pattern, fieldName = 'string' } = options;

  return (value: unknown): value is string => {
    // Type check
    if (typeof value !== 'string') {
      logWarning(`Invalid ${fieldName}: value must be a string`, {
        value,
        valueType: typeof value,
      });
      return false;
    }

    // Length checks
    if (minLength !== undefined && value.length < minLength) {
      logWarning(`Invalid ${fieldName}: string too short`, {
        actualLength: value.length,
        minLength,
      });
      return false;
    }

    if (maxLength !== undefined && value.length > maxLength) {
      logWarning(`Invalid ${fieldName}: string too long`, {
        actualLength: value.length,
        maxLength,
      });
      return false;
    }

    // Pattern check
    if (pattern && !pattern.test(value)) {
      logWarning(`Invalid ${fieldName}: string does not match pattern`, {
        value,
        pattern: pattern.source,
      });
      return false;
    }

    return true;
  };
}

/**
 * Number range validator
 *
 * Validates number range constraints
 *
 * @example
 * const validateAge = createNumberValidator({
 *   min: 0,
 *   max: 120,
 *   fieldName: 'age'
 * });
 */
export function createNumberValidator(options: {
  min?: number;
  max?: number;
  integer?: boolean;
  fieldName?: string;
}): (value: unknown) => value is number {
  const { min, max, integer = false, fieldName = 'number' } = options;

  return (value: unknown): value is number => {
    // Type check
    if (typeof value !== 'number' || isNaN(value)) {
      logWarning(`Invalid ${fieldName}: value must be a number`, {
        value,
        valueType: typeof value,
      });
      return false;
    }

    // Integer check
    if (integer && !Number.isInteger(value)) {
      logWarning(`Invalid ${fieldName}: number must be an integer`, {
        value,
      });
      return false;
    }

    // Range checks
    if (min !== undefined && value < min) {
      logWarning(`Invalid ${fieldName}: number too small`, {
        value,
        min,
      });
      return false;
    }

    if (max !== undefined && value > max) {
      logWarning(`Invalid ${fieldName}: number too large`, {
        value,
        max,
      });
      return false;
    }

    return true;
  };
}

/**
 * Object shape validator
 *
 * Validates that an object has required fields
 *
 * @example
 * const validateUser = createObjectValidator({
 *   requiredFields: ['id', 'name', 'email'],
 *   fieldName: 'user'
 * });
 */
export function createObjectValidator<T extends Record<string, unknown>>(options: {
  requiredFields?: string[];
  optionalFields?: string[];
  fieldName?: string;
}): (value: unknown) => value is T {
  const { requiredFields = [], optionalFields = [], fieldName = 'object' } = options;

  return (value: unknown): value is T => {
    // Type check
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      logWarning(`Invalid ${fieldName}: value must be an object`, {
        value,
        valueType: typeof value,
      });
      return false;
    }

    const obj = value as Record<string, unknown>;

    // Check required fields
    for (const field of requiredFields) {
      if (!(field in obj)) {
        logWarning(`Invalid ${fieldName}: missing required field "${field}"`, {
          providedFields: Object.keys(obj),
          requiredFields,
        });
        return false;
      }
    }

    // Check for unexpected fields (if optionalFields is specified)
    if (optionalFields.length > 0) {
      const allowedFields = new Set([...requiredFields, ...optionalFields]);
      const unexpectedFields = Object.keys(obj).filter((key) => !allowedFields.has(key));

      if (unexpectedFields.length > 0) {
        logWarning(`Invalid ${fieldName}: unexpected fields`, {
          unexpectedFields,
          allowedFields: [...allowedFields],
        });
        return false;
      }
    }

    return true;
  };
}

/**
 * Composite validator - combines multiple validators with AND logic
 *
 * @example
 * const isValidEmail = createCompositeValidator(
 *   createStringValidator({ minLength: 3, maxLength: 100 }),
 *   (val): val is string => typeof val === 'string' && val.includes('@')
 * );
 */
export function createCompositeValidator<T>(
  ...validators: Array<(value: unknown) => value is T>
): (value: unknown) => value is T {
  return (value: unknown): value is T => {
    return validators.every((validator) => validator(value));
  };
}

/**
 * Create a nullable validator - allows null in addition to validator check
 *
 * @example
 * const isNumberOrNull = createNullableValidator(
 *   createNumberValidator({ min: 0 })
 * );
 */
export function createNullableValidator<T>(
  validator: (value: unknown) => value is T
): (value: unknown) => value is T | null {
  return (value: unknown): value is T | null => {
    if (value === null) return true;
    return validator(value);
  };
}
