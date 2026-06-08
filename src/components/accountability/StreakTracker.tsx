"use client";

import { useEffect, useState } from "react";
import { Flame, Target, TrendingUp } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface DailyStatus {
  date: string;
  posted: number;
  target: number;
  remaining: number;
  targetMet: boolean;
  currentStreak: number;
  longestStreak: number;
}

export default function StreakTracker() {
  const [status, setStatus] = useState<DailyStatus | null>(null);

  useEffect(() => {
    apiFetch("/api/accountability?action=status")
      .then((r) => r.json())
      .then((data) => {
        if (data.status) setStatus(data.status);
      })
      .catch(console.error);
  }, []);

  if (!status) return null;

  const pct = Math.min(100, Math.round((status.posted / status.target) * 100));

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 16,
      padding: "10px 16px",
      borderRadius: 10,
      background: status.targetMet
        ? "rgba(34,197,94,0.07)"
        : "rgba(201,168,76,0.06)",
      border: `1px solid ${status.targetMet ? "rgba(34,197,94,0.2)" : "rgba(201,168,76,0.15)"}`,
      marginBottom: 20,
    }}>
      {/* Streak */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        <Flame size={15} style={{ color: status.currentStreak > 0 ? "var(--amber)" : "var(--text-muted)" }} />
        <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--text-primary)" }}>
          {status.currentStreak}
        </span>
        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>day streak</span>
      </div>

      <div style={{ width: 1, height: 20, background: "var(--border-subtle)", flexShrink: 0 }} />

      {/* Progress bar */}
      <div style={{ flex: 1, minWidth: 120 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <Target size={11} style={{ color: "var(--text-muted)" }} />
            <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
              {status.posted}/{status.target} today
            </span>
          </div>
          <span style={{ fontSize: "0.72rem", color: status.targetMet ? "var(--emerald)" : "var(--text-muted)" }}>
            {status.targetMet ? "Target met!" : `${status.remaining} remaining`}
          </span>
        </div>
        <div style={{
          height: 4,
          borderRadius: 2,
          background: "var(--bg-elevated)",
          overflow: "hidden",
        }}>
          <div style={{
            height: "100%",
            width: `${pct}%`,
            borderRadius: 2,
            background: status.targetMet ? "var(--emerald)" : "var(--amber)",
            transition: "width 0.4s ease",
          }} />
        </div>
      </div>

      <div style={{ width: 1, height: 20, background: "var(--border-subtle)", flexShrink: 0 }} />

      {/* Longest streak */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        <TrendingUp size={13} style={{ color: "var(--text-muted)" }} />
        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
          Best: <strong style={{ color: "var(--text-secondary)" }}>{status.longestStreak}d</strong>
        </span>
      </div>
    </div>
  );
}
