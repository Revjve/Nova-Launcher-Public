import { memo } from "react";
import { Trash2 } from "lucide-react";
import type { InstalledMod, ModrinthVersionOption } from "@shared/types";
import { formatBytes } from "@renderer/lib/format";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { ModVersionSelect, formatModVersionLabel } from "../mods/ModVersionSelect";

type ModRowProps = {
  mod: InstalledMod;
  versions?: ModrinthVersionOption[];
  selectedVersionId?: string;
  loadingVersions?: boolean;
  changingVersion?: boolean;
  versionError?: string;
  instanceBusy?: boolean;
  onLoadVersions?: () => void;
  onSelectVersion?: (versionId: string) => void;
  onChangeVersion?: () => void;
  onToggle: (mod: InstalledMod, enabled: boolean) => void;
  onDelete: (mod: InstalledMod) => void;
};

const sourceLabel = (source: InstalledMod["source"]) => (source === "modrinth" ? "Modrinth" : "Manual mod");

export const ModRow = memo(function ModRow({
  mod,
  versions,
  selectedVersionId,
  loadingVersions,
  changingVersion,
  versionError,
  instanceBusy,
  onLoadVersions,
  onSelectVersion,
  onChangeVersion,
  onToggle,
  onDelete
}: ModRowProps) {
  const isManaged = mod.source === "modrinth" && Boolean(mod.projectId);
  const hasLoadedVersions = Array.isArray(versions);
  const selectedVersion = versions?.find((option) => option.id === selectedVersionId);
  const currentVersionId = mod.versionId ?? mod.fileId;
  const canChangeVersion = Boolean(
    isManaged && selectedVersionId && selectedVersionId !== currentVersionId && onChangeVersion
  );
  const noCompatibleVersions = isManaged && hasLoadedVersions && versions.length === 0;

  return (
    <div className="rounded-[var(--panel-radius)] border border-[var(--panel-border)] bg-[var(--surface-3)] px-4 py-4 text-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-medium text-white">{mod.displayName}</p>
            <Badge variant={mod.source === "modrinth" ? "secondary" : "default"}>{sourceLabel(mod.source)}</Badge>
            {mod.updateAvailable ? <Badge variant="warning">Update available</Badge> : null}
            {changingVersion ? <Badge variant="secondary">Changing version</Badge> : null}
            {!changingVersion && isManaged ? <Badge variant="success">Installed</Badge> : null}
            {!isManaged ? <Badge variant="default">Manual mod</Badge> : null}
            {noCompatibleVersions ? <Badge variant="warning">No compatible versions</Badge> : null}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted-text)]">
            <span>Current: {mod.version}</span>
            {mod.loader ? <span>{mod.loader}</span> : null}
            {mod.minecraftVersions?.length ? <span>{mod.minecraftVersions.join(", ")}</span> : null}
            {mod.releaseChannel ? <span>{mod.releaseChannel}</span> : null}
            {mod.fileSizeBytes ? <span>{formatBytes(mod.fileSizeBytes)}</span> : null}
          </div>

          {mod.updateError ? <p className="text-xs text-amber-200">{mod.updateError}</p> : null}
          {versionError ? <p className="text-xs text-amber-200">{versionError}</p> : null}
          {instanceBusy ? <p className="text-xs text-[var(--muted-text)]">Close the game before changing mod files.</p> : null}
        </div>

        <div className="flex w-full flex-col items-stretch gap-2 xl:w-[280px] xl:items-end">
          {isManaged ? (
            <ModVersionSelect
              value={selectedVersionId}
              options={versions ?? []}
              loading={loadingVersions}
              disabled={instanceBusy || changingVersion}
              emptyLabel="No compatible version"
              placeholder="Version"
              onOpenChange={(open) => {
                if (open && !hasLoadedVersions) {
                  onLoadVersions?.();
                }
              }}
              onValueChange={(value) => onSelectVersion?.(value)}
            />
          ) : null}

          {selectedVersion ? (
            <p className="text-xs text-[var(--muted-text)]">{formatModVersionLabel(selectedVersion)}</p>
          ) : null}

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              variant={mod.enabled ? "secondary" : "outline"}
              size="sm"
              onClick={() => onToggle(mod, !mod.enabled)}
              disabled={changingVersion}
            >
              {mod.enabled ? "Enabled" : "Disabled"}
            </Button>

            {isManaged ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onChangeVersion?.()}
                disabled={!canChangeVersion || changingVersion || instanceBusy}
              >
                {changingVersion ? "Changing..." : canChangeVersion ? "Change version" : "Installed"}
              </Button>
            ) : null}

            <Button
              variant="ghost"
              size="sm"
              className="text-red-200 hover:bg-red-500/10"
              onClick={() => onDelete(mod)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
});
