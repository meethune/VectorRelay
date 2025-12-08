// Helper functions for AI processing integration tests
// These mirror the logic from functions/scheduled.ts but are importable for testing

import type { Env, Threat } from '../../../functions/types';
import type { NeuronTracker } from '../../../functions/utils/neuron-tracker';
import { analyzeArticle, generateEmbedding } from '../../../functions/utils/ai-processor';

// Process threats that don't have AI analysis yet
export async function processAIPendingThreats(
  env: Env,
  maxProcessing: number
): Promise<number> {
  let processed = 0;

  try {
    // Find threats that don't have summaries yet (pending AI processing)
    const pendingThreats = await env.DB.prepare(
      `SELECT t.id, t.title, t.content, t.source, t.published_at
       FROM threats t
       LEFT JOIN summaries s ON t.id = s.threat_id
       WHERE s.threat_id IS NULL
       ORDER BY t.published_at DESC
       LIMIT ?`
    )
      .bind(maxProcessing)
      .all<Threat>();

    if (!pendingThreats.results || pendingThreats.results.length === 0) {
      return 0;
    }

    // Process each threat with AI
    for (const threat of pendingThreats.results) {
      try {
        await processArticleWithAI(env, threat);
        processed++;
      } catch (error) {
        // Continue processing other threats even if one fails
      }
    }

    return processed;
  } catch (error) {
    return processed;
  }
}

// Process article with AI analysis
export async function processArticleWithAI(
  env: Env,
  threat: Threat,
  tracker?: NeuronTracker
): Promise<void> {
  try {
    // Generate AI analysis
    const analysis = await analyzeArticle(env, threat, tracker);
    if (!analysis) {
      // Insert empty summary to mark as processed and avoid retrying
      await env.DB.prepare(
        `INSERT INTO summaries (threat_id, tldr, key_points, category, severity, confidence_score, model_strategy, generated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          threat.id,
          'AI analysis unavailable',
          JSON.stringify([]),
          'other',
          'info',
          0.0,
          null, // No model strategy for failed analysis
          Math.floor(Date.now() / 1000)
        )
        .run();
      return;
    }

    const now = Math.floor(Date.now() / 1000);

    // Store summary
    await env.DB.prepare(
      `INSERT INTO summaries
       (threat_id, tldr, key_points, category, severity, affected_sectors, threat_actors, confidence_score, model_strategy, generated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        threat.id,
        analysis.tldr,
        JSON.stringify(analysis.key_points),
        analysis.category,
        analysis.severity,
        JSON.stringify(analysis.affected_sectors || []),
        JSON.stringify(analysis.threat_actors || []),
        0.85, // Confidence score
        analysis.model_strategy || null, // Track which AI strategy was used
        now
      )
      .run();

    // Store IOCs
    const allIOCs: Array<{ type: string; value: string }> = [
      ...(analysis.iocs.ips || []).map((ip) => ({ type: 'ip', value: ip })),
      ...(analysis.iocs.domains || []).map((d) => ({ type: 'domain', value: d })),
      ...(analysis.iocs.cves || []).map((cve) => ({ type: 'cve', value: cve })),
      ...(analysis.iocs.hashes || []).map((h) => ({ type: 'hash', value: h })),
      ...(analysis.iocs.urls || []).map((u) => ({ type: 'url', value: u })),
      ...(analysis.iocs.emails || []).map((e) => ({ type: 'email', value: e })),
    ];

    for (const ioc of allIOCs) {
      try {
        await env.DB.prepare(
          `INSERT INTO iocs (threat_id, ioc_type, ioc_value, first_seen, last_seen)
           VALUES (?, ?, ?, ?, ?)`
        )
          .bind(threat.id, ioc.type, ioc.value, now, now)
          .run();
      } catch (iocError) {
        // Skip duplicate IOCs silently
        if (iocError instanceof Error && iocError.message.includes('UNIQUE')) {
          continue;
        }
        throw iocError;
      }
    }

    // Generate and store embedding for semantic search
    const embeddingText = `${threat.title} ${analysis.tldr} ${analysis.key_points.join(' ')}`;
    const embedding = await generateEmbedding(env, embeddingText, tracker);

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
  } catch (error) {
    throw error; // Re-throw to be caught by caller
  }
}
