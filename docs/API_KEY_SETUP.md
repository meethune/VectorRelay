# 🔐 API Key Setup & Management

**✨ NEW:** VectorRelay now includes a built-in API key rotation mechanism with SHA-256 hashing, permission-based access control, and automatic expiration. See [API Key Rotation](#api-key-rotation-mechanism-new) below.

**⚠️ Note:** API keys are **no longer required for production deployment**. Management endpoints are disabled in production for security, and cron triggers handle all automation internally.

This guide covers:
1. Local development API key setup (optional, for testing)
2. API key rotation mechanism (new, production-ready)

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

## 🔄 API Key Rotation Mechanism (NEW)

**✨ New in Phase 1.2:** VectorRelay now includes a built-in API key rotation mechanism for production-ready API authentication.

### Features

- **Cryptographically Secure:** Uses `crypto.getRandomValues()` for key generation
- **SHA-256 Hashing:** Never stores plaintext keys
- **Permission-Based Access:** Wildcard (`read:*`) and specific (`read:threats`) permissions
- **Key Expiration:** Automatic expiration with configurable TTL
- **Key Rotation:** Create new key, deprecate old key with grace period
- **Immediate Revocation:** Instantly disable compromised keys
- **Usage Tracking:** Last used timestamp for audit trails

### Key Format

All API keys use the format: `vr_<48-char-base64url-token>`

Example: `vr_abc123xyz789...` (68 characters total)

### Usage Examples

```typescript
import {
  generateAPIKey,
  validateAPIKey,
  rotateAPIKey,
  revokeAPIKey,
  listAPIKeys,
} from './functions/utils/api-key-rotation';

// Generate a new API key
const result = await generateAPIKey(env, {
  name: 'Production API',
  permissions: ['read:threats', 'write:threats'],
  expiresInDays: 365, // Optional
});

console.log('Save this key:', result.apiKey);
// vr_abc123xyz789... (only returned once!)

// Validate API key in endpoint
const metadata = await validateAPIKey(
  env,
  request.headers.get('Authorization')?.slice(7), // Remove 'Bearer '
  'read:threats' // Optional permission check
);

if (!metadata) {
  return new Response('Unauthorized', { status: 401 });
}

// Rotate key (30-day grace period)
const newKey = await rotateAPIKey(env, 'key_abc123', 30);
console.log('New key:', newKey.apiKey);
console.log('Old key will be revoked in 30 days');

// Revoke key immediately
await revokeAPIKey(env, 'key_abc123');

// List all keys
const keys = await listAPIKeys(env);
for (const key of keys) {
  console.log(`${key.keyId}: ${key.name} (${key.status})`);
}
```

### Permission System

**Wildcard permissions:**
- `read:*` - Read all resources
- `write:*` - Write all resources
- `admin:*` - All administrative actions

**Specific permissions:**
- `read:threats` - Read threat data
- `write:threats` - Create/update threats
- `admin:keys` - Manage API keys

### Key States

- **active** - Key is valid and can be used
- **deprecated** - Key still works but has been rotated (grace period)
- **revoked** - Key is permanently disabled

### Storage

API keys are stored in KV with the following key patterns:

- `apikey:metadata:{keyId}` - Key metadata (hashed key, permissions, status)
- `apikey:hash:{hash}` - Hash → keyId mapping for validation

### Security Best Practices

1. **Never log plaintext keys** - Only log key IDs
2. **Rotate keys regularly** - Use 30-90 day grace periods
3. **Use specific permissions** - Avoid `*:*` unless necessary
4. **Set expiration dates** - Especially for temporary access
5. **Monitor usage** - Check `lastUsedAt` timestamps
6. **Revoke compromised keys immediately** - Use `revokeAPIKey()`

### Integration Example

```typescript
// In your API endpoint
import { validateAPIKey } from './utils/api-key-rotation';

export const onRequestPost = async ({ request, env }) => {
  // Validate API key
  const apiKey = request.headers.get('Authorization')?.replace('Bearer ', '');
  const metadata = await validateAPIKey(env, apiKey, 'write:threats');

  if (!metadata) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Process request with validated permissions
  // ...
};
```

---

## 🎉 Summary

**For production deployment:** No API key needed for basic usage! Cron triggers handle everything automatically.

**For API access:** Use the new API key rotation mechanism for production-ready authentication.

**For local development:** Create `.dev.vars` with `API_SECRET` to test management endpoints.

**Security:** Management endpoints are disabled in production, reducing attack surface to zero.

---

**Questions?** Check [Deployment Guide](./DEPLOYMENT.md) or [Security Documentation](./SECURITY.md)
