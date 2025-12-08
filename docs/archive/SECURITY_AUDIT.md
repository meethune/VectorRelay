# 🔒 Security Audit Report - VectorRelay

**Date:** 2025-12-05
**Last Updated:** 2025-12-05
**Auditor:** Automated Security Review
**Severity Levels:** CRITICAL | HIGH | MEDIUM | LOW | INFO

---

## ✅ Phase 1 Fixes Implemented (2025-12-05)

**Status:** The following **immediate security hardening** measures have been implemented:

| Fix | Status | Files Modified |
|-----|--------|----------------|
| Hard cap on `limit` parameters | ✅ Complete | `process-ai.ts`, `search.ts`, `threats.ts` |
| Query length validation | ✅ Complete | `search.ts` |
| Debug/test endpoints disabled in production | ✅ Complete | `debug-ingestion.ts`, `test-ai.ts`, `test-bindings.ts` |

**IMPORTANT:** These fixes require setting `ENVIRONMENT=production` via Cloudflare Dashboard → Settings → Variables and Secrets. Without this variable set, debug/test endpoints will remain enabled.

**Next Phase:** Per-IP rate limiting (Phase 2) - Estimated 2-3 hours

---

## Executive Summary

The VectorRelay application previously had **CRITICAL security vulnerabilities** that exposed it to resource exhaustion attacks on Cloudflare's free tier. **Phase 1 fixes have been implemented** to address the most critical issues. Remaining concerns are:

1. ~~**Unbounded input parameters**~~ ✅ **FIXED** - Hard caps implemented
2. ~~**Public debug/test endpoints**~~ ✅ **FIXED** - Disabled in production (requires `ENVIRONMENT=production`)
3. **No rate limiting** on expensive AI processing endpoints (Phase 2)
4. **No authentication** on management endpoints (Phase 2/3)

**Estimated Risk (After Phase 1):**
- ✅ Input validation attacks: **MITIGATED** (hard caps in place)
- ✅ Information disclosure: **MITIGATED** (debug endpoints hidden)
- ⚠️ Resource exhaustion: **PARTIALLY MITIGATED** (limited scope, but still possible through repeated calls)
- ⚠️ Unauthenticated access: **UNADDRESSED** (Phase 2/3 required)

---

## CRITICAL Vulnerabilities

### 🚨 CRITICAL-1: Unauthenticated Resource-Intensive Endpoints

**Affected Files:**
- `functions/api/trigger-ingestion.ts`
- `functions/api/process-ai.ts`
- `functions/api/search.ts` (semantic mode)

**Issue:**
These endpoints can be called by anyone, unlimited times, triggering expensive operations:

```typescript
// trigger-ingestion.ts - Line 5
export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  // NO AUTHENTICATION CHECK
  // NO RATE LIMITING
  await onSchedule({ env } as any); // Fetches all 7 feeds + AI processing
```

```typescript
// process-ai.ts - Line 7
const limit = parseInt(url.searchParams.get('limit') || '5');
// NO MAXIMUM CAP - attacker can set limit=999999
// NO RATE LIMITING - can be called repeatedly
```

**Attack Scenario:**
```bash
# Exhaust Workers AI quota in seconds
for i in {1..100}; do
  curl "https://threat-intel-dashboard.pages.dev/api/process-ai?limit=100" &
done

# Exhaust D1/feed fetching
while true; do
  curl "https://threat-intel-dashboard.pages.dev/api/trigger-ingestion"
done
```

**Impact:**
- Workers AI quota exhausted (10k neurons/day free tier)
- D1 write quota exhausted (100k/day free tier)
- Functions invocation quota exhausted (100k/day free tier)
- Account suspension risk

**Recommended Fix:**
1. Add authentication (API key or Cloudflare Access)
2. Implement per-IP rate limiting using KV
3. Add hard caps on `limit` parameter
4. Add global rate limiting (max X calls per hour)

---

### ✅ CRITICAL-2: Unbounded Input Parameters [FIXED]

**Status:** ✅ **FIXED** (Phase 1)

**Affected Files:**
- `functions/api/process-ai.ts` (line 7) - ✅ Fixed
- `functions/api/search.ts` (line 9) - ✅ Fixed
- `functions/api/threats.ts` (line 7) - ✅ Fixed

**Original Issue:**
```typescript
// process-ai.ts - BEFORE
const limit = parseInt(url.searchParams.get('limit') || '5');
// NO VALIDATION - could be Number.MAX_SAFE_INTEGER
```

**Fix Implemented:**
```typescript
// process-ai.ts - AFTER
const requestedLimit = parseInt(url.searchParams.get('limit') || '5');
const limit = Math.min(Math.max(requestedLimit, 1), 10); // Min 1, Max 10

// search.ts - Max 50
const limit = Math.min(Math.max(requestedLimit, 1), 50);

// threats.ts - Max 50
const limit = Math.min(Math.max(requestedLimit, 1), 50);
```

**Impact:**
- ✅ Prevents resource exhaustion from unbounded loops
- ✅ Caps AI processing at 10 items per request
- ✅ Caps search/threat queries at 50 items per request

---

## HIGH Vulnerabilities

### ✅ HIGH-1: Public Debug/Test Endpoints in Production [FIXED]

**Status:** ✅ **FIXED** (Phase 1)

**Affected Files:**
- `functions/api/debug-ingestion.ts` - ✅ Fixed
- `functions/api/test-ai.ts` - ✅ Fixed
- `functions/api/test-bindings.ts` - ✅ Fixed

**Original Issue:**
These endpoints were publicly accessible and revealed:
- Internal architecture (database tables, bindings)
- Feed source URLs and configurations
- AI model prompts and temperature settings
- Sample threat data
- Error messages with stack traces

**Fix Implemented:**
```typescript
// All debug/test endpoints now have:
export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  // Security: Disable in production
  if (env.ENVIRONMENT === 'production') {
    return Response.json({
      error: 'Debug endpoints are disabled in production'
    }, { status: 404 });
  }
  // ... rest of endpoint logic
```

**Deployment Requirement:**
⚠️ Must set `ENVIRONMENT=production` via Cloudflare Dashboard → Settings → Variables and Secrets (Production environment only).

**Impact:**
- ✅ Debug endpoints return 404 in production
- ✅ Prevents architecture fingerprinting
- ✅ Still available for local dev and preview deployments

---

### ⚠️ HIGH-2: No Per-IP Rate Limiting

**Affected Files:** All API endpoints

**Issue:**
No IP-based rate limiting exists. The scheduled function has feed-level rate limiting (good), but public endpoints don't:

```typescript
// scheduled.ts lines 26-34 - GOOD (but only for scheduled function)
const cacheKey = `feed:${feed.id}:last_fetch`;
const lastFetch = await env.CACHE.get(cacheKey);
if (lastFetch && now - parseInt(lastFetch) < (feed.fetch_interval || 21600)) {
  continue; // Skip if fetched recently
}

// But /api/trigger-ingestion bypasses this entirely when called manually
```

**Attack Scenario:**
```bash
# Single attacker makes 10,000 requests in a minute
curl "https://threat-intel-dashboard.pages.dev/api/search?q=test&mode=semantic" # x10000
```

**Impact:**
- Vectorize query quota exhausted
- Workers AI quota exhausted (semantic search uses embeddings)
- D1 read quota exhausted

**Recommended Fix:**
Implement per-IP rate limiting middleware using KV:

```typescript
async function checkRateLimit(env: Env, ip: string, endpoint: string): Promise<boolean> {
  const key = `ratelimit:${ip}:${endpoint}`;
  const count = await env.CACHE.get(key);

  if (count && parseInt(count) > 100) { // 100 requests per hour
    return false; // Rate limited
  }

  await env.CACHE.put(key, (parseInt(count || '0') + 1).toString(), { expirationTtl: 3600 });
  return true;
}
```

---

## MEDIUM Vulnerabilities

### ⚙️ MEDIUM-1: SQL Injection Risk in Dynamic Placeholders

**Affected File:** `functions/api/search.ts` (lines 32-46)

**Issue:**
```typescript
// Line 20: Get IDs from Vectorize (external input)
const results = await semanticSearch(env, query, limit);
threatIds = results.map((r) => r.id);

// Line 34: Build dynamic SQL
const placeholders = threatIds.map(() => '?').join(',');
sqlQuery = `
  SELECT * FROM threats t
  WHERE t.id IN (${placeholders})  // Dynamic SQL
`;
params = threatIds; // User-controlled IDs
```

**Issue Explanation:**
While D1 prepared statements protect against traditional SQL injection, the `threatIds` come from Vectorize search results, which could theoretically be poisoned if an attacker can insert malicious IDs into the vector database.

**Current Risk:** Low (requires prior compromise of Vectorize)

**Recommended Fix:**
Validate IDs before building SQL:

```typescript
// Validate all IDs are valid UUIDs/format
const validIds = threatIds.filter(id => /^[a-f0-9-]+$/i.test(id));
if (validIds.length !== threatIds.length) {
  console.warn('Invalid threat IDs detected:', threatIds);
}
```

---

### ⚙️ MEDIUM-2: Unlimited Search History Writes

**Affected File:** `functions/api/search.ts` (line 83-85)

**Issue:**
```typescript
// Log every search to database - no rate limiting
await env.DB.prepare('INSERT INTO search_history (query, result_count, searched_at) VALUES (?, ?, ?)')
  .bind(query, threats.length, now)
  .run();
```

**Attack Scenario:**
```bash
# Exhaust D1 write quota
for i in {1..100000}; do
  curl "https://threat-intel-dashboard.pages.dev/api/search?q=test$i"
done
# Creates 100k database writes
```

**Impact:**
- D1 write quota exhaustion (100k/day free tier)
- Database bloat
- Performance degradation

**Recommended Fix:**
1. Add rate limiting before writing to search_history
2. Use KV to deduplicate recent searches
3. Implement sampling (log 1 in 10 searches)

---

### ✅ MEDIUM-3: No Input Sanitization on Search Queries [FIXED]

**Status:** ✅ **FIXED** (Phase 1)

**Affected File:** `functions/api/search.ts` - ✅ Fixed

**Original Issue:**
```typescript
// BEFORE
const searchTerm = `%${query}%`; // No length check, no sanitization
// query could be 100MB string, causing LIKE query to timeout
```

**Fix Implemented:**
```typescript
// AFTER
const query = url.searchParams.get('q');

if (!query) {
  return Response.json({ error: 'Query parameter "q" is required' }, { status: 400 });
}

if (query.length > 500) {
  return Response.json({ error: 'Query must be 500 characters or less' }, { status: 400 });
}

if (query.length < 1) {
  return Response.json({ error: 'Query must be at least 1 character' }, { status: 400 });
}
```

**Impact:**
- ✅ Prevents D1 query timeout from extremely long strings
- ✅ Returns 400 error for invalid queries
- ✅ Enforces 1-500 character limit

---

## LOW Vulnerabilities

### 📝 LOW-1: Missing Security Headers

**Affected Files:** All API responses

**Issue:**
No security headers configured:
- No `Content-Security-Policy`
- No `X-Frame-Options`
- No `X-Content-Type-Options`
- No `Strict-Transport-Security`

**Current Risk:** Low (backend API, not serving HTML)

**Recommended Fix:**
Add security headers middleware for frontend routes.

---

### 📝 LOW-2: Error Messages Expose Internal Details

**Affected Files:** Multiple (search.ts, threats.ts, etc.)

**Issue:**
```typescript
return Response.json({
  error: error instanceof Error ? error.message : String(error),
  stack: error instanceof Error ? error.stack : undefined // Exposes stack trace
}, { status: 500 });
```

**Recommended Fix:**
```typescript
// Production: Generic error
if (env.ENVIRONMENT === 'production') {
  return Response.json({ error: 'Internal server error' }, { status: 500 });
} else {
  // Development: Detailed error
  return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
}
```

---

## INFO

### ℹ️ INFO-1: No CORS Configuration

**Status:** Currently relies on Cloudflare Pages default CORS policy (allows all origins)

**Recommendation:** Explicitly configure allowed origins if needed for production use.

---

### ℹ️ INFO-2: Analytics Engine Writes Not Validated

**Affected File:** `functions/scheduled.ts` (line 141-145)

**Issue:**
```typescript
env.ANALYTICS.writeDataPoint({
  blobs: ['feed_ingestion'],
  doubles: [totalNew, totalProcessed], // No validation on values
  indexes: [new Date().toISOString().split('T')[0]],
});
```

**Current Risk:** Very Low (only called from scheduled function)

**Recommendation:** Add validation if exposed via public endpoints.

---

## Summary of Recommendations

### Immediate Actions (Fix Now)

| Priority | Action | Affected Endpoints | Effort |
|----------|--------|-------------------|--------|
| 🚨 CRITICAL | Add authentication to management endpoints | `/api/trigger-ingestion`, `/api/process-ai`, `/api/debug-*`, `/api/test-*` | Medium |
| 🚨 CRITICAL | Add hard cap on `limit` parameter | `/api/process-ai` | Low |
| 🚨 CRITICAL | Implement per-IP rate limiting | All endpoints | Medium |
| ⚠️ HIGH | Remove or protect debug/test endpoints | `/api/debug-ingestion`, `/api/test-ai`, `/api/test-bindings` | Low |
| ⚙️ MEDIUM | Add query length validation | `/api/search` | Low |
| ⚙️ MEDIUM | Rate limit search history writes | `/api/search` | Low |

### Recommended Implementation Order

1. **Phase 1 (Immediate - 1 hour):**
   - Add hard caps on `limit` parameters
   - Add query length validation
   - Remove debug/test endpoints from production (environment check)

2. **Phase 2 (Short-term - 2-3 hours):**
   - Implement per-IP rate limiting middleware using KV
   - Apply rate limiting to all public endpoints

3. **Phase 3 (Medium-term - 4-6 hours):**
   - Add API key authentication for management endpoints
   - Implement Cloudflare Access for admin endpoints
   - Add security headers middleware

---

## Attack Surface Summary

**Current Attack Surface:**
- ✅ SQL Injection: Protected (D1 prepared statements)
- ❌ Authentication: None (all endpoints public)
- ❌ Rate Limiting: None (per-IP)
- ⚠️ Input Validation: Partial (some caps, but incomplete)
- ❌ Information Disclosure: High (debug endpoints public)
- ⚠️ Resource Exhaustion: High risk

**Target Attack Surface (After Fixes):**
- ✅ SQL Injection: Protected
- ✅ Authentication: API keys for management, public for read-only
- ✅ Rate Limiting: Per-IP, per-endpoint
- ✅ Input Validation: Comprehensive
- ✅ Information Disclosure: Minimal
- ✅ Resource Exhaustion: Protected

---

## Cost of Inaction

If current vulnerabilities are not addressed, a single attacker could:

1. **Exhaust Workers AI quota** in ~10 minutes by calling `/api/process-ai?limit=100` repeatedly
   - Free tier: 10,000 neurons/day
   - Llama 3.3 70B: ~1000 neurons per request
   - 10 requests = quota exhausted

2. **Exhaust D1 write quota** in ~30 minutes
   - Free tier: 100,000 writes/day
   - 100k search requests with history logging = quota exhausted

3. **Exhaust Functions invocation quota**
   - Free tier: 100,000 requests/day
   - Simple automated script hitting any endpoint

**Result:** Service downtime, potential Cloudflare account warnings/suspension, user trust loss.

---

## Testing Recommendations

After implementing fixes, perform these tests:

```bash
# 1. Test rate limiting
for i in {1..150}; do curl https://YOUR-SITE/api/search?q=test; done
# Should see 429 Too Many Requests after ~100

# 2. Test authentication
curl https://YOUR-SITE/api/trigger-ingestion
# Should see 401 Unauthorized

# 3. Test input validation
curl "https://YOUR-SITE/api/process-ai?limit=999999"
# Should be capped at max 10

# 4. Test debug endpoint removal
curl https://YOUR-SITE/api/debug-ingestion
# Should see 404 Not Found (or 401 if protected)
```

---

**End of Security Audit**
