import * as React from "react";
import { cn } from "@renderer/lib/cn";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-11 w-full rounded-[var(--field-radius)] border border-[var(--panel-border)] bg-[var(--surface-2)] px-3.5 py-2 text-sm text-white placeholder:text-[var(--muted-text)] focus-visible:border-[var(--accent-border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
