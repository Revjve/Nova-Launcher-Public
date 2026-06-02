import { SecurityUser } from "iconsax-react";
import type { LauncherAccount } from "@shared/types";
import { AccountAvatar } from "./AccountAvatar";
import { Button } from "./Button";
import { Card } from "./Card";
import { StatusPill } from "./StatusPill";

type AccountCardProps = {
  account: LauncherAccount;
  onActivate?: (accountId: string) => void;
  onRemove?: (accountId: string) => void;
};

export const AccountCard = ({ account, onActivate, onRemove }: AccountCardProps) => (
  <Card className="h-full p-[var(--card-padding)]">
    <div className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3">
        <AccountAvatar account={account} sizeClassName="h-10 w-10" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">{account.displayName ?? account.username}</p>
          <p className="mt-1 text-xs text-[var(--soft-text)]">
            {account.type === "offline-dev" ? "Offline Account" : "Ready to use"}
          </p>
        </div>
      </div>
      <StatusPill
        label={account.active ? "Active" : account.type === "offline-dev" ? "Offline" : account.status ?? "Ready"}
        compact
        tone={account.active ? "success" : account.type === "offline-dev" ? "warning" : "info"}
      />
    </div>

    <div className="mt-4 flex flex-wrap gap-2">
      {onActivate ? (
        <Button size="sm" variant={account.active ? "secondary" : "default"} onClick={() => onActivate(account.id)}>
          <SecurityUser size={18} variant={account.active ? "Linear" : "Bold"} className="mr-2" />
          {account.active ? "Selected" : "Use account"}
        </Button>
      ) : null}
      {onRemove ? (
        <Button size="sm" variant="ghost" onClick={() => onRemove(account.id)}>
          Remove
        </Button>
      ) : null}
    </div>
  </Card>
);
