"use client";

import { useState, useEffect } from "react";
import { Check } from "lucide-react";
import { loadScanFromCache } from "@/lib/cache/intelligence-cache";
import { apiFetch } from "@/lib/api";

interface StepState {
  done: boolean;
  loading: boolean;
}

const STEPS = ["Scan", "Build", "Publish"] as const;

export function PipelineProgress() {
  const [steps, setSteps] = useState<StepState[]>([
    { done: false, loading: false },
    { done: false, loading: true },
    { done: false, loading: true },
  ]);

  useEffect(() => {
    // Step 1: localStorage (instant)
    const scanDone = loadScanFromCache() !== null;

    // Steps 2+3: check product counts
    void apiFetch("/api/products?limit=1&status=draft")
      .then((r) => r.json())
      .then((d: { success: boolean; data?: unknown[] }) => ({
        hasDraft: d.success && Array.isArray(d.data) && d.data.length > 0,
      }))
      .catch(() => ({ hasDraft: false }))
      .then(({ hasDraft }) =>
        apiFetch("/api/products?limit=1&status=published")
          .then((r) => r.json())
          .then((d: { success: boolean; data?: unknown[] }) => ({
            hasDraft,
            hasPublished: d.success && Array.isArray(d.data) && d.data.length > 0,
          }))
          .catch(() => ({ hasDraft, hasPublished: false }))
      )
      .then(({ hasDraft, hasPublished }) => {
        setSteps([
          { done: scanDone,     loading: false },
          { done: hasDraft,     loading: false },
          { done: hasPublished, loading: false },
        ]);
      });
  }, []);

  const currentStep = steps.findIndex((s) => !s.done);
  const allDone = currentStep === -1;
  const displayStep = allDone ? 3 : currentStep;

  return (
    <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid var(--border-light)" }}>
      {/* Dot track */}
      <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: "0.375rem" }}>
        {STEPS.map((_, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : "initial" }}>
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                background:
                  steps[i].done
                    ? "var(--emerald)"
                    : i === displayStep
                    ? "var(--text-primary)"
                    : "var(--bg-subtle)",
                border: `2px solid ${steps[i].done ? "var(--emerald)" : i === displayStep ? "var(--text-primary)" : "var(--border-medium)"}`,
                transition: "all 0.2s",
              }}
            >
              {steps[i].done && <Check size={10} color="white" />}
            </div>
            {i < STEPS.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: 2,
                  background: steps[i].done ? "var(--emerald)" : "var(--border-light)",
                  transition: "background 0.2s",
                }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Labels */}
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        {STEPS.map((label, i) => (
          <span
            key={label}
            style={{
              fontSize: "0.6rem",
              fontWeight: i === displayStep ? 600 : 400,
              color: steps[i].done ? "var(--emerald)" : i === displayStep ? "var(--text-primary)" : "var(--text-muted)",
            }}
          >
            {label}
          </span>
        ))}
      </div>

      {/* Current step label */}
      {!allDone && (
        <div style={{ fontSize: "0.6rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
          Step {displayStep + 1} of 3
        </div>
      )}
    </div>
  );
}
