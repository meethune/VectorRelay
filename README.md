# 🛡️ Threat Intelligence Dashboard

A real-time threat intelligence aggregation and analysis platform powered by Cloudflare Pages, Workers AI, D1, Vectorize, and GitHub Actions.

## ✨ Features

- **🤖 AI-Powered Analysis**: Automatic summarization and categorization using Llama 3.3 (70B)
- **🔍 Semantic Search**: Find related threats using vector embeddings (1024-dim)
- **📊 Trend Detection**: Weekly AI-generated threat trend analysis
- **🎯 IOC Extraction**: Automatic extraction of IPs, domains, CVEs, hashes
- **📡 Auto-Ingestion**: Scheduled fetching from 7+ reputable security feeds via GitHub Actions
- **⚡ Real-time Updates**: Dashboard updates every 6 hours automatically
- **🎨 Modern UI**: Responsive React dashboard with CRT terminal green theme
- **💰 100% Free Tier**: Runs entirely on Cloudflare's free tier

## 🏗️ Architecture

```
Frontend (React + Vite)
    ↓
Cloudflare Pages + Functions
    ↓
├─ Workers AI (Llama 3.3 + BGE Embeddings)
├─ D1 Database (SQLite)
├─ Vectorize (1024-dim Vector Search)
├─ KV (Caching & Rate Limiting)
└─ Analytics Engine (Metrics)
    ↓
GitHub Actions (Scheduled Triggers)
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

### 1. Clone and Install

```bash
git clone https://github.com/meethune/VectorRelay.git
cd VectorRelay
npm install
```

### 2. Authenticate with Cloudflare

```bash
npx wrangler login
```

This will open your browser to authenticate with Cloudflare.

### 3. Create Cloudflare Resources

**Create D1 Database:**
```bash
npx wrangler d1 create threat-intel-db
```
Copy the `database_id` from the output - you'll need it for step 6.

**Create Vectorize Index (1024 dimensions for BGE-Large model):**
```bash
npx wrangler vectorize create threat-embeddings --dimensions=1024 --metric=cosine
```

**Create KV Namespaces:**
```bash
npx wrangler kv namespace create CACHE
npx wrangler kv namespace create CACHE --preview
```
Copy both `id` values - you'll need them for step 6.

### 4. Initialize Database Schema

```bash
npx wrangler d1 execute threat-intel-db --remote --file=./schema.sql
```

This creates all tables and populates default feed sources.

### 5. Update Configuration

Edit `wrangler.jsonc` and replace the placeholder IDs:

```jsonc
{
  "d1_databases": [
    {
      "database_id": "YOUR_D1_DATABASE_ID"  // ← Replace this
    }
  ],
  "kv_namespaces": [
    {
      "id": "YOUR_KV_NAMESPACE_ID",          // ← Replace this
      "preview_id": "YOUR_KV_PREVIEW_ID"     // ← Replace this
    }
  ]
}
```

### 6. Connect to GitHub

1. Push your repository to GitHub (if not already done)
2. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages**
3. Click **"Create Application"** → **"Pages"** → **"Connect to Git"**
4. Select your `VectorRelay` repository
5. Configure build settings:
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Root directory:** (leave empty)
   - **Deploy command:** (leave empty)
6. Click **"Save and Deploy"**

Cloudflare will automatically detect `wrangler.jsonc` and configure all bindings.

### 7. Enable Analytics Engine (First Deployment Only)

**This is expected!** On your first deployment, you'll see:

```
Error: You need to enable Analytics Engine. Head to the Cloudflare Dashboard to enable
[code: 10089]
```

This is normal - Analytics Engine is an **account-level feature** that requires one-time enablement:

1. Click the error link in the deployment logs, or manually go to:
   - Dashboard → **Workers & Pages** → **Analytics Engine**
2. Click **"Enable Analytics Engine"** (one-time button)
3. The dataset (`threat_metrics`) will auto-create on first use
4. Re-deploy: Push any change to GitHub, or click "Retry deployment"

**Why this happens:**
- Unlike D1/Vectorize/KV (created per-project via CLI), Analytics Engine is an account capability
- No CLI command exists to enable it - must be done via dashboard
- Once enabled, **all your projects can use it** (never need to enable again)
- The actual dataset auto-creates when your Worker first calls `writeDataPoint()`

### 8. Verify Deployment

Your site will be live at: `https://YOUR-PROJECT-NAME.pages.dev`

**Test the bindings:**
```bash
curl https://YOUR-PROJECT-NAME.pages.dev/api/test-bindings
```

You should see all bindings showing `"status": "OK"`.

### 9. Trigger Initial Data Load

**Manual trigger:**
```bash
curl https://YOUR-PROJECT-NAME.pages.dev/api/trigger-ingestion
```

**Process AI analysis:**
```bash
curl https://YOUR-PROJECT-NAME.pages.dev/api/process-ai?limit=30
```

Wait 2-3 minutes, then check your dashboard - you should see threat data!

### 10. Automated Updates (Already Configured!)

The repository includes `.github/workflows/scheduled-ingestion.yml` which:
- ✅ Runs **every 6 hours** (00:00, 06:00, 12:00, 18:00 UTC)
- ✅ Fetches new threats from all 7 security feeds
- ✅ Processes them with AI analysis
- ✅ Stores results in your database

**Test it manually:**
1. Go to your GitHub repository → **Actions** tab
2. Click **"Scheduled Feed Ingestion"**
3. Click **"Run workflow"** → **"Run workflow"**
4. Watch the logs to see it fetch and process threats

## 🧪 Local Development

**Start the development server:**
```bash
npm run dev
```

This starts Vite dev server at `http://localhost:5173`

**Note:** Local development uses the Vite dev server for the frontend only. Pages Functions and Cloudflare bindings (D1, AI, Vectorize) are not available locally. For testing:

1. Push to GitHub to trigger automatic deployment
2. Use the deployed preview URL for testing
3. Or use `wrangler pages dev` after building (bindings still won't work without additional setup)

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

Set secrets using Wrangler:

```bash
# If you want to add API keys for paid services (optional)
wrangler secret put ALIENVAULT_API_KEY
wrangler secret put ABUSEIPDB_API_KEY
```

### Scheduled Frequency

Edit `wrangler.jsonc` to change ingestion frequency:

```jsonc
"triggers": {
  "crons": [
    "0 */6 * * *"  // Every 6 hours
    // "0 */3 * * *"  // Every 3 hours
    // "0 * * * *"    // Every hour
  ]
}
```

## 📖 API Endpoints

### Public Endpoints

- `GET /api/stats` - Dashboard statistics (total threats, categories, severities)
- `GET /api/threats` - List threats with pagination and filters
- `GET /api/threat/:id` - Get threat details with IOCs
- `GET /api/search?q=ransomware&mode=semantic` - Semantic search using embeddings

### Management Endpoints

- `GET /api/trigger-ingestion` - Manually trigger feed ingestion
- `GET /api/process-ai?limit=N` - Process N threats with AI analysis
- `GET /api/test-bindings` - Test all Cloudflare bindings
- `GET /api/debug-ingestion` - Debug feed fetching (shows detailed logs)

### Example API Usage

```bash
# Get dashboard stats
curl https://threat-intel-dashboard.pages.dev/api/stats

# Search for ransomware threats semantically
curl https://threat-intel-dashboard.pages.dev/api/search?q=ransomware&mode=semantic

# Get threats by category and severity
curl https://threat-intel-dashboard.pages.dev/api/threats?category=apt&severity=critical

# Manually trigger feed ingestion
curl https://threat-intel-dashboard.pages.dev/api/trigger-ingestion

# Process 10 threats with AI
curl https://threat-intel-dashboard.pages.dev/api/process-ai?limit=10

# Test all bindings
curl https://threat-intel-dashboard.pages.dev/api/test-bindings
```

## 🎨 Customization

### UI Theme

Edit `src/index.css` to customize colors:

```css
:root {
  color-scheme: dark;
  background-color: #0f172a; /* Change to your preferred color */
}
```

### Severity Colors

Edit `tailwind.config.js`:

```js
theme: {
  extend: {
    colors: {
      critical: '#dc2626',  // Customize colors
      high: '#f59e0b',
      // ...
    },
  },
}
```

## 🔒 Security Considerations

- All AI processing happens on Cloudflare's edge (data doesn't leave CF network)
- No external API keys required for basic functionality
- RSS feeds are fetched server-side (no client-side requests)
- Rate limiting via KV cache prevents feed abuse
- CORS is automatically handled by Pages Functions

## 📊 Free Tier Limits

| Resource | Free Tier | Estimated Usage |
|----------|-----------|-----------------|
| Pages Requests | Unlimited | ✅ |
| Functions Requests | 100k/day | ~5k/day |
| Workers AI | 10k neurons/day | ~3k neurons/day |
| D1 Reads | 5M/day | ~50k/day |
| D1 Writes | 100k/day | ~500/day |
| D1 Storage | 5GB | ~100MB |
| Vectorize | Free (beta) | ✅ |
| KV Reads | 100k/day | ~5k/day |

**Result:** Stays well within free tier limits! 🎉

## 🐛 Troubleshooting

### Issue: No data appearing on dashboard

**Solution:**
1. Check if bindings are working:
   ```bash
   curl https://YOUR-SITE.pages.dev/api/test-bindings
   ```
   All should show `"status": "OK"`

2. Manually trigger ingestion:
   ```bash
   curl https://YOUR-SITE.pages.dev/api/trigger-ingestion
   ```

3. Check debug logs:
   ```bash
   curl https://YOUR-SITE.pages.dev/api/debug-ingestion
   ```

4. Process AI analysis:
   ```bash
   curl https://YOUR-SITE.pages.dev/api/process-ai?limit=30
   ```

### Issue: Analytics Engine error on first deployment

**Error:**
```
You need to enable Analytics Engine. Head to the Cloudflare Dashboard to enable
[code: 10089]
```

**This is normal on first deployment!** Analytics Engine is an account-level feature (like enabling Workers AI), not a per-project resource.

**Solution:**
1. Go to Cloudflare Dashboard → Workers & Pages → Analytics Engine
2. Click **"Enable Analytics Engine"** (one-time setup for your entire account)
3. Re-deploy (push to GitHub or click "Retry deployment")
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

### Issue: GitHub Actions not running

**Solution:**
1. Go to GitHub repository → **Settings** → **Actions** → **General**
2. Ensure "Allow all actions and reusable workflows" is enabled
3. Check **Actions** tab for any failed runs
4. Manually trigger: Actions → Scheduled Feed Ingestion → Run workflow

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

### Check Cloudflare Logs

For production debugging, you have two options:

**Option 1: Web UI (Real-time Logs)**

Follow these exact steps ([official docs](https://developers.cloudflare.com/pages/functions/debugging-and-logging/#view-logs-in-the-cloudflare-dashboard)):

1. Go to [Workers & Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages)
2. Select your Pages project (e.g., `threat-intel-dashboard`)
3. Click **"View details"** on the production deployment (main branch)
4. Select the **"Functions"** tab
5. Scroll down to **"Real-time Logs"**
6. Click **"Begin log stream"**
7. Trigger an action (like `/api/trigger-ingestion`) and watch for errors in real-time

**Option 2: CLI (Wrangler Tail)**

From your terminal:
```bash
npx wrangler pages deployment tail --project-name=threat-intel-dashboard
```

Then trigger actions and watch logs stream in your terminal. Both methods provide equivalent output

## 📚 Learn More

- [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/)
- [D1 Database](https://developers.cloudflare.com/d1/)
- [Vectorize](https://developers.cloudflare.com/vectorize/)
- [Pages Functions](https://developers.cloudflare.com/pages/functions/)
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
