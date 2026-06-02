import type { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

export const EmptyState = ({ title, description, action }: EmptyStateProps) => (
  <div className="rounded-[var(--panel-radius)] border border-dashed border-[var(--panel-border)] bg-[var(--surface-3)] p-[var(--card-padding)] text-center">
    <h3 className="text-lg font-semibold text-white">{title}</h3>
    <p className="mt-2 text-sm text-[var(--soft-text)]">{description}</p>
    {action ? <div className="mt-5">{action}</div> : null}
  </div>
);
