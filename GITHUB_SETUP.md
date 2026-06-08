# Deploy Alpha & Omega to Production

Follow these steps in order. Takes about 20 minutes.

---

## Step 1 — Create a Private GitHub Repo

1. Go to github.com → click **+** → **New repository**
2. Name: `alpha-omega` (or whatever you prefer)
3. Set to **Private** — this contains your business logic and API keys structure
4. Do NOT check any of the initialization options (no README, .gitignore, or license)
5. Click **Create repository**

Then push from your local machine:

```bash
git init
git add .
git commit -m "Initial commit — Alpha & Omega"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/alpha-omega.git
git push -u origin main
```

---

## Step 2 — Set Up Neon PostgreSQL

1. Go to **neon.tech** → Sign up (free tier is fine)
2. Click **New Project** → Name: `alpha-omega` → Region: `us-east-1`
3. Click **Create Project**
4. Copy the **Connection String** (starts with `postgresql://`)
5. Save it — you'll paste it as `DATABASE_URL` in Vercel

---

## Step 3 — Deploy to Vercel

1. Go to **vercel.com** → **Add New Project**
2. Click **Import Git Repository** → select your `alpha-omega` repo
3. Framework Preset: **Next.js** (auto-detected)
4. Leave Root Directory, Build Command, and Output Directory as defaults
5. Click **Deploy** — the first deploy will fail because env vars aren't set yet. That's expected.

---

## Step 4 — Add Environment Variables

1. In Vercel → Your Project → **Settings** → **Environment Variables**
2. Open `.env.production.example` in this repo — add every variable listed there
3. For each one: select **Production ✅**, **Preview ✅**, **Development ✅**
4. Start with the required ones:
   - `ANTHROPIC_API_KEY`
   - `API_SECRET_KEY` + `NEXT_PUBLIC_API_KEY` (same value — run `openssl rand -hex 32`)
   - `DATABASE_URL` (your Neon connection string)
   - `AUTH_SECRET` (run `openssl rand -base64 32`)
   - `CRON_SECRET` (any random string)
   - `ALERT_EMAIL` (your email)
   - `NEXT_PUBLIC_APP_URL` (your Vercel URL, e.g. `https://alpha-omega-matt.vercel.app`)
   - `NEXTAUTH_URL` (same as NEXT_PUBLIC_APP_URL)

---

## Step 5 — Add Vercel Blob Storage

> Required for PDFs, cover images, and mockups to persist in production.
> (Vercel serverless functions can't write to the filesystem permanently.)

1. In Vercel → Your Project → **Storage** → **Create Database**
2. Select **Blob** → Name: `alpha-omega-files` → Click **Create**
3. Vercel auto-injects `BLOB_READ_WRITE_TOKEN` into your environment — nothing to copy

---

## Step 6 — Redeploy

1. In Vercel → Your Project → **Deployments**
2. Click the three dots on the latest deployment → **Redeploy**
3. This time it should succeed with all env vars set

---

## Step 7 — Switch to PostgreSQL and Migrate

**Before pushing to GitHub**, open `prisma/schema.prisma` and change:

```prisma
// Change this:
datasource db {
  provider = "sqlite"
}

// To this:
datasource db {
  provider = "postgresql"
}
```

Then update `src/lib/db/prisma.ts` — remove the SQLite adapter and use plain `PrismaClient`:

```typescript
import { PrismaClient } from "@prisma/client";
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ log: ["error"] });
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

Then regenerate and migrate:

```bash
npx prisma generate
DATABASE_URL="postgresql://your-neon-connection-string" npx prisma db push
```

This creates all the tables in Neon.

---

## Step 8 — Update OAuth Redirect URIs

**Etsy** (etsy.com/developers → your app):
- Add: `https://yourdomain.vercel.app/api/etsy/callback`

**Pinterest** (developers.pinterest.com → your app → Edit):
- Add: `https://yourdomain.vercel.app/api/pinterest/callback`

Both must match your `ETSY_REDIRECT_URI` and `PINTEREST_REDIRECT_URI` env vars exactly.

---

## Step 9 — Verify Everything Works

1. Visit your Vercel URL → you should see the Alpha & Omega dashboard
2. Go to `/publishing` → try connecting Etsy and Pinterest
3. Run the agent manually: POST to `/api/cron/run-agent-queue` with `Authorization: Bearer YOUR_CRON_SECRET`
4. Go to `/launch-queue` → verify cards appear

---

## Cron Jobs

Vercel runs these automatically. The `*/30 * * * *` pin queue cron requires **Vercel Pro**.
If you're on the free tier, open `vercel.json` and change that schedule to `0 * * * *` (hourly).

| Cron | Schedule | What it does |
|------|----------|-------------|
| `/api/cron/run-agent-queue` | 2am UTC | Runs 5-agent pipeline → 15 LaunchCards |
| `/api/cron/daily-brief` | 8am UTC | Empire state email |
| `/api/cron/sync-etsy` | 6am UTC | Syncs Etsy listing analytics |
| `/api/cron/lifecycle-scan` | 5am UTC | Lifecycle stage detection |
| `/api/cron/process-pin-queue` | Every 30min | Publishes queued Pinterest pins |
| `/api/cron/daily-reminder` | Hourly check | SMS reminder if daily target not met |

---

## Troubleshooting

**Build fails:** Check Vercel build logs. Most common cause: missing env var.

**"Service temporarily unavailable" errors:** Database not migrated — run Step 7.

**Etsy/Pinterest connect does nothing:** Check that redirect URIs in your `.env` / Vercel env vars match exactly what's registered in the developer portals.

**Cron not running:** Vercel Pro required for sub-hourly crons. Check Vercel → Logs → Cron.
