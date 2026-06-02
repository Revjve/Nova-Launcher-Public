import type { PropsWithChildren, ReactNode } from "react";
import { Card } from "./Card";

type SettingsSectionProps = PropsWithChildren<{
  eyebrow?: string;
  title: string;
  description?: string;
  aside?: ReactNode;
}>;

export const SettingsSection = ({
  eyebrow,
  title,
  description,
  aside,
  children
}: SettingsSectionProps) => {
  const showEyebrow = eyebrow && eyebrow.trim().toLowerCase() !== title.trim().toLowerCase();

  return (
    <Card className="p-[var(--card-padding)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          {showEyebrow ? <p className="text-xs font-medium text-[var(--muted-text)]">{eyebrow}</p> : null}
          <h3 className="mt-1 text-xl font-semibold text-white">{title}</h3>
          {description ? <p className="mt-2 text-sm text-[var(--soft-text)]">{description}</p> : null}
        </div>
        {aside ? <div className="shrink-0">{aside}</div> : null}
      </div>
      <div className="mt-5">{children}</div>
    </Card>
  );
};
