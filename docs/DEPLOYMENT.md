# 🚀 Production Deployment Guide

This guide walks through deploying the Threat Intelligence Dashboard to Cloudflare Workers with all required services.

## 📋 Prerequisites Checklist

- [ ] GitHub account
- [ ] Cloudflare account (free tier works!)
- [ ] Node.js 18+ installed
- [ ] Git installed

**Note:** Analytics Engine will need to be enabled on first deployment (one-time, account-level setup). Unlike D1/Vectorize/KV which are created per-project via CLI, Analytics Engine is an account capability enabled via dashboard.

## 🔧 Step-by-Step Deployment

### Step 1: Authenticate with Cloudflare

```bash
npx wrangler login
```

This opens your browser to authenticate. Once complete, you're ready to create resources.

---

### Step 2: Create Required Resources

Run these commands one at a time and **save the IDs** from each:

**D1 Database:**
```bash
npx wrangler d1 create threat-intel-db
```

Output will include:
```
database_id = "abc123..."
```
**Save this ID!**

**Vectorize Index:**
```bash
npx wrangler vectorize create threat-embeddings --dimensions=1024 --metric=cosine
```

Note: We use 1024 dimensions because the BGE-Large embedding model outputs 1024-dim vectors.

**KV Namespaces:**
```bash
npx wrangler kv namespace create CACHE
npx wrangler kv namespace create CACHE --preview
```

Output will include two IDs:
- Production: `id = "xyz789..."`
- Preview: `preview_id = "def456..."`

**Save both IDs!**

---

### Step 3: Create AI Gateway (for Caching & Observability)

AI Gateway provides intelligent caching, real-time observability, and rate limiting for Workers AI requests.

**Create via Cloudflare Dashboard:**

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → **AI** → **AI Gateway**
2. Click **"Create Gateway"**
3. **Name:** `threat-intel-dashboard`
4. Click **"Create"**
5. **Copy the Gateway ID** (you'll need this in Step 4)

**Benefits:**
- ✅ **30-40% neuron savings** through intelligent caching of duplicate AI requests
- ✅ **Real-time analytics** dashboard with request logs, latency metrics, and error tracking
- ✅ **Rate limiting** to protect against quota exhaustion
- ✅ **Cache hit rates** showing how often identical requests are served from cache
- ✅ **Model usage breakdown** across Llama 1B, Qwen 30B, and BGE-M3

**Note:** AI Gateway is required for this project and must be created before deployment.

---

### Step 4: Update Configuration

Edit `wrangler.jsonc` and replace these values:

```jsonc
{
  "d1_databases": [
    {
      "database_id": "YOUR_D1_DATABASE_ID"  // ← Paste your D1 ID here
    }
  ],
  "vectorize": [
    {
      "index_name": "threat-embeddings",
      "binding": "VECTORIZE_INDEX"
    }
  ],
  "kv_namespaces": [
    {
      "id": "YOUR_KV_NAMESPACE_ID",          // ← Paste production KV ID
      "preview_id": "YOUR_KV_PREVIEW_ID"     // ← Paste preview KV ID
    }
  ],
  "vars": {
    "ENVIRONMENT": "production",
    "AI_GATEWAY_ID": "threat-intel-dashboard"  // ← AI Gateway ID from Step 3
  }
}
```

**Commit your changes:**
```bash
git add wrangler.jsonc
git commit -m "Configure production resource IDs"
git push origin main
```

---

### Step 5: Initialize Database

```bash
npx wrangler d1 execute threat-intel-db --remote --file=./schema.sql
```

This creates:
- 8 tables (threats, summaries, iocs, categories, etc.)
- Default categories (ransomware, apt, vulnerability, etc.)
- 7 security feed sources (CISA, Krebs, BleepingComputer, etc.)

You should see: `✅ Executed 24 queries` (or similar)

---

### Step 6: Set Up GitHub Actions (Automatic Deployment)

GitHub Actions will automatically deploy your Worker when you push to `main`.

**Required GitHub Secrets:**

1. **CLOUDFLARE_API_TOKEN**
   - Go to https://dash.cloudflare.com/profile/api-tokens
   - Create token with "Edit Cloudflare Workers" template
   - Copy the token

2. **CLOUDFLARE_ACCOUNT_ID**
   - Go to https://dash.cloudflare.com/
   - Copy your Account ID from the sidebar

**Add to GitHub:**
1. Go to your repo → Settings → Secrets and variables → Actions
2. Add `CLOUDFLARE_API_TOKEN` secret
3. Add `CLOUDFLARE_ACCOUNT_ID` secret

See [GitHub CI/CD Setup Guide](./GITHUB_CICD_SETUP.md) for detailed instructions.

---

### Step 7: Deploy to Cloudflare Workers

**Option A: Deploy via GitHub Actions (Recommended)**

```bash
git push origin main
```

GitHub Actions will automatically:
1. Build the frontend
2. Compile Pages Functions to `_worker.js`
3. Deploy to Cloudflare Workers

**Option B: Deploy Manually**

```bash
npm run deploy
```

This builds and deploys directly from your local machine.

---

### Step 8: Enable Analytics Engine (First Deployment Only)

**This is expected!** On your first deployment, you may see:

```
Error: You need to enable Analytics Engine. Head to the Cloudflare Dashboard to enable
[code: 10089]
```

**This is normal** - Analytics Engine is an account-level feature that requires one-time enablement:

1. Go to Dashboard → Workers & Pages → Analytics Engine
2. Click **"Enable Analytics Engine"** (one-time setup for your entire account)
3. Re-deploy (push to GitHub or run `npm run deploy`)
4. **Note:** The dataset (`threat_metrics`) auto-creates on first use - you don't manually create it

**Why this happens:**
- Analytics Engine is an **account capability** (like enabling Workers AI), not a per-project resource
- No CLI command exists to enable it - must be done via dashboard
- Once enabled, **all your projects** can use Analytics Engine (never need to enable again)
- Datasets auto-create when your Worker first calls `writeDataPoint()`

**Comparison:**
- **D1/Vectorize/KV**: Per-project resources → Created via CLI commands
- **Analytics Engine**: Account feature → Enabled once via dashboard, datasets auto-create

---

### Step 9: Wait for Automatic Data Ingestion

**The Worker will automatically fetch and process threat data!**

- **Cron schedule:** Every 6 hours (00:00, 06:00, 12:00, 18:00 UTC)
- **First run:** Happens within 6 hours of deployment
- **No manual intervention needed!**

**Monitor the cron execution:**

```bash
npx wrangler tail
```

You'll see logs like:
```
[Cron] Scheduled event triggered: 0 */6 * * *
Starting scheduled feed ingestion...
Processed Krebs on Security: 15 articles (3 new)
Ingestion complete. New threats: 42
```

**Note:** Debug endpoints (`/api/debug/*`) are **disabled in production** for security. The cron trigger handles all data ingestion automatically.

---

## ✅ You're Done!

Your dashboard is now:
- ✅ Live on Cloudflare Workers
- ✅ Auto-updating every 6 hours via native cron triggers
- ✅ Processing threats with AI
- ✅ 100% serverless and free tier compatible

Visit: `https://threat-intel-dashboard.YOUR-SUBDOMAIN.workers.dev`

Or set up a custom domain in the Cloudflare dashboard.

---

## 📊 Monitoring AI Gateway

After deployment, monitor your AI Gateway for caching effectiveness and usage patterns:

**Access AI Gateway Dashboard:**
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → **AI** → **AI Gateway**
2. Select **`threat-intel-dashboard`**
3. View the **Analytics** tab

**Key Metrics to Monitor:**
- **Request count**: Total AI requests processed
- **Cache hit rate**: Percentage of requests served from cache (target: 30-40%)
- **Model usage breakdown**: Distribution across Llama 1B, Qwen 30B, BGE-M3
- **Latency metrics**: Response times for AI requests
- **Error rates**: Failed AI requests

**Expected Behavior:**
- **First run**: 0% cache hit rate (all requests are new)
- **Subsequent runs**: 30-40% cache hit rate as duplicate content is analyzed
- **Model distribution**: ~60% Llama 1B, ~35% Qwen 30B, ~5% embeddings

**Cost Savings:**
AI Gateway caching reduces neuron consumption by 30-40%, saving ~1,000-1,500 neurons per day.

---

## 🔍 Debugging with Logs

If you encounter issues, you can monitor production logs in real-time:

**CLI Method (Recommended):**

```bash
npx wrangler tail
```

**Web UI Method:**

1. Go to [Workers & Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages)
2. Select your Worker (`threat-intel-dashboard`)
3. Click the **"Logs"** tab
4. Click **"Begin log stream"**

Both methods provide equivalent output. Trigger an action and watch for errors in real-time.

---

## 🛠️ Local Development

**For local development:**

```bash
npm run dev
```

This starts Wrangler dev server at `http://localhost:8787` with local bindings.

---

## 📊 View Cron Trigger History

**Cloudflare Dashboard:**
1. Go to Workers & Pages → threat-intel-dashboard
2. Click **"Triggers"** tab
3. View cron execution history

**CLI:**
```bash
npx wrangler tail
# Wait for next cron execution (00:00, 06:00, 12:00, or 18:00 UTC)
```

---

## 🎛️ Changing Cron Schedule

To change the ingestion frequency, edit `wrangler.jsonc`:

```jsonc
"triggers": {
  "crons": ["0 */6 * * *"]  // Every 6 hours (current)
  // "crons": ["0 */3 * * *"]  // Every 3 hours
  // "crons": ["0 * * * *"]    // Every hour (uses more quota)
}
```

Re-deploy after changes:
```bash
git add wrangler.jsonc
git commit -m "Update cron schedule"
git push origin main
```

**Note:** The free tier includes 5 cron triggers. See [Cloudflare Workers cron syntax](https://developers.cloudflare.com/workers/configuration/cron-triggers/) for more options.

---

## 🔒 Security Note

**Production security posture:**
- ✅ Management endpoints disabled (HTTP 403)
- ✅ Cron triggers run internally (not exposed to internet)
- ✅ Public API endpoints are read-only
- ✅ Rate limiting protects against abuse
- ✅ Security headers on all responses

See [Security Documentation](./SECURITY.md) for details.

---

## 📚 Additional Resources

- [GitHub CI/CD Setup](./GITHUB_CICD_SETUP.md) - Configure automatic deployment
- [Project Structure](./PROJECT_STRUCTURE.md) - Understand the codebase
- [Security Documentation](./SECURITY.md) - Security features and implementation
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Workers Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)

---

**Need help?** Check the [Cloudflare Discord](https://discord.gg/cloudflaredev) or [Community Forum](https://community.cloudflare.com/)
