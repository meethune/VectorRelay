# 🛡️ Threat Intelligence Dashboard

A real-time threat intelligence aggregation and analysis platform powered by Cloudflare Workers, Workers AI, D1, Vectorize, and native cron triggers.

> **✨ Migrated from Pages to Workers** - This project now runs on Cloudflare Workers with native cron triggers, eliminating the need for GitHub Actions and providing better performance and developer experience.

## ✨ Features

- **🤖 AI-Powered Analysis**: Automatic summarization and categorization using Llama 3.3 (70B)
- **🚀 AI Gateway Integration**: Built-in caching, observability, and rate limiting for AI requests
- **🔍 Semantic Search**: Find related threats using vector embeddings (1024-dim)
- **📊 Trend Detection**: Weekly AI-generated threat trend analysis
- **🎯 IOC Extraction**: Automatic extraction of IPs, domains, CVEs, hashes
- **⏰ Native Cron Triggers**: Scheduled fetching from 7+ reputable security feeds every 6 hours
- **⚡ Real-time Updates**: Dashboard updates automatically via Workers cron
- **🎨 Dual Theme System**: Terminal (retro CRT) and Business (cybersecurity pro) themes with 15 Magic UI components
- **💰 100% Free Tier**: Runs entirely on Cloudflare's free tier

## 🏗️ Architecture

```
Frontend (React + Vite)
    ↓
Cloudflare Workers (with Static Assets)
    ↓
├─ AI Gateway (Caching, Observability, Rate Limiting)
│   └─ Workers AI (Llama 3.3 + BGE Embeddings)
├─ D1 Database (SQLite)
├─ Vectorize (1024-dim Vector Search)
├─ KV (Caching & Rate Limiting)
└─ Analytics Engine (Metrics)
    ↓
Native Cron Triggers (Every 6 hours)
```

## 📋 Prerequisites

- [Node.js](https://nodejs.org/) 18+ installed
- [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier)
- **Analytics Engine enabled** on your Cloudflare account (one-time setup)
  - This is an account-level feature, not a per-project resource
  - You'll be prompted to enable it on first deployment (just click the link)
  - Once enabled, it works for all your projects

**Note:** Unlike D1, Vectorize, and KV (which are created per-project via CLI), Analytics Engine is an account capability that must be enabled once via the dashboard.

## 🚀 Quick Start

**Full deployment instructions:** See [Deployment Guide](./docs/DEPLOYMENT.md)

### TL;DR

```bash
# 1. Install dependencies
npm install

# 2. Login to Cloudflare
npx wrangler login

# 3. Create resources (save the IDs!)
npx wrangler d1 create threat-intel-db
npx wrangler vectorize create threat-embeddings --dimensions=1024 --metric=cosine
npx wrangler kv namespace create CACHE
npx wrangler kv namespace create CACHE --preview

# 4. Update wrangler.jsonc with the IDs

# 5. Create AI Gateway (one-time setup for caching & observability)
# Go to Cloudflare Dashboard → AI → AI Gateway
# Click "Create Gateway" → Name it "threat-intel-dashboard" → Copy the ID
# This enables AI response caching and provides real-time observability

# 6. Enable Analytics Engine (one-time, do this BEFORE first deploy)
# Go to Cloudflare Dashboard → Workers & Pages → Analytics Engine
# Click "Enable Analytics Engine"

# 7. (Optional) Enable R2 Storage for archival
# ⚠️ R2 REQUIRES BILLING ACCOUNT - See docs/R2_STORAGE.md
# NOTE: R2 archival is ENABLED BY DEFAULT (R2_ARCHIVE_ENABLED=true in wrangler.jsonc)
# To disable: Set R2_ARCHIVE_ENABLED=false in Cloudflare Dashboard or wrangler.jsonc
#
# Go to Cloudflare Dashboard → R2 → Purchase R2 (free tier available)
# Add payment method (required even for free tier)
# Create bucket: npx wrangler r2 bucket create threat-intel-archive
# Run migration: npx wrangler d1 execute threat-intel-db --remote --file=./migrations/0002_add_r2_archival.sql

# 8. Initialize database
npx wrangler d1 execute threat-intel-db --remote --file=./schema.sql

# 9. Deploy to Cloudflare Workers
npm run deploy

# 10. Wait for automatic data ingestion
# The cron trigger runs automatically every 6 hours
# First run happens within 6 hours of deployment
# Check the dashboard after a few hours to see data appear
# Monthly archival runs automatically on the 1st of each month (if R2 enabled)
```

**Automated updates:** Native Workers cron trigger runs every 6 hours to fetch and analyze new threats automatically. No manual intervention required!

## 🧪 Local Development

**Start the development server:**
```bash
npm run dev
```

This starts Wrangler dev server with local bindings at `http://localhost:8787`

**Note:** Wrangler dev provides local development with access to Workers bindings. For full testing with remote resources, deploy to Workers and test there.

## 📊 Data Sources

The dashboard automatically ingests from these public feeds:

1. **CISA Alerts** - US Cybersecurity alerts
2. **Krebs on Security** - Brian Krebs security blog
3. **BleepingComputer** - Security news
4. **The Hacker News** - Cybersecurity news
5. **SANS ISC** - Internet Storm Center
6. **Schneier on Security** - Bruce Schneier's blog
7. **Dark Reading** - Enterprise security news

### Adding More Feeds

Edit the database directly or add to `schema.sql`:

```sql
INSERT INTO feed_sources (name, url, type, enabled) VALUES
  ('Your Feed Name', 'https://example.com/feed.xml', 'rss', 1);
```

Then re-run the migration:

```bash
wrangler d1 execute threat-intel-db --remote --file=./schema.sql
```

## 🔧 Configuration

### Environment Variables

**Required Production Variable:**

Set via Cloudflare Dashboard → Settings → Variables and Secrets:
- `ENVIRONMENT=production` (Production environment only)

This disables debug/test endpoints in production for security.

**Optional API Keys (for paid services):**

Set secrets using Wrangler CLI:

```bash
# If you want to add API keys for paid services (optional)
npx wrangler secret put ALIENVAULT_API_KEY
npx wrangler secret put ABUSEIPDB_API_KEY
```

### Scheduled Frequency

To change the ingestion frequency, edit `wrangler.jsonc`:

```jsonc
"triggers": {
  "crons": ["0 */6 * * *"]  // Every 6 hours
  // "crons": ["0 */3 * * *"]  // Every 3 hours
  // "crons": ["0 * * * *"]    // Every hour (uses more free tier quota)
}
```

**Note:** The free tier includes 5 cron triggers. See [Cloudflare Workers cron syntax](https://developers.cloudflare.com/workers/configuration/cron-triggers/) for more options.

## 📖 API Endpoints

### Public Endpoints

- `GET /api/stats` - Dashboard statistics (total threats, categories, severities)
- `GET /api/threats` - List threats with pagination and filters
- `GET /api/threat/:id` - Get threat details with IOCs
- `GET /api/search?q=ransomware&mode=semantic` - Semantic search using embeddings

### Debug Endpoints (Development Only)

**⚠️ Note:** These endpoints are disabled in production for security. They only work in development with API key authentication.

- `GET /api/debug/trigger-ingestion` - Manually trigger feed ingestion
- `GET /api/debug/process-ai?limit=N` - Process N threats with AI analysis
- `GET /api/debug/test-bindings` - Test all Cloudflare bindings
- `GET /api/debug/test-ai` - Test AI models
- `GET /api/debug/ingestion` - Debug feed fetching with detailed logs
- `POST /api/archive` - Manually trigger archival (dev only, requires API key)

In production, the cron trigger handles ingestion automatically every 6 hours.

### Example API Usage

**Production-ready endpoints:**
```bash
# Get dashboard stats
curl https://threat-intel-dashboard.YOUR-SUBDOMAIN.workers.dev/api/stats

# Search for ransomware threats semantically
curl https://threat-intel-dashboard.YOUR-SUBDOMAIN.workers.dev/api/search?q=ransomware&mode=semantic

# Get threats by category and severity
curl https://threat-intel-dashboard.YOUR-SUBDOMAIN.workers.dev/api/threats?category=apt&severity=critical

# Get specific threat details
curl https://threat-intel-dashboard.YOUR-SUBDOMAIN.workers.dev/api/threat/1675oc031wl
```

**Development-only endpoints (require API key):**
```bash
# Set API key header for debug endpoints
export API_KEY="your-api-key-from-dashboard"

# Manually trigger feed ingestion
curl -H "Authorization: Bearer $API_KEY" http://localhost:8787/api/debug/trigger-ingestion

# Process 10 threats with AI
curl -H "Authorization: Bearer $API_KEY" http://localhost:8787/api/debug/process-ai?limit=10

# Test all bindings
curl -H "Authorization: Bearer $API_KEY" http://localhost:8787/api/debug/test-bindings

# Manually trigger archival
curl -X POST -H "Authorization: Bearer $API_KEY" http://localhost:8787/api/archive
```

**Note:** In production, debug endpoints return 403 Forbidden. Cron triggers handle all data ingestion and archival automatically.

## 🎨 Customization

### Dual Theme System

The dashboard features two distinct visual modes that can be toggled seamlessly:

**Terminal Theme (Retro CRT)**:
- Classic green-on-black aesthetic (#00ff00 on #000000)
- Monospace fonts with scanline effects
- RetroGrid 3D backgrounds and FlickeringGrid animations
- HyperText glitch effects for emphasis
- Authentic terminal experience

**Business Theme (Cybersecurity Professional)**:
- Deep navy backgrounds with blue/purple accents
- Particle effects and gradient animations
- BorderBeam animated borders on cards
- NumberTicker smooth number animations
- Modern, professional aesthetic

Theme preference is automatically saved to localStorage. For complete theme documentation and implementation details, see the Dual-Theme System section in [`docs/PROJECT_STRUCTURE.md`](./docs/PROJECT_STRUCTURE.md#-dual-theme-system).

### Color Customization

Edit color palettes in `tailwind.config.js`:

```js
// Business theme colors
business: {
  bg: {
    primary: '#0a0e1a',    // Deep navy
    secondary: '#131720',   // Card backgrounds
  },
  accent: {
    primary: '#3b82f6',    // Bright blue
    secondary: '#8b5cf6',  // Purple
  }
}

// Terminal theme colors (fixed palette)
terminal: {
  green: '#00ff00',        // Classic CRT green
  'green-dim': '#00cc00',  // Dimmed green
}
```

## 🔒 Security Considerations

**Phase 1.2 Security: ✅ 100% Complete** (December 8, 2025)

- All AI processing happens on Cloudflare's edge (data doesn't leave CF network)
- No external API keys required for basic functionality
- RSS feeds are fetched server-side (no client-side requests)
- **Rate limiting** via KV cache prevents abuse (per-IP, per-endpoint)
- **IP blocking** for malicious traffic (temporary and permanent)
- **CORS protection** with origin allowlist (configurable via `ALLOWED_ORIGINS` env var)
- **Security headers** (CSP, HSTS, X-Frame-Options, etc.) on all responses
- **Request validation** middleware for pagination, sorting, body validation
- **Enhanced input sanitization** with multi-layered defense against SQL/XSS/NoSQL injection
- **API key rotation** mechanism with SHA-256 hashing and permission-based access
- **SQL injection protection** via parameterized queries + defense-in-depth sanitization

**Production CORS Setup:**
```bash
# Set in Cloudflare Dashboard → Workers → Settings → Variables
ALLOWED_ORIGINS="https://yourdomain.com,https://app.yourdomain.com"
```

See [`docs/SECURITY.md`](./docs/SECURITY.md) for complete security documentation.

## 📊 Free Tier Limits

| Resource | Free Tier | Estimated Usage | Notes |
|----------|-----------|-----------------|-------|
| Workers Requests | 100k/day | ~5k/day | ✅ Well within limits |
| Workers AI | 10k neurons/day | ~3k neurons/day | ✅ 30-40% savings via AI Gateway |
| D1 Reads | 5M/day | ~50k/day | ✅ Well within limits |
| D1 Writes | 100k/day | ~500/day | ✅ Well within limits |
| D1 Storage | 5GB | ~100MB-1GB | ✅ R2 archival extends lifespan |
| Vectorize | Free (beta) | ✅ | ✅ No limits during beta |
| KV Reads | 100k/day | ~5k/day | ✅ Well within limits |
| **R2 Storage** | **10GB** | **~2-5GB** | **⚠️ Requires billing account** |
| **R2 Class A Ops** | **1M/month** | **~1k/month** | **⚠️ Charges for overages** |
| **R2 Class B Ops** | **10M/month** | **~5k/month** | **⚠️ Charges for overages** |

**Result:** Stays well within free tier limits! 🎉

### ⚠️ Important: R2 Billing Requirements

**R2 Storage requires an active billing account and payment method**, even for the free tier. While the free tier is generous (10GB storage, 1M writes, 10M reads per month), **you WILL be charged for overages**.

**⚙️ R2 Archival is ENABLED BY DEFAULT** (`R2_ARCHIVE_ENABLED=true` in `wrangler.jsonc`)

**To disable R2 archival:**
```bash
# Option 1: Via Cloudflare Dashboard (no redeploy needed)
# Workers & Pages → your-worker → Settings → Variables
# Add: R2_ARCHIVE_ENABLED = false

# Option 2: Edit wrangler.jsonc and redeploy
"vars": {
  "R2_ARCHIVE_ENABLED": "false"  // Change to false
}
```

**Safety measures implemented:**
- Hard limit at 80% of free tier (8GB, 800K operations)
- KV-based quota tracking prevents accidental overages
- Monthly archival cron job (automatic on 1st of month)
- Conservative 90-day archive threshold
- Can be disabled via environment variable

**See** [`docs/R2_STORAGE.md`](./docs/R2_STORAGE.md) for complete billing requirements, quota protection, and emergency procedures.

## 🐛 Troubleshooting

### Issue: No data appearing on dashboard

**In Production:**
- Wait up to 6 hours for the first cron trigger to run
- Check cron execution logs: `npx wrangler tail`
- Verify Analytics Engine is enabled in dashboard
- Check Workers logs for errors during cron execution

**In Development (local testing):**
1. Check if bindings are working:
   ```bash
   curl -H "Authorization: Bearer YOUR_API_KEY" http://localhost:8787/api/debug/test-bindings
   ```
   All should show `"status": "OK"`

2. Manually trigger ingestion:
   ```bash
   curl -H "Authorization: Bearer YOUR_API_KEY" http://localhost:8787/api/debug/trigger-ingestion
   ```

3. Check debug logs:
   ```bash
   curl -H "Authorization: Bearer YOUR_API_KEY" http://localhost:8787/api/debug/ingestion
   ```

4. Process AI analysis:
   ```bash
   curl -H "Authorization: Bearer YOUR_API_KEY" http://localhost:8787/api/debug/process-ai?limit=30
   ```

**Note:** Debug endpoints are disabled in production for security. Use `wrangler tail` to monitor the cron trigger instead.

### Issue: Analytics Engine error on deployment

**Error:**
```
You need to enable Analytics Engine. Head to the Cloudflare Dashboard to enable
[code: 10089]
```

**This should not happen if you followed step 5 in Quick Start!** Analytics Engine must be enabled BEFORE first deployment.

**Solution:**
1. Go to Cloudflare Dashboard → Workers & Pages → Analytics Engine
2. Click **"Enable Analytics Engine"** (one-time setup for your entire account)
3. Re-deploy: `npm run deploy`
4. **Note:** You do NOT need to manually create the dataset - it auto-creates on first write

**Why this is different from D1/Vectorize/KV:**
- **D1/Vectorize/KV**: Per-project resources created via CLI (`wrangler d1 create`, etc.)
- **Analytics Engine**: Account-level feature enabled via dashboard (no CLI command)
- Once enabled, all your Workers/Pages projects can use Analytics Engine
- Each project can have its own datasets, which auto-create on first use

### Issue: DOMParser is not defined

**This is already fixed** in the current version. The RSS parser uses regex instead of DOMParser.

If you see this error, update `functions/utils/rss-parser.ts` from the latest repository.

### Issue: Vector dimension mismatch

**Error:** `expected 768 dimensions, and got 1024 dimensions`

**Solution:**
```bash
# Delete old index
npx wrangler vectorize delete threat-embeddings

# Create new index with correct dimensions
npx wrangler vectorize create threat-embeddings --dimensions=1024 --metric=cosine
```

The BGE-Large embedding model outputs 1024 dimensions.

### Issue: AI analysis not generating

**Check:**
1. Test AI endpoint:
   ```bash
   curl https://YOUR-SITE.pages.dev/api/test-ai
   ```

2. If you see "No AI analysis generated", check that `functions/utils/ai-processor.ts` properly handles the Workers AI response format (should be updated to handle `{ response: {...} }` format)

### Cron Triggers

**Viewing cron execution logs:**
```bash
# Stream live logs from your Worker
npx wrangler tail
```

**Note:** This project now uses native Workers cron triggers instead of GitHub Actions for scheduled tasks. The `.github/workflows/scheduled-ingestion.yml` file is no longer needed and can be safely deleted.

### Database reinitialization

If you need to reset the database:

```bash
# Clear all data (WARNING: Destructive!)
npx wrangler d1 execute threat-intel-db --remote --command="DROP TABLE IF EXISTS threats; DROP TABLE IF EXISTS summaries; DROP TABLE IF EXISTS iocs;"

# Reinitialize
npx wrangler d1 execute threat-intel-db --remote --file=./schema.sql
```

### Build errors

Clear cache and rebuild:

```bash
rm -rf node_modules dist
npm install
npm run build
```

### Debugging

For production logs and debugging, see the [Deployment Guide](./docs/DEPLOYMENT.md#-debugging-with-logs)

## 📚 Documentation

For detailed documentation on setup, deployment, security, and architecture, see the [docs](./docs/) directory:

- [API Key Setup](./docs/API_KEY_SETUP.md) - Local development API key setup (optional)
- [Deployment Guide](./docs/DEPLOYMENT.md) - Step-by-step deployment instructions
- [GitHub CI/CD Setup](./docs/GITHUB_CICD_SETUP.md) - Automatic deployment configuration
- [Project Structure](./docs/PROJECT_STRUCTURE.md) - Codebase organization
- [Security Documentation](./docs/SECURITY.md) - Comprehensive security analysis and implementation

## 📚 Learn More

- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/)
- [D1 Database](https://developers.cloudflare.com/d1/)
- [Vectorize](https://developers.cloudflare.com/vectorize/)
- [Workers Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)

## 🤝 Contributing

This is a starter template. Feel free to:

- Add more threat intelligence feeds
- Implement email/Slack alerts
- Add export to STIX format
- Integrate with SIEM platforms
- Build custom dashboards
- Add user authentication

## 📄 License

MIT License - feel free to use for personal or commercial projects

---

**Built with ❤️ using Cloudflare's developer platform**

Need help? Check the [Cloudflare Discord](https://discord.gg/cloudflaredev) or [Community Forum](https://community.cloudflare.com/)

## Pre-commit Hooks

This project uses Husky + lint-staged for automated code quality checks:
- **ESLint** runs on staged code files
- **Tests + Build** only run when code files (.ts, .tsx, .js, .jsx, .sql, .json) are changed
- **Docs-only commits** skip tests and build for faster commits
