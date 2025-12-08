import { describe, it, expect } from 'vitest';
import { parseFeed, parseDate, generateId } from '../../../functions/utils/rss-parser';
import {
  VALID_RSS_FEED,
  RSS_WITH_CDATA,
  RSS_WITH_MISSING_TITLE,
  RSS_WITH_EMPTY_TITLE,
  VALID_ATOM_FEED,
  ATOM_WITH_MULTIPLE_LINKS,
  RSS_SINGLE_ITEM,
  RSS_WITH_HTML_ENTITIES,
  RSS_WITH_INVALID_DATE,
  RSS_WITH_MALFORMED_LINK,
} from '../../fixtures/rss-feeds';

describe('RSS Parser', () => {
  describe('parseFeed() - RSS feeds', () => {
    it('should parse a valid RSS feed with multiple items', async () => {
      const result = await parseFeed(VALID_RSS_FEED, 'rss');

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        title: 'Critical Zero-Day in Chrome Browser',
        link: 'https://example.com/chrome-zero-day',
        description: 'Google patches critical zero-day vulnerability',
        guid: 'chrome-zero-day-2025',
      });
      expect(result[0].pubDate).toBeTruthy();
    });

    it('should handle CDATA sections correctly', async () => {
      const result = await parseFeed(RSS_WITH_CDATA, 'rss');

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('APT Group Targets Energy Sector');
      expect(result[0].link).toBe('https://example.com/apt-energy');

      // Should strip HTML tags from description
      expect(result[0].description).not.toContain('<strong>');
      expect(result[0].description).toContain('critical infrastructure');

      // Should have content from content:encoded
      expect(result[0].content).toContain('Full content');
      expect(result[0].content).not.toContain('<p>');
      expect(result[0].content).not.toContain('<em>');
    });

    it('should generate fallback titles when title is missing or empty', async () => {
      // Missing title element
      const resultMissing = await parseFeed(RSS_WITH_MISSING_TITLE, 'rss');
      expect(resultMissing).toHaveLength(1);
      expect(resultMissing[0].title).toBeTruthy();
      expect(resultMissing[0].title).toContain('This article has no title');

      // Empty title element
      const resultEmpty = await parseFeed(RSS_WITH_EMPTY_TITLE, 'rss');
      expect(resultEmpty).toHaveLength(1);
      expect(resultEmpty[0].title).toBeTruthy();
      expect(resultEmpty[0].title).toContain('Full article content');
    });

    it('should reject items with malformed links', async () => {
      const result = await parseFeed(RSS_WITH_MALFORMED_LINK, 'rss');

      // Should filter out item with malformed link (CDATA marker in link)
      expect(result).toHaveLength(0);
    });

    it('should handle single item feeds (not arrays)', async () => {
      const result = await parseFeed(RSS_SINGLE_ITEM, 'rss');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        title: 'Malware Analysis Report',
        link: 'https://example.com/malware-report',
        guid: 'malware-report-2025',
      });
    });

    it('should decode HTML entities and strip HTML tags', async () => {
      const result = await parseFeed(RSS_WITH_HTML_ENTITIES, 'rss');

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Vulnerability & Exploit Analysis');
      // Should decode entities and strip HTML tags (including content between tags)
      expect(result[0].description).toContain('Analysis of CVE-2025-1234');
      expect(result[0].description).toContain('vulnerability');
      expect(result[0].description).not.toContain('<critical>'); // HTML tags stripped
      expect(result[0].description).not.toContain('&amp;'); // Entity decoded
      expect(result[0].description).not.toContain('&lt;'); // Entity decoded
    });
  });

  describe('parseFeed() - Atom feeds', () => {
    it('should parse a valid Atom feed', async () => {
      const result = await parseFeed(VALID_ATOM_FEED, 'atom');

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        title: 'SQL Injection Vulnerability Discovered',
        link: 'https://example.com/sqli-vuln',
        description: 'Critical SQL injection found in popular CMS',
        guid: 'sqli-vuln-2025',
      });
    });

    it('should prefer alternate links when multiple links present', async () => {
      const result = await parseFeed(ATOM_WITH_MULTIPLE_LINKS, 'atom');

      expect(result).toHaveLength(1);
      // Should pick the alternate link, not enclosure or related
      expect(result[0].link).toBe('https://example.com/phishing');
    });
  });

  describe('parseDate()', () => {
    it('should parse valid RFC 822 date strings', () => {
      const timestamp = parseDate('Mon, 08 Dec 2025 10:00:00 GMT');
      expect(timestamp).toBeGreaterThan(0);
      expect(typeof timestamp).toBe('number');
    });

    it('should parse ISO 8601 date strings (Atom format)', () => {
      const timestamp = parseDate('2025-12-08T10:00:00Z');
      expect(timestamp).toBeGreaterThan(0);
    });

    it('should return current timestamp for invalid dates', () => {
      const before = Math.floor(Date.now() / 1000);
      const timestamp = parseDate('Not a valid date!');
      const after = Math.floor(Date.now() / 1000);

      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });

    it('should return current timestamp for empty strings', () => {
      const before = Math.floor(Date.now() / 1000);
      const timestamp = parseDate('');
      const after = Math.floor(Date.now() / 1000);

      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('generateId()', () => {
    it('should generate consistent IDs for same input', () => {
      const id1 = generateId('https://example.com/test', 'Test Title');
      const id2 = generateId('https://example.com/test', 'Test Title');

      expect(id1).toBe(id2);
    });

    it('should generate different IDs for different inputs', () => {
      const id1 = generateId('https://example.com/test1', 'Title 1');
      const id2 = generateId('https://example.com/test2', 'Title 2');

      expect(id1).not.toBe(id2);
    });

    it('should return a string in base-36 format', () => {
      const id = generateId('https://example.com/test', 'Test');

      expect(typeof id).toBe('string');
      expect(id).toMatch(/^[0-9a-z]+$/); // Base-36 uses 0-9 and a-z
    });
  });
});
