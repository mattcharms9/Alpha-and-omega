import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { Resend } from "resend";
import { generateWithClaude } from "@/lib/ai/claude";

export const maxDuration = 60;

const FROM = "Alpha & Omega <alerts@alphaandomega.app>";

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  return new Resend(process.env.RESEND_API_KEY);
}

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") ?? new URL(req.url).searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const alertEmail = process.env.ALERT_EMAIL;
  if (!alertEmail) {
    return NextResponse.json({ skipped: "ALERT_EMAIL not configured" });
  }

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  // ── Section 1: This week in revenue ─────────────────────────────────────────
  const revenueAgg = await prisma.revenueRecord.aggregate({
    _sum: { revenue: true, sales: true },
    _count: { id: true },
    where: { date: { gte: sevenDaysAgo } },
  });
  const weekRevenue = revenueAgg._sum.revenue ?? 0;
  const weekSales = revenueAgg._sum.sales ?? 0;
  const avgPerSale = weekSales > 0 ? weekRevenue / weekSales : 0;

  // ── Section 2: Views without sales (opportunity to optimize) ─────────────────
  const highViewsNoSales = await prisma.etsyListing.findMany({
    where: {
      views: { gt: 50 },
      sales: 0,
      publishedAt: { gte: fourteenDaysAgo },
      status: "active",
    },
    select: { title: true, views: true, price: true },
    orderBy: { views: "desc" },
    take: 5,
  });

  // ── Section 3: Conversions this week ────────────────────────────────────────
  const conversions = await prisma.revenueRecord.findMany({
    where: { date: { gte: sevenDaysAgo }, sales: { gt: 0 } },
    select: { productId: true, revenue: true, sales: true, platform: true },
    orderBy: { revenue: "desc" },
    take: 5,
  });

  // Enrich conversions with product titles
  const productIds = [...new Set(conversions.map((c) => c.productId).filter(Boolean))] as string[];
  const products = productIds.length > 0
    ? await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, title: true },
      })
    : [];
  const productTitleMap = new Map(products.map((p) => [p.id, p.title]));

  // ── Section 4: What the agent learned ───────────────────────────────────────
  const learnings = await prisma.learningEntry.findMany({
    where: { createdAt: { gte: sevenDaysAgo } },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  // ── Section 5: Queue performance ────────────────────────────────────────────
  const queues = await prisma.dailyQueue.findMany({
    where: { generatedAt: { gte: sevenDaysAgo } },
    select: { date: true, status: true, agentRunLog: true },
    orderBy: { generatedAt: "desc" },
    take: 7,
  });

  const queueStats = {
    total: queues.length,
    ready: queues.filter((q) => q.status === "ready").length,
    failed: queues.filter((q) => q.status === "failed").length,
    avgCost: queues.reduce((sum, q) => {
      const log = q.agentRunLog as { totalCost?: number } | null;
      return sum + (log?.totalCost ?? 0);
    }, 0) / Math.max(queues.length, 1),
  };

  // ── Section 6: Tonight's strategy (Claude, 15s timeout) ─────────────────────
  const FALLBACK_STRATEGY = "Review your pending launch cards and approve the top 3 with opportunity scores above 75. Check listings with high views but no sales and consider updating their thumbnails.";
  let strategy = FALLBACK_STRATEGY;
  try {
    const learningSnippet = learnings.slice(0, 2).map((l) => l.content).join(". ");
    const strategyRaw = await Promise.race([
      generateWithClaude(
        "You are a concise business strategy advisor for a solo Etsy digital product seller. Give specific, actionable advice. No em dashes, no hyphens.",
        `This week: $${weekRevenue.toFixed(2)} revenue, ${weekSales} sales. ${learningSnippet ? `Recent learnings: ${learningSnippet}.` : ""} ${highViewsNoSales.length > 0 ? `${highViewsNoSales.length} listings have views but no sales.` : ""} Give 2 to 3 specific action items for tonight. Under 80 words.`,
        200,
        "weekly-report-strategy"
      ),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 15_000)),
    ]);
    strategy = strategyRaw.trim() || FALLBACK_STRATEGY;
  } catch {
    // fallback already set
  }

  // ── Build HTML email ─────────────────────────────────────────────────────────
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const weekLabel = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const sectionStyle = `style="margin-bottom: 24px; padding: 16px; background: #141414; border-radius: 8px; border: 1px solid #262626;"`;
  const labelStyle = `style="font-size: 10px; letter-spacing: 0.1em; color: #737373; margin-bottom: 8px; text-transform: uppercase;"`;
  const valueStyle = `style="font-size: 22px; font-weight: 700; color: #f0b429;"`;
  const subStyle = `style="font-size: 12px; color: #737373; margin-top: 4px;"`;
  const rowStyle = `style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #1a1a1a; font-size: 13px;"`;

  const html = `
<div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #0a0a0a; color: #e5e5e5; border-radius: 12px;">
  <div style="font-size: 11px; letter-spacing: 0.1em; color: #737373; margin-bottom: 8px;">ALPHA AND OMEGA</div>
  <h1 style="font-size: 20px; font-weight: 700; color: #e5e5e5; margin: 0 0 4px 0;">Weekly Intelligence Report</h1>
  <div style="font-size: 13px; color: #737373; margin-bottom: 28px;">Week ending ${weekLabel}</div>

  <!-- Section 1: Revenue -->
  <div ${sectionStyle}>
    <div ${labelStyle}>1. This Week in Revenue</div>
    <div ${valueStyle}>$${weekRevenue.toFixed(2)}</div>
    <div ${subStyle}>${weekSales} sales at $${avgPerSale.toFixed(2)} avg per sale</div>
  </div>

  <!-- Section 2: Views Without Sales -->
  <div ${sectionStyle}>
    <div ${labelStyle}>2. High Views, Zero Sales (Optimize These)</div>
    ${highViewsNoSales.length === 0
      ? `<div style="font-size: 13px; color: #737373;">No listings with 50+ views and zero sales. Great job.</div>`
      : highViewsNoSales.map((l) => `
        <div ${rowStyle}>
          <span style="color: #e5e5e5; max-width: 420px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${l.title.slice(0, 60)}</span>
          <span style="color: #f59e0b; font-weight: 600; flex-shrink: 0;">${l.views} views</span>
        </div>
      `).join("")}
  </div>

  <!-- Section 3: Conversions -->
  <div ${sectionStyle}>
    <div ${labelStyle}>3. Conversions This Week</div>
    ${conversions.length === 0
      ? `<div style="font-size: 13px; color: #737373;">No sales recorded this week. Keep publishing.</div>`
      : conversions.map((c) => `
        <div ${rowStyle}>
          <span style="color: #e5e5e5;">${(c.productId ? productTitleMap.get(c.productId) ?? "Unknown product" : "Unknown product").slice(0, 50)}</span>
          <span style="color: #10b981; font-weight: 600;">$${c.revenue.toFixed(2)}</span>
        </div>
      `).join("")}
  </div>

  <!-- Section 4: Agent Learnings -->
  <div ${sectionStyle}>
    <div ${labelStyle}>4. What the Agent Learned</div>
    ${learnings.length === 0
      ? `<div style="font-size: 13px; color: #737373;">No new learning entries this week.</div>`
      : `<ul style="margin: 0; padding-left: 16px; font-size: 13px; color: #a3a3a3; line-height: 1.7;">
          ${learnings.map((l) => `<li>${l.content}</li>`).join("")}
        </ul>`}
  </div>

  <!-- Section 5: Queue Performance -->
  <div ${sectionStyle}>
    <div ${labelStyle}>5. Queue Performance</div>
    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 8px;">
      ${[
        { label: "Runs", value: String(queueStats.total), color: "#e5e5e5" },
        { label: "Ready", value: String(queueStats.ready), color: "#10b981" },
        { label: "Failed", value: String(queueStats.failed), color: queueStats.failed > 0 ? "#f43f5e" : "#737373" },
        { label: "Avg Cost", value: `$${queueStats.avgCost.toFixed(3)}`, color: "#8b5cf6" },
      ].map((s) => `
        <div style="text-align: center; padding: 8px; background: #0a0a0a; border-radius: 6px;">
          <div style="font-size: 16px; font-weight: 700; color: ${s.color};">${s.value}</div>
          <div style="font-size: 10px; color: #737373; text-transform: uppercase;">${s.label}</div>
        </div>
      `).join("")}
    </div>
  </div>

  <!-- Section 6: Tonight's Strategy -->
  <div ${sectionStyle}>
    <div ${labelStyle}>6. Tonight's Strategy</div>
    <div style="font-size: 14px; color: #e5e5e5; line-height: 1.7;">${strategy}</div>
  </div>

  <div style="text-align: center; padding-top: 16px; border-top: 1px solid #1a1a1a;">
    <a href="${appUrl}" style="font-size: 12px; color: #737373; text-decoration: none;">Open Empire Dashboard</a>
  </div>
</div>`;

  const resend = getResend();
  if (!resend) {
    console.warn("[weekly-report] RESEND_API_KEY not set, skipping email send");
    return NextResponse.json({ ok: true, skipped: "no resend key", sections: 6 });
  }

  await resend.emails.send({
    from: FROM,
    to: alertEmail,
    subject: `Weekly Report: $${weekRevenue.toFixed(2)} revenue, ${weekSales} sales, ${weekLabel}`,
    html,
  });

  return NextResponse.json({ ok: true, weekRevenue, weekSales, sections: 6 });
}
