"use client";

import { useEffect } from "react";

export default function BrandsError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { console.error("[BrandsError]", error); }, [error]);

  return (
    <div style={{ padding: "3rem", textAlign: "center" }}>
      <h2 style={{ color: "var(--text-primary)", marginBottom: "0.75rem" }}>Brand generation failed</h2>
      <p style={{ color: "var(--text-secondary)", marginBottom: "1.5rem", fontSize: "0.875rem" }}>{error.message}</p>
      <button onClick={reset} style={{ color: "var(--gold)", border: "1px solid var(--gold)", padding: "8px 20px", borderRadius: 8, background: "transparent", cursor: "pointer" }}>
        Try again
      </button>
    </div>
  );
}
