"use client";

import { Wifi, WifiOff } from "lucide-react";

interface Props {
  realData: boolean;
  fetchedAt?: string;
}

export function DataFreshnessBadge({ realData, fetchedAt }: Props) {
  const age = fetchedAt
    ? Math.floor((Date.now() - new Date(fetchedAt).getTime()) / (60 * 60 * 1000))
    : null;

  if (realData) {
    return (
      <span
        title={fetchedAt ? `Data fetched ${age}h ago` : "Live Etsy data"}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.25rem",
          fontSize: "0.65rem",
          fontWeight: 600,
          padding: "0.125rem 0.4375rem",
          borderRadius: 10,
          background: "var(--emerald-bg)",
          color: "var(--emerald)",
          border: "1px solid var(--emerald-border)",
          whiteSpace: "nowrap",
        }}
      >
        <Wifi size={9} />
        Live Etsy Data{age !== null ? ` · ${age}h ago` : ""}
      </span>
    );
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.25rem",
        fontSize: "0.65rem",
        fontWeight: 600,
        padding: "0.125rem 0.4375rem",
        borderRadius: 10,
        background: "var(--bg-subtle)",
        color: "var(--text-muted)",
        border: "1px solid var(--border-light)",
        whiteSpace: "nowrap",
      }}
    >
      <WifiOff size={9} />
      AI Estimated
    </span>
  );
}
