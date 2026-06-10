"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { signOut, useSession } from "next-auth/react";
import {
  Zap, Brain, Crosshair, Radio, Package, BookOpen,
  Gamepad2, FileText, PieChart, Send, Settings,
  Building2, ChevronDown, ChevronUp, Check, Inbox, LogOut, BarChart2,
} from "lucide-react";
import { loadScanFromCache } from "@/lib/cache/intelligence-cache";
import { PipelineProgress } from "@/components/layout/PipelineProgress";
import { apiFetch } from "@/lib/api";

// ── Build Product sub-items ────────────────────────────────────────────────────
const BUILD_ITEMS = [
  { href: "/products",  label: "Journals & Workbooks", icon: Package  },
  { href: "/knowledge", label: "Knowledge Guides",     icon: BookOpen },
  { href: "/games",     label: "Party Games",          icon: Gamepad2 },
] as const;

const BUILD_ROUTES = ["/build", "/products", "/knowledge", "/games"] as const;

// ── Secondary tools (collapsible — Knowledge + Games moved to Build step) ─────
const TOOLS = [
  { href: "/market-intelligence", label: "Market Intel",   icon: BarChart2 },
  { href: "/niche-research",      label: "Niche Research", icon: Crosshair },
  { href: "/signals",             label: "Signal Bank",    icon: Radio     },
  { href: "/brands",              label: "Brand Builder",  icon: Building2 },
  { href: "/content",             label: "Content",        icon: FileText  },
  { href: "/portfolio",           label: "Portfolio",      icon: PieChart  },
  { href: "/settings",            label: "Settings",       icon: Settings  },
] as const;

const LS_KEY = "ao:sidebar:toolsExpanded";

export function Sidebar() {
  const pathname = usePathname();
  const [toolsExpanded, setToolsExpanded] = useState(false);
  const [step1Done, setStep1Done] = useState(false);
  const [pendingCards, setPendingCards] = useState(0);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved !== null) setToolsExpanded(saved === "true");
    } catch {}
  }, []);

  useEffect(() => {
    setStep1Done(loadScanFromCache() !== null);
  }, []);

  useEffect(() => {
    let stale = false;
    async function fetchPending() {
      try {
        const res = await apiFetch("/api/launch-queue?action=today");
        if (stale || !res.ok) return;
        const json = await res.json() as { success: boolean; data: { cards: Array<{ status: string }> } | null };
        if (json.success && json.data) {
          setPendingCards(json.data.cards.filter((c) => c.status === "pending").length);
        }
      } catch { /* ignore */ }
    }
    void fetchPending();
    return () => { stale = true; };
  }, []);

  function toggleTools() {
    setToolsExpanded((v) => {
      try { localStorage.setItem(LS_KEY, String(!v)); } catch {}
      return !v;
    });
  }

  const isInBuild = BUILD_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"));
  const activeBuildItem = BUILD_ITEMS.find((b) => pathname === b.href || pathname.startsWith(b.href + "/"));
  const isStep1Active = pathname === "/intelligence" || pathname.startsWith("/intelligence/");
  const isStep3Active = pathname === "/publishing" || pathname.startsWith("/publishing/");
  const isLaunchQueueActive = pathname === "/launch-queue" || pathname.startsWith("/launch-queue/");

  return (
    <aside
      style={{
        width: "var(--sidebar-width)",
        minWidth: "var(--sidebar-width)",
        height: "100vh",
        background: "var(--sidebar-bg)",
        borderRight: "1px solid var(--sidebar-border)",
        display: "flex",
        flexDirection: "column",
        position: "sticky",
        top: 0,
        overflowY: "auto",
        overflowX: "hidden",
        flexShrink: 0,
      }}
    >
      {/* ── Logo ── */}
      <div style={{ padding: "1.25rem 1rem 1rem", borderBottom: "1px solid var(--border-light)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
          <div style={{ width: 32, height: 32, background: "var(--text-primary)", borderRadius: "var(--radius-md)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Zap size={16} color="white" />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--text-primary)", lineHeight: 1.2 }}>Alpha & Omega</div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: 2 }}>Publishing OS</div>
          </div>
        </div>
      </div>

      <PipelineProgress />

      <nav style={{ flex: 1, padding: "0.75rem 0.5rem", overflowY: "auto" }}>

        {/* ── Pipeline section ── */}
        <div style={{ marginBottom: "1.5rem" }}>
          <div style={{ fontSize: "var(--text-xs)", fontWeight: 500, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", padding: "0 0.5rem", marginBottom: "0.375rem" }}>
            Your Pipeline
          </div>

          {/* Launch Queue — daily agent results */}
          <Link href="/launch-queue" style={{ textDecoration: "none", display: "block" }}>
            <motion.div
              whileHover={isLaunchQueueActive ? undefined : { backgroundColor: "var(--bg-hover)" }}
              transition={{ duration: 0.1 }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.625rem",
                padding: "0.5rem 0.5rem",
                borderRadius: "var(--radius-md)",
                backgroundColor: isLaunchQueueActive ? "var(--bg-active)" : "transparent",
                borderLeft: isLaunchQueueActive ? "2px solid var(--emerald)" : "2px solid transparent",
                cursor: "pointer",
                marginBottom: 2,
                paddingLeft: isLaunchQueueActive ? "calc(0.5rem - 2px)" : "0.5rem",
              }}
            >
              <Inbox size={14} style={{ color: isLaunchQueueActive ? "var(--text-primary)" : pendingCards > 0 ? "var(--emerald)" : "var(--text-secondary)", flexShrink: 0 }} />
              <span style={{ fontSize: "var(--text-sm)", fontWeight: isLaunchQueueActive ? 600 : 400, color: isLaunchQueueActive ? "var(--text-primary)" : "var(--text-secondary)", flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                Launch Queue
              </span>
              {pendingCards > 0 && (
                <span style={{ fontSize: "0.6rem", fontWeight: 700, background: "var(--emerald)", color: "white", borderRadius: "10px", padding: "1px 5px", flexShrink: 0 }}>
                  {pendingCards}
                </span>
              )}
            </motion.div>
          </Link>

          {/* Step 1 — Scan Market */}
          <Link href="/intelligence" style={{ textDecoration: "none", display: "block" }}>
            <motion.div
              whileHover={isStep1Active ? undefined : { backgroundColor: "var(--bg-hover)" }}
              transition={{ duration: 0.1 }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.625rem",
                padding: "0.5rem 0.5rem",
                borderRadius: "var(--radius-md)",
                backgroundColor: isStep1Active ? "var(--bg-active)" : "transparent",
                borderLeft: isStep1Active ? "2px solid var(--emerald)" : "2px solid transparent",
                cursor: "pointer",
                marginBottom: 2,
                paddingLeft: isStep1Active ? "calc(0.5rem - 2px)" : "0.5rem",
              }}
            >
              <StepBadge step={1} isDone={step1Done} isActive={isStep1Active} />
              <Brain size={14} style={{ color: isStep1Active ? "var(--text-primary)" : "var(--text-secondary)", flexShrink: 0 }} />
              <span style={{ fontSize: "var(--text-sm)", fontWeight: isStep1Active ? 600 : 400, color: isStep1Active ? "var(--text-primary)" : "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                Scan Market
              </span>
            </motion.div>
          </Link>

          {/* Step 2 — Build Product (expandable) */}
          <div style={{ marginBottom: 2 }}>
            <Link href="/build" style={{ textDecoration: "none", display: "block" }}>
              <motion.div
                whileHover={isInBuild ? undefined : { backgroundColor: "var(--bg-hover)" }}
                transition={{ duration: 0.1 }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.625rem",
                  padding: "0.5rem 0.5rem",
                  borderRadius: "var(--radius-md)",
                  backgroundColor: isInBuild ? "var(--bg-active)" : "transparent",
                  borderLeft: isInBuild ? "2px solid var(--emerald)" : "2px solid transparent",
                  cursor: "pointer",
                  paddingLeft: isInBuild ? "calc(0.5rem - 2px)" : "0.5rem",
                }}
              >
                <StepBadge step={2} isDone={false} isActive={isInBuild} />
                <Package size={14} style={{ color: isInBuild ? "var(--text-primary)" : "var(--text-secondary)", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: "var(--text-sm)", fontWeight: isInBuild ? 600 : 400, color: isInBuild ? "var(--text-primary)" : "var(--text-secondary)" }}>
                    Build Product
                  </span>
                  {activeBuildItem && !isInBuild && (
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginLeft: "0.25rem" }}>
                      · {activeBuildItem.label}
                    </span>
                  )}
                </div>
              </motion.div>
            </Link>

            {/* Sub-items — always visible when in any build route */}
            <AnimatePresence initial={false}>
              {isInBuild && (
                <motion.div
                  key="build-items"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  style={{ overflow: "hidden" }}
                >
                  <div style={{ position: "relative", marginLeft: "0.875rem", paddingLeft: "0.875rem", borderLeft: "1px solid var(--border-light)" }}>
                    {BUILD_ITEMS.map(({ href, label, icon: Icon }) => {
                      const isSubActive = pathname === href || pathname.startsWith(href + "/");
                      return (
                        <Link key={href} href={href} style={{ textDecoration: "none", display: "block" }}>
                          <motion.div
                            whileHover={isSubActive ? undefined : { backgroundColor: "var(--bg-hover)" }}
                            transition={{ duration: 0.1 }}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "0.5rem",
                              padding: "0.3125rem 0.5rem",
                              borderRadius: "var(--radius-md)",
                              backgroundColor: isSubActive ? "var(--bg-active)" : "transparent",
                              borderLeft: isSubActive ? "2px solid var(--emerald)" : "2px solid transparent",
                              cursor: "pointer",
                              marginBottom: 1,
                              paddingLeft: isSubActive ? "calc(0.5rem - 2px)" : "0.5rem",
                            }}
                          >
                            <Icon size={12} style={{ color: isSubActive ? "var(--emerald)" : "var(--text-muted)", flexShrink: 0 }} />
                            <span style={{ fontSize: "var(--text-xs)", fontWeight: isSubActive ? 600 : 400, color: isSubActive ? "var(--text-primary)" : "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {label}
                            </span>
                          </motion.div>
                        </Link>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Step 3 — Publish */}
          <Link href="/publishing" style={{ textDecoration: "none", display: "block" }}>
            <motion.div
              whileHover={isStep3Active ? undefined : { backgroundColor: "var(--bg-hover)" }}
              transition={{ duration: 0.1 }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.625rem",
                padding: "0.5rem 0.5rem",
                borderRadius: "var(--radius-md)",
                backgroundColor: isStep3Active ? "var(--bg-active)" : "transparent",
                borderLeft: isStep3Active ? "2px solid var(--emerald)" : "2px solid transparent",
                cursor: "pointer",
                marginBottom: 2,
                paddingLeft: isStep3Active ? "calc(0.5rem - 2px)" : "0.5rem",
              }}
            >
              <StepBadge step={3} isDone={false} isActive={isStep3Active} />
              <Send size={14} style={{ color: isStep3Active ? "var(--text-primary)" : "var(--text-secondary)", flexShrink: 0 }} />
              <span style={{ fontSize: "var(--text-sm)", fontWeight: isStep3Active ? 600 : 400, color: isStep3Active ? "var(--text-primary)" : "var(--text-secondary)" }}>
                Publish
              </span>
            </motion.div>
          </Link>
        </div>

        {/* ── Tools section (collapsible) ── */}
        <div>
          <button
            onClick={toggleTools}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 0.5rem",
              marginBottom: "0.25rem",
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
          >
            <span style={{ fontSize: "var(--text-xs)", fontWeight: 500, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Tools
            </span>
            {toolsExpanded
              ? <ChevronUp size={12} style={{ color: "var(--text-muted)" }} />
              : <ChevronDown size={12} style={{ color: "var(--text-muted)" }} />}
          </button>

          <AnimatePresence initial={false}>
            {toolsExpanded && (
              <motion.div
                key="tools"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{ overflow: "hidden" }}
              >
                {TOOLS.map(({ href, label, icon: Icon }) => {
                  const isActive = pathname === href || pathname.startsWith(href);
                  return (
                    <Link key={href} href={href} style={{ textDecoration: "none", display: "block" }}>
                      <motion.div
                        whileHover={isActive ? undefined : { backgroundColor: "var(--bg-hover)" }}
                        transition={{ duration: 0.1 }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          padding: "0.375rem 0.5rem",
                          borderRadius: "var(--radius-md)",
                          backgroundColor: isActive ? "var(--bg-active)" : "transparent",
                          cursor: "pointer",
                          marginBottom: 1,
                        }}
                      >
                        <Icon size={14} style={{ color: isActive ? "var(--text-primary)" : "var(--text-muted)", flexShrink: 0 }} />
                        <span style={{ fontSize: "var(--text-xs)", fontWeight: isActive ? 500 : 400, color: isActive ? "var(--text-primary)" : "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {label}
                        </span>
                      </motion.div>
                    </Link>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>

          {!toolsExpanded && (
            <button
              onClick={toggleTools}
              style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: "0.25rem 0.5rem", width: "100%", textAlign: "left" }}
            >
              More tools ↓
            </button>
          )}
        </div>
      </nav>

      {/* ── Footer ── */}
      <div style={{ padding: "0.75rem 1rem", borderTop: "1px solid var(--border-light)", flexShrink: 0 }}>
        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>Monthly Revenue</div>
        <div style={{ fontSize: "var(--text-xl)", fontWeight: 600, color: "var(--text-primary)", marginTop: "0.125rem" }}>$0</div>
        <AccountFooter />
      </div>
    </aside>
  );
}

function AccountFooter() {
  const { data: session } = useSession();
  if (!session?.user) return null;
  return (
    <div style={{ marginTop: "0.625rem", paddingTop: "0.625rem", borderTop: "1px solid var(--border-light)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 120 }}>
        {session.user.email}
      </span>
      <button
        onClick={() => void signOut({ callbackUrl: "/login" })}
        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4, fontSize: "0.65rem", flexShrink: 0 }}
        title="Sign out"
      >
        <LogOut size={11} /> Sign out
      </button>
    </div>
  );
}

function StepBadge({ step, isDone, isActive }: { step: number; isDone: boolean; isActive: boolean }) {
  return (
    <div style={{
      width: 20,
      height: 20,
      borderRadius: "50%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
      background: isDone ? "var(--emerald)" : isActive ? "var(--text-primary)" : "var(--bg-subtle)",
      border: `1px solid ${isDone ? "var(--emerald)" : isActive ? "var(--text-primary)" : "var(--border-medium)"}`,
    }}>
      {isDone
        ? <Check size={11} color="white" />
        : <span style={{ fontSize: "0.6rem", fontWeight: 700, color: isActive ? "white" : "var(--text-muted)" }}>{step}</span>}
    </div>
  );
}
