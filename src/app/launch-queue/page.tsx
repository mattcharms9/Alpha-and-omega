"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, XCircle, ChevronDown, ChevronUp, RefreshCw, AlertTriangle, Clock, Zap } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AgentReasoning {
  scout: string;
  validator: string;
  generator: string;
  competition: string;
  scorer: string;
  manager: string;
}

interface LaunchCard {
  id: string;
  position: number;
  productTitle: string;
  productFormat: string;
  targetAudience: string;
  emotionalHook: string;
  primaryKeyword: string;
  suggestedPrice: number;
  etsyListingCount: number;
  etsyAvgPrice: number;
  competitionLevel: string;
  trendingScore: number;
  opportunityScore: number;
  confidenceLevel: string;
  whyNow: string;
  whyYou: string;
  expectedRevenue: string;
  agentReasoning: AgentReasoning;
  status: string;
  buildStatus: string;
  failureReason: string | null;
  etsyListingId: string | null;
  publishedAt: string | null;
  buildCompleteness: number;
  stagesFailed: Array<{ stage: string; reason: string }> | null;
}

interface DailyQueue {
  id: string;
  date: string;
  status: string;
  cards: LaunchCard[];
  agentRunLog: Record<string, unknown> | null;
}

// ── Build stage display ────────────────────────────────────────────────────────

const BUILD_STAGES = ["blueprint", "pdf", "cover_image", "seo_optimize", "mockups", "etsy_draft", "publish"] as const;

const STAGE_LABELS: Record<string, string> = {
  blueprint: "Blueprint generated",
  pdf: "PDF created",
  cover_image: "Cover image generated",
  seo_optimize: "SEO optimized",
  mockups: "Mockups generated",
  etsy_draft: "Etsy draft created",
  publish: "Published to Etsy",
};

function stageIndex(buildStatus: string): number {
  const map: Record<string, number> = {
    queued: -1, building: 0, built: 4, publishing: 5, published: 7, failed: -2,
  };
  return map[buildStatus] ?? -1;
}

// ── Confidence badge ───────────────────────────────────────────────────────────

function ConfidenceBadge({ level }: { level: string }) {
  const cfg: Record<string, { color: string; label: string }> = {
    high: { color: "var(--emerald)", label: "HIGH CONFIDENCE" },
    medium: { color: "var(--amber, #f59e0b)", label: "MEDIUM CONFIDENCE" },
    low: { color: "var(--text-muted)", label: "LOW CONFIDENCE" },
  };
  const c = cfg[level] ?? cfg.medium!;
  return (
    <span style={{ fontSize: "0.625rem", fontWeight: 700, color: c.color, letterSpacing: "0.08em", textTransform: "uppercase" }}>
      {c.label}
    </span>
  );
}

function CompetitionDot({ level }: { level: string }) {
  const colors: Record<string, string> = { low: "var(--emerald)", medium: "#f59e0b", high: "#ef4444", saturated: "#6b7280" };
  return <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: colors[level] ?? "#6b7280", marginRight: 4, verticalAlign: "middle" }} />;
}

// ── Build progress widget ──────────────────────────────────────────────────────

function CompletenessIndicator({ card }: { card: LaunchCard }) {
  if (card.buildStatus !== "published" && card.buildStatus !== "built") return null;
  const pct = card.buildCompleteness;
  if (pct >= 100) return null;
  const color = pct >= 75 ? "#f59e0b" : "#ef4444";
  const label = pct >= 75 ? "Published with warnings" : "Incomplete listing";
  const failedList = card.stagesFailed ?? [];
  return (
    <div style={{ marginTop: 6, padding: "6px 10px", background: pct >= 75 ? "#fffbeb" : "#fef2f2", border: `1px solid ${color}40`, borderRadius: "var(--radius-md)", fontSize: "0.68rem" }}>
      <div style={{ fontWeight: 600, color }}>{label} — {pct}% complete</div>
      {failedList.map((f) => (
        <div key={f.stage} style={{ color: "var(--text-muted)", marginTop: 2 }}>• {f.stage}: {f.reason}</div>
      ))}
    </div>
  );
}

function BuildProgress({ card }: { card: LaunchCard }) {
  const idx = stageIndex(card.buildStatus);
  const failed = card.buildStatus === "failed";

  return (
    <div style={{ marginTop: 12, padding: "10px 12px", background: "var(--bg-subtle)", borderRadius: "var(--radius-md)", fontSize: "0.7rem" }}>
      <div style={{ fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>
        {failed ? "⚠️ Build failed" : card.buildStatus === "published" ? "✅ Live on Etsy" : "⟳ Building..."}
      </div>
      {BUILD_STAGES.map((stage, i) => {
        const done = !failed && i < idx;
        const active = !failed && i === idx;
        const pending = i > idx && !failed;
        return (
          <div key={stage} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3, color: done ? "var(--emerald)" : active ? "var(--text-primary)" : pending ? "var(--text-muted)" : "var(--text-muted)", opacity: pending ? 0.5 : 1 }}>
            <span>{done ? "✅" : active ? "⟳" : "○"}</span>
            <span>{STAGE_LABELS[stage]}</span>
          </div>
        );
      })}
      {failed && card.failureReason && (
        <div style={{ marginTop: 6, color: "#ef4444", fontSize: "0.65rem", wordBreak: "break-word" }}>{card.failureReason}</div>
      )}
    </div>
  );
}

// ── Individual LaunchCard ──────────────────────────────────────────────────────

function LaunchCardView({
  card,
  onApprove,
  onSkip,
  onRetry,
}: {
  card: LaunchCard;
  onApprove: (id: string) => void;
  onSkip: (id: string) => void;
  onRetry: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isApproved = card.status === "approved";
  const isSkipped = card.status === "skipped";
  const decided = isApproved || isSkipped;
  const building = isApproved && card.buildStatus !== "queued";
  const published = card.buildStatus === "published";
  const failed = card.buildStatus === "failed";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: "var(--bg-card, #111)",
        border: `1px solid ${published ? "var(--emerald)" : failed ? "#ef4444" : isSkipped ? "var(--border-light)" : "var(--border-medium)"}`,
        borderRadius: "var(--radius-lg)",
        padding: "1rem",
        opacity: isSkipped ? 0.5 : 1,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--text-muted)" }}>#{card.position}</span>
          <ConfidenceBadge level={card.confidenceLevel} />
        </div>
        <div style={{ fontSize: "0.75rem", fontWeight: 700, color: card.opportunityScore >= 80 ? "var(--emerald)" : card.opportunityScore >= 60 ? "#f59e0b" : "var(--text-muted)" }}>
          {card.opportunityScore}/100
        </div>
      </div>

      {/* Title */}
      <h3 style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)", margin: "0 0 4px 0", lineHeight: 1.4 }}>
        {card.productTitle}
      </h3>

      {/* Format + market */}
      <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: 8 }}>
        {card.productFormat} · ${card.suggestedPrice.toFixed(2)} · ↑ "{card.primaryKeyword}" · {card.etsyListingCount.toLocaleString()} listings ·{" "}
        <CompetitionDot level={card.competitionLevel} />
        {card.competitionLevel} comp
      </div>

      {/* Why now / why you */}
      <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", marginBottom: 4, lineHeight: 1.5 }}>
        <span style={{ fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", fontSize: "0.6rem", letterSpacing: "0.06em" }}>WHY NOW</span>{" "}
        {card.whyNow}
      </div>
      <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", marginBottom: 4, lineHeight: 1.5 }}>
        <span style={{ fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", fontSize: "0.6rem", letterSpacing: "0.06em" }}>WHY YOU</span>{" "}
        {card.whyYou}
      </div>
      <div style={{ fontSize: "0.7rem", color: "var(--emerald)", fontWeight: 500, marginBottom: 10 }}>
        Expected: {card.expectedRevenue}
      </div>

      {/* Expand reasoning */}
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", fontSize: "0.7rem", color: "var(--text-muted)", padding: 0, marginBottom: 10 }}
      >
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        {expanded ? "Hide reasoning" : "See full reasoning"}
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ padding: "8px 10px", background: "var(--bg-subtle)", borderRadius: "var(--radius-md)", marginBottom: 10 }}>
              {[
                ["🔍 Market Scout", card.agentReasoning.scout],
                ["✓  Niche Validator", card.agentReasoning.validator],
                ["💡 Concept Gen", card.agentReasoning.generator],
                ["🏆 Competition", card.agentReasoning.competition],
                ["⭐ Scorer", card.agentReasoning.scorer],
                ["👔 Manager", card.agentReasoning.manager],
              ].map(([label, text]) => (
                <div key={label} style={{ marginBottom: 6, fontSize: "0.68rem", lineHeight: 1.5 }}>
                  <span style={{ fontWeight: 600, color: "var(--text-secondary)" }}>{label}:</span>{" "}
                  <span style={{ color: "var(--text-muted)" }}>{text}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Build progress if approved */}
      {building && <BuildProgress card={card} />}
      {(card.buildStatus === "published" || card.buildStatus === "built") && <CompletenessIndicator card={card} />}

      {/* Action buttons */}
      {!decided && (
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <button
            onClick={() => onApprove(card.id)}
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              background: "var(--emerald)", color: "white", border: "none", borderRadius: "var(--radius-md)",
              padding: "0.5rem", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer",
            }}
          >
            <CheckCircle size={13} /> APPROVE
          </button>
          <button
            onClick={() => onSkip(card.id)}
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              background: "var(--bg-subtle)", color: "var(--text-muted)", border: "1px solid var(--border-light)",
              borderRadius: "var(--radius-md)", padding: "0.5rem", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer",
            }}
          >
            <XCircle size={13} /> SKIP
          </button>
        </div>
      )}

      {isApproved && !building && (
        <div style={{ textAlign: "center", fontSize: "0.7rem", color: "var(--emerald)", fontWeight: 600, marginTop: 4 }}>
          ✓ Approved — build queued
        </div>
      )}

      {isSkipped && (
        <div style={{ textAlign: "center", fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 4 }}>
          Skipped
        </div>
      )}

      {failed && (
        <button
          onClick={() => onRetry(card.id)}
          style={{ width: "100%", marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "var(--bg-subtle)", color: "#f59e0b", border: "1px solid #f59e0b40", borderRadius: "var(--radius-md)", padding: "0.5rem", fontSize: "0.7rem", fontWeight: 600, cursor: "pointer" }}
        >
          <RefreshCw size={12} /> Retry Build
        </button>
      )}
    </motion.div>
  );
}

// ── Stats bar ──────────────────────────────────────────────────────────────────

function StatsBar({ cards }: { cards: LaunchCard[] }) {
  const approved = cards.filter((c) => c.status === "approved").length;
  const building = cards.filter((c) => c.status === "approved" && c.buildStatus === "building").length;
  const published = cards.filter((c) => c.buildStatus === "published").length;
  const pending = cards.filter((c) => c.status === "pending").length;

  return (
    <div style={{ display: "flex", gap: 24, padding: "10px 0", borderTop: "1px solid var(--border-light)", marginTop: 32, fontSize: "0.75rem", color: "var(--text-muted)" }}>
      <span><strong style={{ color: "var(--emerald)" }}>{approved}</strong> approved</span>
      <span><strong style={{ color: "#f59e0b" }}>{building}</strong> building</span>
      <span><strong style={{ color: "var(--text-primary)" }}>{published}</strong> published</span>
      <span><strong style={{ color: "var(--text-secondary)" }}>{pending}</strong> pending</span>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function LaunchQueuePage() {
  const [queue, setQueue] = useState<DailyQueue | null>(null);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadQueue = useCallback(async () => {
    try {
      const res = await fetch("/api/launch-queue?action=today");
      const json = await res.json() as { success: boolean; data: DailyQueue | null };
      if (json.success) setQueue(json.data);
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadQueue(); }, [loadQueue]);

  // Handle email deep-link redirect params
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const success = params.get("success");
    const error = params.get("error");
    if (success === "approved") setToastMsg({ type: "success", text: "✅ Approved! Build pipeline started." });
    else if (success === "skipped") setToastMsg({ type: "success", text: "Skipped." });
    else if (error === "invalid_token") setToastMsg({ type: "error", text: "This link has expired. Open the app to approve." });
    else if (error === "already_decided") setToastMsg({ type: "error", text: "This card was already decided." });
    if (success || error) {
      const url = new URL(window.location.href);
      url.searchParams.delete("success");
      url.searchParams.delete("error");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  // Poll build status for building cards
  useEffect(() => {
    if (!queue) return;
    const building = queue.cards.filter(
      (c) => c.status === "approved" && c.buildStatus !== "published" && c.buildStatus !== "failed" && c.buildStatus !== "queued"
    );
    if (building.length === 0) return;

    const interval = setInterval(async () => {
      try {
        const updates = await Promise.all(
          building.map((c) =>
            fetch(`/api/launch-queue?action=build-status&id=${c.id}`)
              .then((r) => r.json() as Promise<{ success: boolean; data: Partial<LaunchCard> }>)
          )
        );
        setQueue((prev) => {
          if (!prev) return prev;
          const updated = prev.cards.map((card) => {
            const u = updates.find((r) => r.success && r.data.id === card.id);
            return u ? { ...card, ...u.data } : card;
          });
          return { ...prev, cards: updated };
        });
      } catch { /* ignore */ }
    }, 3000);

    return () => clearInterval(interval);
  }, [queue]);

  async function decide(cardId: string, decision: "approved" | "skipped") {
    // Optimistic update
    setQueue((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        cards: prev.cards.map((c) =>
          c.id === cardId ? { ...c, status: decision, buildStatus: decision === "approved" ? "building" : c.buildStatus } : c
        ),
      };
    });
    await fetch("/api/launch-queue?action=decide", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId, decision }),
    });
  }

  async function retryBuild(cardId: string) {
    setQueue((prev) => {
      if (!prev) return prev;
      return { ...prev, cards: prev.cards.map((c) => c.id === cardId ? { ...c, buildStatus: "building", failureReason: null } : c) };
    });
    await fetch("/api/launch-queue?action=retry-build", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId }),
    });
  }

  async function approveAllHighConfidence() {
    const targets = queue?.cards.filter((c) => c.status === "pending" && c.confidenceLevel === "high" && c.opportunityScore >= 75) ?? [];
    for (const card of targets) {
      await decide(card.id, "approved");
    }
  }

  async function triggerRun() {
    setTriggering(true);
    await fetch("/api/launch-queue?action=trigger-run", { method: "POST" });
    await new Promise((r) => setTimeout(r, 2000));
    await loadQueue();
    setTriggering(false);
  }

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const pendingCount = queue?.cards.filter((c) => c.status === "pending").length ?? 0;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "2rem 1.5rem" }}>
      {/* Toast */}
      {toastMsg && (
        <div style={{ marginBottom: 16, padding: "0.625rem 1rem", background: toastMsg.type === "success" ? "var(--bg-subtle)" : "#fef2f2", border: `1px solid ${toastMsg.type === "success" ? "var(--border-light)" : "#fecaca"}`, borderRadius: "var(--radius-md)", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.8rem", color: toastMsg.type === "success" ? "var(--text-secondary)" : "#dc2626" }}>
          <span>{toastMsg.text}</span>
          <button onClick={() => setToastMsg(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "1rem" }}>×</button>
        </div>
      )}
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, color: "var(--text-primary)", margin: "0 0 4px 0" }}>
            Today&apos;s Launch Queue
          </h1>
          <div style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
            {today}{queue && queue.cards.length > 0 ? ` · ${queue.cards.length} opportunities ready` : ""}
          </div>
        </div>
        {pendingCount > 0 && (
          <button
            onClick={() => void approveAllHighConfidence()}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--emerald)", color: "white", border: "none", borderRadius: "var(--radius-md)", padding: "0.5rem 1rem", fontSize: "0.8rem", fontWeight: 700, cursor: "pointer" }}
          >
            <Zap size={13} /> Approve All High-Confidence
          </button>
        )}
      </div>

      {/* Cold-start banner */}
      {queue?.agentRunLog && (queue.agentRunLog as Record<string, unknown>).isColdStart === true && (
        <div style={{ padding: "0.625rem 1rem", background: "var(--bg-subtle)", border: "1px solid var(--border-light)", borderRadius: "var(--radius-md)", marginBottom: 16, fontSize: "0.75rem", color: "var(--text-secondary)" }}>
          ℹ️ First run — using category defaults. Your queue will personalize after your first products are live.
        </div>
      )}

      {/* Manager note */}
      {queue?.agentRunLog && typeof queue.agentRunLog === "object" && "managerNote" in (queue.agentRunLog as Record<string, unknown>) && (
        <div style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-light)", borderRadius: "var(--radius-lg)", padding: "12px 16px", marginBottom: 24, fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
          <span style={{ fontWeight: 600, color: "var(--text-muted)", fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>Manager&apos;s Note</span>
          <div style={{ marginTop: 4, fontStyle: "italic" }}>
            "{String((queue.agentRunLog as Record<string, unknown>).managerNote ?? "")}"
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div style={{ textAlign: "center", padding: "4rem", color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>
          <Clock size={24} style={{ marginBottom: 8, opacity: 0.4 }} />
          <div>Loading today&apos;s queue...</div>
        </div>
      )}

      {/* Empty state */}
      {!loading && (!queue || queue.cards.length === 0) && (
        <div style={{ textAlign: "center", padding: "4rem", color: "var(--text-muted)" }}>
          <AlertTriangle size={28} style={{ marginBottom: 12, opacity: 0.4 }} />
          <div style={{ fontSize: "var(--text-sm)", fontWeight: 500, marginBottom: 8 }}>No queue for today</div>
          <div style={{ fontSize: "0.75rem", marginBottom: 20 }}>The agents run nightly at 2am UTC. You can trigger a manual run below.</div>
          <button
            onClick={() => void triggerRun()}
            disabled={triggering}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--bg-subtle)", color: "var(--text-secondary)", border: "1px solid var(--border-medium)", borderRadius: "var(--radius-md)", padding: "0.5rem 1.25rem", fontSize: "0.8rem", fontWeight: 600, cursor: triggering ? "not-allowed" : "pointer", opacity: triggering ? 0.6 : 1 }}
          >
            <RefreshCw size={13} className={triggering ? "animate-spin" : ""} />
            {triggering ? "Running agents..." : "Trigger Agent Run"}
          </button>
        </div>
      )}

      {/* Card grid */}
      {queue && queue.cards.length > 0 && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
            {queue.cards.map((card) => (
              <LaunchCardView
                key={card.id}
                card={card}
                onApprove={(id) => void decide(id, "approved")}
                onSkip={(id) => void decide(id, "skipped")}
                onRetry={(id) => void retryBuild(id)}
              />
            ))}
          </div>

          <StatsBar cards={queue.cards} />
        </>
      )}
    </div>
  );
}
