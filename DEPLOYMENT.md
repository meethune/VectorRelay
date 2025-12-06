# 🚀 Production Deployment Guide

This guide walks through deploying the Threat Intelligence Dashboard to Cloudflare Pages with all required services.

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

### Step 3: Update Configuration

Edit `wrangler.jsonc` and replace these values:

```jsonc
{
  "d1_databases": [
    {
      "database_id": "YOUR_D1_DATABASE_ID"  // ← Paste your D1 ID here
    }
  ],
  "kv_namespaces": [
    {
      "id": "YOUR_KV_NAMESPACE_ID",          // ← Paste production KV ID
      "preview_id": "YOUR_KV_PREVIEW_ID"     // ← Paste preview KV ID
    }
  ]
}
```

**Commit your changes:**
```bash
git add wrangler.jsonc
git commit -m "Configure production resource IDs"
git push origin main
```

---

### Step 4: Initialize Database

```bash
npx wrangler d1 execute threat-intel-db --remote --file=./schema.sql
```

This creates:
- 8 tables (threats, summaries, iocs, categories, etc.)
- Default categories (ransomware, apt, vulnerability, etc.)
- 7 security feed sources (CISA, Krebs, BleepingComputer, etc.)

You should see: `✅ Executed 24 queries` (or similar)

---

### Step 5: Deploy to Cloudflare Pages

**Push to GitHub and connect:**

1. Push your code:
   ```bash
   git push origin main
   ```

2. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
3. Click **Workers & Pages** → **"Create Application"** → **"Pages"** → **"Connect to Git"**
4. Select your repository
5. Configure build settings:
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Root directory:** (leave empty)
   - **Deploy command:** (leave empty - IMPORTANT!)
6. Click **"Save and Deploy"**

Cloudflare automatically detects `wrangler.jsonc` and configures all bindings.

---

### Step 6: Set Production Environment Variable

**Important:** Configure the production environment variable to disable debug/test endpoints:

1. In the same Cloudflare Dashboard, with your Pages project selected
2. Go to **Settings** tab
3. Scroll down to **Variables and Secrets** section
4. Click **Add variable** (or **Edit variables**)
5. Add the following variable:
   - **Variable name:** `ENVIRONMENT`
   - **Value:** `production`
   - **Environment:** Select **Production** only (leave Preview unchecked)
6. Click **Save**

**Why this is needed:**
- Debug endpoints (`/api/debug-ingestion`, `/api/test-ai`, `/api/test-bindings`) expose internal architecture
- These endpoints are automatically disabled when `ENVIRONMENT=production`
- Local development and preview deployments can still use these endpoints for testing
- This is a **security measure** to prevent information disclosure

**Note:** Without this variable, debug/test endpoints will remain enabled in production until you set it.

---

### Step 7: Enable Analytics Engine (First Deployment Only)

**This is expected!** On your first deployment, you'll see:

```
Error: You need to enable Analytics Engine. Head to the Cloudflare Dashboard to enable
[code: 10089]
```

**This is normal** - Analytics Engine is an account-level feature that requires one-time enablement:

1. Click the error link in deployment logs, or go to: Dashboard → Workers & Pages → Analytics Engine
2. Click **"Enable Analytics Engine"** (one-time setup for your entire account)
3. Re-deploy (push to GitHub or click "Retry deployment")
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

### Step 8: Load Initial Data

```bash
# Trigger feed ingestion
curl https://YOUR-SITE.pages.dev/api/trigger-ingestion

# Wait 60 seconds, then process AI
curl https://YOUR-SITE.pages.dev/api/process-ai?limit=30

# Check stats
curl https://YOUR-SITE.pages.dev/api/stats
```

---

## ✅ You're Done!

Your dashboard is now:
- ✅ Live on Cloudflare Pages
- ✅ Auto-updating every 6 hours via GitHub Actions
- ✅ Processing threats with AI

Visit: `https://YOUR-PROJECT-NAME.pages.dev`

---

## 🔍 Debugging with Logs

If you encounter issues, you can monitor production logs in real-time:

**Web UI Method:**

1. Go to [Workers & Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages)
2. Select your Pages project (`threat-intel-dashboard`)
3. Click **"View details"** on the production deployment (main branch)
4. Select the **"Functions"** tab
5. Scroll down to **"Real-time Logs"**
6. Click **"Begin log stream"**

**CLI Method:**

```bash
npx wrangler pages deployment tail --project-name=threat-intel-dashboard
```

Both methods provide equivalent output. Trigger an action (like `/api/trigger-ingestion`) and watch for errors in real-time.

**Reference:** [Cloudflare Pages Debugging & Logging](https://developers.cloudflare.com/pages/functions/debugging-and-logging/#view-logs-in-the-cloudflare-dashboard)
