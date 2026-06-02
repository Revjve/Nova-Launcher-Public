import { useMemo } from "react";
import { ArrowDown2, Code, DocumentText } from "iconsax-react";
import { ConsolePanel } from "@renderer/components/launch/ConsolePanel";
import { Card } from "@renderer/components/ui/Card";
import { PageHeader } from "@renderer/components/ui/PageHeader";
import { StatusPill } from "@renderer/components/ui/StatusPill";
import { formatBytes } from "@renderer/lib/format";
import { useLauncherStore } from "@renderer/state/useLauncherStore";

export const Downloads = () => {
  const downloads = useLauncherStore((state) => state.downloads);
  const launchLogs = useLauncherStore((state) => state.launchLogs);
  const launchStatus = useLauncherStore((state) => state.launchStatus);
  const settings = useLauncherStore((state) => state.settings);
  const clearLaunchLogs = useLauncherStore((state) => state.clearLaunchLogs);
  const saveLogsToFile = useLauncherStore((state) => state.saveLogsToFile);
  const openPath = useLauncherStore((state) => state.openPath);

  const activeDownloads = useMemo(
    () => downloads.filter((task) => task.status === "queued" || task.status === "running"),
    [downloads]
  );
  const activeTransfer = activeDownloads[0];

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Console" title="Console" description="Launcher and game logs." />

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between lg:px-6">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-full border border-[var(--panel-border)] bg-[var(--surface-2)]">
              <Code size={18} variant="Bulk" className="text-[var(--accent-text)]" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">{launchStatus?.message ?? "Idle"}</p>
              <p className="text-xs text-nova-500">
                {activeDownloads.length > 0
                  ? `${activeDownloads.length} active download${activeDownloads.length === 1 ? "" : "s"}`
                  : "No active downloads"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <StatusPill label={launchStatus?.state?.replace(/-/g, " ") ?? "idle"} compact />
            {activeTransfer?.bytesTotal ? (
              <span className="inline-flex items-center gap-2 text-xs text-nova-500">
                <ArrowDown2 size={14} variant="Linear" />
                {formatBytes(activeTransfer.bytesTransferred)} / {formatBytes(activeTransfer.bytesTotal)}
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 text-xs text-nova-500">
                <DocumentText size={14} variant="Linear" />
                {launchLogs.length} lines
              </span>
            )}
          </div>
        </div>
      </Card>

      <ConsolePanel
        logs={launchLogs}
        status={launchStatus}
        defaultAutoScroll={settings.autoScrollConsole}
        onClear={clearLaunchLogs}
        onSave={(sourcePath) => void saveLogsToFile(sourcePath)}
        onOpenLogsFolder={(path: string) => void openPath(path)}
      />
    </div>
  );
};
