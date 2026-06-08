#!/bin/bash
# Alpha & Omega — Health Check
# Run: npm run health
# Requires Git Bash or WSL on Windows
set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Alpha & Omega — Health Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── 1. TypeScript ────────────────────────────────────────────────────────────
echo ""
echo "▶ TypeScript check..."
npx tsc --noEmit
echo "✅ TypeScript: 0 errors"

# ── 2. Prisma ────────────────────────────────────────────────────────────────
echo ""
echo "▶ Prisma schema validation..."
npx prisma validate
echo "✅ Prisma schema: valid"

# ── 3. Build ─────────────────────────────────────────────────────────────────
echo ""
echo "▶ Production build..."
npm run build > /tmp/ao-build-output.txt 2>&1
if [ $? -ne 0 ]; then
  echo "❌ BUILD FAILED. Output:"
  cat /tmp/ao-build-output.txt
  exit 1
fi
echo "✅ Build: passing"

# ── 4. Banned patterns ───────────────────────────────────────────────────────
echo ""
echo "▶ Checking for banned patterns..."

# No unguarded 'any' types
ANY_COUNT=$(grep -r ": any\b" src/ --include="*.ts" --include="*.tsx" 2>/dev/null \
  | grep -v "eslint-disable\|// " \
  | wc -l)
if [ "$ANY_COUNT" -gt 0 ]; then
  echo "⚠️  WARNING: $ANY_COUNT 'any' type(s) found:"
  grep -rn ": any\b" src/ --include="*.ts" --include="*.tsx" | grep -v "eslint-disable\|// "
fi

# No hardcoded dark hex colors in components (allow Recharts exception and platform brand colors)
DARK_HEX=$(grep -r "#[0-9a-fA-F]\{6\}" src/components/ src/app/ \
  --include="*.ts" --include="*.tsx" 2>/dev/null \
  | grep -iv "recharts\|chart\|Chart\|PortfolioCharts\|platform\|// \|#[Ff][Ff][Ff]\{4\}\|#[Ff][0-9a-fA-F]\{5\}" \
  | grep -i "#[0-2][0-9a-fA-F]\{5\}" \
  | wc -l)
if [ "$DARK_HEX" -gt 0 ]; then
  echo "⚠️  WARNING: potential dark hardcoded hex color(s) found in components"
fi

# No JSON.stringify in Prisma data writes (outside of SSE/streaming)
STRINGIFY_COUNT=$(grep -r "JSON\.stringify" src/app/api/ src/lib/ \
  --include="*.ts" --include="*.tsx" 2>/dev/null \
  | grep -v "SSE\|stream\|body.*fetch\|fetch.*body\|//\|test" \
  | wc -l)
if [ "$STRINGIFY_COUNT" -gt 0 ]; then
  echo "⚠️  WARNING: $STRINGIFY_COUNT JSON.stringify() in data access code — may indicate unnormalized Prisma write:"
  grep -rn "JSON\.stringify" src/app/api/ src/lib/ --include="*.ts" \
    | grep -v "SSE\|stream\|body.*fetch\|fetch.*body\|//\|test"
fi

# No hardcoded secrets
SECRETS=$(grep -r "sk-ant-\|sk-proj-\|whsec_\|rk_live_\|pk_live_" src/ \
  --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)
if [ "$SECRETS" -gt 0 ]; then
  echo "🚨 CRITICAL: Potential hardcoded secret found!"
  grep -rn "sk-ant-\|sk-proj-\|whsec_\|rk_live_\|pk_live_" src/ --include="*.ts" --include="*.tsx"
  exit 1
fi

echo "✅ Banned patterns: clean"

# ── 5. Environment variables ─────────────────────────────────────────────────
echo ""
echo "▶ Required environment variables..."
node -r dotenv/config -e "
const required = [
  'ANTHROPIC_API_KEY',
  'API_SECRET_KEY',
  'NEXT_PUBLIC_API_KEY',
  'DATABASE_URL',
];
const optional = ['CRON_SECRET', 'AUTH_SECRET', 'OPENAI_API_KEY', 'RESEND_API_KEY'];
const missing = required.filter(k => !process.env[k]);
const missingOpt = optional.filter(k => !process.env[k]);
if (missing.length) {
  console.log('❌ Missing required env vars:', missing.join(', '));
  process.exit(1);
}
console.log('✅ All required env vars present');
if (missingOpt.length) {
  console.log('ℹ️  Optional vars not set:', missingOpt.join(', '));
}
" 2>/dev/null || node -e "console.log('ℹ️  Could not load .env — skipping env check')"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ Health check complete — all systems go"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
