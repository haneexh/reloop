import React, { ButtonHTMLAttributes, forwardRef } from "react";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
}

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary:
    "bg-[#2e7d57] text-white hover:bg-[#246644] active:bg-[#1e5437] border border-[#246644] disabled:bg-[#a3c4b3] disabled:border-[#a3c4b3]",
  secondary:
    "bg-white text-[#151817] hover:bg-[#e9ede7] active:bg-[#dde3da] border border-[#d8ddd7] disabled:bg-[#f4f5f1] disabled:text-[#a1aaa4]",
  outline:
    "bg-transparent text-[#151817] hover:bg-[#e9ede7] active:bg-[#dde3da] border border-[#151817] disabled:text-[#a1aaa4] disabled:border-[#d8ddd7]",
  ghost:
    "bg-transparent text-[#6b746e] hover:text-[#151817] hover:bg-[#e9ede7] active:bg-[#dde3da] border border-transparent disabled:text-[#a1aaa4]",
  danger:
    "bg-[#a3512b] text-white hover:bg-[#8c4422] active:bg-[#783719] border border-[#8c4422] disabled:bg-[#d8a894] disabled:border-[#d8a894]",
};

const SIZE_STYLES: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs gap-1.5 min-h-[32px]",
  md: "px-4 py-2 text-xs font-semibold gap-2 min-h-[40px]",
  lg: "px-5 py-2.5 text-sm font-semibold gap-2.5 min-h-[46px]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      isLoading = false,
      disabled = false,
      className = "",
      children,
      type = "button",
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        className={`inline-flex items-center justify-center font-sans tracking-wide rounded-[3px] transition-colors select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2e7d57] focus-visible:ring-offset-2 disabled:cursor-not-allowed ${VARIANT_STYLES[variant]} ${SIZE_STYLES[size]} ${className}`}
        {...props}
      >
        {isLoading && (
          <span
            className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent mr-1"
            aria-hidden="true"
          />
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
