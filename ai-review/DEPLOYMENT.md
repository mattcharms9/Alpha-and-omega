# Deployment Guide — Alpha & Omega

## Database

**Local development:** SQLite via `@prisma/adapter-better-sqlite3`. Zero setup — just run `npx prisma db push`.

**Production:** Switch to PostgreSQL (Neon recommended):
1. Set `DATABASE_URL` to your Neon connection string
2. Change `datasource db { provider = "postgresql" }` in `prisma/schema.prisma`
3. Update `prisma.config.ts` datasource adapter from `PrismaBetterSqlite3` to the Neon/PostgreSQL adapter
4. Run `npx prisma migrate deploy`

---

## Minimum Deploy (core AI features only)

Required env vars:
```
ANTHROPIC_API_KEY
API_SECRET_KEY + NEXT_PUBLIC_API_KEY  (same value)
DATABASE_URL
AUTH_SECRET
CRON_SECRET
RESEND_API_KEY + ALERT_EMAIL
```

With just these, you get: all AI engines, product generation, batch generation, portfolio, empire dashboard, daily brief email.

---

## Standard Deploy (+ revenue channels)

Add:
```
GUMROAD_ACCESS_TOKEN
GUMROAD_WEBHOOK_SECRET
OPENAI_API_KEY         (for cover image generation)
RESEND_AUDIENCE_ID     (for buyer email list building)
BUFFER_ACCESS_TOKEN    (optional — for social content scheduling)
```

---

## Full Deploy (all features)

Add:
```
PINTEREST_APP_ID=
PINTEREST_APP_SECRET=
PINTEREST_REDIRECT_URI=

# SMS accountability reminders (Twilio)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=+1XXXXXXXXXX
ALERT_PHONE_NUMBER=+1XXXXXXXXXX

# Push notifications (generate once: npx web-push generate-vapid-keys)
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
```

---

## Vercel Setup

1. Create project from GitHub repo at vercel.com
2. Add all required env vars in Vercel → Settings → Environment Variables
3. Set `NEXT_PUBLIC_APP_URL` to your production domain (e.g. `https://alphaandomega.app`)
4. Set `AUTH_SECRET` (generate with `openssl rand -base64 32`)
5. After first deploy, run `npx prisma migrate deploy` (or `prisma db push` for dev)
6. Verify crons appear in Vercel → Settings → Cron Jobs

---

## Cron Jobs

All 5 cron routes are defined in `vercel.json`. After deploy, verify these appear in Vercel dashboard:

| Route | Schedule | Purpose |
|-------|----------|---------|
| `/api/cron/daily-brief` | `0 8 * * *` | 8am UTC — empire state → email brief |
| `/api/cron/process-pin-queue` | `*/30 * * * *` | Every 30 min — publish queued pins + sync analytics |
| `/api/cron/daily-reminder` | `0 * * * *` | Hourly — SMS + push if target not met at configured hour |
| `/api/cron/close-day` | `59 23 * * *` | 11:59pm UTC — finalize DailyStreak + milestone alerts |
| `/api/cron/weekly-report` | `0 9 * * 0` | 9am UTC Sundays — weekly SMS performance summary |

**Cron security note:** All cron routes verify the request using
`req.headers.get("authorization") === \`Bearer ${process.env.CRON_SECRET}\``.
On Vercel, set `CRON_SECRET` in env vars — Vercel passes it automatically.

---

## After First Deploy Checklist

- [ ] `npm run build` passes locally before pushing
- [ ] All required env vars set in Vercel dashboard
- [ ] `npx prisma migrate deploy` run against production DB
- [ ] Test `/api/empire?action=state` returns 200
- [ ] Test `/api/products` POST generates a product
- [ ] If using Gumroad: configure webhook URL in Gumroad dashboard → `https://yourdomain.com/api/gumroad/webhook`
- [ ] If using Pinterest: complete OAuth flow at `/publishing`
- [ ] If using SMS reminders: verify TWILIO_PHONE_NUMBER in E.164 format (+1XXXXXXXXXX)
- [ ] If using push notifications: confirm VAPID keys generated and set
- [ ] Test accountability: go to Settings → Accountability → Test SMS + Test Push
- [ ] Verify crons appear in Vercel dashboard

---

## Common Deploy Errors

| Error | Fix |
|-------|-----|
| `PrismaClientInitializationError` | DATABASE_URL not set or wrong format |
| `401 Unauthorized` on all API routes | NEXT_PUBLIC_API_KEY not set |
| Crons not running | CRON_SECRET not set in Vercel env vars |
| Pinterest OAuth fails | PINTEREST_REDIRECT_URI doesn't match Vercel domain |
| Empire brief never refreshes | EmpireConfig row not yet created — first call will create it |
| SMS reminders not sending | TWILIO_PHONE_NUMBER must be E.164 format (+1XXXXXXXXXX) |
| Push notifications fail | VAPID keys must match — regenerating them invalidates all subscriptions |
