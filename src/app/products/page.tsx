"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Layers, Zap, AlertCircle, ChevronRight, CheckSquare, Square, Upload, Pin, X, Crosshair, FileText, Download } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { BlueprintView } from "@/components/products/BlueprintView";
import { BatchView } from "@/components/products/BatchView";
import type { CompletedProduct } from "@/components/products/BatchView";
import type { ProductBlueprint, ProductType } from "@/lib/ai/product-engine";
import type { NextBatchSuggestion } from "@/lib/ai/mix-types";
import { apiFetch } from "@/lib/api";
import { useActiveProduct } from "@/lib/stores/active-product";
import { useActiveNiche } from "@/lib/stores/active-niche";
import { useIntelligenceLaunch } from "@/lib/stores/intelligence-launch";
import { useRouter } from "next/navigation";
import StreakTracker from "@/components/accountability/StreakTracker";

const API_KEY = process.env.NEXT_PUBLIC_API_KEY ?? "";

interface DailyLog { batchesRun: number; productsGenerated: number; targetProducts: number; }

function DailyProgressBar({ log }: { log: DailyLog }) {
  const pct = Math.min(100, Math.round((log.productsGenerated / log.targetProducts) * 100));
  const hour = new Date().getHours();
  const color = log.productsGenerated >= log.targetProducts ? "var(--emerald)" : pct < 50 && hour >= 12 ? "var(--rose)" : pct < 75 && hour >= 18 ? "var(--amber)" : "var(--gold)";
  return (
    <div style={{ marginBottom: 20, padding: "12px 18px", borderRadius: 10, background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
      <div className="flex items-center justify-between mb-2">
        <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-secondary)" }}>Today&apos;s Progress</span>
        <div className="flex items-center gap-3">
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{log.batchesRun} batches</span>
          <Badge variant={log.productsGenerated >= log.targetProducts ? "emerald" : "muted"}>
            {log.productsGenerated} / {log.targetProducts} products
          </Badge>
        </div>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: "var(--bg-elevated)", overflow: "hidden" }}>
        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, ease: "easeOut" }} style={{ height: "100%", background: color, borderRadius: 3 }} />
      </div>
    </div>
  );
}

function SuggestionCards({ suggestions, onSelect }: { suggestions: NextBatchSuggestion[]; onSelect: (theme: string, audience: string) => void }) {
  const urgencyColor = { do_today: "var(--rose)", this_week: "var(--amber)", when_ready: "var(--text-muted)" };
  return (
    <div style={{ marginTop: 28 }}>
      <div className="label mb-3">Suggested Next Batches</div>
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        {suggestions.map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <Card hover onClick={() => onSelect(s.suggestedTheme, s.suggestedAudience)}>
              <CardBody>
                <div className="flex items-start justify-between mb-2">
                  <Zap size={14} style={{ color: urgencyColor[s.urgency] ?? "var(--text-muted)" }} />
                  <span style={{ fontSize: "0.65rem", padding: "2px 8px", borderRadius: 20, fontWeight: 600, color: urgencyColor[s.urgency] ?? "var(--text-muted)", border: "1px solid var(--border-subtle)", display: "inline-flex", whiteSpace: "nowrap" }}>{s.urgency.replace("_", " ")}</span>
                </div>
                <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>{s.suggestedTheme}</div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 8 }}>{s.suggestedAudience}</div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", lineHeight: 1.4, marginBottom: 10 }}>{s.expectedConversionBoost}</div>
                <Button variant="outline" size="sm" icon={<ChevronRight size={11} />} onClick={() => onSelect(s.suggestedTheme, s.suggestedAudience)}>
                  Generate This →
                </Button>
              </CardBody>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export default function ProductsPage() {
  const [mode, setMode] = useState<"batch" | "single">("batch");
  const [dailyLog, setDailyLog] = useState<DailyLog | null>(null);
  const [suggestions, setSuggestions] = useState<NextBatchSuggestion[]>([]);
  const [completedBatch, setCompletedBatch] = useState<CompletedProduct[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkSuccess, setBulkSuccess] = useState<string | null>(null);
  const [pdfStates, setPdfStates] = useState<Record<string, { status: "idle" | "generating" | "done"; path?: string }>>({});

  const bulkMode = selectedIds.size > 0;

  // Single mode state
  const [loading, setLoading] = useState(false);
  const [blueprint, setBlueprint] = useState<ProductBlueprint | null>(null);
  const [singleError, setSingleError] = useState<string | null>(null);
  const [productType, setProductType] = useState<ProductType>("journal");
  const [emotionalFocus, setEmotionalFocus] = useState("Burnout Recovery & Rebuilding Energy");
  const [audienceArchetype, setAudienceArchetype] = useState("Burned-Out High Achiever (25-40, professional)");
  const { setActiveProduct } = useActiveProduct();
  const { activeNiche, activeSavedId, clearActiveNiche } = useActiveNiche();
  const { launchContext, clearLaunchContext } = useIntelligenceLaunch();
  const router = useRouter();

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    apiFetch(`/api/products/daily-log?date=${today}`)
      .then((r) => r.json() as Promise<{ success: boolean; data?: DailyLog }>)
      .then((j) => { if (j.success && j.data) setDailyLog(j.data); })
      .catch(() => null);
  }, []);

  // Pre-fill from intelligence launch context
  useEffect(() => {
    const fromIntelligence = new URLSearchParams(window.location.search).get("from") === "intelligence";
    if (fromIntelligence && launchContext) {
      setEmotionalFocus(launchContext.emotion);
      if (launchContext.audienceArchetypes[0]) {
        setAudienceArchetype(launchContext.audienceArchetypes[0]);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generateSingle() {
    setLoading(true);
    setSingleError(null);
    setBlueprint(null);
    try {
      const res = await apiFetch("/api/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emotionalFocus, productType, audienceArchetype }) });
      const data = await res.json() as { success: boolean; data?: ProductBlueprint & { savedId: string }; error?: string };
      if (!data.success || !data.data) throw new Error(data.error ?? "Failed");
      setBlueprint(data.data);
      setActiveProduct(data.data, data.data.savedId);
    } catch (err) { setSingleError(err instanceof Error ? err.message : "Failed"); }
    finally { setLoading(false); }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setBulkError(null);
    setBulkSuccess(null);
  }

  async function generatePdf(productId: string) {
    setPdfStates((prev) => ({ ...prev, [productId]: { status: "generating" } }));
    try {
      const res = await apiFetch("/api/pdf?action=generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });
      const json = await res.json() as { success: boolean; data?: { pdfPath: string }; error?: string };
      if (!json.success || !json.data) throw new Error(json.error ?? "PDF generation failed");
      setPdfStates((prev) => ({ ...prev, [productId]: { status: "done", path: json.data!.pdfPath } }));
    } catch {
      setPdfStates((prev) => ({ ...prev, [productId]: { status: "idle" } }));
    }
  }

  async function runBulk(action: "publish-gumroad" | "pin-pinterest") {
    setBulkLoading(true);
    setBulkError(null);
    setBulkSuccess(null);
    try {
      const res = await apiFetch("/api/products/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, productIds: Array.from(selectedIds) }),
      });
      const json = await res.json() as { success: boolean; data?: { succeeded: number; failed: number }; error?: string };
      if (!json.success || !json.data) throw new Error(json.error ?? "Bulk action failed");
      const { succeeded, failed } = json.data;
      setBulkSuccess(`${succeeded} succeeded${failed > 0 ? `, ${failed} failed` : ""}`);
      setSelectedIds(new Set());
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : "Bulk action failed");
    } finally {
      setBulkLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh" }}>
      <PageHeader
        icon={Sparkles}
        title="Product Psychology Engine"
        iconColor="var(--gold)"
        subtitle="Generate premium emotional utility products — journals, planners, workbooks — with embedded psychological frameworks."
        actions={
          <div className="flex gap-2">
            <Button variant={mode === "batch" ? "gold" : "outline"} icon={<Layers size={13} />} onClick={() => setMode("batch")}>Batch</Button>
            <Button variant={mode === "single" ? "gold" : "outline"} icon={<Sparkles size={13} />} onClick={() => setMode("single")}>Single</Button>
          </div>
        }
      />

      <div style={{ padding: "24px 36px" }}>
        {dailyLog && <DailyProgressBar log={dailyLog} />}
        <StreakTracker />

        {/* Intelligence launch context banner */}
        {launchContext && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 16, padding: "10px 16px", borderRadius: 10, background: "var(--emerald-bg)", border: "1px solid var(--emerald-border)", display: "flex", alignItems: "center", gap: 10 }}>
            <Sparkles size={14} style={{ color: "var(--emerald)", flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--emerald)", fontWeight: 600 }}>⚡ Launched from Intelligence · Score: {launchContext.opportunityScore.toFixed(0)} · </span>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>"{launchContext.nicheName}" · Context pre-loaded</span>
            </div>
            <button onClick={clearLaunchContext} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4, display: "flex", alignItems: "center" }}>
              <X size={13} />
            </button>
          </motion.div>
        )}

        {/* Active niche banner */}
        {activeNiche && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 20, padding: "12px 16px", borderRadius: 10, background: "var(--bg-card)", border: "1px solid rgba(201,168,76,0.25)", display: "flex", alignItems: "center", gap: 12 }}>
            <Crosshair size={15} style={{ color: "var(--gold)", flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: 2 }}>Active Niche</div>
              <div className="flex items-center gap-2 flex-wrap">
                <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)" }}>{activeNiche.nicheName}</span>
                <Badge variant="muted">{activeNiche.competitionLevel} competition</Badge>
                <Badge variant={activeNiche.opportunityScore >= 80 ? "emerald" : "gold"}>{activeNiche.opportunityScore.toFixed(0)} score</Badge>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>→ {activeNiche.topProductRecommendation.format.replace("_", " ")}</span>
              </div>
            </div>
            <button onClick={clearActiveNiche} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4, display: "flex", alignItems: "center" }}>
              <X size={14} />
            </button>
          </motion.div>
        )}

        {/* Completed batch results */}
        {completedBatch && mode === "batch" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ marginBottom: bulkMode ? 96 : 24 }}>
            <div className="flex items-center justify-between mb-3">
              <div className="label">Batch Results — {completedBatch.length} products generated</div>
              <button
                onClick={() => {
                  if (selectedIds.size === completedBatch.length) setSelectedIds(new Set());
                  else setSelectedIds(new Set(completedBatch.map((p) => p.savedId)));
                }}
                style={{ fontSize: "0.72rem", color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
              >
                {selectedIds.size === completedBatch.length ? <CheckSquare size={13} /> : <Square size={13} />}
                {selectedIds.size === completedBatch.length ? "Deselect all" : "Select all"}
              </button>
            </div>
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
              {completedBatch.map((p, i) => {
                const isSelected = selectedIds.has(p.savedId);
                return (
                  <Card
                    key={i}
                    hover
                    onClick={() => toggleSelect(p.savedId)}
                    style={{ border: `1px solid ${isSelected ? "rgba(201,168,76,0.4)" : "var(--border-subtle)"}`, background: isSelected ? "var(--gold-glow)" : undefined, cursor: "pointer" }}
                  >
                    <CardBody>
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="muted">{p.slot.format.toUpperCase().replace("_", " ")}</Badge>
                        {isSelected ? <CheckSquare size={14} style={{ color: "var(--gold)", flexShrink: 0 }} /> : <Square size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />}
                      </div>
                      <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>{p.title}</div>
                      <div style={{ fontSize: "0.8rem", color: "var(--emerald)", fontWeight: 600, marginBottom: 8 }}>${p.slot.pricing.recommendedPrice}</div>
                      {(() => {
                        const pdfState = pdfStates[p.savedId];
                        if (pdfState?.status === "done" && pdfState.path) {
                          return (
                            <a href={pdfState.path} download target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.72rem", color: "var(--emerald)", fontWeight: 600, textDecoration: "none" }}>
                              <Download size={11} /> PDF Ready
                            </a>
                          );
                        }
                        return (
                          <button
                            onClick={(e) => { e.stopPropagation(); void generatePdf(p.savedId); }}
                            disabled={pdfState?.status === "generating"}
                            style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.72rem", color: "var(--blue)", fontWeight: 600, background: "none", border: "none", cursor: pdfState?.status === "generating" ? "not-allowed" : "pointer", padding: 0 }}
                          >
                            <FileText size={11} />
                            {pdfState?.status === "generating" ? "Generating…" : "Generate PDF"}
                          </button>
                        );
                      })()}
                    </CardBody>
                  </Card>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Bulk action bar */}
        <AnimatePresence>
          {bulkMode && (
            <motion.div
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50, background: "var(--bg-card)", borderTop: "1px solid var(--border-default)", padding: "12px 36px", display: "flex", alignItems: "center", gap: 12 }}
            >
              <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", marginRight: 4 }}>{selectedIds.size} selected</span>
              <Button variant="gold" size="sm" icon={<Upload size={12} />} loading={bulkLoading} onClick={() => void runBulk("publish-gumroad")}>Publish to Gumroad</Button>
              <Button variant="outline" size="sm" icon={<Pin size={12} />} loading={bulkLoading} onClick={() => void runBulk("pin-pinterest")}>Pin to Pinterest</Button>
              <div style={{ flex: 1 }} />
              {bulkSuccess && <span style={{ fontSize: "0.75rem", color: "var(--emerald)", fontWeight: 600 }}>{bulkSuccess}</span>}
              {bulkError && <span style={{ fontSize: "0.75rem", color: "var(--rose)", display: "flex", alignItems: "center", gap: 4 }}><AlertCircle size={12} />{bulkError}</span>}
              <button onClick={() => { setSelectedIds(new Set()); setBulkError(null); setBulkSuccess(null); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex", alignItems: "center" }}>
                <X size={16} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {mode === "batch" && (
          <>
            <BatchView
              apiKey={API_KEY}
              initialTheme={activeNiche?.nicheName}
              initialAudience={activeNiche ? `${activeNiche.audience.name} — ${activeNiche.audience.lifeStage}` : undefined}
              nicheKeywords={activeNiche?.etsyIntel.primaryKeywords}
              audienceLanguage={activeNiche?.audience.languageTheyUse}
              activeSavedNicheId={activeSavedId ?? undefined}
              onProductsComplete={(products) => { setCompletedBatch(products); setDailyLog((prev) => prev ? { ...prev, batchesRun: prev.batchesRun + 1, productsGenerated: prev.productsGenerated + products.length } : null); }}
            />
            {suggestions.length > 0 && <SuggestionCards suggestions={suggestions} onSelect={() => {}} />}
          </>
        )}

        {mode === "single" && (
          <div>
            <Card style={{ marginBottom: 24 }}>
              <CardBody>
                <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
                  <div>
                    <div className="label mb-2">Emotional Focus</div>
                    <input value={emotionalFocus} onChange={(e) => setEmotionalFocus(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, background: "var(--bg-elevated)", border: "1px solid var(--border-default)", color: "var(--text-primary)", fontSize: "0.875rem" }} />
                  </div>
                  <div>
                    <div className="label mb-2">Audience Archetype</div>
                    <input value={audienceArchetype} onChange={(e) => setAudienceArchetype(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, background: "var(--bg-elevated)", border: "1px solid var(--border-default)", color: "var(--text-primary)", fontSize: "0.875rem" }} />
                  </div>
                </div>
                <div className="flex gap-2 mt-3 flex-wrap">
                  {(["journal","planner","workbook","digital-system","hybrid"] as ProductType[]).map((t) => (
                    <button key={t} onClick={() => setProductType(t)} style={{ padding: "5px 10px", borderRadius: 6, fontSize: "0.75rem", fontWeight: productType === t ? 600 : 400, background: productType === t ? "var(--gold-glow)" : "var(--bg-elevated)", border: `1px solid ${productType === t ? "rgba(201,168,76,0.3)" : "var(--border-subtle)"}`, color: productType === t ? "var(--gold)" : "var(--text-secondary)", cursor: "pointer", transition: "all 0.15s" }}>{t}</button>
                  ))}
                </div>
                <div className="flex gap-3 mt-4">
                  <Button variant="gold" icon={<Sparkles size={13} />} loading={loading} onClick={generateSingle}>Generate Product</Button>
                </div>
                {singleError && <div style={{ marginTop: 10, fontSize: "0.8rem", color: "var(--rose)", display: "flex", alignItems: "center", gap: 6 }}><AlertCircle size={13} />{singleError}</div>}
              </CardBody>
            </Card>

            {loading && <div className="flex flex-col gap-4">{[200,160,120].map((h,i) => <div key={i} style={{ height: h, borderRadius: 12, overflow: "hidden" }}><div className="shimmer" style={{ width: "100%", height: "100%" }} /></div>)}</div>}
            {blueprint && !loading && (
              <>
                <BlueprintView blueprint={blueprint} />
                <div style={{ display: "flex", justifyContent: "center", marginTop: "2rem" }}>
                  <Button variant="gold" onClick={() => router.push("/content")} icon={<ChevronRight size={14} />} size="lg">Create Content →</Button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
