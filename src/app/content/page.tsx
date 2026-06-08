"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Megaphone,
  Zap,
  Copy,
  TrendingUp,
  Eye,
  AlertCircle,
  Video,
  Image as ImageIcon,
  FileText,
  Hash,
  MessageSquare,
  Calendar,
  CheckCircle,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ContentBatch, ContentPiece, ContentPlatform } from "@/lib/ai/content-engine";
import type { BufferProfile } from "@/lib/integrations/buffer";
import { apiFetch } from "@/lib/api";
import { useActiveProduct } from "@/lib/stores/active-product";

const PLATFORM_CONFIG: Record<ContentPlatform, { label: string; color: string; icon: typeof Video }> = {
  tiktok: { label: "TikTok", color: "#ec4899", icon: Video },
  instagram: { label: "Instagram", color: "#8b5cf6", icon: ImageIcon },
  pinterest: { label: "Pinterest", color: "#f43f5e", icon: ImageIcon },
  youtube: { label: "YouTube", color: "#f59e0b", icon: Video },
  twitter: { label: "X / Twitter", color: "#06b6d4", icon: MessageSquare },
};

const FORMAT_ICONS: Record<string, typeof FileText> = {
  hook: Zap,
  script: FileText,
  carousel: ImageIcon,
  caption: MessageSquare,
  quote: MessageSquare,
  thread: Hash,
};

function ContentCard({ piece, index, bufferProfiles }: { piece: ContentPiece; index: number; bufferProfiles: BufferProfile[] }) {
  const [copied, setCopied] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [selectedProfiles, setSelectedProfiles] = useState<string[]>([]);
  const [scheduledAt, setScheduledAt] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const [scheduleResult, setScheduleResult] = useState<string | null>(null);
  const platformConfig = PLATFORM_CONFIG[piece.platform];
  const FormatIcon = FORMAT_ICONS[piece.format] ?? FileText;

  function copy() {
    navigator.clipboard.writeText(`${piece.hook}\n\n${piece.body}\n\n${piece.callToAction}\n\n${piece.hashtags.map(h => `#${h}`).join(" ")}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function toggleProfile(id: string) {
    setSelectedProfiles((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  async function schedulePost() {
    if (!selectedProfiles.length) return;
    setScheduling(true);
    setScheduleResult(null);
    try {
      const text = `${piece.hook}\n\n${piece.body}\n\n${piece.callToAction}\n\n${piece.hashtags.slice(0, 8).map(h => `#${h}`).join(" ")}`;
      const res = await apiFetch("/api/content/schedule?action=schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileIds: selectedProfiles, text, scheduledAt: scheduledAt || undefined }),
      });
      const json = await res.json() as { success: boolean; error?: string };
      if (!json.success) throw new Error(json.error ?? "Schedule failed");
      setScheduleResult(scheduledAt ? "Scheduled!" : "Posted now!");
      setTimeout(() => { setScheduleOpen(false); setScheduleResult(null); }, 2000);
    } catch (err) {
      setScheduleResult(err instanceof Error ? err.message : "Failed");
    } finally {
      setScheduling(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.07 }}
    >
      <Card hover>
        <CardBody>
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: `${platformConfig.color}18`,
                  border: `1px solid ${platformConfig.color}30`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <platformConfig.icon size={13} style={{ color: platformConfig.color }} />
              </div>
              <span style={{ fontSize: "0.8rem", fontWeight: 600, color: platformConfig.color }}>
                {platformConfig.label}
              </span>
              <Badge variant="muted">{piece.format}</Badge>
            </div>
            <div className="flex items-center gap-3">
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Virality</div>
                <div style={{ fontSize: "0.875rem", fontWeight: 700, color: piece.virality >= 75 ? "var(--emerald)" : piece.virality >= 50 ? "var(--amber)" : "var(--text-secondary)" }}>
                  {piece.virality}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={copy} icon={<Copy size={12} />}>
                {copied ? "Copied!" : "Copy"}
              </Button>
              {bufferProfiles.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setScheduleOpen((v) => !v)} icon={<Calendar size={12} />}>
                  Schedule
                </Button>
              )}
            </div>
          </div>

          {/* Hook */}
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-subtle)",
              marginBottom: 10,
            }}
          >
            <div className="label mb-1">Hook</div>
            <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.4 }}>
              {piece.hook}
            </div>
          </div>

          {/* Body */}
          <div style={{ fontSize: "0.84rem", color: "var(--text-secondary)", lineHeight: 1.65, marginBottom: 10, whiteSpace: "pre-line" }}>
            {piece.body.length > 400 ? piece.body.slice(0, 400) + "..." : piece.body}
          </div>

          {/* CTA */}
          <div
            style={{
              fontSize: "0.82rem",
              color: "var(--gold)",
              fontWeight: 600,
              marginBottom: 10,
            }}
          >
            → {piece.callToAction}
          </div>

          {/* Hashtags */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {piece.hashtags.slice(0, 8).map((tag, i) => (
              <Badge key={i} variant="default">#{tag}</Badge>
            ))}
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4" style={{ paddingTop: 10, borderTop: "1px solid var(--border-subtle)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <Eye size={12} style={{ color: "var(--text-muted)" }} />
              <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{piece.estimatedViews} est. views</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <TrendingUp size={12} style={{ color: "var(--text-muted)" }} />
              <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{piece.conversionPotential}% conversion</span>
            </div>
            <div style={{ marginLeft: "auto", fontSize: "0.75rem", color: "var(--text-muted)" }}>
              {piece.emotionalTrigger}
            </div>
          </div>

          {/* Buffer schedule panel */}
          <AnimatePresence>
            {scheduleOpen && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} style={{ overflow: "hidden" }}>
                <div style={{ paddingTop: 12, borderTop: "1px solid var(--border-subtle)", marginTop: 10 }}>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: 8, fontWeight: 600 }}>BUFFER PROFILES</div>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {bufferProfiles.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => toggleProfile(p.id)}
                        style={{
                          padding: "4px 10px",
                          borderRadius: 20,
                          fontSize: "0.72rem",
                          fontWeight: 600,
                          background: selectedProfiles.includes(p.id) ? "var(--gold-glow)" : "var(--bg-elevated)",
                          border: `1px solid ${selectedProfiles.includes(p.id) ? "rgba(201,168,76,0.3)" : "var(--border-subtle)"}`,
                          color: selectedProfiles.includes(p.id) ? "var(--gold)" : "var(--text-secondary)",
                          cursor: "pointer",
                        }}
                      >
                        {p.service} · {p.service_username}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="datetime-local"
                      value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                      style={{ flex: 1, padding: "6px 10px", borderRadius: 8, background: "var(--bg-elevated)", border: "1px solid var(--border-default)", color: "var(--text-primary)", fontSize: "0.75rem" }}
                    />
                    <Button
                      variant="gold"
                      size="sm"
                      loading={scheduling}
                      icon={scheduleResult === "Scheduled!" || scheduleResult === "Posted now!" ? <CheckCircle size={12} /> : <Calendar size={12} />}
                      onClick={() => void schedulePost()}
                    >
                      {scheduleResult ?? (scheduledAt ? "Schedule" : "Post Now")}
                    </Button>
                  </div>
                  {scheduleResult && !["Scheduled!", "Posted now!"].includes(scheduleResult) && (
                    <div style={{ fontSize: "0.72rem", color: "var(--rose)", marginTop: 6 }}>{scheduleResult}</div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardBody>
      </Card>
    </motion.div>
  );
}

export default function ContentPage() {
  const [loading, setLoading] = useState(false);
  const [batch, setBatch] = useState<ContentBatch | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [productTitle, setProductTitle] = useState("The Unbroken Man — A 90-Day Discipline Journal");
  const [emotionalTheme, setEmotionalTheme] = useState("Masculine identity reconstruction and discipline building after a period of loss or stagnation");
  const [selectedPlatforms, setSelectedPlatforms] = useState<ContentPlatform[]>(["tiktok", "instagram"]);
  const [pieceCount, setPieceCount] = useState(6);
  const [bufferProfiles, setBufferProfiles] = useState<BufferProfile[]>([]);
  const { activeProduct } = useActiveProduct();

  useEffect(() => {
    if (activeProduct) {
      setProductTitle(activeProduct.title);
      setEmotionalTheme(`${activeProduct.transformationPromise}. Target: ${activeProduct.targetAudience}.`);
    }
  }, [activeProduct]);

  useEffect(() => {
    apiFetch("/api/content/schedule?action=profiles")
      .then((r) => r.json() as Promise<{ success: boolean; data?: BufferProfile[] }>)
      .then((j) => { if (j.success && j.data) setBufferProfiles(j.data); })
      .catch(() => null);
  }, []);

  const platforms: ContentPlatform[] = ["tiktok", "instagram", "pinterest", "youtube", "twitter"];

  function togglePlatform(p: ContentPlatform) {
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  }

  async function generate() {
    if (!selectedPlatforms.length) return;
    setLoading(true);
    setError(null);
    setBatch(null);
    try {
      const res = await apiFetch("/api/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productTitle, emotionalTheme, targetPlatforms: selectedPlatforms, pieceCount }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setBatch(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate content");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh" }}>
      <PageHeader
        icon={Megaphone}
        title="Content Engine"
        iconColor="var(--rose)"
        subtitle="Generate emotionally resonant TikTok scripts, Instagram carousels, Pinterest content, and viral hooks that build audience and drive sales."
        actions={
          <Button variant="gold" icon={<Zap size={14} />} loading={loading} onClick={generate}>
            {loading ? "Generating..." : "Generate Content"}
          </Button>
        }
      />

      <div style={{ padding: "24px 36px" }}>
        {/* Config */}
        <Card style={{ marginBottom: 24 }}>
          <CardBody>
            <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <div>
                <div className="label mb-2">Product / Campaign</div>
                <input
                  value={productTitle}
                  onChange={(e) => setProductTitle(e.target.value)}
                  placeholder="e.g. The Unbroken Man — A 90-Day Discipline Journal"
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 8,
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border-default)",
                    color: "var(--text-primary)",
                    fontSize: "0.875rem",
                  }}
                />
              </div>
              <div>
                <div className="label mb-2">Emotional Theme</div>
                <input
                  value={emotionalTheme}
                  onChange={(e) => setEmotionalTheme(e.target.value)}
                  placeholder="Describe the emotional core of this campaign..."
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 8,
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border-default)",
                    color: "var(--text-primary)",
                    fontSize: "0.875rem",
                  }}
                />
              </div>
              <div>
                <div className="label mb-2">Target Platforms</div>
                <div className="flex gap-2 flex-wrap">
                  {platforms.map((p) => {
                    const config = PLATFORM_CONFIG[p];
                    const active = selectedPlatforms.includes(p);
                    return (
                      <button
                        key={p}
                        onClick={() => togglePlatform(p)}
                        style={{
                          padding: "5px 12px",
                          borderRadius: 20,
                          fontSize: "0.75rem",
                          fontWeight: active ? 600 : 400,
                          background: active ? `${config.color}18` : "var(--bg-elevated)",
                          border: `1px solid ${active ? `${config.color}40` : "var(--border-subtle)"}`,
                          color: active ? config.color : "var(--text-secondary)",
                          cursor: "pointer",
                          transition: "all 0.15s",
                        }}
                      >
                        {config.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <div className="label mb-2">Content Pieces</div>
                <div className="flex items-center gap-3">
                  <select
                    value={pieceCount}
                    onChange={(e) => setPieceCount(Number(e.target.value))}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--border-default)",
                      color: "var(--text-primary)",
                      fontSize: "0.875rem",
                    }}
                  >
                    {[3, 4, 6, 8, 10, 12].map((n) => (
                      <option key={n} value={n}>{n} pieces</option>
                    ))}
                  </select>
                  <Button variant="gold" onClick={generate} loading={loading} icon={<Zap size={13} />}>
                    {loading ? "Generating..." : "Generate"}
                  </Button>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        {error && (
          <div style={{ marginBottom: 20, padding: "12px 16px", borderRadius: 10, background: "var(--rose-dim)", border: "1px solid rgba(244,63,94,0.2)", display: "flex", alignItems: "center", gap: 8 }}>
            <AlertCircle size={14} style={{ color: "var(--rose)" }} />
            <div style={{ fontSize: "0.875rem", color: "var(--rose)" }}>{error}</div>
          </div>
        )}

        {loading && (
          <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ height: 280, borderRadius: 12, overflow: "hidden" }}>
                <div className="shimmer" style={{ width: "100%", height: "100%" }} />
              </div>
            ))}
          </div>
        )}

        {!batch && !loading && !error && (
          <div className="flex flex-col items-center justify-center text-center" style={{ paddingTop: 80 }}>
            <div style={{ width: 72, height: 72, borderRadius: 18, background: "var(--rose-dim)", border: "1px solid rgba(244,63,94,0.2)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
              <Megaphone size={32} style={{ color: "var(--rose)" }} />
            </div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 600, letterSpacing: "-0.02em", marginBottom: 8 }}>
              Generate Viral Content
            </h2>
            <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", maxWidth: 480, lineHeight: 1.6, marginBottom: 24 }}>
              Create emotionally resonant content for TikTok, Instagram, and more — hooks that stop the scroll, narratives that create identification, CTAs that convert.
            </p>
            <Button variant="gold" onClick={generate} loading={loading} icon={<Zap size={14} />} size="lg">
              Generate Content Batch
            </Button>
          </div>
        )}

        {batch && !loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* Campaign Header */}
            <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
              <Card gold>
                <CardBody>
                  <div className="label mb-1">Campaign Theme</div>
                  <div style={{ fontSize: "0.875rem", color: "var(--text-primary)", fontWeight: 600 }}>
                    {batch.campaignTheme}
                  </div>
                </CardBody>
              </Card>
              <Card style={{ gridColumn: "span 2" }}>
                <CardBody>
                  <div className="label mb-1">Audience Insight</div>
                  <div style={{ fontSize: "0.875rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                    {batch.audienceInsight}
                  </div>
                </CardBody>
              </Card>
            </div>

            {/* Content Grid */}
            <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
              {batch.pieces.map((piece, i) => (
                <ContentCard key={piece.id} piece={piece} index={i} bufferProfiles={bufferProfiles} />
              ))}
            </div>

            {/* Content Calendar */}
            {batch.contentCalendar.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <div className="label mb-3">30-Day Content Calendar</div>
                <Card>
                  <CardBody>
                    <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
                      {batch.contentCalendar.slice(0, 20).map((item, i) => {
                        const config = PLATFORM_CONFIG[item.platform as ContentPlatform];
                        return (
                          <div
                            key={i}
                            style={{
                              padding: "8px 10px",
                              borderRadius: 6,
                              background: "var(--bg-elevated)",
                              border: "1px solid var(--border-subtle)",
                            }}
                          >
                            <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginBottom: 3 }}>
                              Day {item.day}
                            </div>
                            <div style={{ fontSize: "0.7rem", color: config?.color ?? "var(--text-secondary)", fontWeight: 600, marginBottom: 2 }}>
                              {config?.label ?? item.platform}
                            </div>
                            <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", lineHeight: 1.3 }}>
                              {item.focus}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardBody>
                </Card>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
