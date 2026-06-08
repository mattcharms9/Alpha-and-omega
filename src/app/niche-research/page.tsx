"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Crosshair,
  ChevronRight,
  Star,
  Zap,
  X,
  Search,
  BookOpen,
  TrendingUp,
  Calendar,
  Users,
  Tag,
  Layers,
  AlertCircle,
  Loader2,
  Trophy,
  Flame,
  ChevronDown,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { apiFetch } from "@/lib/api";
import { useActiveNiche } from "@/lib/stores/active-niche";
import type { SubNiche, NicheExpansionReport, ProductRecommendation } from "@/lib/ai/niche-types";

const API_KEY = process.env.NEXT_PUBLIC_API_KEY ?? "";

// Niche saved to DB
interface SavedNicheRecord {
  id: string;
  parentEmotion: string;
  nicheName: string;
  opportunityScore: number;
  competitionLevel: string;
  status: string;
  isFavorited: boolean;
  productsGenerated: number;
  totalRevenue: number;
  lastUsedAt: string | null;
  notes: string;
  createdAt: string;
}

const SCORE_COLOR = (s: number) =>
  s >= 80 ? "var(--gold)" : s >= 60 ? "var(--emerald)" : "var(--text-muted)";

const COMP_COLOR: Record<string, string> = {
  low: "var(--emerald)",
  medium: "var(--amber)",
  high: "var(--rose)",
};

const URGENCY_LABEL: Record<string, string> = {
  publish_now: "Publish Now",
  prepare_soon: "Prepare Soon",
  plan_ahead: "Plan Ahead",
  off_season: "Off Season",
};

function ScoreRing({ score, size = 40 }: { score: number; size?: number }) {
  const color = SCORE_COLOR(score);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        border: `2px solid ${color}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <span style={{ fontSize: size * 0.28, fontWeight: 700, color }}>{score}</span>
    </div>
  );
}

function NicheCard({
  niche,
  savedId,
  onView,
  onSave,
  onGenerate,
  isSaving,
}: {
  niche: SubNiche;
  savedId?: string;
  onView: () => void;
  onSave: () => void;
  onGenerate: () => void;
  isSaving?: boolean;
}) {
  const isPublishNow = niche.urgency === "publish_now";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        padding: "14px 16px",
        borderRadius: 12,
        background: "var(--bg-card)",
        border: `1px solid ${isPublishNow ? "rgba(201,168,76,0.25)" : "var(--border-subtle)"}`,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div className="flex items-start gap-3">
        <ScoreRing score={Math.round(niche.opportunityScore)} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            onClick={onView}
            style={{
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "var(--text-primary)",
              cursor: "pointer",
              lineHeight: 1.3,
              marginBottom: 3,
            }}
          >
            {niche.nicheName}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", lineHeight: 1.4 }}>
            {niche.oneLiner}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span
          style={{
            fontSize: "0.69rem",
            fontWeight: 700,
            padding: "2px 8px",
            borderRadius: 20,
            color: COMP_COLOR[niche.competitionLevel] ?? "var(--text-muted)",
            border: `1px solid ${COMP_COLOR[niche.competitionLevel] ?? "var(--border-subtle)"}`,
            background: "transparent",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {niche.competitionLevel} comp.
        </span>
        {isPublishNow && (
          <span
            style={{
              fontSize: "0.69rem",
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: 20,
              color: "var(--gold)",
              border: "1px solid rgba(201,168,76,0.3)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Publish Now
          </span>
        )}
        {niche.currentSeasonalRelevance >= 60 && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1 }}>
            <div style={{ height: 3, flex: 1, borderRadius: 2, background: "var(--bg-elevated)", overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${niche.currentSeasonalRelevance}%`,
                  background: "var(--cyan)",
                  borderRadius: 2,
                }}
              />
            </div>
            <span style={{ fontSize: "0.68rem", color: "var(--cyan)", whiteSpace: "nowrap" }}>
              {niche.currentSeasonalRelevance}% in season
            </span>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button onClick={onView} style={{ flex: 1, fontSize: "0.75rem", padding: "5px 10px", borderRadius: 7, fontWeight: 600, background: "var(--bg-elevated)", border: "1px solid var(--border-default)", color: "var(--text-secondary)", cursor: "pointer" }}>
          View Profile
        </button>
        <button
          onClick={onSave}
          disabled={!!savedId || isSaving}
          style={{
            padding: "5px 10px",
            borderRadius: 7,
            fontSize: "0.75rem",
            fontWeight: 600,
            background: savedId ? "rgba(34,197,94,0.1)" : "var(--bg-elevated)",
            color: savedId ? "var(--emerald)" : "var(--text-secondary)",
            border: `1px solid ${savedId ? "rgba(34,197,94,0.3)" : "var(--border-default)"}`,
            cursor: savedId ? "default" : "pointer",
            flexShrink: 0,
          }}
        >
          {isSaving ? "..." : savedId ? "✓ Saved" : "Save"}
        </button>
        <button onClick={onGenerate} style={{ flexShrink: 0, fontSize: "0.75rem", padding: "5px 10px", borderRadius: 7, fontWeight: 600, background: "var(--gold-glow)", border: "1px solid rgba(201,168,76,0.3)", color: "var(--gold)", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
          <Zap size={11} />Gen.
        </button>
      </div>
    </motion.div>
  );
}

function SectionHeader({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon size={14} style={{ color: "var(--gold)" }} />
      <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
        {label}
      </span>
    </div>
  );
}

function DrawerSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div
        style={{
          fontSize: "0.72rem",
          fontWeight: 700,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginBottom: 10,
          paddingBottom: 6,
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function ProductFormatCard({ p }: { p: ProductRecommendation }) {
  const icons: Record<string, string> = {
    journal: "📓",
    planner: "📋",
    workbook: "📚",
    mini_guide: "📄",
    bundle: "📦",
  };
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "10px 12px",
        borderRadius: 8,
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-subtle)",
        marginBottom: 6,
      }}
    >
      <span style={{ fontSize: "1.1rem", flexShrink: 0, marginTop: 1 }}>{icons[p.format] ?? "📄"}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: "0.83rem", fontWeight: 600, color: "var(--text-primary)" }}>{p.title}</div>
        <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: 2 }}>{p.coreTransformation}</div>
      </div>
      <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--gold)", flexShrink: 0 }}>${p.pricePoint}</div>
    </div>
  );
}

function Chip({ label, color }: { label: string; color?: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 9px",
        borderRadius: 20,
        fontSize: "0.72rem",
        color: color ?? "var(--text-secondary)",
        background: color ? `${color}18` : "var(--bg-elevated)",
        border: `1px solid ${color ? `${color}30` : "var(--border-subtle)"}`,
        margin: "2px 3px 2px 0",
        lineHeight: 1.5,
      }}
    >
      {label}
    </span>
  );
}

function NicheResearchPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setActiveNiche } = useActiveNiche();

  const [emotion, setEmotion] = useState("");
  const [report, setReport] = useState<NicheExpansionReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNiche, setSelectedNiche] = useState<SubNiche | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [breadcrumbs, setBreadcrumbs] = useState<string[]>([]);
  const [view, setView] = useState<"results" | "library">("results");
  const [savedNiches, setSavedNiches] = useState<SavedNicheRecord[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [savedIds, setSavedIds] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [libraryFilter, setLibraryFilter] = useState<string>("all");

  const handleExpand = useCallback(async (emotionOverride?: string) => {
    const q = emotionOverride ?? emotion;
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    setReport(null);
    if (!emotionOverride) setBreadcrumbs([q.trim()]);

    try {
      const res = await apiFetch("/api/niche-expansion?action=expand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emotion: q.trim(), avoidExisting: true }),
      });
      const data = await res.json() as { success: boolean; data?: NicheExpansionReport; error?: string };
      if (data.success && data.data) {
        setReport(data.data);
        setView("results");
      } else {
        setError(data.error ?? "Expansion failed");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [emotion]);

  // Read URL params on mount for Intelligence page → Niche link
  useEffect(() => {
    const urlEmotion = searchParams.get("emotion");
    const autoExpand = searchParams.get("autoExpand");
    if (urlEmotion) {
      setEmotion(urlEmotion);
      if (autoExpand === "true") {
        void handleExpand(urlEmotion);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadLibrary = useCallback(async () => {
    setLibraryLoading(true);
    try {
      const res = await apiFetch("/api/niche-expansion?action=list");
      const data = await res.json() as { success: boolean; data?: SavedNicheRecord[] };
      if (data.success && data.data) setSavedNiches(data.data);
    } catch {
      // non-fatal
    } finally {
      setLibraryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (view === "library") void loadLibrary();
  }, [view, loadLibrary]);

  async function handleSave(niche: SubNiche) {
    setSavingId(niche.id);
    try {
      const res = await apiFetch("/api/niche-expansion?action=save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche, notes: "" }),
      });
      const data = await res.json() as { success: boolean; data?: { id: string } };
      if (data.success && data.data) {
        setSavedIds((prev) => ({ ...prev, [niche.id]: data.data!.id }));
      }
    } finally {
      setSavingId(null);
    }
  }

  async function handleDrill(niche: SubNiche, savedId: string) {
    setLoading(true);
    setDrawerOpen(false);
    setBreadcrumbs((prev) => [...prev, niche.nicheName]);
    try {
      const res = await apiFetch("/api/niche-expansion?action=drill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentNicheId: savedId }),
      });
      const data = await res.json() as { success: boolean; data?: NicheExpansionReport; error?: string };
      if (data.success && data.data) {
        setReport(data.data);
        setView("results");
      } else {
        setError(data.error ?? "Drill failed");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  function handleGenerateProducts(niche: SubNiche, savedId?: string) {
    setActiveNiche(niche, savedId);
    router.push("/products");
  }

  function openDrawer(niche: SubNiche) {
    setSelectedNiche(niche);
    setDrawerOpen(true);
  }

  async function toggleFavorite(id: string, current: boolean) {
    await apiFetch("/api/niche-expansion?action=update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, isFavorited: !current }),
    });
    setSavedNiches((prev) => prev.map((n) => (n.id === id ? { ...n, isFavorited: !current } : n)));
  }

  async function updateStatus(id: string, status: string) {
    await apiFetch("/api/niche-expansion?action=update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    setSavedNiches((prev) => prev.map((n) => (n.id === id ? { ...n, status } : n)));
  }

  const filteredLibrary =
    libraryFilter === "all"
      ? savedNiches
      : savedNiches.filter((n) => n.status === libraryFilter);

  const allNiches = report?.subNiches ?? [];

  return (
    <div style={{ minHeight: "100vh" }}>
      <PageHeader
        icon={Crosshair}
        title="Niche Research"
        iconColor="var(--gold)"
        subtitle="Expand broad emotions into specific, targetable sub-niches with full audience profiles."
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => setView("results")}
              style={{
                padding: "6px 14px",
                borderRadius: 8,
                fontSize: "0.8rem",
                fontWeight: view === "results" ? 600 : 400,
                color: view === "results" ? "var(--text-primary)" : "var(--text-muted)",
                background: view === "results" ? "var(--bg-card)" : "transparent",
                border: `1px solid ${view === "results" ? "var(--border-default)" : "transparent"}`,
                cursor: "pointer",
              }}
            >
              Research
            </button>
            <button
              onClick={() => setView("library")}
              style={{
                padding: "6px 14px",
                borderRadius: 8,
                fontSize: "0.8rem",
                fontWeight: view === "library" ? 600 : 400,
                color: view === "library" ? "var(--text-primary)" : "var(--text-muted)",
                background: view === "library" ? "var(--bg-card)" : "transparent",
                border: `1px solid ${view === "library" ? "var(--border-default)" : "transparent"}`,
                cursor: "pointer",
              }}
            >
              Library ({savedNiches.length})
            </button>
          </div>
        }
      />

      <div style={{ padding: "24px 36px" }}>
        {/* === SEARCH BAR === */}
        {view === "results" && (
          <>
            <div className="flex gap-3 mb-4" style={{ maxWidth: 600 }}>
              <input
                value={emotion}
                onChange={(e) => setEmotion(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void handleExpand()}
                placeholder="Enter an emotion (e.g. anxiety, burnout, loneliness)"
                style={{
                  flex: 1,
                  padding: "10px 16px",
                  borderRadius: 10,
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-default)",
                  color: "var(--text-primary)",
                  fontSize: "0.9rem",
                }}
              />
              <Button
                variant="gold"
                icon={loading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Search size={14} />}
                onClick={() => void handleExpand()}
                disabled={loading || !emotion.trim()}
              >
                {loading ? "Expanding..." : "Expand"}
              </Button>
            </div>

            {/* Breadcrumbs */}
            {breadcrumbs.length > 1 && (
              <div className="flex items-center gap-1 mb-4 flex-wrap">
                {breadcrumbs.map((crumb, i) => (
                  <span key={i} className="flex items-center gap-1">
                    {i > 0 && <ChevronRight size={12} style={{ color: "var(--text-muted)" }} />}
                    <span style={{ fontSize: "0.78rem", color: i === breadcrumbs.length - 1 ? "var(--gold)" : "var(--text-muted)" }}>
                      {crumb}
                    </span>
                  </span>
                ))}
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 mb-4" style={{ color: "var(--rose)", fontSize: "0.875rem" }}>
                <AlertCircle size={14} /> {error}
              </div>
            )}

            {/* Shimmer while loading */}
            {loading && (
              <div className="flex flex-col gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} style={{ height: 120, borderRadius: 12, overflow: "hidden" }}>
                    <div className="shimmer" style={{ width: "100%", height: "100%" }} />
                  </div>
                ))}
              </div>
            )}

            {/* Results */}
            {!loading && report && (
              <>
                {/* Summary */}
                <div
                  style={{
                    padding: "12px 16px",
                    borderRadius: 10,
                    background: "var(--bg-card)",
                    border: "1px solid var(--border-subtle)",
                    marginBottom: 24,
                    fontSize: "0.83rem",
                    color: "var(--text-secondary)",
                    lineHeight: 1.6,
                  }}
                >
                  <span style={{ color: "var(--gold)", fontWeight: 600 }}>{report.totalNichesFound} sub-niches found</span>
                  {" — "}{report.researchSummary}
                </div>

                {/* Quick Wins */}
                {report.quickWins?.length > 0 && (
                  <div style={{ marginBottom: 28 }}>
                    <SectionHeader icon={Trophy} label="Quick Wins — Low Competition + High Score" />
                    <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
                      {report.quickWins.map((niche) => (
                        <NicheCard
                          key={niche.id}
                          niche={niche}
                          savedId={savedIds[niche.id]}
                          isSaving={savingId === niche.id}
                          onView={() => openDrawer(niche)}
                          onSave={() => void handleSave(niche)}
                          onGenerate={() => handleGenerateProducts(niche, savedIds[niche.id])}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* In Season Now */}
                {report.seasonalPicks?.filter((n) => n.currentSeasonalRelevance >= 65).length > 0 && (
                  <div style={{ marginBottom: 28 }}>
                    <SectionHeader icon={Calendar} label="In Season Now" />
                    <div className="flex flex-col gap-2">
                      {report.seasonalPicks
                        .filter((n) => n.currentSeasonalRelevance >= 65)
                        .map((niche) => (
                          <div
                            key={niche.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 12,
                              padding: "10px 16px",
                              borderRadius: 10,
                              background: "var(--bg-card)",
                              border: "1px solid rgba(6,182,212,0.15)",
                            }}
                          >
                            <span style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "0.875rem", flex: 1 }}>
                              {niche.nicheName}
                            </span>
                            <span style={{ fontSize: "0.75rem", color: "var(--cyan)", fontWeight: 600 }}>
                              Season: {niche.currentSeasonalRelevance}/100
                            </span>
                            <Badge variant="muted">Score: {Math.round(niche.opportunityScore)}</Badge>
                            <Button variant="outline" size="sm" onClick={() => openDrawer(niche)}>View</Button>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* All Niches */}
                <div>
                  <SectionHeader icon={Layers} label={`All ${allNiches.length} Niches — Sorted by Score`} />
                  <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
                    {allNiches.map((niche) => (
                      <NicheCard
                        key={niche.id}
                        niche={niche}
                        savedId={savedIds[niche.id]}
                        isSaving={savingId === niche.id}
                        onView={() => openDrawer(niche)}
                        onSave={() => void handleSave(niche)}
                        onGenerate={() => handleGenerateProducts(niche, savedIds[niche.id])}
                      />
                    ))}
                  </div>
                </div>

                {/* Expansion map */}
                {report.expansionMap?.length > 0 && (
                  <div style={{ marginTop: 32 }}>
                    <SectionHeader icon={TrendingUp} label="Related Emotions to Explore" />
                    <div className="flex flex-wrap gap-2">
                      {report.expansionMap.map((e) => (
                        <button
                          key={e}
                          onClick={() => { setEmotion(e); void handleExpand(e); }}
                          style={{
                            padding: "6px 14px",
                            borderRadius: 20,
                            fontSize: "0.8rem",
                            color: "var(--text-secondary)",
                            background: "var(--bg-elevated)",
                            border: "1px solid var(--border-default)",
                            cursor: "pointer",
                          }}
                        >
                          {e} →
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Empty state */}
            {!loading && !report && !error && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "60px 0",
                  color: "var(--text-muted)",
                  gap: 12,
                  textAlign: "center",
                }}
              >
                <Crosshair size={40} style={{ opacity: 0.3 }} />
                <div style={{ fontSize: "0.9rem" }}>Enter an emotion to discover profitable sub-niches</div>
                <div style={{ fontSize: "0.78rem", opacity: 0.7 }}>Try: anxiety, burnout, loneliness, grief, overwhelm</div>
              </div>
            )}
          </>
        )}

        {/* === LIBRARY VIEW === */}
        {view === "library" && (
          <>
            <div className="flex gap-2 mb-5 flex-wrap items-center">
              {(["all", "researched", "in_progress", "producing", "saturated"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setLibraryFilter(f)}
                  style={{
                    padding: "5px 12px",
                    borderRadius: 20,
                    fontSize: "0.78rem",
                    fontWeight: libraryFilter === f ? 600 : 400,
                    color: libraryFilter === f ? "var(--text-primary)" : "var(--text-muted)",
                    background: libraryFilter === f ? "var(--bg-card)" : "transparent",
                    border: `1px solid ${libraryFilter === f ? "var(--border-default)" : "transparent"}`,
                    cursor: "pointer",
                    textTransform: "capitalize",
                  }}
                >
                  {f === "all" ? "All" : f.replace("_", " ")}
                </button>
              ))}
            </div>

            {libraryLoading && (
              <div className="flex items-center gap-2" style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
                <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Loading library...
              </div>
            )}

            {!libraryLoading && filteredLibrary.length === 0 && (
              <div style={{ textAlign: "center", padding: "48px 0", color: "var(--text-muted)", fontSize: "0.875rem" }}>
                No saved niches yet. Research an emotion and save niches you want to pursue.
              </div>
            )}

            {!libraryLoading && filteredLibrary.length > 0 && (
              <div className="flex flex-col gap-3">
                {filteredLibrary.map((n) => (
                  <div
                    key={n.id}
                    style={{
                      padding: "14px 18px",
                      borderRadius: 12,
                      background: "var(--bg-card)",
                      border: `1px solid ${n.isFavorited ? "rgba(201,168,76,0.2)" : "var(--border-subtle)"}`,
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => void toggleFavorite(n.id, n.isFavorited)}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          padding: 2,
                          flexShrink: 0,
                          marginTop: 1,
                        }}
                      >
                        <Star
                          size={16}
                          fill={n.isFavorited ? "var(--gold)" : "none"}
                          style={{ color: n.isFavorited ? "var(--gold)" : "var(--text-muted)" }}
                        />
                      </button>
                      <div style={{ flex: 1 }}>
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "0.9rem" }}>
                            {n.nicheName}
                          </span>
                          <Badge variant="muted">Score: {Math.round(n.opportunityScore)}</Badge>
                          <span
                            style={{
                              fontSize: "0.68rem",
                              color: COMP_COLOR[n.competitionLevel] ?? "var(--text-muted)",
                              fontWeight: 600,
                              textTransform: "uppercase",
                            }}
                          >
                            {n.competitionLevel} comp.
                          </span>
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                          {n.productsGenerated} products generated
                          {n.totalRevenue > 0 && ` · $${n.totalRevenue.toFixed(2)} revenue`}
                          {n.lastUsedAt && ` · Last used ${new Date(n.lastUsedAt).toLocaleDateString()}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <select
                          value={n.status}
                          onChange={(e) => void updateStatus(n.id, e.target.value)}
                          style={{
                            padding: "4px 8px",
                            borderRadius: 6,
                            fontSize: "0.75rem",
                            background: "var(--bg-elevated)",
                            border: "1px solid var(--border-default)",
                            color: "var(--text-secondary)",
                            cursor: "pointer",
                          }}
                        >
                          <option value="researched">Researched</option>
                          <option value="in_progress">In Progress</option>
                          <option value="producing">Producing</option>
                          <option value="saturated">Saturated</option>
                        </select>
                        <Button
                          variant="gold"
                          size="sm"
                          icon={<Zap size={11} />}
                          onClick={() => {
                            // For library niches we don't have the full SubNiche — navigate to research with pre-fill
                            router.push(`/niche-research?emotion=${encodeURIComponent(n.parentEmotion)}`);
                          }}
                        >
                          Generate
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* === NICHE PROFILE DRAWER === */}
      <AnimatePresence>
        {drawerOpen && selectedNiche && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawerOpen(false)}
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.4)",
                zIndex: 49,
              }}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              style={{
                position: "fixed",
                right: 0,
                top: 0,
                bottom: 0,
                width: "min(600px, 100vw)",
                background: "var(--bg-surface)",
                borderLeft: "1px solid var(--border-default)",
                overflowY: "auto",
                zIndex: 50,
                padding: "24px",
              }}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-5">
                <div style={{ flex: 1, marginRight: 12 }}>
                  <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
                    {selectedNiche.nicheName}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{selectedNiche.oneLiner}</div>
                </div>
                <button onClick={() => setDrawerOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", flexShrink: 0 }}>
                  <X size={18} />
                </button>
              </div>

              {/* Score row */}
              <div className="flex gap-3 mb-5 flex-wrap">
                {[
                  { label: "Opportunity", value: Math.round(selectedNiche.opportunityScore) },
                  { label: "Evergreen", value: Math.round(selectedNiche.evergreenScore) },
                  { label: "Trending", value: Math.round(selectedNiche.trendingScore) },
                  { label: "Monetization", value: Math.round(selectedNiche.monetizationScore) },
                ].map(({ label, value }) => (
                  <div key={label} style={{ textAlign: "center", padding: "8px 14px", borderRadius: 8, background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}>
                    <div style={{ fontSize: "1.1rem", fontWeight: 700, color: SCORE_COLOR(value) }}>{value}</div>
                    <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
                  </div>
                ))}
                <div style={{ padding: "8px 14px", borderRadius: 8, background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, color: COMP_COLOR[selectedNiche.competitionLevel] ?? "var(--text-muted)", textTransform: "uppercase" }}>
                    {selectedNiche.competitionLevel} competition
                  </div>
                  <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>{URGENCY_LABEL[selectedNiche.urgency]}</div>
                </div>
              </div>

              {/* Audience */}
              <DrawerSection label="Audience">
                <div style={{ marginBottom: 8 }}>
                  <span style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "0.9rem" }}>{selectedNiche.audience.name}</span>
                  <span style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}> · Ages {selectedNiche.audience.ageRange}</span>
                </div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: 8, lineHeight: 1.5 }}>{selectedNiche.audience.lifeStage}</div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: 10, fontStyle: "italic", lineHeight: 1.5 }}>"{selectedNiche.audience.coreStruggle}"</div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: 6 }}>They say:</div>
                <div className="flex flex-wrap">
                  {selectedNiche.audience.languageTheyUse.map((phrase) => (
                    <Chip key={phrase} label={`"${phrase}"`} color="var(--violet)" />
                  ))}
                </div>
                {selectedNiche.audience.buyingTrigger && (
                  <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8, background: "rgba(201,168,76,0.06)", border: "1px solid rgba(201,168,76,0.15)", fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                    <span style={{ color: "var(--gold)", fontWeight: 600 }}>Buying trigger: </span>{selectedNiche.audience.buyingTrigger}
                  </div>
                )}
              </DrawerSection>

              {/* Product formats */}
              <DrawerSection label="Product Formats">
                {selectedNiche.allProductFormats.map((p) => (
                  <ProductFormatCard key={p.format} p={p} />
                ))}
              </DrawerSection>

              {/* Etsy keywords */}
              <DrawerSection label="Etsy Keywords">
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: 6 }}>Primary (highest traffic):</div>
                <div className="flex flex-wrap mb-3">
                  {selectedNiche.etsyIntel.primaryKeywords.map((kw) => (
                    <Chip key={kw} label={kw} color="var(--emerald)" />
                  ))}
                </div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: 6 }}>Long-tail:</div>
                <div className="flex flex-wrap mb-3">
                  {selectedNiche.etsyIntel.longTailKeywords.map((kw) => (
                    <Chip key={kw} label={kw} />
                  ))}
                </div>
                {selectedNiche.etsyIntel.titleFormula && (
                  <div style={{ padding: "8px 12px", borderRadius: 8, background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", fontSize: "0.78rem", color: "var(--text-secondary)", fontFamily: "monospace" }}>
                    {selectedNiche.etsyIntel.titleFormula}
                  </div>
                )}
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 10, marginBottom: 6 }}>All 13 tags:</div>
                <div className="flex flex-wrap">
                  {selectedNiche.etsyIntel.tagSuggestions.map((tag) => (
                    <Chip key={tag} label={tag} />
                  ))}
                </div>
              </DrawerSection>

              {/* Content angles */}
              <DrawerSection label="Content Angles">
                {[
                  { label: "Pinterest", value: selectedNiche.contentAngles.pinterestHook, icon: "📌" },
                  { label: "TikTok", value: selectedNiche.contentAngles.tiktokAngle, icon: "🎵" },
                  { label: "Instagram", value: selectedNiche.contentAngles.instagramHook, icon: "📸" },
                  { label: "Email subject", value: selectedNiche.contentAngles.emailSubjectLine, icon: "✉️" },
                ].map(({ label, value, icon }) => (
                  <div key={label} style={{ padding: "8px 12px", borderRadius: 8, background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", marginBottom: 6 }}>
                    <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{icon} {label}</span>
                    <div style={{ fontSize: "0.82rem", color: "var(--text-primary)", marginTop: 3 }}>{value}</div>
                  </div>
                ))}
              </DrawerSection>

              {/* Competitor gaps */}
              <DrawerSection label="Competitor Gaps — Product Ideas That Don't Exist Yet">
                {selectedNiche.competitorGaps.map((gap, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "flex-start" }}>
                    <span style={{ color: "var(--gold)", flexShrink: 0, marginTop: 2 }}>•</span>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>{gap}</span>
                  </div>
                ))}
              </DrawerSection>

              {/* Seasonal */}
              <DrawerSection label="Seasonal">
                <div className="flex flex-wrap gap-2 mb-3">
                  {selectedNiche.peakMonths.map((m) => (
                    <Chip
                      key={m}
                      label={new Date(2024, m - 1, 1).toLocaleString("en-US", { month: "short" })}
                      color="var(--cyan)"
                    />
                  ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1, height: 6, borderRadius: 3, background: "var(--bg-elevated)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${selectedNiche.currentSeasonalRelevance}%`, background: "var(--cyan)", borderRadius: 3 }} />
                  </div>
                  <span style={{ fontSize: "0.78rem", color: "var(--cyan)", fontWeight: 600, flexShrink: 0 }}>
                    {selectedNiche.currentSeasonalRelevance}/100 current relevance
                  </span>
                </div>
                <div style={{ marginTop: 8, fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  {selectedNiche.whyNowRationale}
                </div>
              </DrawerSection>

              {/* Related niches */}
              {selectedNiche.relatedNiches?.length > 0 && (
                <DrawerSection label="Related Niches to Explore">
                  <div className="flex flex-wrap">
                    {selectedNiche.relatedNiches.map((n) => (
                      <button
                        key={n}
                        onClick={() => { setEmotion(n); setDrawerOpen(false); void handleExpand(n); }}
                        style={{
                          margin: "2px 4px 2px 0",
                          padding: "4px 12px",
                          borderRadius: 20,
                          fontSize: "0.75rem",
                          color: "var(--text-secondary)",
                          background: "var(--bg-elevated)",
                          border: "1px solid var(--border-default)",
                          cursor: "pointer",
                        }}
                      >
                        {n} →
                      </button>
                    ))}
                  </div>
                </DrawerSection>
              )}

              {/* Drill deeper */}
              {savedIds[selectedNiche.id] && (
                <DrawerSection label="Drill Deeper">
                  <Button
                    variant="outline"
                    icon={<ChevronDown size={13} />}
                    onClick={() => void handleDrill(selectedNiche, savedIds[selectedNiche.id])}
                    disabled={loading}
                    fullWidth
                  >
                    Expand into sub-niches of this niche →
                  </Button>
                </DrawerSection>
              )}

              {/* CTA buttons */}
              <div className="flex gap-3 mt-4">
                {!savedIds[selectedNiche.id] ? (
                  <button
                    onClick={() => void handleSave(selectedNiche)}
                    disabled={savingId === selectedNiche.id}
                    style={{ flex: 1, padding: "8px 12px", borderRadius: 8, fontSize: "0.8rem", fontWeight: 600, background: "var(--bg-elevated)", border: "1px solid var(--border-default)", color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                  >
                    <BookOpen size={13} />
                    {savingId === selectedNiche.id ? "Saving..." : "Save to Library"}
                  </button>
                ) : (
                  <div style={{ flex: 1, padding: "8px 12px", borderRadius: 8, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", fontSize: "0.8rem", color: "var(--emerald)", textAlign: "center" }}>
                    ✓ Saved to Library
                  </div>
                )}
                <button
                  onClick={() => handleGenerateProducts(selectedNiche, savedIds[selectedNiche.id])}
                  style={{ flex: 1, padding: "8px 12px", borderRadius: 8, fontSize: "0.8rem", fontWeight: 600, background: "var(--gold-glow)", border: "1px solid rgba(201,168,76,0.3)", color: "var(--gold)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                >
                  <Zap size={13} />Generate 5 Products →
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function NicheResearchPage() {
  return (
    <Suspense>
      <NicheResearchPageInner />
    </Suspense>
  );
}
