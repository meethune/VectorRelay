-- Threat Intelligence Database Schema

-- Core threats table (stores raw articles/alerts)
CREATE TABLE IF NOT EXISTS threats (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT UNIQUE NOT NULL,
  content TEXT NOT NULL,
  published_at INTEGER NOT NULL,
  fetched_at INTEGER NOT NULL,
  raw_data TEXT -- JSON blob for original data
);

CREATE INDEX IF NOT EXISTS idx_threats_published ON threats(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_threats_source ON threats(source);

-- AI-generated summaries and analysis
CREATE TABLE IF NOT EXISTS summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  threat_id TEXT NOT NULL,
  tldr TEXT NOT NULL,
  key_points TEXT NOT NULL, -- JSON array
  category TEXT NOT NULL,
  severity TEXT NOT NULL,
  affected_sectors TEXT, -- JSON array
  threat_actors TEXT, -- JSON array
  confidence_score REAL,
  generated_at INTEGER NOT NULL,
  FOREIGN KEY (threat_id) REFERENCES threats(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_summaries_threat ON summaries(threat_id);
CREATE INDEX IF NOT EXISTS idx_summaries_category ON summaries(category);
CREATE INDEX IF NOT EXISTS idx_summaries_severity ON summaries(severity);
CREATE INDEX IF NOT EXISTS idx_summaries_generated ON summaries(generated_at DESC);

-- Extracted Indicators of Compromise (IOCs)
CREATE TABLE IF NOT EXISTS iocs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  threat_id TEXT NOT NULL,
  ioc_type TEXT NOT NULL, -- ip, domain, cve, hash, url, email
  ioc_value TEXT NOT NULL,
  context TEXT,
  first_seen INTEGER NOT NULL,
  last_seen INTEGER NOT NULL,
  FOREIGN KEY (threat_id) REFERENCES threats(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_iocs_threat ON iocs(threat_id);
CREATE INDEX IF NOT EXISTS idx_iocs_type ON iocs(ioc_type);
CREATE INDEX IF NOT EXISTS idx_iocs_value ON iocs(ioc_value);
CREATE INDEX IF NOT EXISTS idx_iocs_first_seen ON iocs(first_seen DESC);

-- Categories/Tags
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  color TEXT,
  created_at INTEGER NOT NULL
);

-- Insert default categories
INSERT OR IGNORE INTO categories (name, description, color, created_at) VALUES
  ('ransomware', 'Ransomware attacks and campaigns', '#ef4444', unixepoch()),
  ('apt', 'Advanced Persistent Threats', '#dc2626', unixepoch()),
  ('vulnerability', 'Software vulnerabilities and exploits', '#f59e0b', unixepoch()),
  ('phishing', 'Phishing campaigns and social engineering', '#eab308', unixepoch()),
  ('malware', 'Malware analysis and distribution', '#f97316', unixepoch()),
  ('data_breach', 'Data breaches and leaks', '#8b5cf6', unixepoch()),
  ('ddos', 'DDoS attacks', '#ec4899', unixepoch()),
  ('supply_chain', 'Supply chain attacks', '#06b6d4', unixepoch()),
  ('insider_threat', 'Insider threats', '#84cc16', unixepoch()),
  ('other', 'Uncategorized threats', '#6b7280', unixepoch());

-- Weekly trend analysis (aggregated by AI)
CREATE TABLE IF NOT EXISTS trends (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week_start INTEGER NOT NULL,
  week_end INTEGER NOT NULL,
  category TEXT,
  trend_summary TEXT NOT NULL,
  key_insights TEXT, -- JSON array
  threat_count INTEGER NOT NULL,
  severity_distribution TEXT, -- JSON object
  generated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_trends_week ON trends(week_start DESC);
CREATE INDEX IF NOT EXISTS idx_trends_category ON trends(category);

-- Feed sources configuration
CREATE TABLE IF NOT EXISTS feed_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  url TEXT NOT NULL,
  type TEXT NOT NULL, -- rss, atom, json, api
  enabled INTEGER DEFAULT 1,
  fetch_interval INTEGER DEFAULT 21600, -- 6 hours in seconds
  last_fetch INTEGER,
  last_success INTEGER,
  error_count INTEGER DEFAULT 0,
  last_error TEXT,
  config TEXT -- JSON for API keys, headers, etc.
);

-- Insert default feed sources
INSERT OR IGNORE INTO feed_sources (name, url, type, enabled) VALUES
  ('CISA Alerts', 'https://www.cisa.gov/cybersecurity-advisories/all.xml', 'rss', 1),
  ('Krebs on Security', 'https://krebsonsecurity.com/feed/', 'rss', 1),
  ('BleepingComputer', 'https://www.bleepingcomputer.com/feed/', 'rss', 1),
  ('The Hacker News', 'https://feeds.feedburner.com/TheHackersNews', 'rss', 1),
  ('SANS ISC', 'https://isc.sans.edu/rssfeed.xml', 'rss', 1),
  ('Schneier on Security', 'https://www.schneier.com/feed/atom/', 'atom', 1),
  ('Dark Reading', 'https://www.darkreading.com/rss.xml', 'rss', 1),
  ('Cisco Talos', 'https://blog.talosintelligence.com/rss/', 'rss', 1),
  ('Malwarebytes Labs', 'https://www.malwarebytes.com/blog/feed/index.xml', 'rss', 1),
  ('Threatpost', 'https://threatpost.com/feed/', 'rss', 1),
  ('The Record', 'https://therecord.media/feed/', 'rss', 1),
  ('US-CERT Current Activity', 'https://www.cisa.gov/uscert/ncas/current-activity.xml', 'rss', 1);

-- User bookmarks/saved searches
CREATE TABLE IF NOT EXISTS bookmarks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  threat_id TEXT NOT NULL,
  notes TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (threat_id) REFERENCES threats(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_created ON bookmarks(created_at DESC);

-- Search history for analytics
CREATE TABLE IF NOT EXISTS search_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  query TEXT NOT NULL,
  result_count INTEGER,
  searched_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_search_history_date ON search_history(searched_at DESC);
