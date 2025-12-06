# 🔐 API Key Setup Guide

This guide explains how to set up API key authentication for management endpoints (`/api/trigger-ingestion` and `/api/process-ai`).

## Why API Keys?

Management endpoints are restricted to **GitHub Actions only** for security:
- Prevents public access to expensive AI operations
- Protects against resource exhaustion attacks
- Ensures only your automated workflow can trigger ingestion

---

## 🚀 Setup Instructions

### Step 1: Generate a Secret API Key

Generate a strong random key (32+ characters):

```bash
# On Linux/macOS:
openssl rand -base64 32

# On Windows (PowerShell):
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})

# Example output:
# Xk3mP9vL2Qw8Zr5Hn7Jt4Gy6Fb1Dc0SaUv3Ex8Yz=
```

**Save this key** - you'll need it for steps 2 and 3.

---

### Step 2: Add Secret to Cloudflare Pages

Use Wrangler CLI to add the secret to your Cloudflare Pages project:

```bash
npx wrangler pages secret put API_SECRET --project-name=threat-intel-dashboard
```

When prompted, paste the generated key. Press Enter.

**Note:** Secrets are encrypted and NOT visible in `wrangler.jsonc` or the Dashboard.

---

### Step 3: Add Secret to GitHub Actions

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Enter:
   - **Name:** `API_SECRET`
   - **Value:** (paste the same key from Step 1)
5. Click **Add secret**

---

### Step 4: Deploy Changes

The code changes are already committed. Just push to deploy:

```bash
git push origin main
```

Cloudflare will automatically deploy with the new authentication.

---

## ✅ Verification

Test that authentication is working:

### Test 1: Unauthorized Request (should fail)

```bash
# Without API key - should return 401 Unauthorized
curl https://threat-intel-dashboard.pages.dev/api/trigger-ingestion

# Expected response:
# {
#   "error": "Unauthorized",
#   "message": "Valid API key required. This endpoint is restricted to authorized clients only."
# }
```

### Test 2: Authorized Request (should succeed)

```bash
# With API key - should return 200 OK
curl -H "Authorization: Bearer YOUR_API_KEY_HERE" \
  https://threat-intel-dashboard.pages.dev/api/trigger-ingestion

# Expected response:
# {
#   "success": true,
#   "message": "Feed ingestion triggered successfully!",
#   "timestamp": "2025-12-05T..."
# }
```

### Test 3: GitHub Actions (automatic)

1. Go to GitHub repository → **Actions** tab
2. Click **Scheduled Feed Ingestion**
3. Click **Run workflow** → **Run workflow**
4. Watch the logs - should complete successfully with API key auth

---

## 🔄 Rotating the API Key

If the key is compromised, rotate it:

1. Generate a new key:
   ```bash
   openssl rand -base64 32
   ```

2. Update Cloudflare Pages secret:
   ```bash
   npx wrangler pages secret put API_SECRET --project-name=threat-intel-dashboard
   ```

3. Update GitHub Actions secret:
   - Go to repo **Settings** → **Secrets** → **Actions**
   - Click **API_SECRET** → **Update secret**
   - Paste new key → **Update secret**

4. Old key is immediately invalid; new key is active.

---

## 🛡️ Security Best Practices

✅ **DO:**
- Keep the API key secret (never commit to git)
- Use the key only in GitHub Actions secrets
- Rotate the key if you suspect compromise
- Use HTTPS for all API requests (automatic with Cloudflare)

❌ **DON'T:**
- Share the API key publicly
- Put the key in code or environment variables (use secrets)
- Use the same key across multiple projects
- Log the API key in application logs

---

## 📊 Protected Endpoints

These endpoints now require API key authentication:

| Endpoint | Method | Purpose | Required Header |
|----------|--------|---------|-----------------|
| `/api/trigger-ingestion` | GET | Trigger feed ingestion | `Authorization: Bearer <key>` |
| `/api/process-ai?limit=N` | GET | Process AI analysis | `Authorization: Bearer <key>` |

**Public endpoints** (no authentication required):
- `/api/stats` - Dashboard statistics
- `/api/threats` - List threats
- `/api/search` - Search threats
- All other read-only endpoints

---

## ❓ Troubleshooting

### GitHub Actions fails with 401 Unauthorized

**Cause:** API_SECRET not set in GitHub Actions secrets.

**Solution:**
1. Go to repo Settings → Secrets → Actions
2. Verify `API_SECRET` exists
3. If not, add it (see Step 3 above)
4. Re-run the workflow

### Cloudflare deployment fails

**Cause:** API_SECRET not set in Cloudflare Pages.

**Solution:**
```bash
npx wrangler pages secret put API_SECRET --project-name=threat-intel-dashboard
```
Paste the key, then redeploy.

### Local development

**For local testing,** create a `.dev.vars` file:
```
API_SECRET=your-test-key-here
```

Then run `npm run dev` and test locally.

---

## 🔗 Alternative: X-API-Key Header

If you prefer `X-API-Key` header instead of `Authorization: Bearer`:

```bash
# Both formats are supported:
curl -H "Authorization: Bearer YOUR_KEY" https://...
curl -H "X-API-Key: YOUR_KEY" https://...
```

The authentication middleware accepts both formats.

---

**Done!** Management endpoints are now secured and only accessible to GitHub Actions. 🎉
