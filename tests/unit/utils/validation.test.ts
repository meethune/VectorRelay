import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createEnumValidator,
  createArrayValidator,
  createStringValidator,
  createNumberValidator,
  createObjectValidator,
  createCompositeValidator,
  createNullableValidator,
} from '../../../functions/utils/validation';

describe('Validation Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createEnumValidator()', () => {
    it('should validate values in the allowed set', () => {
      const COLORS = ['red', 'green', 'blue'] as const;
      const isValidColor = createEnumValidator(COLORS, 'color');

      expect(isValidColor('red')).toBe(true);
      expect(isValidColor('green')).toBe(true);
      expect(isValidColor('blue')).toBe(true);
    });

    it('should reject values not in the allowed set', () => {
      const COLORS = ['red', 'green', 'blue'] as const;
      const isValidColor = createEnumValidator(COLORS, 'color');

      expect(isValidColor('yellow')).toBe(false);
      expect(isValidColor('purple')).toBe(false);
    });

    it('should be case-sensitive by default', () => {
      const COLORS = ['red', 'green', 'blue'] as const;
      const isValidColor = createEnumValidator(COLORS, 'color');

      expect(isValidColor('RED')).toBe(false);
      expect(isValidColor('Red')).toBe(false);
    });

    it('should support case-insensitive validation', () => {
      const COLORS = ['red', 'green', 'blue'] as const;
      const isValidColor = createEnumValidator(COLORS, 'color', { caseSensitive: false });

      expect(isValidColor('RED')).toBe(true);
      expect(isValidColor('Green')).toBe(true);
      expect(isValidColor('BLUE')).toBe(true);
    });

    it('should reject empty strings', () => {
      const COLORS = ['red', 'green', 'blue'] as const;
      const isValidColor = createEnumValidator(COLORS, 'color');

      expect(isValidColor('')).toBe(false);
    });

    it('should reject non-string values', () => {
      const COLORS = ['red', 'green', 'blue'] as const;
      const isValidColor = createEnumValidator(COLORS, 'color');

      expect(isValidColor(123 as any)).toBe(false);
      expect(isValidColor(null as any)).toBe(false);
      expect(isValidColor(undefined as any)).toBe(false);
      expect(isValidColor({} as any)).toBe(false);
    });

    it('should support disabling validation logging', () => {
      const COLORS = ['red', 'green', 'blue'] as const;
      const isValidColor = createEnumValidator(COLORS, 'color', { logInvalid: false });

      expect(isValidColor('yellow')).toBe(false);
      // No assertion on logging - just verifying it doesn't crash
    });
  });

  describe('createArrayValidator()', () => {
    it('should validate that value is an array', () => {
      const isArray = createArrayValidator();

      expect(isArray([])).toBe(true);
      expect(isArray([1, 2, 3])).toBe(true);
      expect(isArray(['a', 'b'])).toBe(true);
    });

    it('should reject non-array values', () => {
      const isArray = createArrayValidator();

      expect(isArray('not an array')).toBe(false);
      expect(isArray(123)).toBe(false);
      expect(isArray({})).toBe(false);
      expect(isArray(null)).toBe(false);
    });

    it('should validate minimum length', () => {
      const isArray = createArrayValidator(undefined, { minLength: 2 });

      expect(isArray([1])).toBe(false);
      expect(isArray([1, 2])).toBe(true);
      expect(isArray([1, 2, 3])).toBe(true);
    });

    it('should validate maximum length', () => {
      const isArray = createArrayValidator(undefined, { maxLength: 3 });

      expect(isArray([1, 2, 3])).toBe(true);
      expect(isArray([1, 2, 3, 4])).toBe(false);
    });

    it('should validate array items with custom validator', () => {
      const isString = (item: unknown): item is string => typeof item === 'string';
      const isStringArray = createArrayValidator(isString);

      expect(isStringArray(['a', 'b', 'c'])).toBe(true);
      expect(isStringArray(['a', 1, 'c'])).toBe(false);
      expect(isStringArray([1, 2, 3])).toBe(false);
    });

    it('should validate all items in the array', () => {
      const isPositive = (item: unknown): item is number =>
        typeof item === 'number' && item > 0;
      const isPositiveArray = createArrayValidator(isPositive);

      expect(isPositiveArray([1, 2, 3])).toBe(true);
      expect(isPositiveArray([1, -1, 3])).toBe(false);
      expect(isPositiveArray([1, 2, 0])).toBe(false);
    });

    it('should support custom field name for logging', () => {
      const isArray = createArrayValidator(undefined, {
        minLength: 1,
        fieldName: 'tags'
      });

      expect(isArray([])).toBe(false);
    });
  });

  describe('createStringValidator()', () => {
    it('should validate string type', () => {
      const isString = createStringValidator({});

      expect(isString('hello')).toBe(true);
      expect(isString('')).toBe(true);
      expect(isString(123)).toBe(false);
      expect(isString(null)).toBe(false);
    });

    it('should validate minimum length', () => {
      const isString = createStringValidator({ minLength: 3 });

      expect(isString('ab')).toBe(false);
      expect(isString('abc')).toBe(true);
      expect(isString('abcd')).toBe(true);
    });

    it('should validate maximum length', () => {
      const isString = createStringValidator({ maxLength: 5 });

      expect(isString('hello')).toBe(true);
      expect(isString('hello world')).toBe(false);
    });

    it('should validate pattern matching', () => {
      const isEmail = createStringValidator({
        pattern: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        fieldName: 'email'
      });

      expect(isEmail('test@example.com')).toBe(true);
      expect(isEmail('invalid-email')).toBe(false);
      expect(isEmail('test@')).toBe(false);
    });

    it('should validate alphanumeric pattern', () => {
      const isAlphanumeric = createStringValidator({
        pattern: /^[a-z0-9]+$/i
      });

      expect(isAlphanumeric('abc123')).toBe(true);
      expect(isAlphanumeric('test-123')).toBe(false);
      expect(isAlphanumeric('test 123')).toBe(false);
    });

    it('should combine multiple constraints', () => {
      const isUsername = createStringValidator({
        minLength: 3,
        maxLength: 20,
        pattern: /^[a-z0-9_]+$/i,
        fieldName: 'username'
      });

      expect(isUsername('user123')).toBe(true);
      expect(isUsername('ab')).toBe(false); // Too short
      expect(isUsername('a'.repeat(25))).toBe(false); // Too long
      expect(isUsername('user-123')).toBe(false); // Invalid character
    });
  });

  describe('createNumberValidator()', () => {
    it('should validate number type', () => {
      const isNumber = createNumberValidator({});

      expect(isNumber(42)).toBe(true);
      expect(isNumber(0)).toBe(true);
      expect(isNumber(-10)).toBe(true);
      expect(isNumber(3.14)).toBe(true);
    });

    it('should reject non-number values', () => {
      const isNumber = createNumberValidator({});

      expect(isNumber('123')).toBe(false);
      expect(isNumber(null)).toBe(false);
      expect(isNumber(undefined)).toBe(false);
      expect(isNumber(NaN)).toBe(false);
    });

    it('should validate minimum value', () => {
      const isNumber = createNumberValidator({ min: 0 });

      expect(isNumber(-1)).toBe(false);
      expect(isNumber(0)).toBe(true);
      expect(isNumber(10)).toBe(true);
    });

    it('should validate maximum value', () => {
      const isNumber = createNumberValidator({ max: 100 });

      expect(isNumber(100)).toBe(true);
      expect(isNumber(101)).toBe(false);
      expect(isNumber(50)).toBe(true);
    });

    it('should validate integer constraint', () => {
      const isInteger = createNumberValidator({ integer: true });

      expect(isInteger(42)).toBe(true);
      expect(isInteger(0)).toBe(true);
      expect(isInteger(-10)).toBe(true);
      expect(isInteger(3.14)).toBe(false);
      expect(isInteger(1.5)).toBe(false);
    });

    it('should combine multiple constraints', () => {
      const isAge = createNumberValidator({
        min: 0,
        max: 120,
        integer: true,
        fieldName: 'age'
      });

      expect(isAge(25)).toBe(true);
      expect(isAge(-1)).toBe(false);
      expect(isAge(150)).toBe(false);
      expect(isAge(25.5)).toBe(false);
    });
  });

  describe('createObjectValidator()', () => {
    it('should validate object type', () => {
      const isObject = createObjectValidator({});

      expect(isObject({})).toBe(true);
      expect(isObject({ name: 'test' })).toBe(true);
    });

    it('should reject non-object values', () => {
      const isObject = createObjectValidator({});

      expect(isObject('string')).toBe(false);
      expect(isObject(123)).toBe(false);
      expect(isObject(null)).toBe(false);
      expect(isObject([])).toBe(false);
    });

    it('should validate required fields', () => {
      const isUser = createObjectValidator({
        requiredFields: ['id', 'name', 'email'],
        fieldName: 'user'
      });

      expect(isUser({ id: 1, name: 'John', email: 'john@example.com' })).toBe(true);
      expect(isUser({ id: 1, name: 'John' })).toBe(false); // Missing email
      expect(isUser({ name: 'John', email: 'john@example.com' })).toBe(false); // Missing id
    });

    it('should allow extra fields when optionalFields not specified', () => {
      const isUser = createObjectValidator({
        requiredFields: ['id', 'name'],
        fieldName: 'user'
      });

      expect(isUser({ id: 1, name: 'John', age: 30, city: 'NYC' })).toBe(true);
    });

    it('should validate optional fields when specified', () => {
      const isUser = createObjectValidator({
        requiredFields: ['id', 'name'],
        optionalFields: ['email', 'age'],
        fieldName: 'user'
      });

      expect(isUser({ id: 1, name: 'John' })).toBe(true);
      expect(isUser({ id: 1, name: 'John', email: 'john@example.com' })).toBe(true);
      expect(isUser({ id: 1, name: 'John', city: 'NYC' })).toBe(false); // Unexpected field
    });

    it('should reject objects with unexpected fields when optionalFields specified', () => {
      const isUser = createObjectValidator({
        requiredFields: ['id'],
        optionalFields: ['name'],
        fieldName: 'user'
      });

      expect(isUser({ id: 1, name: 'John', email: 'test@example.com' })).toBe(false);
    });
  });

  describe('createCompositeValidator()', () => {
    it('should combine multiple validators with AND logic', () => {
      const isPositive = (val: unknown): val is number =>
        typeof val === 'number' && val > 0;
      const isInteger = (val: unknown): val is number =>
        typeof val === 'number' && Number.isInteger(val);

      const isPositiveInteger = createCompositeValidator(isPositive, isInteger);

      expect(isPositiveInteger(5)).toBe(true);
      expect(isPositiveInteger(-5)).toBe(false); // Not positive
      expect(isPositiveInteger(3.14)).toBe(false); // Not integer
      expect(isPositiveInteger('5')).toBe(false); // Not number
    });

    it('should work with created validators', () => {
      const isLongString = createStringValidator({ minLength: 5 });
      const hasNumbers = (val: unknown): val is string =>
        typeof val === 'string' && /\d/.test(val);

      const isLongStringWithNumbers = createCompositeValidator(isLongString, hasNumbers);

      expect(isLongStringWithNumbers('test123')).toBe(true);
      expect(isLongStringWithNumbers('test')).toBe(false); // Too short
      expect(isLongStringWithNumbers('testing')).toBe(false); // No numbers
    });

    it('should return false if any validator fails', () => {
      const validator1 = (val: unknown): val is string => typeof val === 'string';
      const validator2 = (val: unknown): val is string => typeof val === 'string' && val.length > 5;
      const validator3 = (val: unknown): val is string => typeof val === 'string' && val.includes('test');

      const composite = createCompositeValidator(validator1, validator2, validator3);

      expect(composite('testing')).toBe(true);
      expect(composite('test')).toBe(false); // Fails validator2 (length)
      expect(composite('example')).toBe(false); // Fails validator3 (no 'test')
    });

    it('should handle empty validator list', () => {
      const composite = createCompositeValidator<any>();

      expect(composite('anything')).toBe(true);
      expect(composite(123)).toBe(true);
    });
  });

  describe('createNullableValidator()', () => {
    it('should allow null values', () => {
      const isNumberOrNull = createNullableValidator(
        createNumberValidator({ min: 0 })
      );

      expect(isNumberOrNull(null)).toBe(true);
      expect(isNumberOrNull(10)).toBe(true);
      expect(isNumberOrNull(-5)).toBe(false);
    });

    it('should work with string validators', () => {
      const isStringOrNull = createNullableValidator(
        createStringValidator({ minLength: 3 })
      );

      expect(isStringOrNull(null)).toBe(true);
      expect(isStringOrNull('hello')).toBe(true);
      expect(isStringOrNull('hi')).toBe(false);
      expect(isStringOrNull(123)).toBe(false);
    });

    it('should work with array validators', () => {
      const isString = (item: unknown): item is string => typeof item === 'string';
      const isStringArrayOrNull = createNullableValidator(
        createArrayValidator(isString)
      );

      expect(isStringArrayOrNull(null)).toBe(true);
      expect(isStringArrayOrNull(['a', 'b'])).toBe(true);
      expect(isStringArrayOrNull([1, 2])).toBe(false);
    });

    it('should work with composite validators', () => {
      const isPositive = (val: unknown): val is number =>
        typeof val === 'number' && val > 0;
      const isEven = (val: unknown): val is number =>
        typeof val === 'number' && val % 2 === 0;

      const isPositiveEvenOrNull = createNullableValidator(
        createCompositeValidator(isPositive, isEven)
      );

      expect(isPositiveEvenOrNull(null)).toBe(true);
      expect(isPositiveEvenOrNull(4)).toBe(true);
      expect(isPositiveEvenOrNull(3)).toBe(false);
      expect(isPositiveEvenOrNull(-2)).toBe(false);
    });

    it('should not allow undefined', () => {
      const isNumberOrNull = createNullableValidator(
        createNumberValidator({})
      );

      expect(isNumberOrNull(null)).toBe(true);
      expect(isNumberOrNull(undefined)).toBe(false);
    });
  });

  describe('Integration Tests', () => {
    it('should create complex email validator', () => {
      const isEmail = createStringValidator({
        minLength: 5,
        maxLength: 100,
        pattern: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        fieldName: 'email'
      });

      expect(isEmail('test@example.com')).toBe(true);
      expect(isEmail('a@b.c')).toBe(false); // Too short
      expect(isEmail('invalid-email')).toBe(false);
    });

    it('should create complex user validator', () => {
      const isUser = createObjectValidator({
        requiredFields: ['id', 'username', 'email'],
        optionalFields: ['age', 'city'],
        fieldName: 'user'
      });

      const validUser = {
        id: 123,
        username: 'johndoe',
        email: 'john@example.com',
        age: 30
      };

      const invalidUser = {
        id: 123,
        username: 'johndoe',
        // Missing email
        age: 30
      };

      expect(isUser(validUser)).toBe(true);
      expect(isUser(invalidUser)).toBe(false);
    });

    it('should create validator for array of specific type', () => {
      const isPositiveNumber = (val: unknown): val is number =>
        typeof val === 'number' && val > 0;

      const isPositiveNumberArray = createArrayValidator(isPositiveNumber, {
        minLength: 1,
        maxLength: 10,
        fieldName: 'scores'
      });

      expect(isPositiveNumberArray([1, 2, 3])).toBe(true);
      expect(isPositiveNumberArray([])).toBe(false); // Too short
      expect(isPositiveNumberArray([1, -1, 3])).toBe(false); // Contains negative
      expect(isPositiveNumberArray([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])).toBe(false); // Too long
    });
  });
});
