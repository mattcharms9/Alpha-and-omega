# Performance Watchlist — Alpha & Omega

---

## PERF-001: Batch Generation Approaches Serverless Timeout — ESCALATED
**Severity:** High (escalated from Medium)
**File:** `src/app/api/products/batch/route.ts`
**Status:** Open — SSE streaming implemented but server-side execution is still synchronous per slot

**Original risk:** Single product generation (15–30s) blocks the HTTP thread.

**Escalated risk:** The batch route makes **4–5 simultaneous Claude API calls** via `Promise.allSettled`. Each call holds a serverless execution thread for up to 30s. On Vercel Pro, the 60s function timeout is approachable with complex prompts. On the free tier or under API latency, batches regularly fail.

SSE streaming (implemented in Session 007) means the user sees progress as each product completes, but the server-side execution is still fully synchronous per slot. If the client disconnects mid-batch, the server continues generating but results are lost.

**Fix:** Vercel `after()` API for immediate improvement. Full job queue (BullMQ/Inngest) for production reliability. See TD-006/TD-015.

---

## ~~PERF-002~~ ✅ RESOLVED — No Prompt Caching
**Resolved:** Session 004 (2026-05-26)
`cache_control: { type: "ephemeral" }` on all system prompt blocks in `generateJSON<T>()`. ~80% input token reduction on repeat calls within the 5-minute cache TTL.

---

## PERF-003: All Pages Are Client Components (Partially Resolved)
**Severity:** Medium
**File:** All `page.tsx` files
**Status:** Partially resolved — `/portfolio` is now RSC; all others remain `"use client"`

`/portfolio/page.tsx` was refactored to a React Server Component (Session 005) — it queries Prisma directly without an API roundtrip. All other pages remain client components that fetch data after hydration.

**Remaining fix:** `/intelligence` and `/signals` are good candidates for RSC — they display historical data that doesn't require interactive state on initial load.

---

## ~~PERF-004~~ ✅ RESOLVED — Recharts ResponsiveContainer SSR Warning
**Resolved:** Session 005 (2026-05-26)
`PortfolioCharts.tsx` extracted as a `"use client"` component with `mounted` guard. Chart renders only after client hydration.

---

## PERF-005: No Bundle Analysis Configured
**Severity:** Low
**Status:** Open

No bundle analyzer configured. Framer Motion (~40KB gzip) + Recharts (~100KB) + lucide-react are substantial. The Anthropic SDK is server-only so it shouldn't appear in the client bundle, but the `mix-types.ts` split (Session 007) was required to prevent it from leaking in.

**Fix:** Add `@next/bundle-analyzer`:
```javascript
const withBundleAnalyzer = require("@next/bundle-analyzer")({ enabled: process.env.ANALYZE === "true" });
```
Run with `ANALYZE=true npm run build` to check current bundle composition.

---

## PERF-006: Framer Motion Loaded for All Routes
**Severity:** Low
**File:** All pages, `Sidebar.tsx`

Framer Motion is used on every page including the sidebar. With Next.js code splitting it should be tree-shaken per route, but the sidebar (loaded on every page) imports it unconditionally.

**Monitor:** Run bundle analysis to verify Framer Motion is not in the main bundle.

---

## PERF-007: No Database Query Optimization
**Severity:** Medium (future)
**File:** All Prisma usage
**Status:** Indexes applied (TD-002 resolved); Json column normalization done (TD-001 resolved)

At current scale (< 500 products), performance is fine. Once catalog grows past ~500 products, some queries (filtering by emotion, status, type) will benefit from query plan analysis.

**Action:** Run `EXPLAIN QUERY PLAN` on primary queries when catalog reaches 500+ rows.

---

## ~~PERF-008~~ ✅ RESOLVED — Empire Brief 3 Parallel Claude Calls
**Resolved:** Session 008 (2026-05-27)
`EmpireConfig` singleton model added to Prisma schema. `lastBrief` and
`lastBriefAt` fields cache the last generated brief. Cache TTL is 15 minutes.
Brief only regenerates when cache is stale or empire state materially changes.
Estimated ~85% cost reduction on dashboard brief loads for active users.

---

## ~~PERF-009~~ ✅ RESOLVED — Pinterest Pin Analytics Sync Has No Schedule
**Resolved:** Session 008 (2026-05-27)
Analytics sync pass added to `process-pin-queue` cron (runs every 30 min).
Syncs analytics for pins older than 24h and younger than 30 days.
Batches 20 pins per run to respect Pinterest API rate limits.

---

## Performance Budget Targets

| Metric | Target | Current Status |
|--------|--------|---------------|
| Time to First Byte | < 200ms | ~50ms (static pages) |
| First Contentful Paint | < 1.5s | ~600ms est. |
| AI Generation (single) | < 30s P95 | ~15–25s observed |
| Batch Generation (5 products) | < 45s P95 | ~25–35s (parallel) |
| Dashboard Load | < 500ms | < 200ms (static) |
| Bundle Size (main) | < 300KB gzip | Unknown — run analyzer |
