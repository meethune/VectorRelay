// Helper functions for integration tests
// These mirror the logic from functions/scheduled.ts but are importable for testing

import type { Env, FeedSource, Threat } from '../../../functions/types';
import { parseFeed, parseDate, generateId } from '../../../functions/utils/rss-parser';

export async function processFeed(
  env: Env,
  feed: FeedSource
): Promise<{ processed: number; newThreats: number }> {
  let processed = 0;
  let newThreats = 0;

  try {
    const now = Math.floor(Date.now() / 1000);

    // Check rate limiting
    if (feed.last_fetch && now - feed.last_fetch < (feed.fetch_interval || 21600)) {
      return { processed, newThreats };
    }

    // Skip non-RSS/Atom feeds
    if (feed.type !== 'rss' && feed.type !== 'atom') {
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

    const xml = await response.text();
    const items = await parseFeed(xml, feed.type);

    // Process each item
    for (const item of items) {
      const threatId = generateId(item.link, item.title);
      const publishedAt = parseDate(item.pubDate);

      // Check for duplicates
      const existing = await env.DB.prepare(
        'SELECT id FROM threats WHERE id = ? OR url = ?'
      )
        .bind(threatId, item.link)
        .first();

      if (existing) {
        continue;
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

        if (processed >= 50) {
          break;
        }
      } catch (insertError) {
        if (
          insertError instanceof Error &&
          insertError.message.includes('UNIQUE constraint')
        ) {
          continue;
        }
        throw insertError;
      }
    }

    // Update feed metadata
    try {
      await env.DB.prepare(
        `UPDATE feed_sources
         SET last_fetch = ?, last_success = ?, error_count = 0, last_error = NULL
         WHERE id = ?`
      )
        .bind(now, now, feed.id)
        .run();
    } catch (updateError) {
      // Silently ignore errors updating feed metadata
    }

    return { processed, newThreats };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    try {
      await env.DB.prepare(
        `UPDATE feed_sources
         SET error_count = error_count + 1, last_error = ?
         WHERE id = ?`
      )
        .bind(errorMessage, feed.id)
        .run();
    } catch (updateError) {
      // Silently ignore errors updating feed metadata in error handler
    }

    return { processed, newThreats };
  }
}

export async function processFeeds(
  env: Env,
  feeds: FeedSource[]
): Promise<PromiseSettledResult<{ processed: number; newThreats: number }>[]> {
  return Promise.allSettled(
    feeds.map((feed) => processFeed(env, feed))
  );
}
