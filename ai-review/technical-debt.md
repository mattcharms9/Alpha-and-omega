# Technical Debt — Alpha & Omega

Tracked debt items with severity, impact, and remediation guidance.

Legend: 🔴 Critical · 🟠 High · 🟡 Medium · 🟢 Low

---

## ✅ RESOLVED

### ~~TD-001~~ — Arrays and Objects as Prisma Json Type
**Resolved:** Session 005 (2026-05-26)
All array/object fields changed to `Json` type in Prisma schema. No `JSON.stringify`/`JSON.parse` remain in data access code. See ADR-025.

### ~~TD-002~~ — No Database Indexes
**Resolved:** Session 005 (2026-05-26)
`@@index` directives added to all major models on high-cardinality query fields.

### ~~TD-003~~ — No Soft Delete
**Resolved:** Session 005 (2026-05-26)
`deletedAt DateTime?` added to Product, Brand, ContentPiece, EmotionalTrend, BankedSignal. `softDelete()`, `restore()`, `notDeleted()` helpers in `src/lib/db/soft-delete.ts`.

### ~~TD-004~~ — Hardcoded Model Version
**Resolved:** Session 004 (2026-05-26)
`ANTHROPIC_MODEL` env var in `claude.ts`. Defaults to `claude-sonnet-4-6`.

### ~~TD-005~~ — No Prompt Caching
**Resolved:** Session 004 (2026-05-26)
`cache_control: { type: "ephemeral" }` on all system prompt blocks in `claude.ts`. ~80% input token cost reduction on repeat calls.

### ~~TD-007~~ — No Retry Logic for Anthropic API Calls
**Resolved:** Session 004 (2026-05-26)
`withRetry<T>()` wrapper in `claude.ts` — exponential backoff, max 3 attempts.

### ~~TD-008~~ — No API Versioning
**Resolved:** Session 005 (2026-05-26)
`/api/v1/*` rewrites to `/api/*` via `src/proxy.ts`. See ADR-028.

### ~~TD-009~~ — Portfolio Page Uses Static Mock Data
**Resolved:** Session 005 (2026-05-26)
`/portfolio` is now a React Server Component that queries Prisma directly. `PortfolioCharts.tsx` is a client island for Recharts.

### ~~TD-010~~ — Publishing Engine Has No Backend Logic
**Resolved (partial):** Session 005–006 (2026-05-26)
Gumroad integration fully live (create, publish, unpublish, sync, webhook). Pinterest auto-promotion live. Etsy remains pending (TD-019).

### ~~TD-011~~ — No Error Boundaries
**Resolved:** Session 004 (2026-05-26)
`error.tsx` at app root and all major route segments.

### ~~TD-012~~ — Recharts Server-Side Rendering Warning
**Resolved:** Session 005 (2026-05-26)
`PortfolioCharts.tsx` extracted as a `"use client"` component with `mounted` guard. Chart renders only client-side.

---

## Open Debt

### TD-006 🟡 No Job Queue for Long-Running AI Calls (ESCALATED)
**File:** `src/app/api/products/batch/route.ts`

**Problem:** Originally: single product generation (15–30s) blocks the HTTP thread. Now escalated: the batch route makes 4–5 **simultaneous** Claude calls. On Vercel Pro, the 60s function timeout is approachable with complex prompts. On the free tier, batches regularly time out. No progress persistence — if the SSE connection drops mid-batch, all in-flight products are lost (the generation continues server-side but the client never receives the results).

**Remediation:** Vercel `after()` API for non-blocking execution (low-effort fix). BullMQ/Inngest for full persistent job queue (high-effort, production-grade). Each slot becomes an independent job; client polls `/api/jobs/[batchId]` for status.

**Effort:** Medium → High · **Priority:** High (escalated from Medium — batch is now core feature)

---

### TD-013 🟡 Pinterest Image URLs Require Public Hosting
**File:** `src/lib/promotions/auto-promote.ts`, `src/app/api/pinterest/pin/route.ts`

**Problem:** Pin image URLs are constructed as `${NEXT_PUBLIC_APP_URL}/product-images/{productId}.png`. In development (`http://localhost:3090/...`), Pinterest cannot fetch the image, so pins are created without images.

**Remediation:** Upload product cover images to a CDN (Vercel Blob, Cloudflare R2, S3) and store the CDN URL on `Product.coverImagePath`. Update `auto-promote.ts` to use `product.coverImagePath` when it's already a full https URL.

**Effort:** Medium · **Priority:** Medium (works in production; only affects dev testing)

---

### TD-014 🟢 Bundle productIds Not Written to DB
**File:** `src/lib/ai/batch-engine.ts`

**Problem:** `bundleProductIds Json?` field exists on `Product` but is never populated. Bundle products have no FK link to their constituent products in the database.

**Remediation:** After all non-bundle slots save, collect their `productId` values and `update` the bundle product record with `{ bundleProductIds: nonBundleIds }`.

**Effort:** Low · **Priority:** Low

---

### TD-015 🟠 Job Queue for Batch Generation (see TD-006 above)
Merged into TD-006 (same root cause, escalated together).

---

### TD-016 🟡 Rate Limiter Not Shared Across Serverless Instances
**File:** `src/lib/rate-limit.ts`

**Problem:** Rate limiter uses an in-memory LRU cache. On Vercel, each serverless invocation may run in a separate instance with its own memory. A determined user hitting multiple instances simultaneously can effectively multiply their allowed request rate.

**Remediation:** Replace in-memory store with Upstash Redis (free tier, one-line change once infrastructure is in place). `rate-limit.ts` already abstracts the store — only the implementation needs to change.

**Effort:** Low · **Priority:** Medium

---

### TD-017 🟡 NextAuth Sessions Not Persisted to Database
**File:** `src/lib/auth/config.ts`

**Problem:** NextAuth uses JWT strategy (stateless, cookie-stored sessions). Cannot invalidate a specific session server-side (e.g., on password change or account compromise). `User` model exists but NextAuth has no `@auth/prisma-adapter` — sessions, accounts, and verification tokens are not persisted.

**Remediation:** Install `@auth/prisma-adapter`. Add `Session`, `Account`, `VerificationToken` models to `prisma/schema.prisma`. Enables server-side session revocation.

**Effort:** Medium · **Priority:** Medium

---

### TD-018 🟠 PDF Generation API Route Pending (Templates Built)
**File:** `src/app/api/generate-pdf/route.ts` — not yet created

**Current state:** `@react-pdf/renderer` v4.5.1 installed. 4 PDF templates
built in `src/lib/pdf/templates/`:
- `knowledge-guide-template.tsx`
- `bingo-card-template.tsx`
- `squares-grid-template.tsx`
- `how-well-do-you-know-template.tsx`

Journal, planner, and workbook templates still needed.

**What's missing:**
- `POST /api/generate-pdf?action=generate` route
- `pdfPath String?` field on Product Prisma model
- "Generate PDF" button wired into Products page
- File saved to `/public/product-pdfs/[id].pdf`

**Effort:** Medium (was High — templates reduce work significantly)
**Priority:** Critical (blocks Etsy — digital products require a file)

---

### TD-019 🔴 Etsy OAuth + Listing Publisher Not Implemented
**File:** N/A — not yet built

**Problem:** Etsy is the primary intended revenue channel. Publishing UI on `/publishing` is static — no actual Etsy listings can be created. All "publish to Etsy" buttons are non-functional.

**Remediation:** Build Etsy OAuth 2.0 (PKCE flow). Create `EtsyConnection` Prisma model. Build `/api/etsy/route.ts` (connect/callback/status). Build `/api/etsy/publish/route.ts` (draft/upload-file/activate/sync). Build Etsy sale webhook → `RevenueRecord`. Add Etsy section to publishing page.

**Effort:** High · **Priority:** Critical (primary revenue channel)

---

### TD-020 🟢 Bundle productIds Not Written to DB
See TD-014 (duplicate entry — consolidated above).

---

### TD-022 🟢 Games Calendar Event Dates Shift Year to Year
**File:** `src/lib/ai/games-engine.ts` → `generateGameCalendar()`

**Problem:** The games calendar generates event dates from Claude's training knowledge. Sports events like the Super Bowl shift dates year to year (first Sunday in February, but not always the same date). `daysUntilPeak` and `publishUrgency` calculations may be off by up to 7 days for annual events.

**Impact:** Low — the directional guidance ("publish 4 weeks before Super Bowl") is still correct. Only the specific date math is imprecise.

**Remediation:** After Etsy OAuth is built, wire real event date lookup via public sports API (ESPN API is free for public data). For now, add a note in the games calendar UI: "Dates are approximate — verify exact event dates."

**Effort:** Low · **Priority:** Low

---

## Debt Summary

| ID | Area | Severity | Effort | Priority | Status |
|----|------|---------|--------|---------|--------|
| TD-001 | Data layer — JSON strings | 🔴 Critical | High | High | ✅ Done |
| TD-002 | Data layer — No indexes | 🟠 High | Low | Medium | ✅ Done |
| TD-003 | Data layer — No soft delete | 🟡 Medium | Medium | Medium | ✅ Done |
| TD-004 | AI — Hardcoded model | 🟠 High | Trivial | High | ✅ Done |
| TD-005 | AI — No caching | 🟠 High | Medium | High | ✅ Done |
| TD-006 | AI — No job queue (escalated) | 🟡→🟠 | High | High | Open |
| TD-007 | AI — No retry | 🟡 Medium | Low | Medium | ✅ Done |
| TD-008 | API — No versioning | 🟡 Medium | Low | Medium | ✅ Done |
| TD-009 | Feature — Portfolio mock data | 🟢 Low | Medium | High | ✅ Done |
| TD-010 | Feature — Publishing (partial) | 🟢 Low | Very High | Low | Partial |
| TD-011 | UI — No error boundaries | 🟡 Medium | Low | Medium | ✅ Done |
| TD-012 | UI — Recharts SSR warning | 🟢 Low | Low | Low | ✅ Done |
| TD-013 | Pinterest — Image URL hosting | 🟡 Medium | Medium | Medium | Open |
| TD-014 | Products — Bundle IDs not saved | 🟢 Low | Low | Low | Open |
| TD-016 | Infra — Rate limiter in-memory | 🟡 Medium | Low | Medium | Open |
| TD-017 | Auth — Sessions not in DB | 🟡 Medium | Medium | Medium | Open |
| TD-018 | Revenue — No PDF generation | 🔴 Critical | High | Critical | Open |
| TD-019 | Revenue — No Etsy integration | 🔴 Critical | High | Critical | Open |
