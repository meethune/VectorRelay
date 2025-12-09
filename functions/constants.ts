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
 * OPTIMIZATION: Tri-model approach for 86% neuron reduction (10,920 → 1,515 neurons/day)
 *
 * Models:
 * - TEXT_GENERATION_LARGE: Qwen3 30B A3B FP8 (MoE) for IOC extraction & key points
 * - TEXT_GENERATION_SMALL: Qwen3 30B A3B FP8 (MoE) for classification & TLDR
 * - EMBEDDINGS: BGE-M3 (94% cheaper than BGE-Large) for semantic search
 *
 * UPGRADE (2025-12-08): Switched to Qwen3 30B A3B FP8 for classification (CANARY 30%)
 * - Previous: Mistral-Small-3.1-24B (~121 neurons/article for classification)
 * - New: Qwen3 30B A3B FP8 - 10x more params (30B total, 3.3B active) for same price
 * - Architecture: Mixture-of-Experts (128 experts, 8 active per task)
 * - MMLU: 76.6 (vs Mistral 24B ~70, Llama 3.2 3B 63.4) - superior classification
 * - Cost: ~17 neurons/article (7.1x cheaper than Mistral 24B!)
 * - Total per article: 17 (classification) + 33 (IOC) + 0.5 (embeddings) = 50.5 neurons
 * - Daily capacity: 198 articles/day at 100% tri-model (vs 64 with Mistral 24B)
 * - Free tier usage: 15% at 100% (was 155% with Mistral 24B at canary 30%)
 * - FP8 quantization: 95-98% accuracy vs full precision, 50% memory reduction
 * - Benefits: MoE routing = specialized experts for different threat types
 *
 * Fallback models (if validation fails):
 * - TEXT_GENERATION_LARGE_FALLBACK: Llama 3.3 70B (proven accuracy)
 * - TEXT_GENERATION_SMALL_FALLBACK: Llama 3.2 3B (efficient fallback)
 * - EMBEDDINGS_FALLBACK: BGE-Large (proven quality)
 */
export const AI_MODELS = {
  // Tri-model configuration (production) - UPGRADED to Qwen3 30B MoE
  TEXT_GENERATION_LARGE: '@cf/qwen/qwen3-30b-a3b-fp8',
  TEXT_GENERATION_SMALL: '@cf/qwen/qwen3-30b-a3b-fp8',  // UPGRADED to Qwen3 30B MoE
  EMBEDDINGS: '@cf/baai/bge-m3',

  // Fallback models (proven baseline)
  TEXT_GENERATION_LARGE_FALLBACK: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  TEXT_GENERATION_SMALL_FALLBACK: '@cf/meta/llama-3.2-3b-instruct',  // Llama 3B as efficient fallback
  EMBEDDINGS_FALLBACK: '@cf/baai/bge-large-en-v1.5',
} as const;

/**
 * Deployment strategy configuration
 *
 * Controls which model strategy is active:
 * - 'baseline': Llama 70B unified call (REVERTED - proven reliable)
 * - 'shadow': Run tri-model alongside baseline for comparison (no user impact)
 * - 'canary': Gradually roll out tri-model (10% → 30% → 50% → 100%)
 * - 'trimodel': Full tri-model deployment
 *
 * ROLLBACK (2025-12-09): Disabled canary due to Qwen 30B JSON failures
 * - Issue: Qwen 30B producing invalid/incomplete JSON (100% failure rate)
 * - Impact: All 10 articles in last cron run failed AI analysis
 * - Fallback: Articles defaulting to category="other", severity="info"
 * - Fix: Reverted baseline to Llama 70B (proven reliable JSON formatting)
 * - Status: Canary disabled, back to baseline mode
 * - Cost: 30 articles/run × 182 neurons = 5,460 neurons/day (55% of free tier)
 * - Next steps: Investigate Qwen 30B JSON formatting, improve prompts, re-test
 */
export const DEPLOYMENT_CONFIG = {
  // Current deployment mode - BASELINE (canary disabled due to Qwen 30B issues)
  MODE: 'baseline' as 'baseline' | 'shadow' | 'canary' | 'trimodel',

  // Canary rollout percentage (only used when MODE = 'canary')
  // DISABLED until Qwen 30B JSON reliability issues are resolved
  CANARY_PERCENT: 0,

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
