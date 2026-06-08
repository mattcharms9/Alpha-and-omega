"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Target, RefreshCw, ChevronDown, ChevronUp, ArrowRight, Zap } from "lucide-react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import type { TodaysPriority } from "@/lib/ai/priority-engine";

export function TodaysPriorityEngine() {
  const [priority, setPriority] = useState<TodaysPriority | null>(null);
  const [loading, setLoading] = useState(true);
  const [showReasoning, setShowReasoning] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  async function load(force = false) {
    if (force) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await apiFetch(`/api/empire?action=priority${force ? "&refresh=1" : ""}`);
      const json = await res.json() as { success: boolean; data?: TodaysPriority };
      if (json.success && json.data) setPriority(json.data);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }

  useEffect(() => { void load(); }, []);

  const buildUrl = priority
    ? `/products?concept=${encodeURIComponent(priority.productConcept)}&audience=${encodeURIComponent(priority.targetAudience)}`
    : "/products";

  const confidenceColor = priority?.confidenceLevel === "high"
    ? "var(--emerald)" : priority?.confidenceLevel === "medium"
    ? "var(--amber)" : "var(--text-muted)";

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-light)",
        borderRadius: "var(--radius-lg)",
        padding: "1.25rem 1.5rem",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Target size={15} style={{ color: "var(--emerald)" }} />
          <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>TODAY&apos;S PLAY</span>
          {priority?.confidenceLevel && (
            <span style={{ fontSize: "0.65rem", fontWeight: 600, color: confidenceColor, background: `${confidenceColor}15`, padding: "0.125rem 0.4375rem", borderRadius: 10, border: `1px solid ${confidenceColor}25` }}>
              {priority.confidenceLevel} confidence
            </span>
          )}
        </div>
        <button
          onClick={() => void load(true)}
          disabled={refreshing}
          style={{ background: "none", border: "none", cursor: refreshing ? "not-allowed" : "pointer", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "var(--text-xs)", opacity: refreshing ? 0.6 : 1 }}
        >
          <RefreshCw size={12} style={{ animation: refreshing ? "spin 1s linear infinite" : "none" }} />
          Refresh
        </button>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {loading && !priority ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {[85, 60, 40].map((w, i) => (
              <div key={i} style={{ height: "0.875rem", borderRadius: "var(--radius-sm)", background: "var(--bg-subtle)", animation: "shimmer 1.5s ease-in-out infinite", width: `${w}%`, marginBottom: "0.5rem" }} />
            ))}
          </motion.div>
        ) : priority ? (
          <motion.div key="content" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
            {/* Concept */}
            <div style={{ fontSize: "var(--text-xl)", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: "0.375rem" }}>
              {priority.productConcept}
            </div>
            <div style={{ display: "flex", gap: "0.75rem", marginBottom: "0.875rem", flexWrap: "wrap" }}>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                Format: <strong style={{ color: "var(--text-secondary)" }}>{priority.format}</strong>
              </span>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                Price: <strong style={{ color: "var(--text-secondary)" }}>${priority.suggestedPrice}</strong>
              </span>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                Keyword: <strong style={{ color: "var(--text-secondary)" }}>{priority.primaryKeyword}</strong>
              </span>
            </div>

            {/* Why badge */}
            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: "0.875rem", padding: "0.5rem 0.75rem", background: "var(--bg-subtle)", borderRadius: "var(--radius-md)", borderLeft: "2px solid var(--emerald)" }}>
              {priority.basedOn.performancePatterns && <Zap size={10} style={{ color: "var(--amber)", marginRight: 4, display: "inline" }} />}
              {priority.basedOn.performancePatterns ? "Based on your proven catalog patterns · " : ""}
              Expected: <strong>${priority.expectedRevenueRange.min}–${priority.expectedRevenueRange.max}</strong> first 30 days
            </div>

            {/* Reasoning toggle */}
            <button
              onClick={() => setShowReasoning((v) => !v)}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: "var(--text-xs)", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.25rem", marginBottom: "0.875rem" }}
            >
              {showReasoning ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              {showReasoning ? "Hide" : "Show"} reasoning
            </button>

            <AnimatePresence>
              {showReasoning && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  style={{ overflow: "hidden" }}
                >
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: "0.875rem", fontStyle: "italic" }}>
                    {priority.reasoning}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* CTA */}
            <Link href={buildUrl}>
              <button style={{ display: "flex", alignItems: "center", gap: "0.375rem", padding: "0.5rem 1.125rem", borderRadius: "var(--radius-md)", background: "var(--text-primary)", color: "white", border: "none", cursor: "pointer", fontSize: "var(--text-sm)", fontWeight: 600 }}>
                Build This Now <ArrowRight size={13} />
              </button>
            </Link>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}
