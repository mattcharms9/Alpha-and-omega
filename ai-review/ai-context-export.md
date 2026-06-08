# AI Context Export — Alpha & Omega

**Safe for external sharing. Contains zero secrets, credentials, or sensitive data.**

This document gives any AI system or engineer enough context to immediately operate as a senior engineer on this project.

---

## 1. Repository Overview

Alpha & Omega is a Next.js 16 full-stack web application. It is an **AI-powered publishing and emotional utility platform** — a tool for discovering high-value emotional pain points in the self-improvement market, generating transformation products (journals, planners, workbooks), creating viral social content, and publishing across e-commerce platforms.

The platform has **14 AI engines** backed by Claude (Anthropic) API calls that return structured JSON. The UI is a dark luxury dashboard aesthetic with Framer Motion animations.

**Current status (Session 007):** Core platform is fully operational. Batch generation with SSE streaming is live. Gumroad and Pinterest integrations are live. The two remaining critical gaps are PDF generation (blocks Etsy) and Etsy OAuth + publisher. NextAuth is wired but login/signup UI pages don't exist yet.

---

## 2. Core Architecture

```
Next.js App Router (v16.2.6)
├── src/proxy.ts (NOT middleware.ts) — auth + API versioning middleware
│     ├── Validates x-api-key header on all /api/* routes
│     ├── Exempts: /api/auth/*, /api/cron/*, /api/gumroad/webhook, Pinterest OAuth callback
│     └── Rewrites /api/v1/* → /api/* (versioned API support, ADR-028)
│
├── Client Components ("use client") — all pages except /portfolio
├── React Server Component — /portfolio (direct Prisma queries, no API roundtrip)
│
├── Route Handlers — 22 routes across /api/*
│
└── AI Layer — src/lib/ai/ (14 engine files + Claude wrapper)
    └── Anthropic SDK → claude-sonnet-4-6 (configurable via ANTHROPIC_MODEL env)
        ├── Prompt caching (cache_control: ephemeral on system prompts)
        ├── Retry logic (withRetry<T>() — exponential backoff, 3 attempts)
        └── Structured cost logging (logAICall() per call)

Database: SQLite (dev) via @prisma/adapter-better-sqlite3 → PostgreSQL (prod-ready)
ORM: Prisma 7 (config in prisma.config.ts, not schema.prisma)
Email: Resend SDK (sale alerts + daily brief)
Image Generation: OpenAI API (DALL-E 3)
State: Zustand (active-product store, cross-engine workflow)
Validation: Zod v4
Auth: NextAuth v5 beta (credentials provider, JWT strategy)
```

**Request flow:** User action → `apiFetch()` in page (auto-adds x-api-key header) → `src/proxy.ts` auth check → `/api/[domain]/route.ts` → Zod validate → `rateLimit(req, { limit: N, windowMs })` → engine file → `claude.ts::generateJSON<T>()` → Anthropic API → parse → Prisma save → return typed data.

**SSE batch flow:** `BatchView.tsx` → `fetch /api/products/batch` → `TransformStream` route → `Promise.allSettled` (4 non-bundle slots parallel) → bundle slot sequential → `send({ type: "product_complete" })` per slot → `batch_complete` → client `getReader()` loop updates UI as each product finishes.

---

## 3. Main Technologies

| Technology | Version | Role |
|-----------|---------|------|
| Next.js | 16.2.6 | Framework (App Router) |
| React | 19.2.4 | UI |
| TypeScript | 5 | Language (strict mode) |
| Tailwind CSS | 4 | Utility classes (minimal — CSS vars preferred) |
| Framer Motion | 12 | Animations |
| Prisma | 7.8.0 | ORM (better-sqlite3 adapter in dev) |
| @anthropic-ai/sdk | 0.98.0 | AI — Claude calls |
| openai | 6.x | DALL-E 3 cover image generation |
| resend | 6.x | Transactional email |
| next-auth | 5.0.0-beta | Authentication |
| Recharts | 3.8.1 | Portfolio charts |
| Zod | 4.4.3 | Validation |
| Zustand | 5.0.13 | Cross-engine state (active-product store) |
| lru-cache | 11.x | In-memory rate limiter store |
| lucide-react | 1.16.0 | Icons |

---

## 4. Coding Standards (Summary)

- **TypeScript strict mode** — always on, no `any`, no implicit `any`
- **Zod validation** — all API route bodies validated before use (schemas at module scope)
- **CSS variables** — no hardcoded hex colors in components (exception: Recharts config)
- **Error handling** — `toSafeErrorMessage(error)` on all route catch blocks
- **Rate limiting** — `rateLimit(req, { limit, windowMs })` on every AI-calling route
- **Prisma Json type** — all array/object fields use `Json` type, never `JSON.stringify`
- **Naming** — PascalCase components/types, camelCase functions/variables, kebab-case routes/CSS vars
- **File size limits** — routes ≤80 lines, AI engines ≤200 lines, pages ≤600 lines, UI components ≤250 lines

Full standards: see `standards.md`

---

## 5. Preferred Patterns

1. **Typed AI outputs** — define interface for every JSON response, use `generateJSON<Interface>()`
2. **Module-scope system prompts** — `const SYSTEM_PROMPT = ...` at top of each engine file
3. **Action dispatch** — `POST /api/domain?action=verb` not separate endpoints
4. **Response envelope** — always `{ success: boolean, data?: T, error?: string }`
5. **CSS variable references** — `style={{ color: "var(--gold)" }}`
6. **SSE streaming** — `TransformStream` + `void (async () => { ... })()` for batch routes
7. **Client-safe type extraction** — when client components need types from AI engine files, extract to a separate `*-types.ts` file that doesn't import `claude.ts` (prevents Anthropic SDK from bleeding into client bundle)
8. **useMemo for stable fetch headers** — `const headers = useMemo(() => ({ ... }), [dep])` in components that pass headers to `useCallback`
9. **Prisma singleton** — always `import { prisma } from "@/lib/db/prisma"`, never instantiate directly
10. **apiFetch for client calls** — use `import { apiFetch } from "@/lib/api"` in client components (auto-adds x-api-key)
11. **Non-fatal side effects** — wrap non-critical operations (email alerts, pin creation, analytics sync) in try/catch that swallows errors and never re-throws
12. **Staggered animations** — `delay: index * 0.06` for list items

Full patterns: see `preferred-patterns.md`

---

## 6. Banned Patterns

1. Hardcoded secrets in source code
2. Logging env var values
3. Raw `error.message` to client (use `toSafeErrorMessage()`)
4. Direct `new PrismaClient()` outside singleton
5. Unvalidated request bodies
6. AI logic inside route handlers
7. Server-only imports in `"use client"` files (especially `@anthropic-ai/sdk`, `prisma`)
8. Hardcoded hex colors in components
9. `any` type
10. Unhandled promise rejections
11. `JSON.stringify()` before saving to Prisma Json column (pass objects directly)
12. Zod v3 API in a v4 codebase (`.errors` → `.issues`, `z.record(z.string(), z.unknown())`)

Full list: see `banned-patterns.md`

---

## 7. Folder Structure

```
src/
├── proxy.ts                    Auth middleware + API v1 versioning (NOT middleware.ts)
├── app/
│   ├── layout.tsx              Root layout — Sidebar + CommandPalette
│   ├── error.tsx               Root error boundary
│   ├── page.tsx                Dashboard
│   ├── intelligence/           Emotional Intelligence Engine
│   ├── brands/                 Brand Builder
│   ├── signals/                Signal Bank
│   ├── products/               Product Engine (batch-first, SSE)
│   ├── content/                Content Distribution Engine
│   ├── portfolio/              Portfolio Intelligence (RSC — direct Prisma)
│   ├── publishing/             Publishing Engine + Pinterest panel
│   ├── settings/               Configuration
│   └── api/                    22 route handlers
│
├── components/
│   ├── layout/Sidebar.tsx + CommandPalette.tsx
│   ├── ui/Card.tsx + Badge.tsx + Button.tsx + PageHeader.tsx
│   ├── portfolio/PortfolioCharts.tsx    (Recharts client island)
│   ├── publishing/PinterestPanel.tsx
│   └── products/BlueprintView.tsx + BatchView.tsx
│
└── lib/
    ├── utils.ts / errors.ts / rate-limit.ts / api.ts / logger.ts
    ├── ai/                     14 engine files + claude.ts + mix-types.ts
    ├── analytics/revenue-aggregator.ts
    ├── auth/config.ts          NextAuth config
    ├── db/prisma.ts + soft-delete.ts
    ├── integrations/gumroad.ts + pinterest.ts
    ├── notifications/email.ts  (Resend)
    ├── promotions/auto-promote.ts
    └── stores/active-product.ts (Zustand)
```

---

## 8. API Structure

All AI endpoints follow this pattern:

```
POST /api/[domain]?action=[verb]
GET  /api/[domain]?action=[verb]   (read-only operations)
Content-Type: application/json
x-api-key: [REDACTED_API_KEY]    (required on all routes except exempted paths)

Response 200: { success: true, data: T }
Response 400: { success: false, error: "Invalid request" }
Response 429: { success: false, error: "Too many requests.", retryAfter: N }
Response 500: { success: false, error: "Service temporarily unavailable" }
```

### Full Endpoint Table

| Endpoint | Method | Actions / Notes |
|----------|--------|-----------------|
| `/api/intelligence` | POST | `scan` (default), `score` |
| `/api/signals` | POST | `bank`, `activate`, `territory-map`, `update-scores` |
| `/api/market-research` | POST | Market snapshot + action plan |
| `/api/competitors` | POST | `analyze`, `list`, `delete` |
| `/api/products` | POST | `generate` (default), `variants`, `batch-plan` |
| `/api/products/batch` | POST | SSE streaming — 5-product batch, rate 3/min |
| `/api/products/daily-log` | GET | `?date=YYYY-MM-DD` — daily batch progress |
| `/api/content` | POST | `batch` (default), `hooks` |
| `/api/generate-image` | POST | DALL-E 3 cover art direction → image |
| `/api/brands` | POST | `generate`, `list`, `delete`, `set-active` |
| `/api/variants` | POST | `generate`, `list`, `record-impression`, `record-click`, `declare-winner` |
| `/api/gumroad` | POST | `create`, `publish`, `unpublish`, `sync`, `products` |
| `/api/gumroad/webhook` | POST | Gumroad sale webhook → RevenueRecord + alert |
| `/api/pinterest` | GET/POST | `connect`, `callback`, `status`, `boards`, `set-board`, `disconnect` |
| `/api/pinterest/pin` | POST | `create`, `auto-pin`, `queue`, `sync-analytics` |
| `/api/pinterest/queue` | GET | List pin queue items |
| `/api/portfolio` | GET | Aggregated live data — products, revenue, content |
| `/api/performance` | POST | `record`, `query` |
| `/api/empire` | GET | `state`, `brief` (3 parallel Claude calls) |
| `/api/auth/[...nextauth]` | GET/POST | NextAuth credentials + OAuth handlers |
| `/api/cron/daily-brief` | GET | 8am UTC — generates empire brief + email |
| `/api/cron/process-pin-queue` | GET | Every 30min — publishes queued pins |

**Versioning:** All routes also accessible via `/api/v1/*` which rewrites to `/api/*` via proxy.ts.

**Cron auth:** Cron routes are exempted from x-api-key middleware. Each cron route verifies `x-cron-secret` header directly.

---

## 9. Database Schema Summary (18 Models)

```
User                  — Auth (NextAuth JWT strategy; Prisma adapter not yet added)
EmotionalTrend        — Discovered market trends with scores; soft delete
Product               — Generated product blueprints; all complex fields Json; soft delete
  → relations: ContentPiece[], ListingVariant[], PinterestPin[], PinQueue[]
ContentPiece          — Social content pieces; linked to Product optionally; soft delete
RevenueRecord         — Sales/revenue tracking by platform and date
Portfolio             — Aggregate portfolio tracking by emotional category
Brand                 — Full Brand Bible; all strategy fields as Json; soft delete
  → relations: Campaign[], BankedSignal[]
Campaign              — Campaigns linked to brands
EmotionalSignal       — Raw signals from market scanning
BankedSignal          — Curated signals with freshness/rarity/opportunity scores; soft delete
StrategicAlert        — Dashboard alerts (sale, opportunity, risk)
CompetitorProfile     — Competitor analysis snapshots
PerformanceMetric     — Generic metric tracking (entityType + entityId pattern)
ListingVariant        — A/B test variants for product listings (Gumroad/Etsy)
DailyBatchLog         — Daily batch generation progress (@@unique date)
PinterestConnection   — Pinterest OAuth tokens + board selection
PinterestPin          — Pin records with analytics (saves/clicks/impressions)
PinQueue              — Scheduled pins (status: queued/published/failed/cancelled)
```

**Schema rules:**
- All array/object fields use `Json` type (Prisma handles serialization)
- Soft delete: `deletedAt DateTime?` on Product, Brand, ContentPiece, EmotionalTrend, BankedSignal
- All major models have `@@index` on high-cardinality query fields
- No JSON.stringify/parse in application code — pass objects directly to Prisma Json fields

---

## 10. AI Engines (14 files in `src/lib/ai/`)

| File | Exports | Purpose |
|------|---------|---------|
| `claude.ts` | `generateJSON<T>()`, `generateWithClaude()` | SDK wrapper — caching, retry, cost logging |
| `mix-types.ts` | `PRICING_TIERS`, `BatchSlot`, `BatchPlan` etc. | Client-safe types (no claude.ts import) |
| `mix-engine.ts` | `generateBatchPlan()`, `suggestNextBatch()` | Batch plan generation |
| `batch-engine.ts` | `generateSingleProductForSlot()`, `generateProductBatch()` | Per-slot generation + DB save |
| `intelligence-engine.ts` | `scanEmotionalTrends()`, `scoreSignal()` | Trend discovery |
| `product-engine.ts` | `generateProductBlueprint()` | Single product blueprint |
| `content-engine.ts` | `generateContentBatch()`, `generateViralHooks()` | Content generation |
| `brand-engine.ts` | `generateBrandBible()` | Brand Bible generation |
| `competitor-engine.ts` | `analyzeCompetitor()` | Competitor profile analysis |
| `empire-engine.ts` | `generateOperatorBrief()`, `generateNextBestAction()`, `generateStrategicAlerts()` | Dashboard AI brief |
| `market-research-engine.ts` | `analyzeMarket()` | Market snapshot + action plan |
| `pinterest-engine.ts` | `generatePinterestPinPlan()` | Pin content generation |
| `image-engine.ts` | `generateCoverArtDirection()` | DALL-E 3 art direction |
| `variant-engine.ts` | `generateListingVariants()` | A/B listing variants |

---

## 11. Known Open Risks

### Critical (Revenue-Blocking)
1. **TD-018: PDF generation not built** — Etsy requires a downloadable file. No PDF = no Etsy listings.
2. **TD-019: Etsy OAuth not built** — Primary revenue channel. All Etsy UI is static.

### High
3. **SEC-011: Gumroad webhook HMAC not verified** — Fake sale events can be injected.
4. **TD-015: No job queue for batch generation** — 5 parallel Claude calls approach Vercel's 60s timeout.
5. **TD-016: Rate limiter is per-instance** — In-memory LRU; can be bypassed on multi-instance serverless.

### Medium
6. **TD-017: NextAuth sessions not persisted to DB** — Cannot invalidate sessions server-side.
7. **SEC-004: No CSRF protection** — Relevant once auth UI exists.
8. **SEC-008: No Content Security Policy headers** — XSS risk if AI content rendered unsanitized.
9. **PERF-008: Empire brief makes 3 Claude calls on every load** — No memoization; costly on dashboard refresh.

### Low
10. **TD-020: Bundle productIds not written to DB** — Field exists but never populated.
11. **TD-013: Pinterest image URLs require public hosting** — Localhost pins fail silently.

---

## 12. Performance Concerns

1. **Batch generation (ESCALATED)** — 5 parallel Claude calls per batch, each 15–30s. Approaches Vercel 60s timeout.
2. **Empire brief memoization** — 3 Claude calls on every `?action=brief` with no cache (PERF-008).
3. **No Redis for rate limiter** — in-memory; loses state on cold starts, bypassable with multi-instance (TD-016).
4. **All pages are client components** — except /portfolio (RSC). No SSR optimization for others.
5. **No bundle analysis configured** — Framer Motion + Recharts + Anthropic SDK are large.

---

## 13. Security Summary

| Control | Status |
|---------|--------|
| API Authentication | ✅ x-api-key via proxy.ts (ADR-024) |
| Rate Limiting | ✅ Sliding window per IP, lru-cache |
| Error Sanitization | ✅ toSafeErrorMessage() on all routes |
| Input Validation | ✅ Zod on all POST bodies |
| NextAuth | ✅ Foundation (JWT, credentials provider) |
| CSRF Protection | ⚠️ Partial (API key header provides some mitigation) |
| Webhook Verification | ❌ Gumroad webhook not HMAC-verified (SEC-011) |
| CSP Headers | ❌ Not configured (SEC-008) |
| Cron Secret | ✅ CRON_SECRET header on all /api/cron/* routes |

---

## 14. Common Mistakes to Avoid

1. **Middleware file name** — Must be `src/proxy.ts`, NOT `src/middleware.ts` in this project
2. **Zod v4 API** — `.issues` not `.errors`, `z.record(z.string(), z.unknown())` not `z.record(z.unknown())`
3. **Prisma 7** — No `url` in `schema.prisma` datasource; connection config in `prisma.config.ts`
4. **Recharts in SSR** — Chart components must be in `"use client"` files with `mounted` guard or `dynamic({ ssr: false })`
5. **Button onClick type** — Custom Button `onClick` is `() => void`, not `(e: MouseEvent) => void`
6. **CSS colors** — Always `var(--token)`, never raw hex values
7. **Badge component** — Does not accept `style` prop; use a plain `<span>` with inline styles when custom colors needed
8. **Server-only imports in client files** — Never import `src/lib/ai/*.ts` (except `mix-types.ts`) in client components — pulls Anthropic SDK into browser bundle
9. **Prisma Json fields** — Pass objects directly, never `JSON.stringify()`. Never `JSON.parse()` when reading.
10. **Client fetch calls** — Use `apiFetch()` from `@/lib/api`, not raw `fetch()`, so the x-api-key header is included automatically
11. **Prisma after schema changes** — Always run `npx prisma generate` after schema changes, even if `npx prisma db push` already ran
12. **SSE writer** — Always close the writer in a `finally` block; an exception that skips `writer.close()` leaves the client connection hanging

---

## 15. Important Engineering Decisions (ADR-001 to ADR-031)

See `architecture-decisions.md` for full rationale. Key decisions:

| ADR | Decision |
|-----|----------|
| ADR-001 | App Router (not Pages Router) |
| ADR-002 | AI logic isolated in `lib/ai/` |
| ADR-003 | Single Claude wrapper (`claude.ts`) |
| ADR-004 | CSS variables for design tokens |
| ADR-005 | SQLite dev / PostgreSQL prod-ready |
| ADR-006 | Action-based API routing (`?action=`) |
| ADR-007 | "use client" for all page components |
| ADR-008 | Zod for API validation |
| ADR-010 | No global state library for single-component state |
| ADR-016 | Prisma 7 driver adapter (better-sqlite3) |
| ADR-019 | Rate limiting — sliding window per IP |
| ADR-020 | Product persistence on generation |
| ADR-021 | Centralized fetch helper (`apiFetch`) |
| ADR-022 | Zustand for cross-engine active product state |
| ADR-024 | Auth middleware in `proxy.ts` (not `middleware.ts`) |
| ADR-025 | Prisma Json type for all array/object fields |
| ADR-026 | Revenue learning loop — performance context injection |
| ADR-028 | API v1 versioning via proxy rewrite |
| ADR-029 | Soft delete pattern |
| ADR-030 | Pinterest as automated traffic layer |
| ADR-031 | Parallel batch generation with SSE streaming |

---

## 16. Recommended Next Actions

Ordered by revenue impact:

1. **Build PDF generation** — `@react-pdf/renderer` templates (journal/planner/workbook). Without a PDF, no Etsy. This is the single highest-leverage piece missing.
2. **Build Etsy OAuth + publisher** — OAuth 2.0 PKCE, listing creation, digital file upload. Primary revenue channel.
3. **Fix Gumroad webhook HMAC** — SEC-011. 1 hour of work, eliminates fake sale injection.
4. **Memoize empire brief** — PERF-008. 15-min TTL prevents 3 Claude calls on every dashboard refresh.
5. **Add job queue** — TD-015. Vercel `after()` for batch generation prevents timeout-related batch failures.
6. **Stripe billing** — SaaS monetization. The tool is complete enough to charge for.
7. **Login/signup UI** — NextAuth is wired; need `/login` and `/signup` pages to actually use it.

---

## 17. Cross-Engine Workflow (Zustand)

The `active-product` Zustand store links Products → Content → Publishing:

```
User generates product on /products
  → setActiveProduct(blueprint, savedId) is called
  → /content page reads activeProduct from store
  → Content form pre-populated with product details
  → User generates content
  → /publishing page shows active product banner
  → User publishes to Gumroad → triggers autoPromoteProduct() → Pinterest pin
```

This is the core operational loop. All three engines are wired together without page navigation between them.
