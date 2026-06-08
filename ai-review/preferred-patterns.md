# Preferred Patterns — Alpha & Omega

Patterns that work well in this codebase and should be followed consistently.

---

## 1. Typed AI Engine Outputs

Always define TypeScript interfaces for everything a Claude call can return. This creates a contract between the AI layer and the UI layer.

```typescript
// PREFERRED — explicit interface
export interface EmotionalTrend {
  id: string;
  emotion: string;
  painPoint: string;
  monetizationScore: number;
  // ...all fields typed
}

// Then use as generic parameter
return generateJSON<EmotionalIntelligenceReport>(SYSTEM_PROMPT, prompt, 8000);
```

**Why:** When Claude returns unexpected fields or omits optional ones, TypeScript prevents silent breakage.

---

## 2. Module-scoped System Prompts

Keep system prompts as `const SYSTEM_PROMPT` at the top of each engine file — not inlined in function calls.

```typescript
// PREFERRED
const SYSTEM_PROMPT = `You are the Emotional Intelligence Engine...`;

export async function discoverEmotionalTrends(...) {
  return generateJSON<T>(SYSTEM_PROMPT, userPrompt, 8000);
}
```

**Why:** Prompts are the core "logic" of AI engines. Module scope makes them easy to find, review, and iterate on without touching function internals.

---

## 3. Action-based API Routing

Use a single POST endpoint per domain with `?action=` query param dispatch — not separate endpoints per operation.

```typescript
// PREFERRED — one endpoint, action dispatch
POST /api/intelligence?action=scan
POST /api/intelligence?action=score

// AVOID — endpoint proliferation
POST /api/intelligence/scan
POST /api/intelligence/score
```

**Why:** Keeps the API surface minimal. Easier to add middleware (auth, rate limiting, logging) to a single handler.

---

## 4. Response Envelope

All API routes return a consistent envelope:

```typescript
// PREFERRED
{ success: true, data: T }     // 200
{ success: false, error: string }  // 400 | 500
```

Never return bare data without the envelope.

---

## 5. CSS Variable References for Design Tokens

Always reference the design system via CSS custom properties, never hardcode colors.

```typescript
// PREFERRED
style={{ color: "var(--gold)", background: "var(--bg-elevated)" }}

// AVOID
style={{ color: "#c9a84c", background: "#111118" }}
```

**Why:** Changing the design system only requires updating `globals.css`. No grep-and-replace across components.

---

## 6. Framer Motion Hover Pattern

Use `motion.div` with `whileHover` and `transition` for interactive elements.

```typescript
// PREFERRED
<motion.div
  whileHover={{ y: -1, borderColor: "var(--border-strong)" }}
  transition={{ duration: 0.15 }}
>
```

Keep `duration` under 0.2 for micro-interactions, 0.3–0.5 for entrances.

---

## 7. Zod Schema → Parse → Destructure

Always validate before touching request body fields.

```typescript
// PREFERRED
const ScanSchema = z.object({
  focusArea: z.string().optional(),
  count: z.number().min(1).max(20).optional().default(8),
});

const { focusArea, count } = ScanSchema.parse(body);
```

Define schemas at module scope, not inside the handler function.

---

## 8. Staggered Entry Animations

Use `delay: index * 0.06` (or similar) for list item entrances — not all items at delay 0.

```typescript
// PREFERRED
transition={{ duration: 0.4, delay: index * 0.06 }}
```

**Why:** Staggered animations feel intentional and premium. Simultaneous entrance feels like a page refresh.

---

## 9. Loading → Empty → Error → Content State Machine

Every data-fetching page must explicitly handle all four states:

```typescript
// PREFERRED state ordering in render
{loading && <ShimmerCards />}
{error && <ErrorBanner message={error} />}
{!data && !loading && !error && <EmptyState />}
{data && !loading && <Results data={data} />}
```

Never collapse empty + error into the same state.

---

## 10. Singleton Database Client

Always import Prisma from `lib/db/prisma.ts`, never instantiate directly in a module.

```typescript
// PREFERRED
import { prisma } from "@/lib/db/prisma";

// AVOID
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient(); // Creates a new connection pool every import
```

---

## 11. Expandable Disclosure Pattern

For complex cards with optional detail, use `AnimatePresence` + `useState(false)` toggle — not separate routes or modals.

```typescript
const [expanded, setExpanded] = useState(false);

<AnimatePresence>
  {expanded && (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
    >
      {/* details */}
    </motion.div>
  )}
</AnimatePresence>
```

---

## 12. Client-Safe Type Extraction Pattern

When a client component needs types or constants from an AI engine file, and that engine file imports `claude.ts`, extract the client-needed exports into a separate `*-types.ts` file:

```typescript
// src/lib/ai/mix-types.ts — NO import from claude.ts or any server-only module
export type ProductFormat = "journal" | "planner" | ...
export const PRICING_TIERS: Record<ProductFormat, PricingTier> = { ... }

// src/lib/ai/mix-engine.ts — server-only, imports claude.ts
import { generateJSON } from "./claude";
import type { BatchPlan } from "./mix-types";
import { PRICING_TIERS } from "./mix-types";
export type { BatchPlan };        // re-export for convenience

// BatchView.tsx (client component) — safe import
import type { BatchPlan } from "@/lib/ai/mix-types";  // NOT mix-engine
import { PRICING_TIERS } from "@/lib/ai/mix-types";
```

**Why:** Importing from AI engine files in client components pulls the Anthropic SDK into the browser bundle, which includes Node.js modules (`node:fs/promises`) that Turbopack refuses to bundle for the browser. See RI-007.

---

## 13. useMemo for Stable Fetch Headers

When a client component passes headers to a `useCallback` function, memoize the headers object to avoid recreating the callback on every render:

```typescript
// PREFERRED — stable reference
const headers = useMemo(
  () => ({ "Content-Type": "application/json", "x-api-key": apiKey }),
  [apiKey]
);

const handleSubmit = useCallback(async () => {
  const res = await fetch("/api/products", { headers, body: JSON.stringify(data) });
}, [headers, data]);  // headers reference is stable — callback only recreates when apiKey changes
```

**Why:** An inline object `const headers = { ... }` creates a new reference every render. `useCallback` with that as a dependency recreates the callback every render, defeating its purpose.

---

## 14. Non-Fatal Side Effect Pattern

For operations that enrich the core flow but must never break it (analytics sync, pin creation, email alerts), always wrap in try/catch and swallow the error:

```typescript
// PREFERRED — core operation succeeds even if side effect fails
async function publishProduct(productId: string) {
  const result = await gumroad.createProduct({ ... });  // core — throws if fails

  void autoPromoteProduct(productId).catch((err) => {   // side effect — swallowed
    console.error("[auto-promote] Failed, skipping:", err);
  });

  return result;
}
```

**Why:** Auto-promotion, analytics, email alerts, and pin creation are enhancement layers. A Pinterest API failure at 3am should not prevent a product from publishing. The `void` keyword explicitly marks the fire-and-forget intent.

---

## 15. SSE Streaming Route Pattern

For operations that take 15–60s and benefit from streaming progress, use `TransformStream`:

```typescript
export async function POST(req: NextRequest) {
  // validation + rate limiting first
  const encoder = new TextEncoder();
  const stream = new TransformStream<Uint8Array, Uint8Array>();
  const writer = stream.writable.getWriter();

  const send = async (data: object) => {
    await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
  };

  void (async () => {
    try {
      await send({ type: "started" });
      // ... parallel work ...
      await send({ type: "complete" });
    } catch {
      await send({ type: "error", message: "..." });
    } finally {
      await writer.close().catch(() => {});  // always close, even on exception
    }
  })();

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}

// Client consumption:
const res = await fetch(url, { method: "POST", ... });
const reader = res.body!.getReader();
const decoder = new TextDecoder();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const lines = decoder.decode(value).split("\n").filter(l => l.startsWith("data: "));
  for (const line of lines) {
    const event = JSON.parse(line.slice(6));
    // handle event types
  }
}
```

---

## 16. Icon + Background Chip Pattern

Use this consistent pattern for iconography throughout the UI:

```typescript
<div style={{
  width: 36,
  height: 36,
  borderRadius: 10,
  background: `${color}18`,       // 10% opacity fill
  border: `1px solid ${color}30`, // 19% opacity border
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
}}>
  <Icon size={16} style={{ color }} />
</div>
```
