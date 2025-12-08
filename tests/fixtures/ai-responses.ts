/**
 * AI Response Test Fixtures
 *
 * Contains sample AI responses in various formats that Workers AI might return
 */

export interface MockAIAnalysis {
  category: string;
  severity: string;
  tldr: string;
  key_points: string[];
  affected_sectors: string[];
  threat_actors: string[];
  iocs: {
    ips: string[];
    domains: string[];
    cves: string[];
    hashes: string[];
    urls: string[];
    emails: string[];
  };
}

// Case 1a: New format with structured response object
export const AI_RESPONSE_STRUCTURED_OBJECT = {
  response: {
    category: 'ransomware',
    severity: 'critical',
    tldr: 'New ransomware variant targets healthcare',
    key_points: ['Encrypts medical records', 'Demands $1M ransom', 'Active since Dec 2025'],
    affected_sectors: ['healthcare', 'pharmaceutical'],
    threat_actors: ['BlackCat'],
    iocs: {
      ips: ['192.168.1.100', '10.0.0.50'],
      domains: ['malicious-c2.com'],
      cves: ['CVE-2025-1234'],
      hashes: ['abc123def456'],
      urls: ['https://evil.com/payload'],
      emails: ['attacker@evil.com'],
    },
  },
};

// Case 1b: New format with JSON string in response
export const AI_RESPONSE_JSON_STRING = {
  response: JSON.stringify({
    category: 'phishing',
    severity: 'high',
    tldr: 'Phishing campaign targets executives',
    key_points: ['Spear phishing emails', 'Fake login pages', 'Credential theft'],
    affected_sectors: ['finance', 'technology'],
    threat_actors: ['APT28'],
    iocs: {
      ips: [],
      domains: ['fake-microsoft-login.com'],
      cves: [],
      hashes: [],
      urls: ['https://fake-microsoft-login.com/signin'],
      emails: ['ceo@fake-domain.com'],
    },
  }),
};

// Case 1c: JSON string with extra text before/after
export const AI_RESPONSE_JSON_WITH_PREAMBLE = {
  response: `Sure, here is the analysis:

{
  "category": "zero_day",
  "severity": "critical",
  "tldr": "Critical zero-day exploit in Chrome",
  "key_points": ["Remote code execution", "No patch available", "Actively exploited"],
  "affected_sectors": ["all"],
  "threat_actors": ["APT41"],
  "iocs": {
    "ips": [],
    "domains": [],
    "cves": ["CVE-2025-0001"],
    "hashes": [],
    "urls": [],
    "emails": []
  }
}

That's the complete analysis.`,
};

// Case 2: Direct JSON string (legacy format)
export const AI_RESPONSE_DIRECT_JSON_STRING = JSON.stringify({
  category: 'malware',
  severity: 'medium',
  tldr: 'New trojan targets banking apps',
  key_points: ['Android malware', 'Steals banking credentials', 'Distributed via SMS'],
  affected_sectors: ['finance', 'consumer'],
  threat_actors: ['FluBot Gang'],
  iocs: {
    ips: [],
    domains: ['flubot-c2.ru'],
    cves: [],
    hashes: ['sha256:deadbeef'],
    urls: [],
    emails: [],
  },
});

// Case 3: Direct object (already parsed)
export const AI_RESPONSE_DIRECT_OBJECT = {
  category: 'vulnerability',
  severity: 'high',
  tldr: 'SQL injection in popular CMS',
  key_points: ['Affects version 3.x', 'Patch released', 'Active exploitation observed'],
  affected_sectors: ['web', 'ecommerce'],
  threat_actors: [],
  iocs: {
    ips: [],
    domains: [],
    cves: ['CVE-2025-5678'],
    hashes: [],
    urls: [],
    emails: [],
  },
};

// Malformed responses for error handling
export const AI_RESPONSE_MALFORMED_JSON = {
  response: '{ "category": "apt", "severity": ', // Incomplete JSON
};

export const AI_RESPONSE_NON_JSON_STRING = {
  response: 'This is just plain text with no JSON at all.',
};

export const AI_RESPONSE_EMPTY_OBJECT = {};

export const AI_RESPONSE_NULL = null;

export const AI_RESPONSE_UNDEFINED = undefined;

export const AI_RESPONSE_EMPTY_STRING = {
  response: '',
};

// Text response formats
export const AI_TEXT_RESPONSE_SIMPLE = {
  response: 'This is a simple text summary of the threat.',
};

export const AI_TEXT_RESPONSE_DIRECT_STRING = 'Direct text response without wrapper.';

// Validation test data
export const AI_RESPONSE_MISSING_REQUIRED_FIELDS = {
  category: 'ddos',
  // Missing severity and tldr
  key_points: ['DDoS attack observed'],
  affected_sectors: [],
  threat_actors: [],
  iocs: {
    ips: [],
    domains: [],
    cves: [],
    hashes: [],
    urls: [],
    emails: [],
  },
};

export const AI_RESPONSE_EMPTY_REQUIRED_FIELDS = {
  category: 'supply_chain',
  severity: '', // Empty string
  tldr: '', // Empty string
  key_points: [],
  affected_sectors: [],
  threat_actors: [],
  iocs: {
    ips: [],
    domains: [],
    cves: [],
    hashes: [],
    urls: [],
    emails: [],
  },
};

export const AI_RESPONSE_COMPLETE = {
  category: 'ransomware',
  severity: 'critical',
  tldr: 'Complete analysis with all required fields',
  key_points: ['Point 1', 'Point 2', 'Point 3'],
  affected_sectors: ['healthcare'],
  threat_actors: ['BlackCat'],
  iocs: {
    ips: ['1.2.3.4'],
    domains: ['evil.com'],
    cves: [],
    hashes: [],
    urls: [],
    emails: [],
  },
};
