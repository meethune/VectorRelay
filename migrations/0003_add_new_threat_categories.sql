-- Migration: Add new threat categories
-- Date: 2025-12-08
-- Purpose: Expand threat categories to reduce "other" misclassification from 40% to <10%

-- Add new threat categories to the categories table
INSERT OR IGNORE INTO categories (name, description, color, created_at) VALUES
  ('cloud_security', 'Cloud infrastructure attacks (AWS, Azure, GCP, Kubernetes)', '#0ea5e9', unixepoch()),
  ('web_security', 'Web application vulnerabilities (XSS, SQLi, RCE, CSRF)', '#f59e0b', unixepoch()),
  ('zero_day', 'Zero-day vulnerabilities and exploits (critical priority)', '#dc2626', unixepoch()),
  ('cryptojacking', 'Cryptocurrency mining malware and campaigns', '#a855f7', unixepoch()),
  ('iot_security', 'IoT and embedded device security threats', '#14b8a6', unixepoch()),
  ('disinformation', 'Disinformation campaigns and influence operations', '#ef4444', unixepoch()),
  ('policy', 'Legal, regulatory, and policy security updates', '#64748b', unixepoch());

-- Verify insertion
SELECT name, description FROM categories ORDER BY created_at DESC LIMIT 7;
