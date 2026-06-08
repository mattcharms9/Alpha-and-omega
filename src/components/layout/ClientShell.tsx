"use client";

import { useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import { Sidebar } from "@/components/layout/Sidebar";
import { SidebarContext } from "@/components/layout/sidebar-context";
import { CommandPalette } from "@/components/layout/CommandPalette";
import PushSetup from "@/components/layout/PushSetup";
import { QuickScanShortcut } from "@/components/layout/QuickScanShortcut";

// ── Client shell — wraps app with mobile drawer support ───────────────────────

export function ClientShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  usePathname(); // re-renders on navigation — auto-closes drawer on route change
  const closeMobile = useCallback(() => setMobileOpen(false), []);

  return (
    <SidebarContext.Provider value={{ closeMobile }}>
      {/* Desktop sidebar (hidden on mobile) */}
      <div className="sidebar-desktop">
        <Sidebar />
      </div>

      {/* Mobile backdrop + drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={closeMobile}
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.35)",
                zIndex: 40,
              }}
            />
            <motion.div
              key="drawer"
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              style={{
                position: "fixed",
                left: 0,
                top: 0,
                bottom: 0,
                width: 280,
                zIndex: 50,
                overflow: "hidden",
              }}
            >
              <Sidebar />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <main style={{ flex: 1, minWidth: 0, overflowX: "hidden", overflowY: "auto" }}>
        {/* Mobile header with hamburger */}
        <div className="mobile-header" style={{
          display: "none",
          alignItems: "center",
          gap: "0.75rem",
          padding: "0.75rem 1rem",
          borderBottom: "1px solid var(--border-light)",
          background: "var(--bg-surface)",
          position: "sticky",
          top: 0,
          zIndex: 30,
        }}>
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 36, height: 36,
              background: "none", border: "1px solid var(--border-medium)",
              borderRadius: "var(--radius-md)", cursor: "pointer",
            }}
          >
            <Menu size={18} style={{ color: "var(--text-secondary)" }} />
          </button>
          <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>Alpha & Omega</span>
          {mobileOpen && (
            <button onClick={closeMobile} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer" }}>
              <X size={18} style={{ color: "var(--text-secondary)" }} />
            </button>
          )}
        </div>

        {children}
      </main>

      <CommandPalette />
      <PushSetup />
      <QuickScanShortcut />

      {/* Global mobile styles */}
      <style>{`
        @media (max-width: 768px) {
          .sidebar-desktop { display: none !important; }
          .mobile-header { display: flex !important; }
        }
        @media (min-width: 769px) {
          .mobile-header { display: none !important; }
        }
      `}</style>
    </SidebarContext.Provider>
  );
}
