// RSS/Atom Feed Parser
import type { RSSItem } from '../types';

export async function parseFeed(xml: string, feedType: 'rss' | 'atom'): Promise<RSSItem[]> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');

  if (feedType === 'atom') {
    return parseAtomFeed(doc);
  } else {
    return parseRSSFeed(doc);
  }
}

function parseRSSFeed(doc: Document): RSSItem[] {
  const items: RSSItem[] = [];
  const itemElements = doc.querySelectorAll('item');

  itemElements.forEach((item) => {
    const title = item.querySelector('title')?.textContent || '';
    const link = item.querySelector('link')?.textContent || '';
    const description = item.querySelector('description')?.textContent || '';
    const content =
      item.querySelector('content\\:encoded')?.textContent ||
      item.querySelector('content')?.textContent ||
      description;
    const pubDate = item.querySelector('pubDate')?.textContent || '';
    const guid = item.querySelector('guid')?.textContent || link;

    if (title && link) {
      items.push({
        title: cleanHTML(title),
        link,
        description: cleanHTML(description),
        content: cleanHTML(content),
        pubDate,
        guid,
      });
    }
  });

  return items;
}

function parseAtomFeed(doc: Document): RSSItem[] {
  const items: RSSItem[] = [];
  const entries = doc.querySelectorAll('entry');

  entries.forEach((entry) => {
    const title = entry.querySelector('title')?.textContent || '';
    const linkElement = entry.querySelector('link[rel="alternate"]') || entry.querySelector('link');
    const link = linkElement?.getAttribute('href') || '';
    const summary = entry.querySelector('summary')?.textContent || '';
    const content = entry.querySelector('content')?.textContent || summary;
    const published = entry.querySelector('published')?.textContent || entry.querySelector('updated')?.textContent || '';
    const id = entry.querySelector('id')?.textContent || link;

    if (title && link) {
      items.push({
        title: cleanHTML(title),
        link,
        description: cleanHTML(summary),
        content: cleanHTML(content),
        pubDate: published,
        guid: id,
      });
    }
  });

  return items;
}

function cleanHTML(html: string): string {
  if (!html) return '';

  // Remove HTML tags
  let text = html.replace(/<[^>]*>/g, ' ');

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
