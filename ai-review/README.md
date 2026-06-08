# AI Review System — Alpha & Omega

## Quick Start — Is the App Broken?

Run this first:
```bash
npm run fix:all
```
This cleans build cache, reinstalls dependencies, regenerates the Prisma client,
syncs the database schema, and runs a full health check.
Fixes 90% of "it won't start" issues in one command.

If it still doesn't work after `fix:all`, run:
```bash
npm run dev 2>&1 | head -50
```
And paste the first error into Claude Code with:
> "Alpha & Omega won't start. Here's the error: [paste error]"

**Manual repair sequence (when fix:all isn't enough):**
```bash
rm -rf .next          # clear Next.js cache
npm install           # reinstall packages
npx prisma generate   # regenerate Prisma client
npx prisma db push    # sync database schema
npx tsc --noEmit      # verify TypeScript (must be 0 errors)
npm run build         # verify build passes
npm run dev           # start dev server → http://localhost:3090
```

---

This folder is a **portable engineering intelligence system** for the Alpha & Omega repository.

It is safe to share with any AI assistant, external collaborator, or code review tool.

**It contains zero secrets, credentials, API keys, tokens, or sensitive data.**

---

## Purpose

Any AI model or engineer who opens this folder should be able to:

- Instantly understand the repository architecture
- Understand coding standards and preferred patterns
- Identify known risks and technical debt
- Continue intelligent code review without re-reading the entire codebase
- Understand engineering decisions and their rationale
- Know what to avoid (banned patterns) and what to follow (preferred patterns)

---

## File Index

| File | Purpose |
|------|---------|
| `README.md` | This file — system overview and navigation |
| `STATUS.md` | **Start here** — live operational status, build health, open gaps (updated every session) |
| `ai-context-export.md` | Full AI-ready context dump for instant onboarding |
| `repository-summary.json` | Machine-readable repository metadata |
| `architecture-map.md` | Visual and textual architecture overview |
| `architecture-decisions.md` | Key engineering decisions and their rationale (ADR-001 → ADR-038) |
| `standards.md` | Enforced coding standards for this repository |
| `preferred-patterns.md` | Patterns that should be followed consistently |
| `banned-patterns.md` | Patterns that must never be used |
| `technical-debt.md` | Tracked technical debt with severity and owner |
| `security-watchlist.md` | Security risks (sanitized — no secrets exposed) |
| `performance-watchlist.md` | Performance risks and hotspots |
| `recurring-issues.md` | Patterns of mistakes that keep appearing |
| `improvement-roadmap.md` | Prioritized engineering improvements |
| `prompt-quality-log.md` | AI engine prompt versions and quality scores |
| `review-history.md` | Log of all review sessions and findings |

---

## Security Guarantee

This folder was generated with strict sanitization. If you find any secret, credential, token, or sensitive value in any file here, it is a bug — please report it immediately and do not propagate the value.

All sensitive references use placeholders:
- `[REDACTED_API_KEY]`
- `[REDACTED_SECRET]`
- `[REDACTED_TOKEN]`
- `[REDACTED_URL]`
- `[REDACTED_PRIVATE_DATA]`

---

## Last Review

- **Date:** 2026-05-27
- **Session:** 012
- **Files Audited:** 45 build pages, 17 ai-review documents, 80+ source files
- **Build Status:** ✅ 45 pages, 0 TypeScript errors
- **Open Critical:** 2 (TD-018 PDF API route, TD-019 Etsy integration)
- **Open High:** 1 (TD-006 job queue)
- **Open Medium:** 4 (TD-016 rate limiter, TD-017 NextAuth DB, SEC-004 CSRF, SEC-008 CSP)
- **Open Low:** 2 (TD-013 Pinterest images, SEC-013 token refresh)
