// RSS/Atom Feed Parser for Cloudflare Pages Functions
// Uses regex-based parsing instead of DOMParser (which isn't available in Pages Functions runtime)
import type { RSSItem } from '../types';

export async function parseFeed(xml: string, feedType: 'rss' | 'atom'): Promise<RSSItem[]> {
  if (feedType === 'atom') {
    return parseAtomFeed(xml);
  } else {
    return parseRSSFeed(xml);
  }
}

function parseRSSFeed(xml: string): RSSItem[] {
  const items: RSSItem[] = [];

  // Match all <item>...</item> blocks
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];

    const title = extractTag(itemXml, 'title');
    const link = extractTag(itemXml, 'link');
    const description = extractTag(itemXml, 'description');
    const contentEncoded = extractTag(itemXml, 'content:encoded');
    const content = contentEncoded || extractTag(itemXml, 'content') || description;
    const pubDate = extractTag(itemXml, 'pubDate');
    const guid = extractTag(itemXml, 'guid') || link;

    if (title && link) {
      items.push({
        title: cleanHTML(title),
        link: link.trim(),
        description: cleanHTML(description),
        content: cleanHTML(content),
        pubDate: pubDate.trim(),
        guid: guid.trim(),
      });
    }
  }

  return items;
}

function parseAtomFeed(xml: string): RSSItem[] {
  const items: RSSItem[] = [];

  // Match all <entry>...</entry> blocks
  const entryRegex = /<entry[^>]*>([\s\S]*?)<\/entry>/gi;
  let match;

  while ((match = entryRegex.exec(xml)) !== null) {
    const entryXml = match[1];

    const title = extractTag(entryXml, 'title');
    // For Atom, link is an attribute: <link href="..." />
    const linkMatch = entryXml.match(/<link[^>]+href=["']([^"']+)["']/i);
    const link = linkMatch ? linkMatch[1] : '';
    const summary = extractTag(entryXml, 'summary');
    const content = extractTag(entryXml, 'content') || summary;
    const published = extractTag(entryXml, 'published') || extractTag(entryXml, 'updated');
    const id = extractTag(entryXml, 'id') || link;

    if (title && link) {
      items.push({
        title: cleanHTML(title),
        link: link.trim(),
        description: cleanHTML(summary),
        content: cleanHTML(content),
        pubDate: published.trim(),
        guid: id.trim(),
      });
    }
  }

  return items;
}

// Helper function to extract content from XML tags
function extractTag(xml: string, tagName: string): string {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1] : '';
}

function cleanHTML(html: string): string {
  if (!html) return '';

  // FIRST: Strip CDATA markers
  let text = html.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');

  // THEN: Remove HTML tags
  text = text.replace(/<[^>]*>/g, ' ');

  // Decode common HTML entities
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');

  // Clean up whitespace
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}

export function parseDate(dateString: string): number {
  try {
    const date = new Date(dateString);
    return Math.floor(date.getTime() / 1000);
  } catch {
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
