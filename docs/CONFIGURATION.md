# VectorRelay Configuration Guide

Complete guide to all configuration options and environment variables.

---

## 📋 Environment Variables

All environment variables are defined in `wrangler.jsonc` under the `vars` section. These can be overridden in the Cloudflare Dashboard without redeploying.

### Core Variables

#### `ENVIRONMENT`
**Default:** `"production"`
**Values:** `"production"` | `"development"`

Controls whether debug/test endpoints are accessible.

- **Production** (`production`): Debug endpoints disabled for security
- **Development** (`development`): All endpoints accessible

**Debug Endpoints (dev only, require API key):**
- `/api/debug/trigger-ingestion` - Manually trigger feed ingestion
- `/api/debug/process-ai` - Manually process AI analysis
- `/api/debug/test-bindings` - Test Cloudflare bindings
- `/api/debug/test-ai` - Test AI models
- `/api/debug/ingestion` - Debug feed fetching
- `/api/archive` (POST) - Manually trigger archival

**Override in Dashboard:**
```
Workers & Pages → Settings → Variables → Add variable
Name: ENVIRONMENT
Value: development
```

---

### AI Gateway Configuration

#### `AI_GATEWAY_ID`
**Default:** `"threat-intel-dashboard"`
**Required:** Yes

The ID of your AI Gateway for caching and observability.

**Setup:**
1. Go to Cloudflare Dashboard → AI → AI Gateway
2. Create gateway named `threat-intel-dashboard`
3. Copy the gateway ID
4. Add to `wrangler.jsonc` or dashboard

**Benefits:**
- 30-40% neuron savings via intelligent caching
- Real-time usage analytics
- Rate limiting and fallbacks
- Request/response logging

**Override in Dashboard:**
```
Name: AI_GATEWAY_ID
Value: your-gateway-id
```

---

### R2 Storage Configuration

#### `R2_ARCHIVE_ENABLED`
**Default:** `"true"` ✅ **ENABLED BY DEFAULT**
**Values:** `"true"` | `"false"`

Controls whether R2 archival is active.

**When enabled (`"true"`):**
- Monthly cron job archives threats older than 90 days
- Runs automatically on 1st of each month at 00:00 UTC
- Archives up to 100 threats per run
- Enforces 80% quota limits to prevent billing
- Tracks usage in KV namespace

**When disabled (`"false"`):**
- No archival occurs
- All threats remain in D1 database
- D1 may eventually reach 5GB limit
- Useful for testing or quota management

**How to Disable:**

**Option 1: Cloudflare Dashboard (Recommended)**
```
1. Workers & Pages → threat-intel-dashboard → Settings → Variables
2. Add variable: R2_ARCHIVE_ENABLED = false
3. Save (takes effect immediately, no redeploy needed)
```

**Option 2: Edit wrangler.jsonc**
```jsonc
"vars": {
  "R2_ARCHIVE_ENABLED": "false"
}
```
Then redeploy: `npm run deploy`

**When to Disable:**
- Approaching R2 quota limits (>70% usage)
- Testing without using R2 operations
- Diagnosing archival issues
- Want to keep all data in D1 (not recommended)

**Monitoring:**
```bash
# Check R2 usage and quota status
curl https://your-worker.workers.dev/api/archive
```

---

## 🔗 Bindings Configuration

All bindings are configured in `wrangler.jsonc`. These connect your Worker to Cloudflare services.

### D1 Database

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "threat-intel-db",
    "database_id": "your-database-id"
  }
]
```

**Setup:**
```bash
npx wrangler d1 create threat-intel-db
# Copy the database_id to wrangler.jsonc
```

---

### Vectorize Index

```jsonc
"vectorize": [
  {
    "binding": "VECTORIZE_INDEX",
    "index_name": "threat-embeddings"
  }
]
```

**Setup:**
```bash
npx wrangler vectorize create threat-embeddings --dimensions=1024 --metric=cosine
```

**Dimensions:** 1024 (matches BGE-Large model output)
**Metric:** Cosine similarity

---

### Workers AI

```jsonc
"ai": {
  "binding": "AI"
}
```

**Models Used:**
- `@cf/meta/llama-3.3-70b-instruct-fp8-fast` - Threat analysis
- `@cf/qwen/qwen2.5-coder-32b-instruct` - IOC extraction
- `@cf/baai/bge-large-en-v1.5` - Semantic embeddings

**Free Tier:** 10,000 neurons/day
**Current Usage:** ~3,000 neurons/day (30% of limit)

---

### KV Namespace

```jsonc
"kv_namespaces": [
  {
    "binding": "CACHE",
    "id": "your-kv-id",
    "preview_id": "your-preview-id"
  }
]
```

**Setup:**
```bash
npx wrangler kv namespace create CACHE
npx wrangler kv namespace create CACHE --preview
# Copy both IDs to wrangler.jsonc
```

**Used For:**
- Rate limiting
- R2 quota tracking
- Feed fetch timestamps

---

### Analytics Engine

```jsonc
"analytics_engine_datasets": [
  {
    "binding": "ANALYTICS",
    "dataset": "threat_metrics"
  }
]
```

**Setup:**
1. Go to Cloudflare Dashboard → Workers & Pages → Analytics Engine
2. Click "Enable Analytics Engine" (one-time, account-wide)
3. Dataset auto-creates on first write

**Data Tracked:**
- Feed ingestion metrics
- AI processing stats
- Subrequest usage
- Daily threat counts

---

### R2 Storage

```jsonc
"r2_buckets": [
  {
    "binding": "THREAT_ARCHIVE",
    "bucket_name": "threat-intel-archive"
  }
]
```

**Setup:**
```bash
# Enable R2 in dashboard first (requires billing account)
npx wrangler r2 bucket create threat-intel-archive
```

**⚠️ IMPORTANT:**
- R2 requires active billing account and payment method
- You WILL be charged for overages beyond free tier
- See `docs/R2_STORAGE.md` for complete billing info

**Free Tier:**
- 10 GB storage/month
- 1M Class A operations/month (writes)
- 10M Class B operations/month (reads)

**Safety:**
- Hard limit at 80% of free tier (8GB, 800K ops)
- Pre-flight quota checks
- KV-based usage tracking

---

## ⏰ Cron Triggers

```jsonc
"triggers": {
  "crons": ["0 */6 * * *"]
}
```

**Schedule:** Every 6 hours (00:00, 06:00, 12:00, 18:00 UTC)

**Tasks Performed:**
1. Fetch new threats from RSS/Atom feeds (7 sources)
2. Process up to 10 threats with AI analysis
3. Generate embeddings for semantic search
4. Extract IOCs (IPs, domains, CVEs, hashes)
5. Track neuron usage and subrequests
6. **Monthly archival** (only on 1st of month at 00:00)

**Modify Schedule:**
```jsonc
"crons": [
  "0 */3 * * *"   // Every 3 hours
  "0 * * * *"     // Every hour
  "0 0 * * *"     // Daily at midnight
]
```

**Free Tier Limit:** 5 cron triggers per worker

---

## 🔐 Secrets (Optional)

Secrets are sensitive values not stored in `wrangler.jsonc`. Set via CLI or dashboard.

### `API_SECRET`

**Purpose:** Authenticate management endpoints in production
**Optional:** Yes (only if you want API key auth for debug endpoints)

**Set via CLI:**
```bash
npx wrangler secret put API_SECRET
# Enter your secret key when prompted
```

**Set via Dashboard:**
```
Workers & Pages → Settings → Variables → Add variable
Type: Secret
Name: API_SECRET
Value: your-secret-key
```

**Usage:**
```bash
# Access protected endpoint
curl -H "Authorization: Bearer your-secret-key" \
  https://your-worker.workers.dev/api/trigger-ingestion
```

---

## 📊 Default Configuration Summary

| Variable | Default | Modifiable |
|----------|---------|------------|
| `ENVIRONMENT` | `production` | ✅ Dashboard or wrangler.jsonc |
| `AI_GATEWAY_ID` | `threat-intel-dashboard` | ✅ Dashboard or wrangler.jsonc |
| `R2_ARCHIVE_ENABLED` | `true` | ✅ Dashboard or wrangler.jsonc |
| `API_SECRET` | Not set | ✅ Dashboard or CLI (secret) |

---

## 🛠️ Local Development

Create `.dev.vars` for local development (never commit this file):

```bash
# .dev.vars
ENVIRONMENT=development
AI_GATEWAY_ID=threat-intel-dashboard
R2_ARCHIVE_ENABLED=true
```

This allows testing debug endpoints locally:
```bash
npm run dev
# Access http://localhost:8787/api/trigger-ingestion
```

---

## 📚 Related Documentation

- [R2 Storage Guide](./R2_STORAGE.md) - Complete R2 billing and setup
- [Deployment Guide](./DEPLOYMENT.md) - Step-by-step deployment
- [Security Documentation](./SECURITY.md) - Security implementation
- [Project Structure](./PROJECT_STRUCTURE.md) - Codebase organization

---

**Last Updated:** 2025-12-08
**Project:** VectorRelay - Threat Intelligence Dashboard
