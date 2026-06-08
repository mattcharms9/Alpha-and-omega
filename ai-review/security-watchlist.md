# Security Watchlist — Alpha & Omega

**SANITIZED — Contains zero secrets, credentials, tokens, or sensitive values.**

All entries describe structural risks, not specific values.

---

## ✅ RESOLVED

### ~~SEC-001~~ — No Authentication on API Routes
**Resolved:** Session 004 (2026-05-26)
`src/proxy.ts` validates `x-api-key` header on all `/api/*` routes. Routes exempted from auth: `/api/auth/*`, `/api/cron/*`, `/api/gumroad/webhook`, Pinterest OAuth callback/connect. See ADR-024.

### ~~SEC-002~~ — No Rate Limiting on AI Endpoints
**Resolved:** Session 004 (2026-05-26)
`rateLimit(req, { limit, windowMs })` from `src/lib/rate-limit.ts` applied on every AI-calling route. Standard: 10/min. Batch: 3/min. See ADR-019. Note: in-memory store (see TD-016 for multi-instance caveat).

### ~~SEC-003~~ — Raw Error Message Propagation to Client
**Resolved:** Session 001 (2026-05-25)
`toSafeErrorMessage(error)` in `src/lib/errors.ts` maps known error types to safe client strings. All route catch blocks use this pattern. No `error.message` directly to client.

### ~~SEC-005~~ — Unguarded JSON.parse in AI Response Layer
**Resolved:** Session 001 (2026-05-25)
`generateJSON<T>()` in `claude.ts` wraps `JSON.parse` in try/catch and throws a typed error with a clean message.

### ~~SEC-007~~ — Anthropic API Key Missing Validation at Startup
**Resolved:** Session 001 (2026-05-25)
`claude.ts` logs a warning if `ANTHROPIC_API_KEY` is not set at startup.

### ~~SEC-011~~ — Gumroad Webhook HMAC Not Verified
**Resolved:** Session 008 (2026-05-27)
`createHmac("sha256", GUMROAD_WEBHOOK_SECRET)` verification added to
`src/app/api/gumroad/webhook/route.ts`. Requests with invalid or missing
signatures are rejected with 401. Requires `GUMROAD_WEBHOOK_SECRET` env var.

---

## HIGH

### SEC-004: No CSRF Protection
**Severity:** High
**Status:** Partially mitigated
**File:** All POST routes

**Risk:** Cross-Site Request Forgery attacks can cause authenticated users to trigger AI generation calls from malicious third-party sites. The `x-api-key` header requirement provides meaningful mitigation (browsers don't auto-send custom headers cross-origin), but is not a full CSRF token implementation.

**Fix:** Add `SameSite=Strict` to session cookie (NextAuth config) + `Origin` header checking when auth is fully wired. Full CSRF token implementation is the complete fix.

---

## MEDIUM

### SEC-006: Settings Page API Key Field Has No Secure Backend
**Severity:** Medium
**Status:** By Design (local-only warning present)
**File:** `src/app/settings/page.tsx`

**Risk:** The settings page presents a password input for the Anthropic API key. The UI states "Keys saved here are for local reference only." If a developer adds backend persistence without encryption, this becomes critical.

**Mitigation:** Any future persistence must use server-side encryption. Never store plaintext API keys in the database. Prefer env var management over UI-managed secrets.

---

### SEC-008: No Content Security Policy Headers
**Severity:** Medium
**Status:** Open
**File:** `next.config.ts`

**Risk:** No CSP headers, enabling potential XSS attacks if AI-generated content is ever rendered unsanitized.

**Fix:** Add security headers in `next.config.ts`:
```typescript
headers: async () => [{
  source: "/(.*)",
  headers: [
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  ],
}]
```

---

### SEC-012: NextAuth Secret Rotation Procedure Not Documented
**Severity:** Medium
**Status:** Open

**Risk:** `NEXTAUTH_SECRET` encrypts all session tokens. No rotation procedure is documented. If the secret is compromised, all active user sessions must be invalidated by changing the secret — but changing it immediately invalidates every active session. This needs a documented runbook.

**Fix:** Document the rotation procedure. When rotating: (1) generate new secret, (2) update env var, (3) redeploy — all sessions invalidated and users must re-login.

---

## LOW

### SEC-009: SQLite Database File in Project Directory
**Severity:** Low (dev only)
**Status:** Acceptable for development

Verify `dev.db` is in `.gitignore` to prevent accidental commit of development data.

---

### SEC-010: No Request Logging / Audit Trail
**Severity:** Low
**Status:** Partial — `logAICall()` exists for AI calls, no general request log

**Risk:** No structured logging of API calls means cost attacks and unauthorized access patterns cannot be investigated post-hoc.

**Fix:** `logger.ts` already exists with `log()`. Extend to log request metadata (IP, route, action, status) on every response.

---

### SEC-013: Pinterest OAuth Token Not Refreshed
**Severity:** Low
**Status:** Open
**File:** `src/lib/integrations/pinterest.ts`

**Risk:** Pinterest access tokens expire. No refresh logic is implemented. After expiry, all pin operations will silently fail until the user manually reconnects.

**Fix:** Implement token refresh using the stored `refreshToken` before making API calls. Update `PinterestConnection.accessToken` and `tokenExpiry` after refresh.

---

## Scanning Checklist (Run Before Every Deploy)

- [ ] No secrets in any source file (`git grep -i "sk-ant\|api_key\|secret\|password"`)
- [ ] `.env` is in `.gitignore`
- [ ] `prisma/dev.db` is in `.gitignore`
- [ ] All API routes have input validation (Zod)
- [ ] All API routes call `rateLimit()` before Claude calls
- [ ] Error messages to client use `toSafeErrorMessage()`
- [ ] Cron routes verify `CRON_SECRET` header
- [ ] Gumroad webhook verifies HMAC signature ✅ (implemented Session 008)
- [ ] Dependencies have no known critical CVEs (`npm audit`)
