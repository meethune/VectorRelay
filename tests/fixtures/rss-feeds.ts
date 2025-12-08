/**
 * RSS/Atom Feed Test Fixtures
 *
 * Contains sample RSS and Atom XML for testing the RSS parser
 */

export const VALID_RSS_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Security Feed</title>
    <link>https://example.com</link>
    <description>Security news feed</description>
    <item>
      <title>Critical Zero-Day in Chrome Browser</title>
      <link>https://example.com/chrome-zero-day</link>
      <description>Google patches critical zero-day vulnerability</description>
      <pubDate>Mon, 08 Dec 2025 10:00:00 GMT</pubDate>
      <guid>chrome-zero-day-2025</guid>
    </item>
    <item>
      <title>New Ransomware Campaign Targets Healthcare</title>
      <link>https://example.com/ransomware-healthcare</link>
      <description>Healthcare organizations targeted by new ransomware variant</description>
      <pubDate>Sun, 07 Dec 2025 14:30:00 GMT</pubDate>
      <guid>ransomware-healthcare-2025</guid>
    </item>
  </channel>
</rss>`;

export const RSS_WITH_CDATA = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Feed with CDATA</title>
    <item>
      <title><![CDATA[APT Group Targets Energy Sector]]></title>
      <link><![CDATA[https://example.com/apt-energy]]></link>
      <description><![CDATA[Nation-state actors target <strong>critical infrastructure</strong>]]></description>
      <content:encoded><![CDATA[<p>Full content with <em>HTML</em> tags</p>]]></content:encoded>
      <pubDate>Mon, 08 Dec 2025 09:00:00 GMT</pubDate>
      <guid>apt-energy-2025</guid>
    </item>
  </channel>
</rss>`;

export const RSS_WITH_MISSING_TITLE = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <item>
      <link>https://example.com/no-title</link>
      <description>This article has no title but has content</description>
      <pubDate>Mon, 08 Dec 2025 08:00:00 GMT</pubDate>
      <guid>no-title-2025</guid>
    </item>
  </channel>
</rss>`;

export const RSS_WITH_EMPTY_TITLE = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <item>
      <title></title>
      <link>https://example.com/empty-title</link>
      <description>This article has an empty title element</description>
      <content:encoded>Full article content goes here with details</content:encoded>
      <pubDate>Mon, 08 Dec 2025 07:00:00 GMT</pubDate>
      <guid>empty-title-2025</guid>
    </item>
  </channel>
</rss>`;

export const RSS_WITH_MALFORMED_LINK = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <item>
      <title>Test Article</title>
      <link><![CDATA[https://example.com/bad-link</link>
      <description>Article with malformed link CDATA</description>
      <pubDate>Mon, 08 Dec 2025 06:00:00 GMT</pubDate>
      <guid>bad-link-2025</guid>
    </item>
  </channel>
</rss>`;

export const VALID_ATOM_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Test Atom Feed</title>
  <link href="https://example.com"/>
  <entry>
    <title>SQL Injection Vulnerability Discovered</title>
    <link href="https://example.com/sqli-vuln"/>
    <id>sqli-vuln-2025</id>
    <updated>2025-12-08T10:00:00Z</updated>
    <summary>Critical SQL injection found in popular CMS</summary>
    <content>Full content describing the SQL injection vulnerability</content>
  </entry>
  <entry>
    <title>DDoS Attack on Financial Services</title>
    <link href="https://example.com/ddos-attack" rel="alternate"/>
    <id>ddos-attack-2025</id>
    <published>2025-12-07T15:30:00Z</published>
    <summary>Major DDoS campaign targets banks</summary>
  </entry>
</feed>`;

export const ATOM_WITH_MULTIPLE_LINKS = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Test Feed</title>
  <entry>
    <title>Phishing Campaign Analysis</title>
    <link href="https://cdn.example.com/content" rel="enclosure"/>
    <link href="https://example.com/phishing" rel="alternate"/>
    <link href="https://api.example.com/data" rel="related"/>
    <id>phishing-2025</id>
    <updated>2025-12-08T09:00:00Z</updated>
    <summary>New phishing campaign targets executives</summary>
  </entry>
</feed>`;

export const RSS_SINGLE_ITEM = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Single Item Feed</title>
    <item>
      <title>Malware Analysis Report</title>
      <link>https://example.com/malware-report</link>
      <description>Detailed analysis of new malware family</description>
      <pubDate>Mon, 08 Dec 2025 12:00:00 GMT</pubDate>
      <guid>malware-report-2025</guid>
    </item>
  </channel>
</rss>`;

export const INVALID_XML = `This is not XML at all!`;

export const RSS_WITH_HTML_ENTITIES = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <item>
      <title>Vulnerability &amp; Exploit Analysis</title>
      <link>https://example.com/vuln-analysis</link>
      <description>Analysis of CVE-2025-1234 &lt;critical&gt; vulnerability</description>
      <pubDate>Mon, 08 Dec 2025 11:00:00 GMT</pubDate>
      <guid>vuln-analysis-2025</guid>
    </item>
  </channel>
</rss>`;

export const RSS_WITH_INVALID_DATE = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <item>
      <title>Article with Invalid Date</title>
      <link>https://example.com/invalid-date</link>
      <description>Testing invalid date handling</description>
      <pubDate>Not a valid date!</pubDate>
      <guid>invalid-date-2025</guid>
    </item>
  </channel>
</rss>`;

// RSS with empty title and no content - should fallback to URL domain
export const RSS_WITH_EMPTY_TITLE_NO_CONTENT = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <item>
      <title></title>
      <link>https://securityblog.example.com/article-123</link>
      <description></description>
      <pubDate>Mon, 08 Dec 2025 10:00:00 GMT</pubDate>
      <guid>no-title-123</guid>
    </item>
  </channel>
</rss>`;

// RSS with empty title and invalid URL - should fallback to "Untitled Article"
export const RSS_WITH_EMPTY_TITLE_INVALID_URL = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <item>
      <title></title>
      <link>not-a-valid-url</link>
      <description></description>
      <pubDate>Mon, 08 Dec 2025 10:00:00 GMT</pubDate>
      <guid>invalid-url-123</guid>
    </item>
  </channel>
</rss>`;

// Atom feed with empty title for fallback testing
export const ATOM_WITH_EMPTY_TITLE = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Test Atom Feed</title>
  <entry>
    <title></title>
    <link href="https://example.com/atom-article" />
    <id>atom-no-title</id>
    <updated>2025-12-08T10:00:00Z</updated>
    <content>This is the full content of the article that should be used for title.</content>
    <summary>This is a summary.</summary>
  </entry>
</feed>`;

// Atom feed with content that becomes empty after cleaning (HTML only), but has summary
export const ATOM_WITH_EMPTY_TITLE_ONLY_SUMMARY = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Test Feed</title>
  <entry>
    <title></title>
    <link href="https://example.com/summary-fallback" />
    <id>summary-fallback-123</id>
    <updated>2025-12-08T10:00:00Z</updated>
    <content><![CDATA[<div><br/><span></span></div>]]></content>
    <summary>This summary should be used as title fallback when content has only HTML.</summary>
  </entry>
</feed>`;

// Atom feed with empty title, no content, no summary - should fallback to domain
export const ATOM_WITH_EMPTY_TITLE_NO_CONTENT_NO_SUMMARY = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Test Feed</title>
  <entry>
    <title></title>
    <link href="https://newssite.example.com/article" />
    <id>domain-fallback-123</id>
    <updated>2025-12-08T10:00:00Z</updated>
  </entry>
</feed>`;

// Atom feed with link as string (not href attribute)
export const ATOM_WITH_STRING_LINK = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Test Feed</title>
  <entry>
    <title>String Link Test</title>
    <link>https://example.com/string-link</link>
    <id>string-link-123</id>
    <updated>2025-12-08T10:00:00Z</updated>
    <content>Content</content>
  </entry>
</feed>`;

// Atom feed using published date instead of updated
export const ATOM_WITH_PUBLISHED_DATE = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Test Feed</title>
  <entry>
    <title>Published Date Test</title>
    <link href="https://example.com/published" />
    <id>published-123</id>
    <published>2025-12-07T15:00:00Z</published>
    <content>Content</content>
  </entry>
</feed>`;

// Atom with link array but no rel attributes
export const ATOM_WITH_LINK_ARRAY_NO_REL = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Test Feed</title>
  <entry>
    <title>Link Array No Rel Test</title>
    <link href="https://example.com/first-link" />
    <link href="https://example.com/second-link" />
    <id>link-array-123</id>
    <updated>2025-12-08T10:00:00Z</updated>
    <content>Content</content>
  </entry>
</feed>`;

// Atom with empty title and invalid URL - should fallback to "Untitled Article"
export const ATOM_WITH_EMPTY_TITLE_INVALID_URL = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Test Feed</title>
  <entry>
    <title></title>
    <link href="not-a-valid-url" />
    <id>atom-invalid-url-123</id>
    <updated>2025-12-08T10:00:00Z</updated>
  </entry>
</feed>`;

// RSS feed without guid - should use link as guid
export const RSS_WITHOUT_GUID = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <item>
      <title>Article Without GUID</title>
      <link>https://example.com/no-guid-article</link>
      <description>Testing guid fallback to link</description>
      <pubDate>Mon, 08 Dec 2025 10:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;
