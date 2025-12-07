/**
 * Shared Constants for VectorRelay Threat Intelligence Dashboard
 *
 * This file contains all shared constants used across the application
 * to maintain consistency and enable type-safe enumerations.
 *
 * IMPORTANT: This is the single source of truth for:
 * - Threat categories
 * - Threat severities
 * - AI model configurations
 */

/**
 * Valid threat categories in the system
 *
 * These categories are used for:
 * - Threat classification
 * - Filter dropdowns
 * - Validation
 * - Database queries
 */
export const THREAT_CATEGORIES = [
  'ransomware',
  'apt',
  'vulnerability',
  'phishing',
  'malware',
  'data_breach',
  'ddos',
  'supply_chain',
  'insider_threat',
  'other',
] as const;

/**
 * Valid threat severity levels
 *
 * Ordered from highest to lowest severity:
 * - critical: Immediate action required
 * - high: Urgent attention needed
 * - medium: Important but not urgent
 * - low: Minor concern
 * - info: Informational only
 */
export const THREAT_SEVERITIES = [
  'critical',
  'high',
  'medium',
  'low',
  'info',
] as const;

/**
 * AI model configurations for Workers AI
 *
 * These models are used for:
 * - TEXT_GENERATION: Article analysis, trend analysis, and text generation
 * - EMBEDDINGS: Semantic search and similarity matching
 */
export const AI_MODELS = {
  TEXT_GENERATION: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  EMBEDDINGS: '@cf/baai/bge-large-en-v1.5',
} as const;

/**
 * TypeScript type for valid threat categories
 *
 * Usage:
 * ```typescript
 * const category: ThreatCategory = 'ransomware'; // Valid
 * const invalid: ThreatCategory = 'invalid'; // Type error
 * ```
 */
export type ThreatCategory = typeof THREAT_CATEGORIES[number];

/**
 * TypeScript type for valid threat severities
 *
 * Usage:
 * ```typescript
 * const severity: ThreatSeverity = 'critical'; // Valid
 * const invalid: ThreatSeverity = 'invalid'; // Type error
 * ```
 */
export type ThreatSeverity = typeof THREAT_SEVERITIES[number];
