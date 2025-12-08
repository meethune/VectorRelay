// API: Get single threat details with IOCs and multi-signal similarity
import type { Env } from '../../types';
import { securityMiddleware, wrapResponse, validateThreatId } from '../../utils/security';
import {
  fetchCandidateThreats,
  calculateMultiSignalSimilarity,
  type ThreatForSimilarity,
} from '../../utils/similarity';

/**
 * Helper function to group IOCs by type
 */
function groupIOCsByType(iocs: any[]): ThreatForSimilarity['iocs'] {
  const grouped: ThreatForSimilarity['iocs'] = {
    ips: [],
    domains: [],
    cves: [],
    hashes: [],
    urls: [],
    emails: [],
  };

  for (const ioc of iocs) {
    const type = ioc.ioc_type;
    const value = ioc.ioc_value;

    if (type === 'ip') grouped.ips!.push(value);
    else if (type === 'domain') grouped.domains!.push(value);
    else if (type === 'cve') grouped.cves!.push(value);
    else if (type === 'hash') grouped.hashes!.push(value);
    else if (type === 'url') grouped.urls!.push(value);
    else if (type === 'email') grouped.emails!.push(value);
  }

  return grouped;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, params, env }) => {
  // Apply security middleware with stricter rate limit (AI processing expensive)
  const securityCheck = await securityMiddleware(request, env, 'threat-detail', {
    rateLimit: { limit: 100, window: 600 }, // 100 requests per 10 minutes (stricter due to AI)
    cacheMaxAge: 600, // Cache for 10 minutes
    cachePrivacy: 'public',
  });

  if (!securityCheck.allowed) {
    return securityCheck.response!;
  }

  const threatId = params.id as string;

  if (!threatId) {
    const errorResponse = Response.json({ error: 'Threat ID is required' }, { status: 400 });
    return wrapResponse(errorResponse, { cacheMaxAge: 0 });
  }

  // Security: Validate threat ID format
  if (!validateThreatId(threatId)) {
    const errorResponse = Response.json({ error: 'Invalid threat ID format' }, { status: 400 });
    return wrapResponse(errorResponse, { cacheMaxAge: 0 });
  }

  try{
    // Get threat with summary
    const threat = await env.DB.prepare(
      `SELECT
        t.*,
        s.tldr,
        s.key_points,
        s.category,
        s.severity,
        s.affected_sectors,
        s.threat_actors,
        s.confidence_score
      FROM threats t
      LEFT JOIN summaries s ON t.id = s.threat_id
      WHERE t.id = ?`
    )
      .bind(threatId)
      .first();

    if (!threat) {
      const errorResponse = Response.json({ error: 'Threat not found' }, { status: 404 });
      // Cache 404s for 1 minute to prevent repeated lookups for non-existent threats
      return wrapResponse(errorResponse, { cacheMaxAge: 60 });
    }

    // Check if threat is archived in R2
    if (threat.archived && threat.r2_key) {
      try {
        console.log(`[Threat ${threatId}] Retrieving archived content from R2: ${threat.r2_key}`);
        const { retrieveArchivedThreat } = await import('../../utils/r2-storage');
        const archivedData = await retrieveArchivedThreat(env, threat.r2_key as string);

        if (archivedData) {
          // Merge archived content with D1 metadata
          threat.content = archivedData.content;
          console.log(`[Threat ${threatId}] Retrieved ${archivedData.content?.length || 0} bytes from R2`);
        } else {
          console.warn(`[Threat ${threatId}] Failed to retrieve from R2, using D1 metadata only`);
        }
      } catch (r2Error) {
        console.error(`[Threat ${threatId}] R2 retrieval error:`, r2Error);
        // Continue with D1 data only
      }
    }

    // Get IOCs
    const iocsResult = await env.DB.prepare('SELECT * FROM iocs WHERE threat_id = ?').bind(threatId).all();

    // Parse JSON fields
    const threatData: any = {
      ...threat,
      key_points: threat.key_points ? JSON.parse(threat.key_points as string) : [],
      affected_sectors: threat.affected_sectors ? JSON.parse(threat.affected_sectors as string) : [],
      threat_actors: threat.threat_actors ? JSON.parse(threat.threat_actors as string) : [],
      iocs: iocsResult.results,
    };

    // Find similar threats using multi-signal scoring
    try {
      // Build source threat object for similarity calculation
      const sourceThreat: ThreatForSimilarity = {
        id: threat.id as string,
        title: threat.title as string,
        content: threat.content as string,
        tldr: threat.tldr as string | undefined,
        category: threat.category as string,
        severity: threat.severity as string,
        published_at: threat.published_at as number,
        source: threat.source as string,
        iocs: groupIOCsByType(iocsResult.results),
      };

      // Step 1: Fetch candidate threats (same category, last 90 days)
      // Uses optimized idx_summaries_category_generated index
      const candidates = await fetchCandidateThreats(env, sourceThreat, 50);

      if (candidates.length > 0) {
        // Step 2: Get semantic similarity scores from Vectorize (signal 1)
        const semanticScores = new Map<string, number>();

        const embeddingText = `${threat.title} ${threat.tldr || ''}`;
        const embedding = await env.AI.run('@cf/baai/bge-large-en-v1.5', {
          text: embeddingText,
        });

        if (embedding && 'data' in embedding && Array.isArray(embedding.data)) {
          const vectorResults = await env.VECTORIZE_INDEX.query(embedding.data[0], {
            topK: 50, // Query for all candidates
            returnMetadata: true,
          });

          // Map Vectorize scores to candidate IDs
          for (const match of vectorResults.matches) {
            semanticScores.set(match.id, match.score);
          }
        }

        // Step 3: Calculate multi-signal similarity (combines 5 signals)
        const similarityScores = calculateMultiSignalSimilarity(
          sourceThreat,
          candidates,
          semanticScores
        );

        // Step 4: Return top 5 with detailed scoring
        threatData.similar_threats = similarityScores.slice(0, 5).map((score) => ({
          id: score.threatId,
          score: score.overallScore,
          title: score.metadata.title,
          category: score.metadata.category,
          severity: score.metadata.severity,
          published_at: score.metadata.published_at,
          // Include breakdown for debugging/transparency
          breakdown: score.breakdown,
        }));
      } else {
        threatData.similar_threats = [];
      }
    } catch (error) {
      console.error('Error finding similar threats:', error);
      threatData.similar_threats = [];
    }

    const response = Response.json(threatData);

    // Wrap response with security headers and cache
    return wrapResponse(response, {
      rateLimit: {
        limit: 100,
        remaining: securityCheck.rateLimitInfo!.remaining,
        resetAt: securityCheck.rateLimitInfo!.resetAt,
      },
      cacheMaxAge: 600, // Cache for 10 minutes
      cachePrivacy: 'public',
    });
  } catch (error) {
    console.error('Error fetching threat:', error);
    const errorResponse = Response.json({ error: 'Failed to fetch threat details' }, { status: 500 });
    return wrapResponse(errorResponse, { cacheMaxAge: 0 });
  }
};
