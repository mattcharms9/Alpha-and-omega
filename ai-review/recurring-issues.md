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
