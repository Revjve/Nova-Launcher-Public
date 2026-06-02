import { memo, useMemo } from "react";
import { ArrowRight2, ImportCurve, RefreshCircle } from "iconsax-react";
import { useNavigate } from "react-router-dom";
import { useLauncherStore } from "@renderer/state/useLauncherStore";
import { formatBytes } from "@renderer/lib/format";
import { ProgressBar } from "../ui/ProgressBar";
import { Button } from "../ui/Button";
import { StatusPill } from "../ui/StatusPill";

export const DownloadDrawer = memo(function DownloadDrawer() {
  const navigate = useNavigate();
  const allDownloads = useLauncherStore((state) => state.downloads);
  const launchStatus = useLauncherStore((state) => state.launchStatus);
  const performanceModeEnabled = useLauncherStore((state) => state.performanceModeEnabled);
  const downloads = useMemo(
    () => allDownloads.filter((task) => task.status === "queued" || task.status === "running").slice(0, 2),
    [allDownloads]
  );

  if (downloads.length === 0 && !launchStatus) {
    return null;
  }

  return (
    <div
      className={`performance-shadow fixed bottom-5 right-5 z-50 w-[min(420px,calc(100vw-2rem))] rounded-[var(--panel-radius)] border border-[var(--panel-border-strong)] bg-[var(--surface-2)] p-4 shadow-[var(--panel-shadow)] ${
        performanceModeEnabled ? "" : "backdrop-blur-xl"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 text-white">
          <div className="mt-0.5 grid h-9 w-9 place-items-center rounded-2xl border border-[var(--panel-border)] bg-[var(--surface-3)]">
            <ImportCurve size={16} variant="Linear" />
          </div>
          <div>
            <p className="text-sm font-semibold">{launchStatus ? "Running" : "Downloads"}</p>
            <p className="text-xs text-[var(--muted-text)]">
              {launchStatus ? launchStatus.message : "Downloads active."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <RefreshCircle size={16} variant="Linear" className="animate-spin text-[var(--soft-text)]" />
          <Button variant="ghost" size="sm" onClick={() => navigate("/console")}>
            <ArrowRight2 size={16} variant="Linear" className="mr-2" />
            Console
          </Button>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {launchStatus ? (
          <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--surface-3)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-white">{launchStatus.message}</p>
                <p className="mt-1 text-xs text-[var(--muted-text)]">{launchStatus.instanceId}</p>
              </div>
              <StatusPill
                label={launchStatus.state.replace(/-/g, " ")}
                compact
                tone={
                  launchStatus.state === "launch-failed" || launchStatus.state === "game-crashed"
                    ? "error"
                    : launchStatus.state === "game-running" || launchStatus.state === "game-exited-successfully"
                      ? "success"
                      : "info"
                }
              />
            </div>
            <ProgressBar value={launchStatus.progress ?? 0} className="mt-3" />
          </div>
        ) : null}

        {downloads.map((task) => {
          const progress =
            task.bytesTotal && task.bytesTotal > 0
              ? (task.bytesTransferred / task.bytesTotal) * 100
              : task.status === "completed"
                ? 100
                : 15;

          return (
            <div key={task.id} className="rounded-2xl border border-[var(--panel-border)] bg-[var(--surface-3)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-white">{task.label}</p>
                  <p className="mt-1 text-xs text-[var(--muted-text)]">
                    {formatBytes(task.bytesTransferred)} transferred
                  </p>
                </div>
                <span className="text-xs text-[var(--muted-text)]">{task.status}</span>
              </div>
              <ProgressBar value={progress} className="mt-3" />
            </div>
          );
        })}
      </div>
    </div>
  );
});
