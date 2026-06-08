"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Zap } from "lucide-react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    description: "Try the core features",
    features: [
      "5 products per day",
      "Gumroad publishing",
      "Intelligence scanning",
      "Basic PDF templates",
    ],
    cta: "Get Started",
    href: "/",
    highlight: false,
  },
  {
    id: "starter",
    name: "Starter",
    price: "$19",
    period: "/mo",
    description: "For serious Etsy sellers",
    features: [
      "20 products per day",
      "Etsy + Gumroad publishing",
      "Listing SEO optimizer",
      "Product mockup generator",
      "Knowledge + Games engines",
    ],
    cta: "Start Starter",
    highlight: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: "$49",
    period: "/mo",
    description: "Scale your catalog",
    features: [
      "Unlimited products",
      "All platforms",
      "Bulk operations",
      "KDP prep packages",
      "Amazon KDP metadata",
      "Email nurture sequences",
    ],
    cta: "Go Pro",
    highlight: true,
  },
  {
    id: "unlimited",
    name: "Unlimited",
    price: "$99",
    period: "/mo",
    description: "The full machine",
    features: [
      "Everything in Pro",
      "Competitor shop spy",
      "API access",
      "Revenue forecasting",
      "Priority support",
    ],
    cta: "Go Unlimited",
    highlight: false,
  },
] as const;

export default function PricingPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [email, setEmail] = useState("");

  async function checkout(planId: string) {
    if (!email) { alert("Enter your email to continue"); return; }
    setLoading(planId);
    try {
      const res = await apiFetch("/api/billing?action=create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId, email }),
      });
      const json = await res.json() as { success: boolean; data?: { url: string }; error?: string };
      if (json.success && json.data?.url) {
        window.location.href = json.data.url;
      } else {
        alert(json.error ?? "Checkout failed");
      }
    } finally { setLoading(null); }
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-page)", padding: "3rem 2rem" }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
          <Zap size={20} style={{ color: "var(--text-primary)" }} />
          <span style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: "var(--text-primary)" }}>Alpha & Omega</span>
        </div>
        <h1 style={{ fontSize: "var(--text-3xl)", fontWeight: 700, color: "var(--text-primary)", margin: "0 0 0.5rem", letterSpacing: "-0.03em" }}>
          Simple pricing
        </h1>
        <p style={{ fontSize: "var(--text-base)", color: "var(--text-secondary)", margin: 0 }}>
          Start free. Scale when you're ready to sell.
        </p>
        <div style={{ marginTop: "1.25rem" }}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            style={{ padding: "0.5rem 0.75rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-medium)", background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: "var(--text-sm)", width: 240 }}
          />
        </div>
      </div>

      {/* Plans grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))", gap: "1rem", maxWidth: 1000, margin: "0 auto" }}>
        {PLANS.map((plan, i) => (
          <motion.div
            key={plan.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            style={{
              background: plan.highlight ? "var(--text-primary)" : "var(--bg-surface)",
              border: `1px solid ${plan.highlight ? "transparent" : "var(--border-light)"}`,
              borderRadius: "var(--radius-xl)",
              padding: "1.75rem",
              display: "flex",
              flexDirection: "column",
              gap: "1.25rem",
              boxShadow: plan.highlight ? "var(--shadow-lg)" : "var(--shadow-xs)",
            }}
          >
            <div>
              <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: plan.highlight ? "rgba(255,255,255,0.6)" : "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.375rem" }}>{plan.name}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "0.25rem" }}>
                <span style={{ fontSize: "var(--text-3xl)", fontWeight: 700, color: plan.highlight ? "white" : "var(--text-primary)", letterSpacing: "-0.03em" }}>{plan.price}</span>
                {"period" in plan && <span style={{ fontSize: "var(--text-sm)", color: plan.highlight ? "rgba(255,255,255,0.6)" : "var(--text-muted)" }}>{plan.period}</span>}
              </div>
              <div style={{ fontSize: "var(--text-xs)", color: plan.highlight ? "rgba(255,255,255,0.6)" : "var(--text-secondary)", marginTop: "0.25rem" }}>{plan.description}</div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", flex: 1 }}>
              {plan.features.map((f) => (
                <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                  <Check size={13} style={{ color: plan.highlight ? "rgba(255,255,255,0.8)" : "var(--emerald)", flexShrink: 0, marginTop: 2 }} />
                  <span style={{ fontSize: "var(--text-xs)", color: plan.highlight ? "rgba(255,255,255,0.8)" : "var(--text-secondary)", lineHeight: 1.4 }}>{f}</span>
                </div>
              ))}
            </div>

            {plan.id === "free" ? (
              <Link href="/">
                <button style={{ width: "100%", padding: "0.625rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-medium)", background: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: "var(--text-sm)", fontWeight: 500 }}>
                  {plan.cta}
                </button>
              </Link>
            ) : (
              <button
                onClick={() => void checkout(plan.id)}
                disabled={loading === plan.id}
                style={{
                  width: "100%", padding: "0.625rem", borderRadius: "var(--radius-md)",
                  border: plan.highlight ? "none" : "1px solid var(--border-medium)",
                  background: plan.highlight ? "white" : "var(--text-primary)",
                  color: plan.highlight ? "var(--text-primary)" : "white",
                  cursor: loading === plan.id ? "not-allowed" : "pointer",
                  fontSize: "var(--text-sm)", fontWeight: 600,
                  opacity: loading === plan.id ? 0.7 : 1,
                }}
              >
                {loading === plan.id ? "Loading…" : plan.cta}
              </button>
            )}
          </motion.div>
        ))}
      </div>

      <div style={{ textAlign: "center", marginTop: "2rem" }}>
        <Link href="/" style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
          ← Back to app
        </Link>
      </div>
    </div>
  );
}
