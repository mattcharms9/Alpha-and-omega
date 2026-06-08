# Improvement Roadmap — Alpha & Omega
*Updated: 2026-05-28 — reflects post-Session-013 state*

---

## ✅ COMPLETED (Sessions 001–007)

### Security & Infrastructure
- [x] Auth middleware (x-api-key via proxy.ts)
- [x] Rate limiting (lru-cache sliding window per IP)
- [x] Error message sanitization (toSafeErrorMessage)
- [x] Prompt caching (cache_control: ephemeral)
- [x] Retry logic (withRetry — exponential backoff)
- [x] Error boundaries (error.tsx per route segment)
- [x] API v1 versioning (proxy.ts rewrite)
- [x] Soft delete (deletedAt on all major models)
- [x] Database indexes (@@index on all major models)
- [x] Structured logging + AI cost tracking
- [x] JSON column normalization (Prisma Json type throughout)

### Features
- [x] Product persistence on generation
- [x] Portfolio real data (RSC — direct Prisma query)
- [x] Batch generation (5 products parallel, SSE streaming)
- [x] Product mix engine + smart pricing (PRICING_TIERS constants)
- [x] Daily batch progress tracker (DailyBatchLog)
- [x] Cross-engine workflow (Zustand active-product store)
- [x] Gumroad integration (create, publish, unpublish, sync, webhook)
- [x] Pinterest OAuth + auto-promotion + queue + analytics
- [x] Cover image generation (DALL-E 3 via OpenAI)
- [x] A/B listing variants (generate, track, declare-winner)
- [x] Market research engine
- [x] Revenue learning loop (performance context injected into intelligence)
- [x] Empire engine (real DB data, not mock)
- [x] NextAuth foundation (credentials provider, JWT, User model)
- [x] Email notifications (sale alerts + daily brief via Resend)
- [x] Daily brief cron (8am UTC via vercel.json)
- [x] Pin queue cron (every 30min via vercel.json)
- [x] Gumroad webhook HMAC-SHA256 signature verification (SEC-011)
- [x] Empire brief 15-min TTL cache via EmpireConfig singleton (PERF-008)
- [x] Bundle productIds written to DB after batch generation (TD-014)
- [x] Pinterest analytics auto-sync in pin queue cron (PERF-009)
- [x] Command palette (⌘K / Ctrl+K)
- [x] Competitor intelligence engine
- [x] Brand builder + Signal bank
- [x] Niche research engine (full flow: expand, drill, save)
- [x] Knowledge products engine (capability gaps + shame-reframe + blueprints + 4 PDF templates)
- [x] Games & party sheets engine (bingo, squares, bracket, trivia, etc. + event calendar)
- [x] Accountability system (daily streak, SMS reminders via Twilio, push notifications via VAPID)
- [x] Daily reminder cron + close-day cron + weekly report cron
- [x] B1: Games page — conditional customization fields by game type (needsNames / needsTheme)
- [x] B2: Bulk product operations (multi-select + Publish to Gumroad + Pin to Pinterest)
- [x] B3: Buffer social content scheduler (`/api/content/schedule`, Schedule panel in ContentCard)
- [x] B4: Audience-first knowledge scanner (AudienceGapReport + `audience-scan` action + tab in /knowledge)
- [x] B5: Seasonal calendar UI on Intelligence page (Calendar tab, 12-month strip, OpportunityCard)

---

## Phase 5: Revenue Completion (Do Now)

### 5.1 PDF Generation Pipeline — CRITICAL (TD-018)
**Why:** Without a downloadable PDF, there is no file to sell on Etsy. This is the single most important missing piece in the platform.
**How:**
- `npm install @react-pdf/renderer`
- Create `src/lib/pdf/templates/` — journal, planner, workbook layout components
- Create `POST /api/generate-pdf?action=generate` route
- Add `pdfPath String?` to `Product` Prisma model
- Add "Generate PDF" button to Products page blueprint view
- Save generated PDF to `/public/product-pdfs/[id].pdf`

**Effort:** 3 days · **Impact:** Unlocks Etsy revenue completely

### 5.2 Etsy OAuth + Listing Publisher — CRITICAL (TD-019)
**Why:** Etsy is the primary intended revenue channel. All Etsy publishing UI is static.
**How:**
- `EtsyConnection` Prisma model (OAuth tokens, shop ID)
- `POST /api/etsy?action=connect|callback|status|disconnect`
- `POST /api/etsy/publish?action=draft|upload-file|activate|sync`
- `POST /api/etsy/webhook` — sale events → RevenueRecord
- Etsy section on `/publishing` page

**Effort:** 3 days · **Impact:** Primary revenue channel

### 5.3 ✅ Fix Gumroad Webhook HMAC Verification — DONE (SEC-011)
Implemented in Session 008 — HMAC-SHA256 via `GUMROAD_WEBHOOK_SECRET`.

### 5.4 ✅ Memoize Empire Brief — DONE (PERF-008)
Implemented in Session 008 — `EmpireConfig` singleton with 15-min TTL.

### 5.5 ✅ Write Bundle productIds to DB — DONE (TD-014)
Implemented in Session 008 — `nonBundleIds` written after bundle save.

---

## Phase 6: SaaS Foundation (Next Month)

### 6.1 Stripe Billing Integration
**Why:** The tool is complete enough to charge for. Stripe is the standard path.
**How:** Stripe Checkout + subscription webhooks. Plans: Free (5 products/day), Pro ($29/mo — 20/day), Business ($97/mo — unlimited). Add `Plan` and `Subscription` models. Gate features by plan in middleware.
**Effort:** 3 days · **Impact:** Direct revenue from the tool itself

### 6.2 Login / Signup Pages
**Why:** NextAuth is configured and User model exists but there are no auth UI pages.
**How:** `/login` and `/signup` pages. Credentials form + Google OAuth button. Redirect after auth.
**Effort:** 1 day · **Impact:** Required for multi-user

### 6.3 User Scoping (Data Per User)
**Why:** `userId` FK exists on all major models but queries don't filter by it. All users share one data pool.
**How:** Add `userId` to all Prisma `findMany` / `findUnique` queries. Derive from `getServerSession()` in route handlers.
**Effort:** 2 days · **Impact:** Required for multi-user

### 6.4 NextAuth Prisma Adapter (TD-017)
**Why:** JWT strategy can't invalidate sessions server-side.
**How:** `@auth/prisma-adapter`. Add `Session`, `Account`, `VerificationToken` models to schema.
**Effort:** 0.5 days · **Impact:** Session security

### 6.5 Content Security Policy Headers (SEC-008)
**Why:** No CSP means XSS risk if AI-generated content is ever rendered unsanitized.
**How:** `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` headers in `next.config.ts`.
**Effort:** 2 hours · **Impact:** Security hardening

---

## Phase 7: Intelligence & Scale (Future)

### 7.1 Amazon KDP Integration
**Why:** Journals and planners on Amazon KDP have massive organic reach in exactly the categories this tool generates for.
**How:** KDP doesn't have a public API — Playwright automation or the KDP Direct Publishing portal. Complex but the single largest potential revenue unlock after Etsy.
**Effort:** 1 week · **Impact:** Largest single revenue channel unlock

### 7.2 Redis Rate Limiting (TD-016)
**Why:** In-memory rate limiter is per-instance on serverless. Can be bypassed.
**How:** Upstash Redis (free tier). One-line change in `rate-limit.ts`.
**Effort:** 1 hour · **Impact:** Security hardening

### 7.3 Job Queue for Batch Generation (TD-006)
**Why:** 5-product parallel batch approaches Vercel timeout. No persistence on connection drop.
**How:** Vercel `after()` for quick fix. BullMQ for persistent queue with retry.
**Effort:** 2 days · **Impact:** Production reliability

### 7.4 Sentry Error Tracking
**Why:** `console.error` is not alerting. Production errors are invisible.
**How:** `@sentry/nextjs`. Replace `console.error` with `Sentry.captureException`.
**Effort:** 2 hours · **Impact:** Operational visibility

### 7.5 Pinterest Token Refresh (SEC-013)
**Why:** Access tokens expire. After expiry, all pin operations fail silently.
**How:** Check `tokenExpiry` before API calls. Use `refreshToken` to get a new access token. Update `PinterestConnection`.
**Effort:** 2 hours · **Impact:** Pinterest reliability

---

## Phase 5.6: Content Distribution (Immediate)

### 5.6.1 ✅ Buffer Social Scheduling — DONE
**How:** `src/lib/integrations/buffer.ts` (getProfiles, schedulePost, schedulePostNow). `/api/content/schedule` GET(profiles) + POST(schedule). Schedule panel inline in ContentCard — loads Buffer profiles on page mount, opens per-piece mini panel with profile selector + datetime picker.
**Effort:** 0.5 days · **Impact:** Content distribution automation

### 7.6 Pinterest Analytics Auto-Sync (PERF-009)
**Why:** Analytics data can be days stale. Portfolio page shows stale pin performance.
**How:** Add analytics sync pass to `process-pin-queue` cron. Sync pins 1–30 days old.
**Effort:** 1 hour · **Impact:** Data freshness

### 7.7 Bundle Analysis
**Why:** No visibility into client bundle size. Framer Motion + Recharts are large.
**How:** `@next/bundle-analyzer` — run with `ANALYZE=true npm run build`.
**Effort:** 30 minutes · **Impact:** Performance visibility

### 7.8 Test Suite
**Why:** No tests means every refactor is risky.
**How:** Jest unit tests for AI engine interfaces. Playwright E2E for Etsy publish flow and batch generation.
**Effort:** 3 days · **Impact:** Developer confidence

### 7.9 Mobile Responsive Audit
**Why:** Dashboard is desktop-first. Once auth UI exists, users will open the app on mobile.
**How:** Sidebar needs a drawer pattern on mobile. Batch generator needs responsive grid.
**Effort:** 2 days · **Impact:** Usability

### 7.10 Marketing Landing Page
**Why:** Once Stripe is live, need a public-facing page for user acquisition.
**How:** Standalone `/` route (no auth required when auth is added). Email capture → Resend list.
**Effort:** 1 day · **Impact:** User acquisition funnel
