"use client";

import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-moss text-canvas hover:bg-moss-deep active:bg-moss shadow-[0_6px_20px_-8px_rgba(79,158,116,0.45)]",
  outline: "border border-line bg-surface-2 text-ink hover:border-moss/60 hover:text-moss",
  ghost: "text-muted hover:text-ink hover:bg-surface-2",
  danger: "border border-clay/40 text-clay hover:bg-clay/10",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-full font-semibold
        transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40
        ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    />
  );
}
