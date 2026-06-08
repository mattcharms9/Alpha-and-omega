# Architecture Map — Alpha & Omega

## System Overview

Alpha & Omega is a Next.js 16 full-stack application using the App Router. It functions as an AI-powered publishing and emotional utility platform with 14 AI engines, each backed by Claude API integrations. It has full Gumroad and Pinterest integrations, NextAuth authentication, rate limiting, SSE streaming, and a rich data layer across 18 Prisma models.

---

## High-Level Architecture

```
Browser
  │
  ├── src/proxy.ts (Next.js Middleware)
  │     ├── Validates x-api-key header on all /api/* routes
  │     ├── Passes /api/auth/*, /api/cron/*, /api/gumroad/webhook, Pinterest OAuth through unauthenticated
  │     └── Rewrites /api/v1/* → /api/* (versioned API support)
  │
  ├── Next.js App Router (Client Components + RSC)
  │     ├── /                   → Dashboard (KPIs, alerts, quick actions)
  │     ├── /intelligence       → Emotional Intelligence Engine
  │     ├── /brands             → Brand Builder
  │     ├── /signals            → Signal Bank
  │     ├── /products           → Product Engine (batch-first with SSE)
  │     ├── /content            → Content Distribution Engine
  │     ├── /portfolio          → Portfolio Intelligence (RSC)
  │     ├── /publishing         → Publishing Engine + Pinterest panel
  │     └── /settings           → Configuration
  │
  └── API Routes (22 route handlers)
        ├── Intelligence & Discovery
        │     ├── POST /api/intelligence   ?action=scan|score
        │     ├── POST /api/signals        ?action=bank|activate|territory-map|update-scores
        │     ├── POST /api/market-research
        │     └── POST /api/competitors    ?action=analyze|list|delete
        │
        ├── Product & Content
        │     ├── POST /api/products       ?action=generate|variants|batch-plan
        │     ├── POST /api/products/batch (SSE streaming)
        │     ├── GET  /api/products/daily-log
        │     ├── POST /api/content        ?action=batch|hooks
        │     └── POST /api/generate-image
        │
        ├── Brand & Catalog
        │     ├── POST /api/brands         ?action=generate|list|delete|set-active
        │     └── POST /api/variants       ?action=generate|list|record-impression|record-click|declare-winner
        │
        ├── Commerce
        │     ├── POST /api/gumroad        ?action=create|publish|unpublish|sync|products
        │     ├── POST /api/gumroad/webhook (signature verified)
        │     ├── POST /api/pinterest      ?action=connect|callback|status|boards|set-board|disconnect
        │     ├── POST /api/pinterest/pin  ?action=create|auto-pin|queue|sync-analytics
        │     └── GET  /api/pinterest/queue
        │
        ├── Analytics & System
        │     ├── GET  /api/portfolio
        │     ├── POST /api/performance    ?action=record|query
        │     ├── POST /api/empire         ?action=brief|projects|update
        │     ├── GET  /api/cron/daily-brief
        │     └── POST /api/cron/process-pin-queue
        │
        └── Auth
              └── /api/auth/[...nextauth]  (NextAuth.js credentials provider)
```

---

## Request Flow (Standard AI Generation)

```
User clicks "Generate"
  │
  ▼
Client Component (page.tsx)
  → fetch POST /api/products { emotionalFocus, productType }
      │
      ▼
  src/proxy.ts
    → Validates x-api-key header
    → Passes request through
      │
      ▼
  Route Handler (route.ts)
    → Zod validation (module-scope schema)
    → rateLimit(req, { limit: 10, windowMs: 60_000 })
    → Call engine function
        │
        ▼
      AI Engine (product-engine.ts)
        → Build system prompt (module-scope const)
        → Build user prompt
        → claude.ts::generateJSON<T>()
            │
            ▼
          Anthropic SDK
            → claude-sonnet-4-6 (ANTHROPIC_MODEL env var)
            → Prompt caching on system prompt (cache_control: ephemeral)
            → withRetry<T>() — exponential backoff, 3 attempts
            → Returns text response
            │
            ▼
          JSON cleanup + JSON.parse()
            → Returns typed T
        │
        ▼
      AI Engine → prisma.product.create() (saves to DB)
      │
      ▼
    API Route → NextResponse.json({ success: true, data: T })
      │
      ▼
Client Component
  → setState(data)
  → Render results
```

---

## Request Flow (SSE Batch Generation)

```
User clicks "Generate Batch"
  │
  ▼
BatchView.tsx
  → fetch POST /api/products/batch { emotionalTheme, targetAudience, batchPlan }
      │
      ▼
  Route Handler (batch/route.ts)
    → Rate limit: 3/min (lower — 4-5 parallel Claude calls)
    → Creates TransformStream
    → Starts async IIFE (void (async () => { ... })())
    → Returns Response(stream.readable) immediately
        │
        ▼
      Async IIFE runs in background:
        → nonBundleSlots.map → Promise.allSettled (parallel)
        → Each slot: generateSingleProductForSlot() → send({ type: "product_complete" })
        → Bundle slot: sequential after non-bundle
        → send({ type: "batch_complete" })
        → upsertDailyLog() (non-fatal)
        → writer.close()
        │
        ▼
Client (BatchView.tsx)
  → res.body.getReader()
  → TextDecoder + split("\n").filter(l => l.startsWith("data: "))
  → Parses SSE events → updates UI as each product completes
```

---

## Component Architecture

```
src/
├── proxy.ts                        Auth + versioning middleware (NOT middleware.ts)
│
├── app/                            App Router pages (Next.js 16)
│   ├── layout.tsx                  Root layout — Sidebar + CommandPalette + main
│   ├── error.tsx                   Root error boundary
│   ├── globals.css                 Design system (CSS variables, animations)
│   ├── page.tsx                    Dashboard (client)
│   ├── intelligence/page.tsx       Intelligence Engine (client)
│   ├── brands/page.tsx             Brand Builder (client)
│   ├── signals/page.tsx            Signal Bank (client)
│   ├── products/page.tsx           Product Engine — batch-first (client)
│   ├── content/page.tsx            Content Engine (client)
│   ├── portfolio/page.tsx          Portfolio (React Server Component — direct Prisma)
│   ├── publishing/page.tsx         Publishing + Pinterest panel (client)
│   ├── settings/page.tsx           Settings (client)
│   └── api/                        22 route handlers (see above)
│
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx             Main navigation (links, active state)
│   │   └── CommandPalette.tsx      ⌘K global command palette
│   ├── ui/
│   │   ├── Card.tsx                Base card (hover, gold, onClick variants)
│   │   ├── Badge.tsx               Status badges (7 color variants — no style prop)
│   │   ├── Button.tsx              Action button (5 variants, loading state — onClick: () => void)
│   │   └── PageHeader.tsx          Consistent page header with icon + actions
│   ├── portfolio/
│   │   └── PortfolioCharts.tsx     Recharts client island (dynamic ssr:false)
│   ├── publishing/
│   │   └── PinterestPanel.tsx      Pinterest connection card + board selector + queue list
│   └── products/
│       ├── BlueprintView.tsx       Single product blueprint display (SectionCard collapsible)
│       └── BatchView.tsx           Batch generation UI (form → preview → SSE progress → complete)
│
└── lib/
    ├── utils.ts                    cn(), formatNumber(), formatters, color maps
    ├── errors.ts                   toSafeErrorMessage() — maps errors to safe client strings
    ├── rate-limit.ts               Sliding window per-IP rate limiter (LRU cache, no Redis)
    ├── api.ts                      apiFetch() — adds x-api-key header automatically
    ├── logger.ts                   log() + logAICall() — JSON structured logging with cost estimates
    ├── ai/
    │   ├── claude.ts               Anthropic SDK wrapper — generateJSON<T>(), generateWithClaude()
    │   │                           Prompt caching, withRetry<T>(), logAICall(), model via env var
    │   ├── mix-types.ts            Client-safe types: PRICING_TIERS, DEFAULT_BATCH_MIX, BatchSlot, BatchPlan
    │   ├── mix-engine.ts           generateBatchPlan(), suggestNextBatch() (server-only — imports claude.ts)
    │   ├── batch-engine.ts         generateSingleProductForSlot(), generateProductBatch()
    │   ├── intelligence-engine.ts  discoverEmotionalTrends(), scoreNiche()
    │   ├── product-engine.ts       generateProductBlueprint()
    │   ├── content-engine.ts       generateContentBatch(), generateViralHooks()
    │   ├── brand-engine.ts         generateBrandBible()
    │   ├── competitor-engine.ts    analyzeCompetitor()
    │   ├── image-engine.ts         generateCoverArtDirection() → DALL-E 3
    │   ├── variant-engine.ts       generateListingVariants()
    │   ├── empire-engine.ts        computeEmpireState() (pure compute + selective AI)
    │   ├── market-research-engine.ts analyzeMarket()
    │   └── pinterest-engine.ts     generatePinterestPinPlan()
    ├── analytics/
    │   └── revenue-aggregator.ts   computePerformanceInsights() — aggregates real DB data
    ├── auth/
    │   └── config.ts               NextAuth config — credentials provider, JWT callbacks
    ├── db/
    │   ├── prisma.ts               Prisma singleton
    │   └── soft-delete.ts          softDelete(), restore(), notDeleted() helpers
    ├── integrations/
    │   ├── gumroad.ts              Gumroad REST API client
    │   └── pinterest.ts            Pinterest API v5 client
    ├── notifications/
    │   └── email.ts                sendSaleAlert(), sendDailyBrief() (Resend SDK)
    ├── promotions/
    │   └── auto-promote.ts         autoPromoteProduct() — generates pin + posts to Pinterest; never throws
    └── stores/
        └── active-product.ts       Zustand store — active product across Product → Content → Publishing flow
```

---

## Data Model (18 Models)

```
SQLite (dev) / PostgreSQL (prod-ready)

User                    Product                     ContentPiece
────────────────        ─────────────────────────   ─────────────────
id (cuid)               id (cuid)                   id (cuid)
email (unique)          title / subtitle / tagline   productId → Product
passwordHash?           type / status               platform / format
name? / plan            targetEmotion / Audience    hook / body / cta
stripeCustomerId?       audienceArchetype           hashtags Json
                        pageCount                   emotionalTrigger
                        sections Json               estimatedViews
                        psychologicalFramework      virality / conversionPotential
EmotionalTrend          transformationPromise       tone / visualDirection
────────────────        emotionalHooks Json         status / publishedAt?
id / emotion            coverConcept Json           actualViews / Engagement
painPoint               marketingAngles Json        deletedAt? / timestamps
intensity / scores      pricingStrategy Json
platforms Json          estimatedMonthlyRevenue     ListingVariant
audienceArchetypes Json competitiveAdvantage        ─────────────────
productOpportunities    keywords Json               id / productId → Product
searchVolumeTrend       descriptionShort/Long       platform / variantLabel
competitionLevel        gumroadProductId?           title / description / tags
estimatedAnnualRevenue  gumroadUrl? / etsyListingUrl? price / isActive / isControl
tags Json               coverImagePath?             impressions/clicks/conversions
deletedAt? / timestamps bundleProductIds Json?      revenue / platformId?
                        totalRevenue / Sales / rating
                        userId? / deletedAt?        RevenueRecord
Brand                   relations: ContentPiece[]   ─────────────────
────────────────        ListingVariant[]             id / date / platform
id / brandName          PinterestPin[] / PinQueue[] productId? / revenue
tagline / personality                               sales / refunds / source
emotional fields        DailyBatchLog
scores / projections    ─────────────────           BankedSignal
positioning Json        id / date (unique)          ─────────────────
offerStack Json         batchesRun                  id / emotion / painPoint
productLadder Json      productsGenerated           scores / territory
messagingFramework      productsPublished           activatedAt? / connectedBrandId?
contentStrategy Json    targetProducts (default 20) freshnessScore / rarityScore
visualIdentity Json     emotionalThemes Json        opportunityScore
launchRoadmap Json      revenue (Float)             deletedAt? / timestamps
revenueProjection Json
userId? / deletedAt?    PinterestConnection         PinterestPin
relations: Campaign[]   ─────────────────           ─────────────────
BankedSignal[]          userId? / accessToken       id / productId → Product
                        refreshToken? / tokenExpiry? pinId / pinUrl / boardId
Portfolio               pinterestUserId / username  title / description
────────────────        boardId                     destinationUrl / imageUrl
id / name               timestamps                  saves/clicks/impressions
emotionalCategory                                   timestamps
description             PinQueue
totalRevenue            ─────────────────           CompetitorProfile
monthlyRevenue          id / productId → Product    ─────────────────
productCount            pinContent Json             id / brandName / niche
audienceSize            scheduledFor / platform     emotional + strategy fields
growthRate / status     status (queued/published    opportunityScore / threatLevel
timestamps              /failed/cancelled)          keyTakeaways / lastAnalyzedAt
                        pinId? / error?
Campaign                                            StrategicAlert
────────────────        EmotionalSignal             ─────────────────
id / brandId → Brand    ─────────────────           id / type / title / body
name / type / status    source / niche / emotion    actionLabel / actionHref
emotional fields        signal / rawText            read / createdAt
kpis / budget           sentiment/intensity scores
spend / metrics         audienceSize / platform     PerformanceMetric
userId? / timestamps    engagementRate / viral      ─────────────────
                        actionableInsight           entityType / entityId
                        collectedAt / createdAt     metricName / metricValue
                                                    unit / period / timestamps
```

---

## External Dependencies

| Service | Purpose | Risk if unavailable |
|---------|---------|-------------------|
| Anthropic API | All AI generation (14 engines) | All generation fails; app degrades to empty states |
| Gumroad API | Product commerce (create, publish, sync) | Publishing fails; webhook stops receiving sales |
| Pinterest API v5 | Pin creation, analytics, OAuth | Pinterest auto-promotion fails (non-fatal — swallowed) |
| Resend (email) | Sale alerts + daily brief | Email notifications fail silently |
| DALL-E 3 (OpenAI) | Cover image generation | Image generation fails; product saves without cover |
| SQLite (dev) | Data persistence | App fails on write operations |
| PostgreSQL (prod) | Data persistence | Same as above |

---

## Design System

The design system lives entirely in `globals.css` as CSS custom properties:

- **Background scale:** `--bg-void` → `--bg-surface` → `--bg-elevated` → `--bg-card` → `--bg-hover`
- **Accent colors:** `--gold`, `--emerald`, `--rose`, `--violet`, `--amber`, `--cyan`
- **Text scale:** `--text-primary` → `--text-secondary` → `--text-muted`
- **Border scale:** `--border-subtle` → `--border-default` → `--border-strong`
- **Derived tokens:** `--gold-bright`, `--gold-dim`, `--gold-glow` (10% opacity fill used for icon chips)

All components reference these variables directly via inline styles or CSS class references. No hardcoded hex values in component files.

---

## Key Architectural Constraints

| Constraint | Rule |
|-----------|------|
| Auth middleware | Lives in `src/proxy.ts`, NOT `src/middleware.ts` (Next.js 16 convention in this project) |
| Client components | Cannot import from `src/lib/ai/*.ts` directly — those files pull in Anthropic SDK (Node.js only) |
| Client-safe AI types | Live in `src/lib/ai/mix-types.ts` — no claude.ts import, safe for `"use client"` files |
| Prisma in AI engines | Allowed only in `batch-engine.ts` (saves each product as part of generation) |
| Rate limits | Standard AI routes: 10/min. Batch route: 3/min. Cron routes: validated by CRON_SECRET header |
| SSE streaming | `TransformStream` + `getWriter()` + `void (async () => { ... })()` pattern (batch route) |
| File size | Route handlers ≤80 lines, AI engines ≤200 lines, pages ≤600 lines, UI components ≤250 lines |
