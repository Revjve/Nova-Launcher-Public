import type { ReactNode } from "react";
import { Warning2 } from "iconsax-react";
import { cn } from "@renderer/lib/cn";

type ErrorCalloutProps = {
  title: string;
  message: string;
  tone?: "error" | "warning" | "info";
  actions?: ReactNode;
  details?: ReactNode;
};

const toneClasses = {
  error: "border-red-500/20 bg-red-500/10 text-red-50",
  warning: "border-amber-500/20 bg-amber-500/10 text-amber-50",
  info: "border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent-text)]"
};

export const ErrorCallout = ({ title, message, tone = "error", actions, details }: ErrorCalloutProps) => (
  <div className={cn("rounded-[28px] border p-5", toneClasses[tone])}>
    <div className="flex items-start gap-3">
      <Warning2 size={18} variant="Bulk" className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-2 text-sm leading-6 opacity-90">{message}</p>
        {details ? (
          <details className="mt-4 rounded-2xl border border-[var(--panel-border)] bg-black/15 p-3 text-sm">
            <summary className="cursor-pointer font-medium">Technical details</summary>
            <div className="mt-3 text-xs leading-6 opacity-90">{details}</div>
          </details>
        ) : null}
        {actions ? <div className="mt-4 flex flex-wrap gap-3">{actions}</div> : null}
      </div>
    </div>
  </div>
);
