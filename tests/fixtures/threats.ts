import type { Threat, FeedSource, AIAnalysis } from '../../functions/types';

/**
 * Mock threat data for testing
 */
export const mockThreat: Threat = {
  id: 'threat-test-001',
  source: 'Security Blog',
  title: 'Critical APT Campaign Targeting Financial Sector',
  url: 'https://example.com/apt-campaign',
  content:
    'Security researchers have discovered a sophisticated APT campaign targeting major financial institutions. The threat actor, tracked as APT29, has been observed using advanced malware and zero-day exploits to compromise banking networks.',
  published_at: 1704110400, // 2024-01-01 12:00:00 UTC
  fetched_at: 1704110400,
  raw_data: JSON.stringify({
    title: 'Critical APT Campaign Targeting Financial Sector',
    link: 'https://example.com/apt-campaign',
    pubDate: 'Mon, 01 Jan 2024 12:00:00 GMT',
  }),
};

/**
 * Mock threat with malware category
 */
export const mockMalwareThreat: Threat = {
  id: 'threat-test-002',
  source: 'Malware Analysis Lab',
  title: 'New Ransomware Variant Detected in the Wild',
  url: 'https://example.com/ransomware-variant',
  content:
    'A new ransomware variant has been detected targeting healthcare organizations. The malware uses advanced encryption techniques and demands payment in cryptocurrency.',
  published_at: 1704196800, // 2024-01-02 12:00:00 UTC
  fetched_at: 1704196800,
  raw_data: JSON.stringify({
    title: 'New Ransomware Variant Detected in the Wild',
    link: 'https://example.com/ransomware-variant',
    pubDate: 'Tue, 02 Jan 2024 12:00:00 GMT',
  }),
};

/**
 * Mock threat with vulnerability category
 */
export const mockVulnerabilityThreat: Threat = {
  id: 'threat-test-003',
  source: 'CVE Database',
  title: 'Critical Zero-Day Vulnerability in Popular Web Server',
  url: 'https://example.com/zero-day-cve-2024-1234',
  content:
    'A critical zero-day vulnerability (CVE-2024-1234) has been discovered in a widely-used web server. The vulnerability allows remote code execution and affects millions of servers worldwide.',
  published_at: 1704283200, // 2024-01-03 12:00:00 UTC
  fetched_at: 1704283200,
  raw_data: JSON.stringify({
    title: 'Critical Zero-Day Vulnerability in Popular Web Server',
    link: 'https://example.com/zero-day-cve-2024-1234',
    pubDate: 'Wed, 03 Jan 2024 12:00:00 GMT',
  }),
};

/**
 * Create multiple mock threats for batch testing
 */
export function createMockThreats(count: number): Threat[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `threat-test-${String(i + 1).padStart(3, '0')}`,
    source: `Test Source ${i + 1}`,
    title: `Threat ${i + 1}: Test Threat Title`,
    url: `https://example.com/threat-${i + 1}`,
    content: `This is test threat content for threat ${i + 1}. It contains information about security incidents and vulnerabilities.`,
    published_at: 1704110400 + i * 86400, // One day apart
    fetched_at: 1704110400 + i * 86400,
    raw_data: JSON.stringify({
      title: `Threat ${i + 1}: Test Threat Title`,
      link: `https://example.com/threat-${i + 1}`,
      pubDate: new Date((1704110400 + i * 86400) * 1000).toUTCString(),
    }),
  }));
}

/**
 * Mock feed source for testing
 */
export const mockFeedSource: FeedSource = {
  id: 1,
  name: 'Test Security Blog',
  url: 'https://example.com/feed.xml',
  type: 'rss',
  enabled: 1,
  last_fetch: null,
  last_success: null,
  fetch_interval: 21600, // 6 hours
  error_count: 0,
  last_error: null,
};

/**
 * Mock AI analysis result
 */
export const mockAIAnalysis: AIAnalysis = {
  tldr: 'APT group targets financial sector with sophisticated malware and zero-day exploits',
  key_points: [
    'APT29 threat actor targeting financial institutions',
    'Advanced malware using zero-day exploits discovered',
    'Banking networks compromised via sophisticated techniques',
    'Immediate patching and monitoring recommended',
  ],
  category: 'apt',
  severity: 'critical',
  affected_sectors: ['Finance', 'Banking', 'Financial Services'],
  threat_actors: ['APT29', 'Cozy Bear'],
  iocs: {
    ips: ['192.168.1.100', '10.0.0.50', '203.0.113.42'],
    domains: ['malicious-site.com', 'evil-domain.net', 'c2-server.org'],
    cves: ['CVE-2024-1234', 'CVE-2024-5678'],
    hashes: [
      'abc123def456789',
      'd41d8cd98f00b204e9800998ecf8427e',
      '5f4dcc3b5aa765d61d8327deb882cf99',
    ],
    urls: [
      'https://evil.com/payload',
      'https://malware-dropper.com/download',
    ],
    emails: ['phishing@evil.com', 'attacker@malicious.net'],
  },
  model_strategy: 'tri-model',
};

/**
 * Mock AI analysis for malware threat
 */
export const mockMalwareAnalysis: AIAnalysis = {
  tldr: 'New ransomware variant targeting healthcare with advanced encryption',
  key_points: [
    'New ransomware variant identified',
    'Healthcare sector primary target',
    'Advanced encryption techniques employed',
    'Cryptocurrency ransom demanded',
  ],
  category: 'malware',
  severity: 'high',
  affected_sectors: ['Healthcare', 'Medical'],
  threat_actors: [],
  iocs: {
    ips: ['198.51.100.10'],
    domains: ['ransom-payment.onion'],
    cves: [],
    hashes: ['e99a18c428cb38d5f260853678922e03'],
    urls: ['https://ransom-note.tor/pay'],
    emails: ['ransom@darkweb.onion'],
  },
  model_strategy: 'tri-model',
};

/**
 * Mock AI analysis for vulnerability threat
 */
export const mockVulnerabilityAnalysis: AIAnalysis = {
  tldr: 'Critical zero-day RCE vulnerability in web server software',
  key_points: [
    'Zero-day vulnerability discovered in web server',
    'Remote code execution possible',
    'Millions of servers affected globally',
    'Patch not yet available',
  ],
  category: 'vulnerability',
  severity: 'critical',
  affected_sectors: ['Technology', 'Web Hosting', 'Cloud Services'],
  threat_actors: [],
  iocs: {
    ips: [],
    domains: [],
    cves: ['CVE-2024-1234'],
    hashes: [],
    urls: [],
    emails: [],
  },
  model_strategy: 'tri-model',
};

/**
 * Mock RSS feed XML
 */
export const mockRSSFeedXML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Security Blog</title>
    <link>https://example.com</link>
    <description>Security news and threat intelligence</description>
    <item>
      <title>Critical APT Campaign Targeting Financial Sector</title>
      <link>https://example.com/apt-campaign</link>
      <description>Security researchers have discovered a sophisticated APT campaign...</description>
      <pubDate>Mon, 01 Jan 2024 12:00:00 GMT</pubDate>
      <guid>https://example.com/apt-campaign</guid>
    </item>
  </channel>
</rss>`;

/**
 * Mock Atom feed XML
 */
export const mockAtomFeedXML = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Test Security Blog</title>
  <link href="https://example.com" />
  <updated>2024-01-01T12:00:00Z</updated>
  <entry>
    <title>Critical APT Campaign Targeting Financial Sector</title>
    <link href="https://example.com/apt-campaign" />
    <id>https://example.com/apt-campaign</id>
    <updated>2024-01-01T12:00:00Z</updated>
    <summary>Security researchers have discovered a sophisticated APT campaign...</summary>
  </entry>
</feed>`;
