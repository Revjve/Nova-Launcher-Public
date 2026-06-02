import type { ReactNode } from "react";
import { Card } from "./Card";
import { ProgressBar } from "./ProgressBar";
import { StatusPill } from "./StatusPill";

type ProgressPanelProps = {
  title: string;
  description: string;
  statusLabel: string;
  statusTone?: "neutral" | "info" | "success" | "warning" | "error";
  progress?: number;
  footer?: ReactNode;
  children?: ReactNode;
};

export const ProgressPanel = ({
  title,
  description,
  statusLabel,
  statusTone = "info",
  progress = 0,
  footer,
  children
}: ProgressPanelProps) => (
  <Card className="p-5" glow>
    <div className="flex items-start justify-between gap-4">
      <div>
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-[var(--soft-text)]">{description}</p>
      </div>
      <StatusPill label={statusLabel} tone={statusTone} />
    </div>
    <ProgressBar value={progress} className="mt-5" />
    {children ? <div className="mt-4">{children}</div> : null}
    {footer ? <div className="mt-5 flex flex-wrap gap-3">{footer}</div> : null}
  </Card>
);
