import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";

interface PageHeaderProps {
  title: string;
  /** Body text under the title */
  subtitle?: string;
  /** Alias for subtitle */
  description?: string;
  /** Optional icon (kept for backward compat — rendered as accent square) */
  icon?: LucideIcon;
  /** Icon color (kept for backward compat) */
  iconColor?: string;
  actions?: ReactNode;
  badge?: { label: string; color?: string };
}

export function PageHeader({
  title,
  subtitle,
  description,
  icon: Icon,
  iconColor = "var(--amber)",
  actions,
  badge,
}: PageHeaderProps) {
  const body = description ?? subtitle;

  return (
    <div
      style={{
        padding: "2rem 2rem 1.5rem",
        borderBottom: "1px solid var(--border-light)",
        background: "var(--bg-surface)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: "1rem",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "0.875rem" }}>
        {Icon && (
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "var(--radius-md)",
              background: `${iconColor}18`,
              border: `1px solid ${iconColor}30`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              marginTop: 2,
            }}
          >
            <Icon size={18} style={{ color: iconColor }} />
          </div>
        )}
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.625rem",
              marginBottom: body ? "0.25rem" : 0,
            }}
          >
            <h1
              style={{
                fontSize: "var(--text-2xl)",
                fontWeight: 600,
                color: "var(--text-primary)",
                margin: 0,
                lineHeight: 1.2,
                letterSpacing: "-0.02em",
              }}
            >
              {title}
            </h1>
            {badge && (
              <span
                style={{
                  fontSize: "var(--text-xs)",
                  fontWeight: 500,
                  padding: "0.125rem 0.5rem",
                  borderRadius: 20,
                  background: badge.color
                    ? `${badge.color}15`
                    : "var(--bg-subtle)",
                  color: badge.color ?? "var(--text-secondary)",
                  border: `1px solid ${badge.color ? `${badge.color}30` : "var(--border-light)"}`,
                }}
              >
                {badge.label}
              </span>
            )}
          </div>
          {body && (
            <p
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--text-secondary)",
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              {body}
            </p>
          )}
        </div>
      </div>
      {actions && (
        <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {actions}
        </div>
      )}
    </div>
  );
}
