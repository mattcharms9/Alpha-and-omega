"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { PortfolioStats } from "@/app/api/portfolio/route";

const PLATFORM_COLORS: Record<string, string> = {
  etsy: "#f97316",
  "amazon-kdp": "#f59e0b",
  gumroad: "#10b981",
  shopify: "#22c55e",
  "tiktok-shop": "#ec4899",
};

function getPlatformColor(platform: string): string {
  return PLATFORM_COLORS[platform.toLowerCase().replace(/\s+/g, "-")] ?? "#6366f1";
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", borderRadius: 8, padding: "8px 12px" }}>
      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ fontSize: "0.875rem", fontWeight: 600, color: p.color ?? "var(--gold)" }}>
          ${p.value.toLocaleString()}
        </div>
      ))}
    </div>
  );
}

const BASE_RADAR_DATA = [
  { subject: "Emotional Depth", value: 72, fullMark: 100 },
  { subject: "Monetization", value: 58, fullMark: 100 },
  { subject: "Virality", value: 0, fullMark: 100 },
  { subject: "Retention", value: 45, fullMark: 100 },
  { subject: "Evergreen", value: 80, fullMark: 100 },
  { subject: "SEO Authority", value: 35, fullMark: 100 },
];

export function PortfolioCharts({ stats }: { stats: PortfolioStats }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const revenueChartData = stats.monthlyRevenueSeries.map((s) => ({ month: s.date, revenue: s.revenue }));
  const platformChartData = Object.entries(stats.platformRevenue).map(([platform, revenue]) => ({
    platform, revenue, color: getPlatformColor(platform),
  }));
  const radarData = BASE_RADAR_DATA.map((d) =>
    d.subject === "Virality" ? { ...d, value: Math.round(stats.avgVirality) } : d
  );

  return (
    <>
      <div className="grid gap-6 mb-6" style={{ gridTemplateColumns: "1fr 340px" }}>
        <Card>
          <CardBody>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="label">Revenue Trajectory</div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: 2 }}>Monthly revenue over time</div>
              </div>
              <Badge variant="muted">{revenueChartData.length > 0 ? `${revenueChartData.length} months` : "No data yet"}</Badge>
            </div>
            <div style={{ height: 200 }}>
              {mounted && revenueChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueChartData}>
                    <defs>
                      <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#c9a84c" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#c9a84c" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="month" tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="revenue" stroke="#c9a84c" strokeWidth={2} fill="url(#revenueGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>No revenue records yet</span>
                </div>
              )}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="label mb-1">Portfolio Strength Radar</div>
            <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginBottom: 12 }}>
              Avg virality: {Math.round(stats.avgVirality)}
            </div>
            <div style={{ height: 200 }}>
              {mounted && (
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="var(--border-subtle)" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: "var(--text-muted)", fontSize: 9 }} />
                    <Radar dataKey="value" stroke="#c9a84c" fill="#c9a84c" fillOpacity={0.15} strokeWidth={1.5} />
                  </RadarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-6 mb-6" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <Card>
          <CardBody>
            <div className="label mb-4">Top Emotional Categories</div>
            {stats.topEmotions.length === 0 ? (
              <div style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>No products yet.</div>
            ) : (
              <div className="flex flex-col gap-3">
                {stats.topEmotions.map((cat, i) => {
                  const colors = ["var(--amber)", "var(--gold)", "var(--violet)", "var(--rose)", "var(--cyan)", "var(--emerald)", "var(--amber)", "var(--gold)"];
                  const color = colors[i % colors.length];
                  const maxCount = stats.topEmotions[0].count;
                  return (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-1">
                        <div style={{ fontSize: "0.83rem", color: "var(--text-primary)", fontWeight: 500 }}>{cat.emotion}</div>
                        <div className="flex items-center gap-3">
                          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{cat.count} products</span>
                          <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--emerald)" }}>
                            ${cat.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </span>
                        </div>
                      </div>
                      <div style={{ height: 4, borderRadius: 2, background: "var(--bg-elevated)", overflow: "hidden" }}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(cat.count / maxCount) * 100}%` }}
                          transition={{ duration: 0.8, delay: i * 0.08, ease: "easeOut" }}
                          style={{ height: "100%", borderRadius: 2, background: color, opacity: 0.7 }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="label mb-4">Products by Type</div>
            {Object.keys(stats.productsByType).length === 0 ? (
              <div style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>No products yet.</div>
            ) : (
              <div className="flex flex-col gap-3">
                {Object.entries(stats.productsByType).map(([type, count], i) => {
                  const total = stats.totalProducts || 1;
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 8, background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}>
                      <div className="flex-1">
                        <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-primary)", textTransform: "capitalize" }}>{type}</div>
                        <div style={{ height: 3, borderRadius: 2, background: "var(--border-subtle)", overflow: "hidden", marginTop: 6 }}>
                          <div style={{ height: "100%", width: `${(count / total) * 100}%`, background: "var(--gold)", borderRadius: 2 }} />
                        </div>
                      </div>
                      <Badge variant="muted">{count}</Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardBody>
          <div className="label mb-4">Platform Revenue Distribution</div>
          {platformChartData.length === 0 ? (
            <div style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>No revenue records yet.</div>
          ) : mounted ? (
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={platformChartData}>
                  <XAxis dataKey="platform" tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                    {platformChartData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : null}
        </CardBody>
      </Card>
    </>
  );
}
