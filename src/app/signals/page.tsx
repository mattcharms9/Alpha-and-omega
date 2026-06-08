"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, Zap, Filter, RefreshCw, BarChart2, AlertCircle,
  Flame, DollarSign, Map, List, Trash2, CheckCircle, Clock,
  TrendingDown, Star, Shield, ChevronDown, ChevronUp, Link2,
} from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";

interface BankedSignal {
  id: string;
  emotion: string;
  painPoint: string;
  description: string;
  intensity: number;
  monetizationScore: number;
  evergreenScore: number;
  audienceLoyalty: number;
  urgency: number;
  platforms: string[];
  audienceArchetypes: string[];
  productOpportunities: string[];
  searchVolumeTrend: string;
  competitionLevel: string;
  estimatedAnnualRevenue: string;
  tags: string[];
  freshnessScore: number;
  rarityScore: number;
  opportunityScore: number;
  territory: string;
  activatedAt: string | null;
  connectedBrandId: string | null;
  connectedBrand: { id: string; brandName: string } | null;
  createdAt: string;
}

interface Territory {
  name: string;
  signals: BankedSignal[];
  dominanceScore: number;
  status: "scouted" | "claimed" | "developed" | "operating";
  avgOpportunity: number;
  hasDecaying: boolean;
}

const SORT_OPTIONS = [
  { value: "opportunity", label: "Opportunity Score" },
  { value: "monetization", label: "Monetization Score" },
  { value: "freshness", label: "Freshness" },
  { value: "rarity", label: "Rarity Score" },
  { value: "urgency", label: "Market Urgency" },
];

function FreshnessBar({ value, activated }: { value: number; activated: boolean }) {
  const color = activated ? "#10b981" : value >= 70 ? "#10b981" : value >= 40 ? "#f59e0b" : "#ef4444";
  const label = activated ? "Activated" : value >= 70 ? "Fresh" : value >= 40 ? "Aging" : "Decaying";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${value}%`, background: color }} />
      </div>
      <span className="text-[10px] font-medium" style={{ color }}>{label}</span>
    </div>
  );
}

function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${value * 10}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
      <span className="text-[10px] text-white/40 w-5 text-right">{value.toFixed(1)}</span>
    </div>
  );
}

function SignalCard({
  signal,
  index,
  onDelete,
  brands,
}: {
  signal: BankedSignal;
  index: number;
  onDelete: (id: string) => void;
  brands: { id: string; brandName: string }[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activating, setActivating] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState("");

  const isActivated = !!signal.activatedAt;
  const isDecaying = !isActivated && signal.freshnessScore < 40;
  const isAging = !isActivated && signal.freshnessScore < 70 && signal.freshnessScore >= 40;

  const competitionVariant = signal.competitionLevel === "low" ? "emerald" : signal.competitionLevel === "medium" ? "amber" : "rose";
  const opportunityColor = signal.opportunityScore >= 80 ? "#c9a84c" : signal.opportunityScore >= 60 ? "#10b981" : "#8b5cf6";

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Delete this signal permanently?")) return;
    setDeleting(true);
    await apiFetch(`/api/signals?id=${signal.id}`, { method: "DELETE" });
    onDelete(signal.id);
  }

  async function handleActivate() {
    if (!selectedBrand) return;
    setActivating(true);
    await apiFetch("/api/signals?action=activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signalId: signal.id, brandId: selectedBrand }),
    });
    window.location.reload();
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className={cn(
        "glass rounded-xl border transition-all overflow-hidden",
        isDecaying ? "border-rose/20" : isAging ? "border-amber/10" : "border-white/5 hover:border-white/10"
      )}
    >
      <div className="p-5 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        {/* Header row */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {isDecaying && <TrendingDown className="w-3 h-3 text-rose animate-pulse" />}
              {isActivated && <CheckCircle className="w-3 h-3 text-emerald" />}
              <span className="text-xs text-white/40 uppercase tracking-wider">{signal.emotion}</span>
              <span className="text-white/20">·</span>
              <span className="text-xs text-white/30">{signal.searchVolumeTrend}</span>
              {signal.connectedBrand && (
                <>
                  <span className="text-white/20">·</span>
                  <span className="text-xs text-emerald/70 flex items-center gap-1">
                    <Link2 className="w-3 h-3" />{signal.connectedBrand.brandName}
                  </span>
                </>
              )}
            </div>
            <h3 className="text-sm font-semibold text-white leading-tight pr-2">{signal.painPoint}</h3>
          </div>
          <div className="flex flex-col items-end gap-1 ml-3 flex-shrink-0">
            <div className="text-lg font-bold" style={{ color: opportunityColor }}>
              {signal.opportunityScore.toFixed(0)}
            </div>
            <div className="text-[10px] text-white/30">opp.</div>
          </div>
        </div>

        {/* Scores */}
        <div className="grid grid-cols-4 gap-3 mb-3">
          <div>
            <div className="text-[10px] text-white/30 mb-1">Monetization</div>
            <ScoreBar value={signal.monetizationScore} color="#c9a84c" />
          </div>
          <div>
            <div className="text-[10px] text-white/30 mb-1">Intensity</div>
            <ScoreBar value={signal.intensity} color="#8b5cf6" />
          </div>
          <div>
            <div className="text-[10px] text-white/30 mb-1">Urgency</div>
            <ScoreBar value={signal.urgency} color="#ef4444" />
          </div>
          <div>
            <div className="text-[10px] text-white/30 mb-1">Evergreen</div>
            <ScoreBar value={signal.evergreenScore} color="#10b981" />
          </div>
        </div>

        {/* Freshness */}
        <div className="mb-3">
          <div className="text-[10px] text-white/30 mb-1">Signal Freshness</div>
          <FreshnessBar value={signal.freshnessScore} activated={isActivated} />
        </div>

        {/* Footer row */}
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5 flex-wrap">
            {signal.platforms.slice(0, 3).map((p) => (
              <span key={p} className="px-1.5 py-0.5 rounded text-[10px] bg-white/5 text-white/40">{p}</span>
            ))}
            {signal.platforms.length > 3 && (
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-white/5 text-white/30">+{signal.platforms.length - 3}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-[10px] text-white/30">
              <Star className="w-3 h-3" />
              {signal.rarityScore.toFixed(0)} rarity
            </div>
            <div className="flex items-center gap-1 text-[10px] text-white/30">
              <DollarSign className="w-3 h-3" />
              {signal.estimatedAnnualRevenue}
            </div>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="p-1 rounded hover:bg-rose/10 text-white/20 hover:text-rose transition-colors"
            >
              <Trash2 className="w-3 h-3" />
            </button>
            {expanded ? <ChevronUp className="w-3.5 h-3.5 text-white/30" /> : <ChevronDown className="w-3.5 h-3.5 text-white/30" />}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 border-t border-white/5 pt-4 space-y-4">
              <p className="text-sm text-white/70 leading-relaxed">{signal.description}</p>

              {signal.productOpportunities.length > 0 && (
                <div>
                  <div className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Product Opportunities</div>
                  <div className="space-y-1">
                    {signal.productOpportunities.map((o, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-white/60">
                        <Zap className="w-3 h-3 text-gold mt-0.5 flex-shrink-0" />
                        {o}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {signal.audienceArchetypes.length > 0 && (
                <div>
                  <div className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Audience Archetypes</div>
                  <div className="flex flex-wrap gap-1.5">
                    {signal.audienceArchetypes.map((a) => (
                      <Badge key={a} variant="violet">{a}</Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={competitionVariant}>{signal.competitionLevel} competition</Badge>
                <Badge variant="default">{signal.audienceLoyalty.toFixed(1)} loyalty</Badge>
                {isDecaying && <Badge variant="rose">Decaying — activate now</Badge>}
                {isActivated && <Badge variant="emerald">Activated</Badge>}
              </div>

              {/* Activate CTA */}
              {!isActivated && brands.length > 0 && (
                <div className="flex items-center gap-2 pt-1">
                  <select
                    value={selectedBrand}
                    onChange={(e) => setSelectedBrand(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white focus:outline-none"
                  >
                    <option value="" className="bg-gray-900">Select brand to activate...</option>
                    {brands.map((b) => (
                      <option key={b.id} value={b.id} className="bg-gray-900">{b.brandName}</option>
                    ))}
                  </select>
                  <Button onClick={handleActivate} disabled={!selectedBrand || activating} variant="emerald">
                    {activating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5 mr-1" />}
                    Activate
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function TerritoryCard({ territory, index }: { territory: Territory; index: number }) {
  const [open, setOpen] = useState(false);

  const statusColor = {
    scouted: "var(--text-secondary)",
    claimed: "var(--gold)",
    developed: "var(--violet)",
    operating: "var(--emerald)",
  }[territory.status];

  const statusVariant: "default" | "gold" | "violet" | "emerald" = {
    scouted: "default",
    claimed: "gold",
    developed: "violet",
    operating: "emerald",
  }[territory.status] as "default" | "gold" | "violet" | "emerald";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="glass rounded-xl border border-white/5 overflow-hidden"
    >
      <div className="p-5 cursor-pointer" onClick={() => setOpen(!open)}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${statusColor}15`, border: `1px solid ${statusColor}30` }}>
              <Map className="w-4 h-4" style={{ color: statusColor }} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white capitalize">{territory.name}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant={statusVariant}>{territory.status}</Badge>
                {territory.hasDecaying && <Badge variant="rose">decaying signals</Badge>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-lg font-bold" style={{ color: statusColor }}>
                {territory.dominanceScore.toFixed(0)}
              </div>
              <div className="text-[10px] text-white/30">dominance</div>
            </div>
            {open ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-[10px] text-white/30 mb-1">Signals</div>
            <div className="text-base font-semibold text-white">{territory.signals.length}</div>
          </div>
          <div>
            <div className="text-[10px] text-white/30 mb-1">Avg Opportunity</div>
            <div className="text-base font-semibold" style={{ color: "var(--gold)" }}>{territory.avgOpportunity.toFixed(0)}</div>
          </div>
          <div>
            <div className="text-[10px] text-white/30 mb-1">Activated</div>
            <div className="text-base font-semibold" style={{ color: "var(--emerald)" }}>
              {territory.signals.filter((s) => s.activatedAt).length}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4 border-t border-white/5 pt-4 space-y-2">
              {territory.signals.map((s) => (
                <div key={s.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white/80 truncate">{s.painPoint}</div>
                    <div className="text-[10px] text-white/30 mt-0.5">
                      {s.activatedAt ? `Activated · ${s.connectedBrand?.brandName ?? ""}` : `Freshness: ${s.freshnessScore.toFixed(0)}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    <span className="text-xs font-semibold text-gold">{s.opportunityScore.toFixed(0)}</span>
                    {s.activatedAt ? (
                      <CheckCircle className="w-3.5 h-3.5 text-emerald" />
                    ) : s.freshnessScore < 40 ? (
                      <TrendingDown className="w-3.5 h-3.5 text-rose animate-pulse" />
                    ) : (
                      <Clock className="w-3.5 h-3.5 text-white/30" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function EmptyState({ onGenerate }: { onGenerate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-6">
      <div className="relative">
        <div className="w-20 h-20 rounded-2xl bg-gold/10 flex items-center justify-center">
          <Activity className="w-10 h-10 text-gold" />
        </div>
        <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose flex items-center justify-center">
          <span className="text-[9px] font-bold text-white">!</span>
        </div>
      </div>
      <div className="text-center">
        <h3 className="text-lg font-semibold text-white mb-2">Signal Bank is Empty</h3>
        <p className="text-sm text-white/40 max-w-sm">
          Scan the emotional market to populate your signal bank. Every scan adds proprietary intelligence to your data moat.
        </p>
      </div>
      <Button onClick={onGenerate} variant="gold">
        <Activity className="w-4 h-4 mr-2" />
        Run Market Scan
      </Button>
    </div>
  );
}

export default function SignalsPage() {
  const [signals, setSignals] = useState<BankedSignal[]>([]);
  const [brands, setBrands] = useState<{ id: string; brandName: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<"list" | "territory">("list");
  const [sortBy, setSortBy] = useState("opportunity");
  const [focusArea, setFocusArea] = useState("");
  const [scanCount, setScanCount] = useState(8);
  const [filterActivated, setFilterActivated] = useState<"all" | "active" | "decaying">("all");

  const loadSignals = useCallback(async () => {
    try {
      const [sigRes, brandRes] = await Promise.all([
        apiFetch("/api/signals"),
        apiFetch("/api/brands"),
      ]);
      const sigJson = await sigRes.json();
      const brandJson = await brandRes.json();
      if (sigJson.success) setSignals(sigJson.data);
      if (brandJson.success) setBrands(brandJson.data.map((b: { id: string; brandName: string }) => ({ id: b.id, brandName: b.brandName })));
    } catch {
      // silent — DB may be empty
    } finally {
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => { loadSignals(); }, [loadSignals]);

  async function runScan() {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch("/api/signals?action=scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ focusArea: focusArea || undefined, count: scanCount }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Scan failed");
      await loadSignals();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setLoading(false);
    }
  }

  function handleDelete(id: string) {
    setSignals((prev) => prev.filter((s) => s.id !== id));
  }

  const filtered = signals
    .filter((s) => {
      if (filterActivated === "active") return !!s.activatedAt;
      if (filterActivated === "decaying") return !s.activatedAt && s.freshnessScore < 40;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "opportunity") return b.opportunityScore - a.opportunityScore;
      if (sortBy === "monetization") return b.monetizationScore - a.monetizationScore;
      if (sortBy === "freshness") return b.freshnessScore - a.freshnessScore;
      if (sortBy === "rarity") return b.rarityScore - a.rarityScore;
      if (sortBy === "urgency") return b.urgency - a.urgency;
      return 0;
    });

  // Build territory map
  const territoryMap: Record<string, BankedSignal[]> = {};
  for (const s of signals) {
    const t = s.territory || s.emotion;
    if (!territoryMap[t]) territoryMap[t] = [];
    territoryMap[t].push(s);
  }
  const territories: Territory[] = Object.entries(territoryMap).map(([name, sigs]) => {
    const avgOpp = sigs.reduce((sum, s) => sum + s.opportunityScore, 0) / sigs.length;
    const avgMon = sigs.reduce((sum, s) => sum + s.monetizationScore, 0) / sigs.length;
    const dominanceScore = Math.min(100, sigs.length * 20 + avgMon * 5);
    const hasActivated = sigs.some((s) => s.activatedAt);
    const hasDecaying = sigs.some((s) => !s.activatedAt && s.freshnessScore < 40);
    const status: Territory["status"] = hasActivated && sigs.length >= 3 ? "operating" : hasActivated ? "claimed" : "scouted";
    return { name, signals: sigs, dominanceScore, status, avgOpportunity: avgOpp, hasDecaying };
  }).sort((a, b) => b.dominanceScore - a.dominanceScore);

  const activatedCount = signals.filter((s) => s.activatedAt).length;
  const decayingCount = signals.filter((s) => !s.activatedAt && s.freshnessScore < 40).length;
  const avgOpportunity = signals.length > 0 ? signals.reduce((sum, s) => sum + s.opportunityScore, 0) / signals.length : 0;

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-2 border-gold/20" />
          <div className="absolute inset-0 rounded-full border-t-2 border-gold animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Activity className="w-6 h-6 text-gold" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "0 0 48px" }}>
      {/* Header */}
      <div style={{ padding: "32px 36px 24px", borderBottom: "1px solid var(--border-subtle)" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Activity size={20} style={{ color: "var(--cyan)" }} />
            </div>
            <div>
              <h1 style={{ fontSize: "1.375rem", fontWeight: 700, letterSpacing: "-0.025em", color: "var(--text-primary)", lineHeight: 1.2 }}>Signal Bank</h1>
              <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginTop: 3 }}>Proprietary emotional market intelligence — your data moat</p>
            </div>
          </div>
          {signals.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 20, background: "rgba(6,182,212,0.06)", border: "1px solid rgba(6,182,212,0.15)" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--cyan)", display: "block" }} />
              <span style={{ fontSize: "0.72rem", color: "var(--cyan)", fontWeight: 600 }}>{signals.length} signals banked</span>
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: "28px 36px" }} className="space-y-6">
        {/* Stats Bar */}
        {signals.length > 0 && (
          <div className="grid grid-cols-5 gap-3">
            {[
              { label: "Total Signals", value: signals.length.toString(), icon: Activity, color: "var(--gold)" },
              { label: "Territories", value: Object.keys(territoryMap).length.toString(), icon: Map, color: "var(--cyan)" },
              { label: "Activated", value: activatedCount.toString(), icon: CheckCircle, color: "var(--emerald)" },
              { label: "Decaying", value: decayingCount.toString(), icon: TrendingDown, color: decayingCount > 0 ? "var(--rose)" : "var(--text-secondary)" },
              { label: "Avg Opportunity", value: avgOpportunity.toFixed(0), icon: Star, color: "var(--violet)" },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="glass rounded-xl p-4 border border-white/5">
                <div className="flex items-center gap-2 mb-2">
                  <Icon size={13} style={{ color }} />
                  <span className="text-[10px] text-white/40">{label}</span>
                </div>
                <div className="text-xl font-bold" style={{ color }}>{value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Scan Controls */}
        <Card>
          <CardBody>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <label className="text-xs text-white/40 block mb-1">Focus Area (optional)</label>
                <input
                  type="text"
                  placeholder="e.g. grief, productivity, self-worth..."
                  value={focusArea}
                  onChange={(e) => setFocusArea(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runScan()}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-white/30 focus:outline-none focus:border-gold/30"
                />
              </div>
              <div>
                <label className="text-xs text-white/40 block mb-1">Signals per Scan</label>
                <select
                  value={scanCount}
                  onChange={(e) => setScanCount(Number(e.target.value))}
                  className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none"
                >
                  {[4, 6, 8, 10, 12].map((n) => (
                    <option key={n} value={n} className="bg-gray-900">{n} signals</option>
                  ))}
                </select>
              </div>
              <div className="flex-shrink-0 pt-5">
                <Button onClick={runScan} disabled={loading} variant="gold">
                  {loading ? (
                    <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Scanning...</>
                  ) : (
                    <><Activity className="w-4 h-4 mr-2" />{signals.length > 0 ? "Re-scan Market" : "Scan Market"}</>
                  )}
                </Button>
              </div>
              {error && (
                <div className="flex items-center gap-2 text-rose text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}
            </div>
          </CardBody>
        </Card>

        {/* Empty State */}
        {signals.length === 0 && !loading ? (
          <EmptyState onGenerate={runScan} />
        ) : loading && signals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 rounded-full border-2 border-gold/20" />
              <div className="absolute inset-0 rounded-full border-t-2 border-gold animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Activity className="w-6 h-6 text-gold" />
              </div>
            </div>
            <p className="text-sm text-white/40">Scanning emotional markets...</p>
          </div>
        ) : signals.length > 0 ? (
          <>
            {/* View Controls */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              {/* View Toggle */}
              <div className="flex rounded-lg border border-white/10 overflow-hidden">
                <button
                  onClick={() => setView("list")}
                  className={cn("flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-all", view === "list" ? "bg-white/10 text-white" : "text-white/40 hover:text-white")}
                >
                  <List className="w-3.5 h-3.5" />List
                </button>
                <button
                  onClick={() => setView("territory")}
                  className={cn("flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-all border-l border-white/10", view === "territory" ? "bg-white/10 text-white" : "text-white/40 hover:text-white")}
                >
                  <Map className="w-3.5 h-3.5" />Territory
                </button>
              </div>

              {/* Filters */}
              {view === "list" && (
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5">
                    {(["all", "active", "decaying"] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setFilterActivated(f)}
                        className={cn(
                          "px-3 py-1 rounded-full text-xs font-medium transition-all capitalize",
                          filterActivated === f ? "bg-gold/20 text-gold border border-gold/30" : "text-white/40 hover:text-white border border-white/10"
                        )}
                      >
                        {f === "all" ? `All (${signals.length})` : f === "active" ? `Activated (${activatedCount})` : `Decaying (${decayingCount})`}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    <Filter className="w-3.5 h-3.5 text-white/30" />
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-white focus:outline-none"
                    >
                      {SORT_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value} className="bg-gray-900">{o.label}</option>
                      ))}
                    </select>
                    <span className="text-xs text-white/30">{filtered.length} shown</span>
                  </div>
                </div>
              )}

              {/* Decay Alert */}
              {decayingCount > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose/10 border border-rose/20">
                  <TrendingDown className="w-3.5 h-3.5 text-rose animate-pulse" />
                  <span className="text-xs text-rose font-medium">{decayingCount} signal{decayingCount > 1 ? "s" : ""} decaying — activate before expiry</span>
                </div>
              )}
            </div>

            {/* List View */}
            {view === "list" && (
              <div className="grid grid-cols-2 gap-4">
                {filtered.map((signal, i) => (
                  <SignalCard key={signal.id} signal={signal} index={i} onDelete={handleDelete} brands={brands} />
                ))}
              </div>
            )}

            {/* Territory View */}
            {view === "territory" && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-4 h-4 text-gold" />
                  <span className="text-sm font-semibold text-white">{territories.length} Territories Mapped</span>
                  <span className="text-xs text-white/40">· Dominance score = depth of ownership</span>
                </div>
                {territories.map((t, i) => (
                  <TerritoryCard key={t.name} territory={t} index={i} />
                ))}
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
