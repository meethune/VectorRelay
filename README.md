# 🛡️ Threat Intelligence Dashboard

A real-time threat intelligence aggregation and analysis platform powered by Cloudflare Workers AI, D1, Vectorize, and Pages.

## ✨ Features

- **🤖 AI-Powered Analysis**: Automatic summarization and categorization using Llama 3.3 (70B)
- **🔍 Semantic Search**: Find related threats using vector embeddings
- **📊 Trend Detection**: Weekly AI-generated threat trend analysis
- **🎯 IOC Extraction**: Automatic extraction of IPs, domains, CVEs, hashes
- **📡 Auto-Ingestion**: Scheduled fetching from 7+ reputable security feeds
- **⚡ Real-time Updates**: Dashboard updates every 6 hours
- **🎨 Modern UI**: Responsive React dashboard with charts and visualizations
- **💰 100% Free Tier**: Runs entirely on Cloudflare's free tier

## 🏗️ Architecture

```
Frontend (React + Vite)
    ↓
Pages Functions (API Routes)
    ↓
├─ Workers AI (Summarization + Embeddings)
├─ D1 (SQLite Database)
├─ Vectorize (Vector Search)
├─ KV (Caching)
└─ Analytics Engine (Metrics)
```

## 📋 Prerequisites

- [Node.js](https://nodejs.org/) 18+ installed
- [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) installed

```bash
npm install -g wrangler
```

## 🚀 Quick Start

### 1. Clone and Install

```bash
cd /home/izaak/Projects/playground01
npm install
```

### 2. Authenticate with Cloudflare

```bash
wrangler login
```

### 3. Create D1 Database

```bash
# Create the database
wrangler d1 create threat-intel-db

# Copy the database_id from output and update wrangler.jsonc
# Replace YOUR_D1_DATABASE_ID with the actual ID
```

Initialize the database schema:

```bash
# Local development
wrangler d1 execute threat-intel-db --local --file=./schema.sql

# Production
wrangler d1 execute threat-intel-db --remote --file=./schema.sql
```

### 4. Create Vectorize Index

```bash
wrangler vectorize create threat-embeddings --dimensions=768 --metric=cosine
```

### 5. Create KV Namespace

```bash
# Create KV namespace for production
wrangler kv:namespace create CACHE

# Create KV namespace for preview/development
wrangler kv:namespace create CACHE --preview

# Update wrangler.jsonc with the IDs returned
```

### 6. Update Configuration

Edit `wrangler.jsonc` and replace placeholders:

- `YOUR_D1_DATABASE_ID` - from step 3
- `YOUR_KV_NAMESPACE_ID` - from step 5 (production)
- `YOUR_KV_PREVIEW_ID` - from step 5 (preview)

### 7. Build and Deploy

```bash
# Build the React frontend
npm run build

# Deploy to Cloudflare Pages
npm run deploy
```

### 8. Set up Scheduled Triggers

After first deployment, enable the scheduled trigger:

```bash
# The cron schedule is already in wrangler.jsonc (every 6 hours)
# Verify it's working in the Cloudflare dashboard:
# Workers & Pages > Your Project > Settings > Triggers
```

## 🧪 Local Development

```bash
# Start Vite dev server for frontend
npm run dev

# In another terminal, start Wrangler for Functions
wrangler pages dev dist --live-reload
```

Access the app at `http://localhost:8788`

## 📊 Data Sources

The dashboard automatically ingests from these public feeds:

1. **CISA Alerts** - US Cybersecurity alerts
2. **Krebs on Security** - Brian Krebs security blog
3. **BleepingComputer** - Security news
4. **The Hacker News** - Cybersecurity news
5. **SANS ISC** - Internet Storm Center
6. **Schneier on Security** - Bruce Schneier's blog
7. **Dark Reading** - Enterprise security news

### Adding More Feeds

Edit the database directly or add to `schema.sql`:

```sql
INSERT INTO feed_sources (name, url, type, enabled) VALUES
  ('Your Feed Name', 'https://example.com/feed.xml', 'rss', 1);
```

Then re-run the migration:

```bash
wrangler d1 execute threat-intel-db --remote --file=./schema.sql
```

## 🔧 Configuration

### Environment Variables

Set secrets using Wrangler:

```bash
# If you want to add API keys for paid services (optional)
wrangler secret put ALIENVAULT_API_KEY
wrangler secret put ABUSEIPDB_API_KEY
```

### Scheduled Frequency

Edit `wrangler.jsonc` to change ingestion frequency:

```jsonc
"triggers": {
  "crons": [
    "0 */6 * * *"  // Every 6 hours
    // "0 */3 * * *"  // Every 3 hours
    // "0 * * * *"    // Every hour
  ]
}
```

## 📖 API Endpoints

- `GET /api/stats` - Dashboard statistics
- `GET /api/threats` - List threats with pagination and filters
- `GET /api/threat/:id` - Get threat details with IOCs
- `GET /api/search?q=ransomware&mode=semantic` - Search threats

### Example API Usage

```bash
# Get dashboard stats
curl https://your-app.pages.dev/api/stats

# Search for ransomware threats
curl https://your-app.pages.dev/api/search?q=ransomware&mode=semantic

# Get threats by category
curl https://your-app.pages.dev/api/threats?category=apt&severity=critical
```

## 🎨 Customization

### UI Theme

Edit `src/index.css` to customize colors:

```css
:root {
  color-scheme: dark;
  background-color: #0f172a; /* Change to your preferred color */
}
```

### Severity Colors

Edit `tailwind.config.js`:

```js
theme: {
  extend: {
    colors: {
      critical: '#dc2626',  // Customize colors
      high: '#f59e0b',
      // ...
    },
  },
}
```

## 🔒 Security Considerations

- All AI processing happens on Cloudflare's edge (data doesn't leave CF network)
- No external API keys required for basic functionality
- RSS feeds are fetched server-side (no client-side requests)
- Rate limiting via KV cache prevents feed abuse
- CORS is automatically handled by Pages Functions

## 📊 Free Tier Limits

| Resource | Free Tier | Estimated Usage |
|----------|-----------|-----------------|
| Pages Requests | Unlimited | ✅ |
| Functions Requests | 100k/day | ~5k/day |
| Workers AI | 10k neurons/day | ~3k neurons/day |
| D1 Reads | 5M/day | ~50k/day |
| D1 Writes | 100k/day | ~500/day |
| D1 Storage | 5GB | ~100MB |
| Vectorize | Free (beta) | ✅ |
| KV Reads | 100k/day | ~5k/day |

**Result:** Stays well within free tier limits! 🎉

## 🐛 Troubleshooting

### Database not initialized

```bash
wrangler d1 execute threat-intel-db --remote --file=./schema.sql
```

### No threats appearing

Manually trigger the scheduled function:

```bash
wrangler pages deployment tail
```

Or wait for the next scheduled run (every 6 hours).

### Build errors

Clear cache and rebuild:

```bash
rm -rf node_modules dist
npm install
npm run build
```

## 📚 Learn More

- [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/)
- [D1 Database](https://developers.cloudflare.com/d1/)
- [Vectorize](https://developers.cloudflare.com/vectorize/)
- [Pages Functions](https://developers.cloudflare.com/pages/functions/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)

## 🤝 Contributing

This is a starter template. Feel free to:

- Add more threat intelligence feeds
- Implement email/Slack alerts
- Add export to STIX format
- Integrate with SIEM platforms
- Build custom dashboards
- Add user authentication

## 📄 License

MIT License - feel free to use for personal or commercial projects

---

**Built with ❤️ using Cloudflare's developer platform**

Need help? Check the [Cloudflare Discord](https://discord.gg/cloudflaredev) or [Community Forum](https://community.cloudflare.com/)
