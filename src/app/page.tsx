"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  RefreshCw, Activity, CheckCircle2, AlertTriangle,
  AlertCircle, Target, Clock, ArrowRight, Zap,
  Building2, Sparkles, Megaphone, BarChart3, Upload, Flame,
} from "lucide-react";
import Link from "next/link";
import type { EmpireState, NextBestAction, OperatorBrief } from "@/lib/ai/empire-engine";
import { apiFetch } from "@/lib/api";
import { loadScanFromCache, getScanAge, getStaleTier } from "@/lib/cache/intelligence-cache";
import { GettingStarted } from "@/components/onboarding/GettingStarted";
import { QuickIdeasModal } from "@/components/intelligence/QuickIdeasModal";
import { TodaysPriorityEngine } from "@/components/dashboard/TodaysPriorityEngine";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BriefData {
  state: EmpireState;
  brief: OperatorBrief;
  nextAction: NextBestAction;
  alerts: Array<{
    id?: string;
    type: string;
    title: string;
    body: string;
    actionLabel: string;
    actionHref: string;
  }>;
}

interface BankedSignal {
  id: string;
  emotion: string;
  painPoint: string;
  opportunityScore: number;
  monetizationScore: number;
  intensity: number;
  competitionLevel: string;
  freshnessScore: number;
  activatedAt: string | null;
  searchVolumeTrend: string;
}

// ─── Static data ──────────────────────────────────────────────────────────────

const STATIC_OPPORTUNITIES = [
  { niche: "Burnout & Shame Around Rest",       score: 91, territory: "Burnout & Recovery"  },
  { niche: "ADHD Identity Without Diagnosis",   score: 87, territory: "Identity & Purpose"  },
  { niche: "Masculine Emotional Literacy",      score: 84, territory: "Identity & Purpose"  },
  { niche: "Grief After Ambition Collapses",    score: 82, territory: "Grief & Loss"        },
];

const QUICK_ACTIONS = [
  { label: "Claim Signal Territory", href: "/signals",    icon: Activity,  color: "var(--blue)"    },
  { label: "Architect a Brand",      href: "/brands",     icon: Building2, color: "var(--amber)"   },
  { label: "Generate Products",      href: "/products",   icon: Sparkles,  color: "var(--violet)"  },
  { label: "Create Content",         href: "/content",    icon: Megaphone, color: "var(--rose)"    },
  { label: "View Portfolio",         href: "/portfolio",  icon: BarChart3, color: "var(--emerald)" },
  { label: "Publish Assets",         href: "/publishing", icon: Upload,    color: "var(--amber)"   },
];

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sublabel,
  color,
  loading,
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  color?: string;
  loading?: boolean;
}) {
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-light)",
        borderRadius: "var(--radius-lg)",
        padding: "1rem 1.25rem",
        boxShadow: "var(--shadow-xs)",
        flex: 1,
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontSize: "var(--text-xs)",
          color: "var(--text-muted)",
          fontWeight: 500,
          marginBottom: "0.375rem",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {label}
      </div>
      {loading ? (
        <div
          style={{
            height: "1.75rem",
            borderRadius: "var(--radius-sm)",
            background: "var(--bg-subtle)",
            animation: "shimmer 1.5s ease-in-out infinite",
          }}
        />
      ) : (
        <>
          <div
            style={{
              fontSize: "var(--text-2xl)",
              fontWeight: 600,
              color: color ?? "var(--text-primary)",
              lineHeight: 1,
              marginBottom: sublabel ? "0.25rem" : 0,
              letterSpacing: "-0.02em",
            }}
          >
            {value}
          </div>
          {sublabel && (
            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
              {sublabel}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function OpportunityRow({
  signal,
  index,
}: {
  signal: BankedSignal;
  index: number;
}) {
  const score = signal.opportunityScore;
  const isHigh = score >= 80;
  const scoreColor = isHigh ? "var(--emerald)" : score >= 60 ? "var(--amber)" : "var(--text-muted)";
  const scoreBg = isHigh ? "var(--emerald-bg)" : score >= 60 ? "var(--amber-bg)" : "var(--bg-subtle)";
  const compLabel =
    signal.competitionLevel === "low"
      ? "Blue Ocean"
      : signal.competitionLevel === "medium"
      ? "Contested"
      : "Red Ocean";
  const compColor =
    signal.competitionLevel === "low"
      ? "var(--emerald)"
      : signal.competitionLevel === "medium"
      ? "var(--amber)"
      : "var(--rose)";
  const momentum =
    signal.searchVolumeTrend === "rising"
      ? "↑ Rising"
      : signal.searchVolumeTrend === "stable"
      ? "→ Stable"
      : "↓ Cooling";

  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      style={{
        display: "flex",
        alignItems: "center",
        padding: "0.875rem 0",
        borderBottom: "1px solid var(--border-light)",
        gap: "1rem",
      }}
    >
      {/* Score badge */}
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: "var(--radius-md)",
          background: scoreBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: "var(--text-lg)",
            fontWeight: 700,
            color: scoreColor,
            letterSpacing: "-0.02em",
          }}
        >
          {score.toFixed(0)}
        </span>
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: "var(--text-sm)",
            fontWeight: 500,
            color: "var(--text-primary)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {signal.painPoint}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            marginTop: "0.25rem",
          }}
        >
          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
            {signal.emotion}
          </span>
          <span style={{ fontSize: "var(--text-xs)", color: compColor, fontWeight: 500 }}>
            {compLabel}
          </span>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
            {momentum}
          </span>
        </div>
      </div>

      <Link href="/brands" style={{ flexShrink: 0 }}>
        <button
          style={{
            fontSize: "var(--text-xs)",
            fontWeight: 500,
            color: "var(--text-secondary)",
            background: "none",
            border: "1px solid var(--border-medium)",
            borderRadius: "var(--radius-md)",
            padding: "0.3125rem 0.75rem",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          Build →
        </button>
      </Link>
    </motion.div>
  );
}

function StaticOpportunityRow({
  niche,
  score,
  territory,
  index,
}: {
  niche: string;
  score: number;
  territory: string;
  index: number;
}) {
  const isHigh = score >= 80;
  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      style={{
        display: "flex",
        alignItems: "center",
        padding: "0.875rem 0",
        borderBottom: "1px solid var(--border-light)",
        gap: "1rem",
        opacity: 0.6,
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: "var(--radius-md)",
          background: isHigh ? "var(--emerald-bg)" : "var(--amber-bg)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: "var(--text-lg)",
            fontWeight: 700,
            color: isHigh ? "var(--emerald)" : "var(--amber)",
          }}
        >
          {score}
        </span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: "var(--text-sm)",
            fontWeight: 500,
            color: "var(--text-primary)",
          }}
        >
          {niche}
        </div>
        <div
          style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: "0.25rem" }}
        >
          {territory}
        </div>
      </div>
      <Link href="/signals" style={{ flexShrink: 0 }}>
        <button
          style={{
            fontSize: "var(--text-xs)",
            fontWeight: 500,
            color: "var(--text-secondary)",
            background: "none",
            border: "1px solid var(--border-medium)",
            borderRadius: "var(--radius-md)",
            padding: "0.3125rem 0.75rem",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          Claim →
        </button>
      </Link>
    </motion.div>
  );
}

function AlertItem({ alert }: { alert: BriefData["alerts"][0] }) {
  const config =
    {
      opportunity: {
        icon: CheckCircle2,
        color: "var(--emerald)",
        bg: "var(--emerald-bg)",
        border: "var(--emerald-border)",
      },
      urgency: {
        icon: AlertCircle,
        color: "var(--amber)",
        bg: "var(--amber-bg)",
        border: "var(--amber-border)",
      },
      threat: {
        icon: AlertTriangle,
        color: "var(--rose)",
        bg: "var(--rose-bg)",
        border: "var(--rose-border)",
      },
    }[alert.type] ?? {
      icon: AlertCircle,
      color: "var(--amber)",
      bg: "var(--amber-bg)",
      border: "var(--amber-border)",
    };

  const Icon = config.icon;

  return (
    <div
      style={{
        display: "flex",
        gap: "0.625rem",
        padding: "0.75rem",
        borderRadius: "var(--radius-md)",
        background: config.bg,
        border: `1px solid ${config.border}`,
        marginBottom: "0.5rem",
      }}
    >
      <Icon size={14} style={{ color: config.color, flexShrink: 0, marginTop: 2 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: "var(--text-sm)",
            fontWeight: 500,
            color: "var(--text-primary)",
            marginBottom: "0.25rem",
          }}
        >
          {alert.title}
        </div>
        <div
          style={{
            fontSize: "var(--text-xs)",
            color: "var(--text-secondary)",
            lineHeight: 1.5,
          }}
        >
          {alert.body}
        </div>
        {alert.actionLabel && (
          <Link href={alert.actionHref}>
            <div
              style={{
                fontSize: "var(--text-xs)",
                color: config.color,
                fontWeight: 600,
                marginTop: "0.25rem",
                cursor: "pointer",
              }}
            >
              {alert.actionLabel} →
            </div>
          </Link>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function CommandCenterPage() {
  const [briefData, setBriefData] = useState<BriefData | null>(null);
  const [signals, setSignals] = useState<BankedSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [briefLoading, setBriefLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [pipeline, setPipeline] = useState<{ scanTs: number | null; draftCount: number; publishedCount: number; lastPublishedTitle: string | null } | null>(null);
  const [quickIdeasOpen, setQuickIdeasOpen] = useState(false);

  const loadState = useCallback(async () => {
    try {
      const [stateRes, signalsRes] = await Promise.all([
        apiFetch("/api/empire?action=state"),
        apiFetch("/api/signals"),
      ]);
      const [stateJson, signalsJson] = await Promise.all([
        stateRes.json(),
        signalsRes.json(),
      ]);
      if (signalsJson.success) setSignals(signalsJson.data.slice(0, 8));
      if (stateJson.success) {
        setBriefData((prev) =>
          prev ? { ...prev, state: stateJson.data } : null
        );
      }
    } catch {
      // silent — UI handles empty state
    } finally {
      setLoading(false);
    }
  }, []);

  const loadBrief = useCallback(async () => {
    setBriefLoading(true);
    try {
      const res = await apiFetch("/api/empire?action=brief");
      const json = await res.json();
      if (json.success) {
        setBriefData(json.data);
        setLastRefresh(new Date());
      }
    } catch {
      // silent
    } finally {
      setBriefLoading(false);
    }
  }, []);

  useEffect(() => {
    loadState();
    loadBrief();
  }, [loadState, loadBrief]);

  useEffect(() => {
    const scanTs = loadScanFromCache()?.timestamp ?? null;
    void Promise.all([
      apiFetch("/api/products?limit=50").then((r) => r.json()).catch(() => ({ success: false })),
    ]).then(([prod]) => {
      const products = (prod as { success: boolean; data?: Array<{ status?: string; title?: string }> }).success
        ? ((prod as { data: Array<{ status?: string; title?: string }> }).data ?? [])
        : [];
      const draftCount = products.filter((p) => !p.status || p.status === "draft").length;
      const published = products.filter((p) => p.status === "published");
      setPipeline({
        scanTs,
        draftCount,
        publishedCount: published.length,
        lastPublishedTitle: published[0]?.title ?? null,
      });
    });
  }, []);

  const state = briefData?.state;
  const topSignals = signals.filter((s) => !s.activatedAt).slice(0, 5);
  const showStatic = topSignals.length === 0;
  const urgencyColor =
    briefData?.nextAction?.urgency === "high"
      ? "var(--rose)"
      : briefData?.nextAction?.urgency === "medium"
      ? "var(--amber)"
      : "var(--emerald)";

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-page)" }}>

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div
        style={{
          padding: "1.5rem 2rem",
          borderBottom: "1px solid var(--border-light)",
          background: "var(--bg-surface)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "var(--text-xl)",
              fontWeight: 600,
              color: "var(--text-primary)",
              margin: 0,
              letterSpacing: "-0.02em",
            }}
          >
            Dashboard
          </h1>
          <p
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--text-secondary)",
              margin: "0.25rem 0 0",
            }}
          >
            Your publishing empire at a glance
          </p>
        </div>
        <button
          onClick={loadBrief}
          disabled={briefLoading}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.375rem",
            padding: "0.5rem 1rem",
            borderRadius: "var(--radius-md)",
            background: "var(--bg-surface)",
            border: "1px solid var(--border-medium)",
            color: "var(--text-secondary)",
            fontSize: "var(--text-sm)",
            fontWeight: 500,
            cursor: briefLoading ? "not-allowed" : "pointer",
            opacity: briefLoading ? 0.6 : 1,
          }}
        >
          <RefreshCw
            size={13}
            style={{
              color: "var(--text-muted)",
              animation: briefLoading ? "spin 1s linear infinite" : "none",
            }}
          />
          {briefLoading ? "Updating…" : "Refresh Intel"}
        </button>
      </div>

      {/* ── Today's Pipeline ────────────────────────────────────────────────── */}
      {pipeline && (
        <div style={{ padding: "0.875rem 2rem", borderBottom: "1px solid var(--border-light)", background: "var(--bg-subtle)", display: "flex", alignItems: "center", gap: "1.5rem", flexWrap: "wrap" }}>
          <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", flexShrink: 0 }}>Today&apos;s Pipeline</span>
          <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "var(--text-xs)" }}>
            <span style={{ color: pipeline.scanTs ? (getStaleTier(pipeline.scanTs) === "fresh" ? "var(--emerald)" : getStaleTier(pipeline.scanTs) === "stale" ? "var(--amber)" : "var(--rose)") : "var(--text-muted)", fontWeight: 500 }}>
              {pipeline.scanTs ? `Last scan: ${getScanAge({ timestamp: pipeline.scanTs })}` : "No scan yet"}
            </span>
            <span style={{ color: "var(--border-medium)" }}>·</span>
            <Link href="/intelligence"><span style={{ color: "var(--blue)", fontWeight: 500, cursor: "pointer" }}>Re-scan</span></Link>
          </div>
          <div style={{ width: 1, height: 16, background: "var(--border-light)", flexShrink: 0 }} />
          <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "var(--text-xs)" }}>
            <span style={{ color: pipeline.draftCount > 0 ? "var(--text-primary)" : "var(--text-muted)", fontWeight: 500 }}>
              In draft: {pipeline.draftCount} product{pipeline.draftCount !== 1 ? "s" : ""} ready to publish
            </span>
            {pipeline.draftCount > 0 && (
              <>
                <span style={{ color: "var(--border-medium)" }}>·</span>
                <Link href="/publishing"><span style={{ color: "var(--blue)", fontWeight: 500, cursor: "pointer" }}>Publish →</span></Link>
              </>
            )}
          </div>
          <div style={{ width: 1, height: 16, background: "var(--border-light)", flexShrink: 0 }} />
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
            Published: <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>{pipeline.publishedCount} total</span>
            {pipeline.lastPublishedTitle && <span> · Last: &quot;{pipeline.lastPublishedTitle}&quot;</span>}
          </div>
          <div style={{ marginLeft: "auto" }}>
            <button
              onClick={() => setQuickIdeasOpen(true)}
              style={{ display: "flex", alignItems: "center", gap: "0.375rem", padding: "0.3125rem 0.75rem", borderRadius: "var(--radius-md)", background: "none", border: "1px solid var(--border-medium)", color: "var(--text-secondary)", fontSize: "var(--text-xs)", fontWeight: 500, cursor: "pointer" }}
            >
              <Zap size={11} style={{ color: "var(--amber)" }} />
              Quick Ideas
            </button>
          </div>
        </div>
      )}

      {quickIdeasOpen && <QuickIdeasModal onClose={() => setQuickIdeasOpen(false)} />}

      {/* ── KPI row ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          gap: "0.75rem",
          padding: "1.25rem 2rem",
          borderBottom: "1px solid var(--border-light)",
          background: "var(--bg-page)",
        }}
      >
        <StatCard
          label="Monthly Revenue"
          value={loading ? "—" : (state?.estimatedMonthlyRevenuePotential ?? "$0")}
          sublabel="per month est."
          color="var(--emerald)"
          loading={loading}
        />
        <StatCard
          label="Products Built"
          value={loading ? "—" : (state?.productsGenerated ?? 0)}
          sublabel="in library"
          loading={loading}
        />
        <StatCard
          label="Signal Moat"
          value={loading ? "—" : (state?.signalCount ?? 0)}
          sublabel={`${state?.uniqueTerritoriesOwned ?? 0} territories`}
          loading={loading}
        />
        <StatCard
          label="Empire Score"
          value={loading ? "—" : (state?.empireScore ?? 0)}
          sublabel="out of 1000"
          color="var(--amber)"
          loading={loading}
        />
        <StatCard
          label="Brands Built"
          value={loading ? "—" : (state?.brandsBuilt ?? 0)}
          loading={loading}
        />
      </div>

      {/* ── 2-column body ───────────────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 22rem",
          gap: "1.5rem",
          padding: "1.5rem 2rem",
          alignItems: "start",
        }}
      >
        {/* Getting Started spans full width — placed as first col-span */}
        <div style={{ gridColumn: "1 / -1" }}>
          <GettingStarted />
          <TodaysPriorityEngine />
        </div>

        {/* ── Left column ─────────────────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

          {/* Intelligence Brief */}
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-light)",
              borderRadius: "var(--radius-lg)",
              padding: "1.25rem 1.5rem",
              boxShadow: "var(--shadow-xs)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "1rem",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "var(--text-sm)",
                    fontWeight: 500,
                    color: "var(--text-primary)",
                  }}
                >
                  Intelligence Brief
                </div>
                {briefData && (
                  <div
                    style={{
                      fontSize: "var(--text-xs)",
                      color: "var(--text-muted)",
                      marginTop: "0.125rem",
                    }}
                  >
                    {lastRefresh.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                )}
              </div>
              {briefData?.brief.marketCondition && (
                <span
                  style={{
                    fontSize: "var(--text-xs)",
                    fontWeight: 500,
                    padding: "0.1875rem 0.5rem",
                    background:
                      briefData.brief.marketCondition === "hot"
                        ? "var(--rose-bg)"
                        : briefData.brief.marketCondition === "warm"
                        ? "var(--amber-bg)"
                        : "var(--emerald-bg)",
                    color:
                      briefData.brief.marketCondition === "hot"
                        ? "var(--rose)"
                        : briefData.brief.marketCondition === "warm"
                        ? "var(--amber)"
                        : "var(--emerald)",
                    border: `1px solid ${
                      briefData.brief.marketCondition === "hot"
                        ? "var(--rose-border)"
                        : briefData.brief.marketCondition === "warm"
                        ? "var(--amber-border)"
                        : "var(--emerald-border)"
                    }`,
                    borderRadius: 20,
                    textTransform: "capitalize",
                  }}
                >
                  Market {briefData.brief.marketCondition}
                </span>
              )}
            </div>

            <AnimatePresence mode="wait">
              {briefLoading && !briefData ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  {[100, 85, 70].map((w, i) => (
                    <div
                      key={i}
                      style={{
                        height: "1rem",
                        borderRadius: "var(--radius-sm)",
                        background: "var(--bg-subtle)",
                        animation: "shimmer 1.5s ease-in-out infinite",
                        width: `${w}%`,
                        marginBottom: i < 2 ? "0.5rem" : 0,
                      }}
                    />
                  ))}
                </motion.div>
              ) : briefData?.brief ? (
                <motion.div
                  key="brief"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <p
                    style={{
                      fontSize: "var(--text-sm)",
                      color: "var(--text-secondary)",
                      lineHeight: 1.7,
                      margin: "0 0 1rem",
                    }}
                  >
                    {briefData.brief.brief}
                  </p>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "0.75rem",
                    }}
                  >
                    <div
                      style={{
                        padding: "0.75rem",
                        borderRadius: "var(--radius-md)",
                        background: "var(--emerald-bg)",
                        border: "1px solid var(--emerald-border)",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "var(--text-xs)",
                          fontWeight: 600,
                          color: "var(--emerald)",
                          marginBottom: "0.25rem",
                        }}
                      >
                        Primary Opportunity
                      </div>
                      <div
                        style={{
                          fontSize: "var(--text-xs)",
                          color: "var(--text-secondary)",
                          lineHeight: 1.4,
                        }}
                      >
                        {briefData.brief.primaryOpportunity}
                      </div>
                    </div>
                    <div
                      style={{
                        padding: "0.75rem",
                        borderRadius: "var(--radius-md)",
                        background: "var(--rose-bg)",
                        border: "1px solid var(--rose-border)",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "var(--text-xs)",
                          fontWeight: 600,
                          color: "var(--rose)",
                          marginBottom: "0.25rem",
                        }}
                      >
                        Primary Risk
                      </div>
                      <div
                        style={{
                          fontSize: "var(--text-xs)",
                          color: "var(--text-secondary)",
                          lineHeight: 1.4,
                        }}
                      >
                        {briefData.brief.primaryRisk}
                      </div>
                    </div>
                  </div>
                  {briefData.brief.todaysFocus && (
                    <div
                      style={{
                        marginTop: "0.75rem",
                        padding: "0.625rem 0.75rem",
                        borderRadius: "var(--radius-md)",
                        background: "var(--amber-bg)",
                        border: "1px solid var(--amber-border)",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                      }}
                    >
                      <Target size={13} style={{ color: "var(--amber)", flexShrink: 0 }} />
                      <span
                        style={{
                          fontSize: "var(--text-xs)",
                          color: "var(--amber)",
                          fontWeight: 600,
                        }}
                      >
                        {briefData.brief.todaysFocus}
                      </span>
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <p
                    style={{
                      fontSize: "var(--text-sm)",
                      color: "var(--text-muted)",
                      fontStyle: "italic",
                      lineHeight: 1.6,
                    }}
                  >
                    Your empire has no intelligence yet. Scan the emotional market
                    to generate your first operator brief.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Market Opportunities */}
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-light)",
              borderRadius: "var(--radius-lg)",
              padding: "1.25rem 1.5rem",
              boxShadow: "var(--shadow-xs)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "0.5rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                <Flame size={14} style={{ color: "var(--rose)" }} />
                <span
                  style={{
                    fontSize: "var(--text-sm)",
                    fontWeight: 500,
                    color: "var(--text-primary)",
                  }}
                >
                  {showStatic
                    ? "Market Opportunities — Unclaimed"
                    : "Opportunity Radar — Your Signals"}
                </span>
              </div>
              <Link href="/signals">
                <span
                  style={{
                    fontSize: "var(--text-xs)",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                  }}
                >
                  {showStatic ? "Scan to claim →" : `${signals.length} banked →`}
                </span>
              </Link>
            </div>

            {showStatic ? (
              <>
                {STATIC_OPPORTUNITIES.map((o, i) => (
                  <StaticOpportunityRow key={o.niche} {...o} index={i} />
                ))}
                <div
                  style={{
                    marginTop: "0.75rem",
                    padding: "0.75rem",
                    borderRadius: "var(--radius-md)",
                    background: "var(--bg-subtle)",
                    border: "1px solid var(--border-light)",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.625rem",
                  }}
                >
                  <Activity size={14} style={{ color: "var(--blue)" }} />
                  <span
                    style={{
                      fontSize: "var(--text-xs)",
                      color: "var(--text-secondary)",
                      flex: 1,
                    }}
                  >
                    Scan the signal market to claim real emotional territories
                  </span>
                  <Link href="/signals">
                    <span
                      style={{
                        fontSize: "var(--text-xs)",
                        color: "var(--blue)",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Scan Now →
                    </span>
                  </Link>
                </div>
              </>
            ) : (
              <>
                {topSignals.map((s, i) => (
                  <OpportunityRow key={s.id} signal={s} index={i} />
                ))}
                {signals.filter((s) => s.activatedAt).length > 0 && (
                  <div
                    style={{
                      marginTop: "0.75rem",
                      padding: "0.5rem 0.75rem",
                      borderRadius: "var(--radius-md)",
                      background: "var(--emerald-bg)",
                      border: "1px solid var(--emerald-border)",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.375rem",
                    }}
                  >
                    <CheckCircle2 size={12} style={{ color: "var(--emerald)" }} />
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--emerald)" }}>
                      {signals.filter((s) => s.activatedAt).length} signal
                      {signals.filter((s) => s.activatedAt).length > 1 ? "s" : ""} activated — territory claimed
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Right column ─────────────────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

          {/* Next Best Action */}
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-light)",
              borderRadius: "var(--radius-lg)",
              padding: "1.25rem",
              boxShadow: "var(--shadow-xs)",
            }}
          >
            <div
              style={{
                fontSize: "var(--text-sm)",
                fontWeight: 500,
                color: "var(--text-primary)",
                marginBottom: "0.875rem",
              }}
            >
              Highest ROI Move
            </div>

            <AnimatePresence mode="wait">
              {briefLoading && !briefData ? (
                <motion.div
                  key="nba-loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <div
                    style={{
                      height: "5rem",
                      borderRadius: "var(--radius-md)",
                      background: "var(--bg-subtle)",
                      animation: "shimmer 1.5s ease-in-out infinite",
                    }}
                  />
                </motion.div>
              ) : briefData?.nextAction ? (
                <motion.div
                  key="nba"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div
                    style={{
                      borderRadius: "var(--radius-md)",
                      background: "var(--bg-subtle)",
                      border: "1px solid var(--border-light)",
                      padding: "0.875rem",
                      marginBottom: "0.5rem",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.375rem",
                        marginBottom: "0.5rem",
                      }}
                    >
                      <div
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: urgencyColor,
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          fontSize: "var(--text-xs)",
                          fontWeight: 500,
                          color: urgencyColor,
                          textTransform: "capitalize",
                        }}
                      >
                        {briefData.nextAction.urgency} urgency
                      </span>
                      <span
                        style={{
                          fontSize: "var(--text-xs)",
                          color: "var(--text-muted)",
                          marginLeft: "auto",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.25rem",
                        }}
                      >
                        <Clock size={10} />
                        {briefData.nextAction.executionTime}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: "var(--text-base)",
                        fontWeight: 600,
                        color: "var(--text-primary)",
                        marginBottom: "0.375rem",
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {briefData.nextAction.action}
                    </div>
                    <div
                      style={{
                        fontSize: "var(--text-xs)",
                        color: "var(--text-secondary)",
                        lineHeight: 1.5,
                        marginBottom: "0.75rem",
                      }}
                    >
                      {briefData.nextAction.detail}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "var(--text-xs)",
                          color: "var(--emerald)",
                          fontWeight: 600,
                        }}
                      >
                        {briefData.nextAction.estimatedRevenue}
                      </span>
                      <Link href={briefData.nextAction.href}>
                        <button
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.25rem",
                            padding: "0.375rem 0.875rem",
                            borderRadius: "var(--radius-md)",
                            fontSize: "var(--text-xs)",
                            fontWeight: 600,
                            color: "white",
                            background: "var(--text-primary)",
                            border: "none",
                            cursor: "pointer",
                          }}
                        >
                          Execute <ArrowRight size={11} />
                        </button>
                      </Link>
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: "var(--text-xs)",
                      color: "var(--text-muted)",
                      fontStyle: "italic",
                      lineHeight: 1.5,
                    }}
                  >
                    {briefData.nextAction.reasoning}
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="nba-empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <Link href="/signals">
                    <div
                      style={{
                        padding: "0.875rem",
                        borderRadius: "var(--radius-md)",
                        background: "var(--amber-bg)",
                        border: "1px solid var(--amber-border)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.625rem",
                      }}
                    >
                      <Activity size={16} style={{ color: "var(--amber)" }} />
                      <div>
                        <div
                          style={{
                            fontSize: "var(--text-sm)",
                            fontWeight: 600,
                            color: "var(--amber)",
                          }}
                        >
                          Scan Signal Market
                        </div>
                        <div
                          style={{
                            fontSize: "var(--text-xs)",
                            color: "var(--text-muted)",
                            marginTop: "0.125rem",
                          }}
                        >
                          Claim your first emotional territory
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Execution Pipeline */}
          {state &&
            (state.brandsBuilt > 0 || state.productsGenerated > 0) && (
              <div
                style={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-light)",
                  borderRadius: "var(--radius-lg)",
                  padding: "1.25rem",
                  boxShadow: "var(--shadow-xs)",
                }}
              >
                <div
                  style={{
                    fontSize: "var(--text-sm)",
                    fontWeight: 500,
                    color: "var(--text-primary)",
                    marginBottom: "0.75rem",
                  }}
                >
                  Execution Pipeline
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                  {[
                    {
                      label: "Brands → No Products",
                      count: Math.max(0, state.brandsBuilt - (state.productsGenerated > 0 ? 1 : 0)),
                      href: "/products",
                      color: "var(--amber)",
                      action: "Generate",
                    },
                    {
                      label: "Products → No Content",
                      count:
                        state.productsGenerated > 0 && state.contentPiecesCreated === 0
                          ? state.productsGenerated
                          : 0,
                      href: "/content",
                      color: "var(--rose)",
                      action: "Create",
                    },
                    {
                      label: "Content → Not Published",
                      count: state.contentPiecesCreated,
                      href: "/publishing",
                      color: "var(--violet)",
                      action: "Publish",
                    },
                  ]
                    .filter((p) => p.count > 0)
                    .map((pipeline) => (
                      <Link key={pipeline.label} href={pipeline.href}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            padding: "0.5rem 0.625rem",
                            borderRadius: "var(--radius-md)",
                            background: "var(--bg-subtle)",
                            border: "1px solid var(--border-light)",
                            cursor: "pointer",
                          }}
                        >
                          <div
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: "var(--radius-sm)",
                              background: "var(--bg-surface)",
                              border: "1px solid var(--border-light)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            <span
                              style={{
                                fontSize: "var(--text-xs)",
                                fontWeight: 700,
                                color: pipeline.color,
                              }}
                            >
                              {pipeline.count}
                            </span>
                          </div>
                          <span
                            style={{
                              fontSize: "var(--text-xs)",
                              color: "var(--text-secondary)",
                              flex: 1,
                            }}
                          >
                            {pipeline.label}
                          </span>
                          <span
                            style={{
                              fontSize: "var(--text-xs)",
                              color: pipeline.color,
                              fontWeight: 600,
                            }}
                          >
                            {pipeline.action} →
                          </span>
                        </div>
                      </Link>
                    ))}
                </div>
              </div>
            )}

          {/* Strategic Alerts */}
          {briefData?.alerts && briefData.alerts.length > 0 && (
            <div
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border-light)",
                borderRadius: "var(--radius-lg)",
                padding: "1.25rem",
                boxShadow: "var(--shadow-xs)",
              }}
            >
              <div
                style={{
                  fontSize: "var(--text-sm)",
                  fontWeight: 500,
                  color: "var(--text-primary)",
                  marginBottom: "0.75rem",
                }}
              >
                Strategic Alerts
              </div>
              {briefData.alerts.slice(0, 3).map((alert, i) => (
                <AlertItem key={i} alert={alert} />
              ))}
            </div>
          )}

          {/* Quick Actions */}
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-light)",
              borderRadius: "var(--radius-lg)",
              padding: "1.25rem",
              boxShadow: "var(--shadow-xs)",
            }}
          >
            <div
              style={{
                fontSize: "var(--text-sm)",
                fontWeight: 500,
                color: "var(--text-primary)",
                marginBottom: "0.75rem",
              }}
            >
              Launch Actions
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "0.375rem",
              }}
            >
              {QUICK_ACTIONS.map((action) => (
                <Link key={action.href} href={action.href}>
                  <motion.div
                    whileHover={{ backgroundColor: "var(--bg-hover)" }}
                    transition={{ duration: 0.1 }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      padding: "0.5rem 0.625rem",
                      borderRadius: "var(--radius-md)",
                      background: "var(--bg-subtle)",
                      border: "1px solid var(--border-light)",
                      cursor: "pointer",
                    }}
                  >
                    <action.icon
                      size={13}
                      style={{ color: action.color, flexShrink: 0 }}
                    />
                    <span
                      style={{
                        fontSize: "var(--text-xs)",
                        color: "var(--text-secondary)",
                        lineHeight: 1.3,
                      }}
                    >
                      {action.label}
                    </span>
                  </motion.div>
                </Link>
              ))}
            </div>
            <div
              style={{
                marginTop: "0.75rem",
                padding: "0.5rem 0.625rem",
                borderRadius: "var(--radius-md)",
                background: "var(--bg-subtle)",
                border: "1px solid var(--border-light)",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                Press
              </span>
              <kbd
                style={{
                  fontSize: "var(--text-xs)",
                  padding: "0.0625rem 0.3125rem",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-medium)",
                  color: "var(--text-secondary)",
                  fontFamily: "monospace",
                }}
              >
                ⌘K
              </kbd>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                for command palette
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
