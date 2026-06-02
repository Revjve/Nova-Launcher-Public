import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@renderer/lib/cn";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent-ring)]",
  {
    variants: {
      variant: {
        default: "border-[var(--panel-border)] bg-[var(--surface-3)] text-[var(--soft-text)]",
        secondary: "border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent-text)]",
        success: "border-emerald-500/20 bg-emerald-500/10 text-emerald-100",
        warning: "border-amber-500/20 bg-amber-500/10 text-amber-100",
        destructive: "border-red-500/20 bg-red-500/10 text-red-100",
        outline: "border-[var(--panel-border)] text-white"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
