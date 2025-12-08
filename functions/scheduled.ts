// Scheduled Function - Runs every 6 hours to fetch threat intelligence feeds
// FREE-TIER OPTIMIZED: Staged processing to avoid "too many subrequests" errors
import type { Env, FeedSource, Threat } from './types';
import { parseFeed, parseDate, generateId } from './utils/rss-parser';
import { analyzeArticle, generateEmbedding } from './utils/ai-processor';
import { NeuronTracker } from './utils/neuron-tracker';

/// <reference types="@cloudflare/workers-types" />
/// <reference types="@cloudflare/workers-types/experimental" />

const MAX_AI_PROCESSING_PER_RUN = 10; // Optimized for tri-model: 10 * 3 = 30 AI calls + 12 feeds = 42 total

export const onSchedule = async ({ env }: { env: Env }): Promise<Response> => {
  console.log('Starting scheduled task...');

  // Check if this is the first day of the month (run monthly archival)
  const today = new Date();
  const isFirstOfMonth = today.getDate() === 1;

  if (isFirstOfMonth) {
    console.log('🗄️ First of month - running R2 archival...');
    try {
      const { archiveOldThreats } = await import('./utils/archiver');
      const archiveStats = await archiveOldThreats(env);

      console.log('✅ R2 archival complete:', {
        archived: archiveStats.archived,
        failed: archiveStats.failed,
        skipped: archiveStats.skipped,
        quotaExceeded: archiveStats.quotaExceeded,
      });

      // If archival failed due to quota, log warning but continue with feed ingestion
      if (archiveStats.quotaExceeded) {
        console.warn('⚠️ R2 archival skipped due to quota limits');
      }
    } catch (error) {
      console.error('❌ R2 archival failed:', error);
      // Don't fail the entire cron job, continue with feed ingestion
    }
  }

  console.log('Starting feed ingestion...');

  // Track subrequests to monitor free tier usage (50 subrequest limit per request)
  let subrequestCount = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (...args) => {
    subrequestCount++;
    return originalFetch(...args);
  };

  // Track neuron usage to stay within free tier (10,000 neurons/day limit)
  const neuronTracker = new NeuronTracker();

  try {
    // Get all enabled feed sources
    const feedsResult = await env.DB.prepare(
      'SELECT * FROM feed_sources WHERE enabled = 1'
    ).all<FeedSource>();

    const feeds = feedsResult.results;
    console.log(`Found ${feeds.length} enabled feeds`);

    let totalProcessed = 0;
    let totalNew = 0;

    // Process feeds in parallel using Promise.allSettled
    // This solves the sequential processing issue
    const feedResults = await Promise.allSettled(
      feeds.map((feed) => processFeed(env, feed))
    );

    // Aggregate results
    for (const result of feedResults) {
      if (result.status === 'fulfilled') {
        totalProcessed += result.value.processed;
        totalNew += result.value.newThreats;
      } else {
        console.error('Feed processing rejected:', result.reason);
      }
    }

    console.log(`Feed ingestion complete. Processed: ${totalProcessed}, New: ${totalNew}`);

    // Now process pending AI analysis (separate step to control subrequest usage)
    const aiProcessed = await processAIPendingThreats(env, neuronTracker);
    console.log(`AI processing complete. Processed: ${aiProcessed} threats`);

    // Log subrequest usage for monitoring
    const subrequestPercent = Math.round((subrequestCount / 50) * 100);
    console.log(`📊 Subrequests used: ${subrequestCount}/50 (${subrequestPercent}%)`);

    if (subrequestPercent > 90) {
      console.warn(`⚠️ WARNING: High subrequest usage (${subrequestCount}/50). Close to limit!`);
    }

    // Log neuron usage summary from tracker
    const neuronSummary = neuronTracker.getSummary();
    const breakdown = neuronTracker.getBreakdown();

    console.log(`🧠 Neuron usage this run: ${neuronSummary.neuronsUsed} neurons`);
    console.log(`🧠 Daily total estimate (4 runs): ~${neuronSummary.neuronsUsed * 4} neurons/day (${Math.round((neuronSummary.neuronsUsed * 4) / 100)}% of 10,000 limit)`);
    console.log(`🧠 Status: ${neuronSummary.status} (${neuronSummary.percentUsed}% of daily limit used)`);

    if (breakdown.length > 0) {
      console.log(`🧠 Model breakdown:`);
      for (const model of breakdown) {
        console.log(`   - ${model.model}: ${model.neurons} neurons (${model.calls} calls, ~${model.avgPerCall}/call)`);
      }
    }

    // Warning if approaching limit
    if (neuronSummary.status === 'WARNING') {
      console.warn(`⚠️ WARNING: Neuron usage at ${neuronSummary.percentUsed}% of daily limit!`);
    } else if (neuronSummary.status === 'CRITICAL') {
      console.error(`🚨 CRITICAL: Neuron usage at ${neuronSummary.percentUsed}% of daily limit! Risk of exceeding free tier.`);
    }

    // Write analytics
    env.ANALYTICS.writeDataPoint({
      blobs: ['feed_ingestion'],
      doubles: [totalNew, totalProcessed, aiProcessed, subrequestCount],
      indexes: [new Date().toISOString().split('T')[0]], // Date as index
    });

    const responseMessage = isFirstOfMonth
      ? `Monthly archival + ingestion complete. New: ${totalNew}, AI processed: ${aiProcessed}, Subrequests: ${subrequestCount}/50`
      : `Ingestion complete. New: ${totalNew}, AI processed: ${aiProcessed}, Subrequests: ${subrequestCount}/50`;

    return new Response(responseMessage, { status: 200 });
  } catch (error) {
    console.error('Scheduled ingestion error:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return new Response('Error during ingestion', { status: 500 });
  }
};

// Process a single feed (now async and parallelizable)
async function processFeed(
  env: Env,
  feed: FeedSource
): Promise<{ processed: number; newThreats: number }> {
  let processed = 0;
  let newThreats = 0;

  try {
    console.log(`Fetching feed: ${feed.name}`);

    // Check rate limiting using D1 last_fetch column (no KV needed!)
    const now = Math.floor(Date.now() / 1000);

    if (feed.last_fetch && now - feed.last_fetch < (feed.fetch_interval || 21600)) {
      console.log(`Skipping ${feed.name} - too soon since last fetch`);
      return { processed, newThreats };
    }

    // Fetch the feed
    const response = await fetch(feed.url, {
      headers: {
        'User-Agent': 'ThreatIntelDashboard/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Only process RSS and Atom feeds (skip JSON/API feeds for now)
    if (feed.type !== 'rss' && feed.type !== 'atom') {
      console.log(`Skipping ${feed.name} - ${feed.type} feeds not yet supported`);
      return { processed, newThreats };
    }

    const xml = await response.text();
    const items = await parseFeed(xml, feed.type);

    console.log(`Found ${items.length} items in ${feed.name}`);

    // Process each item
    for (const item of items) {
      const threatId = generateId(item.link, item.title);
      const publishedAt = parseDate(item.pubDate);

      // FIXED: Check for duplicates by BOTH id AND url (prevents UNIQUE constraint errors)
      const existing = await env.DB.prepare(
        'SELECT id FROM threats WHERE id = ? OR url = ?'
      )
        .bind(threatId, item.link)
        .first();

      if (existing) {
        continue; // Skip duplicates
      }

      // Create threat record
      const threat: Threat = {
        id: threatId,
        source: feed.name,
        title: item.title,
        url: item.link,
        content: item.content || item.description,
        published_at: publishedAt,
        fetched_at: now,
        raw_data: JSON.stringify(item),
      };

      try {
        // Insert into database with error handling
        await env.DB.prepare(
          `INSERT INTO threats (id, source, title, url, content, published_at, fetched_at, raw_data)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
          .bind(
            threat.id,
            threat.source,
            threat.title,
            threat.url,
            threat.content,
            threat.published_at,
            threat.fetched_at,
            threat.raw_data
          )
          .run();

        newThreats++;
        processed++;

        // Limit items per feed to avoid overwhelming the system
        if (processed >= 50) {
          console.log(`Reached limit of 50 items for ${feed.name}`);
          break;
        }
      } catch (insertError) {
        // Gracefully handle duplicate errors without failing entire feed
        if (
          insertError instanceof Error &&
          insertError.message.includes('UNIQUE constraint')
        ) {
          console.log(`Skipping duplicate URL: ${item.link}`);
          continue;
        }
        throw insertError; // Re-throw other errors
      }
    }

    // Update feed metadata (D1 is our single source of truth - no KV needed!)
    await env.DB.prepare(
      `UPDATE feed_sources
       SET last_fetch = ?, last_success = ?, error_count = 0, last_error = NULL
       WHERE id = ?`
    )
      .bind(now, now, feed.id)
      .run();

    console.log(`Processed ${feed.name} successfully`);
    return { processed, newThreats };
  } catch (error) {
    console.error('Error processing feed:', {
      error: error instanceof Error ? error.message : String(error),
      feedName: feed.name,
      feedUrl: feed.url,
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Update error count
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await env.DB.prepare(
      `UPDATE feed_sources
       SET error_count = error_count + 1, last_error = ?
       WHERE id = ?`
    )
      .bind(errorMessage, feed.id)
      .run();

    return { processed, newThreats };
  }
}

// Process threats that don't have AI analysis yet
// This runs AFTER feed ingestion to control subrequest limits
async function processAIPendingThreats(env: Env, tracker?: NeuronTracker): Promise<number> {
  let processed = 0;

  try {
    // Find threats that don't have summaries yet (pending AI processing)
    // Limit to MAX_AI_PROCESSING_PER_RUN to stay under subrequest limits
    const pendingThreats = await env.DB.prepare(
      `SELECT t.id, t.title, t.content, t.source, t.published_at
       FROM threats t
       LEFT JOIN summaries s ON t.id = s.threat_id
       WHERE s.threat_id IS NULL
       ORDER BY t.published_at DESC
       LIMIT ?`
    )
      .bind(MAX_AI_PROCESSING_PER_RUN)
      .all<Threat>();

    if (!pendingThreats.results || pendingThreats.results.length === 0) {
      console.log('No pending threats to process');
      return 0;
    }

    console.log(`Found ${pendingThreats.results.length} threats pending AI processing`);

    // Process each threat with AI
    for (const threat of pendingThreats.results) {
      try {
        await processArticleWithAI(env, threat, tracker);
        processed++;
      } catch (error) {
        console.error('Error processing threat with AI:', {
          error: error instanceof Error ? error.message : String(error),
          threatId: threat.id,
          threatTitle: threat.title,
        });
        // Continue processing other threats even if one fails
      }
    }

    return processed;
  } catch (error) {
    console.error('Error in processAIPendingThreats:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return processed;
  }
}

// Process article with AI analysis
async function processArticleWithAI(env: Env, threat: Threat, tracker?: NeuronTracker): Promise<void> {
  try {
    // Generate AI analysis
    const analysis = await analyzeArticle(env, threat, tracker);
    if (!analysis) {
      console.log(`No AI analysis for ${threat.id}`);
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

    console.log(`AI processing complete for ${threat.id}`);
  } catch (error) {
    console.error('Error in AI processing:', {
      error: error instanceof Error ? error.message : String(error),
      threatId: threat.id,
      threatTitle: threat.title,
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error; // Re-throw to be caught by caller
  }
}
