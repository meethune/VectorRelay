/**
 * Similarity Test Fixtures
 *
 * Mock data for testing multi-signal similarity scoring
 */

import type { ThreatForSimilarity } from '../../functions/utils/similarity';

// Base timestamp for testing temporal proximity
const BASE_TIMESTAMP = 1733672000; // Dec 8, 2025

// Mock threats for similarity testing
export const MOCK_THREAT_RANSOMWARE_1: ThreatForSimilarity = {
  id: 'threat-ransomware-1',
  title: 'LockBit Ransomware Targets Healthcare Sector',
  content: 'A new LockBit ransomware campaign is actively targeting hospitals and healthcare providers across the United States. The attackers are exploiting known vulnerabilities in VPN gateways.',
  tldr: 'LockBit ransomware campaign targeting US healthcare',
  category: 'ransomware',
  severity: 'critical',
  published_at: BASE_TIMESTAMP,
  source: 'Security Blog A',
  iocs: {
    ips: ['192.0.2.10', '192.0.2.20'],
    domains: ['malicious-c2.com', 'lockbit-panel.net'],
    cves: ['CVE-2024-1234'],
    hashes: ['abc123def456'],
    urls: ['https://malicious-c2.com/panel'],
    emails: ['attacker@evil.com'],
  },
};

export const MOCK_THREAT_RANSOMWARE_2: ThreatForSimilarity = {
  id: 'threat-ransomware-2',
  title: 'LockBit Gang Expands Operations to Healthcare',
  content: 'The LockBit ransomware group has expanded their targeting to include healthcare facilities. Multiple hospitals report encryption attacks. Attackers are exploiting VPN vulnerabilities.',
  tldr: 'LockBit expands to healthcare sector',
  category: 'ransomware',
  severity: 'critical',
  published_at: BASE_TIMESTAMP + 86400, // 1 day later
  source: 'Security Blog B', // Different source
  iocs: {
    ips: ['192.0.2.10'], // Overlapping IP
    domains: ['malicious-c2.com'], // Overlapping domain
    cves: ['CVE-2024-1234'], // Same CVE
    hashes: [],
    urls: [],
    emails: [],
  },
};

export const MOCK_THREAT_APT: ThreatForSimilarity = {
  id: 'threat-apt-1',
  title: 'APT28 Campaign Targets Government Agencies',
  content: 'Advanced persistent threat group APT28 is conducting espionage operations against government agencies using spear-phishing emails.',
  tldr: 'APT28 espionage campaign',
  category: 'apt',
  severity: 'high',
  published_at: BASE_TIMESTAMP + 86400 * 2, // 2 days later
  source: 'Security Blog C',
  iocs: {
    ips: ['203.0.113.50'],
    domains: ['fake-govt.com'],
    cves: [],
    hashes: [],
    urls: [],
    emails: ['phishing@fake-govt.com'],
  },
};

export const MOCK_THREAT_ZERO_DAY: ThreatForSimilarity = {
  id: 'threat-zero-day-1',
  title: 'Zero-Day Vulnerability in Chrome Browser',
  content: 'Google has patched a critical zero-day vulnerability in Chrome browser that was actively exploited in the wild.',
  tldr: 'Chrome zero-day actively exploited',
  category: 'zero_day',
  severity: 'critical',
  published_at: BASE_TIMESTAMP + 86400 * 100, // 100 days later
  source: 'Security Blog D',
  iocs: {
    ips: [],
    domains: [],
    cves: ['CVE-2024-9999'],
    hashes: [],
    urls: [],
    emails: [],
  },
};

export const MOCK_THREAT_SAME_SOURCE: ThreatForSimilarity = {
  id: 'threat-same-source',
  title: 'Additional LockBit Analysis',
  content: 'Further analysis of the LockBit ransomware targeting healthcare providers.',
  tldr: 'LockBit analysis update',
  category: 'ransomware',
  severity: 'critical',
  published_at: BASE_TIMESTAMP + 3600, // 1 hour later
  source: 'Security Blog A', // Same source as RANSOMWARE_1
  iocs: {
    ips: [],
    domains: [],
    cves: [],
    hashes: [],
    urls: [],
    emails: [],
  },
};

export const MOCK_THREAT_NO_IOCS: ThreatForSimilarity = {
  id: 'threat-no-iocs',
  title: 'Security Alert: General Threat Warning',
  content: 'General security alert about increasing cyber threats.',
  tldr: 'General threat warning',
  category: 'ransomware',
  severity: 'medium',
  published_at: BASE_TIMESTAMP + 86400 * 5, // 5 days later
  source: 'Security Blog E',
  iocs: {
    ips: [],
    domains: [],
    cves: [],
    hashes: [],
    urls: [],
    emails: [],
  },
};

// Mock semantic scores from Vectorize
export const MOCK_SEMANTIC_SCORES = new Map<string, number>([
  ['threat-ransomware-2', 0.92], // Very similar semantically
  ['threat-same-source', 0.85], // Quite similar
  ['threat-no-iocs', 0.65], // Moderately similar
  ['threat-apt-1', 0.15], // Different topic
  ['threat-zero-day-1', 0.10], // Very different
]);

// Expected similarity weights for testing
export const SIMILARITY_WEIGHTS = {
  SEMANTIC: 0.40,
  CONTENT: 0.25,
  IOC: 0.20,
  TEMPORAL: 0.10,
  SOURCE: 0.05,
} as const;
