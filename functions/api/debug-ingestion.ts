// Debug endpoint to see detailed ingestion progress
import type { Env, FeedSource } from '../types';

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  // Security: Disable debug endpoint in production
  if (env.ENVIRONMENT === 'production') {
    return Response.json({
      error: 'Debug endpoints are disabled in production'
    }, { status: 404 });
  }

  const logs: string[] = [];

  try {
    logs.push('Starting debug ingestion...');

    // Get all enabled feed sources
    const feedsResult = await env.DB.prepare(
      'SELECT * FROM feed_sources WHERE enabled = 1'
    ).all<FeedSource>();

    const feeds = feedsResult.results;
    logs.push(`Found ${feeds.length} enabled feeds`);

    // Try to fetch just ONE feed as a test
    if (feeds.length > 0) {
      const testFeed = feeds[0];
      logs.push(`Testing feed: ${testFeed.name} (${testFeed.url})`);

      try {
        const response = await fetch(testFeed.url, {
          headers: {
            'User-Agent': 'ThreatIntelDashboard/1.0',
          },
        });

        logs.push(`Fetch status: ${response.status} ${response.statusText}`);

        if (response.ok) {
          const xml = await response.text();
          logs.push(`Received ${xml.length} bytes of XML`);
          logs.push(`First 200 chars: ${xml.substring(0, 200)}...`);

          // Try to parse it
          const { parseFeed } = await import('../utils/rss-parser');
          const items = await parseFeed(xml, testFeed.type);
          logs.push(`Parsed ${items.length} items from feed`);

          if (items.length > 0) {
            logs.push(`First item: ${JSON.stringify(items[0], null, 2)}`);
          }
        } else {
          logs.push(`Failed to fetch: ${await response.text()}`);
        }
      } catch (fetchError) {
        logs.push(`Fetch error: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`);
        logs.push(`Stack: ${fetchError instanceof Error ? fetchError.stack : 'N/A'}`);
      }
    }

    return Response.json({
      success: true,
      logs,
      timestamp: new Date().toISOString()
    }, {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    logs.push(`Fatal error: ${error instanceof Error ? error.message : String(error)}`);
    logs.push(`Stack: ${error instanceof Error ? error.stack : 'N/A'}`);

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
