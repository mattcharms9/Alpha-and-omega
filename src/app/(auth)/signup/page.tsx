"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Zap, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json() as { success: boolean; error?: string };
      if (!data.success) {
        setError(data.error ?? "Registration failed.");
        return;
      }
      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) {
        setError("Account created but sign-in failed. Try logging in.");
      } else {
        router.push("/");
        router.refresh();
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "var(--bg-subtle)",
    border: "1px solid var(--border-medium)",
    borderRadius: "var(--radius-md)",
    padding: "0.5625rem 0.75rem",
    fontSize: "var(--text-sm)",
    color: "var(--text-primary)",
    outline: "none",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "var(--text-sm)",
    fontWeight: 500,
    color: "var(--text-secondary)",
    marginBottom: "0.375rem",
  };

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 400,
        background: "var(--bg-surface)",
        border: "1px solid var(--border-light)",
        borderRadius: "var(--radius-xl)",
        padding: "2.5rem",
        boxShadow: "var(--shadow-md)",
      }}
    >
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "2rem" }}>
        <div
          style={{
            width: 36,
            height: 36,
            background: "var(--text-primary)",
            borderRadius: "var(--radius-md)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Zap size={18} color="white" />
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>
            Alpha & Omega
          </div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>Publishing OS</div>
        </div>
      </div>

      <h1 style={{ fontSize: "var(--text-xl)", fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.25rem" }}>
        Create account
      </h1>
      <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginBottom: "1.5rem" }}>
        Start building your publishing empire
      </p>

      {error && (
        <div
          style={{
            marginBottom: "1rem",
            padding: "0.75rem",
            borderRadius: "var(--radius-md)",
            background: "var(--rose-bg)",
            border: "1px solid var(--rose-border)",
            fontSize: "var(--text-sm)",
            color: "var(--rose)",
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={(e) => void handleSubmit(e)}>
        <div style={{ marginBottom: "1rem" }}>
          <label style={labelStyle}>Name</label>
          <input type="text" required value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ marginBottom: "1rem" }}>
          <label style={labelStyle}>Email</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ marginBottom: "1rem" }}>
          <label style={labelStyle}>Password</label>
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ marginBottom: "1.5rem" }}>
          <label style={labelStyle}>Confirm Password</label>
          <input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} style={inputStyle} />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            background: "var(--text-primary)",
            color: "white",
            border: "none",
            borderRadius: "var(--radius-md)",
            padding: "0.625rem",
            fontSize: "var(--text-sm)",
            fontWeight: 500,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem",
          }}
        >
          {loading && <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />}
          {loading ? "Creating account…" : "Create Account"}
        </button>
      </form>

      <p style={{ marginTop: "1.5rem", textAlign: "center", fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
        Already have an account?{" "}
        <Link href="/login" style={{ color: "var(--text-primary)", fontWeight: 500 }}>
          Sign in →
        </Link>
      </p>
    </div>
  );
}
