import React, { HTMLAttributes, forwardRef } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "subtle" | "dark" | "outline";
}

const CARD_VARIANTS = {
  default: "bg-white border-[#d8ddd7] text-[#151817]",
  subtle: "bg-[#e9ede7] border-[#d8ddd7] text-[#151817]",
  dark: "bg-[#173d2c] border-[#173d2c] text-white",
  outline: "bg-transparent border-[#d8ddd7] text-[#151817]",
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = "default", className = "", children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`border rounded-[3px] overflow-hidden ${CARD_VARIANTS[variant]} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Card.displayName = "Card";

export function CardHeader({
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`px-5 py-4 sm:px-6 sm:py-5 border-b border-[#d8ddd7] space-y-1 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={`font-display text-base sm:text-lg font-semibold tracking-tight text-inherit leading-snug ${className}`}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={`text-xs text-[#6b746e] leading-relaxed ${className}`}
      {...props}
    >
      {children}
    </p>
  );
}

export function CardContent({
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`p-5 sm:p-6 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`px-5 py-3.5 sm:px-6 sm:py-4 border-t border-[#d8ddd7] bg-[#f4f5f1]/60 flex items-center justify-between text-xs ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
