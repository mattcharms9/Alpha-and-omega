# Deploy Alpha & Omega — Step by Step
# Follow these steps IN ORDER. Do not skip any step.

---

## STEP 1: Create GitHub Repo and Push (5 min)

### 1a — Create the repo
1. Go to github.com → click **+** (top right) → **New repository**
2. Repository name: `alpha-omega`
3. Set to **Private** ← important, this contains your business logic
4. Do NOT check any boxes (no README, no .gitignore, no license)
5. Click **Create repository**

### 1b — Push from your terminal
In your project folder (`C:\Users\mattc\Visual Studio Code\Alpha and Omega`), run:

```bash
git commit -m "Production ready — Alpha & Omega v1.0"
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/alpha-omega.git
git push -u origin main
```

Replace `YOUR_GITHUB_USERNAME` with your actual GitHub username.

---

## STEP 2: Set Up Neon PostgreSQL Database (5 min)

1. Go to **neon.tech** → Sign up (free — no credit card needed)
2. Click **Create Project**
3. Name: `alpha-omega` · Region: **US East 1** · Click **Create Project**
4. On the Connection Details panel:
   - Select **Prisma** from the "Connect from" dropdown
   - Copy the connection string (starts with `postgresql://`)
5. **Save this string** — you'll use it in Steps 3 and 4

---

## STEP 3: Run Database Migration (2 min)

In your local terminal, paste your Neon connection string:

```bash
DATABASE_URL="postgresql://your-neon-string-here" npx prisma db push
```

You should see: `Your database is now in sync with your Prisma schema.`

Also update your local `.env` file — add your Neon URL as `DATABASE_URL` so local development works:
```
DATABASE_URL=postgresql://your-neon-string-here
```

---

## STEP 4: Create Vercel Project (5 min)

1. Go to **vercel.com** → Sign up with your GitHub account
2. Click **Add New Project**
3. Find and click **Import** next to your `alpha-omega` repo
4. Framework Preset: **Next.js** (auto-detected — leave it)
5. Leave Root Directory, Build Command, and Output Directory as defaults
6. Click **Deploy** ← the first deploy will FAIL — that's expected (no env vars yet)
7. After it fails, copy your Vercel project URL (looks like `https://alpha-omega-abc123.vercel.app`)

---

## STEP 5: Add Environment Variables in Vercel (10 min)

Go to **Vercel → Your Project → Settings → Environment Variables**

For each variable below:
1. Enter the name in **Key**
2. Enter the value in **Value**
3. Check: **Production ✅ Preview ✅ Development ✅**
4. Click **Save**

### REQUIRED (app won't work without all of these):

| Variable | Value / Where to get it |
|----------|------------------------|
| `DATABASE_URL` | Your Neon connection string from Step 2 |
| `ANTHROPIC_API_KEY` | Your existing key (already in your .env) |
| `API_SECRET_KEY` | Run `openssl rand -hex 32` in terminal — copy the output |
| `NEXT_PUBLIC_API_KEY` | **Same value** as API_SECRET_KEY |
| `AUTH_SECRET` | Run `openssl rand -base64 32` in terminal — copy the output |
| `NEXTAUTH_URL` | Your Vercel URL from Step 4 (e.g. `https://alpha-omega-abc.vercel.app`) |
| `NEXT_PUBLIC_APP_URL` | Same as NEXTAUTH_URL |
| `CRON_SECRET` | Run `openssl rand -hex 32` — any random string |
| `RESEND_API_KEY` | `re_...` from resend.com → API Keys |
| `ALERT_EMAIL` | `mattcharms9@gmail.com` |

### REVENUE (add when you have them):

| Variable | Value |
|----------|-------|
| `OPENAI_API_KEY` | Your existing key (already in .env) |
| `ETSY_CLIENT_ID` | `5dhn35sxlgca5srboe3l9sr8` (already in .env) |
| `ETSY_REDIRECT_URI` | `https://YOUR-VERCEL-URL/api/etsy/callback` |
| `PINTEREST_APP_ID` | Your Pinterest app ID (already in .env) |
| `PINTEREST_APP_SECRET` | Your Pinterest app secret (already in .env) |
| `PINTEREST_REDIRECT_URI` | `https://YOUR-VERCEL-URL/api/pinterest/callback` |
| `AGENT_DAILY_COST_LIMIT_USD` | `2.00` |

---

## STEP 6: Add Vercel Blob Storage (2 min)

> Required for PDFs, cover images, and mockups to persist. Without this, all generated files vanish after each serverless function call.

1. In Vercel → Your Project → **Storage** tab
2. Click **Create Database**
3. Select **Blob**
4. Name: `alpha-omega-files` → Click **Create**
5. Vercel automatically adds `BLOB_READ_WRITE_TOKEN` to your env vars ✅

---

## STEP 7: Redeploy (2 min)

1. In Vercel → Your Project → **Deployments** tab
2. Click the three dots `···` on the most recent deployment
3. Click **Redeploy**
4. Wait ~2 minutes
5. Click **Visit** → you should see the Alpha & Omega dashboard ✅

---

## STEP 8: Create Your Account (1 min)

1. Open your live Vercel URL
2. Go to `/signup`
3. Create your account with email and password
4. Log in

---

## STEP 9: Update API Redirect URIs

Now that you have a real https URL, update these in the developer portals:

**Etsy** (etsy.com/developers → your app → Settings):
- Add callback URL: `https://YOUR-VERCEL-URL/api/etsy/callback`
- This must match your `ETSY_REDIRECT_URI` env var exactly

**Pinterest** (developers.pinterest.com → your app → Edit):
- Update redirect URI: `https://YOUR-VERCEL-URL/api/pinterest/callback`
- Update the website URL field: `https://YOUR-VERCEL-URL`
- Resubmit app for approval if needed (required for access to full API)

---

## STEP 10: Connect Platforms (when API approved)

1. Go to your Vercel URL → `/publishing`
2. Click **Connect Etsy Shop** (after Etsy approves your app)
3. Click **Connect Pinterest** (after Pinterest approves your app)
4. For Gumroad: go to Settings → paste your access token

---

## YOU'RE LIVE

The autonomous pipeline runs nightly at 2am UTC. The morning after your first night live:

1. Open `/launch-queue`
2. Review the 15 opportunities (takes ~5 minutes)
3. Tap Approve on your favorites
4. Products build automatically — PDF, cover image, Etsy listing, Pinterest pin

---

## TROUBLESHOOTING

| Problem | Fix |
|---------|-----|
| White screen / auth error | `AUTH_SECRET` or `NEXTAUTH_URL` not set correctly |
| Database errors | `DATABASE_URL` wrong — check it starts with `postgresql://` |
| API 401 on everything | `API_SECRET_KEY` and `NEXT_PUBLIC_API_KEY` don't match |
| Etsy/Pinterest connect fails | Redirect URI in developer portal doesn't match env var exactly |
| Files not saving (PDFs, images) | Add Vercel Blob storage (Step 6) |
| Crons not running | `CRON_SECRET` not set; `*/30` cron needs Vercel Pro |
| Agent queue empty | First run at 2am UTC; or trigger manually: POST `/api/cron/run-agent-queue` with `Authorization: Bearer YOUR_CRON_SECRET` |
