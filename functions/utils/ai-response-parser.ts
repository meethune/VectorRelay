/**
 * AI Response Parsing Utilities for VectorRelay
 *
 * Provides utilities for parsing and handling responses from Workers AI.
 * Handles different response formats and extracts structured data.
 *
 * Features:
 * - Multi-format response parsing
 * - Type-safe extraction
 * - Error handling
 * - Fallback values
 *
 * @example
 * ```typescript
 * const analysis = parseAIResponse<AIAnalysis>(aiResponse);
 * const text = parseAITextResponse(aiResponse);
 * ```
 */

import { logWarning } from './logger';

/**
 * Parses an AI response and extracts JSON data
 *
 * Workers AI can return responses in different formats:
 * - { response: { ...data } } - New format with structured response
 * - { response: "json string" } - New format with JSON string
 * - "json string" - Legacy format
 * - { ...data } - Direct object
 *
 * @param response - The AI response to parse
 * @param options - Parsing options
 * @returns Parsed data or null if parsing fails
 *
 * @example
 * ```typescript
 * interface Analysis {
 *   category: string;
 *   severity: string;
 *   tldr: string;
 * }
 *
 * const analysis = parseAIResponse<Analysis>(aiResponse);
 * if (analysis) {
 *   console.log(analysis.category, analysis.severity);
 * }
 * ```
 */
export function parseAIResponse<T>(
  response: unknown,
  options?: {
    /**
     * Fallback value if parsing fails
     */
    fallbackValue?: T;

    /**
     * Whether to extract from a specific key
     */
    extractKey?: string;
  }
): T | null {
  try {
    // Case 1: Response is an object with 'response' property
    if (typeof response === 'object' && response !== null && 'response' in response) {
      const innerResponse = (response as any).response;

      // Case 1a: response.response is already an object
      if (typeof innerResponse === 'object' && innerResponse !== null) {
        return innerResponse as T;
      }

      // Case 1b: response.response is a JSON string
      if (typeof innerResponse === 'string') {
        // Try to extract JSON from the string
        const jsonMatch = innerResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]) as T;
        }

        // If no JSON found, try parsing the whole string
        try {
          return JSON.parse(innerResponse) as T;
        } catch {
          logWarning('Could not parse AI response string', {
            responsePreview: innerResponse.substring(0, 100),
          });
        }
      }
    }

    // Case 2: Response is a direct JSON string
    if (typeof response === 'string') {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as T;
      }
    }

    // Case 3: Response is already the target object
    if (typeof response === 'object' && response !== null) {
      return response as T;
    }

    // Parsing failed
    logWarning('Unexpected AI response format', {
      responseType: typeof response,
      hasResponse: typeof response === 'object' && response !== null && 'response' in response,
    });

    return options?.fallbackValue ?? null;
  } catch (error) {
    logWarning('Failed to parse AI response', {
      error: error instanceof Error ? error.message : String(error),
    });
    return options?.fallbackValue ?? null;
  }
}

/**
 * Parses an AI response and extracts text content
 *
 * @param response - The AI response
 * @param fallback - Fallback text if parsing fails
 * @returns Extracted text or fallback
 *
 * @example
 * ```typescript
 * const summary = parseAITextResponse(aiResponse, 'Unable to generate summary');
 * ```
 */
export function parseAITextResponse(
  response: unknown,
  fallback = ''
): string {
  try {
    // If response has a 'response' property and it's a string
    if (typeof response === 'object' && response !== null && 'response' in response) {
      const innerResponse = (response as any).response;
      if (typeof innerResponse === 'string') {
        return innerResponse;
      }
    }

    // If response is directly a string
    if (typeof response === 'string') {
      return response;
    }

    logWarning('Could not extract text from AI response', {
      responseType: typeof response,
    });

    return fallback;
  } catch (error) {
    logWarning('Failed to parse AI text response', {
      error: error instanceof Error ? error.message : String(error),
    });
    return fallback;
  }
}

/**
 * Validates that an AI response has required fields
 *
 * @param data - The parsed data to validate
 * @param requiredFields - Array of required field names
 * @returns True if all required fields are present and non-empty
 *
 * @example
 * ```typescript
 * const analysis = parseAIResponse<AIAnalysis>(response);
 * if (analysis && validateAIResponse(analysis, ['category', 'severity', 'tldr'])) {
 *   // All required fields present
 * }
 * ```
 */
export function validateAIResponse(
  data: Record<string, any> | null,
  requiredFields: string[]
): boolean {
  if (!data) return false;

  for (const field of requiredFields) {
    if (!(field in data) || !data[field]) {
      logWarning('AI response missing required field', {
        field,
        availableFields: Object.keys(data),
      });
      return false;
    }
  }

  return true;
}
