/**
 * AI Processor Test Fixtures
 *
 * Contains mock data for testing AI processing functions
 */

import type { Threat, AIAnalysis } from '../../functions/types';

// Mock threat articles for testing
export const MOCK_THREAT_RANSOMWARE: Threat = {
  id: 'test-threat-1',
  source: 'Test Security Blog',
  title: 'New Ransomware Variant Targets Healthcare Sector',
  url: 'https://example.com/ransomware-alert',
  content: 'A new ransomware variant has been discovered targeting healthcare organizations. The malware encrypts critical patient data and demands payment in Bitcoin. Security researchers have identified several indicators of compromise including the domain malware-c2.com and IP address 192.0.2.100. The ransomware exploits CVE-2024-1234 to gain initial access.',
  published_at: Math.floor(Date.now() / 1000) - 3600,
  fetched_at: Math.floor(Date.now() / 1000),
};

export const MOCK_THREAT_APT: Threat = {
  id: 'test-threat-2',
  source: 'Threat Intel Feed',
  title: 'APT28 Targets European Government Networks',
  url: 'https://example.com/apt28-campaign',
  content: 'Russian state-sponsored group APT28 has been observed targeting European government networks. The campaign uses sophisticated spear-phishing emails with malicious attachments. Affected sectors include government, defense, and energy.',
  published_at: Math.floor(Date.now() / 1000) - 7200,
  fetched_at: Math.floor(Date.now() / 1000),
};

export const MOCK_THREAT_EMPTY_CONTENT: Threat = {
  id: 'test-threat-empty',
  source: 'Test Feed',
  title: 'Article with No Content',
  url: 'https://example.com/empty',
  content: '',
  published_at: Math.floor(Date.now() / 1000),
  fetched_at: Math.floor(Date.now() / 1000),
};

// Mock AI analysis responses
export const MOCK_ANALYSIS_RANSOMWARE: AIAnalysis = {
  tldr: 'New ransomware variant targets healthcare with Bitcoin ransom demands',
  key_points: [
    'Encrypts critical patient data',
    'Demands Bitcoin payment',
    'Exploits CVE-2024-1234 for initial access',
  ],
  category: 'ransomware',
  severity: 'critical',
  affected_sectors: ['healthcare'],
  threat_actors: [],
  iocs: {
    ips: ['192.0.2.100'],
    domains: ['malware-c2.com'],
    cves: ['CVE-2024-1234'],
    hashes: [],
    urls: [],
    emails: [],
  },
  model_strategy: 'baseline',
};

export const MOCK_ANALYSIS_APT: AIAnalysis = {
  tldr: 'APT28 launches spear-phishing campaign against European governments',
  key_points: [
    'Russian state-sponsored actor',
    'Targets government, defense, and energy sectors',
    'Uses sophisticated spear-phishing techniques',
  ],
  category: 'apt',
  severity: 'high',
  affected_sectors: ['government', 'defense', 'energy'],
  threat_actors: ['APT28'],
  iocs: {
    ips: [],
    domains: [],
    cves: [],
    hashes: [],
    urls: [],
    emails: [],
  },
  model_strategy: 'trimodel',
};

// Mock AI service responses (Workers AI format)
export const MOCK_AI_RESPONSE_BASELINE = {
  response: JSON.stringify(MOCK_ANALYSIS_RANSOMWARE),
};

export const MOCK_AI_RESPONSE_BASIC_INFO = {
  response: JSON.stringify({
    tldr: 'APT28 launches spear-phishing campaign against European governments',
    category: 'apt',
    severity: 'high',
    affected_sectors: ['government', 'defense', 'energy'],
    threat_actors: ['APT28'],
  }),
};

export const MOCK_AI_RESPONSE_DETAILED_INFO = {
  response: JSON.stringify({
    key_points: [
      'Russian state-sponsored actor',
      'Targets government, defense, and energy sectors',
      'Uses sophisticated spear-phishing techniques',
    ],
    iocs: {
      ips: [],
      domains: [],
      cves: [],
      hashes: [],
      urls: [],
      emails: [],
    },
  }),
};

export const MOCK_AI_RESPONSE_INVALID = {
  response: 'This is not valid JSON',
};

export const MOCK_AI_RESPONSE_MISSING_FIELDS = {
  response: JSON.stringify({
    category: 'malware',
    // Missing required fields: tldr, severity
  }),
};

// Mock embedding response
export const MOCK_EMBEDDING_RESPONSE = {
  data: [Array(1024).fill(0.5)], // 1024-dimensional vector
};

export const MOCK_EMBEDDING_RESPONSE_INVALID = {
  data: [], // Empty data array
};

// Mock trend analysis response
export const MOCK_TREND_ANALYSIS_RESPONSE = {
  response: `This week's threat landscape shows several emerging trends:

1. Ransomware attacks continue to target healthcare organizations with increasing sophistication.
2. State-sponsored actors are focusing on critical infrastructure and government networks.
3. The energy and defense sectors are experiencing elevated threat levels.

Recommended defensive actions include implementing multi-factor authentication, updating vulnerable systems, and enhancing email security controls.`,
};

// Mock semantic search results
export const MOCK_VECTORIZE_MATCHES = [
  {
    id: 'threat-1',
    score: 0.95,
    metadata: { category: 'ransomware', severity: 'critical' },
  },
  {
    id: 'threat-2',
    score: 0.88,
    metadata: { category: 'malware', severity: 'high' },
  },
  {
    id: 'threat-3',
    score: 0.75,
    metadata: { category: 'phishing', severity: 'medium' },
  },
];

export const MOCK_VECTORIZE_EMPTY_MATCHES: any[] = [];
