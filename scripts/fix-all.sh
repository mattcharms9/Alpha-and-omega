#!/bin/bash
# Alpha & Omega — Full Auto-Fix
# Run: npm run fix:all
# Requires Git Bash or WSL on Windows
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Alpha & Omega — Full Auto-Fix"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "▶ Cleaning build cache..."
rm -rf .next
echo "✅ Cache cleared"

echo ""
echo "▶ Installing dependencies..."
npm install
echo "✅ Dependencies installed"

echo ""
echo "▶ Regenerating Prisma client..."
npx prisma generate
echo "✅ Prisma client regenerated"

echo ""
echo "▶ Syncing database schema..."
npx prisma db push
echo "✅ Database schema synced"

echo ""
echo "▶ Running health check..."
bash scripts/health-check.sh

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Auto-fix complete."
echo "  Run: npm run dev"
echo "  Open: http://localhost:3090"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
