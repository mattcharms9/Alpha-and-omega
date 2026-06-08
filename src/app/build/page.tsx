"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Package, BookOpen, Gamepad2, Zap, X } from "lucide-react";
import { useActiveNiche } from "@/lib/stores/active-niche";

const PRODUCT_TYPES = [
  {
    href: "/products",
    icon: Package,
    color: "var(--violet)",
    title: "Journals & Workbooks",
    description: "Planners, journals, workbooks, and diaries",
    examples: "Anxiety journal · Budget planner · Gratitude workbook",
    priceRange: "$7–19",
  },
  {
    href: "/knowledge",
    icon: BookOpen,
    color: "var(--blue)",
    title: "Knowledge Guides",
    description: "How-to guides, checklists, and capability gap products",
    examples: "New homeowner guide · Tax checklist · Career templates",
    priceRange: "$4–12",
  },
  {
    href: "/games",
    icon: Gamepad2,
    color: "var(--emerald)",
    title: "Party Games",
    description: "Bingo cards, trivia sheets, squares grids, game sheets",
    examples: "Super Bowl squares · Baby shower bingo · Wedding trivia",
    priceRange: "$3–9",
  },
  {
    href: "/products?quickBatch=true",
    icon: Zap,
    color: "var(--amber)",
    title: "Quick Batch (AI Picks)",
    description: "Let AI choose the best product mix for your active niche",
    examples: "5 products generated in parallel · Best format for your niche",
    priceRange: "Mixed",
  },
] as const;

export default function BuildPage() {
  const { activeNiche, clearActiveNiche } = useActiveNiche();
  const router = useRouter();

  // If no active niche and came from intelligence, the banner won't show — that's fine
  useEffect(() => {
    // Prefetch build routes for faster navigation
    router.prefetch("/products");
    router.prefetch("/knowledge");
    router.prefetch("/games");
  }, [router]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-page)" }}>
      {/* Header */}
      <div style={{ padding: "1.5rem 2rem", borderBottom: "1px solid var(--border-light)", background: "var(--bg-surface)" }}>
        <h1 style={{ fontSize: "var(--text-xl)", fontWeight: 600, color: "var(--text-primary)", margin: 0, letterSpacing: "-0.02em" }}>
          Build Product
        </h1>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", margin: "0.25rem 0 0" }}>
          Choose what type of digital product to create
        </p>
      </div>

      <div style={{ padding: "1.5rem 2rem" }}>
        {/* Active niche banner */}
        {activeNiche && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0.75rem 1rem",
              borderRadius: "var(--radius-lg)",
              background: "var(--violet-bg)",
              border: "1px solid var(--violet-border)",
              marginBottom: "1.5rem",
              gap: "0.75rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
              <Zap size={14} style={{ color: "var(--violet)", flexShrink: 0 }} />
              <span style={{ fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--violet)" }}>
                Active context:
              </span>
              <span style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)", fontWeight: 600 }}>
                &ldquo;{activeNiche.nicheName}&rdquo;
              </span>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                · Score {activeNiche.opportunityScore.toFixed(0)}
              </span>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
                Each product type below is pre-filled with this niche.
              </span>
            </div>
            <button
              onClick={clearActiveNiche}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 2, flexShrink: 0 }}
            >
              <X size={14} />
            </button>
          </motion.div>
        )}

        {/* Product type cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 360px), 1fr))", gap: "1rem" }}>
          {PRODUCT_TYPES.map(({ href, icon: Icon, color, title, description, examples, priceRange }, i) => (
            <motion.div
              key={href}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.07 }}
            >
              <Link href={href} style={{ textDecoration: "none" }}>
                <motion.div
                  whileHover={{ y: -2, boxShadow: "var(--shadow-md)" }}
                  transition={{ duration: 0.15 }}
                  style={{
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-light)",
                    borderRadius: "var(--radius-xl)",
                    padding: "1.5rem",
                    cursor: "pointer",
                    boxShadow: "var(--shadow-xs)",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    gap: "1rem",
                  }}
                >
                  {/* Icon */}
                  <div style={{
                    width: 48,
                    height: 48,
                    borderRadius: "var(--radius-lg)",
                    background: `${color}18`,
                    border: `1px solid ${color}30`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}>
                    <Icon size={22} style={{ color }} />
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "var(--text-lg)", fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.375rem", letterSpacing: "-0.01em" }}>
                      {title}
                    </div>
                    <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: "0.625rem" }}>
                      {description}
                    </div>
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", lineHeight: 1.4 }}>
                      {examples}
                    </div>
                  </div>

                  {/* Footer */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, color, background: `${color}15`, padding: "0.1875rem 0.5rem", borderRadius: 20, border: `1px solid ${color}25` }}>
                      {priceRange}
                    </span>
                    <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color, display: "flex", alignItems: "center", gap: "0.25rem" }}>
                      Launch →
                    </span>
                  </div>
                </motion.div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
