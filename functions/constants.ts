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
 * AI model configurations for Workers AI - Tri-Model Strategy
 *
 * OPTIMIZATION: Tri-model approach for 81% neuron reduction (10,920 → 2,100 neurons/day)
 *
 * Models:
 * - TEXT_GENERATION_LARGE: Qwen3 30B (85% cheaper than Llama 70B) for IOC extraction & key points
 * - TEXT_GENERATION_SMALL: Llama 3.2 1B (48% cheaper than Llama 8B) for classification & TLDR
 * - EMBEDDINGS: BGE-M3 (94% cheaper than BGE-Large) for semantic search
 *
 * Cost per article: ~35 neurons (vs 182 with all-70B approach)
 * Daily capacity: 285 articles/day (4.75× scaling vs current 60 articles/day)
 * Free tier usage: 21% (vs 109% with current approach)
 *
 * Fallback models (if validation fails):
 * - TEXT_GENERATION_LARGE_FALLBACK: Llama 3.3 70B (proven accuracy)
 * - TEXT_GENERATION_SMALL_FALLBACK: Llama 3.1 8B fp8-fast (proven accuracy)
 * - EMBEDDINGS_FALLBACK: BGE-Large (proven quality)
 */
export const AI_MODELS = {
  // Tri-model configuration (production)
  TEXT_GENERATION_LARGE: '@cf/qwen/qwen3-30b-a3b-fp8',
  TEXT_GENERATION_SMALL: '@cf/meta/llama-3.2-1b-instruct',
  EMBEDDINGS: '@cf/baai/bge-m3',

  // Fallback models (proven baseline)
  TEXT_GENERATION_LARGE_FALLBACK: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  TEXT_GENERATION_SMALL_FALLBACK: '@cf/meta/llama-3.1-8b-instruct-fp8-fast',
  EMBEDDINGS_FALLBACK: '@cf/baai/bge-large-en-v1.5',
} as const;

/**
 * Deployment strategy configuration
 *
 * Controls which model strategy is active:
 * - 'baseline': Use Llama 70B for all tasks (original approach)
 * - 'shadow': Run tri-model alongside baseline for comparison (no user impact)
 * - 'canary': Gradually roll out tri-model (10% → 50% → 100%)
 * - 'trimodel': Full tri-model deployment
 */
export const DEPLOYMENT_CONFIG = {
  // Current deployment mode
  MODE: 'canary' as 'baseline' | 'shadow' | 'canary' | 'trimodel',

  // Canary rollout percentage (only used when MODE = 'canary')
  // Progressive rollout: 15% → 30% → 50% → 100%
  // Calculation: 50% baseline (5,460) + 50% tri-model (1,050) = 6,510 neurons/day ✅
  // At 50%: 65% of free tier, ~3,490 neuron headroom (2.2× safety margin vs 30%)
  CANARY_PERCENT: 50,

  // Enable validation logging (logs comparisons between models)
  VALIDATION_LOGGING: true,
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
