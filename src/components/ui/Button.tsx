"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";
import { Loader2 } from "lucide-react";

type ButtonVariant =
  | "primary"   /* dark fill — primary CTA */
  | "secondary" /* outlined — default */
  | "ghost"     /* no border */
  | "danger"    /* rose tint */
  | "emerald"   /* green tint */
  | "gold"      /* amber tint (compat alias for primary-ish) */
  | "outline";  /* compat alias for secondary */

type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  className?: string;
  icon?: ReactNode;
  fullWidth?: boolean;
  style?: React.CSSProperties;
}

const VARIANT_STYLES: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background: "var(--text-primary)",
    color: "white",
    border: "1px solid var(--text-primary)",
    fontWeight: 500,
  },
  gold: {
    background: "var(--text-primary)",
    color: "white",
    border: "1px solid var(--text-primary)",
    fontWeight: 500,
  },
  secondary: {
    background: "var(--bg-surface)",
    color: "var(--text-primary)",
    border: "1px solid var(--border-medium)",
    fontWeight: 500,
  },
  outline: {
    background: "var(--bg-surface)",
    color: "var(--text-primary)",
    border: "1px solid var(--border-medium)",
    fontWeight: 500,
  },
  ghost: {
    background: "transparent",
    color: "var(--text-secondary)",
    border: "1px solid transparent",
    fontWeight: 500,
  },
  danger: {
    background: "var(--rose-bg)",
    color: "var(--rose)",
    border: "1px solid var(--rose-border)",
    fontWeight: 500,
  },
  emerald: {
    background: "var(--emerald-bg)",
    color: "var(--emerald)",
    border: "1px solid var(--emerald-border)",
    fontWeight: 500,
  },
};

const SIZE_STYLES: Record<ButtonSize, React.CSSProperties> = {
  sm: { fontSize: "var(--text-xs)", padding: "0.375rem 0.75rem", borderRadius: "var(--radius-md)", height: "1.875rem" },
  md: { fontSize: "var(--text-sm)", padding: "0.5rem 1rem",      borderRadius: "var(--radius-md)", height: "2.25rem"  },
  lg: { fontSize: "var(--text-base)", padding: "0.625rem 1.25rem", borderRadius: "var(--radius-lg)", height: "2.625rem" },
};

export function Button({
  children,
  variant = "secondary",
  size = "md",
  loading,
  disabled,
  onClick,
  type = "button",
  className,
  icon,
  fullWidth,
  style,
}: ButtonProps) {
  const isDisabled = disabled ?? loading ?? false;

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      whileHover={isDisabled ? {} : { opacity: 0.85 }}
      whileTap={isDisabled ? {} : { scale: 0.98 }}
      transition={{ duration: 0.1 }}
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap select-none",
        isDisabled && "opacity-50 cursor-not-allowed",
        !isDisabled && "cursor-pointer",
        fullWidth && "w-full",
        className
      )}
      style={{
        ...VARIANT_STYLES[variant],
        ...SIZE_STYLES[size],
        ...style,
      }}
    >
      {loading ? (
        <Loader2 size={14} className="animate-spin" />
      ) : icon ? (
        <span style={{ flexShrink: 0, display: "inline-flex" }}>{icon}</span>
      ) : null}
      {children}
    </motion.button>
  );
}
