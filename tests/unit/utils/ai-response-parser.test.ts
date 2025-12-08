import { describe, it, expect } from 'vitest';
import {
  parseAIResponse,
  parseAITextResponse,
  validateAIResponse,
} from '../../../functions/utils/ai-response-parser';
import {
  AI_RESPONSE_STRUCTURED_OBJECT,
  AI_RESPONSE_JSON_STRING,
  AI_RESPONSE_JSON_WITH_PREAMBLE,
  AI_RESPONSE_DIRECT_JSON_STRING,
  AI_RESPONSE_DIRECT_OBJECT,
  AI_RESPONSE_MALFORMED_JSON,
  AI_RESPONSE_NON_JSON_STRING,
  AI_RESPONSE_EMPTY_OBJECT,
  AI_RESPONSE_NULL,
  AI_RESPONSE_UNDEFINED,
  AI_RESPONSE_EMPTY_STRING,
  AI_TEXT_RESPONSE_SIMPLE,
  AI_TEXT_RESPONSE_DIRECT_STRING,
  AI_RESPONSE_MISSING_REQUIRED_FIELDS,
  AI_RESPONSE_EMPTY_REQUIRED_FIELDS,
  AI_RESPONSE_COMPLETE,
  MockAIAnalysis,
} from '../../fixtures/ai-responses';

describe('AI Response Parser', () => {
  describe('parseAIResponse()', () => {
    it('should parse structured object response (Case 1a)', () => {
      const result = parseAIResponse<MockAIAnalysis>(AI_RESPONSE_STRUCTURED_OBJECT);

      expect(result).toBeTruthy();
      expect(result?.category).toBe('ransomware');
      expect(result?.severity).toBe('critical');
      expect(result?.tldr).toContain('ransomware');
      expect(result?.key_points).toHaveLength(3);
      expect(result?.affected_sectors).toContain('healthcare');
      expect(result?.threat_actors).toContain('BlackCat');
    });

    it('should parse JSON string response (Case 1b)', () => {
      const result = parseAIResponse<MockAIAnalysis>(AI_RESPONSE_JSON_STRING);

      expect(result).toBeTruthy();
      expect(result?.category).toBe('phishing');
      expect(result?.severity).toBe('high');
      expect(result?.tldr).toContain('Phishing');
      expect(result?.iocs.domains).toContain('fake-microsoft-login.com');
    });

    it('should extract JSON from text with preamble/postamble (Case 1c)', () => {
      const result = parseAIResponse<MockAIAnalysis>(AI_RESPONSE_JSON_WITH_PREAMBLE);

      expect(result).toBeTruthy();
      expect(result?.category).toBe('zero_day');
      expect(result?.severity).toBe('critical');
      expect(result?.iocs.cves).toContain('CVE-2025-0001');
    });

    it('should parse direct JSON string (Case 2)', () => {
      const result = parseAIResponse<MockAIAnalysis>(AI_RESPONSE_DIRECT_JSON_STRING);

      expect(result).toBeTruthy();
      expect(result?.category).toBe('malware');
      expect(result?.severity).toBe('medium');
      expect(result?.threat_actors).toContain('FluBot Gang');
    });

    it('should handle direct object response (Case 3)', () => {
      const result = parseAIResponse<MockAIAnalysis>(AI_RESPONSE_DIRECT_OBJECT);

      expect(result).toBeTruthy();
      expect(result?.category).toBe('vulnerability');
      expect(result?.severity).toBe('high');
      expect(result?.iocs.cves).toContain('CVE-2025-5678');
    });

    it('should handle malformed JSON gracefully', () => {
      const result = parseAIResponse<MockAIAnalysis>(AI_RESPONSE_MALFORMED_JSON);

      // Function is lenient - returns the object when inner parsing fails
      // This allows for objects that might already be in the correct format
      expect(result).toBeTruthy();
      expect(result).toHaveProperty('response');
    });

    it('should handle non-JSON string gracefully', () => {
      const result = parseAIResponse<MockAIAnalysis>(AI_RESPONSE_NON_JSON_STRING);

      // Function is lenient - when response.response is plain text, returns the wrapper object
      expect(result).toBeTruthy();
      expect(result).toHaveProperty('response');
    });

    it('should handle empty object gracefully', () => {
      const result = parseAIResponse<MockAIAnalysis>(AI_RESPONSE_EMPTY_OBJECT);

      // Empty object is still valid, just won't have the fields
      expect(result).toBeTruthy();
    });

    it('should return null for null input', () => {
      const result = parseAIResponse<MockAIAnalysis>(AI_RESPONSE_NULL);

      expect(result).toBeNull();
    });

    it('should return null for undefined input', () => {
      const result = parseAIResponse<MockAIAnalysis>(AI_RESPONSE_UNDEFINED);

      expect(result).toBeNull();
    });

    it('should handle empty string response gracefully', () => {
      const result = parseAIResponse<MockAIAnalysis>(AI_RESPONSE_EMPTY_STRING);

      // Function is lenient - returns the wrapper object even for empty strings
      expect(result).toBeTruthy();
      expect(result).toHaveProperty('response');
    });

    it('should use fallback value when parsing completely fails', () => {
      const fallback: MockAIAnalysis = {
        category: 'other',
        severity: 'info',
        tldr: 'Fallback analysis',
        key_points: [],
        affected_sectors: [],
        threat_actors: [],
        iocs: {
          ips: [],
          domains: [],
          cves: [],
          hashes: [],
          urls: [],
          emails: [],
        },
      };

      // Use a direct string with no JSON to trigger fallback
      const result = parseAIResponse<MockAIAnalysis>('plain text with no JSON', {
        fallbackValue: fallback,
      });

      expect(result).toEqual(fallback);
    });
  });

  describe('parseAITextResponse()', () => {
    it('should extract text from response object', () => {
      const result = parseAITextResponse(AI_TEXT_RESPONSE_SIMPLE);

      expect(result).toBe('This is a simple text summary of the threat.');
    });

    it('should handle direct string response', () => {
      const result = parseAITextResponse(AI_TEXT_RESPONSE_DIRECT_STRING);

      expect(result).toBe('Direct text response without wrapper.');
    });

    it('should return fallback for non-text response', () => {
      const result = parseAITextResponse(AI_RESPONSE_EMPTY_OBJECT, 'Fallback text');

      expect(result).toBe('Fallback text');
    });

    it('should return empty string as default fallback', () => {
      const result = parseAITextResponse(AI_RESPONSE_NULL);

      expect(result).toBe('');
    });

    it('should handle null input with custom fallback', () => {
      const result = parseAITextResponse(null, 'Custom fallback');

      expect(result).toBe('Custom fallback');
    });
  });

  describe('validateAIResponse()', () => {
    it('should validate response with all required fields present', () => {
      const result = validateAIResponse(AI_RESPONSE_COMPLETE, ['category', 'severity', 'tldr']);

      expect(result).toBe(true);
    });

    it('should fail validation when required fields are missing', () => {
      const result = validateAIResponse(AI_RESPONSE_MISSING_REQUIRED_FIELDS, [
        'category',
        'severity',
        'tldr',
      ]);

      expect(result).toBe(false);
    });

    it('should fail validation when required fields are empty strings', () => {
      const result = validateAIResponse(AI_RESPONSE_EMPTY_REQUIRED_FIELDS, [
        'category',
        'severity',
        'tldr',
      ]);

      expect(result).toBe(false);
    });

    it('should return false for null data', () => {
      const result = validateAIResponse(null, ['category', 'severity']);

      expect(result).toBe(false);
    });

    it('should validate subset of fields', () => {
      const result = validateAIResponse(AI_RESPONSE_COMPLETE, ['category']);

      expect(result).toBe(true);
    });

    it('should validate empty required fields list as true', () => {
      const result = validateAIResponse(AI_RESPONSE_COMPLETE, []);

      expect(result).toBe(true);
    });

    it('should handle objects with nested fields', () => {
      const data = {
        category: 'malware',
        severity: 'high',
        nested: {
          field: 'value',
        },
      };

      const result = validateAIResponse(data, ['category', 'severity', 'nested']);

      expect(result).toBe(true);
    });
  });
});
