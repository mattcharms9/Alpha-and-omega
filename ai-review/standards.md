# Coding Standards — Alpha & Omega

These standards are enforced across the entire codebase. All new code must comply.

---

## TypeScript

- **Strict mode is ON.** `tsconfig.json` enables `strict: true`. No exceptions.
- Always define return types on exported functions.
- Prefer `interface` for object shapes, `type` for unions and computed types.
- Never use `any`. Use `unknown` and narrow with guards where necessary.
- Generic constraints must be meaningful — `<T extends object>` not `<T>` when you know the shape.
- Do not use type assertions (`as SomeType`) unless you can prove correctness. Prefer `unknown` then guard.

```typescript
// CORRECT
export async function generateProductBlueprint(
  emotionalFocus: string,
  productType: ProductType,
  audienceArchetype: string
): Promise<ProductBlueprint> { ... }

// WRONG
export async function generate(focus: any, type: any) { ... }
```

---

## API Routes (Next.js Route Handlers)

- Every route must validate its input with **Zod** before touching any service.
- Use `z.ZodError` instanceof check to return structured 400 errors.
- Never propagate raw `error.message` to the client in production — sanitize.
- Action dispatch via `?action=` query param is the established pattern. Follow it.
- All routes return `{ success: boolean, data?: T, error?: string }`.

```typescript
// CORRECT error handling pattern
} catch (error) {
  if (error instanceof z.ZodError) {
    return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 });
  }
  const message = error instanceof Error ? error.message : "Internal server error";
  return NextResponse.json({ success: false, error: message }, { status: 500 });
}
```

---

## AI Engine Layer (`src/lib/ai/`)

- Every engine file must export typed interfaces for its output.
- Every engine must have a clear `SYSTEM_PROMPT` constant at module scope.
- Use `generateJSON<T>()` for structured output, `generateWithClaude()` for free text.
- Prompts must explicitly state the expected JSON schema in the user prompt.
- AI calls must be wrapped in try/catch at the route level — never let Claude errors propagate unhandled.

---

## Component Standards

- All interactive components must be `"use client"` at the top.
- Server Components should NOT import from `"use client"` modules.
- Every page component lives at `src/app/<route>/page.tsx`.
- Use `cn()` from `lib/utils.ts` for all className merging — never raw string concatenation.
- Inline styles are acceptable for design token references (`style={{ color: "var(--gold)" }}`).
- Avoid Tailwind utility classes for complex layout — prefer inline styles with CSS variables.

---

## Styling

- All colors must reference CSS variables. No hardcoded hex values in component files.
  - Exception: Recharts chart configuration where CSS vars cannot be used.
- Animation: Use Framer Motion for interactive animations. Use CSS `@keyframes` for ambient/repeating animations.
- Use `var(--border-subtle)` / `var(--border-default)` / `var(--border-strong)` for border colors.
- Font sizes must use rem, not px.

---

## State Management

- Local UI state: `useState` (React). No global state library for single-component state.
- Cross-component state: Zustand — active-product store in `src/lib/stores/active-product.ts`. Used for Products → Content → Publishing cross-engine workflow. If adding new cross-component state, create a new store in `src/lib/stores/`.
- Server state / fetched data: Direct `fetch` in event handlers (current pattern). Do not introduce SWR/React Query unless complexity demands it.
- Loading states: Always track loading with a boolean. Never infer "loading" from data being null.
- Error states: Always track error separately from loading. Both can be true simultaneously during retries.

---

## Naming Conventions

| Entity | Convention | Example |
|--------|-----------|--------|
| Component files | PascalCase | `Card.tsx`, `Sidebar.tsx` |
| Utility functions | camelCase | `formatNumber()`, `cn()` |
| Type/Interface names | PascalCase | `ProductBlueprint`, `EmotionalTrend` |
| CSS custom properties | kebab-case | `--bg-void`, `--gold-glow` |
| API action params | kebab-case | `?action=generate`, `?action=batch` |
| Prisma models | PascalCase | `EmotionalTrend`, `ContentPiece` |
| Database fields | camelCase | `monetizationScore`, `painPoint` |
| Route folders | kebab-case | `intelligence/`, `digital-system` |

---

## Error Handling

- **Never swallow errors silently.** If you catch an error and don't re-throw, you must log it.
- Always use `console.error()` for caught errors on the server (not `console.log()`).
- All async operations must have `.catch()` or `try/catch`.
- User-facing error messages must be human-readable, not raw stack traces or technical error codes.
- The pattern for client-side error display is `setError(message)` → render an error card.

---

## Environment Variables

- All secrets go in `.env`. Never commit `.env` to version control.
- Access via `process.env.VARIABLE_NAME`. Never destructure at module scope.
- If a required env var is missing, fail loudly at startup, not silently at runtime.
- Never log env var values, even in development.

---

## File Size Limits

| Category | Soft Limit | Hard Limit |
|----------|-----------|-----------|
| Page components | 400 lines | 600 lines |
| UI components | 150 lines | 250 lines |
| AI engine files | 150 lines | 200 lines |
| API route handlers | 50 lines | 80 lines |
| Utility files | 100 lines | 150 lines |

Split files that exceed these limits into focused sub-modules.

---

## Post-Update Verification Protocol

**Every time Claude Code makes changes to this codebase, it MUST run
these commands in this exact order before declaring work complete:**

```bash
# 1. Regenerate Prisma if schema changed
npx prisma generate

# 2. TypeScript — must be zero errors
npx tsc --noEmit

# 3. Production build — must pass
npm run build

# 4. Full health check (catches banned patterns + env vars)
npm run health
```

**If any of these fail, the session is NOT complete.**
Fix the failures first. Then re-run the full sequence.
A passing build is the only definition of done.

**Claude Code must verify after every session:**
- [ ] `npm run build` passes with 0 errors
- [ ] `npx tsc --noEmit` shows 0 errors
- [ ] `npx prisma validate` shows valid schema
- [ ] No new `any` types introduced
- [ ] No hardcoded hex colors introduced (exceptions: Recharts config, platform brand colors)
- [ ] No `JSON.stringify` added to Prisma data writes
- [ ] `ai-review/STATUS.md` updated with session changes
- [ ] `ai-review/review-history.md` has new session entry

**From this point forward, `npm run health` must be run after EVERY set of
changes to `src/`, no matter how small. A one-line change can break a
TypeScript type. A schema change can invalidate the Prisma client.
The health check takes ~60 seconds and catches everything.**

The only exception: purely documentation changes to `ai-review/` files.
