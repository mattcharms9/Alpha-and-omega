# Architecture Decisions — Alpha & Omega

Key engineering decisions, their rationale, and their trade-offs.

---

## ADR-001: Next.js App Router (Not Pages Router)
**Date:** 2026-05-25  
**Status:** Active

**Decision:** Use Next.js 16 App Router for all routing and layouts.

**Rationale:**
- App Router enables React Server Components, reducing client bundle size for data-heavy pages
- Nested layouts enable the persistent sidebar without re-mounting on navigation
- Colocated API routes via Route Handlers in the same project simplify deployment

**Trade-offs:**
- Steeper learning curve than Pages Router for React Server Components mental model
- Some libraries (notably Recharts, Framer Motion) require `"use client"` boundaries
- SSR + client hydration complexity increases with interactive features

**Consequences:** All pages currently use `"use client"` — RSC optimization is a future opportunity (TD-003).

---

## ADR-002: AI Logic Isolated in `src/lib/ai/`
**Date:** 2026-05-25  
**Status:** Active

**Decision:** All Claude API calls live in dedicated engine files in `src/lib/ai/`. Route handlers only do validation + delegation.

**Rationale:**
- Testability: AI engines can be unit tested or mocked without HTTP overhead
- Reusability: Multiple routes or future background jobs can share the same engine
- Prompt versioning: All prompts in one place, easy to audit and improve

**Consequences:** Route handlers are thin (< 50 lines). Business logic is not scattered across the codebase.

---

## ADR-003: Single Anthropic Client Wrapper (`claude.ts`)
**Date:** 2026-05-25  
**Status:** Active

**Decision:** All Claude calls go through `generateWithClaude()` or `generateJSON<T>()` in `claude.ts`. No engine file calls the Anthropic SDK directly.

**Rationale:**
- Single place to add retry logic, logging, cost tracking, or model switching
- Prompt caching can be added once without changing every engine
- Error handling standardized in one place

**Consequences:** Must not bypass this layer. Any direct SDK import in engine files violates this decision.

---

## ADR-004: CSS Variables for Design System (Not Tailwind Tokens)
**Date:** 2026-05-25  
**Status:** Active

**Decision:** The design system lives in CSS custom properties in `globals.css`, not in Tailwind's `theme.extend` configuration.

**Rationale:**
- CSS variables are accessible in inline styles (`style={{ color: "var(--gold)" }}`) which is needed for dynamic values from component props
- Tailwind v4 has a new config format — CSS-first is the idiomatic approach
- Easier to theme: a single `globals.css` edit changes the entire palette

**Trade-offs:**
- Cannot use Tailwind utility classes like `text-gold` without additional config
- CSS variables have no TypeScript autocomplete (unlike Tailwind classes)

---

## ADR-005: SQLite for Development, PostgreSQL-Ready Schema
**Date:** 2026-05-25  
**Status:** Active

**Decision:** Use SQLite via Prisma for local development. Schema is designed to migrate to PostgreSQL for production.

**Rationale:**
- Zero-setup development — no local PostgreSQL required
- Prisma abstracts the database driver, so switching requires only changing `provider` in schema and `datasource` in `prisma.config.ts`

**Known Limitation:** SQLite does not support native JSON columns or concurrent writes well. Arrays/objects are stored as JSON strings (TD-001). This is acceptable in dev but must be addressed before production.

---

## ADR-006: Action-Based API Routing (`?action=`)
**Date:** 2026-05-25  
**Status:** Active

**Decision:** Each domain has one POST endpoint with action dispatch via query param, rather than separate endpoints per operation.

```
POST /api/intelligence?action=scan
POST /api/intelligence?action=score
```

**Rationale:**
- Keeps API surface minimal
- Single route handler for auth middleware, logging, rate limiting
- Avoids REST resource confusion for RPC-style AI operations

**Trade-offs:**
- Less RESTful (actions don't map cleanly to HTTP verbs)
- `?action=` is a query param convention, not a header convention (debatable)

---

## ADR-007: `"use client"` for All Page Components
**Date:** 2026-05-25  
**Status:** Temporary (revisit)

**Decision:** All pages are client components that fetch data via `fetch()` in event handlers.

**Rationale (at time of decision):**
- Simplest mental model during initial build
- AI generation is user-triggered (not fetched on page load), so SSR provides no benefit for the primary use case
- Avoids Server/Client component boundary complexity during initial development

**Future revision:** Pages like `/portfolio` and `/intelligence` results should use RSC + Suspense for initial data. This is tracked as a future improvement.

---

## ADR-008: Zod for API Input Validation
**Date:** 2026-05-25  
**Status:** Active

**Decision:** All API route inputs are validated with Zod schemas defined at module scope.

**Rationale:**
- Runtime validation with static type inference — no duplication of types
- Excellent error messages for development
- Schema as documentation — the Zod schema IS the API contract
- Zod v4 is installed; note breaking changes from v3 (`.issues` not `.errors`, `z.record()` requires 2 args)

---

## ADR-009: Framer Motion for All Animations
**Date:** 2026-05-25  
**Status:** Active

**Decision:** Use Framer Motion for interactive animations (hover effects, entrances, exits). Use CSS `@keyframes` for ambient/repeating animations (pulse-dot, shimmer).

**Rationale:**
- Framer Motion handles layout animations and AnimatePresence (mount/unmount) elegantly
- CSS keyframes are more performant for continuous animations (no JS overhead)
- Clear separation: Framer = interactive, CSS = ambient

---

## ADR-011: Competitor Intelligence Engine Pattern
**Date:** 2026-05-25  
**Status:** Active

**Decision:** Competitive intelligence is generated as a complete structured report via `analyzeCompetitiveLandscape()` with a dedicated `competitor-engine.ts` following the same module pattern as other engines.

**Rationale:**
- Consistent architecture: all AI engines in `src/lib/ai/` with typed interfaces, `SYSTEM_PROMPT` constant, and `generateJSON<T>()` wrapper
- Three sub-operations: `landscape`, `gaps`, `counter` — dispatched via `?action=` in `/api/competitors/`
- No competitor URLs, internal business data, or PII stored anywhere in the module (system prompt is generic strategy, not scraped data)

---

## ADR-012: Brand Architecture as First-Class Entity
**Date:** 2026-05-25  
**Status:** Active

**Decision:** `Brand` is a full Prisma model with a dedicated `/brands` page and `/api/brands` route. Brands are not sub-features of Products — they are the strategic parent entity.

**Rationale:**
- The platform's Phase 3 transformation moves from "product generator" to "emotional commerce operating system"
- Brands contain the offer stack, launch roadmap, revenue projections, and content strategy — they reference Products, not vice versa
- The `Campaign` model relates to `Brand` to enable future campaign tracking per brand

**Trade-offs:**
- `Brand` stores all complex fields as JSON strings (same SQLite limitation as TD-001)
- The 12,000-token Claude call for `buildBrandArchitecture()` is expensive — prompt caching (TD-005) is critical here

---

## ADR-013: Signal Bank as Proprietary Data Moat
**Date:** 2026-05-25 (updated 2026-05-26)
**Status:** Active — DB persistence implemented

**Decision:** Signals are persisted to `BankedSignal` Prisma model via `/api/signals`. Each scan upserts signals (no duplicates). The page loads from DB on mount and accumulates across sessions. Freshness decay (3pts/day) is computed at read time from `createdAt`.

**Rationale:**
- Signals survive page refresh — they are a permanent data asset
- `upsert` on `id` prevents duplicates across scans of the same emotional territory
- Freshness computed at read time (not stored) to avoid stale pre-computed values
- Activated signals always show freshness=100 regardless of age

**Trade-offs:**
- JSON string columns for `platforms`, `audienceArchetypes`, `productOpportunities`, `tags` (same SQLite limitation as TD-001)
- Build-time: territory map computed client-side from signal emotion field; no server-side aggregation needed at current scale

---

## ADR-014: New Navigation Structure (Discover / Build / Operate)
**Date:** 2026-05-25  
**Status:** Active

**Decision:** The sidebar is reorganized into 3 semantic sections: **Discover** (Command Center, Intelligence, Signal Bank), **Build** (Brand Builder, Products, Content), **Operate** (Portfolio, Publishing).

**Rationale:**
- Reflects the user's workflow: discover opportunities → build assets → operate the business
- New Phase 3 pages (Brands, Signals) are slotted into the correct sections
- Section headers with icons provide visual hierarchy without taking significant space
- Width increased from 220px to 228px to accommodate longer labels cleanly

---

## ADR-015: Empire Engine — Pure Computation + Selective AI
**Date:** 2026-05-26  
**Status:** Active

**Decision:** The Empire state (`buildEmpireState()` in `/api/empire`) is computed entirely from DB aggregation — no AI calls. AI is only invoked for narrative interpretation (`generateOperatorBrief`) and recommendation (`generateNextBestAction`), both isolated in `empire-engine.ts`.

**Rationale:**
- Dashboard vitals load immediately (pure math, no latency) via `GET /api/empire?action=state`
- AI brief loads asynchronously via `GET /api/empire?action=brief` — user sees numbers first
- Separating state computation from AI narrative means the dashboard is usable even when the Claude API is slow
- `computeEmpireScore` and `generateStrategicAlerts` are pure functions — no AI cost, no latency

**Trade-offs:**
- The brief endpoint makes 3 parallel Claude calls (brief + nextAction + alerts) — expensive but parallelized
- Strategic alerts are rule-based (no AI) to avoid alert inflation and cost

---

## ADR-016: Prisma 7 Driver Adapter (PrismaBetterSqlite3)
**Date:** 2026-05-26  
**Status:** Active

**Decision:** `src/lib/db/prisma.ts` uses `PrismaBetterSqlite3` from `@prisma/adapter-better-sqlite3` instead of bare `new PrismaClient()`.

**Rationale:**
- Prisma 7 changed the default engine type to "client" (Wasm-based), which requires a driver adapter — bare `PrismaClient()` throws `PrismaClientConstructorValidationError` at instantiation
- `PrismaBetterSqlite3({ url })` is the official Prisma 7 pattern for local SQLite — accepts `{ url: "file:./dev.db" }` config, manages the connection internally
- This is a breaking change from Prisma 6 where `DATABASE_URL` alone was sufficient

**Key implementation detail:**
```ts
const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./prisma/dev.db" });
return new PrismaClient({ adapter });
```

**Breaking changes found in Prisma 7:**
- `createMany({ skipDuplicates: false })` — `false` is not assignable to `never`. Must omit the option entirely.
- `new Map<string, T>()` type expression causes "lacks a construct signature" TS error in some contexts — use `Record<string, T>` instead.

---

## ADR-017: Command Palette as Global Navigation Layer
**Date:** 2026-05-26  
**Status:** Active

**Decision:** A `CommandPalette` component (`⌘K` / `Ctrl+K`) is mounted in the root layout and provides keyboard-first navigation across all pages and quick actions.

**Rationale:**
- Power users expect keyboard navigation in operator-grade tools
- Reduces cognitive load of navigating a complex multi-section sidebar
- Fuzzy search across label, description, and keyword arrays surfaces pages the user might not know exist
- Single global instance in `layout.tsx` — not per-page — so it persists across navigation

**Implementation:**
- `useEffect` on `window.keydown` for `⌘K` toggle
- Fuzzy scoring: label prefix match (100) > label includes (80) > keyword starts (70) > description includes (60) > keyword includes (50)
- Items are grouped by `category` (Navigate / Quick Actions) in display order but scored globally for search results

---

## ADR-018: Brand Persistence on Generate
**Date:** 2026-05-26  
**Status:** Active

**Decision:** `/api/brands` POST `?action=build` saves the generated brand to the `Brand` Prisma table immediately after generation. The GET handler returns all saved brands.

**Rationale:**
- Brands are capital assets, not ephemeral results — they must survive the session
- Signal activation (linking a signal to a brand) requires brands to be in DB
- The empire score computation (`brandsBuilt = brands.length`) reads from DB, so in-memory-only brands would make the empire score permanently wrong

**Trade-offs:**
- Complex nested objects (offerStack, launchRoadmap, etc.) stored as `JSON.stringify()` strings — same TD-001 limitation
- No deduplication: generating the same brand twice creates two DB records (future: upsert by `id` from AI output)

---

## ADR-010: No Global State Library (Yet)
**Date:** 2026-05-25  
**Status:** Superseded by ADR-022 (2026-05-26)

**Decision:** Zustand is installed but not used. State is local to components via `useState`.

**Rationale:**
- Current pages are self-contained — no shared state needed yet
- Premature global state management adds complexity without benefit

**Superseded:** ADR-022 documents the implemented Zustand pattern for cross-engine active product state.

---

## ADR-019: Rate Limiting — Sliding Window Per IP
**Date:** 2026-05-26  
**Status:** Active

**Decision:** All AI endpoints enforce a 10 req/min sliding window rate limit via `src/lib/rate-limit.ts` using an in-memory `LRUCache<string, number[]>`.

**Rationale:**
- A single `/api/brands` call can consume ~12,000 tokens — unbounded calls could exhaust the API budget in seconds
- Sliding window (not fixed window) prevents burst exploitation at window boundaries
- LRU cache (max 500 IPs) bounds memory usage — oldest entries evicted automatically
- Discriminated union return (`{ success: true } | { success: false; retryAfter: number }`) makes the call site safe without type coercion

**Trade-offs:**
- In-memory only — limits reset on server restart, and won't work in multi-instance deployments without a shared store (Redis)
- `NEXT_PUBLIC_API_KEY` is visible in the client bundle — provides friction against casual callers, not determined attackers

---

## ADR-020: Product Persistence on Generation
**Date:** 2026-05-26  
**Status:** Active

**Decision:** `/api/products` POST saves the generated `ProductBlueprint` to the `Product` Prisma model immediately after AI generation. Returns `{ ...blueprint, savedId }`.

**Rationale:**
- Products are assets — losing a generated blueprint on page refresh is a bad user experience
- `savedId` is passed to Zustand store and can be used by downstream engines (content, publishing) to reference the product in DB
- The GET handler returns the last 50 products ordered by `createdAt desc`

**Trade-offs:**
- Complex nested objects (`sections`, `coverConcept`, `pricingStrategy`) stored as `JSON.stringify()` strings — same TD-001 limitation
- No deduplication: generating the same blueprint twice creates two records

---

## ADR-021: Centralized Fetch Helper (`src/lib/api.ts`)
**Date:** 2026-05-26  
**Status:** Active

**Decision:** All browser-side API calls use `apiFetch()`, `apiPost()`, or `apiGet()` from `src/lib/api.ts` instead of calling `fetch()` directly.

**Rationale:**
- Single place to inject the `x-api-key` auth header — without this, each page would need to add the header manually (and some would inevitably miss it)
- If the auth mechanism changes (e.g., JWT, session cookie), only `api.ts` needs to change
- `NEXT_PUBLIC_API_KEY` env var is read once at module scope

**Trade-offs:**
- The API key is in the client bundle by design — acceptable for the current threat model (preventing casual API abuse, not preventing determined attackers)

---

## ADR-022: Zustand for Cross-Engine Active Product State
**Date:** 2026-05-26  
**Status:** Active (supersedes ADR-010)

**Decision:** `src/lib/stores/active-product.ts` stores the last generated `ProductBlueprint` and its database `id` in a Zustand store. Products → Content → Publishing all read from this store.

**Rationale:**
- When a user generates a product and clicks "Create Content →", the Content page needs to know which product to use without requiring re-entry of the product details
- Prop drilling through the URL (query params) would pollute the URL and require serialization of the full blueprint
- Zustand persists across navigation within the session without re-fetching from the DB

**Implementation:**
- Products page: `setActiveProduct(blueprint, savedId)` after generation; "Create Content →" button navigates to `/content`
- Content page: `useEffect([activeProduct])` pre-populates `productTitle` and `emotionalTheme` on mount
- Publishing page: reads `activeProduct` and `activeProductId` for the context banner

**Trade-offs:**
- Store is in-memory only — cleared on full page refresh (acceptable; user can re-generate or re-select)
- No persistence to localStorage (future: Zustand persist middleware)

---

## ADR-023: DB Indexes on High-Cardinality Query Fields
**Date:** 2026-05-26  
**Status:** Active

**Decision:** Added `@@index` directives for frequently queried fields on four models:
- `Product`: `status`, `targetEmotion`, `type`, `createdAt`
- `ContentPiece`: `productId`, `platform`, `status`, `createdAt`
- `RevenueRecord`: `date`, `platform`, `productId`
- `EmotionalTrend`: `emotion`, `monetizationScore`, `createdAt`

**Rationale:**
- Portfolio aggregation queries filter/group by `status`, `targetEmotion`, `platform`, and `date` — table scans on these columns become expensive as the catalog grows
- `productId` on ContentPiece is a FK with no index — join performance degrades without it
- `date` on RevenueRecord is the primary aggregation axis for the monthly revenue series

**Notes:** Applied via `npx prisma db push` (no migration file needed in dev).

---

## ADR-024: API Authentication via `proxy.ts` (Not `middleware.ts`)
**Date:** 2026-05-26  
**Status:** Active

**Decision:** API key authentication lives in `src/proxy.ts` (the Next.js 16 proxy convention), not `src/middleware.ts`.

**Rationale:**
- Next.js 16 deprecated `middleware.ts` in favor of `proxy.ts` — keeping `middleware.ts` produces a build warning (`⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.`)
- `proxy.ts` exports the same `middleware` function and `config` object — the migration is a rename
- Authenticated all `/api/:path*` routes in one place; public routes (pages) unaffected

**Key implementation detail:**
```ts
// src/proxy.ts
export function proxy(req: NextRequest) {
  if (!req.nextUrl.pathname.startsWith("/api/")) return NextResponse.next();
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey || apiKey !== process.env.API_SECRET_KEY) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.next();
}
export const config = { matcher: ["/api/:path*"] };
```

---

## ADR-025: Prisma Json Type for All Array/Object Fields (TD-001 Resolution)
**Date:** 2026-05-26  
**Status:** Active

**Decision:** All fields previously stored as `String` containing JSON (arrays and nested objects) are now typed as `Json` in the Prisma schema. Routes use a `toJson<T>(val: T): Prisma.InputJsonValue` cast helper rather than `JSON.stringify()`.

**Rationale:**
- Eliminates `JSON.parse()` at read time — Prisma deserializes `Json` fields automatically
- Eliminates `JSON.stringify()` at write time — Prisma serializes automatically
- SQLite stores `Json` as TEXT internally, so no migration drama; PostgreSQL will use native `jsonb`
- `toJson<T>()` cast is required because TypeScript's `InputJsonValue` requires an index signature — the cast is safe because all types involved are plain objects that serialize cleanly to JSON

**Key implementation detail:**
```typescript
function toJson<T>(val: T): Prisma.InputJsonValue {
  return val as unknown as Prisma.InputJsonValue;
}
// Usage: sections: toJson(blueprint.sections)
```

**Trade-offs:**
- Simple array fields (string[]) pass through without `toJson()` — only complex typed objects need the cast
- `--force-reset` is blocked by Prisma's AI safety check when run from Claude Code — use plain `prisma db push` (SQLite's flexible typing handles String→Json changes)

---

## ADR-026: Revenue Learning Loop — Performance Context Injection
**Date:** 2026-05-26  
**Status:** Active

**Decision:** The Intelligence Engine's `discoverEmotionalTrends()` accepts an optional `performanceContext: PerformanceInsight` parameter. When provided (fetched from `/api/performance` on page mount), real revenue data from the operator's portfolio is injected into the AI prompt.

**Rationale:**
- AI recommendations are more relevant when grounded in what's actually converting for this operator
- Cold AI analysis ignores portfolio-specific data that could meaningfully bias niche selection
- The intelligence page fetches performance silently on mount — if no data exists (`hasData: false`), nothing changes
- The "POWERED BY YOUR PORTFOLIO DATA" indicator communicates this to the operator without cluttering the UI

**Trade-offs:**
- Adds ~200 tokens to each scan prompt when performance data is available
- If performance data is stale (old Prisma records), recommendations may be biased incorrectly — acceptable at current scale

---

## ADR-027: RSC Portfolio Page with Client Chart Island
**Date:** 2026-05-26  
**Status:** Active (supersedes ADR-007 for portfolio page)

**Decision:** `src/app/portfolio/page.tsx` is an async Server Component that queries Prisma directly. All Recharts code is extracted to `src/components/portfolio/PortfolioCharts.tsx` marked `"use client"`.

**Rationale:**
- Portfolio data is read-only on page load — no user interaction needed before the query — making RSC ideal
- Direct Prisma query eliminates the API fetch round-trip (`/api/portfolio`) and its auth overhead
- Recharts requires `"use client"` due to DOM access — the Island pattern (server shell + client charts) is the canonical RSC approach for visualization libraries
- SSR + hydration: KPI numbers render instantly on server, charts hydrate client-side (same UX, lower TTFB)

**Trade-offs:**
- The portfolio API route (`/api/portfolio`) still exists — it's now used by the cron job for the daily brief
- Data is fetched at request time (no ISR) — acceptable since portfolio data changes infrequently

---

## ADR-028: API v1 Versioning via Proxy Rewrite
**Date:** 2026-05-26  
**Status:** Active

**Decision:** `/api/v1/*` requests are rewritten to `/api/*` in `proxy.ts` using `NextResponse.rewrite()`. No route files were moved.

**Rationale:**
- Moving 15+ route files to an `/api/v1/` directory has high breakage risk and adds no immediate user value
- The rewrite approach establishes the convention (`/api/v1/` is the versioned surface) without disruption
- Future: if a breaking change is needed, `/api/v2/products/route.ts` can be created alongside `/api/products/route.ts` and both versions coexist

**Trade-offs:**
- No actual version isolation yet — `/api/v1/x` and `/api/x` are identical
- In-process rewrite (not redirect) means the URL stays `/api/v1/*` in the browser but resolves to `/api/*` on the server

---

## ADR-029: Soft Delete Pattern
**Date:** 2026-05-26  
**Status:** Active

**Decision:** `deletedAt DateTime?` is added to `Product`, `Brand`, `BankedSignal`, `ContentPiece`, and `EmotionalTrend`. `src/lib/db/soft-delete.ts` provides `softDelete()`, `restore()`, and `notDeleted()` helpers.

**Rationale:**
- Hard deletes are unrecoverable — published products have external platform listings that would 404
- `notDeleted()` returns `{ deletedAt: null }` for use in Prisma `where` clauses — centralizes the filter pattern
- RSC portfolio page already uses `where: { deletedAt: null }` — demonstrates the pattern in production

**Trade-offs:**
- Deleted data accumulates in the DB indefinitely without a purge strategy
- Existing queries that don't use `notDeleted()` will accidentally include soft-deleted records — migration of all existing `findMany` calls is a future cleanup task

---

## ADR-030: Pinterest as Automated Traffic Layer
**Date:** 2026-05-26  
**Status:** Active

**Decision:** Pinterest is wired as a zero-touch traffic layer: publishing a product to Gumroad automatically triggers `autoPromoteProduct()`, which generates AI pin content and creates a Pinterest pin in the background. The pin queue cron (`/api/cron/process-pin-queue`, every 30 min) handles scheduled pins.

**Rationale:**
- Pinterest is a visual search engine, not a social network — a properly keyworded pin generates organic traffic for months without ongoing effort
- Digital self-improvement products (journals, planners, workbooks) are a top-performing Pinterest category
- Auto-promotion decouples traffic generation from manual work — the operator publishes once, Pinterest promotion is automatic
- The AI pin engine (`src/lib/ai/pinterest-engine.ts`) generates both a benefit-forward primary pin and a problem-forward variant — A/B at the point of posting

**Key implementation details:**
- OAuth: `https://www.pinterest.com/oauth/` → code exchange at `https://api.pinterest.com/v5/oauth/token` with Basic auth
- `autoPromoteProduct()` wraps all logic in try/catch and logs but never re-throws — publish flow is never broken by a Pinterest failure
- `PinterestConnection` stores the access token, refresh token, board ID, and Pinterest user ID
- `PinQueue` enables scheduled posting — `process-pin-queue` cron picks up rows where `scheduledFor <= now && status = "queued"`
- Image URL convention: `${NEXT_PUBLIC_APP_URL}/product-images/{productId}.png` — assumes cover images are served statically from `/public/product-images/`

**Trade-offs:**
- Pinterest requires a public image URL — localhost images will fail in production (see TD-013)
- Token refresh not implemented — access tokens expire; a future refresh cycle is needed for long-lived connections
- Pin analytics sync is manual (POST `?action=sync-analytics`) — not wired to a cron yet

---

## ADR-031: Parallel Batch Generation with SSE Streaming
**Date:** 2026-05-27  
**Status:** Active

**Decision:** Batch product generation runs all non-bundle slots concurrently via `Promise.allSettled()`, with the bundle slot executed sequentially after non-bundle slots complete. Progress is streamed to the client via Server-Sent Events (SSE) using a `TransformStream` in the route handler. Types and constants (`PRICING_TIERS`, `BatchSlot`, `BatchPlan`) are extracted into `mix-types.ts` to keep them importable by client components without pulling in the Anthropic SDK.

**Rationale:**
- A 5-product batch takes 15–30s per product sequentially (75–150s total) vs. ~20–30s in parallel — a 5× improvement
- SSE lets the UI update as each product completes rather than waiting for the full batch; perceived responsiveness is dramatically better
- Bundle slot must run after non-bundle slots to reference their titles in the bundle listing copy — sequential ordering is a hard requirement, not a performance choice
- `Promise.allSettled()` (not `Promise.all()`) ensures one failed product doesn't cancel the rest of the batch
- `mix-types.ts` split was required because `BatchView.tsx` is a client component but needed `PRICING_TIERS` for the pricing slider UI — importing `mix-engine.ts` would have pulled the Anthropic SDK into the client bundle

**Key implementation details:**
- SSE route: `src/app/api/products/batch/route.ts` — rate limited at 3 req/min (vs. 10 for standard routes) due to 4–5 parallel Claude calls per batch
- Events emitted: `started`, `product_complete`, `product_failed`, `batch_complete`, `error`
- `generateSingleProductForSlot()` in `batch-engine.ts` overrides AI-generated prices with `PRICING_TIERS` values before saving to Prisma — AI controls creative direction, not pricing
- `DailyBatchLog` upserted after every batch; non-fatal (swallowed in catch) so a DB failure never blocks the response
- Client consumption: `res.body.getReader()` + `TextDecoder` + `split("\n").filter(l => l.startsWith("data: "))`

**Trade-offs:**
- SSE is unidirectional — no cancellation from client once started; a user navigating away leaves the server-side generation running until complete
- `Promise.allSettled()` parallelism means 4 concurrent Claude API calls per batch, which can spike costs; the 3 req/min rate limit partially mitigates abuse
- `mix-types.ts` is a second source of truth for format/pricing definitions — if `mix-engine.ts` logic changes, `mix-types.ts` must be kept in sync

---

## ADR-032: UTM Tracking on All Outbound URLs
**Date:** 2026-05-27  
**Status:** Active

**Decision:** All URLs sent to external platforms (Pinterest pins, Gumroad listings) are wrapped with UTM parameters using `buildTrackedUrl()` from `src/lib/tracking/utm.ts`. The Gumroad webhook parses `referrer_url` to extract UTM attribution from inbound sale events and stores `utmSource`, `utmMedium`, `utmCampaign`, `utmContent` on `RevenueRecord`.

**Rationale:**
- Without attribution, revenue data is unactionable — all sales look the same regardless of source channel
- Knowing that Pinterest drove $X and email drove $Y changes what you invest in; the data compounds over time as channel volume grows
- UTM params are free to add (no API changes required), zero user friction, and give permanent revenue attribution

**Key implementation details:**
- `buildTrackedUrl()` gracefully catches URL parse errors and returns `baseUrl` unchanged if the URL is malformed
- `parseUtmFromUrl()` extracts UTM params from a referrer URL (e.g., Gumroad webhook's `referrer_url` field)
- Pinterest auto-promote always sets `utm_source=pinterest&utm_medium=pin&utm_campaign={productId}`
- `RevenueRecord` schema: added `utmSource`, `utmMedium`, `utmCampaign`, `utmContent` (all nullable String)
- Attribution index: `@@index([utmSource])` on `RevenueRecord` for portfolio source aggregation

**Trade-offs:**
- Gumroad and some platforms strip or replace UTM params on redirect — attribution is best-effort, not guaranteed
- Etsy doesn't pass referrer data in webhook events — Etsy attribution will require a dedicated tracking parameter if/when Etsy OAuth is built
- UTM data only flows from sessions where the buyer arrived via a tracked URL; direct/organic sales show null UTM fields

---

## ADR-033: Rule-Based Repricing (No AI Cost)
**Date:** 2026-05-27  
**Status:** Active

**Decision:** Product repricing recommendations are entirely rule-based (no Claude calls). Rules are defined as constants in `src/lib/rules/repricing.ts`. `evaluateRepricingRules()` queries `ListingVariant` impressions and conversions, computes conversion rates, and matches products against `DEFAULT_REPRICING_RULES`.

**Rationale:**
- Repricing runs across potentially hundreds of products. Using AI for each evaluation would be expensive and slow.
- The repricing logic is simple enough to express as rules (if views > X and conversion < Y and days > Z, reduce price by $2). Rules are transparent, deterministic, and free to run.
- `POST /api/rules/repricing?action=apply` applies changes to the DB (ListingVariant price update + product repricing counter increment) but does NOT sync to Gumroad or Etsy automatically — operator review required before external publish

**Key implementation details:**
- `maxApplicationsPerProduct` prevents a product from being repriced more than N times
- `repricingApplications Int @default(0)` and `lastRepricedAt DateTime?` added to `Product` schema
- `applyRepricing()` runs as a Prisma transaction: updates variant price + increments counter atomically
- `GET /api/rules/repricing` returns recommendations without applying — read-only evaluation

**Trade-offs:**
- Rules are static — they don't adapt to market conditions or seasonal demand
- Applying repricing only updates the local DB; Gumroad sync requires a separate manual step until the sync-on-reprice flow is built
- Future improvement: feed real Etsy category average prices to dynamically calibrate thresholds

---

## ADR-034: Buyer Email Collection (Opt-Out Model)
**Date:** 2026-05-27  
**Status:** Active

**Decision:** Every Gumroad sale automatically calls `addBuyerToAudience()` (non-fatal, fire-and-forget) which adds the buyer to a Resend audience list. Activated only when `RESEND_AUDIENCE_ID` env var is set.

**Rationale:**
- Gumroad buyers have an existing commercial relationship with the seller — adding them to a product update list is standard e-commerce practice
- The opt-in friction cost would reduce list growth significantly for a first-time buyer
- Resend provides one-click unsubscribe in all emails — GDPR/CAN-SPAM compliant at the infrastructure level
- Graceful degradation: if `RESEND_AUDIENCE_ID` is not configured, the call returns immediately without error

**Key implementation details:**
- Implemented via `addBuyerToAudience()` in `src/lib/notifications/email.ts`
- Called in Gumroad webhook after `revenueRecord.create` — buyer email and firstName extracted from webhook body
- `void fn().catch(err => console.error(...))` pattern — buyer list failure never blocks webhook response
- Buyer email is sourced from Gumroad's `email` field on the sale event

**Trade-offs:**
- Email field presence in Gumroad webhook depends on Gumroad's webhook payload — not all sale events include buyer email (e.g., gift purchases)
- CAN-SPAM compliance requires a physical postal address in commercial emails — add to email template before broadcasting
- List is append-only — no deduplication; if a buyer purchases twice, they may appear twice (Resend handles this gracefully)

---

## ADR-035: Seasonal Intelligence Cached Monthly
**Date:** 2026-05-27  
**Status:** Active

**Decision:** `generateSeasonalCalendar()` in `src/lib/ai/seasonal-engine.ts` is generated once per month and cached in the `EmpireConfig` Prisma singleton via `lastSeasonalCalendar` and `lastSeasonalAt` fields. The `GET /api/intelligence?action=seasonal` endpoint checks cache freshness (30-day TTL) before making a Claude call.

**Rationale:**
- Seasonal patterns don't change day to day — a December seasonal calendar from Dec 1 is still accurate on Dec 25
- Regenerating on every Intelligence page visit would make the tab expensive (~1,200 tokens per call)
- 30-day TTL means the cache refreshes automatically as months change — the current month's calendar is always fresh
- Shared `EmpireConfig` singleton avoids adding a new Prisma model for a single cached value

**Key implementation details:**
- Cache stored as JSON string in `EmpireConfig.lastSeasonalCalendar`
- TTL: `30 * 24 * 60 * 60 * 1000` ms (30 days)
- Graceful fallback: if JSON parse fails, regenerates fresh instead of erroring
- `GET /api/intelligence?action=seasonal` route handler — rate limited at 10 req/min
- EmpireConfig schema additions: `lastSeasonalCalendar String?` + `lastSeasonalAt DateTime?`

**Trade-offs:**
- The seasonal calendar is generated based on Claude's training data, not live Etsy search trend data — accuracy depends on the model's knowledge of seasonal demand patterns
- A 30-day TTL means a cache generated on Nov 30 could be slightly stale when the month rolls to December (next-day refresh would fix this, but adds complexity)
- Cached as a single global calendar — not per-user (acceptable for single-user launch)

---

## ADR-036: Niche Expansion as Pre-Generation Research Layer
**Date:** 2026-05-27  
**Status:** Active

**Decision:** Niche Research is a dedicated pre-generation stage before batch product creation. The user runs `expandEmotion()` → selects a sub-niche → sets it as "active" in Zustand → the Products page reads the active niche and injects its Etsy keywords + audience language into every generated product prompt. The niche ID is written to each resulting Product record.

**Rationale:**
- Generating products without niche research produces generic titles and misaligned keywords — the difference between "Anxiety Journal" and "Anxiety Journal for New Moms Returning to Work" is entirely niche context
- The Zustand bridge (`useActiveNiche`) keeps the flow non-disruptive — the user can still batch-generate without a niche active; the pre-fill is additive, not blocking
- Writing `nicheId` to Product records enables future analytics: which niches produce the highest-revenue products, which need refreshing, etc.

**Key implementation details:**
- `niche-types.ts` — zero imports; safe for client components to import (rule RI-007)
- `niche-expansion-engine.ts` — server-only; never imported in client components
- `expandEmotion()` → `NicheExpansionReport` with 8 scored `SubNiche` objects
- `drillDeeper(parentNiche)` → another `NicheExpansionReport` one level deeper; breadcrumb trail in UI
- `generateSingleProductForSlot()` injects `nicheKeywords.slice(0, 5)` and `audienceLanguage.slice(0, 4)` into the product prompt when provided
- `NicheResearch.productsGenerated` increments on every generation (batch + single) via non-fatal `.catch(() => {})`
- SQLite-safe: no `mode: "insensitive"` in Prisma queries (PostgreSQL-only feature)

**Trade-offs:**
- The active niche state lives in Zustand (in-memory) — a page refresh clears it. Acceptable for the current flow: user explicitly activates a niche from the research page.
- Niche keywords are AI-generated Etsy search terms, not actual Etsy search API data — they're directionally correct but not validated against live search volume.
- `drillDeeper()` generates sub-niches of sub-niches; there's no depth limit in the engine, only the breadcrumb UI — could theoretically drill arbitrarily deep.

---

## ADR-037: Knowledge Products as Shame-Reframe Market
**Date:** 2026-05-27  
**Status:** Active

**Decision:** The Knowledge Products engine (`knowledge-engine.ts`) targets the "capability anxiety" market — things adults feel embarrassed not to know (taxes, insurance, home repair, investing). The positioning frames products as shame-reframe resources: the buyer feels inadequate, the product title validates that feeling and promises relief.

**Rationale:**
- The "adulting" content space on Etsy has high search volume and low price sensitivity — buyers are motivated by embarrassment, not interest, so they convert faster
- Shame-level scoring (0–100 per gap) gives the operator a clear signal of which topics have the highest conversion ceiling
- The 4 formats (checklist $4–6, guide $7–9, template pack $9–12, workbook $14–19) span impulse to considered purchase, enabling a natural funnel within a single niche

**Key implementation details:**
- `scanCapabilityGaps(audience, category)` → 5 ranked gaps with shame scores, urgency triggers, Etsy search terms, and sample titles
- `avoidExisting: true` (default) pulls existing product titles from DB and passes them to the engine to prevent duplicating what's already been made
- `knowledge-types.ts` has zero imports — client-safe per rule RI-007; page imports types from it directly
- Blueprint saved to `prisma.product` with `targetEmotion: "capability_anxiety"` and `psychologicalFramework: "Shame-Reframe / Capability Anxiety"`

**Trade-offs:**
- Shame scoring is AI-estimated, not from real buyer behavior data — directionally correct but not empirically validated
- "Adulting" as a category is crowded at the surface level; the engine's value is finding the specific, underserved sub-topics within each category

---

## ADR-038: Games & Gambling Engine with Seasonal Urgency
**Date:** 2026-05-27  
**Status:** Active

**Decision:** The Games & Gambling engine (`games-engine.ts`) generates printable game sheets scored with publish urgency (`now | this_week | next_month | plan_ahead`) and days-until-peak. The calendar endpoint surfaces the full year's game opportunities sorted by publish deadline. The event calendar tab in the UI has a "Generate This →" CTA that pre-fills the generate form with that event's category.

**Rationale:**
- Party game and sports sheet buyers purchase in short, predictable windows (days before the event) — missing the window means zero sales; being early means capturing the full demand curve
- The `publishUrgency` field lets the operator prioritize work without manually tracking dates
- Separating the 22 event categories into Sports / Life Events / Party in the UI makes the selector scannable at a glance
- `generateGameCalendar()` is a GET endpoint (no rate limit concern) — the calendar is expensive to generate once but cheap to cache; could be memoized in a future iteration

**Key implementation details:**
- 10 game types: bingo, squares, bracket, pick_sheet, prop_bets, trivia, how_well_do_you_know, prediction_sheet, scavenger_hunt, word_search
- 22 event categories across Sports (8), Life Events (7), Party (7)
- 3 game formats: game_sheet ($3–5), game_pack ($7–12), party_kit ($14–22)
- `GameContent` interface holds type-specific fields (e.g. `bingoSquares[]`, `squaresTeam1/2`, `questions[]`) — all optional; only the relevant fields are populated per game type
- `isEvergreen` flag: birthday/baby shower/wedding games sell year-round; Super Bowl squares have a 2-week peak window
- Calendar tab state is kept at `GamesPageInner` level (not inside `CalendarList`) to prevent re-fetching on tab switch — loaded once on first calendar tab activation via `calLoaded` guard

**Trade-offs:**
- `daysUntilPeak` is AI-estimated from the model's training data — sports event dates are known but may drift slightly year to year; should be treated as approximate
- The calendar is fetched fresh on each page load (no caching in the current implementation) — acceptable at low volume; could add short TTL cache if it becomes a cost concern

---

## ADR-039: Bulk Product Operations via Promise.allSettled
**Date:** 2026-05-28  
**Status:** Active

**Decision:** `POST /api/products/bulk` accepts `{ action, productIds[] }` and processes each product with `Promise.allSettled` — never failing the whole batch because one product errored. Returns per-product `{ ok, error }` results.

**Rationale:**
- Batch operations on 3–20 products should not abort because one Gumroad call failed (e.g. duplicate product, rate limit hit)
- `Promise.allSettled` gives full visibility into which products succeeded vs failed, enabling the UI to surface targeted retry prompts
- Product price is stored in `pricingStrategy.digitalPrice` (Prisma Json), not a bare `price Float` — bulk route extracts it correctly; bare `price` access would be undefined

**Key implementation details:**
- `publish-gumroad`: creates on Gumroad if no `gumroadProductId`, then enables. Rate limit 5/min.
- `pin-pinterest`: delegates to `autoPromoteProduct()` which handles the full Pinterest pin creation + DB write
- UI: checkbox-per-card select, fixed-bottom bulk action bar, select-all button. Bar is `position: fixed` at `bottom: 0` to stay visible during scrolling
- `bulkMode` is derived state (`selectedIds.size > 0`) — not stored separately

**Trade-offs:**
- No retry for individual failures in the current implementation — user must manually re-trigger
- `Promise.allSettled` runs all operations in parallel — aggressive on Gumroad rate limits if selecting 20+ products; rate limit at 5/min at the bulk route level mitigates this

---

## ADR-040: Buffer Integration as Stateless Scheduler
**Date:** 2026-05-28  
**Status:** Active

**Decision:** Buffer social scheduling is implemented as a stateless pass-through integration — no Buffer data is persisted in the Alpha & Omega database. The UI loads profiles on mount (`GET /api/content/schedule?action=profiles`); scheduling POSTs directly to Buffer via `POST /api/content/schedule?action=schedule`.

**Rationale:**
- Buffer is the source of truth for scheduled post state — duplicating this in our DB adds sync complexity with no benefit
- The schedule panel is inline per ContentPiece (collapsible AnimatePresence section) — no page navigation needed
- Buffer profiles are loaded once on ContentPage mount (not per-card), avoiding 12 simultaneous API calls when a batch renders

**Key implementation details:**
- `src/lib/integrations/buffer.ts`: `bufferRequest()` uses x-www-form-urlencoded for POST (Buffer API requirement), bearer auth for GET
- `BUFFER_ACCESS_TOKEN` env var — not required; schedule button is only shown when profiles are successfully loaded
- If `scheduledAt` is omitted in the POST body, the post is published immediately (`now: true`)
- Rate limit 10/min on both GET and POST endpoints

**Trade-offs:**
- No record in DB means no "what was scheduled from this tool" history — acceptable for a scheduling pass-through
- Buffer API uses 1.0 (bufferapp.com) — if Buffer deprecates v1, this needs an update

---

## ADR-041: Audience-First Knowledge Scanning as Separate Engine Mode
**Date:** 2026-05-28  
**Status:** Active

**Decision:** The Knowledge Products engine has two distinct entry points: (1) Category-first scanning (`scanCapabilityGaps` — pick a category, find gaps); (2) Audience-first scanning (`scanAudienceGaps` — describe the person, discover everything). These are separate functions with different prompts and response types (`CapabilityGapReport` vs `AudienceGapReport`).

**Rationale:**
- Category-first scanning is great for systematic coverage ("fill the money_basics category"); audience-first scanning is better for finding unexpected cross-category opportunities from a psychographic lens
- The `AudienceGapReport` returns `coreIdentityTension` and `audienceLanguage[]` which are not present in `CapabilityGapReport` — these are the most valuable outputs for copywriting and positioning
- A 14k token limit on audience scanning vs 10k for category scanning — audience scans benefit from more exploration space

**Key implementation details:**
- `AudienceGap` interface differs from `CapabilityGap`: no `shameLevel`, no `etsySearchTerms`; instead has `blockers[]`, `searchIntent[]`, `desiredTransformation`
- Rate limit tighter on audience-scan: 3/min (double the Claude cost due to prompt size)
- UI: two-tab layout in `/knowledge` page — "Gap Scan" (existing) + "Audience Scan" (new). Tab switch doesn't re-fetch if data is already loaded
- Results sorted by `opportunityScore` desc; top pick highlighted with `gold` card variant

**Trade-offs:**
- `AudienceGapReport.topOpportunity` is identified by the AI — no guarantee it's the highest-scoring gap; comparison by `gap.gap === audReport.topOpportunity.gap` string match (not by id) since `AudienceGap` has no `id` field

---

## ADR-042: Agent Pipeline Architecture (5 Sub-Agents + Manager)
**Date:** 2026-06-05
**Status:** Active

**Decision:** The autonomous pipeline uses 5 sequential sub-agents (Market Scout → Niche Validator → Concept Generator → Competition Checker → Opportunity Scorer) orchestrated by a Manager Agent. Each agent is a standalone module in `src/lib/agents/` that takes typed input, calls Claude 1–4 times, and returns typed output.

**Rationale:**
- Specialization: each agent has a laser-focused system prompt and specific data needs — a single monolithic prompt would produce lower quality output
- Graceful degradation: each stage wraps in try/catch; partial queues (10+ cards) are still useful; 15/15 is target not requirement
- Cost visibility: `AgentRunLog` records every agent's tokens/cost/duration — ROI is measurable from day 1
- Separation from route handlers: all agent logic lives in `src/lib/agents/`, never in API routes

**Key implementation details:**
- `agent-types.ts` has zero server-only imports (RI-007) — shared by client components
- `agent-logger.ts` `makeLogFn()` creates a closure over `queueId` — passed to every agent as `LogFn`
- Manager runs editorial review as a single Claude call on the top 18 candidates — not just sorting by score
- Daily cost cap via `AGENT_DAILY_COST_LIMIT_USD` env var (default $2.00) — checked after each stage

**Trade-offs:**
- Sequential execution means total run time is sum of all agents (~8–15 min) — acceptable at 2am UTC
- If Market Scout fails, synthetic fallback opportunities are generated from `performancePatterns + seasonalSignals` — quality slightly lower but run completes

---

## ADR-043: Manager Editorial Pattern
**Date:** 2026-06-05
**Status:** Active

**Decision:** After all 5 sub-agents complete, the Manager Agent performs an editorial review of the top 18 scored opportunities and selects the final 15 using criteria that go beyond raw score: no near-duplicates, format variety, seasonal urgency requirements, safe-bet/moonshot balance.

**Rationale:**
- Pure score ranking would produce near-duplicate opportunities if one niche scores well (e.g., 4 anxiety journals)
- The editorial criteria encode business strategy (format diversity, seasonal bias) that would be hard to encode in individual agent scores
- "Manager's Note" — the 2-sentence summary written for the email digest — gives the user immediate context on today's theme without reading all 15 cards

**Key implementation details:**
- Input to manager review is compact: one line per opportunity with key fields (no full JSON) — ~300 tokens input vs 6k+ if full data
- Output is `{ selected: number[] (0-based indices), managerNote: string }` — minimal, unambiguous
- If the Manager returns <10 valid indices, falls back to top 15 by score — queue never fails due to manager parse error

**Trade-offs:**
- Manager's editorial judgment may occasionally make surprising choices; `agentReasoning.manager` field in each LaunchCard explains the selection

---

## ADR-044: Build Pipeline Stage Non-Fatality
**Date:** 2026-06-05
**Status:** Active

**Decision:** Each stage of `runBuildPipeline()` (PDF, cover image, SEO, mockups) is wrapped in its own try/catch and failures are non-fatal. The pipeline continues to the next stage. Only the blueprint creation is fatal (no product = nothing to build). Etsy publish failing moves the card to `built` status rather than `published`.

**Rationale:**
- PDF generation and cover image generation both call external services (PDF renderer, DALL-E 3) that can fail transiently
- A product with no cover image can still be manually published; a product with no Etsy listing can still be fixed from the Products page
- User gets a notification when build fails at any non-fatal stage — they can retry or complete manually

**Key implementation details:**
- `buildStatus` values: queued → building → built → publishing → published | failed
- `buildStatus: "built"` means PDF+SEO+mockups succeeded but Etsy publish failed — product exists in DB and can be published manually
- `failureReason` field records the sanitized error for the card's build progress display

**Trade-offs:**
- A card can show `published` on the queue page even if some non-fatal stages failed (e.g., mockups not generated) — the listing is live but incomplete

---

## ADR-045: Email Action Tokens (HMAC-SHA256, No DB)
**Date:** 2026-06-05
**Status:** Active

**Decision:** Email approve/skip deep links use HMAC-SHA256 signed tokens (`AUTH_SECRET` as key) encoded as `base64url(cardId:expiry:sig)`. Verification is purely cryptographic — no database lookup, no session check required.

**Rationale:**
- Email clients may not pass browser cookies — session-based verification would silently fail for email deep links
- HMAC verification is O(1) and needs no DB round-trip; `AUTH_SECRET` is already present
- 24h TTL encoded in the token itself — expired tokens are rejected without needing a revocation list

**Key implementation details:**
- Token format: `base64url(cardId + ":" + expiryMs + ":" + hmac)` where hmac = `HMAC-SHA256(AUTH_SECRET, cardId + ":" + expiryMs)`
- Verification in `POST /api/launch-queue?action=email-approve` — separate from the standard `decide` action so it can be hit without session
- Each card gets its own token; the position (not cardId) is used in the email since real cardIds are only known after DB write

**Trade-offs:**
- Tokens cannot be revoked before expiry — if a digest email is forwarded, the recipient could approve cards. Acceptable: the email is only sent to `ALERT_EMAIL` which is the owner's address.

---

## ADR-046: Market Intelligence as Data Foundation
**Date:** 2026-06-09
**Status:** Active

**Decision:** Every product decision in the agent pipeline must be backed by real Etsy market data, not AI training knowledge. A nightly cron at 1am UTC scans all 25 `TRACKED_NICHES` using the Etsy public listings API and stores structured `MarketIntelligenceReport` records per niche. The Market Scout agent reads these reports first; all engines (product, image, SEO) accept optional market intelligence context to override AI defaults with proven data.

**Rationale:**
- AI training data for "what sells on Etsy" is stale by months or years; the actual market moves faster
- Review count is a reliable proxy for sales (no sales API exists). 500 reviews × avg price = estimated GMV
- Visual style of covers directly affects click-through rate — the nightly Claude Vision analysis gives the image engine real benchmarks instead of generic "minimalist Etsy aesthetic" guidance
- `dataSource: "live_etsy_data" | "ai_estimate"` on every LaunchCard gives the operator immediate confidence in each pick

**Key implementation details:**
- `src/lib/market-intelligence/etsy-client.ts` — public API search (no OAuth needed); two-phase: bulk search + detail fetch for top 10 by favorers; 100ms delay between requests; 429 retry once
- `src/lib/market-intelligence/analyzer.ts` — Claude extracts title structures (patterns, not verbatim), proven tags (3+ appearances), price sweet spot, product opportunities, avoidance patterns
- `src/lib/market-intelligence/visual-analyzer.ts` — Claude Vision analyzes up to 5 cover images per niche; `generateJSONWithImages<T>()` added to `claude.ts` for this
- `src/lib/market-intelligence/run-scan.ts` — orchestrates: Etsy pull → Claude analysis → visual analysis → DB save → snapshot generation
- Reports stored in `MarketIntelligenceReport` (unique on niche+reportDate); Snapshot in `EtsyMarketSnapshot`

**Trade-offs:**
- Etsy public API has no guaranteed SLA — the fallback is AI-estimate mode which existed before this ADR
- Cover image visual analysis adds ~$0.03/niche in vision tokens — 25 niches = ~$0.75/night, acceptable
- Title structure extraction is structural (patterns) not literal — avoids derivative content while capturing proven frameworks
- The first night requires a manual trigger (or the 1am cron); until then, agents fall back to AI estimates


---

## ADR-026: Compounding Pipeline — Learning Loop, Gallery Images, Direct Visual Intel Cover Generation
**Date:** 2026-06-11
**Status:** Active

**Decision:** Every Etsy sale writes a `LearningEntry` (not updates a singleton). Cover DALL-E prompt is built directly from `MarketIntelligenceReport.visualStyle` fields (not delegated to Claude). Pipeline generates 4 gallery images at ranks 2-5 after listing is created. All buyer-facing strings pass through `sanitizeForEtsy()` before reaching any API or PDF.

**Rationale:**
- `CumulativeLearning` was a singleton with no per-event rows, lessonType, or content field — it could not store sale-specific data. A new `LearningEntry` model enables per-sale records with niche, productId, and revenue.
- The `generateCoverImagePlan` Claude call introduced variability and added latency when `MarketIntelligenceReport.visualStyle` already contained structured data (dominantColors, commonElements, whatToAvoid). Bypassing Claude gives deterministic, data-driven prompts.
- Listings with 5 images significantly outperform single-image listings in Etsy search. The gallery stage adds 4 contextual images without blocking publish (it runs after activation, is optional, and has a 120s timeout).
- Em dashes in AI-generated content are unprofessional and can cause Etsy API validation issues. Enforcing at two layers (prompt instruction + sanitizer call) eliminates them before they reach buyers.

**Key implementation details:**
- `src/lib/utils/etsy-sanitizer.ts` — `sanitizeForEtsy()` replaces em dash (space), spaced hyphen (", "), double hyphen (space), word-hyphen-word (", "). Called on title, description, every tag in `etsy-publish-service.ts`, and on Pinterest pin title/description.
- `src/lib/services/gallery-service.ts` — generates 4 DALL-E images at ranks 2-5 using `gpt-image-1` at "medium" quality. Each wrapped in 25s AbortController. Upload failures logged but never throw. Stage is optional in pipeline.
- `prisma/schema.prisma` — added `LearningEntry` model (lessonType, content, niche, productId, revenue) and `salesCount Int @default(0)` on `MarketIntelligenceReport`.
- `src/app/api/etsy/webhook/route.ts` — writes LearningEntry and increments salesCount on every sale. Always returns 200 to prevent Etsy retries.
- `src/lib/agents/manager-agent.ts` — queries last 30 days of sale_validated LearningEntry records and injects into both Path A and Path B prompts.
- `src/app/api/cron/weekly-report/route.ts` — replaced Twilio SMS with 6-section Resend HTML email: revenue, high-views/no-sales, conversions, learnings, queue stats, Claude strategy with 15s timeout and fallback.

**Trade-offs:**
- Gallery stage adds up to 120s to pipeline per product (4 × 25s DALL-E calls). This is acceptable since it runs after publish and cannot block the listing going live.
- `sanitizeForEtsy` converts "self-care" to "self, care" — this changes tag text but eliminates all hyphens as required. Etsy multi-word tags work without hyphens.
- Direct visual intel cover prompts require a `MarketIntelligenceReport` in the last 48h for the primary keyword. Cold-start products fall back to the Claude plan path.
