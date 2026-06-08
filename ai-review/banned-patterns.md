# Banned Patterns — Alpha & Omega

Patterns that must **never** appear in this codebase. Violations must be fixed immediately.

---

## CRITICAL — Security

### 1. Hardcoded Secrets in Source Code

```typescript
// BANNED — NEVER do this
const apiKey = "sk-ant-api03-...";
const dbPassword = "mypassword123";
const webhookSecret = "whsec_...";
```

**Why it's banned:** Secrets in source code get committed to git history and can never be truly removed. Any collaborator, CI runner, or leaked repo exposes production credentials.

**Fix:** Use `process.env.VARIABLE_NAME`. Document required vars in `.env.example` with placeholder values only.

---

### 2. Logging Sensitive Data

```typescript
// BANNED
console.log("API Key:", process.env.ANTHROPIC_API_KEY);
console.log("User request body:", JSON.stringify(body)); // may contain PII
console.error("Database error:", error); // may expose connection string
```

**Fix:** Log intent, not values. `console.error("Database operation failed", error.code)`.

---

### 3. Exposing Raw Error Messages to Clients

```typescript
// BANNED — leaks implementation details
return NextResponse.json({ error: error.message }, { status: 500 });
// error.message might be: "Connection to postgresql://user:password@host:5432/db failed"
```

**Fix:** Sanitize all error messages before sending to client. Map known error types to safe messages.

---

## HIGH — Architecture

### 4. Direct PrismaClient Instantiation Outside the Singleton

```typescript
// BANNED
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient(); // Breaks connection pooling in dev (hot reload)
```

**Fix:** Always `import { prisma } from "@/lib/db/prisma"`.

---

### 5. Unvalidated Request Bodies

```typescript
// BANNED — accessing body fields without validation
export async function POST(req: Request) {
  const body = await req.json();
  const result = await doSomethingWith(body.emotionalFocus); // No validation!
}
```

**Fix:** Always define and call a Zod schema before touching any body field.

---

### 6. AI Engine Logic Inside Route Handlers

```typescript
// BANNED — mixing transport and business logic
export async function POST(req: NextRequest) {
  const body = await req.json();
  // Building prompts, calling Anthropic directly here... NO
  const result = await anthropic.messages.create({ ... });
}
```

**Fix:** Route handlers are transport layer only. All AI logic lives in `src/lib/ai/`.

---

### 7. Importing Server-only Modules in Client Components

```typescript
// BANNED in any "use client" component
import { prisma } from "@/lib/db/prisma"; // Will blow up in browser
import Anthropic from "@anthropic-ai/sdk"; // Contains server-only code
```

**Fix:** Client components fetch via API routes only. Never import Node.js modules in client code.

---

## MEDIUM — Code Quality

### 8. Hardcoded Colors in Components

```typescript
// BANNED
style={{ color: "#c9a84c" }}   // What color is this? No context.
style={{ background: "#050507" }}
```

**Fix:** `style={{ color: "var(--gold)" }}`, `style={{ background: "var(--bg-void)" }}`.

---

### 9. Using `any` Type

```typescript
// BANNED
function processData(data: any) { ... }
const result: any = await fetchSomething();
```

**Fix:** Use `unknown` and narrow, or define the proper interface.

---

### 10. Unhandled Promise Rejections

```typescript
// BANNED — fire and forget without error handling
someAsyncOperation().then(doSomething);
// If someAsyncOperation rejects, the error is swallowed
```

**Fix:** Always `await` or chain `.catch()`. Use try/catch in async functions.

---

### 11. Direct Array Mutation

```typescript
// BANNED
const items = getItems();
items.push(newItem); // Mutates external state, causes bugs with React
items.sort(...);     // Mutates in place
```

**Fix:** `[...items, newItem]`, `[...items].sort(...)`.

---

### 12. Giant Page Files

```
// BANNED
src/app/products/page.tsx  >600 lines of combined UI + logic
```

**Fix:** Extract sub-components to `src/components/<domain>/`, extract hooks to `src/hooks/`.

---

### 13. Inline API Schemas (Defined Inside Handler Functions)

```typescript
// BANNED — schema defined inside the function, recreated every request
export async function POST(req: NextRequest) {
  const Schema = z.object({ ... }); // Don't do this
  Schema.parse(body);
}
```

**Fix:** Define schemas at module scope as named constants.

---

### 14. Stale Closures in useEffect Without Proper Dependencies

```typescript
// BANNED
useEffect(() => {
  doSomethingWith(stateValue); // stateValue not in deps array
}, []); // Stale closure bug
```

**Fix:** Include all dependencies in the dependency array, or use useCallback/useRef where appropriate.

---

## LOW — Style

### 15. JSX Comments Instead of Actual Refactoring

```typescript
// BANNED
{/* TODO: fix this later */}
{/* HACK: workaround for Recharts SSR issue */}
```

**Fix:** Track as a task in `technical-debt.md`. Do not accumulate comment debt.

---

### 16. className String Concatenation

```typescript
// BANNED
className={"base-class " + (isActive ? "active" : "") + " " + extraClass}
```

**Fix:** `className={cn("base-class", isActive && "active", extraClass)}`
