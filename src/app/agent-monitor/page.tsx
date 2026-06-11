"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { RefreshCw, TrendingUp, Clock, DollarSign } from "lucide-react";

interface AgentLog {
  id: string;
  queueId: string;
  agentName: string;
  status: string;
  tokensUsed: number;
  costEstimate: number;
  durationMs: number;
  errorMessage: string | null;
  startedAt: string;
  outputData: unknown;
}

interface GroupedRun {
  queueId: string;
  agents: AgentLog[];
  totalCost: number;
  totalTokens: number;
  totalDurationMs: number;
}

const AGENT_COLORS: Record<string, string> = {
  "market-scout": "#3b82f6",
  "niche-validator": "#8b5cf6",
  "concept-generator": "#ec4899",
  "competition-checker": "#f59e0b",
  "opportunity-scorer": "#22c55e",
  "manager": "#e5e5e5",
};

function formatDuration(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function StatusDot({ status }: { status: string }) {
  const color = status === "complete" ? "var(--emerald)" : status === "failed" ? "#ef4444" : "#f59e0b";
  return <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: color, marginRight: 5, verticalAlign: "middle" }} />;
}

function AgentBreakdown({ agents }: { agents: AgentLog[] }) {
  const order = ["market-scout", "niche-validator", "concept-generator", "competition-checker", "opportunity-scorer", "manager"];
  const sorted = [...agents].sort((a, b) => order.indexOf(a.agentName) - order.indexOf(b.agentName));

  return (
    <div style={{ marginTop: 12, display: "grid", gap: 6 }}>
      {sorted.map((log) => {
        const color = AGENT_COLORS[log.agentName] ?? "#737373";
        return (
          <div key={log.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 10px", background: "var(--bg-subtle)", borderRadius: "var(--radius-md)", fontSize: "0.7rem" }}>
            <StatusDot status={log.status} />
            <span style={{ color, fontWeight: 600, minWidth: 140 }}>{log.agentName}</span>
            <span style={{ color: "var(--text-muted)", flex: 1 }}>
              {log.tokensUsed.toLocaleString()} tokens · ${log.costEstimate.toFixed(3)} · {formatDuration(log.durationMs)}
            </span>
            {log.errorMessage && (
              <span style={{ color: "#ef4444", fontSize: "0.65rem", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{log.errorMessage}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function AgentMonitorPage() {
  const [runs, setRuns] = useState<GroupedRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await apiFetch("/api/launch-queue?action=agent-runs&limit=10");
        const json = await res.json() as { success: boolean; data: GroupedRun[] };
        if (json.success) setRuns(json.data);
      } catch { /* ignore */ } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, color: "var(--text-primary)", margin: "0 0 4px 0" }}>Agent Monitor</h1>
          <div style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>Recent autonomous pipeline runs</div>
        </div>
        <Link href="/launch-queue" style={{ fontSize: "0.8rem", color: "var(--text-secondary)", textDecoration: "none" }}>
          → View Launch Queue
        </Link>
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: "4rem", color: "var(--text-muted)" }}>
          <RefreshCw size={20} style={{ marginBottom: 8, opacity: 0.4 }} />
          <div style={{ fontSize: "0.8rem" }}>Loading agent runs...</div>
        </div>
      )}

      {!loading && runs.length === 0 && (
        <div style={{ textAlign: "center", padding: "4rem", color: "var(--text-muted)", fontSize: "0.8rem" }}>
          No agent runs yet. The first run will occur at 2am UTC.
        </div>
      )}

      <div style={{ display: "grid", gap: 16 }}>
        {runs.map((run) => {
          const isOpen = expanded === run.queueId;
          const allComplete = run.agents.every((a) => a.status === "complete");
          const hasFailed = run.agents.some((a) => a.status === "failed");
          const firstAgent = run.agents.sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime())[0];
          const runDate = firstAgent ? new Date(firstAgent.startedAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "Unknown date";

          return (
            <div key={run.queueId} style={{ background: "var(--bg-card, #111)", border: "1px solid var(--border-medium)", borderRadius: "var(--radius-lg)", padding: "1rem 1.25rem" }}>
              <div
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                onClick={() => setExpanded(isOpen ? null : run.queueId)}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-primary)" }}>{runDate}</span>
                  <span style={{
                    fontSize: "0.65rem", fontWeight: 700, padding: "2px 6px", borderRadius: 4,
                    background: allComplete ? "#14532d" : hasFailed ? "#450a0a" : "#1c1917",
                    color: allComplete ? "var(--emerald)" : hasFailed ? "#ef4444" : "#f59e0b",
                  }}>
                    {allComplete ? "✅ Complete" : hasFailed ? "⚠️ Partial" : "⟳ Running"}
                  </span>
                </div>

                <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.7rem", color: "var(--text-muted)" }}>
                    <DollarSign size={11} />${run.totalCost.toFixed(3)}
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.7rem", color: "var(--text-muted)" }}>
                    <TrendingUp size={11} />{run.totalTokens.toLocaleString()} tokens
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.7rem", color: "var(--text-muted)" }}>
                    <Clock size={11} />{formatDuration(run.totalDurationMs)}
                  </span>
                  <Link
                    href="/launch-queue"
                    onClick={(e) => e.stopPropagation()}
                    style={{ fontSize: "0.7rem", color: "var(--text-secondary)", textDecoration: "none", padding: "3px 8px", border: "1px solid var(--border-light)", borderRadius: "var(--radius-md)" }}
                  >
                    View Queue →
                  </Link>
                </div>
              </div>

              <AnimateExpand open={isOpen}>
                <AgentBreakdown agents={run.agents} />
              </AnimateExpand>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AnimateExpand({ open, children }: { open: boolean; children: React.ReactNode }) {
  if (!open) return null;
  return <div>{children}</div>;
}
