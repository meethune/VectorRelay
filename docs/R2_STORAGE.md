# R2 Storage Implementation Guide

## ⚠️ IMPORTANT: Billing Requirements

### R2 is NOT completely free - Read this carefully!

While R2 has a generous free tier, **it requires an active billing account** and **you WILL be charged for overages**.

#### Free Tier Limits (as of 2025-12-08)

| Resource | Free Tier | Overage Cost |
|----------|-----------|--------------|
| **Storage** | 10 GB/month | $0.015/GB/month |
| **Class A Operations** (write, list) | 1 million/month | $4.50 per million |
| **Class B Operations** (read) | 10 million/month | $0.36 per million |
| **Egress** | 10 GB/month | $0.00/GB (free forever) |

#### Setup Requirements

1. **Enable R2 in Cloudflare Dashboard**
   - Go to R2 → Overview
   - Click "Purchase R2" (confusing name, but free tier available)
   - Add payment method (required even for free tier)

2. **Create Bucket**
   ```bash
   npx wrangler r2 bucket create threat-intel-archive
   ```

3. **Monitor Usage**
   - Dashboard → R2 → Usage Analytics
   - Check monthly usage regularly
   - Set up billing alerts in Cloudflare

---

## 🛡️ Quota Protection Strategy

### Our Conservative Approach

To ensure we NEVER exceed free tier limits:

#### 1. Storage Quota (10 GB)
**Maximum Allowed**: 8 GB (80% of free tier)

- Each threat archive: ~50 KB average
- Max threats stored: ~163,840 threats
- Safety margin: 2 GB (20%)
- **Hard stop at 8 GB** - no new archives

#### 2. Class A Operations (1M/month)
**Maximum Allowed**: 800,000 operations/month (80%)

- Archive operations: ~1,000/month (old threats)
- List operations: ~100/month (cleanup)
- Total: ~1,100/month
- **Well within limits** ✅

#### 3. Class B Operations (10M/month)
**Maximum Allowed**: 8M operations/month (80%)

- User retrieval: ~5,000/month estimated
- Cron checks: ~30/month
- Total: ~5,030/month
- **Well within limits** ✅

### Safety Mechanisms

#### A. Pre-Flight Quota Check
Before ANY R2 operation, check current usage:

```typescript
async function checkQuotaBeforeWrite(env: Env): Promise<boolean> {
  const usage = await getR2Usage(env);

  // Hard limits (80% of free tier)
  const STORAGE_LIMIT_GB = 8;
  const OPERATIONS_LIMIT = 800_000;

  if (usage.storageGB >= STORAGE_LIMIT_GB) {
    console.error('[R2 QUOTA] Storage limit reached:', usage.storageGB, 'GB');
    return false;
  }

  if (usage.classAOps >= OPERATIONS_LIMIT) {
    console.error('[R2 QUOTA] Class A operations limit reached:', usage.classAOps);
    return false;
  }

  return true;
}
```

#### B. KV-Based Usage Tracking
Store monthly counters in KV to avoid excessive R2 API calls:

```typescript
// KV keys
const R2_USAGE_KEY = 'r2:usage:monthly';
const R2_STORAGE_KEY = 'r2:storage:current';

interface R2Usage {
  month: string; // '2025-12'
  storageGB: number;
  classAOps: number;
  classBOps: number;
  lastUpdated: string;
}
```

#### C. Archive Size Limits
- Max archive size per threat: 200 KB (hard limit)
- Skip archiving if threat content > 200 KB
- Log oversized threats for review

#### D. Monthly Reset
- Track usage per calendar month
- Reset counters on 1st of each month
- Alert if approaching limits (>70%)

---

## 📊 Usage Monitoring

### Dashboard Integration

Add R2 usage metrics to dashboard:

```typescript
// /api/stats endpoint
{
  "r2Usage": {
    "storageGB": 2.3,
    "storageLimitGB": 8,
    "storagePercent": 28.75,
    "classAOps": 45000,
    "classAOpsLimit": 800000,
    "classAOpsPercent": 5.6,
    "status": "healthy" // healthy | warning | critical
  }
}
```

### Alert Thresholds

| Threshold | Action |
|-----------|--------|
| 70% | Log warning |
| 80% | Stop new archives, log error |
| 90% | Disable R2 writes, send alert |
| 100% | Never reached (hard stop at 80%) |

---

## 🔄 Archive Strategy

### What to Archive

**Archive to R2** (after 90 days):
- Full article HTML content
- Raw feed data
- AI analysis results
- IOC extraction data

**Keep in D1** (always):
- Threat metadata (ID, title, date, severity)
- `archived` boolean flag
- `r2_key` pointer to R2 object
- Summary text (truncated to 500 chars)

### Archive Format

```typescript
// R2 object structure
{
  "id": "threat123",
  "title": "Critical Vulnerability in XYZ",
  "content": "<full HTML content>",
  "raw_feed_data": { /* original RSS/Atom data */ },
  "ai_analysis": { /* full AI response */ },
  "iocs": [ /* extracted indicators */ ],
  "archived_at": "2025-12-08T18:00:00Z",
  "metadata": {
    "feed_source": "CISA",
    "original_url": "https://...",
    "size_bytes": 45320
  }
}
```

### Key Naming Convention

```
threats/{year}/{month}/{threat_id}.json

Examples:
threats/2025/01/abc123def.json
threats/2025/02/xyz789ghi.json
```

**Benefits**:
- Organized by date (easy to find/delete old data)
- Predictable structure
- Supports future partitioning strategies

---

## 🔧 Enabling/Disabling R2 Archival

### ⚙️ R2 Archival is ENABLED BY DEFAULT

The application ships with `R2_ARCHIVE_ENABLED=true` in `wrangler.jsonc`. This means archival will start working automatically after you:
1. Enable R2 in your Cloudflare account
2. Create the R2 bucket
3. Deploy the worker

### How to Disable R2 Archival

**Option 1: Via Cloudflare Dashboard (Recommended - No Redeploy)**
```
1. Go to Cloudflare Dashboard
2. Workers & Pages → threat-intel-dashboard → Settings → Variables
3. Click "Add variable"
4. Name: R2_ARCHIVE_ENABLED
5. Value: false
6. Click "Save"
```

**Option 2: Edit wrangler.jsonc (Requires Redeploy)**
```jsonc
"vars": {
  "ENVIRONMENT": "production",
  "AI_GATEWAY_ID": "threat-intel-dashboard",
  "R2_ARCHIVE_ENABLED": "false"  // ← Change to false
}
```
Then redeploy: `npm run deploy`

### When to Disable Archival

Consider disabling R2 archival if:
- ✅ Approaching 80% quota limit (safety threshold)
- ✅ Testing without wanting to use R2 operations
- ✅ Temporarily stopping archival to diagnose issues
- ✅ Want to keep all data in D1 (not recommended long-term)

### Re-enabling Archival

Simply set `R2_ARCHIVE_ENABLED=true` in the dashboard or wrangler.jsonc.

---

## 🚨 Emergency Procedures

### If Approaching Quota Limits

1. **Stop New Archives**
   ```bash
   # Via Dashboard (immediate):
   # Set R2_ARCHIVE_ENABLED = false

   # Via CLI (requires redeploy):
   # Edit wrangler.jsonc: "R2_ARCHIVE_ENABLED": "false"
   npm run deploy
   ```

2. **Delete Old Archives**
   ```typescript
   // Delete threats older than 2 years
   const oldThreats = await env.THREAT_ARCHIVE.list({
     prefix: 'threats/2023/'
   });

   for (const object of oldThreats.objects) {
     await env.THREAT_ARCHIVE.delete(object.key);
   }
   ```

3. **Optimize Storage**
   - Compress JSON with gzip
   - Remove redundant data
   - Archive only critical severity threats

### If Billed Accidentally

1. Check Cloudflare Dashboard → Billing
2. Review R2 usage analytics
3. Identify cause of overage
4. Disable R2 archiving immediately
5. Contact Cloudflare support (often waive first overage)

---

## 💰 Cost Estimation

### Worst-Case Scenario (10x current usage)

Assuming 10x more traffic than expected:

| Resource | Usage | Cost |
|----------|-------|------|
| Storage (8 GB) | Within free tier | $0.00 |
| Class A Ops (10,000/mo) | Within free tier | $0.00 |
| Class B Ops (50,000/mo) | Within free tier | $0.00 |

**Total worst-case cost**: **$0.00/month** ✅

### Overage Example (IF limits exceeded)

If we somehow exceeded all limits by 20%:

| Resource | Overage | Cost |
|----------|---------|------|
| Storage (12 GB, +2 GB over) | 2 GB × $0.015 | $0.03 |
| Class A (1.2M, +200k over) | 0.2M × $4.50 | $0.90 |
| Class B (12M, +2M over) | 2M × $0.36 | $0.72 |

**Total overage cost**: **$1.65/month**

**Our safeguards prevent this** - we hard stop at 80% of free tier.

---

## ✅ Pre-Implementation Checklist

Before enabling R2 storage:

- [ ] Confirm billing account is active in Cloudflare
- [ ] Set up billing alerts (Dashboard → Billing → Alerts)
- [ ] Enable R2 in Cloudflare Dashboard
- [ ] Create R2 bucket: `threat-intel-archive`
- [ ] Run database migration: `migrations/0002_add_r2_archival.sql`
- [ ] Deploy with default settings (R2_ARCHIVE_ENABLED=true is already set)
- [ ] Verify quota tracking endpoint: `/api/archive`
- [ ] Document emergency procedures for team
- [ ] Monitor first archival run (1st of next month)

**Note:** Quota tracking, pre-flight checks, and monthly monitoring are already implemented. R2 archival is **enabled by default** via `R2_ARCHIVE_ENABLED=true` in `wrangler.jsonc`.

---

## 📚 Additional Resources

- [R2 Pricing](https://developers.cloudflare.com/r2/pricing/)
- [R2 Documentation](https://developers.cloudflare.com/r2/)
- [Workers R2 Bindings](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/)
- [Billing FAQs](https://developers.cloudflare.com/r2/platform/pricing/)

---

**Last Updated**: 2025-12-08
**Status**: Implementation pending - requires billing account setup
**Safety Level**: Conservative (80% of free tier limits)
