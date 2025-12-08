// TypeScript types for Threat Intelligence Dashboard

/// <reference types="@cloudflare/workers-types" />

export interface Env {
  DB: D1Database;
  AI: Ai;
  VECTORIZE_INDEX: VectorizeIndex;
  CACHE: KVNamespace;
  ANALYTICS: AnalyticsEngineDataset;
  THREAT_ARCHIVE: R2Bucket; // R2 bucket for archiving old threats
  ENVIRONMENT?: string;
  API_SECRET?: string; // Secret key for authenticating management endpoints
  ASSETS: Fetcher; // Added for Workers static assets support
  AI_GATEWAY_ID: string; // AI Gateway ID for routing Workers AI calls through gateway
  R2_ARCHIVE_ENABLED?: string; // 'true' | 'false' - Enable/disable R2 archival
}

export interface Threat {
  id: string;
  source: string;
  title: string;
  url: string;
  content: string;
  published_at: number;
  fetched_at: number;
  raw_data?: string;
}

export interface Summary {
  id?: number;
  threat_id: string;
  tldr: string;
  key_points: string[];
  category: ThreatCategory;
  severity: SeverityLevel;
  affected_sectors?: string[];
  threat_actors?: string[];
  confidence_score?: number;
  generated_at: number;
}

export interface IOC {
  id?: number;
  threat_id: string;
  ioc_type: IOCType;
  ioc_value: string;
  context?: string;
  first_seen: number;
  last_seen: number;
}

export interface Trend {
  id?: number;
  week_start: number;
  week_end: number;
  category?: string;
  trend_summary: string;
  key_insights?: string[];
  threat_count: number;
  severity_distribution?: Record<SeverityLevel, number>;
  generated_at: number;
}

export interface FeedSource {
  id?: number;
  name: string;
  url: string;
  type: 'rss' | 'atom' | 'json' | 'api';
  enabled: number;
  fetch_interval?: number;
  last_fetch?: number;
  last_success?: number;
  error_count?: number;
  last_error?: string;
  config?: string;
}

export type ThreatCategory =
  | 'ransomware'
  | 'apt'
  | 'vulnerability'
  | 'phishing'
  | 'malware'
  | 'data_breach'
  | 'ddos'
  | 'supply_chain'
  | 'insider_threat'
  | 'other';

export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type IOCType = 'ip' | 'domain' | 'cve' | 'hash' | 'url' | 'email';

// AI Analysis Response
export interface AIAnalysis {
  tldr: string;
  key_points: string[];
  category: ThreatCategory;
  severity: SeverityLevel;
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

// RSS Feed Item
export interface RSSItem {
  title: string;
  link: string;
  description: string;
  content?: string;
  pubDate: string;
  guid: string;
}

// API Response types
export interface ThreatWithSummary extends Threat {
  summary?: Summary;
  iocs?: IOC[];
}

export interface DashboardStats {
  total_threats: number;
  threats_today: number;
  threats_this_week: number;
  category_breakdown: Record<ThreatCategory, number>;
  severity_breakdown: Record<SeverityLevel, number>;
  top_sources: Array<{ source: string; count: number }>;
  recent_trends: Trend[];
}
