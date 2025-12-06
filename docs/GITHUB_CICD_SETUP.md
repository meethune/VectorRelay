# GitHub CI/CD Setup for Cloudflare Workers

This document explains how to set up automatic deployment to Cloudflare Workers via GitHub Actions.

---

## Overview

The project is configured to automatically deploy to Cloudflare Workers whenever code is pushed to the `main` branch.

**Workflow file:** `.github/workflows/deploy.yml`

---

## Required GitHub Secrets

You need to add two secrets to your GitHub repository:

### 1. CLOUDFLARE_API_TOKEN

**What it is:** API token that allows GitHub Actions to deploy to your Cloudflare account

**How to get it:**

1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Click "Create Token"
3. Use the "Edit Cloudflare Workers" template (or create custom token with these permissions):
   - Account: Workers Scripts (Edit)
   - Account: Workers KV Storage (Edit)
   - Account: D1 (Edit)
   - Account: Vectorize (Edit)
   - Account: Analytics Engine (Edit)
4. Select your account under "Account Resources"
5. Click "Continue to summary" → "Create Token"
6. **Copy the token** (you won't be able to see it again!)

**Add to GitHub:**
1. Go to your GitHub repo → Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Name: `CLOUDFLARE_API_TOKEN`
4. Value: paste the token you copied
5. Click "Add secret"

### 2. CLOUDFLARE_ACCOUNT_ID

**What it is:** Your Cloudflare account ID

**How to get it:**

1. Go to https://dash.cloudflare.com/
2. Select any website (or Workers & Pages)
3. Look for "Account ID" in the right sidebar (or scroll down)
4. Copy the account ID (format: `1234567890abcdef1234567890abcdef`)

**Add to GitHub:**
1. Go to your GitHub repo → Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Name: `CLOUDFLARE_ACCOUNT_ID`
4. Value: paste your account ID
5. Click "Add secret"

---

## How It Works

### Automatic Deployment

Every time you push to `main`:

```bash
git add .
git commit -m "Your commit message"
git push origin main
```

GitHub Actions will automatically:
1. Check out the code
2. Install dependencies
3. Build the frontend (`npm run build`)
4. Deploy to Cloudflare Workers using wrangler

### Manual Deployment

You can also trigger deployment manually:

1. Go to your GitHub repo → Actions tab
2. Click "Deploy to Cloudflare Workers" workflow
3. Click "Run workflow" → select branch → "Run workflow"

---

## Monitoring Deployments

### View Deployment Status

1. Go to your GitHub repo → Actions tab
2. Click on the latest workflow run
3. View logs for each step

### View Deployed Worker

1. Go to https://dash.cloudflare.com/
2. Navigate to Workers & Pages
3. Click on `threat-intel-dashboard`
4. View deployment history, logs, and metrics

---

## Troubleshooting

### Deployment Fails: "Authentication error"

**Problem:** Invalid or expired API token

**Solution:**
1. Create a new API token (see steps above)
2. Update `CLOUDFLARE_API_TOKEN` secret in GitHub

### Deployment Fails: "Account ID not found"

**Problem:** Incorrect account ID

**Solution:**
1. Double-check your account ID from Cloudflare dashboard
2. Update `CLOUDFLARE_ACCOUNT_ID` secret in GitHub

### Deployment Succeeds but Changes Not Visible

**Problem:** Browser caching

**Solution:**
1. Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
2. Check Cloudflare Workers dashboard to verify deployment time

### Build Fails: "npm ci" error

**Problem:** package-lock.json out of sync with package.json

**Solution:**
```bash
rm package-lock.json
npm install
git add package-lock.json
git commit -m "Fix package-lock.json"
git push
```

---

## Workflow Configuration

The workflow runs on:
- **Push to main:** Automatic deployment
- **Manual trigger:** Via GitHub Actions UI

**File:** `.github/workflows/deploy.yml`

```yaml
name: Deploy to Cloudflare Workers

on:
  push:
    branches:
      - main
  workflow_dispatch: # Allow manual trigger

jobs:
  deploy:
    runs-on: ubuntu-latest
    name: Deploy
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build frontend
        run: npm run build

      - name: Deploy to Cloudflare Workers
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

---

## Alternative: Deploy from CLI

If you prefer manual deployment:

```bash
npm run deploy
```

This builds and deploys directly from your local machine.

---

## Security Best Practices

1. **Never commit API tokens** to the repository
2. **Use GitHub Secrets** for all sensitive values
3. **Rotate API tokens** periodically (every 90 days recommended)
4. **Use scoped tokens** with minimum required permissions
5. **Enable 2FA** on your Cloudflare account

---

## Next Steps

1. ✅ Add `CLOUDFLARE_API_TOKEN` to GitHub Secrets
2. ✅ Add `CLOUDFLARE_ACCOUNT_ID` to GitHub Secrets
3. ✅ Push code to main branch
4. ✅ Verify deployment in GitHub Actions
5. ✅ Test the deployed application

---

**Status:** Ready to deploy automatically on push to main! 🚀
