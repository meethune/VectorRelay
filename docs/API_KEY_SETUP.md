# 🔐 Local Development API Key Setup

**⚠️ Note:** API keys are **no longer required for production deployment**. Management endpoints are disabled in production for security, and cron triggers handle all automation internally.

This guide is **only for local development** if you want to test management endpoints manually.

---

## 📋 Production vs Development

### Production (Cloudflare Workers)
- ✅ **No API key needed**
- ✅ Cron triggers run automatically every 6 hours
- ✅ Management endpoints (`/api/trigger-ingestion`, `/api/process-ai`) return HTTP 403
- ✅ Public endpoints (`/api/stats`, `/api/threats`, `/api/search`) work without auth

### Development (Local Testing)
- 🔧 **Optional API key for testing**
- 🔧 Allows manual triggering of `/api/trigger-ingestion` and `/api/process-ai`
- 🔧 Useful for debugging feed processing
- 🔧 Configured via `.dev.vars` file

---

## 🚀 Setup for Local Development (Optional)

If you want to test management endpoints locally, follow these steps:

### Step 1: Generate a Development API Key

Generate any random string for local testing:

```bash
# On Linux/macOS:
openssl rand -base64 32

# On Windows (PowerShell):
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})

# Example output:
# Xk3mP9vL2Qw8Zr5Hn7Jt4Gy6Fb1Dc0SaUv3Ex8Yz=
```

---

### Step 2: Create `.dev.vars` File

Create a `.dev.vars` file in the project root:

```bash
# .dev.vars (for local development only)
ENVIRONMENT=development
API_SECRET=your-random-key-from-step-1
```

**⚠️ Important:**
- `.dev.vars` is in `.gitignore` - never commit this file
- Only use this for local testing
- Not needed for production deployment

---

### Step 3: Start Local Development Server

```bash
npm run dev
```

The dev server starts at `http://localhost:8787`

---

### Step 4: Test Management Endpoints Locally

```bash
# Set your API key from .dev.vars
export API_KEY="your-random-key-from-step-1"

# Test trigger ingestion
curl -H "Authorization: Bearer $API_KEY" \
  http://localhost:8787/api/trigger-ingestion

# Expected response:
# {"success": true, "message": "Feed ingestion triggered successfully!"}

# Test AI processing
curl -H "Authorization: Bearer $API_KEY" \
  http://localhost:8787/api/process-ai?limit=5

# Expected response:
# {"success": true, "processed": 5}
```

---

## 🔒 Why No API Key in Production?

### Old Approach (Pages + GitHub Actions)
```
User → GitHub Actions → API call with API_SECRET → Pages Function
                              ↓
                         Vulnerable to:
                         - API key leaks
                         - Brute force attacks
                         - Rate limit bypass attempts
```

### New Approach (Workers + Native Cron)
```
Cloudflare Scheduler → Direct internal function call → Worker
                              ↓
                         Advantages:
                         ✅ No HTTP request (faster)
                         ✅ No exposed endpoint
                         ✅ No API key needed
                         ✅ Cannot be triggered externally
```

**Result:** Management endpoints are disabled in production (`HTTP 403`) because they're not needed. Cron handles everything automatically and securely.

---

## 🛡️ Security Benefits

### Before (Pages + API Keys)
- ❌ Management endpoints exposed to internet
- ❌ Potential for API key compromise
- ❌ Brute force attack surface
- ❌ External dependency (GitHub Actions)

### After (Workers + Disabled Endpoints)
- ✅ Management endpoints disabled in production
- ✅ No API key to compromise
- ✅ Zero attack surface
- ✅ Native Cloudflare cron (no external dependencies)

---

## ❓ Frequently Asked Questions

### Q: Do I need to set API_SECRET as a Cloudflare secret?

**A: No.** API_SECRET is no longer used in production. You only need it in `.dev.vars` for local testing.

### Q: How does data get ingested if endpoints are disabled?

**A: Via native cron triggers.** The cron scheduler directly calls the `scheduled()` function in `src/worker.ts`, which triggers `functions/scheduled.ts`. No HTTP request, no API key needed.

### Q: What if I want to manually trigger ingestion in production?

**A: You can't (by design).** This is a security feature. If you absolutely need to trigger ingestion:
1. Wait for the next cron run (every 6 hours)
2. Or temporarily set `ENVIRONMENT=development` in production (not recommended)
3. Or deploy a one-time manual trigger (then revert)

### Q: Can I still test locally with API keys?

**A: Yes!** Use `.dev.vars` with `ENVIRONMENT=development` and `API_SECRET=your-key`. Management endpoints work in dev mode.

### Q: Do public endpoints require authentication?

**A: No.** Public read-only endpoints (`/api/stats`, `/api/threats`, `/api/search`, `/api/threat/:id`) work without authentication in all environments. They're protected by rate limiting instead.

---

## 🔧 Troubleshooting

### Management endpoint returns 403 in production

**This is expected behavior!** Management endpoints are disabled in production for security.

**Solution:**
- Use cron triggers (automatic every 6 hours)
- Or test locally with `ENVIRONMENT=development` in `.dev.vars`

### Management endpoint returns 401 locally

**Cause:** Missing or incorrect `Authorization` header

**Solution:**
```bash
# Check .dev.vars has API_SECRET set
cat .dev.vars

# Use the correct header format
curl -H "Authorization: Bearer YOUR_KEY_FROM_DEV_VARS" \
  http://localhost:8787/api/trigger-ingestion
```

### Public endpoints return 401

**This should never happen!** Public endpoints don't require authentication.

**Possible causes:**
- You're calling a management endpoint by mistake
- There's a code error (check logs: `npx wrangler tail`)

---

## 📊 Endpoint Authentication Matrix

| Endpoint | Production | Development |
|----------|------------|-------------|
| `/api/stats` | ✅ No auth | ✅ No auth |
| `/api/threats` | ✅ No auth | ✅ No auth |
| `/api/threat/:id` | ✅ No auth | ✅ No auth |
| `/api/search` | ✅ No auth | ✅ No auth |
| `/api/trigger-ingestion` | ❌ Disabled (403) | 🔑 Requires API key |
| `/api/process-ai` | ❌ Disabled (403) | 🔑 Requires API key |

---

## 🎉 Summary

**For production deployment:** No API key needed! Cron triggers handle everything automatically.

**For local development:** Create `.dev.vars` with `API_SECRET` to test management endpoints.

**Security:** Management endpoints are disabled in production, reducing attack surface to zero.

---

**Questions?** Check [Deployment Guide](./DEPLOYMENT.md) or [Security Implementation](./SECURITY_IMPLEMENTATION.md)
