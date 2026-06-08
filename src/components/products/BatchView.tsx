"use client";

import { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, CheckCircle, Clock, AlertCircle, Layers, ChevronRight } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import type { BatchPlan, BatchSlot, ProductFormat } from "@/lib/ai/mix-types";
import { PRICING_TIERS } from "@/lib/ai/mix-types";

const FORMAT_COLORS: Record<ProductFormat, string> = {
  journal: "var(--gold)",
  planner: "var(--cyan)",
  workbook: "var(--violet)",
  mini_guide: "var(--emerald)",
  bundle: "var(--amber)",
  knowledge_guide: "var(--cyan)",
  knowledge_workbook: "var(--violet)",
  checklist: "var(--emerald)",
  template_pack: "var(--amber)",
  game_sheet: "var(--rose)",
  game_pack: "var(--rose)",
  party_kit: "var(--rose)",
};

const FORMAT_LABELS: Record<ProductFormat, string> = {
  journal: "JOURNAL",
  planner: "PLANNER",
  workbook: "WORKBOOK",
  mini_guide: "MINI GUIDE",
  bundle: "BUNDLE",
  knowledge_guide: "GUIDE",
  knowledge_workbook: "WORKBOOK",
  checklist: "CHECKLIST",
  template_pack: "TEMPLATE PACK",
  game_sheet: "GAME SHEET",
  game_pack: "GAME PACK",
  party_kit: "PARTY KIT",
};

export interface CompletedProduct {
  index: number;
  title: string;
  savedId: string;
  slot: BatchSlot;
}

interface BatchViewProps {
  apiKey: string;
  onProductsComplete?: (products: CompletedProduct[]) => void;
  initialTheme?: string;
  initialAudience?: string;
  nicheKeywords?: string[];
  audienceLanguage?: string[];
  activeSavedNicheId?: string;
}

type Stage = "idle" | "previewing" | "generating" | "complete";

function SlotRow({ slot, price, onPriceChange }: { slot: BatchSlot; price: number; onPriceChange: (p: number) => void }) {
  const tier = PRICING_TIERS[slot.format];
  const isBelow = price < tier.minPrice;
  const color = FORMAT_COLORS[slot.format];

  return (
    <div style={{ padding: "12px 14px", borderRadius: 8, background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span style={{ fontSize: "0.6875rem", padding: "2px 8px", borderRadius: 20, fontWeight: 600, color, border: `1px solid ${color}40`, display: "inline-flex", whiteSpace: "nowrap" }}>{FORMAT_LABELS[slot.format]}</span>
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{slot.urgencyLevel}</span>
          </div>
          <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)" }}>{slot.audienceFocus}</div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: 2 }}>{slot.transformationAngle}</div>
        </div>
        <div style={{ flexShrink: 0, textAlign: "right" }}>
          <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--gold)", letterSpacing: "-0.02em" }}>${price}</div>
          <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>${tier.minPrice}–${tier.maxPrice}</div>
        </div>
      </div>
      <div style={{ marginTop: 10 }}>
        <input
          type="range"
          min={tier.minPrice}
          max={tier.maxPrice}
          value={price}
          onChange={(e) => onPriceChange(Number(e.target.value))}
          style={{ width: "100%", accentColor: color }}
        />
      </div>
      {isBelow && (
        <div style={{ marginTop: 6, fontSize: "0.72rem", color: "var(--amber)", display: "flex", alignItems: "center", gap: 4 }}>
          <AlertCircle size={11} />
          Below recommended minimum — may signal low quality to buyers
        </div>
      )}
      <div style={{ marginTop: 6, fontSize: "0.72rem", color: "var(--text-muted)", lineHeight: 1.4 }}>{tier.rationale}</div>
    </div>
  );
}

export function BatchView({ apiKey, onProductsComplete, initialTheme, initialAudience, nicheKeywords, audienceLanguage, activeSavedNicheId }: BatchViewProps) {
  const [stage, setStage] = useState<Stage>("idle");
  const [emotionalTheme, setEmotionalTheme] = useState(initialTheme ?? "");
  const [targetAudience, setTargetAudience] = useState(initialAudience ?? "");
  const [batchPlan, setBatchPlan] = useState<BatchPlan | null>(null);
  const [prices, setPrices] = useState<number[]>([]);
  const [planLoading, setPlanLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [completed, setCompleted] = useState<CompletedProduct[]>([]);
  const [failed, setFailed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const headers = useMemo(() => ({ "Content-Type": "application/json", "x-api-key": apiKey }), [apiKey]);

  async function handlePreview() {
    if (!emotionalTheme || !targetAudience) return;
    setPlanLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/products?action=batch-plan", { method: "POST", headers, body: JSON.stringify({ emotionalTheme, targetAudience }) });
      const json = await res.json() as { success: boolean; data?: BatchPlan; error?: string };
      if (!json.success || !json.data) throw new Error(json.error ?? "Plan failed");
      setBatchPlan(json.data);
      setPrices(json.data.slots.map((s) => s.pricing.recommendedPrice));
      setStage("previewing");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate plan");
    } finally {
      setPlanLoading(false);
    }
  }

  const handleGenerate = useCallback(async () => {
    if (!batchPlan) return;
    setGenerating(true);
    setCompleted([]);
    setFailed(0);
    setError(null);
    setStage("generating");

    const planWithPrices = {
      ...batchPlan,
      slots: batchPlan.slots.map((s, i) => ({ ...s, pricing: { ...s.pricing, recommendedPrice: prices[i] ?? s.pricing.recommendedPrice } })),
    };

    try {
      const res = await fetch("/api/products/batch", { method: "POST", headers, body: JSON.stringify({ emotionalTheme, targetAudience, batchPlan: planWithPrices, nicheKeywords, audienceLanguage, activeSavedNicheId }) });
      if (!res.body) throw new Error("No response stream");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value).split("\n").filter((l) => l.startsWith("data: "));
        for (const line of lines) {
          const data = JSON.parse(line.slice(6)) as { type: string; index?: number; title?: string; savedId?: string; slot?: BatchSlot; successCount?: number; failedCount?: number };
          if (data.type === "product_complete" && data.index !== undefined && data.title && data.savedId && data.slot) {
            setCompleted((prev) => [...prev, { index: data.index!, title: data.title!, savedId: data.savedId!, slot: data.slot! }]);
          }
          if (data.type === "product_failed") setFailed((f) => f + 1);
          if (data.type === "batch_complete") {
            setStage("complete");
            setGenerating(false);
          }
          if (data.type === "error") { setError("Batch generation failed"); setStage("previewing"); }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Batch failed");
      setStage("previewing");
    } finally {
      setGenerating(false);
    }
  }, [batchPlan, prices, emotionalTheme, targetAudience, headers]);

  const totalRevenue = (batchPlan?.slots ?? []).reduce((sum, _, i) => sum + (prices[i] ?? 0), 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Form */}
      <Card>
        <CardBody>
          <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div>
              <div className="label mb-2">Emotional Theme</div>
              <input value={emotionalTheme} onChange={(e) => setEmotionalTheme(e.target.value)} placeholder="e.g. Anxiety and overwhelm for new moms" style={{ width: "100%", padding: "8px 12px", borderRadius: 8, background: "var(--bg-elevated)", border: "1px solid var(--border-default)", color: "var(--text-primary)", fontSize: "0.875rem" }} />
            </div>
            <div>
              <div className="label mb-2">Target Audience</div>
              <input value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} placeholder="e.g. Moms of toddlers, 28–40" style={{ width: "100%", padding: "8px 12px", borderRadius: 8, background: "var(--bg-elevated)", border: "1px solid var(--border-default)", color: "var(--text-primary)", fontSize: "0.875rem" }} />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <Button variant="outline" size="sm" onClick={handlePreview} loading={planLoading} disabled={!emotionalTheme || !targetAudience}>
              Preview Mix →
            </Button>
            {stage === "previewing" && (
              <Button variant="gold" icon={<Zap size={13} />} onClick={handleGenerate} loading={generating}>
                Generate Batch →
              </Button>
            )}
          </div>
          {error && <div style={{ marginTop: 10, fontSize: "0.8rem", color: "var(--rose)", display: "flex", alignItems: "center", gap: 6 }}><AlertCircle size={13} />{error}</div>}
        </CardBody>
      </Card>

      {/* Preview */}
      <AnimatePresence>
        {stage !== "idle" && batchPlan && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card>
              <CardBody>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-primary)" }}>{batchPlan.collectionName}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>{batchPlan.etsyCollectionNote}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--emerald)", letterSpacing: "-0.02em" }}>${totalRevenue}</div>
                    <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>rev if each sells once</div>
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  {batchPlan.slots.map((slot, i) => (
                    <SlotRow key={i} slot={slot} price={prices[i] ?? slot.pricing.recommendedPrice} onPriceChange={(p) => setPrices((prev) => { const next = [...prev]; next[i] = p; return next; })} />
                  ))}
                </div>
                <div style={{ marginTop: 14, padding: "10px 12px", borderRadius: 8, background: "var(--bg-elevated)", fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                  <strong style={{ color: "var(--text-primary)" }}>Bundle: </strong>{batchPlan.bundleStrategy}
                </div>
              </CardBody>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress */}
      <AnimatePresence>
        {(stage === "generating" || stage === "complete") && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardBody>
                <div className="flex items-center justify-between mb-3">
                  <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)" }}>
                    {stage === "generating" ? "Generating Batch..." : "Batch Complete"}
                  </div>
                  <Badge variant={stage === "complete" ? "emerald" : "gold"}>
                    {completed.length} / {batchPlan?.slots.length ?? 0} complete
                  </Badge>
                </div>
                <div className="flex flex-col gap-2">
                  {(batchPlan?.slots ?? []).map((slot, i) => {
                    const done = completed.find((c) => c.index === i);
                    const isFailed = !done && stage === "complete";
                    return (
                      <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.1 }}
                        style={{ padding: "8px 12px", borderRadius: 8, background: "var(--bg-elevated)", display: "flex", alignItems: "center", gap: 10 }}>
                        {done ? <CheckCircle size={14} style={{ color: "var(--emerald)", flexShrink: 0 }} /> : isFailed ? <AlertCircle size={14} style={{ color: "var(--rose)", flexShrink: 0 }} /> : <Clock size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: "0.82rem", color: done ? "var(--text-primary)" : "var(--text-muted)", fontWeight: done ? 600 : 400 }}>
                            {done ? done.title : `${FORMAT_LABELS[slot.format]} — ${stage === "generating" ? "generating..." : "failed"}`}
                          </div>
                          <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 1 }}>${prices[i] ?? slot.pricing.recommendedPrice} · {FORMAT_LABELS[slot.format]}</div>
                        </div>
                        <span style={{ fontSize: "0.6875rem", padding: "2px 8px", borderRadius: 20, fontWeight: 600, color: FORMAT_COLORS[slot.format], border: `1px solid ${FORMAT_COLORS[slot.format]}40`, display: "inline-flex", whiteSpace: "nowrap" }}>{FORMAT_LABELS[slot.format]}</span>
                      </motion.div>
                    );
                  })}
                </div>
                {failed > 0 && <div style={{ marginTop: 10, fontSize: "0.78rem", color: "var(--rose)" }}>{failed} product{failed > 1 ? "s" : ""} failed to generate. The rest were saved successfully.</div>}
                {stage === "complete" && completed.length > 0 && (
                  <div className="flex gap-3 mt-4">
                    <Button variant="gold" icon={<Layers size={13} />} onClick={() => onProductsComplete?.(completed)}>
                      View Results
                    </Button>
                    <Button variant="outline" size="sm" icon={<ChevronRight size={13} />} onClick={() => { setStage("idle"); setBatchPlan(null); setCompleted([]); setFailed(0); }}>
                      New Batch
                    </Button>
                  </div>
                )}
              </CardBody>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
