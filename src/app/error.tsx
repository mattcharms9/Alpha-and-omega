"use client";

import { useEffect } from "react";

export default function RootError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { console.error("[RootError]", error); }, [error]);

  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <h2 style={{ color: "var(--text-primary)", marginBottom: "1rem" }}>Something went wrong</h2>
      <p style={{ color: "var(--text-secondary)", marginBottom: "1.5rem" }}>{error.message}</p>
      <button
        onClick={reset}
        style={{ color: "var(--gold)", border: "1px solid var(--gold)", padding: "8px 20px", borderRadius: 8, background: "transparent", cursor: "pointer" }}
      >
        Try again
      </button>
    </div>
  );
}
