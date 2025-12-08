/**
 * R2 Storage Test Fixtures
 *
 * Mock data for testing R2 storage operations
 */

import { vi } from 'vitest';
import type { Threat, AIAnalysis, IOC } from '../../functions/types';
import type { ArchivedThreat } from '../../functions/utils/r2-storage';

// Mock threats for archiving
export const MOCK_THREAT_SMALL: Threat & { ai_analysis?: AIAnalysis; iocs?: IOC[] } = {
  id: 'threat-small-123',
  source: 'Test Security Blog',
  title: 'Critical Vulnerability in OpenSSL',
  content: 'A critical vulnerability has been discovered in OpenSSL library.',
  url: 'https://example.com/openssl-vuln',
  published_at: Math.floor(new Date('2025-12-01T10:00:00Z').getTime() / 1000),
  fetched_at: Math.floor(new Date('2025-12-01T11:00:00Z').getTime() / 1000),
  ai_analysis: {
    tldr: 'Critical OpenSSL vulnerability requires immediate patching',
    category: 'zero_day',
    severity: 'critical',
    key_points: ['Affects OpenSSL 3.x', 'Remote code execution possible'],
    iocs: { ips: [], domains: [], cves: ['CVE-2025-1234'] },
    model_strategy: 'baseline',
  },
  iocs: [
    {
      type: 'cve',
      value: 'CVE-2025-1234',
      description: 'OpenSSL RCE vulnerability',
    },
  ],
};

export const MOCK_THREAT_LARGE: Threat & { ai_analysis?: AIAnalysis; iocs?: IOC[] } = {
  id: 'threat-large-456',
  source: 'Security Research Lab',
  title: 'Massive Ransomware Campaign Targeting Healthcare',
  content: 'A'.repeat(250 * 1024), // 250KB - exceeds 200KB limit
  url: 'https://example.com/ransomware-campaign',
  published_at: Math.floor(new Date('2025-12-05T14:00:00Z').getTime() / 1000),
  fetched_at: Math.floor(new Date('2025-12-05T15:00:00Z').getTime() / 1000),
  ai_analysis: {
    tldr: 'Large-scale ransomware campaign',
    category: 'ransomware',
    severity: 'critical',
    model_strategy: 'trimodel',
  },
};

export const MOCK_THREAT_NO_ANALYSIS: Threat = {
  id: 'threat-no-analysis',
  source: 'News Source',
  title: 'Security Alert',
  content: 'Brief security alert',
  url: 'https://example.com/alert',
  published_at: Math.floor(new Date('2025-12-08T10:00:00Z').getTime() / 1000),
  fetched_at: Math.floor(new Date('2025-12-08T11:00:00Z').getTime() / 1000),
};

// Mock archived threat data
export const MOCK_ARCHIVED_THREAT: ArchivedThreat = {
  id: 'threat-small-123',
  title: 'Critical Vulnerability in OpenSSL',
  content: 'A critical vulnerability has been discovered in OpenSSL library.',
  url: 'https://example.com/openssl-vuln',
  published_at: '2025-12-01T10:00:00.000Z',
  feed_source: 'Test Security Blog',
  ai_analysis: {
    tldr: 'Critical OpenSSL vulnerability requires immediate patching',
    category: 'zero_day',
    severity: 'critical',
    key_points: ['Affects OpenSSL 3.x', 'Remote code execution possible'],
    iocs: { ips: [], domains: [], cves: ['CVE-2025-1234'] },
    model_strategy: 'baseline',
  },
  iocs: [
    {
      type: 'cve',
      value: 'CVE-2025-1234',
      description: 'OpenSSL RCE vulnerability',
    },
  ],
  archived_at: '2025-12-01T11:00:00.000Z',
  metadata: {
    feed_source: 'Test Security Blog',
    original_url: 'https://example.com/openssl-vuln',
    size_bytes: 512,
    category: 'zero_day',
    severity: 'critical',
  },
};

// Mock R2 object
export function createMockR2Object(data: string): any {
  let parsedJson;
  try {
    parsedJson = JSON.parse(data);
  } catch {
    parsedJson = null;
  }

  return {
    text: vi.fn().mockResolvedValue(data),
    arrayBuffer: vi.fn().mockResolvedValue(new TextEncoder().encode(data).buffer),
    json: vi.fn().mockResolvedValue(parsedJson),
  };
}

// Mock R2 list result
export const MOCK_R2_LIST_RESULT = {
  objects: [
    { key: 'threats/2025/12/threat-1.json' },
    { key: 'threats/2025/12/threat-2.json' },
    { key: 'threats/2025/11/threat-3.json' },
  ],
  truncated: false,
};

export const MOCK_R2_LIST_TRUNCATED = {
  objects: Array.from({ length: 1000 }, (_, i) => ({
    key: `threats/2025/12/threat-${i}.json`,
  })),
  truncated: true,
};

export const MOCK_R2_LIST_EMPTY = {
  objects: [],
  truncated: false,
};
