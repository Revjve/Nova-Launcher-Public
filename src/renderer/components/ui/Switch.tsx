import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";
import { cn } from "@renderer/lib/cn";

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> & {
    label?: string;
    hint?: string;
  }
>(({ className, label, hint, ...props }, ref) => {
  const control = (
    <SwitchPrimitives.Root
      className={cn(
        "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-[var(--panel-border)] bg-[var(--surface-3)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--focus-ring-offset)] disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-[var(--accent-border)] data-[state=checked]:bg-[var(--accent-solid)]",
        className
      )}
      {...props}
      ref={ref}
    >
      <SwitchPrimitives.Thumb
        className={cn(
          "pointer-events-none block h-4 w-4 rounded-full bg-[var(--accent-text)] shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0.5"
        )}
      />
    </SwitchPrimitives.Root>
  );

  if (!label) {
    return control;
  }

  return (
    <div className="flex items-center justify-between rounded-[var(--field-radius)] border border-[var(--panel-border)] bg-[var(--surface-2)] px-3.5 py-3">
      <div className="pr-4">
        <p className="text-sm text-white">{label}</p>
        {hint ? <p className="mt-1 text-xs text-[var(--muted-text)]">{hint}</p> : null}
      </div>
      {control}
    </div>
  );
});
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
