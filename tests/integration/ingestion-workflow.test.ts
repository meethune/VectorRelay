import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Env, FeedSource, Threat } from '../../functions/types';

// Mock all external dependencies
vi.mock('../../functions/utils/rss-parser', () => ({
  parseFeed: vi.fn(),
  parseDate: vi.fn(),
  generateId: vi.fn(),
}));

import { parseFeed, parseDate, generateId } from '../../functions/utils/rss-parser';

describe('Integration: Feed Ingestion Workflow', () => {
  function createMockEnv(): Env {
    return {
      DB: {
        prepare: vi.fn().mockReturnThis(),
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
        first: vi.fn().mockResolvedValue(null),
        all: vi.fn().mockResolvedValue({ results: [] }),
      } as any,
      AI: {} as any,
      VECTORIZE_INDEX: {} as any,
      CACHE: {} as any,
      ANALYTICS: {} as any,
      THREAT_ARCHIVE: {} as any,
      ASSETS: {} as any,
      AI_GATEWAY_ID: 'test-gateway-id',
    } as any;
  }

  const mockFeed: FeedSource = {
    id: 1,
    name: 'Test Security Blog',
    url: 'https://example.com/feed.xml',
    type: 'rss',
    enabled: 1,
    last_fetch: null,
    last_success: null,
    fetch_interval: 21600,
    error_count: 0,
    last_error: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  describe('RSS Feed Processing', () => {
    it('should fetch RSS feed and parse items', async () => {
      const mockXML = `<?xml version="1.0"?>
        <rss version="2.0">
          <channel>
            <item>
              <title>APT Attack Detected</title>
              <link>https://example.com/apt-attack</link>
              <description>A new APT campaign targets...</description>
              <pubDate>Mon, 01 Jan 2024 12:00:00 GMT</pubDate>
            </item>
          </channel>
        </rss>`;

      (global.fetch as any).mockResolvedValue({
        ok: true,
        text: async () => mockXML,
      });

      (parseFeed as any).mockResolvedValue([
        {
          title: 'APT Attack Detected',
          link: 'https://example.com/apt-attack',
          description: 'A new APT campaign targets...',
          content: 'Full content here',
          pubDate: 'Mon, 01 Jan 2024 12:00:00 GMT',
        },
      ]);

      (parseDate as any).mockReturnValue(1704110400);
      (generateId as any).mockReturnValue('threat-apt-123');

      const env = createMockEnv();

      // Import processFeed dynamically to get fresh module
      const { processFeed } = await import('./helpers/ingestion-helpers');

      const result = await processFeed(env, mockFeed);

      expect(global.fetch).toHaveBeenCalledWith(
        mockFeed.url,
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': 'ThreatIntelDashboard/1.0',
          }),
        })
      );

      expect(parseFeed).toHaveBeenCalledWith(mockXML, 'rss');
      expect(result.processed).toBe(1);
      expect(result.newThreats).toBe(1);
    });

    it('should skip duplicate threats by ID', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        text: async () => '<rss></rss>',
      });

      (parseFeed as any).mockResolvedValue([
        {
          title: 'Existing Threat',
          link: 'https://example.com/existing',
          description: 'Already in database',
          pubDate: 'Mon, 01 Jan 2024 12:00:00 GMT',
        },
      ]);

      (generateId as any).mockReturnValue('existing-threat-id');
      (parseDate as any).mockReturnValue(1704110400);

      const env = createMockEnv();
      (env.DB.first as any).mockResolvedValue({ id: 'existing-threat-id' });

      const { processFeed } = await import('./helpers/ingestion-helpers');
      const result = await processFeed(env, mockFeed);

      expect(result.processed).toBe(0);
      expect(result.newThreats).toBe(0);
    });

    it('should skip duplicate threats by URL', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        text: async () => '<rss></rss>',
      });

      (parseFeed as any).mockResolvedValue([
        {
          title: 'Threat with Existing URL',
          link: 'https://example.com/existing-url',
          description: 'URL already exists',
          pubDate: 'Mon, 01 Jan 2024 12:00:00 GMT',
        },
      ]);

      (generateId as any).mockReturnValue('new-id');
      (parseDate as any).mockReturnValue(1704110400);

      const env = createMockEnv();
      (env.DB.first as any).mockResolvedValue({ id: 'other-id' });

      const { processFeed } = await import('./helpers/ingestion-helpers');
      const result = await processFeed(env, mockFeed);

      expect(env.DB.prepare).toHaveBeenCalledWith(
        'SELECT id FROM threats WHERE id = ? OR url = ?'
      );
      expect(result.newThreats).toBe(0);
    });

    it('should update feed metadata after successful processing', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        text: async () => '<rss></rss>',
      });

      (parseFeed as any).mockResolvedValue([]);

      const env = createMockEnv();
      const { processFeed } = await import('./helpers/ingestion-helpers');

      await processFeed(env, mockFeed);

      expect(env.DB.prepare).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE feed_sources')
      );
      expect(env.DB.prepare).toHaveBeenCalledWith(
        expect.stringContaining('SET last_fetch = ?, last_success = ?, error_count = 0')
      );
    });

    it('should handle HTTP errors gracefully', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const env = createMockEnv();
      const { processFeed } = await import('./helpers/ingestion-helpers');

      const result = await processFeed(env, mockFeed);

      expect(result.processed).toBe(0);
      expect(result.newThreats).toBe(0);
      expect(env.DB.prepare).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE feed_sources')
      );
      expect(env.DB.prepare).toHaveBeenCalledWith(
        expect.stringContaining('SET error_count = error_count + 1')
      );
    });

    it('should skip feeds within rate limit window', async () => {
      const recentFetch = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      const feedWithRecentFetch: FeedSource = {
        ...mockFeed,
        last_fetch: recentFetch,
        fetch_interval: 21600, // 6 hours
      };

      const env = createMockEnv();
      const { processFeed } = await import('./helpers/ingestion-helpers');

      const result = await processFeed(env, feedWithRecentFetch);

      expect(global.fetch).not.toHaveBeenCalled();
      expect(result.processed).toBe(0);
      expect(result.newThreats).toBe(0);
    });

    it('should limit processing to 50 items per feed', async () => {
      const manyItems = Array.from({ length: 100 }, (_, i) => ({
        title: `Threat ${i}`,
        link: `https://example.com/threat-${i}`,
        description: `Description ${i}`,
        pubDate: 'Mon, 01 Jan 2024 12:00:00 GMT',
      }));

      (global.fetch as any).mockResolvedValue({
        ok: true,
        text: async () => '<rss></rss>',
      });

      (parseFeed as any).mockResolvedValue(manyItems);
      (generateId as any).mockImplementation((link: string) => `id-${link.split('-').pop()}`);
      (parseDate as any).mockReturnValue(1704110400);

      const env = createMockEnv();
      const { processFeed } = await import('./helpers/ingestion-helpers');

      const result = await processFeed(env, mockFeed);

      expect(result.processed).toBeLessThanOrEqual(50);
    });

    it('should skip non-RSS/Atom feed types', async () => {
      const jsonFeed: FeedSource = {
        ...mockFeed,
        type: 'json' as any,
      };

      const env = createMockEnv();
      const { processFeed } = await import('./helpers/ingestion-helpers');

      const result = await processFeed(env, jsonFeed);

      expect(global.fetch).not.toHaveBeenCalled();
      expect(result.processed).toBe(0);
    });
  });

  describe('Parallel Feed Processing', () => {
    it('should process multiple feeds in parallel', async () => {
      const feeds: FeedSource[] = [
        { ...mockFeed, id: 1, name: 'Feed 1', url: 'https://feed1.com/rss' },
        { ...mockFeed, id: 2, name: 'Feed 2', url: 'https://feed2.com/rss' },
        { ...mockFeed, id: 3, name: 'Feed 3', url: 'https://feed3.com/rss' },
      ];

      (global.fetch as any).mockResolvedValue({
        ok: true,
        text: async () => '<rss></rss>',
      });

      (parseFeed as any).mockResolvedValue([]);

      const env = createMockEnv();
      const { processFeeds } = await import('./helpers/ingestion-helpers');

      const results = await processFeeds(env, feeds);

      expect(global.fetch).toHaveBeenCalledTimes(3);
      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result.status).toBe('fulfilled');
      });
    });

    it('should continue processing other feeds when one fails', async () => {
      const feeds: FeedSource[] = [
        { ...mockFeed, id: 1, name: 'Feed 1', url: 'https://feed1.com/rss' },
        { ...mockFeed, id: 2, name: 'Feed 2', url: 'https://feed2.com/rss' },
        { ...mockFeed, id: 3, name: 'Feed 3', url: 'https://feed3.com/rss' },
      ];

      (global.fetch as any)
        .mockResolvedValueOnce({ ok: true, text: async () => '<rss></rss>' })
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ ok: true, text: async () => '<rss></rss>' });

      (parseFeed as any).mockResolvedValue([]);

      const env = createMockEnv();
      const { processFeeds } = await import('./helpers/ingestion-helpers');

      const results = await processFeeds(env, feeds);

      expect(results).toHaveLength(3);
      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('fulfilled'); // Error handled gracefully
      expect(results[2].status).toBe('fulfilled');
    });
  });

  describe('Data Integrity', () => {
    it('should store all threat fields correctly', async () => {
      const mockItem = {
        title: 'Critical Vulnerability Disclosed',
        link: 'https://example.com/vuln-2024-001',
        description: 'Short description',
        content: 'Full article content with technical details...',
        pubDate: 'Wed, 01 Jan 2025 15:30:00 GMT',
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        text: async () => '<rss></rss>',
      });

      (parseFeed as any).mockResolvedValue([mockItem]);
      (generateId as any).mockReturnValue('vuln-2024-001');
      (parseDate as any).mockReturnValue(1735745400);

      const env = createMockEnv();
      const { processFeed } = await import('./helpers/ingestion-helpers');

      await processFeed(env, mockFeed);

      expect(env.DB.prepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO threats')
      );
      expect(env.DB.bind).toHaveBeenCalledWith(
        'vuln-2024-001', // id
        'Test Security Blog', // source
        'Critical Vulnerability Disclosed', // title
        'https://example.com/vuln-2024-001', // url
        'Full article content with technical details...', // content
        1735745400, // published_at
        expect.any(Number), // fetched_at
        expect.stringContaining('"title"') // raw_data (JSON)
      );
    });

    it('should handle gracefully UNIQUE constraint errors', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        text: async () => '<rss></rss>',
      });

      (parseFeed as any).mockResolvedValue([
        {
          title: 'Duplicate Article',
          link: 'https://example.com/duplicate',
          description: 'Duplicate content',
          pubDate: 'Mon, 01 Jan 2024 12:00:00 GMT',
        },
      ]);

      (generateId as any).mockReturnValue('duplicate-id');
      (parseDate as any).mockReturnValue(1704110400);

      const env = createMockEnv();
      (env.DB.first as any).mockResolvedValue(null); // First check passes
      (env.DB.run as any).mockRejectedValue(
        new Error('UNIQUE constraint failed: threats.url')
      );

      const { processFeed } = await import('./helpers/ingestion-helpers');
      const result = await processFeed(env, mockFeed);

      // Should not throw, should handle gracefully
      expect(result.processed).toBe(0);
      expect(result.newThreats).toBe(0);
    });
  });
});
