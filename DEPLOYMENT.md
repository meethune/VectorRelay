# 🚀 Deployment Checklist

Follow these steps to deploy your Threat Intelligence Dashboard.

## ✅ Pre-Deployment Checklist

- [ ] Node.js 18+ installed
- [ ] Wrangler CLI installed (`npm install -g wrangler`)
- [ ] Cloudflare account created
- [ ] Authenticated with Wrangler (`wrangler login`)

## 📝 Step-by-Step Deployment

### Step 1: Install Dependencies

```bash
npm install
```

**Expected output:** All packages installed successfully

---

### Step 2: Create D1 Database

```bash
wrangler d1 create threat-intel-db
```

**Expected output:**
```
✅ Successfully created DB 'threat-intel-db'
database_id = "abc123..."
```

**Action Required:**
1. Copy the `database_id` from output
2. Open `wrangler.jsonc`
3. Replace `YOUR_D1_DATABASE_ID` with your actual database ID

---

### Step 3: Initialize Database Schema

```bash
# Initialize local database
wrangler d1 execute threat-intel-db --local --file=./schema.sql

# Initialize production database
wrangler d1 execute threat-intel-db --remote --file=./schema.sql
```

**Expected output:**
```
✅ Executed 15 commands
```

---

### Step 4: Create Vectorize Index

```bash
wrangler vectorize create threat-embeddings --dimensions=768 --metric=cosine
```

**Expected output:**
```
✅ Successfully created index 'threat-embeddings'
```

---

### Step 5: Create KV Namespace

```bash
# Production namespace
wrangler kv:namespace create CACHE

# Preview namespace
wrangler kv:namespace create CACHE --preview
```

**Expected output:**
```
✅ Created namespace CACHE
id = "xyz789..."
preview_id = "abc456..."
```

**Action Required:**
1. Copy both IDs from output
2. Open `wrangler.jsonc`
3. Replace `YOUR_KV_NAMESPACE_ID` with production id
4. Replace `YOUR_KV_PREVIEW_ID` with preview id

---

### Step 6: Verify Configuration

Open `wrangler.jsonc` and ensure all placeholders are replaced:

- [ ] `database_id` is set (not "YOUR_D1_DATABASE_ID")
- [ ] KV `id` is set (not "YOUR_KV_NAMESPACE_ID")
- [ ] KV `preview_id` is set (not "YOUR_KV_PREVIEW_ID")

---

### Step 7: Build the Application

```bash
npm run build
```

**Expected output:**
```
✓ built in XXXms
dist/index.html
dist/assets/...
```

---

### Step 8: Deploy to Cloudflare Pages

```bash
wrangler pages deploy
```

OR

```bash
npm run deploy
```

**Expected output:**
```
✨ Success! Deployed to https://your-app-xyz.pages.dev
```

---

### Step 9: Test the Deployment

1. Open the URL from deployment output
2. You should see the dashboard (it will be empty initially)
3. Test the API endpoints:

```bash
# Replace with your actual URL
curl https://your-app.pages.dev/api/stats
```

---

### Step 10: Wait for First Data Ingestion

The scheduled function runs **every 6 hours**. Options:

**Option A: Wait** (recommended)
- Wait up to 6 hours for automatic ingestion

**Option B: Manual Trigger** (advanced)
1. Go to Cloudflare Dashboard
2. Navigate to Workers & Pages > Your Project
3. Go to Functions tab
4. Find `scheduled` function
5. Click "Send test event"

---

## 🔍 Verification

After data ingestion (6+ hours), verify:

- [ ] Dashboard shows threat counts
- [ ] "All Threats" page shows articles
- [ ] Search works
- [ ] Individual threat details load
- [ ] IOCs are displayed
- [ ] Charts render correctly

---

## 🐛 Common Issues

### Issue: "Database not found"

**Solution:**
```bash
wrangler d1 execute threat-intel-db --remote --file=./schema.sql
```

### Issue: "No threats appearing"

**Cause:** Scheduled function hasn't run yet

**Solution:** Wait for next scheduled run or manually trigger

### Issue: "Vectorize index not found"

**Solution:**
```bash
wrangler vectorize create threat-embeddings --dimensions=768 --metric=cosine
```

### Issue: Build fails

**Solution:**
```bash
rm -rf node_modules dist
npm install
npm run build
```

---

## 📊 Monitoring

View logs in real-time:

```bash
wrangler pages deployment tail
```

Check scheduled function logs:

```bash
wrangler tail
```

---

## 🎉 Next Steps

Once deployed:

1. **Bookmark your dashboard** - Use it daily!
2. **Customize feeds** - Add more sources in `schema.sql`
3. **Set up alerts** - Extend with email/Slack notifications
4. **Share with team** - Send them the URL
5. **Monitor usage** - Check Cloudflare dashboard for metrics

---

## 💡 Pro Tips

- **Custom Domain:** Add a custom domain in Cloudflare Pages settings
- **Faster Updates:** Change cron to `0 */3 * * *` for 3-hour updates
- **Local Testing:** Use `wrangler pages dev` for local development
- **Database Backups:** Use `wrangler d1 export` to backup your data

---

**Need help?** Check the [README.md](./README.md) or [Cloudflare Docs](https://developers.cloudflare.com/)
