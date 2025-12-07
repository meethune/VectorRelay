/**
 * Text Processing Utilities for VectorRelay
 *
 * Provides common text manipulation functions used across the application.
 *
 * Features:
 * - Text truncation with customizable suffix
 * - Length-aware string operations
 * - Consistent text handling
 *
 * @example
 * ```typescript
 * const short = truncateText(longArticle, 1000);
 * const preview = truncateText(content, 500, '... [Read more]');
 * ```
 */

/**
 * Truncates text to a maximum length, adding a suffix if truncated
 *
 * @param text - The text to truncate
 * @param maxLength - Maximum length (inclusive)
 * @param suffix - Suffix to add when truncated (default: '...')
 * @returns The truncated text with suffix, or original if within limit
 *
 * @example
 * ```typescript
 * truncateText('Hello World', 5)
 * // Returns: 'Hello...'
 *
 * truncateText('Hello World', 5, ' →')
 * // Returns: 'Hello →'
 *
 * truncateText('Short', 100)
 * // Returns: 'Short' (no truncation needed)
 * ```
 */
export function truncateText(
  text: string,
  maxLength: number,
  suffix = '...'
): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + suffix;
}

/**
 * Truncates text to fit within token limits (rough estimation)
 * Assumes ~4 characters per token as a rough average
 *
 * @param text - The text to truncate
 * @param maxTokens - Maximum number of tokens
 * @param suffix - Suffix to add when truncated
 * @returns The truncated text
 *
 * @example
 * ```typescript
 * const limited = truncateToTokens(article, 1000);
 * // Truncates to roughly 4000 characters (1000 tokens * 4)
 * ```
 */
export function truncateToTokens(
  text: string,
  maxTokens: number,
  suffix = '...'
): string {
  // Rough estimation: 1 token ≈ 4 characters
  const maxChars = maxTokens * 4;
  return truncateText(text, maxChars, suffix);
}

/**
 * Counts the approximate number of words in text
 *
 * @param text - The text to count
 * @returns Approximate word count
 *
 * @example
 * ```typescript
 * countWords('Hello world from TypeScript')
 * // Returns: 4
 * ```
 */
export function countWords(text: string): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Extracts the first N sentences from text
 *
 * @param text - The text to extract from
 * @param count - Number of sentences to extract
 * @returns The first N sentences
 *
 * @example
 * ```typescript
 * const summary = extractSentences(article, 2);
 * // Returns first 2 sentences
 * ```
 */
export function extractSentences(text: string, count: number): string {
  if (!text) return '';

  // Split on sentence boundaries (., !, ?)
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  return sentences.slice(0, count).join(' ').trim();
}
