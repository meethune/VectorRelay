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
│   │   ├── ai-processor.ts       # Workers AI integration
│   │   ├── ai-response-parser.ts # Unified AI response parsing
│   │   ├── logger.ts             # Structured logging utilities
│   │   ├── response-helper.ts    # Standardized API responses
│   │   ├── rss-parser.ts         # RSS/Atom feed parser
│   │   ├── security.ts           # Security middleware & validation
│   │   ├── text.ts               # Text processing utilities
│   │   └── validation.ts         # Generic validation utilities
│   ├── constants.ts               # Shared constants (categories, severities, AI models)
│   ├── types.ts                   # TypeScript type definitions
│   └── scheduled.ts               # Scheduled feed ingestion (runs every 6 hours)
│
├── src/                           # React Frontend
│   ├── components/
│   │   ├── common/               # Shared reusable components
│   │   │   ├── LoadingState.tsx  # Theme-aware loading component
│   │   │   └── EmptyState.tsx    # Theme-aware empty state component
│   │   ├── ui/                   # Magic UI component library (15 components)
│   │   │   ├── border-beam.tsx          # Animated border effect
│   │   │   ├── neon-gradient-card.tsx   # Neon gradient border card
│   │   │   ├── shine-border.tsx         # Animated shine border
│   │   │   ├── particles.tsx            # Canvas-based particle animation
│   │   │   ├── dot-pattern.tsx          # SVG dot pattern background
│   │   │   ├── grid-pattern.tsx         # SVG grid pattern background
│   │   │   ├── number-ticker.tsx        # Animated number counting
│   │   │   ├── magic-card.tsx           # Interactive spotlight card
│   │   │   ├── ripple.tsx               # Ripple animation effect
│   │   │   ├── retro-grid.tsx           # 3D perspective grid (terminal theme)
│   │   │   ├── flickering-grid.tsx      # Dynamic flickering grid (terminal theme)
│   │   │   ├── animated-grid-pattern.tsx # Animated square patterns
│   │   │   ├── text-animate.tsx         # Text animation effects
│   │   │   ├── hyper-text.tsx           # Glitch/scramble text effect
│   │   │   └── terminal.tsx             # Dedicated terminal UI
│   │   ├── Dashboard.tsx         # Main dashboard with stats & charts
│   │   ├── ThreatList.tsx        # List of threats with pagination
│   │   ├── ThreatDetail.tsx      # Single threat view with IOCs
│   │   ├── SearchBar.tsx         # Search and filter controls
│   │   └── ThemeToggle.tsx       # Theme switcher component
│   ├── contexts/
│   │   └── ThemeContext.tsx      # Theme state management (terminal/business)
│   ├── constants/
│   │   └── theme.ts              # Theme color schemes and UI constants
│   ├── hooks/
│   │   └── useThemeClasses.ts    # Theme-aware CSS class hook
│   ├── utils/
│   │   └── cache.ts              # Client-side caching utility
│   ├── App.tsx                    # Main application component
│   ├── main.tsx                   # React entry point
│   └── index.css                  # Tailwind CSS styles & theme definitions
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

**Core:**

| File | Purpose |
|------|---------|
| `functions/constants.ts` | Shared constants (threat categories, severities, AI models) |
| `functions/types.ts` | TypeScript type definitions |
| `functions/scheduled.ts` | Runs every 6 hours to fetch RSS feeds, process with AI, store in D1 |

**API Endpoints:**

| File | Purpose |
|------|---------|
| `functions/api/stats.ts` | Returns dashboard statistics (counts, breakdowns, trends) |
| `functions/api/threats.ts` | Returns paginated list of threats with filters |
| `functions/api/search.ts` | Handles keyword and semantic search using Vectorize |
| `functions/api/sources.ts` | Returns list of feed sources from database (server-cached 5 min) |
| `functions/api/threat/[id].ts` | Returns single threat with IOCs and similar threats |

**Utilities:**

| File | Purpose |
|------|---------|
| `functions/utils/ai-processor.ts` | Interfaces with Workers AI for summarization & embeddings |
| `functions/utils/ai-response-parser.ts` | Unified parsing for AI responses (handles 3 response formats) |
| `functions/utils/logger.ts` | Structured JSON logging (logError, logWarning, logInfo, logDebug) |
| `functions/utils/response-helper.ts` | Standardized API response creation with headers |
| `functions/utils/rss-parser.ts` | Parses RSS/Atom feeds into structured data |
| `functions/utils/security.ts` | Rate limiting, security headers, input validation |
| `functions/utils/text.ts` | Text processing (truncate, count words, extract sentences) |
| `functions/utils/validation.ts` | Generic validators with TypeScript type guards |

### Frontend (React)

**Core Components:**

| File | Purpose |
|------|---------|
| `src/App.tsx` | Main app with routing and navigation |
| `src/components/Dashboard.tsx` | Stats cards, charts, trending insights (client-cached 5 min) |
| `src/components/ThreatList.tsx` | Scrollable threat cards with filters |
| `src/components/ThreatDetail.tsx` | Full threat view with IOCs (client-cached 15 min) |
| `src/components/SearchBar.tsx` | Search input and filter dropdowns (sources cached 1 hour) |

**Shared Components:**

| File | Purpose |
|------|---------|
| `src/components/common/LoadingState.tsx` | Reusable theme-aware loading component |
| `src/components/common/EmptyState.tsx` | Reusable theme-aware empty state component |

**Theme System:**

| File | Purpose |
|------|---------|
| `src/contexts/ThemeContext.tsx` | Theme state management (terminal/business modes) |
| `src/components/ThemeToggle.tsx` | Theme switcher UI component |
| `src/components/ui/*` | 15 Magic UI components for animations & effects |

**Hooks:**

| File | Purpose |
|------|---------|
| `src/hooks/useThemeClasses.ts` | Pre-composed theme-aware CSS classes (12 variants) |

**Constants & Utilities:**

| File | Purpose |
|------|---------|
| `src/constants/theme.ts` | Theme color schemes (severity colors, category colors) |
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
- **framer-motion** - Animation library (powers Magic UI components)
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

## 📐 Code Quality & DRY Principles

The codebase follows DRY (Don't Repeat Yourself) principles to minimize code duplication and improve maintainability.

### Centralized Constants

**`functions/constants.ts`** - Single source of truth for shared constants:
- `THREAT_CATEGORIES` - 10 threat categories (used in frontend dropdowns, backend validation, AI prompts)
- `THREAT_SEVERITIES` - 5 severity levels (used in badges, filters, database queries)
- `AI_MODELS` - AI model configuration (TEXT_GENERATION, EMBEDDINGS)
- TypeScript types exported: `ThreatCategory`, `ThreatSeverity`

**`src/constants/theme.ts`** - Centralized theme configuration:
- `SEVERITY_COLORS` - Maps severity levels to Tailwind CSS classes
- `CATEGORY_COLORS` - Color schemes for terminal and business themes

### Shared UI Components

**LoadingState & EmptyState** - Consistent UI patterns across all views:
- Theme-aware (automatically adapts to terminal/business theme)
- Optional customization (messages, icons, className)
- Used in Dashboard, ThreatList, ThreatDetail

**useThemeClasses Hook** - Pre-composed CSS classes:
- 12 variants: input, button, card, text, link, badge, etc.
- Eliminates 50+ duplicate className patterns
- Ensures consistent styling across components

### Utility Libraries

**Backend Utilities:**
- `logger.ts` - Structured JSON logging with context
- `text.ts` - Text processing (truncate, count words)
- `response-helper.ts` - Standardized API responses with headers
- `ai-response-parser.ts` - Unified AI response parsing (3 formats)
- `validation.ts` - Generic validators with TypeScript type guards

**Benefits:**
- ~244 lines of duplicate code eliminated
- Code duplication reduced from 18% to ~10%
- Improved type safety with type guards
- Consistent error logging and validation
- Single source of truth for all shared logic

For full details, see: `docs/DRY_REFACTORING_FINAL_REPORT.md`

## 🎨 Dual-Theme System

The dashboard features a sophisticated dual-theme system with two distinct visual modes:

### Theme Modes

**Terminal Theme (Retro CRT)**:
- Classic green-on-black (#00ff00 on #000000)
- Monospace fonts (Share Tech Mono, VT323)
- CRT scanline effects and screen glow
- RetroGrid 3D perspective background
- FlickeringGrid animations on stat cards
- HyperText glitch effects for emphasis
- Authentic terminal aesthetic

**Business Theme (Cybersecurity Professional)**:
- Deep navy backgrounds (#0a0e1a)
- Bright blue (#3b82f6) and purple (#8b5cf6) accents
- Particle effects and gradient animations
- BorderBeam animated borders
- NumberTicker smooth number animations
- MagicCard spotlight effects
- Modern, professional aesthetic

### Magic UI Component Library

15 components installed via shadcn CLI from magicui.design:

**Background Effects:**
- `retro-grid` - 3D perspective grid (terminal theme)
- `flickering-grid` - Dynamic flickering grid (terminal theme)
- `animated-grid-pattern` - Animated square patterns
- `dot-pattern` - SVG dot pattern backgrounds
- `grid-pattern` - SVG grid pattern backgrounds

**Visual Effects:**
- `border-beam` - Animated border gradients (business theme)
- `neon-gradient-card` - Neon border cards
- `shine-border` - Animated shine effects
- `magic-card` - Interactive spotlight cards (business theme)

**Animation Components:**
- `particles` - Canvas-based particle system (business theme)
- `number-ticker` - Animated number counting (both themes)
- `text-animate` - Text animation effects (both themes)
- `hyper-text` - Glitch/scramble text (terminal theme)

**Special Components:**
- `ripple` - Ripple animation effects
- `terminal` - Dedicated terminal UI component

### Theme Implementation

**Theme State**: Managed by `ThemeContext` (React Context API)
**Persistence**: Theme preference saved to localStorage
**Switching**: Seamless toggle via `ThemeToggle` component
**Performance**: Conditional rendering prevents unnecessary component loads

### Color System

All colors defined in `tailwind.config.js` with theme-specific prefixes:
- `terminal-*` - Terminal theme colors
- `business-*` - Business theme colors

Threat severity colors mapped in `src/constants/theme.ts`:
- Critical: Red (#dc2626)
- High: Orange (#ea580c)
- Medium: Amber (#f59e0b)
- Low: Green (#22c55e)
- Info: Blue (#3b82f6)

For complete theme documentation, see: `docs/THEME_REFACTOR_REPORT.md`

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
