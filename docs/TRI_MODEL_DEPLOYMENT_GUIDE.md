# Tri-Model Deployment Guide

**Status:** ⚠️ POSTPONED - Qwen 30B JSON Failures (December 9, 2025)
**Date:** December 7, 2025
**Updated:** December 9, 2025
**Expected Impact:** 81% neuron reduction, $0.30/month savings, 4.75× scaling capacity

---

## 🔴 IMPORTANT UPDATE (December 9, 2025)

**Tri-model deployment has been POSTPONED due to critical JSON formatting failures with Qwen 30B.**

**Current Status:**
- Application reverted to baseline mode (Llama 3.3 70B only)
- Qwen 30B exhibited 100% JSON parsing failure rate during testing
- All tri-model testing and deployment is on hold pending investigation

**Issues Found:**
- Qwen 30B unable to produce valid JSON consistently
- Incomplete/truncated JSON responses
- Articles defaulting to category="other", severity="info"

**Next Steps:**
1. Investigate Qwen 30B prompt engineering requirements
2. Test alternative models (Llama 3.1 8B, Mistral variants)
3. Implement more robust JSON validation
4. Re-run validation testing with fixes
5. Resume deployment phases only after 95%+ JSON success rate

See [HYBRID_LLM_STRATEGY.md](./HYBRID_LLM_STRATEGY.md#-current-status-december-9-2025) for detailed failure analysis.

**This guide remains available for reference but should NOT be followed until the above issues are resolved.**

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Deployment Phases](#deployment-phases)
4. [Configuration](#configuration)
5. [Validation Testing](#validation-testing)
6. [Monitoring](#monitoring)
7. [Rollback Procedures](#rollback-procedures)
8. [Troubleshooting](#troubleshooting)

---

## Overview

The tri-model optimization strategy uses three specialized AI models instead of a single Llama 70B model:

| Component | Current (Baseline) | Tri-Model | Savings |
|-----------|-------------------|-----------|---------|
| **Classification** | Llama 70B | Llama 1B | 48% |
| **IOC Extraction** | Llama 70B | Qwen 30B | 85% |
| **Embeddings** | BGE-Large | BGE-M3 | 94% |
| **Total Neurons/Article** | 182 | 35 | **81%** |

**Key Benefits:**
- ✅ Stays within free tier (21% vs 109% utilization)
- ✅ 4.75× scaling capacity (285 vs 60 articles/day)
- ✅ $0.30/month immediate savings
- ✅ Same critical IOC accuracy (pending validation)

---

## Prerequisites

Before deploying the tri-model strategy, ensure:

- [ ] Current codebase is on `feat/cloudflare-workers-optimization` branch
- [ ] No pending changes in git working directory
- [ ] Development environment variables configured (`.dev.vars`)
- [ ] Access to Cloudflare Workers AI dashboard for monitoring
- [ ] Backup of current production deployment

---

## Deployment Phases

The deployment follows a **4-phase approach** to ensure safety:

### Phase 1: Shadow Testing (Current Phase) ✅

**Duration:** 1 week
**Risk:** None (no user impact)
**Configuration:**

```typescript
// functions/constants.ts
export const DEPLOYMENT_CONFIG = {
  MODE: 'shadow',              // Run both models, use baseline result
  CANARY_PERCENT: 10,          // Not used in shadow mode
  VALIDATION_LOGGING: true,    // Enable comparison logs
} as const;
```

**What Happens:**
- Both baseline (70B) and tri-model (1B+30B) execute in parallel
- Baseline results are used (no accuracy risk)
- Comparison logs are generated for validation
- Monitor logs for accuracy comparison

**Validation Checklist:**
- [ ] Deploy with `MODE: 'shadow'`
- [ ] Run `curl http://localhost:8787/api/validate-models?test=all` (dev environment)
- [ ] Monitor shadow test logs: `wrangler tail --format pretty`
- [ ] Collect 50+ comparison logs
- [ ] Analyze accuracy metrics (see [Validation Testing](#validation-testing))

**Success Criteria:**
- Classification accuracy ≥ 85%
- IOC CVE recall ≥ 95%
- No critical errors or failures
- Similar or better processing times

**Next Step:** If validation passes → Phase 2 (Canary 10%)

---

### Phase 2: Canary Deployment 10%

**Duration:** 1 week
**Risk:** Low (10% of articles)
**Configuration:**

```typescript
// functions/constants.ts
export const DEPLOYMENT_CONFIG = {
  MODE: 'canary',
  CANARY_PERCENT: 10,          // Use tri-model for 10% of articles
  VALIDATION_LOGGING: true,
} as const;
```

**What Happens:**
- 10% of articles use tri-model
- 90% continue using baseline
- Monitor for accuracy degradation
- Neuron usage should drop by ~8%

**Validation Checklist:**
- [ ] Deploy with `MODE: 'canary'`, `CANARY_PERCENT: 10`
- [ ] Monitor neuron usage: Should be ~9,800/day (vs 10,920)
- [ ] Check error rates in Cloudflare dashboard
- [ ] Review IOC extraction quality on 10% of articles
- [ ] Compare semantic search quality

**Success Criteria:**
- No increase in error rates
- Neuron usage reduced proportionally
- No user complaints or data quality issues

**Next Step:** If successful → Phase 3 (Canary 50%)

---

### Phase 3: Canary Deployment 50%

**Duration:** 1 week
**Risk:** Medium (50% of articles)
**Configuration:**

```typescript
// functions/constants.ts
export const DEPLOYMENT_CONFIG = {
  MODE: 'canary',
  CANARY_PERCENT: 50,          // Use tri-model for 50% of articles
  VALIDATION_LOGGING: false,   // Reduce logging noise
} as const;
```

**What Happens:**
- 50% of articles use tri-model
- 50% continue using baseline
- Neuron usage should drop by ~40%

**Validation Checklist:**
- [ ] Deploy with `CANARY_PERCENT: 50`
- [ ] Monitor neuron usage: Should be ~6,460/day
- [ ] Review dashboard metrics and user feedback
- [ ] Spot-check IOC extraction on random articles

**Success Criteria:**
- Neuron usage at ~65% of original
- No quality degradation
- No performance issues

**Next Step:** If successful → Phase 4 (Full Deployment)

---

### Phase 4: Full Deployment (Tri-Model 100%)

**Duration:** Ongoing
**Risk:** Low (proven in canary)
**Configuration:**

```typescript
// functions/constants.ts
export const DEPLOYMENT_CONFIG = {
  MODE: 'trimodel',            // Full tri-model deployment
  CANARY_PERCENT: 10,          // Not used in trimodel mode
  VALIDATION_LOGGING: false,
} as const;
```

**What Happens:**
- 100% of articles use tri-model
- Neuron usage: ~2,100/day (21% of limit)
- **79% headroom for scaling**

**Validation Checklist:**
- [ ] Deploy with `MODE: 'trimodel'`
- [ ] Monitor neuron usage: Should be ~2,100/day
- [ ] Confirm free tier compliance (< 10,000 neurons/day)
- [ ] Document final metrics

**Success Metrics:**
- **Neuron usage:** 2,100/day (21% of limit) ✅
- **Free tier:** 79% headroom ✅
- **Scaling capacity:** 285 articles/day ✅
- **Cost:** $0/month ✅

---

## Configuration

### Deployment Mode Configuration

Edit `functions/constants.ts`:

```typescript
export const DEPLOYMENT_CONFIG = {
  // Change this value based on deployment phase
  MODE: 'shadow' as 'baseline' | 'shadow' | 'canary' | 'trimodel',

  // Canary percentage (only used when MODE = 'canary')
  CANARY_PERCENT: 10, // Start with 10%, then 50%, then 100%

  // Enable validation logging (recommended for shadow and early canary)
  VALIDATION_LOGGING: true,
} as const;
```

### Model Configuration

Models are pre-configured in `functions/constants.ts`:

```typescript
export const AI_MODELS = {
  // Tri-model configuration
  TEXT_GENERATION_LARGE: '@cf/qwen/qwen3-30b-a3b-fp8',
  TEXT_GENERATION_SMALL: '@cf/meta/llama-3.2-1b-instruct',
  EMBEDDINGS: '@cf/baai/bge-m3',

  // Fallback models (if validation fails)
  TEXT_GENERATION_LARGE_FALLBACK: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  TEXT_GENERATION_SMALL_FALLBACK: '@cf/meta/llama-3.1-8b-instruct-fp8-fast',
  EMBEDDINGS_FALLBACK: '@cf/baai/bge-large-en-v1.5',
} as const;
```

**Note:** If validation tests fail for any component, update the constants to use the `_FALLBACK` model for that component.

---

## Validation Testing

### Running Validation Tests

**Option 1: API Endpoint (Recommended)**

```bash
# Development environment only
curl http://localhost:8787/api/validate-models?test=all

# Test specific component
curl http://localhost:8787/api/validate-models?test=classification
curl http://localhost:8787/api/validate-models?test=ioc-extraction
```

**Option 2: Shadow Testing Logs**

During shadow mode, review comparison logs:

```bash
# Tail logs in real-time
wrangler tail --format pretty

# Look for [Shadow Test Comparison] entries
# Example output:
# {
#   "threatId": "abc123",
#   "categoryMatch": true,
#   "severityMatch": true,
#   "iocCounts": {
#     "baseline": { "cves": 1, "ips": 1 },
#     "trimodel": { "cves": 1, "ips": 1 }
#   }
# }
```

### Validation Metrics

| Metric | Threshold | Critical? | Test Method |
|--------|-----------|-----------|-------------|
| **Category Accuracy** | ≥ 85% | No | API endpoint or shadow logs |
| **Severity Accuracy** | ≥ 80% | No | API endpoint or shadow logs |
| **CVE Recall** | ≥ 95% | **YES** | Shadow logs (critical IOCs) |
| **CVE Precision** | ≥ 98% | **YES** | Shadow logs |
| **IP Recall** | ≥ 85% | Yes | Shadow logs |
| **Domain Recall** | ≥ 85% | Yes | Shadow logs |
| **Hash Recall** | ≥ 80% | Yes | Shadow logs |

**Critical:** If CVE recall or precision falls below threshold, **revert to baseline immediately**.

### Interpreting Results

**✅ PASS - Ready for Next Phase:**
- All metrics meet or exceed thresholds
- No critical errors in logs
- Processing time similar or better

**⚠️ CONDITIONAL PASS - Monitor Closely:**
- Metrics slightly below threshold (within 5%)
- Minor quality issues on non-critical fields
- Continue to next phase with extra monitoring

**❌ FAIL - Use Fallback Models:**
- Any critical metric below threshold
- Frequent errors or failures
- Update constants.ts to use `_FALLBACK` models

---

## Monitoring

### Neuron Usage Dashboard

Monitor daily neuron consumption:

1. **Cloudflare Dashboard:**
   [https://dash.cloudflare.com/?to=/:account/ai/workers-ai](https://dash.cloudflare.com)

2. **Expected Neuron Usage:**

   | Deployment Mode | Expected Daily Neurons | % of Free Tier |
   |-----------------|------------------------|----------------|
   | Baseline (70B) | 10,920 | 109% ❌ |
   | Shadow (both) | ~21,800 | 218% ⚠️ (temporary) |
   | Canary 10% | ~9,800 | 98% ✅ |
   | Canary 50% | ~6,460 | 65% ✅ |
   | Tri-Model 100% | **2,100** | **21%** ✅ |

   **Note:** Shadow mode temporarily doubles neuron usage (running both models). This is expected and necessary for validation.

3. **Alert Thresholds:**
   - **Warning:** > 8,000 neurons/day (80% utilization)
   - **Critical:** > 9,500 neurons/day (95% utilization)

### Application Logs

Monitor for model comparison logs:

```bash
# Real-time log monitoring
wrangler tail --format pretty | grep "Shadow Test"

# Look for patterns in accuracy
wrangler tail --format pretty | grep "categoryMatch"
```

### Error Tracking

Monitor error rates in Cloudflare dashboard:

- **Target:** < 1% error rate
- **Alert:** > 5% error rate → investigate immediately
- **Critical:** > 10% error rate → rollback

---

## Rollback Procedures

### Emergency Rollback (Immediate)

If critical issues are detected:

**Step 1: Revert to Baseline**

```typescript
// functions/constants.ts
export const DEPLOYMENT_CONFIG = {
  MODE: 'baseline',  // ← Change this
  CANARY_PERCENT: 10,
  VALIDATION_LOGGING: false,
} as const;
```

**Step 2: Deploy**

```bash
npm run deploy
```

**Step 3: Verify**

```bash
# Check logs for baseline mode
wrangler tail --format pretty | grep "baseline"

# Confirm neuron usage returns to ~10,920/day
```

### Partial Rollback (Component-Specific)

If only one model component fails validation:

**Example: If Qwen 30B fails IOC extraction**

```typescript
// functions/constants.ts
export const AI_MODELS = {
  TEXT_GENERATION_LARGE: AI_MODELS.TEXT_GENERATION_LARGE_FALLBACK, // ← Fallback
  TEXT_GENERATION_SMALL: '@cf/meta/llama-3.2-1b-instruct',           // ← Keep
  EMBEDDINGS: '@cf/baai/bge-m3',                                      // ← Keep
  // ...
} as const;
```

This allows you to keep the cost savings from the other components while reverting the problematic one.

---

## Troubleshooting

### Issue: Neuron usage not decreasing

**Symptoms:**
- Deployed canary/trimodel but neuron usage unchanged

**Diagnosis:**
```bash
# Check deployment mode in logs
wrangler tail --format pretty | grep "MODE"
```

**Solution:**
1. Verify `DEPLOYMENT_CONFIG.MODE` in `functions/constants.ts`
2. Ensure deployment succeeded: `npm run deploy`
3. Check wrangler.jsonc is using correct main file

---

### Issue: Lower IOC extraction rates

**Symptoms:**
- Fewer CVEs, IPs, or domains extracted vs baseline

**Diagnosis:**
```bash
# Check shadow test comparison logs
wrangler tail --format pretty | grep "iocCounts"
```

**Solution:**
1. Review specific IOC types failing (CVE vs IP vs domain)
2. If CVE recall < 95%, **revert to baseline immediately**
3. If other IOCs < 85%, continue monitoring or revert

---

### Issue: High error rates

**Symptoms:**
- > 5% error rate in Cloudflare dashboard
- Frequent "Error in tri-model analysis" logs

**Diagnosis:**
```bash
# Check error logs
wrangler tail --format pretty | grep "Error"
```

**Solution:**
1. Check Workers AI status: [https://www.cloudflarestatus.com](https://www.cloudflarestatus.com)
2. Verify model names are correct in constants.ts
3. Check if hitting rate limits (unlikely at 2,100 neurons/day)
4. If persistent, rollback to baseline

---

### Issue: Shadow mode using too many neurons

**Symptoms:**
- Neuron usage > 20,000/day during shadow testing
- Exceeding free tier significantly

**Solution:**
1. **This is expected** - shadow mode runs both baseline + tri-model
2. Shadow testing should be temporary (1 week max)
3. If cost is a concern, skip shadow and go straight to canary 10%
4. Alternatively, reduce `MAX_AI_PROCESSING_PER_RUN` temporarily

---

## Success Metrics

After full deployment (Phase 4), verify:

- ✅ **Neuron Usage:** ~2,100/day (21% of free tier)
- ✅ **Free Tier Compliance:** No overage charges
- ✅ **Scaling Capacity:** Can process up to 285 articles/day
- ✅ **Quality Maintained:** CVE recall ≥ 95%, category accuracy ≥ 85%
- ✅ **Cost Savings:** $0.30/month immediate, $3.90/month at 2× volume

---

## Next Steps After Full Deployment

1. **Monitor for 1 month** to ensure stability
2. **Document final accuracy metrics** for future reference
3. **Update documentation** with production learnings
4. **Consider additional optimizations:**
   - Database indexing improvements
   - Multi-signal similarity scoring
   - KV cache removal
   - Conditional 70B strategy for even more savings

---

## Support

- **Documentation:** `docs/CLOUDFLARE_WORKERS_OPTIMIZATION.md`
- **Strategy Details:** `docs/HYBRID_LLM_STRATEGY.md`
- **GitHub Issues:** [VectorRelay Issues](https://github.com/your-repo/issues)

---

**Last Updated:** December 7, 2025
**Version:** 1.0
**Status:** Ready for Shadow Testing ✅
