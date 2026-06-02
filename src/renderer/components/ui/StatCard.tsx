import type { LucideIcon } from "lucide-react";
import { Card } from "./Card";

type StatCardProps = {
  label: string;
  value: string;
  helper?: string;
  icon?: LucideIcon;
};

export const StatCard = ({ label, value, helper, icon: Icon }: StatCardProps) => (
  <Card className="h-full p-5">
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm text-[var(--muted-text)]">{label}</p>
      {Icon ? <Icon className="h-4 w-4 text-[var(--soft-text)]" /> : null}
    </div>
    <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
    {helper ? <p className="mt-2 text-sm leading-6 text-[var(--soft-text)]">{helper}</p> : null}
  </Card>
);
