import type { PropsWithChildren, ReactNode } from "react";

type PageHeaderProps = PropsWithChildren<{
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}>;

export const PageHeader = ({ eyebrow, title, description, actions, children }: PageHeaderProps) => {
  const showEyebrow = eyebrow.trim().toLowerCase() !== title.trim().toLowerCase();

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-3xl">
        {showEyebrow ? <p className="text-xs font-medium text-[var(--muted-text)]">{eyebrow}</p> : null}
        <h2 className="mt-1 text-3xl font-semibold tracking-tight text-white lg:text-[2rem]">{title}</h2>
        {description ? <p className="mt-2 max-w-2xl text-sm text-[var(--soft-text)]">{description}</p> : null}
        {children}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-3">{actions}</div> : null}
    </div>
  );
};
