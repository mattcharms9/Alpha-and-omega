"use client";

import { useState, useEffect } from "react";
import { ShoppingBag, RefreshCw, Tag, AlertTriangle, CheckCircle, TrendingDown, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface ShopSection { name: string; listingIds: string[]; theme: string; }
interface ShopHealthReport {
  totalListings: number; activeListings: number; draftListings: number;
  sections: ShopSection[]; missingFromSections: string[];
  listingsWithLowQualityScore: string[]; listingsWithNoImage: string[];
  listingsWithShortDescription: string[]; zeroViewListings: string[];
  highViewLowSaleListings: string[]; suggestedSections: string[];
  suggestedPriceAdjustments: { listingId: string; currentPrice: number; suggestedPrice: number }[];
  listingsToDeactivate: string[]; shopHealthScore: number;
}

function ScoreBar({ score, label }: { score: number; label: string }) {
  const color = score >= 80 ? "var(--emerald)" : score >= 60 ? "var(--amber)" : "var(--rose)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ flex: 1, height: 8, background: "var(--bg-subtle)", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${score}%`, height: "100%", background: color, borderRadius: 4, transition: "width 0.8s ease" }} />
      </div>
      <span style={{ fontSize: "0.875rem", fontWeight: 700, color, minWidth: 40 }}>{score}/100</span>
      <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{label}</span>
    </div>
  );
}

function IssueRow({ count, label, color }: { count: number; label: string; color: string }) {
  if (count === 0) return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
      <CheckCircle size={14} style={{ color: "var(--emerald)" }} />
      <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{label}: none</span>
    </div>
  );
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
      <AlertTriangle size={14} style={{ color }} />
      <span style={{ fontSize: "0.8rem", color: "var(--text-primary)", fontWeight: 500 }}>{count} listing{count !== 1 ? "s" : ""}</span>
      <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{label}</span>
    </div>
  );
}

export default function ShopManagerPage() {
  const [report, setReport] = useState<ShopHealthReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  async function loadReport() {
    setLoading(true);
    try {
      const res = await apiFetch("/api/etsy/shop?action=health");
      const data = await res.json() as { success: boolean; data: ShopHealthReport };
      if (data.success) setReport(data.data);
    } catch { /* silent */ } finally { setLoading(false); }
  }

  useEffect(() => { void loadReport(); }, []);

  async function runAction(action: string, label: string) {
    setActionLoading(action);
    setActionMsg(null);
    try {
      const res = await apiFetch(`/api/etsy/shop?action=${action}`, { method: "POST", body: "{}" });
      const data = await res.json() as { success: boolean; data?: { message?: string } };
      setActionMsg(data.data?.message ?? (data.success ? `${label} complete` : "Action failed"));
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : "Action failed");
    } finally { setActionLoading(null); }
  }

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 12 }}>
      <Loader2 size={20} style={{ animation: "spin 1s linear infinite", color: "var(--text-muted)" }} />
      <span style={{ color: "var(--text-muted)" }}>Loading shop health...</span>
    </div>
  );

  if (!report) return (
    <div style={{ padding: "48px 36px", textAlign: "center" }}>
      <ShoppingBag size={40} style={{ color: "var(--border-medium)", marginBottom: 16 }} />
      <div style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>No Etsy Shop Connected</div>
      <div style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>Connect your Etsy shop from the Publishing page first.</div>
    </div>
  );

  return (
    <div style={{ padding: "0 0 48px" }}>
      {/* Header */}
      <div style={{ padding: "32px 36px 24px", borderBottom: "1px solid var(--border-subtle)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--amber-bg)", border: "1px solid var(--amber-border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ShoppingBag size={20} style={{ color: "var(--amber)" }} />
            </div>
            <div>
              <h1 style={{ fontSize: "1.375rem", fontWeight: 700, color: "var(--text-primary)" }}>Shop Manager</h1>
              <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginTop: 2 }}>Keep your Etsy shop healthy, organized, and fully optimized</p>
            </div>
          </div>
          <button onClick={loadReport} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "1px solid var(--border-medium)", background: "var(--bg-elevated)", color: "var(--text-secondary)", fontSize: "0.8rem", fontWeight: 500, cursor: "pointer" }}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      <div style={{ padding: "28px 36px" }}>
        {actionMsg && (
          <div style={{ marginBottom: 20, padding: "10px 16px", borderRadius: 8, background: "var(--emerald-bg)", border: "1px solid var(--emerald-border)", fontSize: "0.875rem", color: "var(--emerald)" }}>
            ✓ {actionMsg}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 28 }}>
          {/* Health Score */}
          <div style={{ padding: "24px", background: "var(--bg-surface)", border: "1px solid var(--border-light)", borderRadius: 12 }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16 }}>Shop Health Score</div>
            <ScoreBar score={report.shopHealthScore} label="overall" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 20 }}>
              {[
                { label: "Total", value: report.totalListings, color: "var(--text-primary)" },
                { label: "Active", value: report.activeListings, color: "var(--emerald)" },
                { label: "Draft", value: report.draftListings, color: "var(--amber)" },
              ].map((s) => (
                <div key={s.label} style={{ textAlign: "center", padding: "12px 8px", background: "var(--bg-subtle)", borderRadius: 8 }}>
                  <div style={{ fontSize: "1.5rem", fontWeight: 700, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Issues */}
          <div style={{ padding: "24px", background: "var(--bg-surface)", border: "1px solid var(--border-light)", borderRadius: 12 }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16 }}>Issue Summary</div>
            <IssueRow count={report.zeroViewListings.length} label="no views in 30 days (SEO problem)" color="var(--rose)" />
            <IssueRow count={report.highViewLowSaleListings.length} label="high views but no sales (price/title problem)" color="var(--amber)" />
            <IssueRow count={report.listingsWithLowQualityScore.length} label="listing quality score < 75" color="var(--amber)" />
            <IssueRow count={report.listingsWithNoImage.length} label="missing cover image" color="var(--rose)" />
            <IssueRow count={report.listingsToDeactivate.length} label="no activity in 60 days (consider removing)" color="var(--text-muted)" />
          </div>
        </div>

        {/* Actions */}
        <div style={{ padding: "24px", background: "var(--bg-surface)", border: "1px solid var(--border-light)", borderRadius: 12, marginBottom: 28 }}>
          <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: 16 }}>Actions</div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {[
              { action: "organize", label: "Organize Shop Sections", icon: Tag },
              { action: "refresh-seo", label: "Refresh SEO on Zero-View Listings", icon: RefreshCw },
            ].map(({ action, label, icon: Icon }) => (
              <button key={action} onClick={() => runAction(action, label)} disabled={!!actionLoading} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 8, border: "1px solid var(--border-medium)", background: "var(--bg-elevated)", color: "var(--text-primary)", fontSize: "0.875rem", fontWeight: 500, cursor: actionLoading ? "not-allowed" : "pointer", opacity: actionLoading ? 0.6 : 1 }}>
                {actionLoading === action ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Icon size={14} />}
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Sections */}
        {report.sections.length > 0 && (
          <div style={{ padding: "24px", background: "var(--bg-surface)", border: "1px solid var(--border-light)", borderRadius: 12 }}>
            <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: 16 }}>Shop Sections ({report.sections.length})</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
              {report.sections.map((s) => (
                <div key={s.name} style={{ padding: "12px 16px", background: "var(--bg-subtle)", borderRadius: 8, border: "1px solid var(--border-light)" }}>
                  <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>{s.name}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <TrendingDown size={11} style={{ color: "var(--text-muted)" }} />
                    <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{s.listingIds.length} listing{s.listingIds.length !== 1 ? "s" : ""}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
