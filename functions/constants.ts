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
 *
 * Expanded (2025-12-08): Added 7 new categories to reduce "other" misclassification
 * - cloud_security: Cloud infrastructure attacks (AWS, Azure, GCP)
 * - web_security: Web application vulnerabilities (XSS, SQLi, RCE)
 * - zero_day: Zero-day exploits (critical priority)
 * - cryptojacking: Cryptocurrency mining malware
 * - iot_security: IoT/embedded device threats
 * - disinformation: Fake news, influence operations
 * - policy: Legal, regulatory, and policy updates
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
  'cloud_security',
  'web_security',
  'zero_day',
  'cryptojacking',
  'iot_security',
  'disinformation',
  'policy',
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
 * OPTIMIZATION: Tri-model approach for 67% neuron reduction (10,920 → 3,600 neurons/day)
 *
 * Models:
 * - TEXT_GENERATION_LARGE: Qwen3 30B (85% cheaper than Llama 70B) for IOC extraction & key points
 * - TEXT_GENERATION_SMALL: Mistral-Small-3.1 24B for classification & TLDR
 * - EMBEDDINGS: BGE-M3 (94% cheaper than BGE-Large) for semantic search
 *
 * UPGRADE (2025-12-08): Switched to Mistral-Small-3.1-24B for classification
 * - Previous: Llama 1B/8B insufficient for nuanced threat classification
 * - New: Mistral-Small 24B - state-of-the-art instruction-following, NOT Llama-based
 * - Cost: ~60 neurons/article (vs 48 with 8B, 182 with all-70B)
 * - Daily capacity: ~166 articles/day (3× scaling vs baseline 55 articles/day)
 * - Free tier usage: ~36% (safe headroom for growth)
 * - Benefits: Superior nuanced reasoning for edge cases (cloud vs web, zero-day vs vuln)
 *
 * Fallback models (if validation fails):
 * - TEXT_GENERATION_LARGE_FALLBACK: Llama 3.3 70B (proven accuracy)
 * - TEXT_GENERATION_SMALL_FALLBACK: Llama 3.1 8B (strong safety net)
 * - EMBEDDINGS_FALLBACK: BGE-Large (proven quality)
 */
export const AI_MODELS = {
  // Tri-model configuration (production) - UPGRADED to Mistral-Small 24B
  TEXT_GENERATION_LARGE: '@cf/qwen/qwen3-30b-a3b-fp8',
  TEXT_GENERATION_SMALL: '@cf/mistralai/mistral-small-3.1-24b-instruct',  // UPGRADED to Mistral-Small 24B
  EMBEDDINGS: '@cf/baai/bge-m3',

  // Fallback models (proven baseline)
  TEXT_GENERATION_LARGE_FALLBACK: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  TEXT_GENERATION_SMALL_FALLBACK: '@cf/meta/llama-3.1-8b-instruct-fp8-fast',  // Llama 8B as fallback
  EMBEDDINGS_FALLBACK: '@cf/baai/bge-large-en-v1.5',
} as const;

/**
 * Deployment strategy configuration
 *
 * Controls which model strategy is active:
 * - 'baseline': Use Llama 70B for all tasks (original approach)
 * - 'shadow': Run tri-model alongside baseline for comparison (no user impact)
 * - 'canary': Gradually roll out tri-model (10% → 30% → 50% → 100%)
 * - 'trimodel': Full tri-model deployment
 *
 * CANARY ROLLOUT (2025-12-08): Testing Mistral-Small-3.1-24B tri-model at 30%
 * - Upgraded from Llama 1B → Mistral-Small 24B for better classification
 * - Added 7 new threat categories to reduce "other" misclassification
 * - Enhanced prompts with detailed rules and examples
 * - Expected impact: 40% → 12% "other" classification
 * - Cost: 30% canary = 70% baseline (6,370) + 30% tri-model (1,080) = 7,450 neurons/day
 * - Free tier usage: ~74% (safe with AI Gateway 30-40% caching)
 */
export const DEPLOYMENT_CONFIG = {
  // Current deployment mode - CANARY testing at 30%
  MODE: 'canary' as 'baseline' | 'shadow' | 'canary' | 'trimodel',

  // Canary rollout percentage (only used when MODE = 'canary')
  // Progressive rollout: 10% → 30% → 50% → 100%
  // Starting conservative at 30% to validate Mistral-Small performance
  CANARY_PERCENT: 30,

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
export type ThreatSeverity = (typeof THREAT_SEVERITIES)[number];
