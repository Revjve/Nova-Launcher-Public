import { memo } from "react";
import { DriverRefresh, FolderOpen, More, PlayCircle, Trash } from "iconsax-react";
import type { Instance } from "@shared/types";
import { formatRelativeDate, loaderLabel } from "@renderer/lib/format";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "../ui/DropdownMenu";
import { StatusPill } from "../ui/StatusPill";

type InstanceCardProps = {
  instance: Instance;
  modsCount?: number;
  selected?: boolean;
  onSelect?: (instanceId: string) => void;
  onPlay: (instanceId: string) => void;
  onRepair: (instanceId: string) => void;
  onOpenFolder?: (instanceId: string, path: string) => void;
  onOpenLogs?: (instanceId: string) => void;
  onDelete?: (instanceId: string) => void;
  onManage?: (instanceId: string) => void;
};

const installTone = (status?: Instance["installStatus"]) => {
  switch (status) {
    case "ready":
      return "success" as const;
    case "failed":
      return "error" as const;
    case "needs-repair":
      return "warning" as const;
    case "installing":
      return "info" as const;
    default:
      return "neutral" as const;
  }
};

export const InstanceCard = memo(function InstanceCard({
  instance,
  modsCount,
  selected,
  onSelect,
  onPlay,
  onRepair,
  onOpenFolder,
  onOpenLogs,
  onDelete,
  onManage
}: InstanceCardProps) {
  return (
    <Card className={selected ? "border-[var(--panel-border-strong)] bg-[var(--surface-2)]" : undefined}>
      <div className="flex h-full flex-col gap-4 p-[var(--card-padding)]">
        <div className="flex items-start justify-between gap-3">
          <button type="button" className="min-w-0 text-left" onClick={() => onSelect?.(instance.id)}>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-base font-semibold text-white">{instance.name}</h3>
              {selected ? <StatusPill label="Selected" tone="success" compact /> : null}
            </div>
            <p className="mt-1 text-sm text-[var(--soft-text)]">
              Minecraft {instance.minecraftVersion}
              {instance.loaderVersion ? ` / ${instance.loaderVersion}` : ""}
            </p>
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="More instance actions">
                <More size={18} variant="Linear" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onManage?.(instance.id)}>Edit</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onRepair(instance.id)}>
                <DriverRefresh size={16} variant="Linear" className="mr-2" />
                Repair
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onOpenFolder?.(instance.id, instance.paths.root)}>
                <FolderOpen size={16} variant="Linear" className="mr-2" />
                Open folder
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onOpenLogs?.(instance.id)}>View logs</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-red-200 focus:text-red-100" onClick={() => onDelete?.(instance.id)}>
                <Trash size={16} variant="Linear" className="mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="grid gap-2 text-sm text-[var(--soft-text)] sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <p className="text-xs text-[var(--muted-text)]">Loader</p>
            <p className="mt-1 text-white">{loaderLabel(instance.loader)}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--muted-text)]">Mods</p>
            <p className="mt-1 text-white">{modsCount === undefined ? "Loading..." : modsCount}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--muted-text)]">Last played</p>
            <p className="mt-1 text-white">{formatRelativeDate(instance.lastPlayedAt)}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--muted-text)]">Status</p>
            <div className="mt-1">
              <StatusPill label={instance.installStatus ?? "ready"} tone={installTone(instance.installStatus)} compact />
            </div>
          </div>
        </div>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-[var(--divider-color)] pt-4">
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => onManage?.(instance.id)}>
              Manage
            </Button>
            <Button size="sm" onClick={() => onPlay(instance.id)}>
              <PlayCircle size={18} variant="Bold" className="mr-2" />
              Play
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
});
