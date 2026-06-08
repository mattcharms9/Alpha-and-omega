"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Link2, Link2Off, RefreshCw, Clock, Zap, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

interface PinterestStatus {
  connected: boolean;
  username?: string;
  boardId?: string;
  tokenExpiry?: string | null;
}

interface PinQueueItem {
  id: string;
  productId: string;
  scheduledFor: string;
  status: string;
  error?: string | null;
  product: { title: string };
}

interface PinterestBoard {
  id: string;
  name: string;
  description: string;
}

const API_HEADERS = {
  "Content-Type": "application/json",
  "x-api-key": process.env.NEXT_PUBLIC_API_KEY ?? "",
};

export function PinterestPanel() {
  const [status, setStatus] = useState<PinterestStatus | null>(null);
  const [boards, setBoards] = useState<PinterestBoard[]>([]);
  const [queue, setQueue] = useState<PinQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [boardsOpen, setBoardsOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/pinterest?action=status", { headers: API_HEADERS });
      const json = await res.json() as { success: boolean; data?: PinterestStatus };
      if (json.success && json.data) setStatus(json.data);
    } catch {
      // swallow
    }
  }, []);

  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch("/api/pinterest/queue?action=list", { headers: API_HEADERS });
      const json = await res.json() as { success: boolean; data?: PinQueueItem[] };
      if (json.success && json.data) setQueue(json.data);
    } catch {
      // swallow
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchStatus(), fetchQueue()]).finally(() => setLoading(false));
  }, [fetchStatus, fetchQueue]);

  async function handleConnect() {
    window.location.href = "/api/pinterest?action=connect";
  }

  async function handleDisconnect() {
    await fetch("/api/pinterest?action=disconnect", { headers: API_HEADERS });
    setStatus({ connected: false });
    setBoards([]);
  }

  async function handleLoadBoards() {
    if (boards.length > 0) {
      setBoardsOpen((o) => !o);
      return;
    }
    const res = await fetch("/api/pinterest?action=boards", { headers: API_HEADERS });
    const json = await res.json() as { success: boolean; data?: PinterestBoard[] };
    if (json.success && json.data) setBoards(json.data);
    setBoardsOpen(true);
  }

  async function handleSetBoard(boardId: string) {
    await fetch("/api/pinterest?action=set-board", {
      method: "POST",
      headers: API_HEADERS,
      body: JSON.stringify({ boardId }),
    });
    setStatus((prev) => prev ? { ...prev, boardId } : prev);
    setBoardsOpen(false);
  }

  async function handleSyncAnalytics() {
    setSyncing(true);
    try {
      await fetch("/api/pinterest/pin?action=sync-analytics", { method: "POST", headers: API_HEADERS, body: JSON.stringify({}) });
    } finally {
      setSyncing(false);
    }
  }

  async function handleCancelQueued(id: string) {
    await fetch("/api/pinterest/queue?action=cancel", {
      method: "POST",
      headers: API_HEADERS,
      body: JSON.stringify({ id }),
    });
    setQueue((prev) => prev.filter((q) => q.id !== id));
  }

  async function handlePostNow(item: PinQueueItem) {
    await fetch("/api/pinterest/pin?action=auto-pin", {
      method: "POST",
      headers: API_HEADERS,
      body: JSON.stringify({ productId: item.productId }),
    });
    await handleCancelQueued(item.id);
  }

  if (loading) {
    return (
      <Card>
        <CardBody>
          <div style={{ padding: "20px 0", textAlign: "center", color: "var(--text-muted)", fontSize: "0.82rem" }}>
            Loading Pinterest...
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Connection card */}
      <Card>
        <CardBody>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span style={{ fontSize: "1.2rem" }}>📌</span>
              <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-primary)" }}>Pinterest Auto-Promotion</span>
            </div>
            <Badge variant={status?.connected ? "emerald" : "muted"}>
              {status?.connected ? "Connected" : "Not Connected"}
            </Badge>
          </div>

          {status?.connected ? (
            <>
              <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: 12 }}>
                <span style={{ color: "var(--text-muted)" }}>Account: </span>
                <span style={{ fontWeight: 600 }}>@{status.username}</span>
                {status.boardId && (
                  <span style={{ marginLeft: 8, color: "var(--text-muted)" }}>· Board: <span style={{ color: "var(--text-secondary)" }}>{status.boardId.slice(0, 12)}…</span></span>
                )}
              </div>

              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" icon={<ChevronDown size={12} />} onClick={handleLoadBoards}>
                  {boardsOpen ? "Hide Boards" : "Change Board"}
                </Button>
                <Button variant="outline" size="sm" icon={<RefreshCw size={12} />} onClick={handleSyncAnalytics} disabled={syncing}>
                  {syncing ? "Syncing…" : "Sync Analytics"}
                </Button>
                <Button variant="danger" size="sm" icon={<Link2Off size={12} />} onClick={handleDisconnect}>
                  Disconnect
                </Button>
              </div>

              {boardsOpen && boards.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  style={{ marginTop: 12 }}
                >
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 6 }}>Select a board:</div>
                  <div className="flex flex-col gap-1" style={{ maxHeight: 180, overflowY: "auto" }}>
                    {boards.map((board) => (
                      <button
                        key={board.id}
                        onClick={() => handleSetBoard(board.id)}
                        style={{
                          textAlign: "left",
                          padding: "8px 10px",
                          borderRadius: 8,
                          background: status.boardId === board.id ? "rgba(16,185,129,0.08)" : "var(--bg-hover)",
                          border: status.boardId === board.id ? "1px solid rgba(16,185,129,0.3)" : "1px solid transparent",
                          color: "var(--text-primary)",
                          fontSize: "0.82rem",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ fontWeight: 600 }}>{board.name}</div>
                        {board.description && (
                          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>{board.description}</div>
                        )}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </>
          ) : (
            <>
              <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 12 }}>
                Connect Pinterest to automatically promote products as Pins after publishing. Drives organic traffic from Pinterest&apos;s 500M+ monthly active users.
              </p>
              <Button variant="gold" size="sm" icon={<Link2 size={12} />} onClick={handleConnect}>
                Connect Pinterest
              </Button>
            </>
          )}
        </CardBody>
      </Card>

      {/* Pin Queue */}
      {status?.connected && (
        <Card>
          <CardBody>
            <div className="flex items-center justify-between mb-3">
              <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)" }}>Pin Queue</div>
              <Badge variant="muted">{queue.filter((q) => q.status === "queued").length} scheduled</Badge>
            </div>

            {queue.length === 0 ? (
              <div style={{ padding: "20px 0", textAlign: "center", color: "var(--text-muted)", fontSize: "0.8rem" }}>
                No pins queued. Publish a product to auto-schedule.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {queue.slice(0, 8).map((item) => (
                  <div
                    key={item.id}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 8,
                      background: "var(--bg-hover)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.product.title}
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        <Clock size={11} style={{ color: "var(--text-muted)" }} />
                        <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                          {new Date(item.scheduledFor).toLocaleString()}
                        </span>
                        <Badge variant={item.status === "failed" ? "muted" : item.status === "published" ? "emerald" : "gold"}>
                          {item.status}
                        </Badge>
                      </div>
                    </div>
                    {item.status === "queued" && (
                      <div className="flex gap-1">
                        <Button variant="emerald" size="sm" icon={<Zap size={10} />} onClick={() => handlePostNow(item)}>
                          Now
                        </Button>
                        <Button variant="danger" size="sm" onClick={() => handleCancelQueued(item.id)}>
                          ✕
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
