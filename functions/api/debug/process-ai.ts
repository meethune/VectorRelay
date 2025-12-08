// Process AI analysis for threats that don't have summaries yet
// Requires authentication via API key
import type { Env, Threat } from '../types';
import { analyzeArticle, generateEmbedding } from '../utils/ai-processor';
import { validateApiKey, unauthorizedResponse } from '../utils/auth';

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  // Security: Disable management endpoints in production
  // AI processing happens automatically during feed ingestion
  if (env.ENVIRONMENT === 'production') {
    return new Response(JSON.stringify({
      error: 'Endpoint disabled',
      message: 'This endpoint is disabled in production. AI processing happens automatically during feed ingestion.',
      note: 'All threats are analyzed inline when ingested by the cron trigger.'
    }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // In development, require API key
  if (!validateApiKey(request, env)) {
    return unauthorizedResponse();
  }

  const url = new URL(request.url);

  // Security: Hard cap on limit to prevent resource exhaustion
  const requestedLimit = parseInt(url.searchParams.get('limit') || '5');
  const limit = Math.min(Math.max(requestedLimit, 1), 10); // Min 1, Max 10

  const logs: string[] = [];

  if (requestedLimit > 10) {
    logs.push(`⚠️ Requested limit ${requestedLimit} exceeded maximum of 10, capped at 10`);
  }

  try {
    logs.push('Finding threats without AI analysis...');

    // Get threats that don't have summaries
    const threatsResult = await env.DB.prepare(`
      SELECT t.*
      FROM threats t
      LEFT JOIN summaries s ON t.id = s.threat_id
      WHERE s.id IS NULL
      LIMIT ?
    `).bind(limit).all<Threat>();

    const threats = threatsResult.results;
    logs.push(`Found ${threats.length} threats without summaries`);

    let processed = 0;
    let errors = 0;

    // Process each threat synchronously (await each one)
    for (const threat of threats) {
      try {
        logs.push(`Processing ${threat.title || threat.id}...`);

        // Generate AI analysis
        const analysis = await analyzeArticle(env, threat);
        if (!analysis) {
          logs.push(`  No AI analysis generated for ${threat.id}`);
          continue;
        }

        const now = Math.floor(Date.now() / 1000);

        // Store summary
        await env.DB.prepare(
          `INSERT INTO summaries
           (threat_id, tldr, key_points, category, severity, affected_sectors, threat_actors, confidence_score, generated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
          .bind(
            threat.id,
            analysis.tldr,
            JSON.stringify(analysis.key_points),
            analysis.category,
            analysis.severity,
            JSON.stringify(analysis.affected_sectors),
            JSON.stringify(analysis.threat_actors),
            0.85,
            now
          )
          .run();

        // Store IOCs
        const allIOCs: Array<{ type: string; value: string }> = [
          ...analysis.iocs.ips.map((ip) => ({ type: 'ip', value: ip })),
          ...analysis.iocs.domains.map((d) => ({ type: 'domain', value: d })),
          ...analysis.iocs.cves.map((cve) => ({ type: 'cve', value: cve })),
          ...analysis.iocs.hashes.map((h) => ({ type: 'hash', value: h })),
          ...analysis.iocs.urls.map((u) => ({ type: 'url', value: u })),
          ...analysis.iocs.emails.map((e) => ({ type: 'email', value: e })),
        ];

        for (const ioc of allIOCs) {
          await env.DB.prepare(
            `INSERT INTO iocs (threat_id, ioc_type, ioc_value, first_seen, last_seen)
             VALUES (?, ?, ?, ?, ?)`
          )
            .bind(threat.id, ioc.type, ioc.value, now, now)
            .run();
        }

        // Generate and store embedding
        const embeddingText = `${threat.title} ${analysis.tldr} ${analysis.key_points.join(' ')}`;
        const embedding = await generateEmbedding(env, embeddingText);

        if (embedding) {
          await env.VECTORIZE_INDEX.insert([
            {
              id: threat.id,
              values: embedding,
              metadata: {
                title: threat.title,
                category: analysis.category,
                severity: analysis.severity,
                published_at: threat.published_at,
              },
            },
          ]);
        }

        logs.push(`  ✓ Processed ${threat.id}`);
        processed++;

      } catch (error) {
        errors++;
        logs.push(`  ✗ Error processing ${threat.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    logs.push(`\nComplete! Processed: ${processed}, Errors: ${errors}`);

    return Response.json({
      success: true,
      processed,
      errors,
      logs,
      timestamp: new Date().toISOString()
    }, {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    logs.push(`Fatal error: ${error instanceof Error ? error.message : String(error)}`);
    return Response.json({
      success: false,
      logs,
      error: error instanceof Error ? error.message : String(error)
    }, {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
