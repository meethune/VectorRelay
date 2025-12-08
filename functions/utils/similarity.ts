/**
 * Multi-Signal Similarity Scoring
 *
 * Combines 5 different signals to find truly related threats:
 * 1. Semantic similarity (embeddings) - 40% weight
 * 2. Content overlap (Jaccard) - 25% weight
 * 3. IOC overlap - 20% weight
 * 4. Temporal proximity - 10% weight
 * 5. Source diversity - 5% weight
 *
 * This approach is superior to embeddings-only because:
 * - Catches threats with shared IOCs (same infrastructure)
 * - Identifies campaign patterns (temporal clustering)
 * - Balances source diversity (avoid echo chambers)
 * - Combines semantic meaning with concrete technical indicators
 */

import type { Env } from '../types';

/**
 * Threat data needed for similarity calculation
 */
export interface ThreatForSimilarity {
  id: string;
  title: string;
  content: string;
  tldr?: string;
  category: string;
  severity: string;
  published_at: number;
  source: string;
  iocs: {
    ips?: string[];
    domains?: string[];
    cves?: string[];
    hashes?: string[];
    urls?: string[];
    emails?: string[];
  };
}

/**
 * Similarity result with detailed scoring breakdown
 */
export interface SimilarityScore {
  threatId: string;
  overallScore: number; // 0-1 composite score
  breakdown: {
    semantic: number; // 0-1
    content: number; // 0-1
    ioc: number; // 0-1
    temporal: number; // 0-1
    source: number; // 0-1
  };
  metadata: {
    title: string;
    category: string;
    severity: string;
    published_at: number;
  };
}

/**
 * Weights for each similarity signal (must sum to 1.0)
 */
const SIMILARITY_WEIGHTS = {
  SEMANTIC: 0.40, // Embeddings-based semantic similarity
  CONTENT: 0.25, // Jaccard similarity of text content
  IOC: 0.20, // Shared IOCs (infrastructure overlap)
  TEMPORAL: 0.10, // Time proximity (campaign detection)
  SOURCE: 0.05, // Source diversity bonus
} as const;

/**
 * Calculate multi-signal similarity between a source threat and candidates
 *
 * @param sourceThreat - The threat to find similar items for
 * @param candidates - Potential similar threats to score
 * @param semanticScores - Pre-computed semantic similarity scores from Vectorize
 * @returns Sorted array of similarity scores (highest first)
 */
export function calculateMultiSignalSimilarity(
  sourceThreat: ThreatForSimilarity,
  candidates: ThreatForSimilarity[],
  semanticScores: Map<string, number>
): SimilarityScore[] {
  const scores: SimilarityScore[] = [];

  for (const candidate of candidates) {
    // Skip self
    if (candidate.id === sourceThreat.id) {
      continue;
    }

    // Calculate all 5 signals
    const semantic = semanticScores.get(candidate.id) ?? 0;
    const content = calculateContentSimilarity(sourceThreat, candidate);
    const ioc = calculateIOCSimilarity(sourceThreat, candidate);
    const temporal = calculateTemporalProximity(sourceThreat, candidate);
    const source = calculateSourceDiversity(sourceThreat, candidate);

    // Weighted composite score
    const overallScore =
      semantic * SIMILARITY_WEIGHTS.SEMANTIC +
      content * SIMILARITY_WEIGHTS.CONTENT +
      ioc * SIMILARITY_WEIGHTS.IOC +
      temporal * SIMILARITY_WEIGHTS.TEMPORAL +
      source * SIMILARITY_WEIGHTS.SOURCE;

    scores.push({
      threatId: candidate.id,
      overallScore,
      breakdown: {
        semantic,
        content,
        ioc,
        temporal,
        source,
      },
      metadata: {
        title: candidate.title,
        category: candidate.category,
        severity: candidate.severity,
        published_at: candidate.published_at,
      },
    });
  }

  // Sort by overall score descending
  return scores.sort((a, b) => b.overallScore - a.overallScore);
}

/**
 * Signal 2: Content Overlap using Jaccard Similarity
 *
 * Measures word overlap between threat content.
 * Good for catching near-duplicate articles or variations of same story.
 */
function calculateContentSimilarity(
  source: ThreatForSimilarity,
  candidate: ThreatForSimilarity
): number {
  // Combine title + content + tldr for comprehensive comparison
  const sourceText = `${source.title} ${source.content} ${source.tldr || ''}`.toLowerCase();
  const candidateText = `${candidate.title} ${candidate.content} ${candidate.tldr || ''}`.toLowerCase();

  // Tokenize (simple word split, remove short words)
  const sourceWords = new Set(
    sourceText
      .split(/\s+/)
      .filter((w) => w.length > 3)
      .map((w) => w.replace(/[^a-z0-9]/g, ''))
  );

  const candidateWords = new Set(
    candidateText
      .split(/\s+/)
      .filter((w) => w.length > 3)
      .map((w) => w.replace(/[^a-z0-9]/g, ''))
  );

  // Jaccard similarity: intersection / union
  const intersection = new Set([...sourceWords].filter((w) => candidateWords.has(w)));
  const union = new Set([...sourceWords, ...candidateWords]);

  return union.size > 0 ? intersection.size / union.size : 0;
}

/**
 * Signal 3: IOC Overlap
 *
 * Measures shared indicators of compromise.
 * High IOC overlap = likely same infrastructure/campaign.
 *
 * Weights:
 * - CVEs: 40% (critical - same vulnerability)
 * - IPs: 25% (infrastructure overlap)
 * - Domains: 20% (infrastructure overlap)
 * - Hashes: 10% (same malware)
 * - URLs/Emails: 5% (less reliable indicators)
 */
function calculateIOCSimilarity(
  source: ThreatForSimilarity,
  candidate: ThreatForSimilarity
): number {
  const iocWeights = {
    cves: 0.40,
    ips: 0.25,
    domains: 0.20,
    hashes: 0.10,
    urls: 0.03,
    emails: 0.02,
  };

  let weightedScore = 0;

  // Calculate Jaccard for each IOC type
  for (const [type, weight] of Object.entries(iocWeights)) {
    const sourceIOCs = new Set(source.iocs[type as keyof typeof source.iocs] || []);
    const candidateIOCs = new Set(candidate.iocs[type as keyof typeof candidate.iocs] || []);

    if (sourceIOCs.size === 0 && candidateIOCs.size === 0) {
      continue; // No IOCs of this type - skip
    }

    const intersection = new Set([...sourceIOCs].filter((ioc) => candidateIOCs.has(ioc)));
    const union = new Set([...sourceIOCs, ...candidateIOCs]);

    const jaccardScore = union.size > 0 ? intersection.size / union.size : 0;
    weightedScore += jaccardScore * weight;
  }

  return weightedScore;
}

/**
 * Signal 4: Temporal Proximity
 *
 * Threats published close together in time are more likely related
 * (campaigns, coordinated attacks, reactive coverage).
 *
 * Scoring:
 * - Same day: 1.0
 * - Within 1 week: 0.8
 * - Within 1 month: 0.5
 * - Within 3 months: 0.2
 * - Older: 0.0
 */
function calculateTemporalProximity(
  source: ThreatForSimilarity,
  candidate: ThreatForSimilarity
): number {
  const timeDiff = Math.abs(source.published_at - candidate.published_at);
  const daysDiff = timeDiff / 86400; // Convert seconds to days

  if (daysDiff < 1) return 1.0; // Same day
  if (daysDiff < 7) return 0.8; // Within a week
  if (daysDiff < 30) return 0.5; // Within a month
  if (daysDiff < 90) return 0.2; // Within 3 months
  return 0.0; // Too old to be immediately related
}

/**
 * Signal 5: Source Diversity
 *
 * Penalize same-source threats, reward cross-source validation.
 * This prevents echo chambers and ensures diverse perspectives.
 *
 * Scoring:
 * - Different source: 1.0 (diverse perspective - good!)
 * - Same source: 0.0 (echo chamber - bad!)
 */
function calculateSourceDiversity(
  source: ThreatForSimilarity,
  candidate: ThreatForSimilarity
): number {
  return source.source === candidate.source ? 0.0 : 1.0;
}

/**
 * Fetch candidate threats for similarity comparison
 *
 * Uses optimized database query with:
 * - Category filter (same category more likely related)
 * - Time window (last 90 days for temporal relevance)
 * - Composite index (idx_summaries_category_generated)
 *
 * @param env - Cloudflare environment
 * @param sourceThreat - The threat to find similar items for
 * @param limit - Maximum candidates to fetch (default 50)
 * @returns Array of candidate threats
 */
export async function fetchCandidateThreats(
  env: Env,
  sourceThreat: ThreatForSimilarity,
  limit = 50
): Promise<ThreatForSimilarity[]> {
  // Fetch threats in same category from last 90 days
  // Uses idx_summaries_category_generated index (optimized in migration!)
  const threeMonthsAgo = sourceThreat.published_at - 90 * 86400;

  const threatsResult = await env.DB.prepare(
    `SELECT
      t.id,
      t.title,
      t.content,
      t.source,
      t.published_at,
      s.tldr,
      s.category,
      s.severity
    FROM threats t
    JOIN summaries s ON t.id = s.threat_id
    WHERE s.category = ?
      AND t.published_at > ?
      AND t.id != ?
    ORDER BY t.published_at DESC
    LIMIT ?`
  )
    .bind(sourceThreat.category, threeMonthsAgo, sourceThreat.id, limit)
    .all();

  if (!threatsResult.results || threatsResult.results.length === 0) {
    return [];
  }

  // Fetch IOCs for all candidates in a single query (performance optimization)
  const threatIds = threatsResult.results.map((t: any) => t.id);

  // Security: Validate threat IDs before dynamic SQL placeholder construction
  // Even though these come from database results, enforce defense-in-depth
  if (threatIds.length > 100) {
    // Hard cap to prevent excessive placeholders
    threatIds.splice(100);
  }

  // Security: Validate all IDs match expected format (alphanumeric, 8-20 chars)
  const validIds = threatIds.filter(id =>
    typeof id === 'string' &&
    id.length >= 8 &&
    id.length <= 20 &&
    /^[a-z0-9]+$/i.test(id)
  );

  if (validIds.length === 0) {
    // No valid IDs - return candidates without IOC data
    return threatsResult.results.map((t: any) => ({
      id: t.id,
      title: t.title,
      content: t.content,
      tldr: t.tldr,
      category: t.category,
      severity: t.severity,
      published_at: t.published_at,
      source: t.source,
      iocs: {
        ips: [],
        domains: [],
        cves: [],
        hashes: [],
        urls: [],
        emails: [],
      },
    }));
  }

  const placeholders = validIds.map(() => '?').join(',');

  const iocsResult = await env.DB.prepare(
    `SELECT threat_id, ioc_type, ioc_value
     FROM iocs
     WHERE threat_id IN (${placeholders})`
  )
    .bind(...validIds)
    .all();

  // Group IOCs by threat_id
  const iocsByThreat = new Map<string, any>();
  for (const ioc of iocsResult.results || []) {
    const threatId = (ioc as any).threat_id;
    if (!iocsByThreat.has(threatId)) {
      iocsByThreat.set(threatId, {
        ips: [],
        domains: [],
        cves: [],
        hashes: [],
        urls: [],
        emails: [],
      });
    }

    const iocType = (ioc as any).ioc_type;
    const iocValue = (ioc as any).ioc_value;

    // Map singular types to plural keys
    const iocKey = iocType === 'ip' ? 'ips' :
                   iocType === 'domain' ? 'domains' :
                   iocType === 'cve' ? 'cves' :
                   iocType === 'hash' ? 'hashes' :
                   iocType === 'url' ? 'urls' :
                   iocType === 'email' ? 'emails' : null;

    if (iocKey) {
      iocsByThreat.get(threatId)![iocKey].push(iocValue);
    }
  }

  // Build candidate threat objects
  return threatsResult.results.map((t: any) => ({
    id: t.id,
    title: t.title,
    content: t.content,
    tldr: t.tldr,
    category: t.category,
    severity: t.severity,
    published_at: t.published_at,
    source: t.source,
    iocs: iocsByThreat.get(t.id) || {
      ips: [],
      domains: [],
      cves: [],
      hashes: [],
      urls: [],
      emails: [],
    },
  }));
}
