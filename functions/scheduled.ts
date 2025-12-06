// Scheduled Function - Runs every 6 hours to fetch threat intelligence feeds
import type { Env, FeedSource, Threat } from './types';
import { parseFeed, parseDate, generateId } from './utils/rss-parser';
import { analyzeArticle, generateEmbedding } from './utils/ai-processor';

/// <reference types="@cloudflare/workers-types" />
/// <reference types="@cloudflare/workers-types/experimental" />

export const onSchedule = async ({ env }: { env: Env }): Promise<Response> => {
  console.log('Starting scheduled feed ingestion...');

  try {
    // Get all enabled feed sources
    const feedsResult = await env.DB.prepare(
      'SELECT * FROM feed_sources WHERE enabled = 1'
    ).all<FeedSource>();

    const feeds = feedsResult.results;
    console.log(`Found ${feeds.length} enabled feeds`);

    let totalProcessed = 0;
    let totalNew = 0;

    // Process each feed
    for (const feed of feeds) {
      try {
        console.log(`Fetching feed: ${feed.name}`);

        // Check rate limiting cache
        const cacheKey = `feed:${feed.id}:last_fetch`;
        const lastFetch = await env.CACHE.get(cacheKey);
        const now = Math.floor(Date.now() / 1000);

        if (lastFetch && now - parseInt(lastFetch) < (feed.fetch_interval || 21600)) {
          console.log(`Skipping ${feed.name} - too soon since last fetch`);
          continue;
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

        const xml = await response.text();
        const items = await parseFeed(xml, feed.type);

        console.log(`Found ${items.length} items in ${feed.name}`);

        // Process each item
        for (const item of items) {
          const threatId = generateId(item.link, item.title);
          const publishedAt = parseDate(item.pubDate);

          // Check if threat already exists
          const existing = await env.DB.prepare(
            'SELECT id FROM threats WHERE id = ?'
          ).bind(threatId).first();

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

          // Insert into database
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

          totalNew++;

          // Process with AI (async - don't block)
          processArticleWithAI(env, threat).catch((err) => {
            console.error('Error processing threat with AI:', {
              error: err instanceof Error ? err.message : String(err),
              threatId: threat.id,
              threatTitle: threat.title,
              stack: err instanceof Error ? err.stack : undefined,
            });
          });

          totalProcessed++;

          // Rate limit AI calls - process max 20 articles per feed
          if (totalProcessed >= 20) {
            break;
          }
        }

        // Update feed metadata
        await env.DB.prepare(
          `UPDATE feed_sources
           SET last_fetch = ?, last_success = ?, error_count = 0, last_error = NULL
           WHERE id = ?`
        )
          .bind(now, now, feed.id)
          .run();

        // Update cache
        await env.CACHE.put(cacheKey, now.toString(), { expirationTtl: feed.fetch_interval || 21600 });

        console.log(`Processed ${feed.name} successfully`);
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
      }
    }

    console.log(`Ingestion complete. Processed: ${totalProcessed}, New: ${totalNew}`);

    // Write analytics
    env.ANALYTICS.writeDataPoint({
      blobs: ['feed_ingestion'],
      doubles: [totalNew, totalProcessed],
      indexes: [new Date().toISOString().split('T')[0]], // Date as index
    });

    return new Response(`Ingestion complete. New threats: ${totalNew}`, { status: 200 });
  } catch (error) {
    console.error('Scheduled ingestion error:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return new Response('Error during ingestion', { status: 500 });
  }
};

// Process article with AI analysis
async function processArticleWithAI(env: Env, threat: Threat): Promise<void> {
  try {
    // Generate AI analysis
    const analysis = await analyzeArticle(env, threat);
    if (!analysis) {
      console.log(`No AI analysis for ${threat.id}`);
      return;
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
        0.85, // Confidence score
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

    // Generate and store embedding for semantic search
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

    console.log(`AI processing complete for ${threat.id}`);
  } catch (error) {
    console.error('Error in AI processing:', {
      error: error instanceof Error ? error.message : String(error),
      threatId: threat.id,
      threatTitle: threat.title,
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}
