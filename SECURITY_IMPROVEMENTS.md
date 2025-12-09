# Security Improvements - December 8, 2025

## Summary

This document outlines critical security fixes and enhancements made to `functions/utils/security.ts` following a comprehensive security audit.

---

## 🚨 Critical Issues Fixed

### 1. **Race Condition in Rate Limiting** (Documented)
**Status**: Documented as known limitation
**Severity**: HIGH
**Impact**: Concurrent requests can bypass rate limits

**Decision**:
- Documented the race condition in code comments
- Added TODO to fix with Durable Objects in Phase 3
- Acceptable risk for current threat model (low-impact API abuse)
- Mitigation: IP blocking for detected abuse patterns

**Future Fix**: Phase 3 - Durable Objects with atomic operations

---

### 2. **Header Spoofing Vulnerability** (FIXED ✅)
**Status**: FIXED
**Severity**: HIGH
**Impact**: Attackers could bypass IP-based protections

**Changes**:
- Removed fallback to `X-Forwarded-For` and `X-Real-IP` headers
- Now ONLY trusts `CF-Connecting-IP` (set by Cloudflare, cannot be spoofed)
- Added IP format validation (IPv4 and IPv6)
- Returns 'unknown' for non-Cloudflare deployments

**Code**:
```typescript
// BEFORE: Vulnerable to header spoofing
const xForwardedFor = request.headers.get('X-Forwarded-For');
if (xForwardedFor) {
  return xForwardedFor.split(',')[0].trim();  // Can be spoofed
}

// AFTER: Only trust Cloudflare header
const cfIP = request.headers.get('CF-Connecting-IP');
if (cfIP && isValidIP(cfIP)) {
  return cfIP;  // Cannot be spoofed
}
return 'unknown';
```

---

### 3. **Wildcard CORS by Default** (FIXED ✅)
**Status**: FIXED
**Severity**: MEDIUM
**Impact**: Any website could make requests and exfiltrate data

**Changes**:
- Removed default `'*'` origin from `addCORSHeaders()`
- Added `validateOrigin()` function with allowlist
- Default allowlist for development (localhost ports)
- Production origins must be explicitly configured
- Added `Access-Control-Allow-Credentials: true` for non-wildcard origins

**Code**:
```typescript
// BEFORE: Dangerous default
export function addCORSHeaders(
  response: Response,
  origin: string = '*',  // ⚠️ VULNERABLE
  ...
)

// AFTER: Explicit origin required
export function addCORSHeaders(
  response: Response,
  origin: string,  // ✅ No default - must validate first
  ...
)

// New validation function
export function validateOrigin(origin: string | null, allowedOrigins?: string[]): string | null {
  if (!origin) return null;
  const allowed = allowedOrigins || DEFAULT_ALLOWED_ORIGINS;
  return allowed.includes(origin) ? origin : null;
}
```

---

## ✅ Security Enhancements Added

### 4. **IP Blocking System** (NEW)
**Status**: IMPLEMENTED
**Features**:
- Check if IP is blocked: `isIPBlocked(env, ip)`
- Block IP temporarily or permanently: `blockIP(env, ip, duration, reason)`
- Unblock IP: `unblockIP(env, ip)`
- Integrated into `securityMiddleware()` (checked first, before rate limiting)

**Usage**:
```typescript
// Block IP for 1 hour
await blockIP(env, '1.2.3.4', 3600, 'rate_limit_abuse');

// Permanent block
await blockIP(env, '1.2.3.4', 0, 'malicious_activity');

// Check in middleware
if (await isIPBlocked(env, ip)) {
  return blockedIPResponse('Your IP has been blocked for abuse');
}
```

---

### 5. **Enhanced Security Headers** (IMPROVED)
**Status**: IMPLEMENTED
**Added headers**:
- `Strict-Transport-Security` (HSTS) - Force HTTPS, 1 year, include subdomains
- `Cross-Origin-Embedder-Policy: require-corp`
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Resource-Policy: same-origin`

**Comprehensive CSP for HTML**:
```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval';  // TODO: Remove unsafe-* in production
style-src 'self' 'unsafe-inline';
img-src 'self' data: https:;
font-src 'self' data:;
connect-src 'self' https://api.cloudflare.com;
frame-ancestors 'none';
base-uri 'self';
form-action 'self'
```

**Strict CSP for JSON APIs**:
```
default-src 'none'
```

---

### 6. **IP Format Validation** (NEW)
**Status**: IMPLEMENTED
**Function**: `isValidIP(ip: string): boolean`
- Validates IPv4 format (xxx.xxx.xxx.xxx, octets 0-255)
- Validates IPv6 format (simplified regex)
- Prevents malformed IP strings from being used

---

## 📋 Breaking Changes

### Test Updates Required

The following tests need updates to match new security requirements:

1. **`addSecurityHeaders()`** - HTML responses now have comprehensive CSP
2. **`addCORSHeaders()`** - No default wildcard, requires explicit origin
3. **`handleCORSPreflight()`** - No default wildcard, must validate origin first
4. **`securityMiddleware()`** - Now checks IP blocklist before rate limiting

### API Changes

**CORS Usage** (Before):
```typescript
// OLD: Implicit wildcard (vulnerable)
const response = addCORSHeaders(apiResponse);
```

**CORS Usage** (After):
```typescript
// NEW: Explicit origin validation
const requestOrigin = request.headers.get('Origin');
const validatedOrigin = validateOrigin(requestOrigin);

if (validatedOrigin) {
  const response = addCORSHeaders(apiResponse, validatedOrigin);
}
```

---

## 🎯 Remaining Security Tasks (from TODO.md)

### Phase 1.2: Security Enhancements

- [x] ~~Implement rate limiting using KV for API endpoints~~ ✅ (with known race condition)
- [ ] Add CORS configuration with domain allowlist (partially done - needs integration)
- [ ] Create request validation middleware
- [ ] Add input sanitization for search queries (basic implementation exists)
- [x] Implement CSP headers for frontend ✅
- [ ] Add API key rotation mechanism
- [x] Create IP-based rate limiting for abuse prevention ✅

---

## 🔐 Security Best Practices Applied

1. **Fail Open vs Fail Closed**:
   - Rate limiting: Fail open (allow request if check fails)
   - IP blocking: Fail open (don't block if check fails)
   - Rationale: Availability over perfect security for non-critical APIs

2. **Defense in Depth**:
   - IP blocking → Rate limiting → Input validation → Output sanitization
   - Multiple layers of protection

3. **Least Privilege**:
   - CORS restricted to allowlist by default
   - No wildcard '*' unless explicitly set

4. **Security by Default**:
   - All responses get security headers
   - HTML responses get comprehensive CSP
   - HSTS enforces HTTPS

5. **Audit Logging**:
   - IP blocks are logged with reason
   - Rate limit failures could be logged (enhancement needed)

---

## 📊 Risk Assessment After Changes

| Issue | Before | After | Residual Risk |
|-------|--------|-------|---------------|
| Rate limit bypass | HIGH | MEDIUM | Race condition remains (Phase 3 fix) |
| Header spoofing | HIGH | LOW | Only on non-Cloudflare deployments |
| CORS abuse | MEDIUM | LOW | Wildcard must be explicit |
| IP blocking | N/A | LOW | Fail-open design acceptable |
| CSP protection | MEDIUM | LOW | HTML responses now protected |
| HTTPS enforcement | MEDIUM | LOW | HSTS enforces HTTPS |

---

## 🚀 Next Steps

1. **Update tests** to match new security requirements
2. **Integrate CORS validation** into all API endpoints
3. **Add API key authentication** to sensitive endpoints
4. **Implement request validation middleware**
5. **Phase 3**: Replace rate limiting with Durable Objects for atomic operations

---

## 📚 References

- [OWASP Secure Headers Project](https://owasp.org/www-project-secure-headers/)
- [Cloudflare Workers Security Best Practices](https://developers.cloudflare.com/workers/platform/best-practices/)
- [MDN CORS Documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- TODO.md Phase 1.2 - Security Enhancements
- TODO.md Phase 3.1 - Durable Objects (rate limiting fix)
