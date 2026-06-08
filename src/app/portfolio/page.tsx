export const dynamic = "force-dynamic";

import { BarChart3, DollarSign, Package, TrendingUp, Star, Zap, Pin, Eye, Bookmark, MousePointerClick } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { PortfolioCharts } from "@/components/portfolio/PortfolioCharts";
import { prisma } from "@/lib/db/prisma";
import type { PortfolioStats } from "@/app/api/portfolio/route";

async function getPortfolioStats(): Promise<PortfolioStats> {
  const [products, revenueRecords, contentPieces] = await Promise.all([
    prisma.product.findMany({
      where: { deletedAt: null },
      select: { type: true, targetEmotion: true, status: true, totalRevenue: true, monthlyRevenue: true },
    }),
    prisma.revenueRecord.findMany({ orderBy: { date: "asc" } }),
    prisma.contentPiece.findMany({
      where: { deletedAt: null },
      select: { platform: true, virality: true },
    }),
  ]);

  const totalRevenue = revenueRecords.reduce((sum, r) => sum + r.revenue, 0);
  const monthlyRevenue = products.reduce((sum, p) => sum + p.monthlyRevenue, 0);

  const productsByType: Record<string, number> = {};
  const productsByEmotion: Record<string, number> = {};
  const productsByStatus: Record<string, number> = {};
  const emotionRevenue: Record<string, number> = {};

  for (const p of products) {
    productsByType[p.type] = (productsByType[p.type] ?? 0) + 1;
    productsByEmotion[p.targetEmotion] = (productsByEmotion[p.targetEmotion] ?? 0) + 1;
    productsByStatus[p.status] = (productsByStatus[p.status] ?? 0) + 1;
    emotionRevenue[p.targetEmotion] = (emotionRevenue[p.targetEmotion] ?? 0) + p.totalRevenue;
  }

  const platformRevenue: Record<string, number> = {};
  const monthlyMap: Record<string, number> = {};
  for (const r of revenueRecords) {
    platformRevenue[r.platform] = (platformRevenue[r.platform] ?? 0) + r.revenue;
    const monthKey = r.date.toISOString().slice(0, 7);
    monthlyMap[monthKey] = (monthlyMap[monthKey] ?? 0) + r.revenue;
  }

  const monthlyRevenueSeries = Object.entries(monthlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, revenue]) => ({ date, revenue }));

  const contentByPlatform: Record<string, number> = {};
  let viralitySum = 0;
  for (const c of contentPieces) {
    contentByPlatform[c.platform] = (contentByPlatform[c.platform] ?? 0) + 1;
    viralitySum += c.virality;
  }

  const topEmotions = Object.entries(productsByEmotion)
    .map(([emotion, count]) => ({ emotion, count, revenue: emotionRevenue[emotion] ?? 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return {
    totalProducts: products.length,
    totalRevenue,
    monthlyRevenue,
    totalContent: contentPieces.length,
    productsByType,
    productsByEmotion,
    productsByStatus,
    platformRevenue,
    monthlyRevenueSeries,
    avgVirality: contentPieces.length > 0 ? viralitySum / contentPieces.length : 0,
    contentByPlatform,
    topEmotions,
  };
}

async function getPinterestStats() {
  const pins = await prisma.pinterestPin.findMany({
    include: { product: { select: { title: true } } },
    orderBy: { saves: "desc" },
    take: 5,
  });
  const totals = pins.reduce(
    (acc, p) => ({ saves: acc.saves + p.saves, clicks: acc.clicks + p.clicks, impressions: acc.impressions + p.impressions }),
    { saves: 0, clicks: 0, impressions: 0 }
  );
  return { pins, totals, total: pins.length };
}

export default async function PortfolioPage() {
  const [stats, pinterest] = await Promise.all([getPortfolioStats(), getPinterestStats()]);

  const kpis = [
    { label: "Total Revenue", value: `$${stats.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, sub: "All time", icon: DollarSign, color: "var(--gold)", bg: "var(--gold-glow)" },
    { label: "Total Products", value: String(stats.totalProducts), sub: "In library", icon: Package, color: "var(--violet)", bg: "var(--violet-dim)" },
    { label: "Monthly Revenue", value: `$${stats.monthlyRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, sub: "This month", icon: TrendingUp, color: "var(--cyan)", bg: "var(--cyan-dim)" },
    { label: "Content Pieces", value: String(stats.totalContent), sub: "Generated", icon: Star, color: "var(--amber)", bg: "var(--amber-dim)" },
  ];

  return (
    <div style={{ minHeight: "100vh" }}>
      <PageHeader
        icon={BarChart3}
        title="Portfolio Intelligence"
        iconColor="var(--emerald)"
        subtitle="Track revenue performance, emotional category strength, and niche profitability across your entire catalog."
      />

      <div style={{ padding: "24px 36px" }}>
        <div
          style={{
            marginBottom: 24,
            padding: "14px 18px",
            borderRadius: 12,
            background: "rgba(201,168,76,0.06)",
            border: "1px solid rgba(201,168,76,0.15)",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <Zap size={16} style={{ color: "var(--gold)", flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--gold)" }}>Portfolio Intelligence Live</div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: 2 }}>
              Live data from your product library and revenue records. Rendered server-side.
            </div>
          </div>
        </div>

        <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
          {kpis.map((kpi, i) => (
            <Card key={i} hover>
              <CardBody>
                <div className="flex items-center justify-between mb-3">
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: kpi.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <kpi.icon size={15} style={{ color: kpi.color }} />
                  </div>
                  <TrendingUp size={13} style={{ color: "var(--text-muted)" }} />
                </div>
                <div style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.04em", color: "var(--text-primary)" }}>
                  {kpi.value}
                </div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 4 }}>{kpi.label}</div>
                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 2 }}>{kpi.sub}</div>
              </CardBody>
            </Card>
          ))}
        </div>

        <PortfolioCharts stats={stats} />

        {/* Pinterest Analytics */}
        <div style={{ marginTop: 32 }}>
          <div className="label mb-4">Pinterest Performance</div>
          <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
            {[
              { label: "Total Pins", value: String(pinterest.total), icon: Pin, color: "var(--violet)" },
              { label: "Total Impressions", value: pinterest.totals.impressions.toLocaleString(), icon: Eye, color: "var(--cyan)" },
              { label: "Total Saves", value: pinterest.totals.saves.toLocaleString(), icon: Bookmark, color: "var(--gold)" },
              { label: "Total Clicks", value: pinterest.totals.clicks.toLocaleString(), icon: MousePointerClick, color: "var(--emerald)" },
            ].map((kpi, i) => (
              <Card key={i}>
                <CardBody>
                  <div className="flex items-center gap-3">
                    <kpi.icon size={15} style={{ color: kpi.color }} />
                    <div>
                      <div style={{ fontSize: "1.25rem", fontWeight: 700, letterSpacing: "-0.03em", color: "var(--text-primary)" }}>{kpi.value}</div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{kpi.label}</div>
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>

          {pinterest.pins.length > 0 && (
            <Card>
              <CardBody>
                <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: 12 }}>Top Pins by Saves</div>
                <div className="flex flex-col gap-2">
                  {pinterest.pins.map((pin) => (
                    <div key={pin.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "6px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pin.title}</div>
                        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{pin.product.title}</div>
                      </div>
                      <div className="flex gap-4" style={{ flexShrink: 0 }}>
                        <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}><span style={{ color: "var(--gold)", fontWeight: 600 }}>{pin.saves}</span> saves</span>
                        <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}><span style={{ color: "var(--cyan)", fontWeight: 600 }}>{pin.impressions.toLocaleString()}</span> views</span>
                        <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}><span style={{ color: "var(--emerald)", fontWeight: 600 }}>{pin.clicks}</span> clicks</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
