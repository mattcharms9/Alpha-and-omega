"use client";

import { useState, useEffect, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen, Zap, AlertCircle, ChevronRight, TrendingUp,
  Target, Star, CheckCircle, Users, X,
} from "lucide-react";
import { useActiveNiche } from "@/lib/stores/active-niche";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { apiFetch } from "@/lib/api";
import type { AudienceGapReport, AudienceGap, CapabilityGapReport, CapabilityGap, KnowledgeProductBlueprint } from "@/lib/ai/knowledge-types";
import type { KnowledgeCategory, ProductFormat } from "@/lib/ai/mix-types";

const CATEGORIES: Array<{ value: KnowledgeCategory; label: string; emoji: string }> = [
  { value: "money_basics", label: "Money Basics", emoji: "💵" },
  { value: "taxes", label: "Taxes", emoji: "🧾" },
  { value: "home_skills", label: "Home Skills", emoji: "🔧" },
  { value: "career", label: "Career", emoji: "💼" },
  { value: "health_insurance", label: "Health Insurance", emoji: "🏥" },
  { value: "legal_basics", label: "Legal Basics", emoji: "⚖️" },
  { value: "investing", label: "Investing", emoji: "📈" },
  { value: "adulting", label: "Adulting", emoji: "🧑‍🎓" },
  { value: "tech_basics", label: "Tech Basics", emoji: "💻" },
  { value: "relationships", label: "Relationships", emoji: "❤️" },
];

const FORMATS: Array<{ value: ProductFormat; label: string; price: string }> = [
  { value: "checklist", label: "Checklist", price: "$4–6" },
  { value: "knowledge_guide", label: "How-To Guide", price: "$7–9" },
  { value: "template_pack", label: "Template Pack", price: "$9–12" },
  { value: "knowledge_workbook", label: "Workbook", price: "$14–19" },
];

const COMPETITION_COLOR: Record<string, string> = {
  low: "var(--emerald)",
  medium: "var(--amber)",
  high: "var(--rose)",
};

function ShameBar({ level }: { level: number }) {
  const color = level >= 70 ? "var(--rose)" : level >= 40 ? "var(--amber)" : "var(--emerald)";
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Shame Level</span>
        <span style={{ fontSize: "0.7rem", fontWeight: 700, color }}>{level}</span>
      </div>
      <div style={{ height: 3, borderRadius: 2, background: "var(--bg-elevated)" }}>
        <div style={{ height: "100%", width: `${level}%`, background: color, borderRadius: 2 }} />
      </div>
    </div>
  );
}

function GapCard({ gap, selected, onSelect }: { gap: CapabilityGap; selected: boolean; onSelect: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
      <Card
        hover
        gold={selected}
        onClick={onSelect}
        style={{ cursor: "pointer", border: selected ? "1px solid rgba(201,168,76,0.4)" : undefined }}
      >
        <CardBody>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>{gap.title}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{gap.urgencyTrigger}</div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--gold)" }}>{gap.opportunityScore}</div>
              <div style={{ fontSize: "0.6rem", color: "var(--text-muted)" }}>score</div>
            </div>
          </div>

          <ShameBar level={gap.shameLevel} />

          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <Badge variant={gap.competitionLevel === "low" ? "emerald" : gap.competitionLevel === "medium" ? "amber" : "rose"}>
              {gap.competitionLevel} competition
            </Badge>
            <Badge variant="muted">{gap.recommendedFormat.replace("_", " ")}</Badge>
            <Badge variant="muted">${gap.recommendedPrice}</Badge>
            {gap.evergreen && <Badge variant="muted">evergreen</Badge>}
          </div>

          {selected && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border-subtle)" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontStyle: "italic", lineHeight: 1.5 }}>
                "{gap.authenticLanguage[0]}"
              </div>
            </motion.div>
          )}
        </CardBody>
      </Card>
    </motion.div>
  );
}

function BlueprintPanel({ blueprint }: { blueprint: KnowledgeProductBlueprint }) {
  const [copied, setCopied] = useState(false);

  function copyDescription() {
    void navigator.clipboard.writeText(blueprint.etsyDescription).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col gap-4">
      <Card gold>
        <CardBody>
          <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>{blueprint.title}</div>
          <div style={{ fontSize: "0.825rem", color: "var(--text-muted)", marginBottom: 12 }}>{blueprint.subtitle}</div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="gold">${blueprint.price}</Badge>
            <Badge variant="muted">{blueprint.pageCount} pages</Badge>
            <Badge variant="muted">{blueprint.format.replace("_", " ")}</Badge>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <div className="label mb-3">Learning Outcomes</div>
          <div className="flex flex-col gap-2">
            {blueprint.learningOutcomes.map((outcome, i) => (
              <div key={i} className="flex items-start gap-2">
                <CheckCircle size={13} style={{ color: "var(--emerald)", flexShrink: 0, marginTop: 2 }} />
                <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{outcome}</span>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <div className="label mb-3">Content Sections</div>
          <div className="flex flex-col gap-2">
            {blueprint.sections.map((section, i) => (
              <div key={i} style={{ padding: "8px 10px", borderRadius: 6, background: "var(--bg-elevated)", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: "0.6rem", padding: "2px 6px", borderRadius: 10, background: "var(--bg-card)", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{section.type}</span>
                <span style={{ fontSize: "0.8rem", color: "var(--text-primary)" }}>{section.title}</span>
                <span style={{ marginLeft: "auto", fontSize: "0.7rem", color: "var(--text-muted)" }}>{section.estimatedPages}p</span>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <div className="flex items-center justify-between mb-3">
            <div className="label">Etsy Description</div>
            <button
              onClick={copyDescription}
              style={{ fontSize: "0.72rem", color: copied ? "var(--emerald)" : "var(--cyan)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
            >
              {copied ? "✓ Copied" : "Copy →"}
            </button>
          </div>
          <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: 1.6, maxHeight: 160, overflow: "auto" }}>
            {blueprint.etsyDescription}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <div className="label mb-3">Etsy Tags (13)</div>
          <div className="flex flex-wrap gap-1.5">
            {blueprint.tags.map((tag, i) => (
              <Badge key={i} variant="muted">{tag}</Badge>
            ))}
          </div>
        </CardBody>
      </Card>
    </motion.div>
  );
}

function AudienceGapCard({ gap, isTop }: { gap: AudienceGap; isTop: boolean }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
      <Card gold={isTop}>
        <CardBody>
          <div className="flex items-start justify-between gap-3 mb-2">
            <div style={{ flex: 1 }}>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)" }}>{gap.gap}</span>
                {isTop && <Badge variant="gold">Top Pick</Badge>}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{gap.painPoint}</div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--gold)" }}>{gap.opportunityScore}</div>
              <div style={{ fontSize: "0.6rem", color: "var(--text-muted)" }}>score</div>
            </div>
          </div>
          <div style={{ fontSize: "0.78rem", color: "var(--emerald)", fontWeight: 600, marginBottom: 8 }}>→ {gap.desiredTransformation}</div>
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <Badge variant="muted">{gap.idealProductType}</Badge>
            <Badge variant="muted">{gap.priceWillingness}</Badge>
          </div>
          {gap.blockers.length > 0 && (
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: 6 }}>
              <strong style={{ color: "var(--text-secondary)" }}>Blockers:</strong> {gap.blockers.join(" · ")}
            </div>
          )}
          <div className="flex flex-wrap gap-1">
            {gap.searchIntent.slice(0, 4).map((term, i) => (
              <span key={i} style={{ fontSize: "0.65rem", color: "var(--text-muted)", background: "var(--bg-elevated)", padding: "2px 6px", borderRadius: 4 }}>{term}</span>
            ))}
          </div>
        </CardBody>
      </Card>
    </motion.div>
  );
}

function KnowledgePageInner() {
  const [activeTab, setActiveTab] = useState<"gap-scan" | "audience-scan">("gap-scan");
  const { activeNiche, clearActiveNiche } = useActiveNiche();

  // Gap scan state
  const [audience, setAudience] = useState("");
  const [category, setCategory] = useState<KnowledgeCategory>("adulting");
  const [scanning, setScanning] = useState(false);
  const [report, setReport] = useState<CapabilityGapReport | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  const [selectedGap, setSelectedGap] = useState<CapabilityGap | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<ProductFormat>("knowledge_guide");
  const [generating, setGenerating] = useState(false);
  const [blueprint, setBlueprint] = useState<KnowledgeProductBlueprint | null>(null);
  const [genError, setGenError] = useState<string | null>(null);

  // Pre-fill from active niche context
  useEffect(() => {
    if (activeNiche) {
      const audienceStr = `${activeNiche.audience.name}, ${activeNiche.audience.ageRange}, ${activeNiche.audience.lifeStage}`;
      setAudience(audienceStr);
      setAudienceDesc(audienceStr);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Audience scan state
  const [audienceDesc, setAudienceDesc] = useState("");
  const [audScanning, setAudScanning] = useState(false);
  const [audReport, setAudReport] = useState<AudienceGapReport | null>(null);
  const [audError, setAudError] = useState<string | null>(null);

  async function handleAudienceScan() {
    if (!audienceDesc.trim()) return;
    setAudScanning(true);
    setAudError(null);
    setAudReport(null);
    try {
      const res = await apiFetch("/api/knowledge?action=audience-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetAudience: audienceDesc }),
      });
      const json = await res.json() as { success: boolean; data?: AudienceGapReport; error?: string };
      if (!json.success || !json.data) throw new Error(json.error ?? "Scan failed");
      setAudReport(json.data);
    } catch (err) {
      setAudError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setAudScanning(false);
    }
  }

  async function handleScan() {
    if (!audience.trim()) return;
    setScanning(true);
    setScanError(null);
    setReport(null);
    setSelectedGap(null);
    setBlueprint(null);
    try {
      const res = await apiFetch("/api/knowledge?action=scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetAudience: audience, category }),
      });
      const json = await res.json() as { success: boolean; data?: CapabilityGapReport; error?: string };
      if (!json.success || !json.data) throw new Error(json.error ?? "Scan failed");
      setReport(json.data);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  }

  async function handleGenerate() {
    if (!selectedGap) return;
    setGenerating(true);
    setGenError(null);
    setBlueprint(null);
    try {
      const res = await apiFetch("/api/knowledge?action=generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gap: selectedGap, format: selectedFormat }),
      });
      const json = await res.json() as { success: boolean; data?: { blueprint: KnowledgeProductBlueprint; savedId: string }; error?: string };
      if (!json.success || !json.data) throw new Error(json.error ?? "Generation failed");
      setBlueprint(json.data.blueprint);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  const sortedGaps = [...(report?.gaps ?? [])].sort((a, b) => b.opportunityScore - a.opportunityScore);

  return (
    <div style={{ minHeight: "100vh" }}>
      <PageHeader
        icon={BookOpen}
        title="Knowledge Products"
        iconColor="var(--cyan)"
        subtitle="Find capability anxiety gaps and generate shame-reframe how-to guides, workbooks, checklists, and template packs."
      />

      <div style={{ padding: "24px 36px" }}>
        {/* Active niche banner */}
        {activeNiche && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              display: "flex", alignItems: "center", gap: 12, marginBottom: 20,
              padding: "10px 16px", borderRadius: 10,
              background: "var(--blue-bg)", border: "1px solid var(--blue-border)",
            }}
          >
            <Zap size={14} style={{ color: "var(--blue)", flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--blue)", fontWeight: 600 }}>Active Niche · </span>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
                &ldquo;{activeNiche.nicheName}&rdquo; — audience pre-filled below
              </span>
            </div>
            <button onClick={clearActiveNiche} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4, display: "flex", alignItems: "center" }}>
              <X size={13} />
            </button>
          </motion.div>
        )}

        {/* Tab bar */}
        <div className="flex gap-2 mb-6">
          {([
            { id: "gap-scan", label: "Gap Scan", icon: Target },
            { id: "audience-scan", label: "Audience Scan", icon: Users },
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
        {activeTab === "gap-scan" && (
        <motion.div key="gap-scan" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>

        {/* Scanner */}
        <Card style={{ marginBottom: 24 }}>
          <CardBody>
            <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: "1fr 280px" }}>
              <div>
                <div className="label mb-2">Target Audience</div>
                <input
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void handleScan(); }}
                  placeholder="e.g. First-generation college graduates, 22-28, first real job"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, background: "var(--bg-elevated)", border: "1px solid var(--border-default)", color: "var(--text-primary)", fontSize: "0.875rem" }}
                />
              </div>
              <div>
                <div className="label mb-2">Category</div>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as KnowledgeCategory)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, background: "var(--bg-elevated)", border: "1px solid var(--border-default)", color: "var(--text-primary)", fontSize: "0.875rem" }}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <Button variant="gold" icon={<Target size={13} />} onClick={() => void handleScan()} loading={scanning} disabled={!audience.trim()}>
              Scan for Gaps →
            </Button>
            {scanError && (
              <div style={{ marginTop: 10, fontSize: "0.8rem", color: "var(--rose)", display: "flex", alignItems: "center", gap: 6 }}>
                <AlertCircle size={13} />{scanError}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Loading */}
        {scanning && (
          <div className="flex flex-col gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} style={{ height: 100, borderRadius: 10, overflow: "hidden" }}>
                <div className="shimmer" style={{ width: "100%", height: "100%" }} />
              </div>
            ))}
          </div>
        )}

        {/* Results */}
        {report && !scanning && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* Report header */}
            <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <Card>
                <CardBody>
                  <div className="label mb-1">Market Context</div>
                  <div style={{ fontSize: "0.825rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>{report.marketContext}</div>
                </CardBody>
              </Card>
              <Card>
                <CardBody>
                  <div className="label mb-1">Title Strategy</div>
                  <div style={{ fontSize: "0.825rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>{report.titleStrategy}</div>
                </CardBody>
              </Card>
            </div>

            {/* Bundle opportunity */}
            {report.bundleOpportunity && (
              <div style={{ marginBottom: 20, padding: "10px 14px", borderRadius: 8, background: "var(--gold-glow)", border: "1px solid rgba(201,168,76,0.2)", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                <Star size={12} style={{ color: "var(--gold)", display: "inline", marginRight: 6 }} />
                <strong style={{ color: "var(--gold)" }}>Bundle: </strong>{report.bundleOpportunity}
              </div>
            )}

            <div className="grid gap-6" style={{ gridTemplateColumns: "1fr 1fr" }}>
              {/* Gap cards */}
              <div>
                <div className="label mb-3">{sortedGaps.length} Capability Gaps Found</div>
                <div className="flex flex-col gap-3">
                  {sortedGaps.map((gap) => (
                    <GapCard
                      key={gap.id}
                      gap={gap}
                      selected={selectedGap?.id === gap.id}
                      onSelect={() => { setSelectedGap(gap); setBlueprint(null); setGenError(null); }}
                    />
                  ))}
                </div>
              </div>

              {/* Generator panel */}
              <div>
                <AnimatePresence>
                  {selectedGap && !blueprint && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                      <Card style={{ marginBottom: 16 }}>
                        <CardBody>
                          <div className="label mb-2">Generate Product</div>
                          <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>{selectedGap.title}</div>

                          <div className="label mb-2">Format</div>
                          <div className="flex flex-col gap-2 mb-4">
                            {FORMATS.map((f) => (
                              <button
                                key={f.value}
                                onClick={() => setSelectedFormat(f.value)}
                                style={{
                                  padding: "8px 12px",
                                  borderRadius: 8,
                                  fontSize: "0.8rem",
                                  background: selectedFormat === f.value ? "var(--gold-glow)" : "var(--bg-elevated)",
                                  border: `1px solid ${selectedFormat === f.value ? "rgba(201,168,76,0.3)" : "var(--border-subtle)"}`,
                                  color: selectedFormat === f.value ? "var(--gold)" : "var(--text-secondary)",
                                  cursor: "pointer",
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                }}
                              >
                                <span style={{ fontWeight: selectedFormat === f.value ? 600 : 400 }}>{f.label}</span>
                                <span style={{ fontSize: "0.7rem", opacity: 0.7 }}>{f.price}</span>
                              </button>
                            ))}
                          </div>

                          <div className="label mb-2">Sample Titles</div>
                          <div className="flex flex-col gap-1.5 mb-4">
                            {selectedGap.sampleTitles.map((t, i) => (
                              <div key={i} style={{ fontSize: "0.75rem", color: "var(--text-secondary)", padding: "4px 8px", borderRadius: 6, background: "var(--bg-elevated)" }}>{t}</div>
                            ))}
                          </div>

                          <Button variant="gold" icon={<Zap size={13} />} onClick={() => void handleGenerate()} loading={generating} fullWidth>
                            Generate Blueprint →
                          </Button>
                          {genError && (
                            <div style={{ marginTop: 8, fontSize: "0.78rem", color: "var(--rose)", display: "flex", alignItems: "center", gap: 6 }}>
                              <AlertCircle size={12} />{genError}
                            </div>
                          )}
                        </CardBody>
                      </Card>

                      {/* Etsy keywords */}
                      <Card>
                        <CardBody>
                          <div className="label mb-2">Etsy Search Terms</div>
                          <div className="flex flex-wrap gap-1.5">
                            {selectedGap.etsySearchTerms.map((term, i) => (
                              <Badge key={i} variant="muted">{term}</Badge>
                            ))}
                          </div>
                          <div className="mt-3">
                            <div className="label mb-2">Content Outline</div>
                            <div className="flex flex-col gap-1">
                              {selectedGap.contentOutline.map((section, i) => (
                                <div key={i} style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "flex", gap: 6 }}>
                                  <span style={{ color: "var(--cyan)", fontWeight: 700 }}>{i + 1}.</span>
                                  <span>{section}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </CardBody>
                      </Card>
                    </motion.div>
                  )}
                </AnimatePresence>

                {generating && (
                  <div className="flex flex-col gap-3">
                    {[200, 150, 120].map((h, i) => (
                      <div key={i} style={{ height: h, borderRadius: 10, overflow: "hidden" }}>
                        <div className="shimmer" style={{ width: "100%", height: "100%" }} />
                      </div>
                    ))}
                  </div>
                )}

                {blueprint && !generating && <BlueprintPanel blueprint={blueprint} />}

                {!selectedGap && !scanning && (
                  <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", fontSize: "0.825rem" }}>
                    <TrendingUp size={28} style={{ color: "var(--border-default)", marginBottom: 12 }} />
                    <div>Select a capability gap to generate a product blueprint</div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Empty state */}
        {!report && !scanning && !scanError && (
          <div style={{ textAlign: "center", paddingTop: 80 }}>
            <div style={{ width: 72, height: 72, borderRadius: 18, background: "var(--cyan-dim)", border: "1px solid rgba(6,182,212,0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <BookOpen size={32} style={{ color: "var(--cyan)" }} />
            </div>
            <div style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: 8 }}>Scan for Capability Anxiety Gaps</div>
            <div style={{ fontSize: "0.875rem", color: "var(--text-muted)", maxWidth: 440, margin: "0 auto" }}>
              Enter a target audience and category. The engine surfaces specific knowledge gaps with shame scores, Etsy search terms, and ready-to-generate product blueprints.
            </div>
          </div>
        )}

        </motion.div>
        )}

        {activeTab === "audience-scan" && (
        <motion.div key="audience-scan" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <Card style={{ marginBottom: 24 }}>
            <CardBody>
              <div className="label mb-2">Describe Your Audience</div>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
                <input
                  value={audienceDesc}
                  onChange={(e) => setAudienceDesc(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void handleAudienceScan(); }}
                  placeholder="e.g. New dads, 28-40, anxious about being a good parent but won't admit it"
                  style={{ flex: 1, padding: "8px 12px", borderRadius: 8, background: "var(--bg-elevated)", border: "1px solid var(--border-default)", color: "var(--text-primary)", fontSize: "0.875rem" }}
                />
                <Button variant="gold" icon={<Users size={13} />} onClick={() => void handleAudienceScan()} loading={audScanning} disabled={!audienceDesc.trim()}>
                  Scan Audience →
                </Button>
              </div>
              {audError && (
                <div style={{ marginTop: 10, fontSize: "0.8rem", color: "var(--rose)", display: "flex", alignItems: "center", gap: 6 }}>
                  <AlertCircle size={13} />{audError}
                </div>
              )}
            </CardBody>
          </Card>

          {audScanning && (
            <div className="flex flex-col gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} style={{ height: 100, borderRadius: 10, overflow: "hidden" }}>
                  <div className="shimmer" style={{ width: "100%", height: "100%" }} />
                </div>
              ))}
            </div>
          )}

          {audReport && !audScanning && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: "1fr 1fr" }}>
                <Card>
                  <CardBody>
                    <div className="label mb-1">Audience Profile</div>
                    <div style={{ fontSize: "0.825rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>{audReport.audienceProfile}</div>
                  </CardBody>
                </Card>
                <Card>
                  <CardBody>
                    <div className="label mb-1">Core Identity Tension</div>
                    <div style={{ fontSize: "0.825rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>{audReport.coreIdentityTension}</div>
                  </CardBody>
                </Card>
              </div>

              {audReport.bundleIdea && (
                <div style={{ marginBottom: 20, padding: "10px 14px", borderRadius: 8, background: "var(--gold-glow)", border: "1px solid rgba(201,168,76,0.2)", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                  <Star size={12} style={{ color: "var(--gold)", display: "inline", marginRight: 6 }} />
                  <strong style={{ color: "var(--gold)" }}>Bundle Idea: </strong>{audReport.bundleIdea}
                </div>
              )}

              {audReport.audienceLanguage.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div className="label mb-2">Audience Language</div>
                  <div className="flex flex-wrap gap-2">
                    {audReport.audienceLanguage.map((phrase, i) => (
                      <span key={i} style={{ fontSize: "0.75rem", color: "var(--text-secondary)", padding: "4px 10px", borderRadius: 20, background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", fontStyle: "italic" }}>
                        "{phrase}"
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="label mb-3">{audReport.totalGapsFound} Audience Gaps Discovered</div>
              <div className="flex flex-col gap-3">
                {audReport.gaps
                  .sort((a, b) => b.opportunityScore - a.opportunityScore)
                  .map((gap, i) => (
                    <AudienceGapCard
                      key={i}
                      gap={gap}
                      isTop={gap === audReport.topOpportunity || gap.gap === audReport.topOpportunity.gap}
                    />
                  ))}
              </div>
            </motion.div>
          )}

          {!audReport && !audScanning && !audError && (
            <div style={{ textAlign: "center", paddingTop: 80 }}>
              <div style={{ width: 72, height: 72, borderRadius: 18, background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
                <Users size={32} style={{ color: "var(--cyan)" }} />
              </div>
              <div style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: 8 }}>Audience-First Scanning</div>
              <div style={{ fontSize: "0.875rem", color: "var(--text-muted)", maxWidth: 440, margin: "0 auto" }}>
                Start with the person, not the category. Describe your audience and the engine discovers their identity tensions, hidden gaps, and what they&apos;ll buy without being asked.
              </div>
            </div>
          )}
        </motion.div>
        )}

        </AnimatePresence>
      </div>
    </div>
  );
}

export default function KnowledgePage() {
  return (
    <Suspense>
      <KnowledgePageInner />
    </Suspense>
  );
}
