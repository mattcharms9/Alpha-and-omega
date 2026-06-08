import { cn } from "@/lib/utils";
import { ReactNode } from "react";

type BadgeVariant =
  | "default"
  | "emerald"
  | "amber"
  | "rose"
  | "blue"
  | "violet"
  | "muted"
  /* backward-compat aliases */
  | "gold"
  | "cyan";

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
  size?: "sm" | "md";
}

const VARIANT_STYLES: Record<BadgeVariant, React.CSSProperties> = {
  default: {
    background: "var(--bg-subtle)",
    color: "var(--text-secondary)",
    border: "1px solid var(--border-light)",
  },
  muted: {
    background: "var(--bg-subtle)",
    color: "var(--text-muted)",
    border: "1px solid var(--border-light)",
  },
  emerald: {
    background: "var(--emerald-bg)",
    color: "var(--emerald)",
    border: "1px solid var(--emerald-border)",
  },
  amber: {
    background: "var(--amber-bg)",
    color: "var(--amber)",
    border: "1px solid var(--amber-border)",
  },
  gold: {
    background: "var(--amber-bg)",
    color: "var(--amber)",
    border: "1px solid var(--amber-border)",
  },
  rose: {
    background: "var(--rose-bg)",
    color: "var(--rose)",
    border: "1px solid var(--rose-border)",
  },
  blue: {
    background: "var(--blue-bg)",
    color: "var(--blue)",
    border: "1px solid var(--blue-border)",
  },
  cyan: {
    background: "var(--blue-bg)",
    color: "var(--blue)",
    border: "1px solid var(--blue-border)",
  },
  violet: {
    background: "var(--violet-bg)",
    color: "var(--violet)",
    border: "1px solid var(--violet-border)",
  },
};

const SIZE_STYLES: Record<"sm" | "md", React.CSSProperties> = {
  sm: { fontSize: "var(--text-xs)", padding: "0.125rem 0.5rem",  borderRadius: 20, fontWeight: 500 },
  md: { fontSize: "var(--text-sm)", padding: "0.25rem 0.625rem", borderRadius: 20, fontWeight: 500 },
};

export function Badge({ children, variant = "default", className, size = "sm" }: BadgeProps) {
  return (
    <span
      className={cn("inline-flex items-center whitespace-nowrap", className)}
      style={{ ...VARIANT_STYLES[variant], ...SIZE_STYLES[size] }}
    >
      {children}
    </span>
  );
}

export function ScoreBadge({ score }: { score: number }) {
  const variant: BadgeVariant =
    score >= 80 ? "emerald" : score >= 60 ? "amber" : score >= 40 ? "rose" : "muted";
  return <Badge variant={variant}>{score}</Badge>;
}
