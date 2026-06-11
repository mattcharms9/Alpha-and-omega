# Recurring Issues — Alpha & Omega

Patterns of mistakes or risks that have appeared more than once. Track these to prevent recurrence.

---

## RI-001: Zod v4 Breaking API Assumptions

**First seen:** 2026-05-25 (build failure)
**Occurrences:** 3 (all three original API route files)

**Pattern:** Code written assuming Zod v3 API:
- `error.errors` → should be `error.issues` in Zod v4
- `z.record(z.unknown())` → requires 2 args in Zod v4: `z.record(z.string(), z.unknown())`

**Why it happens:** Zod v4 is a major version with breaking changes. Documentation examples may still show v3 syntax.

**Prevention:**
- Always check `package.json` for Zod version before writing Zod code
- Run `npm run build` before considering work complete — build catches this

---

## RI-002: Prisma 7 Config Format Misunderstanding

**First seen:** 2026-05-25
**Occurrences:** 1

**Pattern:** Placing `url = env("DATABASE_URL")` in `schema.prisma` datasource block — valid in Prisma 6, not in Prisma 7. In Prisma 7, connection URL moves to `prisma.config.ts`.

**Prevention:** In Prisma 7, `schema.prisma` datasource has only `provider`. Connection config lives in `prisma.config.ts` `datasource.url`. Always check the migration guide when upgrading Prisma.

---

## RI-003: Type Assertion Cascade (`as unknown as T`)

**First seen:** 2026-05-25
**Occurrences:** Multiple

**Pattern:** Using `as unknown as T` to force a type assertion when types don't overlap. This silences TypeScript but doesn't make the code correct — it just moves the error to runtime.

**Root cause:** The API route receives an opaque `body` object. Zod schemas return `Record<string, unknown>` but engine functions expect specific typed interfaces.

**Better fix:** Define Zod schemas that match the engine's expected type, or pass the validated body directly without intermediate cast. Use `z.object({ ... })` shaped like the target type.

---

## RI-004: Motion Component Hover Handlers Accept Wrong Signature

**First seen:** 2026-05-25
**Occurrences:** Multiple

**Pattern:** Passing `onClick={(e) => { e?.stopPropagation(); }}` to a component whose `onClick` prop is typed as `() => void`. TypeScript rejects the parameter even if `e` is optional.

**Why it happens:** Custom Button component and some Framer Motion components type `onClick` as `() => void`, not `(e: React.MouseEvent) => void`.

**Prevention:**
- Use a native `<button>` or wrapper `<div onClick={(e) => e.stopPropagation()}>` when you need the event
- Or update the component's prop type to accept `React.MouseEventHandler`

---

## RI-005: Client Components Rendered During Static Build Cause Chart Warnings

**First seen:** 2026-05-25
**Occurrences:** 1 (Recharts)

**Pattern:** Recharts `ResponsiveContainer` uses DOM measurement APIs unavailable during static generation. Results in `width(-1) height(-1)` warnings.

**Fix:** Use `"use client"` + `mounted` guard. **Resolved** by extracting `PortfolioCharts.tsx` as a client island (Session 005).

---

## RI-006: Prisma Json Type — Never JSON.stringify/JSON.parse

**First seen:** Session 005 (2026-05-26)
**Occurrences:** Multiple during schema migration

**Pattern:** After migrating `String` JSON columns to Prisma `Json` type, code that previously did `JSON.stringify(array)` before saving must be updated to pass the raw object. Similarly, code that previously did `JSON.parse(field)` after reading must be updated to use the value directly. TypeScript may not catch this because `Json` accepts string values.

**Prevention:** After any schema migration involving `Json` types, grep for `JSON.stringify` and `JSON.parse` in route handlers and engine files. Pass objects directly to Prisma `Json` fields.

---

## RI-007: Server-Only Modules Bleeding Into Client Bundle via Shared AI Files

**First seen:** Session 007 (2026-05-27) — Turbopack build failure
**Occurrences:** 1 (would recur whenever client components import from AI engine files)

**Pattern:** A client component (`BatchView.tsx`) imports from an AI engine file (`mix-engine.ts`). The engine file imports `claude.ts`, which imports `@anthropic-ai/sdk`, which imports `node:fs/promises`. Turbopack refuses to bundle Node.js-only modules for the browser.

**Error message:** `the chunking context (unknown) does not support external modules (request: node:fs/promises)`

**Fix:** Extract any types or constants that client components need into a separate `*-types.ts` file that has NO import from `claude.ts` or any server-only module. The `src/lib/ai/mix-types.ts` file was created for exactly this reason.

**Prevention:** If a client component needs types or constants from an AI engine, check whether the engine imports `claude.ts`. If yes, create a companion `*-types.ts` file. The rule: **client components must never import any file in `src/lib/ai/` except `mix-types.ts`**.

---

## RI-008: Prisma Client Not Regenerated After Schema Changes

**First seen:** Session 007 (2026-05-27) — TypeScript error on `dailyBatchLog`
**Occurrences:** 1 (but easy to repeat)

**Pattern:** `npx prisma db push` applies schema changes to the database but does NOT regenerate the Prisma client. TypeScript then reports that the new model doesn't exist on `PrismaClient`:
```
Property 'dailyBatchLog' does not exist on type 'PrismaClient'
```

**Fix:** Always run `npx prisma generate` after any schema change, even if `prisma db push` already ran. Order: (1) edit schema → (2) `npx prisma db push` → (3) `npx prisma generate` → (4) `npx tsc --noEmit` to verify.

---

## RI-009: Pinterest Pin Images Must Be Publicly Accessible URLs

**First seen:** Session 006 (2026-05-26) — TD-013
**Occurrences:** 1

**Pattern:** Pinterest's API requires pin images to be fetched from a public URL. Using `http://localhost:3090/product-images/...` fails silently — the pin is created but without an image.

**Prevention:** When testing Pinterest integration locally, use ngrok to expose localhost, or skip pinning and test only in production where a real domain is configured.

---

## RI-010: Cron Routes Missing from STATUS.md After Addition

**First seen:** Session 008 (2026-05-27)
**Occurrences:** 1 — 5 crons referenced in documentation, only 2 actually built

**Pattern:** A new cron job is added (or planned) but STATUS.md feature table and cron section are not updated to reflect the actual state. Creates a gap between documented features and reality.

**Prevention:** Any time a new `/api/cron/*` route is created:
1. Add the route file with CRON_SECRET check as the first guard
2. Add it to `vercel.json` crons array with the correct schedule
3. Add it to STATUS.md cron section with schedule
4. Add it to the feature table if it powers a user-visible feature
Do NOT add cron entries to STATUS.md for routes that haven't been built yet.

---

## RI-011: New Prisma Models Not Added to repository-summary.json

**First seen:** Session 008 (2026-05-27)
**Occurrences:** 1 — EmpireConfig model missing from databaseModels array

**Pattern:** A new model is added to `prisma/schema.prisma` and migrated, but `repository-summary.json` databaseModels array is not updated. Future AI sessions have an incomplete picture of the data model.

**Prevention:** After every `prisma migrate dev` or `prisma db push` that adds a model, update `repository-summary.json` databaseModels before ending the session. Also update `buildInfo.pageCount`, `sessionsCompleted`, and `openGaps` as applicable.

---

## RI-012: @react-pdf/renderer Compatibility with Next.js App Router

**First seen:** Session 012 (2026-05-27) — template build
**Occurrences:** Watch for

**Pattern:** `@react-pdf/renderer` uses browser/Node.js APIs that conflict
with Next.js App Router's server-side rendering. Common issues:
1. `canvas` module required for image rendering — must be installed separately
   if PDF templates include images: `npm install canvas`
2. Dynamic imports required — PDF generation must be called server-side only,
   never imported directly in `"use client"` components
3. Template files (.tsx) must NOT be "use client" — they render server-side
   via renderToBuffer()
4. Font registration must happen at module scope, not inside render functions

**Prevention:**
- Keep all PDF template files in `src/lib/pdf/templates/` — server-side only
- The API route calls `renderToBuffer()` — never call this client-side
- Test `npm run build` after any template change — SSR incompatibilities
  surface at build time, not at runtime

---

## RI-013: OAuth Proxy Exemptions Must Use Full Path Including Query String

**First seen:** Session 023 (Etsy OAuth)
**Pattern:** `req.nextUrl.pathname` strips query parameters. `PUBLIC_API_PATHS` entries like `"/api/etsy?action=callback"` never match against `pathname` alone — the callback gets a 401 from the API key check even though it's in the allowlist.

**Fix applied in proxy.ts:** `const fullPath = pathname + req.nextUrl.search;` — check both `fullPath.startsWith(p)` and `pathname.startsWith(p)` so query-param entries AND plain path entries both match.

**Prevention:** When adding any OAuth callback, add it to `PUBLIC_API_PATHS` with the full query string AND verify the proxy uses `fullPath`.

---

## RI-014: Env Var Renames Must Be Synced to Vercel Dashboard Immediately

**First seen:** Sessions 023–024 (ETSY_CLIENT_ID → ETSY_API_KEY rename)
**Pattern:** Renaming an env var in code and `.env` only works locally. Vercel keeps serving the old name, so the header sends `undefined`, causing 403s from third-party APIs that look like auth failures — not obvious config errors.

**Fix:** After any env var rename: update Vercel dashboard the same session. Never silently fall back to `undefined` — `getEtsyApiKey()` now throws loudly if the var is missing.

**Prevention:** Deployment checklist must include "update Vercel env var name in dashboard" after any rename.

---

---

## RI-015: Client Page Fetches Must Use apiFetch, Not plain fetch()

**First seen:** Session 029 (2026-06-10)
**Occurrences:** 1 — entire launch-queue page body was empty despite 12 cards in DB

**Pattern:** A "use client" page uses `fetch("/api/...")` directly. The proxy (`src/proxy.ts`) requires `x-api-key` on every non-public API route. Plain `fetch()` sends no headers → 401 → `json.success = false` → state never set → empty UI rendered. Meanwhile the Sidebar used `apiFetch()` and worked fine, making it appear the data existed but the page couldn't see it.

**Why it happens:** Copying fetch calls from documentation examples or non-auth codebases that don't have API key middleware.

**Fix:** Every fetch to `/api/*` from a client component must use `apiFetch(url, { credentials: "include" })` from `@/lib/api.ts`. This injects `x-api-key: NEXT_PUBLIC_API_KEY` automatically.

**Prevention:** Never use plain `fetch()` in client components for internal API calls. Grep for `fetch("/api/` and `fetch(\`/api/` before shipping any client component.

---

## RI-016: Always Verify Prisma Queries Use include for Relations

**First seen:** Session 029 diagnosis (2026-06-10) — confirmed already correct in this case

**Pattern:** A route fetches `prisma.dailyQueue.findUnique({ where: ... })` without `include: { cards: true }`. The relation is never loaded. The response returns `{ cards: undefined }` or the field is missing entirely. The client-side type assertion masks this — the page reads `queue.cards.length` and crashes or shows empty.

**Prevention:** Any time a model has a relation that the consumer needs, verify the Prisma query has `include: { relationName: true }` (or `select` with the relation). Treat missing include as a bug equal to a missing WHERE clause.

---

## RI-017: Never Gate Page Rendering on a Specific queue.status String

**First seen:** Session 028/029 analysis

**Pattern:** A component renders cards only when `queue.status === "ready"`. If the queue has status `"partial"` or `"complete"` (or any future value), the condition is false and the page shows the empty state even though `queue.cards.length > 0`.

**Fix:** Gate on data presence: `cards.length > 0`. The status string is metadata, not a render gate.

**Prevention:** Search for `queue.status ===` or `data.status ===` in render conditions. Replace with `cards.length > 0` or equivalent data-presence check.

---

## RI-018: Etsy API Silent Failure Poisons the DB with Garbage Data

**First seen:** Session 030 (2026-06-10) — 12 reports saved with totalListings: 0, AI-fabricated scores
**Occurrences:** 1

**Pattern:** All Etsy API calls in `run-scan.ts` used `.catch(() => [])` — swallowed every error with no logging. When the Etsy API returned non-OK responses (rate limit, transient error, etc.), all 4 calls returned empty arrays. `analyzeNicheMarket` still ran with empty inputs and the AI fabricated scores from training knowledge. Reports were saved with `totalListings: 0` and no real market data. The agent pipeline then used these as "live data," causing every card to show "0 listings."

**Fix:** Three-part defense:
1. Named catch handlers: `.catch((err) => { console.error(...) })` — Vercel logs show the actual error
2. Quality gate in `runNicheScan`: if all Etsy calls return empty, skip saving — return `{ report: null, totalListings: 0 }`
3. `market-scout-agent.ts` filters: `usableReports = liveReports.filter(r => r.totalListings > 0)` — falls through to AI fallback if no valid reports

**Prevention:** Any function that calls an external API and saves results must: (a) log errors explicitly, (b) validate data quality before persisting, (c) downstream consumers must filter out zero/empty data.

---

## RI-019: Every Route Doing Async Work Needs `export const maxDuration`

**First seen:** Multiple sessions (028, 030)
**Occurrences:** 2+ — cron/run-agent-queue (028), cron/market-intelligence (030), market-intelligence POST (030)

**Pattern:** A Vercel serverless route does long-running async work (AI calls, 25-niche Etsy scan, agent pipeline) but has no `export const maxDuration`. Vercel Hobby default is 10 seconds. The function times out silently — partial work may have been done but the response indicates failure. Even with `vercel.json` functions config, the code-level export is the authoritative override in Next.js App Router.

**Fix:** Every route handler that makes AI calls, runs a pipeline, or does any scan must have:
```typescript
export const maxDuration = 300;
export const dynamic = "force-dynamic";
```

**Prevention:** Checklist item added below. Grep for `runFullScan`, `runManagerAgent`, `generateJSON`, `runBuildPipeline` — every route containing these must have the exports.

---

## RI-020: Vercel Read-Only Filesystem Breaks File Generation

**First seen:** Session 031 (2026-06-11)
**Occurrences:** 1 — build pipeline stalled at "Mockups generated" in production

**Pattern:** Code that writes generated files (PDFs, images) to `path.join(process.cwd(), "public", ...)` works locally but throws `EROFS: read-only file system` on Vercel. `process.cwd()` = `/var/task/` in the Vercel runtime — the deployment artifact root, which is read-only. Stages that needed these files downstream (Etsy upload) silently failed because the files were never created.

**Why it cascaded:** `generateProductMockups` used `Promise.allSettled` — it never rejected even when all writes failed. The pipeline marked stage 5 ("mockups") as complete despite writing nothing. Stages 2 and 3 DID fail (with logged errors), but since they were non-fatal, the pipeline continued. Stage 6 (Etsy) was then silently skipped because `pdfPath` and `coverImagePath` were null.

**Fix:** Write all generated files to `/tmp/{subdir}/{filename}` as the primary path. Also attempt `public/` write non-fatally for local dev serving. Read from `/tmp/` in any downstream consumer (e.g., Etsy upload). Use `basename()` to extract the filename before `.catch()` callbacks to preserve TypeScript narrowing.

**Prevention:** Any function that writes a generated file must:
1. Use `/tmp/` as the primary write target
2. Attempt `public/` non-fatally (`await fs.writeFile(publicPath, buf).catch(() => {})`) for local dev
3. Any consumer that reads the file must try `/tmp/` first, fall back to `public/`
4. `Promise.allSettled` results should be checked — if all fail, throw so callers can mark the stage as failed

---

## RI-021: gpt-image-1 Rejects "standard" Quality — Valid Values Are low/medium/high/auto

**First seen:** Session 032 (2026-06-11) — E2E test, mockup stage
**Occurrences:** 1

**Pattern:** `openai.images.generate({ model: "gpt-image-1", quality: "standard" })` returns HTTP 400: `Invalid value: 'standard'. Supported values are: 'low', 'medium', 'high', and 'auto'`. The `"standard"` value is valid for `dall-e-3` and `dall-e-2`, but gpt-image-1 uses a different quality scale.

**Fix:** Changed mockup generation in `image-service.ts` to `quality: "medium"`. Cover image generation already used `quality: "high"` — correct.

**Prevention:** When switching image model from dall-e-3 to gpt-image-1, audit all `quality:` parameters. Valid values for gpt-image-1: `"low"`, `"medium"`, `"high"`, `"auto"`. `"standard"` and `"hd"` are dall-e-3/dall-e-2 only.

---

## RI-022: MarketIntelligenceReport Date Filter Must Use 48h `createdAt` Lookback

**First seen:** 2026-06-11 (Session 033)
**Occurrences:** 1 (affected manager-agent, market-scout-agent, analyzer, run-scan — 4 files simultaneously)

**Pattern:** Queries for recent market reports used `where: { reportDate: todayString }` — a string comparison against a field that stores a local date. Reports saved at UTC midnight for the day before appear invisible the next morning. Cross-midnight scans (e.g., cron at 04:22 UTC) save with `reportDate = "yesterday"` but are relevant today. All 18 real reports in the DB were invisible to the agent.

**Fix:** Always use `createdAt: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) }` — a 48-hour DateTime lookback on the actual row creation timestamp. This is timezone-independent and catches any scan from the last 2 days.

**Prevention:** Never filter MarketIntelligenceReport by `reportDate` string. The `createdAt` DateTime field is the only reliable filter for "recent" data.

---

## RI-023: Etsy CreateListing API Requires `type`, `taxonomy_id`, and `when_made: "2020_2026"`

**First seen:** 2026-06-11 (Session 033)
**Occurrences:** 1

**Pattern:** Etsy v3 API `POST /application/shops/{shopId}/listings` requires:
- `type: "download"` for digital products (without it, defaults to physical and demands `shipping_profile_id`)
- `taxonomy_id` (any valid leaf node ID — see Etsy taxonomy API; 354 = Calendars & Planners, 1303 = Stationery, 6344 = Tutorials, 1347 = Party Favors & Games)
- `when_made: "2020_2026"` not `"2020_2024"` (that enum value doesn't exist)
- Upload `name` field as explicit FormData entry (not just the blob filename in Content-Disposition)
- Upload filename must match `[a-zA-Z0-9\s-]` — special chars like `|` and `+` cause 400

**Prevention:** Use `TAXONOMY_BY_FORMAT` map for format → taxonomy_id. Always include `type: "download"` and `when_made: "2020_2026"`. Sanitize product title before using as upload filename: `title.replace(/[^a-zA-Z0-9\s-]/g, "").replace(/\s+/g, "-").slice(0, 60)`. Add `formData.append("name", filename)` explicitly.

---

## Prevention Checklist

Before submitting code for review, verify:

- [ ] Zod schemas use v4 API (`error.issues`, `z.record(z.string(), ...)`)
- [ ] Prisma schema datasource has no `url` field (Prisma 7 config)
- [ ] No `JSON.stringify`/`JSON.parse` in data access code (use Prisma Json directly)
- [ ] `onClick` handlers match the component prop signature exactly (`() => void`)
- [ ] Browser-API-dependent components use `dynamic` with `ssr: false` or `mounted` guard
- [ ] Client components do NOT import from `src/lib/ai/*.ts` (except `mix-types.ts`)
- [ ] After schema changes: run `npx prisma generate` (not just `db push`)
- [ ] `npm run build` passes before considering work complete
- [ ] All client-side `/api/*` fetches use `apiFetch()`, never plain `fetch()`
- [ ] Prisma queries that need relations use `include:` — never assume the field is present
- [ ] Render gates use `data.length > 0`, never `status === "specificString"`
- [ ] Any route calling AI, running a pipeline, or doing multi-step scans has `export const maxDuration = 300` + `export const dynamic = "force-dynamic"`
- [ ] External API callers log errors explicitly — never `.catch(() => [])` alone; always `.catch((err) => { console.error(...); return []; })`
- [ ] Functions that persist external API data validate quality before saving (don't persist empty/zero results)
- [ ] File generation functions write to `/tmp/` first, then non-fatally to `public/`; downstream readers try `/tmp/` first
- [ ] `Promise.allSettled` result arrays: check if ALL failed — throw if so, rather than resolving vacuously with empty results
- [ ] MarketIntelligenceReport queries use `createdAt: { gte: 48h cutoff }` — never `reportDate: todayString`
- [ ] Etsy listing creation includes `type: "download"`, `taxonomy_id`, `when_made: "2020_2026"`, and sanitized filename with explicit `name` FormData field
