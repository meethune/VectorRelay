// RSS/Atom Feed Parser for Cloudflare Pages Functions
// Uses fast-xml-parser for robust XML parsing
import { XMLParser } from 'fast-xml-parser';
import type { RSSItem } from '../types';

export async function parseFeed(xml: string, feedType: 'rss' | 'atom'): Promise<RSSItem[]> {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    trimValues: true,
    parseTagValue: false, // Keep as strings, don't try to parse numbers/booleans
    processEntities: true, // Decode HTML entities
    htmlEntities: true,
  });

  try {
    const result = parser.parse(xml);

    if (feedType === 'atom') {
      return parseAtomData(result.feed || result);
    } else {
      return parseRSSData(result.rss?.channel || result.channel || result);
    }
  } catch (error) {
    console.error('XML parsing error:', error);
    return [];
  }
}

function parseRSSData(channel: any): RSSItem[] {
  if (!channel || !channel.item) {
    return [];
  }

  // Ensure items is always an array (single item will be an object)
  const items = Array.isArray(channel.item) ? channel.item : [channel.item];

  return items
    .map((item: any) => {
      // Handle both CDATA and regular text content
      const getTextContent = (value: any): string => {
        if (!value) return '';

        let text = '';
        if (typeof value === 'string') {
          text = value;
        } else if (typeof value === 'object') {
          // Handle CDATA or nested text
          text = value['#text'] || value['__cdata'] || String(value);
        } else {
          text = String(value);
        }

        // Strip CDATA markers that weren't properly parsed
        text = text.replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '');

        return text.trim();
      };

      let title = getTextContent(item.title);
      const link = getTextContent(item.link);
      const description = getTextContent(item.description);
      const contentEncoded = getTextContent(item['content:encoded']);
      const content = contentEncoded || getTextContent(item.content) || description;
      const pubDate = getTextContent(item.pubDate);

      // Handle guid which might have attributes
      let guid = '';
      if (item.guid) {
        if (typeof item.guid === 'string') {
          guid = item.guid;
        } else if (typeof item.guid === 'object') {
          guid = item.guid['#text'] || String(item.guid);
        }
      }
      guid = guid || link;

      // Clean text before validation
      title = cleanText(title);
      const cleanedLink = link.trim();
      const cleanedDescription = cleanText(description);
      const cleanedContent = cleanText(content);

      // Validate AFTER cleaning - reject if link is missing or malformed
      if (!cleanedLink || cleanedLink.includes('<![CDATA[')) {
        return null;
      }

      // Fallback for missing titles: use first 100 chars of content or "Untitled Article"
      if (!title || title.length === 0) {
        if (cleanedContent && cleanedContent.length > 0) {
          title = cleanedContent.substring(0, 100) + '...';
        } else if (cleanedDescription && cleanedDescription.length > 0) {
          title = cleanedDescription.substring(0, 100) + '...';
        } else {
          // Last resort: extract domain from URL
          try {
            const urlObj = new URL(cleanedLink);
            title = `Article from ${urlObj.hostname}`;
          } catch {
            title = 'Untitled Article';
          }
        }
      }

      return {
        title,
        link: cleanedLink,
        description: cleanedDescription,
        content: cleanedContent,
        pubDate: pubDate.trim(),
        guid: guid.trim(),
      };
    })
    .filter((item: RSSItem | null): item is RSSItem => item !== null);
}

function parseAtomData(feed: any): RSSItem[] {
  if (!feed || !feed.entry) {
    return [];
  }

  // Ensure entries is always an array
  const entries = Array.isArray(feed.entry) ? feed.entry : [feed.entry];

  return entries
    .map((entry: any) => {
      const getTextContent = (value: any): string => {
        if (!value) return '';

        let text = '';
        if (typeof value === 'string') {
          text = value;
        } else if (typeof value === 'object') {
          text = value['#text'] || value['__cdata'] || String(value);
        } else {
          text = String(value);
        }

        // Strip CDATA markers that weren't properly parsed
        text = text.replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '');

        return text.trim();
      };

      let title = getTextContent(entry.title);

      // Atom link can be an attribute: <link href="..." />
      let link = '';
      if (entry.link) {
        if (typeof entry.link === 'string') {
          link = entry.link;
        } else if (Array.isArray(entry.link)) {
          // Multiple links - prefer alternate or first
          const alternateLink = entry.link.find((l: any) => l['@_rel'] === 'alternate' || !l['@_rel']);
          link = alternateLink?.['@_href'] || entry.link[0]?.['@_href'] || '';
        } else if (entry.link['@_href']) {
          link = entry.link['@_href'];
        }
      }

      const summary = getTextContent(entry.summary);
      const content = getTextContent(entry.content) || summary;
      const published = getTextContent(entry.published || entry.updated);
      const id = getTextContent(entry.id) || link;

      // Clean text before validation
      title = cleanText(title);
      const cleanedLink = link.trim();
      const cleanedSummary = cleanText(summary);
      const cleanedContent = cleanText(content);

      // Validate AFTER cleaning - reject if link is missing or malformed
      if (!cleanedLink || cleanedLink.includes('<![CDATA[')) {
        return null;
      }

      // Fallback for missing titles: use first 100 chars of content or "Untitled Article"
      if (!title || title.length === 0) {
        if (cleanedContent && cleanedContent.length > 0) {
          title = cleanedContent.substring(0, 100) + '...';
        } else if (cleanedSummary && cleanedSummary.length > 0) {
          title = cleanedSummary.substring(0, 100) + '...';
        } else {
          // Last resort: extract domain from URL
          try {
            const urlObj = new URL(cleanedLink);
            title = `Article from ${urlObj.hostname}`;
          } catch {
            title = 'Untitled Article';
          }
        }
      }

      return {
        title,
        link: cleanedLink,
        description: cleanedSummary,
        content: cleanedContent,
        pubDate: published.trim(),
        guid: id.trim(),
      };
    })
    .filter((item: RSSItem | null): item is RSSItem => item !== null);
}

// Clean up text content - remove HTML tags and extra whitespace
function cleanText(text: string): string {
  if (!text) return '';

  let cleaned = text;

  // Remove HTML tags
  cleaned = cleaned.replace(/<[^>]*>/g, ' ');

  // Decode any remaining HTML entities (XMLParser should handle most)
  cleaned = cleaned
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');

  // Clean up whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}

export function parseDate(dateString: string): number {
  try {
    // Handle empty or whitespace-only strings
    if (!dateString || !dateString.trim()) {
      return Math.floor(Date.now() / 1000);
    }

    const date = new Date(dateString);

    // Check if date is valid (getTime() returns NaN for invalid dates)
    if (isNaN(date.getTime())) {
      console.warn(`Invalid date string: "${dateString}", using current time`);
      return Math.floor(Date.now() / 1000);
    }

    return Math.floor(date.getTime() / 1000);
  } catch (error) {
    console.warn(`Error parsing date: "${dateString}"`, error);
    return Math.floor(Date.now() / 1000);
  }
}

export function generateId(url: string, title: string): string {
  const str = `${url}-${title}`;
  return cyrb53(str).toString(36);
}

// Simple hash function for generating IDs
function cyrb53(str: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed,
    h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}
