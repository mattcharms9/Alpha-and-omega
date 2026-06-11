"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  Scan,
  TrendingUp,
  Target,
  Users,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  AlertCircle,
  BarChart2,
  Search,
  Loader2,
  Crosshair,
  Calendar,
  Zap,
  Clock,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, ScoreBadge } from "@/components/ui/Badge";
import { EmotionalIntelligenceReport, EmotionalTrend } from "@/lib/ai/intelligence-engine";
import type { PerformanceInsight } from "@/lib/analytics/revenue-aggregator";
import type { MarketResearchReport } from "@/lib/ai/market-research-engine";
import type { SeasonalCalendar, SeasonalOpportunity } from "@/lib/ai/seasonal-engine";
import { apiFetch } from "@/lib/api";
import { useRouter } from "next/navigation";
import {
  loadScanFromCache,
  saveScanToCache,
  clearScanCache,
  getScanAge,
  getStaleTier,
  saveNicheExpansionToCache,
  loadNicheExpansionFromCache,
} from "@/lib/cache/intelligence-cache";
import type { CachedScan } from "@/lib/cache/intelligence-cache";
import { useIntelligenceLaunch } from "@/lib/stores/intelligence-launch";
import type { SubNiche } from "@/lib/ai/niche-types";

const FOCUS_OPTIONS = [
  "All Emotional Niches",
  "Anxiety & Mental Health",
  "Masculine Identity & Growth",
  "Feminine Healing & Empowerment",
  "ADHD & Neurodivergent",
  "Burnout & Recovery",
  "Creator Economy Struggles",
  "Relationship & Breakup Recovery",
  "Financial Stress & Discipline",
  "Loneliness & Purpose",
  "Body Image & Self-Worth",
  "Career Transition & Reinvention",
];

const COMPETITION_COLORS: Record<string, string> = {
  low: "var(--emerald)",
  medium: "var(--amber)",
  high: "var(--rose)",
};

const TREND_COLORS: Record<string, string> = {
  rising: "var(--emerald)",
  stable: "var(--amber)",
  declining: "var(--rose)",
};

function TrendCard({
  trend,
  index,
  onLaunchProduct,
}: {
  trend: EmotionalTrend;
  index: number;
  onLaunchProduct: (trend: EmotionalTrend) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [researching, setResearching] = useState(false);
  const [marketReport, setMarketReport] = useState<MarketResearchReport | null>(null);
  const [nicheExpanded, setNicheExpanded] = useState(false);
  const [nicheLoading, setNicheLoading] = useState(false);
  const [nicheReport, setNicheReport] = useState<SubNiche[] | null>(null);
  const [bankStatus, setBankStatus] = useState<"idle" | "saving" | "saved" | "exists">("idle");
  const [researchError, setResearchError] = useState<string | null>(null);

  async function handleSaveToSignalBank(e: React.MouseEvent) {
    e.stopPropagation();
    if (bankStatus !== "idle") return;
    setBankStatus("saving");
    try {
      const res = await apiFetch("/api/signals?action=bank", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(trend) });
      const data = await res.json() as { success: boolean; data?: { alreadySaved?: boolean } };
      setBankStatus(data.data?.alreadySaved ? "exists" : "saved");
    } catch { setBankStatus("idle"); }
  }

  async function handleExpandNiche(e: React.MouseEvent) {
    e.stopPropagation();
    if (nicheExpanded) { setNicheExpanded(false); return; }
    const cached = loadNicheExpansionFromCache(trend.emotion);
    if (cached) {
      setNicheReport(cached as SubNiche[]);
      setNicheExpanded(true);
      return;
    }
    setNicheLoading(true);
    try {
      const res = await apiFetch("/api/niche-expansion?action=expand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emotion: trend.emotion }),
      });
      const data = await res.json() as { success: boolean; data?: SubNiche[] };
      if (data.success && data.data) {
        setNicheReport(data.data);
        setNicheExpanded(true);
        saveNicheExpansionToCache(trend.emotion, data.data);
      }
    } catch { /* silent */ }
    finally { setNicheLoading(false); }
  }

  async function runMarketResearch(e: React.MouseEvent) {
    e.stopPropagation();
    setResearching(true);
    setResearchError(null);
    try {
      const res = await apiFetch("/api/market-research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche: trend.painPoint, emotionalCategory: trend.emotion }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setMarketReport(data.data);
      setExpanded(true);
    } catch (err) {
      setResearchError(err instanceof Error ? err.message : "Research failed — try again");
    } finally {
      setResearching(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06 }}
    >
      <Card hover onClick={() => setExpanded(!expanded)}>
        <CardBody>
          <div className="flex items-start gap-4">
            {/* Score badge */}
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "var(--radius-md)",
                background:
                  trend.monetizationScore >= 80
                    ? "var(--emerald-bg)"
                    : trend.monetizationScore >= 60
                    ? "var(--amber-bg)"
                    : "var(--bg-subtle)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontSize: "1.375rem",
                  fontWeight: 700,
                  color:
                    trend.monetizationScore >= 80
                      ? "var(--emerald)"
                      : trend.monetizationScore >= 60
                      ? "var(--amber)"
                      : "var(--text-muted)",
                  letterSpacing: "-0.02em",
                  lineHeight: 1,
                }}
              >
                {trend.monetizationScore}
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <div
                    style={{
                      fontSize: "0.9375rem",
                      fontWeight: 600,
                      color: "var(--text-primary)",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {trend.painPoint}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 1 }}>
                    {trend.emotion}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge
                    variant={
                      trend.searchVolumeTrend === "rising"
                        ? "emerald"
                        : trend.searchVolumeTrend === "stable"
                        ? "amber"
                        : "rose"
                    }
                  >
                    {trend.searchVolumeTrend === "rising" ? "↑" : trend.searchVolumeTrend === "stable" ? "→" : "↓"}{" "}
                    {trend.searchVolumeTrend}
                  </Badge>
                  <Badge
                    variant={
                      trend.competitionLevel === "low"
                        ? "emerald"
                        : trend.competitionLevel === "medium"
                        ? "amber"
                        : "rose"
                    }
                  >
                    {trend.competitionLevel} competition
                  </Badge>
                </div>
              </div>

              <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                {trend.description}
              </p>

              {/* Score bars */}
              <div className="grid gap-2 mt-3" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
                {[
                  { label: "Monetization", value: trend.monetizationScore, color: "var(--gold)" },
                  { label: "Evergreen", value: trend.evergreenScore, color: "var(--violet)" },
                  { label: "Loyalty", value: trend.audienceLoyalty, color: "var(--cyan)" },
                  { label: "Urgency", value: trend.urgency, color: "var(--rose)" },
                ].map((bar) => (
                  <div key={bar.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span style={{ fontSize: "0.6rem", color: "var(--text-muted)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                        {bar.label}
                      </span>
                      <span style={{ fontSize: "0.7rem", fontWeight: 600, color: bar.color }}>
                        {bar.value}
                      </span>
                    </div>
                    <div style={{ height: 3, borderRadius: 2, background: "var(--bg-elevated)", overflow: "hidden" }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${bar.value}%` }}
                        transition={{ duration: 0.7, delay: index * 0.06 + 0.2, ease: "easeOut" }}
                        style={{ height: "100%", borderRadius: 2, background: bar.color, opacity: 0.8 }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Revenue */}
              <div className="flex items-center gap-4 mt-3">
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <DollarSign size={12} style={{ color: "var(--emerald)" }} />
                  <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--emerald)" }}>
                    {trend.estimatedAnnualRevenue}
                  </span>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>est. annual</span>
                </div>
                <button
                  onClick={runMarketResearch}
                  disabled={researching}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: "0.72rem",
                    color: researching ? "var(--text-muted)" : "var(--cyan)",
                    fontWeight: 600,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "2px 6px",
                    borderRadius: 5,
                  }}
                >
                  {researching ? <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} /> : <Search size={11} />}
                  {researching ? "Researching... (~20s)" : "Market Research"}
                </button>
                {researchError && <span style={{ fontSize: "0.7rem", color: "var(--rose)" }}>{researchError}</span>}
                <button
                  onClick={handleExpandNiche}
                  disabled={nicheLoading}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: "0.72rem",
                    color: nicheExpanded ? "var(--text-muted)" : "var(--amber)",
                    fontWeight: 600,
                    background: "none",
                    border: nicheExpanded ? "1px solid var(--border-light)" : "1px solid var(--amber-border)",
                    cursor: "pointer",
                    padding: "3px 8px",
                    borderRadius: 6,
                    backgroundColor: nicheExpanded ? "transparent" : "var(--amber-bg)",
                  }}
                >
                  {nicheLoading ? <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} /> : <Crosshair size={11} />}
                  {nicheExpanded ? "Collapse ↑" : nicheLoading ? "Expanding... (~15s)" : "Expand Niche"}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onLaunchProduct(trend); }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: "0.72rem",
                    color: "white",
                    fontWeight: 600,
                    background: "var(--emerald)",
                    border: "1px solid var(--emerald)",
                    cursor: "pointer",
                    padding: "3px 10px",
                    borderRadius: 6,
                  }}
                >
                  <Sparkles size={11} />
                  Generate Products →
                </button>
                <button
                  style={{
                    marginLeft: "auto",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: "0.75rem",
                    color: "var(--text-muted)",
                  }}
                >
                  {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  {expanded ? "Less" : "Details"}
                </button>
              </div>
            </div>
          </div>

          {/* Expanded Details */}
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                style={{ overflow: "hidden" }}
              >
                <div
                  style={{
                    marginTop: 16,
                    paddingTop: 16,
                    borderTop: "1px solid var(--border-subtle)",
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr",
                    gap: 16,
                  }}
                >
                  <div>
                    <div className="label mb-2">Product Opportunities</div>
                    <div className="flex flex-col gap-1.5">
                      {trend.productOpportunities.map((opp, i) => (
                        <div
                          key={i}
                          style={{
                            fontSize: "0.78rem",
                            color: "var(--text-secondary)",
                            padding: "3px 8px",
                            borderRadius: 6,
                            background: "var(--bg-elevated)",
                          }}
                        >
                          {opp}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="label mb-2">Audience Archetypes</div>
                    <div className="flex flex-col gap-1.5">
                      {trend.audienceArchetypes.map((arch, i) => (
                        <div
                          key={i}
                          style={{
                            fontSize: "0.78rem",
                            color: "var(--text-secondary)",
                            padding: "3px 8px",
                            borderRadius: 6,
                            background: "var(--bg-elevated)",
                          }}
                        >
                          {arch}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="label mb-2">Best Platforms</div>
                    <div className="flex flex-wrap gap-1.5">
                      {trend.platforms.map((p, i) => (
                        <Badge key={i} variant="muted">{p}</Badge>
                      ))}
                    </div>
                    <div className="mt-3">
                      <div className="label mb-2">Tags</div>
                      <div className="flex flex-wrap gap-1">
                        {trend.tags.map((tag, i) => (
                          <Badge key={i} variant="default" size="sm">{tag}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* A4: Save to Signal Bank button */}
                <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--border-subtle)", display: "flex", justifyContent: "flex-end" }}>
                  <button
                    onClick={handleSaveToSignalBank}
                    disabled={bankStatus !== "idle"}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 8, fontSize: "0.8rem", fontWeight: 600, cursor: bankStatus !== "idle" ? "default" : "pointer", border: "1px solid var(--border-medium)", background: bankStatus === "saved" ? "var(--emerald-bg)" : bankStatus === "exists" ? "var(--bg-elevated)" : "var(--bg-elevated)", color: bankStatus === "saved" ? "var(--emerald)" : bankStatus === "exists" ? "var(--text-muted)" : "var(--text-secondary)" }}
                  >
                    {bankStatus === "saving" ? "Saving..." : bankStatus === "saved" ? "✓ Saved to Signal Bank" : bankStatus === "exists" ? "✓ Already in Signal Bank" : "Save to Signal Bank"}
                  </button>
                </div>

                {marketReport && (
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border-subtle)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                      <Search size={13} style={{ color: "var(--cyan)" }} />
                      <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--cyan)", letterSpacing: "0.05em" }}>
                        ETSY MARKET RESEARCH — {marketReport.competitiveIntensity.toUpperCase()}
                      </div>
                      <div style={{
                        marginLeft: "auto", fontSize: "0.7rem", fontWeight: 700,
                        color: marketReport.overallOpportunityScore >= 70 ? "var(--emerald)" : marketReport.overallOpportunityScore >= 50 ? "var(--amber)" : "var(--rose)",
                      }}>
                        {marketReport.overallOpportunityScore}/100 opportunity
                      </div>
                    </div>
                    <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr", marginBottom: 12 }}>
                      <div style={{ padding: "10px 12px", background: "var(--bg-elevated)", borderRadius: 8 }}>
                        <div className="label mb-1">Pricing Strategy</div>
                        <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>{marketReport.pricingStrategy}</div>
                      </div>
                      <div style={{ padding: "10px 12px", background: "var(--bg-elevated)", borderRadius: 8 }}>
                        <div className="label mb-1">Projected Revenue</div>
                        <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--emerald)" }}>{marketReport.projectedMonthlyRevenue}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>First sale in {marketReport.timeToFirstSale}</div>
                      </div>
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <div className="label mb-2">Winning Listing Pattern</div>
                      <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>{marketReport.winningListingPattern}</div>
                    </div>
                    <div>
                      <div className="label mb-2">Action Plan</div>
                      <div className="flex flex-col gap-1">
                        {marketReport.actionPlan.map((step, i) => (
                          <div key={i} style={{ display: "flex", gap: 8, fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                            <span style={{ color: "var(--cyan)", fontWeight: 700, minWidth: 16 }}>{i + 1}.</span>
                            <span>{step}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </CardBody>
      </Card>

      {/* Inline niche expansion panel */}
      <AnimatePresence>
        {nicheExpanded && nicheReport && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: "hidden" }}
          >
            <div
              style={{
                border: "1px solid var(--amber-border)",
                borderTop: "none",
                borderRadius: "0 0 var(--radius-lg) var(--radius-lg)",
                background: "var(--amber-bg)",
                padding: "16px 20px",
              }}
            >
              <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--amber)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {nicheReport.length} Sub-Niches in {trend.emotion}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {nicheReport.slice(0, 5).map((sub, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 12px",
                      background: "var(--bg-surface)",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border-light)",
                    }}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "var(--radius-sm)",
                        background: sub.opportunityScore >= 80 ? "var(--emerald-bg)" : "var(--amber-bg)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        fontSize: "var(--text-xs)",
                        fontWeight: 700,
                        color: sub.opportunityScore >= 80 ? "var(--emerald)" : "var(--amber)",
                      }}
                    >
                      {sub.opportunityScore.toFixed(0)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--text-primary)" }}>{sub.nicheName}</div>
                      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>{sub.topProductRecommendation.format.replace("_", " ")} · ${sub.topProductRecommendation.pricePoint}</div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); onLaunchProduct({ ...trend, painPoint: sub.nicheName, audienceArchetypes: [sub.audience.name], monetizationScore: sub.opportunityScore }); }}
                      style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--emerald)", background: "var(--emerald-bg)", border: "1px solid var(--emerald-border)", borderRadius: "var(--radius-sm)", padding: "3px 8px", cursor: "pointer", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 3 }}
                    >
                      <ArrowRight size={10} /> Launch
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

const URGENCY_CONFIG: Record<SeasonalOpportunity["urgency"], { label: string; color: string; icon: typeof Zap }> = {
  publish_now: { label: "PUBLISH NOW", color: "var(--rose)", icon: Zap },
  prepare_now: { label: "PREPARE NOW", color: "var(--amber)", icon: Clock },
  plan_ahead: { label: "PLAN AHEAD", color: "var(--cyan)", icon: Calendar },
  off_season: { label: "OFF SEASON", color: "var(--text-muted)", icon: Calendar },
};

function OpportunityCard({ opp, onGenerate }: { opp: SeasonalOpportunity; onGenerate: (niche: string) => void }) {
  const cfg = URGENCY_CONFIG[opp.urgency];
  return (
    <Card>
      <CardBody>
        <div className="flex items-start justify-between gap-3">
          <div style={{ flex: 1 }}>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <cfg.icon size={11} style={{ color: cfg.color }} />
              <span style={{ fontSize: "0.6rem", fontWeight: 700, color: cfg.color, textTransform: "uppercase", letterSpacing: "0.06em" }}>{cfg.label}</span>
            </div>
            <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>{opp.niche}</div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", lineHeight: 1.4 }}>{opp.rationale}</div>
            <div className="flex items-center gap-3 mt-2">
              <Badge variant={opp.currentRelevance >= 75 ? "emerald" : opp.currentRelevance >= 50 ? "amber" : "muted"}>{opp.currentRelevance}% relevant</Badge>
              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{opp.leadTimeWeeks}wk lead</span>
            </div>
          </div>
          <button
            onClick={() => onGenerate(opp.niche)}
            style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border-default)", background: "var(--bg-elevated)", color: "var(--text-secondary)", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}
          >
            Generate <ChevronDown size={11} style={{ transform: "rotate(-90deg)" }} />
          </button>
        </div>
      </CardBody>
    </Card>
  );
}

export default function IntelligencePage() {
  const [activeTab, setActiveTab] = useState<"scan" | "calendar">("scan");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<EmotionalIntelligenceReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [focusArea, setFocusArea] = useState("All Emotional Niches");
  const [count, setCount] = useState(8);
  const [performanceContext, setPerformanceContext] = useState<PerformanceInsight | null>(null);
  const [cacheTimestamp, setCacheTimestamp] = useState<number | null>(null);
  const [cacheSource, setCacheSource] = useState<"local" | "db" | null>(null);
  const { setLaunchContext } = useIntelligenceLaunch();
  const router = useRouter();

  const [calLoaded, setCalLoaded] = useState(false);
  const [calLoading, setCalLoading] = useState(false);
  const [calData, setCalData] = useState<SeasonalCalendar | null>(null);
  const [calError, setCalError] = useState<string | null>(null);
  const [expandedMonth, setExpandedMonth] = useState<number | null>(null);
  const [autobankedCount, setAutobankedCount] = useState<number | null>(null);
  const [slowWarning, setSlowWarning] = useState(false);

  useEffect(() => {
    apiFetch("/api/performance")
      .then((res) => res.json())
      .then((data) => { if (data.success && data.data?.hasData) setPerformanceContext(data.data); })
      .catch(() => {});
  }, []);

  // autoScan query param + keyboard shortcut event
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("autoScan") === "true") void runScan();
    function onQuickScan() { void runScan(); }
    window.addEventListener("ao:quickScan", onQuickScan);
    return () => window.removeEventListener("ao:quickScan", onQuickScan);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load scan from localStorage first, then DB fallback
  useEffect(() => {
    const cached = loadScanFromCache();
    if (cached) {
      setReport(cached.result);
      setCacheTimestamp(cached.timestamp);
      setCacheSource("local");
      return;
    }
    apiFetch("/api/intelligence?action=cache-get&scanType=full")
      .then((r) => (r.status === 204 ? null : r.json()))
      .then((data) => {
        if (data?.success && data.data) {
          const { result, createdAt } = data.data as { result: EmotionalIntelligenceReport; createdAt: string };
          setReport(result);
          const ts = new Date(createdAt).getTime();
          setCacheTimestamp(ts);
          setCacheSource("db");
          saveScanToCache(result);
        }
      })
      .catch(() => {});
  }, []);

  function handleLaunchProduct(trend: EmotionalTrend) {
    setLaunchContext({
      emotion: trend.emotion,
      nicheName: trend.painPoint,
      audienceArchetypes: trend.audienceArchetypes,
      opportunityScore: trend.monetizationScore,
      productOpportunities: trend.productOpportunities,
    });
    router.push("/products?from=intelligence");
  }

  function handleFreshScan() {
    clearScanCache();
    setCacheTimestamp(null);
    setCacheSource(null);
    setReport(null);
    void runScan();
  }

  function handleClearCache() {
    clearScanCache();
    setCacheTimestamp(null);
    setCacheSource(null);
    setReport(null);
  }

  useEffect(() => {
    if (activeTab === "calendar" && !calLoaded) {
      void loadCalendar();
    }
  }, [activeTab, calLoaded]);

  async function loadCalendar() {
    setCalLoading(true);
    setCalError(null);
    try {
      const res = await apiFetch("/api/intelligence?action=seasonal");
      const json = await res.json() as { success: boolean; data?: SeasonalCalendar; error?: string };
      if (!json.success || !json.data) throw new Error(json.error ?? "Failed to load calendar");
      setCalData(json.data);
      setCalLoaded(true);
    } catch (err) {
      setCalError(err instanceof Error ? err.message : "Failed to load calendar");
    } finally {
      setCalLoading(false);
    }
  }

  function handleGenerateFromCalendar(niche: string) {
    setFocusArea(niche);
    setActiveTab("scan");
    setTimeout(() => void runScanWithFocus(niche), 50);
  }

  async function runScanWithFocus(focus: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ focusArea: focus, count, performanceContext: performanceContext ?? undefined }),
      });
      const data = await res.json() as { success: boolean; data?: EmotionalIntelligenceReport; error?: string };
      if (!data.success) throw new Error(data.error ?? "Failed");
      if (data.data) {
        setReport(data.data);
        saveScanToCache(data.data);
        setCacheTimestamp(Date.now());
        setCacheSource("local");
        void apiFetch("/api/intelligence?action=cache-save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scanType: "full", result: data.data }) });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run scan");
    } finally {
      setLoading(false);
    }
  }

  async function runScan() {
    setLoading(true);
    setError(null);
    setSlowWarning(false);
    setAutobankedCount(null);
    const slowTimer = setTimeout(() => setSlowWarning(true), 25000);
    try {
      const res = await apiFetch("/api/intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          focusArea: focusArea === "All Emotional Niches" ? undefined : focusArea,
          count,
          performanceContext: performanceContext ?? undefined,
        }),
        timeoutMs: 120_000,
      });
      const data = await res.json() as { success: boolean; data?: EmotionalIntelligenceReport; error?: string };
      if (!data.success) throw new Error(data.error);
      if (data.data) {
        setReport(data.data);
        saveScanToCache(data.data);
        setCacheTimestamp(Date.now());
        setCacheSource("local");
        void apiFetch("/api/intelligence?action=cache-save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scanType: "full", result: data.data }) });
        // A3: auto-bank signals scoring 90+
        const highValue = data.data.trends.filter((t) => t.monetizationScore >= 90);
        if (highValue.length > 0) {
          let banked = 0;
          await Promise.allSettled(highValue.map(async (trend) => {
            const r = await apiFetch("/api/signals?action=bank", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(trend) });
            const d = await r.json() as { success: boolean; data?: { alreadySaved?: boolean } };
            if (d.success && !d.data?.alreadySaved) banked++;
          }));
          if (banked > 0) setAutobankedCount(banked);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run scan");
    } finally {
      setLoading(false);
      clearTimeout(slowTimer);
      setSlowWarning(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh" }}>
      <PageHeader
        icon={Brain}
        title="Emotional Intelligence Engine"
        iconColor="var(--violet)"
        subtitle="Discover high-value emotional pain points, aspirational niches, and behavioral patterns across the self-improvement landscape."
        actions={
          <Button
            variant="gold"
            icon={<Scan size={14} />}
            loading={loading}
            onClick={runScan}
          >
            {loading ? (slowWarning ? "Still working..." : "Scanning... (~20s)") : "Run Intelligence Scan"}
          </Button>
        }
      />

      <div style={{ padding: "24px 36px" }}>
        {/* Tab bar */}
        <div className="flex gap-2 mb-6">
          {([
            { id: "scan", label: "Intelligence Scan", icon: Brain },
            { id: "calendar", label: "Seasonal Calendar", icon: Calendar },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: "6px 16px",
                borderRadius: 20,
                fontSize: "0.8rem",
                fontWeight: activeTab === tab.id ? 600 : 400,
                background: activeTab === tab.id ? "var(--bg-elevated)" : "transparent",
                border: `1px solid ${activeTab === tab.id ? "var(--border-default)" : "transparent"}`,
                color: activeTab === tab.id ? "var(--text-primary)" : "var(--text-muted)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <tab.icon size={12} />
              {tab.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
        {activeTab === "scan" && (
        <motion.div key="scan" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>

        {/* Cache status bar */}
        {cacheTimestamp && (
          <div style={{
            marginBottom: 16,
            padding: "10px 16px",
            borderRadius: "var(--radius-md)",
            background: getStaleTier(cacheTimestamp) === "fresh" ? "var(--emerald-bg)" : getStaleTier(cacheTimestamp) === "stale" ? "var(--amber-bg)" : "var(--rose-bg)",
            border: `1px solid ${getStaleTier(cacheTimestamp) === "fresh" ? "var(--emerald-border)" : getStaleTier(cacheTimestamp) === "stale" ? "var(--amber-border)" : "var(--rose-border)"}`,
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: "var(--text-xs)",
          }}>
            <span style={{ color: getStaleTier(cacheTimestamp) === "fresh" ? "var(--emerald)" : getStaleTier(cacheTimestamp) === "stale" ? "var(--amber)" : "var(--rose)", fontWeight: 600 }}>
              {getStaleTier(cacheTimestamp) === "very-stale"
                ? "⚠ Scan data is over 3 days old — market conditions may have changed"
                : getStaleTier(cacheTimestamp) === "stale"
                ? `⚠ Scan from ${getScanAge({ timestamp: cacheTimestamp })} — consider refreshing`
                : `✓ Scan from ${getScanAge({ timestamp: cacheTimestamp })}`}
            </span>
            {cacheSource === "db" && <span style={{ color: "var(--text-muted)" }}>· restored from cloud</span>}
            <div style={{ marginLeft: "auto", display: "flex", gap: 12, alignItems: "center" }}>
              <button onClick={handleFreshScan} style={{ fontSize: "var(--text-xs)", color: getStaleTier(cacheTimestamp) === "fresh" ? "var(--emerald)" : getStaleTier(cacheTimestamp) === "stale" ? "var(--amber)" : "var(--rose)", fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}>
                Run Fresh Scan
              </button>
              <button onClick={handleClearCache} style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}>
                Clear Cache
              </button>
            </div>
          </div>
        )}

        {/* Controls */}
        <Card style={{ marginBottom: 24 }}>
          <CardBody>
            {performanceContext && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 12,
                  padding: "6px 10px",
                  borderRadius: 7,
                  background: "var(--emerald-dim)",
                  border: "1px solid rgba(16,185,129,0.2)",
                  width: "fit-content",
                }}
              >
                <BarChart2 size={12} style={{ color: "var(--emerald)" }} />
                <span style={{ fontSize: "0.7rem", color: "var(--emerald)", fontWeight: 600, letterSpacing: "0.04em" }}>
                  POWERED BY YOUR PORTFOLIO DATA
                </span>
              </div>
            )}
            <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 180px 180px" }}>
              <div>
                <div className="label mb-2">Focus Area</div>
                <select
                  value={focusArea}
                  onChange={(e) => setFocusArea(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 8,
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border-default)",
                    color: "var(--text-primary)",
                    fontSize: "0.875rem",
                  }}
                >
                  {FOCUS_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div className="label mb-2">Trends to Discover</div>
                <select
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 8,
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border-default)",
                    color: "var(--text-primary)",
                    fontSize: "0.875rem",
                  }}
                >
                  {[4, 6, 8, 10, 12].map((n) => (
                    <option key={n} value={n}>
                      {n} trends
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <Button variant="gold" onClick={runScan} loading={loading} fullWidth icon={<Scan size={13} />}>
                  {loading ? "Scanning..." : "Scan Now"}
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* A5: Slow-call warning */}
        {slowWarning && loading && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 16, padding: "10px 16px", borderRadius: 10, background: "var(--amber-bg)", border: "1px solid var(--amber-border)", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: "0.875rem", color: "var(--amber)" }}>⏳ This is taking longer than expected. Claude is thinking hard — hang tight.</span>
          </motion.div>
        )}

        {/* A3: Auto-bank toast */}
        {autobankedCount !== null && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 16, padding: "10px 16px", borderRadius: 10, background: "var(--emerald-bg)", border: "1px solid var(--emerald-border)", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: "0.875rem", color: "var(--emerald)" }}>✓ {autobankedCount} high-value signal{autobankedCount !== 1 ? "s" : ""} auto-banked (scored 90+)</span>
          </motion.div>
        )}

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              marginBottom: 20,
              padding: "12px 16px",
              borderRadius: 10,
              background: "var(--rose-dim)",
              border: "1px solid rgba(244,63,94,0.2)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <AlertCircle size={14} style={{ color: "var(--rose)", flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: "0.875rem", color: "var(--rose)", fontWeight: 600 }}>Scan Failed</div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: 2 }}>{error}</div>
            </div>
          </motion.div>
        )}

        {/* Empty State */}
        {!report && !loading && !error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center text-center"
            style={{ paddingTop: 80, paddingBottom: 80 }}
          >
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: 18,
                background: "var(--violet-dim)",
                border: "1px solid rgba(139,92,246,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 20,
              }}
            >
              <Brain size={32} style={{ color: "var(--violet)" }} />
            </div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 600, letterSpacing: "-0.02em", marginBottom: 8 }}>
              Run Your First Intelligence Scan
            </h2>
            <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", maxWidth: 480, lineHeight: 1.6, marginBottom: 24 }}>
              The AI engine will analyze the emotional landscape and surface high-value niches with monetization scores, audience archetypes, and product opportunities.
            </p>
            <Button variant="gold" onClick={runScan} loading={loading} icon={<Scan size={14} />} size="lg">
              Start Intelligence Scan
            </Button>
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 12 }}>
              Requires ANTHROPIC_API_KEY in .env
            </p>
          </motion.div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ height: 140, borderRadius: 12, overflow: "hidden" }}>
                <div className="shimmer" style={{ width: "100%", height: "100%" }} />
              </div>
            ))}
          </div>
        )}

        {/* Results */}
        {report && !loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* Insights Banner */}
            <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <Card gold>
                <CardBody>
                  <div className="flex items-start gap-3">
                    <Lightbulb size={16} style={{ color: "var(--gold)", flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <div className="label mb-1">Top Opportunity</div>
                      <div style={{ fontSize: "0.875rem", color: "var(--text-primary)", lineHeight: 1.5 }}>
                        {report.topOpportunity}
                      </div>
                    </div>
                  </div>
                </CardBody>
              </Card>
              <Card>
                <CardBody>
                  <div className="flex items-start gap-3">
                    <TrendingUp size={16} style={{ color: "var(--cyan)", flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <div className="label mb-1">Strategic Recommendation</div>
                      <div style={{ fontSize: "0.875rem", color: "var(--text-primary)", lineHeight: 1.5 }}>
                        {report.recommendedFocus}
                      </div>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </div>

            {/* Emerging Niches */}
            <div style={{ marginBottom: 20 }}>
              <div className="label mb-3">Emerging Niches</div>
              <div className="flex flex-wrap gap-2">
                {report.emergingNiches.map((niche, i) => (
                  <Badge key={i} variant="violet">{niche}</Badge>
                ))}
              </div>
            </div>

            {/* Market Insight */}
            <div
              style={{
                marginBottom: 24,
                padding: "12px 16px",
                borderRadius: 10,
                background: "var(--cyan-dim)",
                border: "1px solid rgba(6,182,212,0.15)",
                fontSize: "0.875rem",
                color: "var(--text-secondary)",
                lineHeight: 1.6,
              }}
            >
              <span style={{ color: "var(--cyan)", fontWeight: 600 }}>Market Insight: </span>
              {report.marketInsight}
            </div>

            {/* Trend Cards */}
            <div className="flex flex-col gap-4">
              {report.trends.map((trend, i) => (
                <TrendCard key={trend.id} trend={trend} index={i} onLaunchProduct={handleLaunchProduct} />
              ))}
            </div>
          </motion.div>
        )}

        </motion.div>
        )}

        {activeTab === "calendar" && (
        <motion.div key="calendar" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          {calLoading && (
            <div className="flex flex-col gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} style={{ height: 100, borderRadius: 10, overflow: "hidden" }}>
                  <div className="shimmer" style={{ width: "100%", height: "100%" }} />
                </div>
              ))}
            </div>
          )}

          {calError && (
            <div style={{ padding: 32, textAlign: "center", color: "var(--rose)" }}>
              <AlertCircle size={28} style={{ marginBottom: 12 }} />
              <div style={{ fontSize: "0.875rem" }}>{calError}</div>
              <div style={{ marginTop: 16 }}><Button variant="outline" size="sm" onClick={() => { setCalLoaded(false); }}>Retry</Button></div>
            </div>
          )}

          {calData && !calLoading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {/* Publish Now */}
              {calData.currentOpportunities.filter((o) => o.urgency === "publish_now").length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                    <Zap size={14} style={{ color: "var(--rose)" }} />
                    <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--rose)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Publish Now</div>
                  </div>
                  <div className="flex flex-col gap-3">
                    {calData.currentOpportunities
                      .filter((o) => o.urgency === "publish_now")
                      .map((opp, i) => <OpportunityCard key={i} opp={opp} onGenerate={handleGenerateFromCalendar} />)}
                  </div>
                </div>
              )}

              {/* Prepare This Month */}
              {(calData.upcomingOpportunities.length > 0 || calData.currentOpportunities.filter(o => o.urgency === "prepare_now").length > 0) && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                    <Clock size={14} style={{ color: "var(--amber)" }} />
                    <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--amber)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Prepare This Month</div>
                  </div>
                  <div className="flex flex-col gap-3">
                    {[
                      ...calData.currentOpportunities.filter(o => o.urgency === "prepare_now"),
                      ...calData.upcomingOpportunities,
                    ].map((opp, i) => <OpportunityCard key={i} opp={opp} onGenerate={handleGenerateFromCalendar} />)}
                  </div>
                </div>
              )}

              {/* 12-month strip */}
              <div>
                <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Year-Ahead Calendar</div>
                <div className="flex flex-col gap-2">
                  {calData.yearAheadCalendar.map((month, i) => (
                    <div key={i}>
                      <button
                        onClick={() => setExpandedMonth(expandedMonth === i ? null : i)}
                        style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 8, background: expandedMonth === i ? "var(--bg-elevated)" : "transparent", border: `1px solid ${expandedMonth === i ? "var(--border-default)" : "var(--border-subtle)"}`, cursor: "pointer", textAlign: "left" }}
                      >
                        <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-primary)", minWidth: 80 }}>{month.month}</span>
                        <div className="flex flex-wrap gap-1.5" style={{ flex: 1 }}>
                          {month.topNiches.map((niche, j) => (
                            <span key={j} style={{ fontSize: "0.7rem", color: "var(--text-secondary)", padding: "1px 8px", borderRadius: 10, background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>{niche}</span>
                          ))}
                        </div>
                        <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{month.prepareBy}</span>
                        {expandedMonth === i ? <ChevronUp size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} /> : <ChevronDown size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />}
                      </button>
                      <AnimatePresence>
                        {expandedMonth === i && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} style={{ overflow: "hidden" }}>
                            <div style={{ padding: "12px 14px", background: "var(--bg-elevated)", borderRadius: "0 0 8px 8px", borderTop: "none" }}>
                              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 8, fontWeight: 600 }}>{month.prepareBy} — Top Niches</div>
                              <div className="flex flex-wrap gap-2">
                                {month.topNiches.map((niche, j) => (
                                  <button
                                    key={j}
                                    onClick={() => handleGenerateFromCalendar(niche)}
                                    style={{ padding: "5px 12px", borderRadius: 20, fontSize: "0.75rem", fontWeight: 600, background: "var(--bg-card)", border: "1px solid var(--border-default)", color: "var(--gold)", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                                  >
                                    {niche} <ChevronDown size={10} style={{ transform: "rotate(-90deg)" }} />
                                  </button>
                                ))}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {!calData && !calLoading && !calError && (
            <div style={{ textAlign: "center", paddingTop: 80 }}>
              <div style={{ width: 72, height: 72, borderRadius: 18, background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
                <Calendar size={32} style={{ color: "var(--violet)" }} />
              </div>
              <div style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: 8 }}>Seasonal Publishing Calendar</div>
              <div style={{ fontSize: "0.875rem", color: "var(--text-muted)", maxWidth: 440, margin: "0 auto" }}>Loading your seasonal opportunities...</div>
            </div>
          )}
        </motion.div>
        )}

        </AnimatePresence>
      </div>
    </div>
  );
}
