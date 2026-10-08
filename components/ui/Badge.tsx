import React, { HTMLAttributes } from "react";
import type { SemanticStatusVariant } from "@/lib/status-helper";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: SemanticStatusVariant;
  size?: "sm" | "md";
  showDot?: boolean;
}

const BADGE_VARIANTS: Record<SemanticStatusVariant, { container: string; dot: string }> = {
  neutral: {
    container: "bg-[#e9ede7] text-[#555e58] border-[#d8ddd7]",
    dot: "bg-[#8a948d]",
  },
  info: {
    container: "bg-[#e8f1f5] text-[#1c556e] border-[#c2d9e5]",
    dot: "bg-[#256c8c]",
  },
  warning: {
    container: "bg-[#fef6e9] text-[#8a5b16] border-[#f4ddb5]",
    dot: "bg-[#b7791f]",
  },
  success: {
    container: "bg-[#e6f2e8] text-[#246644] border-[#b8dcbf]",
    dot: "bg-[#2e7d57]",
  },
  danger: {
    container: "bg-[#fbeeed] text-[#93342d] border-[#f0c3bf]",
    dot: "bg-[#a3512b]",
  },
  accent: {
    container: "bg-[#ebf3ed] text-[#173d2c] border-[#9ec4ad]",
    dot: "bg-[#173d2c]",
  },
};

export function Badge({
  variant = "neutral",
  size = "md",
  showDot = false,
  className = "",
  children,
  ...props
}: BadgeProps) {
  const styles = BADGE_VARIANTS[variant] || BADGE_VARIANTS.neutral;
  const sizeClass = size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2.5 py-0.5 text-[11px]";

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium border rounded-[2px] tracking-wide select-none ${styles.container} ${sizeClass} ${className}`}
      {...props}
    >
      {showDot && (
        <span
          className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${styles.dot}`}
          aria-hidden="true"
        />
      )}
      <span>{children}</span>
    </span>
  );
}
