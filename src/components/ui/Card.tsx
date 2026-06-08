"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  /** Kept for backward compat — renders a subtle amber border tint */
  gold?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
  padding?: "none" | "sm" | "md" | "lg";
}

export function Card({ children, className, hover, gold, onClick, style, padding }: CardProps) {
  const paddingValue = padding === "none" ? 0 : padding === "sm" ? "0.75rem" : padding === "lg" ? "1.75rem" : padding === "md" ? "1.25rem" : undefined;

  const baseStyle: React.CSSProperties = {
    background: "var(--bg-surface)",
    border: `1px solid ${gold ? "var(--amber-border)" : "var(--border-light)"}`,
    borderRadius: "var(--radius-lg)",
    boxShadow: "var(--shadow-xs)",
    ...(paddingValue !== undefined ? { padding: paddingValue } : {}),
    ...style,
  };

  if (hover || onClick) {
    return (
      <motion.div
        whileHover={{ y: -1, boxShadow: "var(--shadow-sm)" }}
        transition={{ duration: 0.15 }}
        onClick={onClick}
        className={cn("relative overflow-hidden", onClick && "cursor-pointer", className)}
        style={baseStyle}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden", className)} style={baseStyle}>
      {children}
    </div>
  );
}

interface CardSectionProps {
  children: ReactNode;
  className?: string;
}

export function CardHeader({ children, className }: CardSectionProps) {
  return (
    <div
      className={cn("flex items-center justify-between", className)}
      style={{ padding: "1.25rem 1.25rem 0" }}
    >
      {children}
    </div>
  );
}

export function CardBody({ children, className }: CardSectionProps) {
  return (
    <div className={cn(className)} style={{ padding: "1.25rem" }}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className }: CardSectionProps) {
  return (
    <div
      className={cn(className)}
      style={{
        padding: "0.75rem 1.25rem",
        borderTop: "1px solid var(--border-light)",
      }}
    >
      {children}
    </div>
  );
}
