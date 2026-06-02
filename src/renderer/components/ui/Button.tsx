import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@renderer/lib/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-[var(--field-radius)] text-sm font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border border-[var(--accent-border)] bg-[var(--accent-solid)] text-[var(--accent-contrast)] shadow-[inset_0_1px_0_rgba(255,255,255,0.18),var(--button-shadow-subtle)] hover:bg-[var(--accent-solid-hover)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.18),var(--button-shadow-strong)]",
        secondary:
          "border border-[var(--panel-border-strong)] bg-[var(--surface-2)] text-white shadow-[0_0_0_1px_transparent,0_0_0_transparent] hover:border-[var(--accent-border)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-text)] hover:shadow-[var(--button-shadow-subtle)]",
        ghost: "text-[var(--soft-text)] hover:bg-[var(--surface-3)] hover:text-white",
        destructive: "bg-red-600/80 text-white hover:bg-red-600",
        outline:
          "border border-[var(--panel-border)] bg-transparent text-[var(--soft-text)] shadow-[0_0_0_1px_transparent,0_0_0_transparent] hover:border-[var(--accent-border)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-text)] hover:shadow-[var(--button-shadow-subtle)]"
      },
      size: {
        default: "h-[var(--control-height-md)] px-4 py-2",
        sm: "h-[var(--control-height-sm)] px-3.5 text-[13px]",
        lg: "h-[calc(var(--control-height-md)+4px)] px-8 text-[15px]",
        icon: "size-[var(--control-height-md)]"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  glow?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, glow = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(
          buttonVariants({ variant, size, className }),
          glow && "shadow-[var(--button-shadow-strong)]"
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
