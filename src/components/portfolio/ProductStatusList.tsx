"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { RefreshCw, ExternalLink } from "lucide-react";

interface ProductStatusItem {
  cardId: string;
  productId: string;
  title: string;
  type: string;
  buildStatus: string;
  buildCompleteness: number;
  stagesFailed: Array<{ stage: string; reason: string }> | null;
  etsyListingUrl: string | null;
  failureReason: string | null;
  publishedAt: string | null;
}

function statusBadge(buildStatus: string): { label: string; color: string; bg: string } {
  if (buildStatus === "published") return { label: "Live", color: "var(--emerald)", bg: "var(--emerald-dim, rgba(52,211,153,0.12))" };
  if (buildStatus.startsWith("failed")) return { label: "Failed", color: "var(--rose)", bg: "var(--rose-bg, rgba(251,113,133,0.10))" };
  if (["blueprinting","generating_pdf","generating_cover","optimizing_seo","generating_mockups","creating_listing","publishing","building","built","generating_gallery"].includes(buildStatus)) {
    return { label: "Building", color: "var(--amber)", bg: "var(--amber-dim, rgba(251,191,36,0.12))" };
  }
  return { label: "Not published", color: "var(--text-muted)", bg: "var(--bg-subtle)" };
}

export function ProductStatusList() {
  const [items, setItems] = useState<ProductStatusItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<string | null>(null);

  useEffect(() => {
    void apiFetch("/api/portfolio?action=products", { credentials: "include" })
      .then((r) => r.json() as Promise<{ success: boolean; data: ProductStatusItem[] }>)
      .then((j) => { if (j.success) setItems(j.data); })
      .finally(() => setLoading(false));
  }, []);

  async function retryBuild(cardId: string) {
    const item = items.find((i) => i.cardId === cardId);
    if (!item) return;
    const FAILED_STATUS_TO_RESUME: Record<string, string> = {
      failed_blueprinting:       "blueprint",
      failed_generating_pdf:     "pdf",
      failed_generating_cover:   "cover_image",
      failed_optimizing_seo:     "seo",
      failed_generating_mockups: "mockups",
      failed_creating_listing:   "etsy_publish",
      failed_publishing:         "etsy_publish",
    };
    const resumeFrom = FAILED_STATUS_TO_RESUME[item.buildStatus];
    setRetrying(cardId);
    try {
      await apiFetch("/api/launch-queue?action=retry-build", {
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ cardId, ...(resumeFrom ? { resumeFrom } : {}) }),
      });
      setItems((prev) => prev.map((i) => i.cardId === cardId ? { ...i, buildStatus: "building" } : i));
    } finally {
      setRetrying(null);
    }
  }

  if (loading) return <div style={{ padding: "1rem", color: "var(--text-muted)", fontSize: "0.8rem" }}>Loading products...</div>;
  if (items.length === 0) return null;

  return (
    <div style={{ marginTop: 32 }}>
      <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12 }}>
        Product Library — {items.length} products
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((item) => {
          const badge = statusBadge(item.buildStatus);
          const isFailed = item.buildStatus.startsWith("failed");
          return (
            <div
              key={item.cardId}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "10px 14px",
                background: "var(--bg-elevated)",
                border: `1px solid ${isFailed ? "var(--rose-border, rgba(251,113,133,0.25))" : "var(--border-light)"}`,
                borderRadius: "var(--radius-md)",
                flexWrap: "wrap",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "0.83rem", fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.title}
                </div>
                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 2 }}>
                  {item.type}{item.buildCompleteness > 0 && item.buildStatus !== "published" ? ` · ${item.buildCompleteness}% complete` : ""}
                  {item.publishedAt ? ` · Published ${new Date(item.publishedAt).toLocaleDateString()}` : ""}
                </div>
                {isFailed && item.failureReason && (
                  <div style={{ fontSize: "0.68rem", color: "var(--rose)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.failureReason}
                  </div>
                )}
              </div>

              <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: "0.65rem", fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: badge.bg, color: badge.color, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {badge.label}
                </span>

                {item.etsyListingUrl && (
                  <a
                    href={item.etsyListingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.7rem", color: "var(--text-secondary)", textDecoration: "none", padding: "3px 8px", border: "1px solid var(--border-light)", borderRadius: "var(--radius-sm)" }}
                  >
                    <ExternalLink size={10} /> Etsy
                  </a>
                )}

                {isFailed && (
                  <button
                    onClick={() => void retryBuild(item.cardId)}
                    disabled={retrying === item.cardId}
                    style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.7rem", color: "var(--amber)", background: "transparent", border: "1px solid var(--amber-border, rgba(251,191,36,0.3))", borderRadius: "var(--radius-sm)", padding: "3px 8px", cursor: retrying === item.cardId ? "not-allowed" : "pointer", opacity: retrying === item.cardId ? 0.6 : 1 }}
                  >
                    <RefreshCw size={10} /> {retrying === item.cardId ? "Retrying..." : "Retry"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
