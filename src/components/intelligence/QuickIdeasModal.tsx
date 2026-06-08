"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, X, ArrowRight } from "lucide-react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import type { QuickIdea } from "@/lib/ai/quick-ideas-engine";

interface Props {
  onClose: () => void;
}

export function QuickIdeasModal({ onClose }: Props) {
  const [query, setQuery] = useState("");
  const [ideas, setIdeas] = useState<QuickIdea[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function generateIdeas() {
    if (!query.trim() || loading) return;
    setLoading(true);
    setError(null);
    setIdeas([]);
    try {
      const res = await apiFetch(`/api/intelligence?action=quick-ideas&q=${encodeURIComponent(query)}`);
      const json = await res.json() as { success: boolean; data?: QuickIdea[]; error?: string };
      if (!json.success || !json.data) throw new Error(json.error ?? "Failed");
      setIdeas(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate ideas");
    } finally {
      setLoading(false);
    }
  }

  const scoreColor = (s: number) => s >= 80 ? "var(--emerald)" : s >= 60 ? "var(--amber)" : "var(--text-muted)";

  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
      >
        <motion.div
          key="modal"
          initial={{ opacity: 0, scale: 0.95, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.18 }}
          onClick={(e) => e.stopPropagation()}
          style={{ background: "var(--bg-surface)", borderRadius: "var(--radius-xl)", border: "1px solid var(--border-light)", boxShadow: "var(--shadow-lg)", width: "100%", maxWidth: 540, maxHeight: "80vh", display: "flex", flexDirection: "column" }}
        >
          {/* Header */}
          <div style={{ padding: "1.25rem 1.5rem 1rem", borderBottom: "1px solid var(--border-light)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Zap size={16} style={{ color: "var(--amber)" }} />
              <span style={{ fontSize: "var(--text-base)", fontWeight: 600, color: "var(--text-primary)" }}>Quick Product Ideas</span>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex" }}><X size={16} /></button>
          </div>

          {/* Input */}
          <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid var(--border-light)", flexShrink: 0 }}>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input
                ref={inputRef}
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void generateIdeas(); }}
                placeholder="anxiety journal for teens, homeowner planner..."
                style={{ flex: 1, padding: "0.5rem 0.75rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-medium)", background: "var(--bg-page)", color: "var(--text-primary)", fontSize: "var(--text-sm)" }}
              />
              <button
                onClick={() => void generateIdeas()}
                disabled={loading || !query.trim()}
                style={{ padding: "0.5rem 1rem", borderRadius: "var(--radius-md)", background: "var(--text-primary)", color: "white", border: "none", cursor: loading ? "not-allowed" : "pointer", fontSize: "var(--text-sm)", fontWeight: 600, opacity: loading ? 0.7 : 1, whiteSpace: "nowrap" }}
              >
                {loading ? "Generating…" : "Generate 10 Ideas →"}
              </button>
            </div>
            {error && <div style={{ fontSize: "var(--text-xs)", color: "var(--rose)", marginTop: "0.375rem" }}>{error}</div>}
          </div>

          {/* Results */}
          <div style={{ overflowY: "auto", flex: 1 }}>
            {loading && (
              <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>
                Thinking of 10 product ideas…
              </div>
            )}
            {ideas.map((idea, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                style={{ padding: "0.875rem 1.5rem", borderBottom: i < ideas.length - 1 ? "1px solid var(--border-light)" : "none", display: "flex", alignItems: "flex-start", gap: "0.75rem" }}
              >
                <div style={{ width: 36, height: 36, borderRadius: "var(--radius-sm)", background: "var(--bg-subtle)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: scoreColor(idea.score) }}>{idea.score}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--text-primary)", marginBottom: "0.125rem" }}>{idea.title}</div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginBottom: "0.25rem" }}>{idea.tagline}</div>
                  <div style={{ display: "flex", gap: "0.375rem" }}>
                    <span style={{ fontSize: "0.65rem", padding: "0.125rem 0.375rem", background: "var(--bg-subtle)", border: "1px solid var(--border-light)", borderRadius: 10, color: "var(--text-muted)" }}>{idea.format.replace(/_/g, " ")}</span>
                    <span style={{ fontSize: "0.65rem", padding: "0.125rem 0.375rem", background: "var(--emerald-bg)", border: "1px solid var(--emerald-border)", borderRadius: 10, color: "var(--emerald)", fontWeight: 600 }}>{idea.price}</span>
                  </div>
                </div>
                <Link href={`/products?idea=${encodeURIComponent(idea.title)}`} onClick={onClose}>
                  <button style={{ padding: "0.3125rem 0.625rem", borderRadius: "var(--radius-sm)", background: "none", border: "1px solid var(--border-medium)", cursor: "pointer", fontSize: "0.65rem", fontWeight: 600, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "0.25rem", whiteSpace: "nowrap" }}>
                    Generate <ArrowRight size={9} />
                  </button>
                </Link>
              </motion.div>
            ))}
            {!loading && ideas.length === 0 && query && (
              <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>Enter a topic and click Generate to brainstorm ideas.</div>
            )}
            {!loading && ideas.length === 0 && !query && (
              <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>Type a topic above to get 10 product ideas instantly.</div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
