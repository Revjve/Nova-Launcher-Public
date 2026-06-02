import type { ReactNode } from "react";
import { Card } from "./Card";

type ActionCardProps = {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
};

export const ActionCard = ({ title, description, icon, action }: ActionCardProps) => (
  <Card className="h-full p-5">
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          {icon ? <div className="text-[var(--soft-text)]">{icon}</div> : null}
          <h3 className="text-base font-semibold text-white">{title}</h3>
        </div>
        <p className="mt-2 text-sm leading-6 text-[var(--soft-text)]">{description}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  </Card>
);
