# 📁 Project Structure

```
threat-intel-dashboard/
├── functions/                      # Cloudflare Workers Functions (Backend)
│   ├── api/                       # API endpoints
│   │   ├── stats.ts              # Dashboard statistics
│   │   ├── threats.ts            # List threats with filters
│   │   ├── search.ts             # Keyword & semantic search
│   │   ├── sources.ts            # Feed sources list (with caching)
│   │   └── threat/
│   │       └── [id].ts           # Single threat details
│   ├── utils/                     # Utility functions
│   │   ├── rss-parser.ts         # RSS/Atom feed parser
│   │   ├── ai-processor.ts       # Workers AI integration
│   │   └── security.ts           # Security middleware & validation
│   ├── types.ts                   # TypeScript type definitions
│   └── scheduled.ts               # Scheduled feed ingestion (runs every 6 hours)
│
├── src/                           # React Frontend
│   ├── components/
│   │   ├── Dashboard.tsx         # Main dashboard with stats & charts
│   │   ├── ThreatList.tsx        # List of threats with pagination
│   │   ├── ThreatDetail.tsx      # Single threat view with IOCs
│   │   └── SearchBar.tsx         # Search and filter controls
│   ├── utils/
│   │   └── cache.ts              # Client-side caching utility
│   ├── App.tsx                    # Main application component
│   ├── main.tsx                   # React entry point
│   └── index.css                  # Tailwind CSS styles
│
├── public/                        # Static assets
│   └── shield.svg                # App icon
│
├── schema.sql                     # D1 database schema
├── wrangler.jsonc                # Cloudflare configuration
├── package.json                   # Dependencies and scripts
├── vite.config.ts                # Vite build configuration
├── tsconfig.json                  # TypeScript configuration
├── tailwind.config.js            # Tailwind CSS configuration
├── postcss.config.js             # PostCSS configuration
├── .gitignore                    # Git ignore rules
│
├── README.md                      # Main documentation
├── DEPLOYMENT.md                  # Deployment guide
└── PROJECT_STRUCTURE.md          # This file
```

## 🔧 Key Files Explained

### Backend (Functions)

| File | Purpose |
|------|---------|
| `functions/scheduled.ts` | Runs every 6 hours to fetch RSS feeds, process with AI, store in D1 |
| `functions/api/stats.ts` | Returns dashboard statistics (counts, breakdowns, trends) |
| `functions/api/threats.ts` | Returns paginated list of threats with filters |
| `functions/api/search.ts` | Handles keyword and semantic search using Vectorize |
| `functions/api/sources.ts` | Returns list of feed sources from database (server-cached 5 min) |
| `functions/api/threat/[id].ts` | Returns single threat with IOCs and similar threats |
| `functions/utils/rss-parser.ts` | Parses RSS/Atom feeds into structured data |
| `functions/utils/ai-processor.ts` | Interfaces with Workers AI for summarization & embeddings |
| `functions/utils/security.ts` | Rate limiting, security headers, input validation |

### Frontend (React)

| File | Purpose |
|------|---------|
| `src/App.tsx` | Main app with routing and navigation |
| `src/components/Dashboard.tsx` | Stats cards, charts, trending insights (client-cached 5 min) |
| `src/components/ThreatList.tsx` | Scrollable threat cards with filters |
| `src/components/ThreatDetail.tsx` | Full threat view with IOCs (client-cached 15 min) |
| `src/components/SearchBar.tsx` | Search input and filter dropdowns (sources cached 1 hour) |
| `src/utils/cache.ts` | Generalized localStorage cache utility with TTL support |

### Configuration

| File | Purpose |
|------|---------|
| `wrangler.jsonc` | Cloudflare bindings (D1, Vectorize, KV, AI, Analytics) |
| `schema.sql` | Database tables (threats, summaries, IOCs, trends, feeds) |
| `vite.config.ts` | Frontend build configuration |
| `package.json` | Dependencies and NPM scripts |

## 🔄 Data Flow

### Ingestion (Scheduled - Native Cron)

```
Cloudflare Cron Scheduler (every 6 hours)
    ↓
src/worker.ts → scheduled() handler
    ↓
scheduled.ts → onSchedule()
    ↓
Fetches RSS feeds
    ↓
Parses XML with rss-parser.ts
    ↓
For each new article:
    ├─ Store in D1 (threats table)
    ├─ Analyze with Workers AI (Llama 3.3)
    ├─ Store summary in D1 (summaries table)
    ├─ Extract & store IOCs (iocs table)
    └─ Generate embedding & store in Vectorize
```

### User Request Flow

```
User visits dashboard
    ↓
Frontend calls /api/stats
    ↓
stats.ts queries D1 database
    ↓
Returns JSON to frontend
    ↓
Dashboard renders charts & stats
```

### Search Flow

```
User types search query
    ↓
Frontend calls /api/search?q=ransomware&mode=semantic
    ↓
search.ts generates embedding with Workers AI
    ↓
Queries Vectorize for similar vectors
    ↓
Fetches matching threats from D1
    ↓
Returns results to frontend
```

## 📦 Dependencies

### Frontend
- **react** - UI framework
- **react-router-dom** - Client-side routing
- **recharts** - Charts and visualizations
- **date-fns** - Date formatting
- **lucide-react** - Icon library
- **tailwindcss** - CSS framework

### Backend
- **@cloudflare/workers-types** - TypeScript types for Cloudflare Workers APIs
- **fast-xml-parser** - RSS/Atom feed parsing
- No other external dependencies! Everything runs on Cloudflare's platform

### Dev Tools
- **vite** - Frontend build tool
- **typescript** - Type safety
- **wrangler** - Cloudflare CLI

## 🎯 NPM Scripts

```bash
npm run dev          # Start Wrangler dev server (Workers + React)
npm run build        # Build React app + compile Pages Functions to _worker.js
npm run preview      # Preview production build locally
npm run deploy       # Build and deploy to Cloudflare Workers
npm run typecheck    # Run TypeScript type checking
npm run cf-typegen   # Generate TypeScript types for bindings
```

**Note:** Database and Vectorize operations use `wrangler` directly (not npm scripts).

```bash
# Database operations
npx wrangler d1 create threat-intel-db
npx wrangler d1 execute threat-intel-db --remote --file=./schema.sql

# Vectorize operations
npx wrangler vectorize create threat-embeddings --dimensions=1024 --metric=cosine
npx wrangler vectorize list

# KV operations
npx wrangler kv namespace create CACHE
npx wrangler kv namespace list
```

## 🔌 Cloudflare Bindings

| Binding | Type | Purpose |
|---------|------|---------|
| `DB` | D1Database | SQL database for threats, summaries, IOCs |
| `AI` | Ai | Workers AI for LLM and embeddings |
| `VECTORIZE_INDEX` | VectorizeIndex | Vector search for semantic similarity |
| `CACHE` | KVNamespace | Cache for rate limiting and feed ETags |
| `ANALYTICS` | AnalyticsEngineDataset | Time-series metrics |

## 🗄️ Database Tables

| Table | Purpose |
|-------|---------|
| `threats` | Raw articles from feeds |
| `summaries` | AI-generated summaries and categorization |
| `iocs` | Extracted indicators of compromise |
| `categories` | Threat categories (ransomware, APT, etc.) |
| `trends` | Weekly trend analysis |
| `feed_sources` | RSS feed configuration |
| `bookmarks` | User saved threats (future feature) |
| `search_history` | Search analytics |

## 🎨 UI Components Hierarchy

```
App
├── Header (navigation)
├── Main Content
│   ├── Dashboard (default view)
│   │   ├── Stats Cards (3 cards)
│   │   ├── AI Trends Section
│   │   ├── Category Chart (Pie)
│   │   ├── Severity Chart (Bar)
│   │   └── Top Sources List
│   │
│   ├── Threats View
│   │   ├── SearchBar
│   │   │   ├── Search Input
│   │   │   └── Filters (category, severity, source)
│   │   └── ThreatList
│   │       ├── Threat Cards (clickable)
│   │       └── Pagination
│   │
│   └── Detail View
│       └── ThreatDetail
│           ├── Header (title, severity, metadata)
│           ├── TL;DR Section
│           ├── Key Points
│           ├── IOCs Section (by type)
│           └── Similar Threats
│
└── Footer
```

## 🔐 Security Notes

- All AI processing happens on Cloudflare's edge (privacy-first)
- No external API calls from frontend (server-side only)
- Feed URLs are validated before fetching
- Rate limiting via KV prevents abuse
- SQL injection protection via prepared statements
- XSS protection via React's escaping

## 🚀 Performance Optimizations

### Server-Side Caching
- Vector embeddings cached in Vectorize for instant semantic search
- Feed results cached in KV for 6 hours
- API responses cached via Cache-Control headers (5 min)
- Rate limiting via KV prevents abuse

### Client-Side Caching (localStorage)
- **Feed sources**: 1 hour TTL - rarely change, loaded once per session
- **Dashboard stats**: 5 min TTL - balance between freshness and performance
- **Threat details**: 15 min TTL - immutable once ingested, safe to cache
- **Reusable cache utility** (`src/utils/cache.ts`) with TTL, invalidation, and stats

### Database & Code
- D1 indexes on commonly queried fields
- Prepared statements prevent SQL injection
- Frontend code-split by route
- Lazy loading for charts
- Pagination prevents large data transfers

## 💾 Client-Side Cache Utility

The `src/utils/cache.ts` utility provides a reusable, DRY-compliant caching layer for API requests.

### Core Functions

**`fetchWithCache<T>(key, fetcher, options)`** - Main caching function
```typescript
import { fetchWithCache, CacheTTL } from '../utils/cache';

const data = await fetchWithCache(
  'dashboard-stats',                    // Unique cache key
  async () => {                         // Fetcher function
    const res = await fetch('/api/stats');
    return res.json();
  },
  { ttl: CacheTTL.FIVE_MINUTES, keyPrefix: 'threat-intel' }
);
```

**`invalidateCache(key, prefix)`** - Clear specific cache entry
```typescript
import { invalidateCache } from '../utils/cache';

invalidateCache('dashboard-stats', 'threat-intel');
```

**`clearCacheByPrefix(prefix)`** - Clear all cache with prefix
```typescript
import { clearCacheByPrefix } from '../utils/cache';

clearCacheByPrefix('threat-intel');  // Clear all app cache
```

**`getCacheStats(prefix)`** - Monitor cache usage
```typescript
import { getCacheStats } from '../utils/cache';

const stats = getCacheStats('threat-intel');
// Returns: { totalEntries, totalSize, entries: [{key, age, size}] }
```

### Predefined TTL Constants

```typescript
CacheTTL.ONE_MINUTE      // 60 seconds
CacheTTL.FIVE_MINUTES    // 5 minutes
CacheTTL.TEN_MINUTES     // 10 minutes
CacheTTL.FIFTEEN_MINUTES // 15 minutes
CacheTTL.THIRTY_MINUTES  // 30 minutes
CacheTTL.ONE_HOUR        // 1 hour
CacheTTL.ONE_DAY         // 24 hours
```

### Cache Storage Format

All caches use localStorage with prefix `threat-intel:`:

```
threat-intel:sources           → Feed sources (1 hour)
threat-intel:dashboard-stats   → Dashboard stats (5 min)
threat-intel:threat-{id}       → Individual threats (15 min)
```

### Example Usage in Components

```typescript
// Dashboard.tsx - Cache stats for 5 minutes
const stats = await fetchWithCache(
  'dashboard-stats',
  async () => fetch('/api/stats').then(r => r.json()),
  { ttl: CacheTTL.FIVE_MINUTES, keyPrefix: 'threat-intel' }
);

// ThreatDetail.tsx - Cache individual threat for 15 minutes
const threat = await fetchWithCache(
  `threat-${threatId}`,
  async () => fetch(`/api/threat/${threatId}`).then(r => r.json()),
  { ttl: CacheTTL.FIFTEEN_MINUTES, keyPrefix: 'threat-intel' }
);

// SearchBar.tsx - Cache sources for 1 hour
const sources = await fetchWithCache(
  'sources',
  async () => fetch('/api/sources').then(r => r.json()),
  { ttl: CacheTTL.ONE_HOUR, keyPrefix: 'threat-intel' }
);
```

### Benefits
- **DRY principle**: Single source of truth for caching logic
- **Type-safe**: Full TypeScript support with generics
- **Automatic expiry**: TTL-based cache invalidation
- **Error handling**: Graceful degradation if localStorage unavailable
- **Developer tools**: Cache stats and manual invalidation

---

**Happy hacking!** 🛡️
