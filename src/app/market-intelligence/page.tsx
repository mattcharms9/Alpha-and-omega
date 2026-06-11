"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, BarChart2, ChevronDown, ChevronUp, RefreshCw, Search, Tag, DollarSign, Zap, AlertCircle } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { MarketReport, MarketSnapshot, TopSellerListing, ProductOpportunity, VisualIntelligence, WinningPriceRange } from "@/lib/market-intelligence/types";

interface NicheCardProps {
  report: MarketReport;
  saved?: boolean;
  onSave?: (report: MarketReport) => void;
}

function tierColor(score: number): string {
  if (score >= 90) return "var(--gold)";
  if (score >= 75) return "var(--emerald)";
  if (score >= 60) return "var(--blue)";
  return "var(--text-muted)";
}

function tierLabel(score: number): string {
  if (score >= 90) return "GOLD";
  if (score >= 75) return "GREEN";
  if (score >= 60) return "BLUE";
  return "WEAK";
}

function TierBadge({ score }: { score: number }) {
  const c = tierColor(score);
  return (
    <span style={{ color: c, fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", border: `1px solid ${c}40`, borderRadius: 4, padding: "1px 6px", background: `${c}12` }}>
      {tierLabel(score)}
    </span>
  );
}

function CompetitionBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    low: "var(--emerald)",
    medium: "var(--gold)",
    high: "var(--amber)",
    saturated: "var(--rose)",
  };
  const c = colors[level] ?? "var(--text-muted)";
  return (
    <span style={{ color: c, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, border: `1px solid ${c}30`, borderRadius: 6, padding: "2px 8px", background: `${c}10` }}>
      {level}
    </span>
  );
}

function ScoreBar({ score }: { score: number }) {
  const color = tierColor(score);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: "var(--border-subtle)", borderRadius: 3, overflow: "hidden" }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          style={{ height: "100%", background: color, borderRadius: 3 }}
        />
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, color, minWidth: 28 }}>{score}</span>
    </div>
  );
}

function NicheCard({ report, saved = false, onSave }: NicheCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const priceRange = report.winningPriceRange as WinningPriceRange | null;
  const titleStructures = (report.winningTitleStructures as string[]) ?? [];
  const tags = (report.winningTags as string[]) ?? [];
  const opportunities = (report.productOpportunities as ProductOpportunity[]) ?? [];
  const avoid = (report.avoidPatterns as string[]) ?? [];
  const topSellers = (report.topSellers as TopSellerListing[]) ?? [];
  const visual = report.visualStyle as VisualIntelligence | null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 12, overflow: "hidden" }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        style={{ width: "100%", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
            <span style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: 15 }}>{report.niche}</span>
            <TierBadge score={report.opportunityScore} />
            <CompetitionBadge level={report.competitionLevel} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, maxWidth: 400 }}>
            <div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 2 }}>OPPORTUNITY</div>
              <ScoreBar score={report.opportunityScore} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 2 }}>SWEET PRICE</div>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--emerald)" }}>${priceRange?.sweet ?? "—"}</span>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 2 }}>LISTINGS</div>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>{report.totalListings.toLocaleString()}</span>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: 12 }}>
          {onSave && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (saved || saving) return;
                setSaving(true);
                onSave(report);
              }}
              title={saved ? "Saved to Signal Bank" : "Save to Signal Bank"}
              style={{ background: saved ? "var(--emerald)20" : "var(--bg-elevated)", border: `1px solid ${saved ? "var(--emerald)" : "var(--border-subtle)"}`, color: saved ? "var(--emerald)" : "var(--text-muted)", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: saved || saving ? "default" : "pointer", whiteSpace: "nowrap" }}
            >
              {saved ? "✓ Saved" : saving ? "Saving..." : "+ Save"}
            </button>
          )}
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ padding: "0 20px 20px", borderTop: "1px solid var(--border-subtle)", paddingTop: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                {/* Title Structures */}
                {titleStructures.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.8 }}>Proven Title Structures</div>
                    {titleStructures.slice(0, 3).map((s, i) => (
                      <div key={i} style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4, padding: "4px 8px", background: "var(--bg-elevated)", borderRadius: 6, fontFamily: "monospace" }}>{s}</div>
                    ))}
                  </div>
                )}

                {/* Product Opportunities */}
                {opportunities.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.8 }}>Opportunities</div>
                    {opportunities.slice(0, 3).map((o, i) => (
                      <div key={i} style={{ marginBottom: 8, padding: "8px 10px", background: "var(--bg-elevated)", borderRadius: 8, borderLeft: "3px solid var(--emerald)" }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>{o.title}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{o.reasoning}</div>
                        <div style={{ fontSize: 11, color: "var(--gold)", marginTop: 4 }}>Suggested price: ${o.suggestedPrice} · {o.estimatedCompetition} competition</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Winning Tags */}
                {tags.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.8 }}>Winning Tags</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {tags.slice(0, 13).map((t, i) => (
                        <span key={i} style={{ fontSize: 11, padding: "3px 8px", background: "var(--bg-void)", border: "1px solid var(--border-subtle)", borderRadius: 6, color: "var(--text-secondary)" }}>{t}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Visual Style */}
                {visual && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.8 }}>Visual Style</div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>
                      <strong>Style:</strong> {visual.dominantStyle} · <strong>Font:</strong> {visual.fontStyle}
                    </div>
                    <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                      {visual.dominantColors.slice(0, 5).map((c, i) => (
                        <div key={i} title={c} style={{ width: 24, height: 24, borderRadius: 6, background: c, border: "1px solid var(--border-subtle)" }} />
                      ))}
                    </div>
                    {visual.commonElements.length > 0 && (
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Common: {visual.commonElements.slice(0, 3).join(", ")}</div>
                    )}
                  </div>
                )}

                {/* Top Sellers */}
                {topSellers.length > 0 && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.8 }}>Top Sellers</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {topSellers.slice(0, 5).map((s, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 10px", background: "var(--bg-elevated)", borderRadius: 6 }}>
                          <span style={{ fontSize: 11, color: "var(--text-muted)", minWidth: 16 }}>#{i + 1}</span>
                          <span style={{ fontSize: 12, color: "var(--text-primary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--emerald)", minWidth: 32 }}>${s.price}</span>
                          <span style={{ fontSize: 11, color: "var(--text-muted)", minWidth: 50 }}>⭐ {s.reviewCount}</span>
                          <span style={{ fontSize: 11, color: "var(--text-muted)", minWidth: 50 }}>♥ {s.favoritesCount}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Avoid */}
                {avoid.length > 0 && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--rose)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.8 }}>Avoid</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {avoid.map((a, i) => (
                        <span key={i} style={{ fontSize: 11, padding: "3px 8px", background: "var(--rose-bg)", border: "1px solid var(--rose-border)", borderRadius: 6, color: "var(--rose)" }}>{a}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

type SortKey = "opportunityScore" | "competitionLevel" | "createdAt";

export default function MarketIntelligencePage() {
  const [snapshot, setSnapshot] = useState<MarketSnapshot | null>(null);
  const [reports, setReports] = useState<MarketReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>("opportunityScore");
  const [filterCompetition, setFilterCompetition] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [scanProgress, setScanProgress] = useState<{ completed: number; total: number } | null>(null);
  const [savedNiches, setSavedNiches] = useState<Set<string>>(new Set());
  const scanAbortRef = useRef<boolean>(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/market-intelligence?action=latest");
      const json = await res.json();
      if (json.success) {
        setSnapshot(json.data.snapshot);
        setReports(json.data.reports ?? []);
      } else {
        setError(json.error ?? "Failed to load market data");
      }
    } catch {
      setError("Failed to load market intelligence data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  // Load existing saved signals on mount
  useEffect(() => {
    apiFetch("/api/scan-market?action=saved-signals")
      .then((r) => r.json() as Promise<{ success: boolean; data?: Array<{ niche: string; reportDate: string }> }>)
      .then((d) => {
        if (d.success && d.data) {
          setSavedNiches(new Set(d.data.map((s) => `${s.niche}__${s.reportDate}`)));
        }
      })
      .catch(() => {});
  }, []);

  const handleRunScan = async () => {
    setScanning(true);
    setScanProgress(null);
    setScanMessage("Starting scan...");
    scanAbortRef.current = false;

    try {
      let nextStart = 0;
      const TOTAL = 25;

      while (!scanAbortRef.current) {
        setScanProgress({ completed: nextStart, total: TOTAL });
        setScanMessage(`Scanning ${nextStart}/${TOTAL} niches...`);

        const res = await apiFetch("/api/market-intelligence?action=run-full-scan", {
          method: "POST",
          body: JSON.stringify({ startFrom: nextStart }),
          timeoutMs: 150_000,
        });
        const json = await res.json() as { success: boolean; data?: { completed: number; total: number; nextStart: number; isComplete: boolean }; error?: string };

        if (!json.success) {
          setScanMessage(`✗ Chunk failed at niche ${nextStart}: ${json.error}`);
          setScanning(false);
          return;
        }

        const { completed, total, nextStart: ns, isComplete } = json.data!;
        setScanProgress({ completed, total });
        setScanMessage(`Scanning ${completed}/${total} niches...`);

        if (isComplete) {
          setScanning(false);
          setScanProgress(null);
          setScanMessage(`✓ Scan complete — ${total} niches analyzed`);
          void loadData();
          return;
        }

        nextStart = ns;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setScanMessage(`✗ Scan failed — ${msg}`);
      setScanning(false);
    }
  };

  const handleSaveSignal = async (report: MarketReport) => {
    try {
      const res = await apiFetch("/api/scan-market?action=save-signal", {
        method: "POST",
        body: JSON.stringify({
          niche: report.niche,
          reportDate: report.reportDate,
          opportunityScore: report.opportunityScore,
          competitionLevel: report.competitionLevel,
          totalListings: report.totalListings,
          sweetSpotPrice: (report.winningPriceRange as { sweet?: number } | null)?.sweet ?? null,
          topOpportunity: (report.productOpportunities as Array<{ title?: string; description?: string }> | null)?.[0]?.title ?? report.niche,
        }),
      });
      const json = await res.json() as { success: boolean };
      if (json.success) {
        setSavedNiches((prev) => new Set([...prev, `${report.niche}__${report.reportDate}`]));
      }
    } catch {
      // silently ignore — user can retry
    }
  };

  // Abort scan on unmount
  useEffect(() => () => { scanAbortRef.current = true; }, []);

  const sorted = [...reports]
    .filter((r) => {
      if (filterCompetition !== "all" && r.competitionLevel !== filterCompetition) return false;
      if (searchQuery && !r.niche.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "opportunityScore") return b.opportunityScore - a.opportunityScore;
      if (sortBy === "competitionLevel") {
        const order = { low: 0, medium: 1, high: 2, saturated: 3 };
        return (order[a.competitionLevel as keyof typeof order] ?? 2) - (order[b.competitionLevel as keyof typeof order] ?? 2);
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const topOpps = ((snapshot?.topOpportunities as Array<{ niche: string; opportunityScore: number; competitionLevel: string }>) ?? []).slice(0, 3);

  return (
    <div style={{ padding: "32px 40px", maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--gold)18", border: "1px solid var(--gold)30", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <BarChart2 size={18} style={{ color: "var(--gold)" }} />
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Market Intelligence</h1>
          </div>
          <p style={{ marginTop: 6, marginBottom: 0, color: "var(--text-muted)", fontSize: 14 }}>
            Real Etsy market data — updated nightly at 1am UTC
          </p>
        </div>
        <button
          onClick={handleRunScan}
          disabled={scanning}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", background: "var(--gold)", color: "#000", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: scanning ? "not-allowed" : "pointer", opacity: scanning ? 0.7 : 1 }}
        >
          <RefreshCw size={15} style={{ animation: scanning ? "spin 1s linear infinite" : "none" }} />
          {scanning ? "Scanning..." : "Run Full Scan"}
        </button>
      </div>

      {scanMessage && (
        <div style={{ marginBottom: 20, padding: "12px 16px", background: scanMessage.startsWith("✓") ? "var(--emerald)15" : scanMessage.startsWith("✗") ? "#ef444415" : "var(--gold)15", border: `1px solid ${scanMessage.startsWith("✓") ? "var(--emerald)" : scanMessage.startsWith("✗") ? "#ef4444" : "var(--gold)"}30`, borderRadius: 8, fontSize: 13, color: "var(--text-secondary)" }}>
          {scanMessage}
          {scanProgress && (
            <div style={{ marginTop: 8 }}>
              <div style={{ height: 4, background: "var(--bg-void)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ height: "100%", background: "var(--gold)", borderRadius: 2, width: `${Math.round((scanProgress.completed / scanProgress.total) * 100)}%`, transition: "width 0.4s ease" }} />
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{scanProgress.completed} of {scanProgress.total} niches complete</div>
            </div>
          )}
        </div>
      )}

      {/* Market Snapshot */}
      {snapshot && (
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 12, padding: "20px 24px", marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <TrendingUp size={16} style={{ color: "var(--gold)" }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Market Snapshot — {snapshot.snapshotDate}</span>
            <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: "auto" }}>{snapshot.nichesAnalyzed} niches · {snapshot.totalListingsPulled.toLocaleString()} listings</span>
          </div>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: "0 0 16px" }}>{snapshot.marketSummary}</p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {topOpps.map((o, i) => (
              <div key={i} style={{ padding: "8px 14px", background: "var(--bg-elevated)", borderRadius: 8, border: "1px solid var(--border-subtle)" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{o.niche}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Score {o.opportunityScore} · {o.competitionLevel}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 8, flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ color: "var(--text-muted)" }} />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search niches..."
            style={{ background: "none", border: "none", outline: "none", fontSize: 13, color: "var(--text-primary)", width: "100%" }}
          />
        </div>
        <select
          value={filterCompetition}
          onChange={(e) => setFilterCompetition(e.target.value)}
          style={{ padding: "8px 12px", background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 8, fontSize: 13, color: "var(--text-secondary)", cursor: "pointer" }}
        >
          <option value="all">All competition</option>
          <option value="low">Low only</option>
          <option value="medium">Medium only</option>
          <option value="high">High only</option>
          <option value="saturated">Saturated</option>
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortKey)}
          style={{ padding: "8px 12px", background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 8, fontSize: 13, color: "var(--text-secondary)", cursor: "pointer" }}
        >
          <option value="opportunityScore">Sort: Opportunity score</option>
          <option value="competitionLevel">Sort: Competition level</option>
          <option value="createdAt">Sort: Last updated</option>
        </select>
        <span style={{ fontSize: 13, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{sorted.length} niches</span>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} style={{ height: 80, background: "var(--bg-surface)", borderRadius: 12, border: "1px solid var(--border-subtle)", animation: "pulse 1.5s ease-in-out infinite" }} />
          ))}
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div style={{ padding: "20px", background: "var(--rose-bg)", border: "1px solid var(--rose-border)", borderRadius: 12, display: "flex", alignItems: "center", gap: 12 }}>
          <AlertCircle size={18} style={{ color: "var(--rose)" }} />
          <div>
            <div style={{ fontWeight: 600, color: "var(--rose)", marginBottom: 4 }}>{error}</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Run a full scan to populate market data, or wait for the 1am UTC nightly cron.</div>
          </div>
        </div>
      )}

      {/* No data — prompt to scan */}
      {!loading && !error && sorted.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <BarChart2 size={40} style={{ color: "var(--text-muted)", marginBottom: 16 }} />
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>No market data yet</div>
          <div style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 24, maxWidth: 400, margin: "0 auto 24px" }}>
            Run a full scan now to analyze all 25 tracked niches. The nightly cron at 1am UTC will keep this fresh automatically.
          </div>
          <button
            onClick={handleRunScan}
            disabled={scanning}
            style={{ padding: "12px 24px", background: "var(--gold)", color: "#000", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: scanning ? "not-allowed" : "pointer" }}
          >
            {scanning ? "Scanning..." : "Run Full Scan Now"}
          </button>
        </div>
      )}

      {/* Niche grid */}
      {!loading && sorted.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {sorted.map((report, i) => (
            <motion.div key={report.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <NicheCard
                report={report}
                saved={savedNiches.has(`${report.niche}__${report.reportDate}`)}
                onSave={handleSaveSignal}
              />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
