"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingBag, Globe, Package, Send, RefreshCw,
  CheckCircle, AlertTriangle, ExternalLink, Clock,
  Link2, ArrowRight, TrendingUp, Eye, Heart,
} from "lucide-react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { PinterestPanel } from "@/components/publishing/PinterestPanel";

interface EtsyStatus {
  connected: boolean;
  shopName?: string;
  shopUrl?: string;
  listingCount?: number;
}

interface EtsyListing {
  id: string;
  etsyListingId: string;
  title: string;
  price: number;
  status: string;
  views: number;
  favorites: number;
  sales: number;
  revenue: number;
  expiresAt: string | null;
  publishedAt: string | null;
}

interface ReadyProduct {
  id: string;
  title: string;
  pdfPath: string | null;
  coverImagePath: string | null;
  optimizedListing: unknown;
}

interface RevenueData {
  etsy: number;
  gumroad: number;
  etsyMonth: number;
  gumroadMonth: number;
}

const TABS = [
  { id: "etsy", label: "Etsy", icon: ShoppingBag },
  { id: "gumroad", label: "Gumroad", icon: Globe },
  { id: "kdp", label: "KDP", icon: Package },
  { id: "pinterest", label: "Pinterest", icon: Send },
] as const;

type TabId = (typeof TABS)[number]["id"];

function RevenueBar({ revenue }: { revenue: RevenueData | null }) {
  if (!revenue) return null;
  return (
    <div style={{ padding: "0.75rem 2rem", borderBottom: "1px solid var(--border-light)", background: "var(--bg-subtle)", display: "flex", alignItems: "center", gap: "2rem", flexWrap: "wrap" }}>
      <div>
        <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Total Revenue</span>
        <div style={{ display: "flex", gap: "1.5rem", marginTop: "0.25rem" }}>
          <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>Etsy: <strong style={{ color: "var(--text-primary)" }}>${revenue.etsy.toFixed(0)}</strong></span>
          <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>Gumroad: <strong style={{ color: "var(--text-primary)" }}>${revenue.gumroad.toFixed(0)}</strong></span>
        </div>
      </div>
      <div style={{ width: 1, height: 32, background: "var(--border-light)", flexShrink: 0 }} />
      <div>
        <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>This Month</span>
        <div style={{ marginTop: "0.25rem" }}>
          <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--emerald)" }}>${(revenue.etsyMonth + revenue.gumroadMonth).toFixed(0)}</span>
        </div>
      </div>
    </div>
  );
}

function EtsyTab({ status, onConnect, connectError }: { status: EtsyStatus | null; onConnect: () => void; connectError?: string | null }) {
  const [listings, setListings] = useState<EtsyListing[]>([]);
  const [readyProducts, setReadyProducts] = useState<ReadyProduct[]>([]);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [publishLog, setPublishLog] = useState<string>("");

  useEffect(() => {
    if (!status?.connected) return;
    void apiFetch("/api/etsy?action=listings").then((r) => r.json()).then((d: { success: boolean; data?: EtsyListing[] }) => {
      if (d.success && d.data) setListings(d.data);
    }).catch(() => null);
    void apiFetch("/api/products").then((r) => r.json()).then((d: { success: boolean; data?: ReadyProduct[] }) => {
      if (d.success && d.data) {
        setReadyProducts(d.data.filter((p) => p.pdfPath && p.coverImagePath));
      }
    }).catch(() => null);
  }, [status]);

  async function publishProduct(productId: string) {
    setPublishing(productId);
    setPublishLog("Preparing listing…");
    try {
      const res = await apiFetch("/api/etsy/publish?action=publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value).split("\n").filter((l) => l.startsWith("data: "));
        for (const line of lines) {
          const event = JSON.parse(line.slice(6)) as { type: string; step?: string; listingUrl?: string; message?: string };
          if (event.type === "progress" && event.step) setPublishLog(event.step);
          if (event.type === "complete") setPublishLog(`Live! ${event.listingUrl}`);
          if (event.type === "error") setPublishLog(`Error: ${event.message}`);
        }
      }
    } catch { setPublishLog("Publish failed"); }
    finally { setPublishing(null); }
  }

  if (!status?.connected) {
    return (
      <div style={{ padding: "3rem 2rem", textAlign: "center" }}>
        <ShoppingBag size={40} style={{ color: "var(--border-medium)", marginBottom: "1rem" }} />
        <div style={{ fontSize: "var(--text-lg)", fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.5rem" }}>Connect Your Etsy Shop</div>
        <div style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", marginBottom: "1.5rem" }}>Connect your Etsy shop to publish digital products directly from Alpha & Omega.</div>
        <button onClick={onConnect} style={{ padding: "0.625rem 1.5rem", borderRadius: "var(--radius-md)", background: "var(--text-primary)", color: "white", border: "none", cursor: "pointer", fontSize: "var(--text-sm)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "0.375rem" }}>
          <Link2 size={14} /> Connect Etsy Shop →
        </button>
        {connectError && (
          <div style={{ marginTop: "1rem", padding: "0.625rem 1rem", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", color: "#dc2626", maxWidth: 420, margin: "1rem auto 0" }}>
            {connectError}
          </div>
        )}
      </div>
    );
  }

  const expiringSoon = listings.filter((l) => l.expiresAt && new Date(l.expiresAt) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
  const activeListings = listings.filter((l) => l.status === "active").sort((a, b) => b.revenue - a.revenue);

  return (
    <div style={{ padding: "1.5rem 2rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Shop header */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <CheckCircle size={16} style={{ color: "var(--emerald)" }} />
        <span style={{ fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--text-primary)" }}>{status.shopName}</span>
        <a href={status.shopUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--text-muted)", display: "flex" }}><ExternalLink size={12} /></a>
        <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>{status.listingCount ?? activeListings.length} active listings</span>
      </div>

      {/* Ready to publish */}
      {readyProducts.length > 0 && (
        <div>
          <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.75rem" }}>Ready to Publish ({readyProducts.length})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {readyProducts.map((p) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.875rem 1rem", background: "var(--bg-surface)", border: "1px solid var(--border-light)", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-xs)" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.title}</div>
                  <div style={{ display: "flex", gap: "0.375rem", marginTop: "0.25rem" }}>
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--emerald)" }}>PDF ✓</span>
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>·</span>
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--emerald)" }}>Cover ✓</span>
                    {Boolean(p.optimizedListing) && <><span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>·</span><span style={{ fontSize: "var(--text-xs)", color: "var(--emerald)" }}>SEO ✓</span></>}
                  </div>
                </div>
                {publishing === p.id ? (
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", maxWidth: 200 }}>{publishLog}</div>
                ) : (
                  <button onClick={() => void publishProduct(p.id)} style={{ padding: "0.4375rem 0.875rem", borderRadius: "var(--radius-md)", background: "var(--text-primary)", color: "white", border: "none", cursor: "pointer", fontSize: "var(--text-xs)", fontWeight: 600, whiteSpace: "nowrap" }}>
                    Publish to Etsy →
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expiring soon */}
      {expiringSoon.length > 0 && (
        <div style={{ padding: "0.75rem 1rem", background: "var(--amber-bg)", border: "1px solid var(--amber-border)", borderRadius: "var(--radius-md)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
            <AlertTriangle size={14} style={{ color: "var(--amber)" }} />
            <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--amber)" }}>Expiring Soon ({expiringSoon.length})</span>
          </div>
          {expiringSoon.map((l) => {
            const days = Math.ceil((new Date(l.expiresAt!).getTime() - Date.now()) / 86400000);
            return (
              <div key={l.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "0.375rem" }}>
                <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>{l.title}</span>
                <span style={{ fontSize: "var(--text-xs)", color: "var(--amber)", fontWeight: 500 }}>Expires in {days} days</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Live listings */}
      {activeListings.length > 0 && (
        <div>
          <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.75rem" }}>Live on Etsy ({activeListings.length}) — sorted by revenue</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            {activeListings.map((l) => (
              <div key={l.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.75rem 1rem", background: "var(--bg-surface)", border: "1px solid var(--border-light)", borderRadius: "var(--radius-md)" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.title}</div>
                </div>
                <div style={{ display: "flex", gap: "1rem", flexShrink: 0, alignItems: "center" }}>
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.25rem" }}><Eye size={11} />{l.views.toLocaleString()}</span>
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.25rem" }}><Heart size={11} />{l.favorites}</span>
                  <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--emerald)" }}>${l.revenue.toFixed(0)} ({l.sales} sales)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {listings.length === 0 && readyProducts.length === 0 && (
        <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>
          No products ready to publish. <Link href="/build" style={{ color: "var(--blue)" }}>Build your first product →</Link>
        </div>
      )}
    </div>
  );
}

function KDPTab() {
  return (
    <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
      <Package size={36} style={{ color: "var(--border-medium)", marginBottom: "1rem" }} />
      <div style={{ fontSize: "var(--text-lg)", fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.5rem" }}>Amazon KDP</div>
      <div style={{ fontSize: "var(--text-sm)", marginBottom: "1.5rem" }}>Prepare your journals and planners for KDP submission. Generate print-ready PDFs and optimized metadata.</div>
      <Link href="/products">
        <button style={{ padding: "0.625rem 1.5rem", borderRadius: "var(--radius-md)", background: "var(--text-primary)", color: "white", border: "none", cursor: "pointer", fontSize: "var(--text-sm)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "0.375rem" }}>
          <ArrowRight size={14} /> Go to Products to run KDP Prep →
        </button>
      </Link>
    </div>
  );
}

function PublishingPageInner() {
  const searchParams = useSearchParams();
  const initialTab = (searchParams?.get("tab") as TabId) ?? "etsy";
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const [etsyStatus, setEtsyStatus] = useState<EtsyStatus | null>(null);
  const [revenue, setRevenue] = useState<RevenueData | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    const connected = searchParams?.get("connected");
    const pinterest = searchParams?.get("pinterest");
    const etsyError = searchParams?.get("etsy_error");

    if (connected === "etsy") {
      setActiveTab("etsy");
      setSuccessMsg("Etsy shop connected successfully.");
      void loadStatus();
    }
    if (pinterest === "connected") {
      setActiveTab("pinterest");
      setSuccessMsg("Pinterest account connected successfully.");
    }
    if (etsyError) {
      setActiveTab("etsy");
      setConnectError(`Etsy connection failed: ${decodeURIComponent(etsyError)}`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const loadStatus = useCallback(async () => {
    const [etsyRes, revenueRes] = await Promise.allSettled([
      apiFetch("/api/etsy?action=status").then((r) => r.json() as Promise<{ success: boolean; data: EtsyStatus }>),
      apiFetch("/api/portfolio?action=revenue-summary").then((r) => r.json() as Promise<{ success: boolean; data: RevenueData }>),
    ]);
    if (etsyRes.status === "fulfilled" && etsyRes.value.success) setEtsyStatus(etsyRes.value.data);
    if (revenueRes.status === "fulfilled" && revenueRes.value.success) setRevenue(revenueRes.value.data);
  }, []);

  useEffect(() => { void loadStatus(); }, [loadStatus]);

  function handleEtsyConnect() {
    window.location.href = "/api/etsy?action=connect";
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-page)" }}>
      {/* Header */}
      <div style={{ padding: "1.5rem 2rem", borderBottom: "1px solid var(--border-light)", background: "var(--bg-surface)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: "var(--text-xl)", fontWeight: 600, color: "var(--text-primary)", margin: 0, letterSpacing: "-0.02em" }}>Publishing Command Center</h1>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", margin: "0.25rem 0 0" }}>Manage your listings across all platforms</p>
        </div>
        <button onClick={() => void loadStatus()} style={{ display: "flex", alignItems: "center", gap: "0.375rem", padding: "0.5rem 1rem", borderRadius: "var(--radius-md)", background: "var(--bg-surface)", border: "1px solid var(--border-medium)", color: "var(--text-secondary)", fontSize: "var(--text-sm)", cursor: "pointer" }}>
          <RefreshCw size={13} style={{ color: "var(--text-muted)" }} /> Refresh
        </button>
      </div>

      {/* Revenue summary */}
      <RevenueBar revenue={revenue} />

      {/* Success / error banner */}
      {successMsg && (
        <div style={{ padding: "0.625rem 2rem", background: "var(--emerald-bg, #f0fdf4)", borderBottom: "1px solid var(--emerald-border, #bbf7d0)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: "var(--text-sm)", color: "var(--emerald)", fontWeight: 500 }}>✅ {successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "1rem", lineHeight: 1 }}>×</button>
        </div>
      )}

      {/* Tab bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 0, padding: "0 2rem", borderBottom: "1px solid var(--border-light)", background: "var(--bg-surface)" }}>
        {TABS.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          const etsyConnected = id === "etsy" && etsyStatus?.connected;
          const shopName = etsyConnected ? etsyStatus?.shopName : null;
          const listingCount = etsyConnected ? (etsyStatus?.listingCount ?? 0) : 0;
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              style={{
                display: "flex", alignItems: "center", gap: "0.375rem",
                padding: "0.875rem 1.25rem",
                background: "none", border: "none", cursor: "pointer",
                borderBottom: isActive ? "2px solid var(--text-primary)" : "2px solid transparent",
                marginBottom: -1,
                color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                fontSize: "var(--text-sm)", fontWeight: isActive ? 600 : 400,
              }}
            >
              <Icon size={14} />
              {label}
              {shopName && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", fontSize: "0.65rem", fontWeight: 600, padding: "0.15rem 0.5rem", borderRadius: 10, background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0", whiteSpace: "nowrap" }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#16a34a", flexShrink: 0, display: "inline-block" }} />
                  {shopName}
                </span>
              )}
              {listingCount > 0 && (
                <span style={{ fontSize: "0.65rem", fontWeight: 700, padding: "0.125rem 0.375rem", borderRadius: 10, background: "var(--emerald-bg)", color: "var(--emerald)", border: "1px solid var(--emerald-border)" }}>
                  {listingCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div key={activeTab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
          {activeTab === "etsy" && <EtsyTab status={etsyStatus} onConnect={handleEtsyConnect} connectError={connectError} />}
          {activeTab === "gumroad" && (
            <div style={{ padding: "1.5rem 2rem" }}>
              <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Globe size={14} /> Gumroad
              </div>
              <Link href="/publishing?platform=gumroad">
                <div style={{ padding: "1rem", background: "var(--bg-surface)", border: "1px solid var(--border-light)", borderRadius: "var(--radius-md)", color: "var(--text-secondary)", fontSize: "var(--text-sm)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <TrendingUp size={14} /> Manage Gumroad products and revenue <ArrowRight size={12} style={{ marginLeft: "auto" }} />
                </div>
              </Link>
            </div>
          )}
          {activeTab === "kdp" && <KDPTab />}
          {activeTab === "pinterest" && (
            <div style={{ padding: "1.5rem 2rem" }}>
              <PinterestPanel />
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export default function PublishingPage() {
  return (
    <Suspense>
      <PublishingPageInner />
    </Suspense>
  );
}
