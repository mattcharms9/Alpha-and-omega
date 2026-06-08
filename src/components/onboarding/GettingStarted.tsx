"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { CheckCircle, Circle, ArrowRight, Zap } from "lucide-react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import type { OnboardingState } from "@/app/api/onboarding/route";

const STEPS = [
  {
    label: "Run your first intelligence scan",
    href: "/intelligence",
    cta: "Scan Market →",
    key: "step1Done" as const,
  },
  {
    label: "Generate your first product",
    href: "/products",
    cta: "Build Product →",
    key: "step2Done" as const,
  },
  {
    label: "Connect your Etsy shop",
    href: "/publishing",
    cta: "Connect →",
    key: "step3Done" as const,
  },
  {
    label: "Publish your first product to Etsy",
    href: "/publishing",
    cta: "Publish →",
    key: "step4Done" as const,
  },
  {
    label: "Make your first sale",
    href: "/portfolio",
    cta: "View Portfolio →",
    key: "step5Done" as const,
  },
] as const;

export function GettingStarted() {
  const [state, setState] = useState<OnboardingState | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      const d = localStorage.getItem("ao:onboarding:dismissed");
      if (d && Date.now() - Number(d) < 86400000) { setDismissed(true); return; }
    } catch {}

    void apiFetch("/api/onboarding")
      .then((r) => r.json() as Promise<{ success: boolean; data?: OnboardingState }>)
      .then((j) => { if (j.success && j.data) setState(j.data); })
      .catch(() => null);
  }, []);

  if (dismissed || !state) return null;

  // If all done and completed more than 24h ago, don't show
  if (state.allDone) {
    const completedMs = state.completedAt ? Date.now() - new Date(state.completedAt).getTime() : 0;
    if (completedMs > 86400000) return null;
  }

  const completed = STEPS.filter((s) => state[s.key]).length;
  const nextStep = STEPS.find((s) => !state[s.key]);
  const estimatedMins = (STEPS.length - completed) * 6;

  function dismiss() {
    try { localStorage.setItem("ao:onboarding:dismissed", String(Date.now())); } catch {}
    setDismissed(true);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-light)",
        borderRadius: "var(--radius-lg)",
        padding: "1.25rem 1.5rem",
        boxShadow: "var(--shadow-xs)",
        marginBottom: "1.5rem",
      }}
    >
      {state.allDone ? (
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--emerald-bg)", border: "1px solid var(--emerald-border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Zap size={16} style={{ color: "var(--emerald)" }} />
          </div>
          <div>
            <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--emerald)" }}>First sale achieved!</div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>You&apos;ve completed your first sale. Time to scale.</div>
          </div>
          <button onClick={dismiss} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>Dismiss</button>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
            <div>
              <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>Getting Started — Your First Sale in 5 Steps</div>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: "0.125rem" }}>
                {completed} of 5 complete{!state.step5Done && ` · Est. ${estimatedMins} min to first sale`}
              </div>
            </div>
            <button onClick={dismiss} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>Dismiss</button>
          </div>

          {/* Progress bar */}
          <div style={{ height: 4, borderRadius: 2, background: "var(--bg-subtle)", marginBottom: "1rem", overflow: "hidden" }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(completed / 5) * 100}%` }}
              transition={{ duration: 0.5 }}
              style={{ height: "100%", background: "var(--emerald)", borderRadius: 2 }}
            />
          </div>

          {/* Steps */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {STEPS.map((step) => {
              const done = state[step.key];
              const isNext = step === nextStep;
              return (
                <div key={step.key} style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                  {done
                    ? <CheckCircle size={16} style={{ color: "var(--emerald)", flexShrink: 0 }} />
                    : <Circle size={16} style={{ color: isNext ? "var(--text-secondary)" : "var(--text-disabled)", flexShrink: 0 }} />
                  }
                  <span style={{ flex: 1, fontSize: "var(--text-sm)", color: done ? "var(--text-muted)" : isNext ? "var(--text-primary)" : "var(--text-muted)", textDecoration: done ? "line-through" : "none" }}>
                    {step.label}
                  </span>
                  {isNext && (
                    <Link href={step.href}>
                      <button style={{ padding: "0.25rem 0.625rem", borderRadius: "var(--radius-md)", background: "var(--text-primary)", color: "white", border: "none", cursor: "pointer", fontSize: "var(--text-xs)", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.25rem", whiteSpace: "nowrap" }}>
                        {step.cta} <ArrowRight size={10} />
                      </button>
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </motion.div>
  );
}
