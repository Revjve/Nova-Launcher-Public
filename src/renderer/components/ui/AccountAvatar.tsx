import { useEffect, useMemo, useState } from "react";
import { Shield, Star1 } from "iconsax-react";
import type { LauncherAccount } from "@shared/types";
import { cn } from "@renderer/lib/cn";
import { AppIcon } from "./AppIcon";

const normalizeUuid = (value: string) => value.replace(/-/g, "");

const buildAvatarSources = (account: LauncherAccount) => {
  const uuid = normalizeUuid(account.uuid);
  const username = encodeURIComponent(account.username);

  return [
    `https://mc-heads.net/avatar/${uuid}/96`,
    `https://mc-heads.net/avatar/${username}/96`,
    account.avatarUrl,
    `https://crafatar.com/avatars/${uuid}?size=96&overlay`
  ].filter((value): value is string => Boolean(value));
};

type AccountAvatarProps = {
  account: LauncherAccount;
  className?: string;
  imageClassName?: string;
  sizeClassName?: string;
};

export const AccountAvatar = ({
  account,
  className,
  imageClassName,
  sizeClassName = "h-12 w-12"
}: AccountAvatarProps) => {
  const sources = useMemo(() => buildAvatarSources(account), [account]);
  const [sourceIndex, setSourceIndex] = useState(0);

  useEffect(() => {
    setSourceIndex(0);
  }, [account.id, account.uuid, account.username, account.avatarUrl]);

  const source = sources[sourceIndex];

  return (
    <div
      className={cn(
        "grid place-items-center overflow-hidden rounded-full border border-[var(--panel-border-strong)] bg-[var(--surface-2)]",
        sizeClassName,
        className
      )}
    >
      {source ? (
        <img
          src={source}
          alt={account.username}
          className={cn("h-full w-full object-cover [image-rendering:pixelated]", imageClassName)}
          onError={() => {
            if (sourceIndex < sources.length - 1) {
              setSourceIndex((current) => current + 1);
            } else {
              setSourceIndex(sources.length);
            }
          }}
        />
      ) : account.type === "offline-dev" ? (
        <AppIcon icon={Shield} size={18} variant="Bulk" className="text-amber-200" />
      ) : (
        <AppIcon icon={Star1} size={18} variant="Bulk" className="text-[var(--accent-text)]" />
      )}
    </div>
  );
};
