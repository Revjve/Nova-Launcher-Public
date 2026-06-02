import { useMemo } from "react";
import { Copy, DocumentText, FolderOpen, PlayCircle } from "iconsax-react";
import type { LaunchLogEntry, LaunchStatusEvent } from "@shared/types";
import { Button } from "@renderer/components/ui/Button";
import { Card } from "@renderer/components/ui/Card";
import { ErrorCallout } from "@renderer/components/ui/ErrorCallout";
import { Progress } from "@renderer/components/ui/Progress";
import { StatusPill } from "@renderer/components/ui/StatusPill";
import { useLauncherStore } from "@renderer/state/useLauncherStore";

const stateTone = (state?: LaunchStatusEvent["state"]) => {
  if (!state || state === "idle") return "neutral" as const;
  if (state === "launch-failed" || state === "game-crashed") return "error" as const;
  if (state === "game-exited-successfully" || state === "game-running") return "success" as const;
  return "info" as const;
};

const stateLabel = (state?: LaunchStatusEvent["state"]) => (state ?? "idle").replace(/-/g, " ");
const latestDirectory = (path?: string) => path?.replace(/[\\/][^\\/]+$/, "");

const getFailureGuidance = (status?: LaunchStatusEvent) => {
  const raw = `${status?.errorSummary ?? ""} ${status?.message ?? ""}`.toLowerCase();

  if (raw.includes("java")) {
    return {
      title: "Java setup needed",
      message: "Nova could not find a usable Java runtime for this instance.",
      suggestion: "Open Java settings and choose a Java executable. Java 21 is required for Minecraft 1.20.5 and newer.",
      showJavaSettings: true,
      showRepair: false
    };
  }

  if (
    raw.includes("download") ||
    raw.includes("asset") ||
    raw.includes("library") ||
    raw.includes("manifest") ||
    raw.includes("network")
  ) {
    return {
      title: "Download failed",
      message: "Nova could not finish downloading the files needed for launch.",
      suggestion: "Check your connection, then repair the instance and try again.",
      showJavaSettings: false,
      showRepair: true
    };
  }

  if (raw.includes("fabric") || raw.includes("forge") || raw.includes("neoforge") || raw.includes("loader")) {
    return {
      title: "Loader setup failed",
      message: "Nova could not prepare the selected loader for this instance.",
      suggestion: "Repair the instance to reinstall the loader files, then try again.",
      showJavaSettings: false,
      showRepair: true
    };
  }

  if (raw.includes("mod")) {
    return {
      title: "Mod compatibility issue",
      message: "One or more mods blocked launch for this instance.",
      suggestion: "Open the console for details, then remove the incompatible mod or repair the instance.",
      showJavaSettings: false,
      showRepair: true
    };
  }

  return {
    title: status?.state === "game-crashed" ? "Game crashed" : "Launch failed",
    message: status?.errorSummary ?? status?.message ?? "Nova could not finish starting the game.",
    suggestion: "Open the console for details or repair the instance and try again.",
    showJavaSettings: false,
    showRepair: true
  };
};

type LaunchStatusPanelProps = {
  instanceId?: string;
  instancePath?: string;
  status?: LaunchStatusEvent;
  logs: LaunchLogEntry[];
  onOpenConsole: () => void;
  onCopyLogs: () => void;
  onOpenLogsFolder: (path: string) => void;
  onOpenInstanceFolder?: () => void;
  onOpenJavaSettings?: () => void;
  onRepair?: () => void;
};

export const LaunchStatusPanel = ({
  instanceId,
  instancePath,
  status,
  logs,
  onOpenConsole,
  onCopyLogs,
  onOpenLogsFolder,
  onOpenInstanceFolder,
  onOpenJavaSettings,
  onRepair
}: LaunchStatusPanelProps) => {
  const settings = useLauncherStore((state) => state.settings);
  const launchCommandPreview = useLauncherStore((state) =>
    instanceId ? state.launchCommandPreviewByInstance[instanceId] : undefined
  );
  const logFolder = useMemo(() => latestDirectory(status?.latestLogPath), [status?.latestLogPath]);
  const technicalDetails = [
    status?.failedUrl ? `URL: ${status.failedUrl}` : undefined,
    status?.destinationPath ? `Destination: ${status.destinationPath}` : undefined,
    status?.crashReportPath ? `Crash report: ${status.crashReportPath}` : undefined,
    status?.latestLogPath ? `Latest log: ${status.latestLogPath}` : undefined,
    status?.exitCode !== undefined ? `Exit code: ${status.exitCode}` : undefined
  ]
    .filter(Boolean)
    .join("\n");
  const showCommandPreview = import.meta.env.DEV || settings.showAdvancedLaunchCommand || settings.developerMode;
  const failureGuidance = useMemo(() => getFailureGuidance(status), [status]);
  const failureDetails = [
    failureGuidance.suggestion ? `Suggested fix: ${failureGuidance.suggestion}` : undefined,
    technicalDetails || undefined
  ]
    .filter(Boolean)
    .join("\n\n");

  return (
    <div className="space-y-3">
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--divider-color)] px-5 py-4 lg:px-6">
          <div>
            <p className="text-xs text-[var(--muted-text)]">Status</p>
            <h3 className="mt-2 text-xl font-semibold text-white">Launch status</h3>
          </div>
          <StatusPill label={stateLabel(status?.state)} tone={stateTone(status?.state)} />
        </div>

        <div className="space-y-5 px-5 py-5 lg:px-6 lg:py-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-[var(--soft-text)]">
              <span>{status?.message ?? "Ready to launch"}</span>
              <span>{Math.round(status?.progress ?? 0)}%</span>
            </div>
            <Progress value={status?.progress ?? 0} />
          </div>

          {showCommandPreview && launchCommandPreview ? (
            <details className="rounded-[var(--field-radius)] border border-[var(--panel-border)] bg-[var(--surface-3)] p-4 text-xs text-[var(--soft-text)]">
              <summary className="cursor-pointer font-medium text-white">Launch command</summary>
              <pre className="mt-3 whitespace-pre-wrap break-all font-mono text-[11px] leading-5">
                {launchCommandPreview}
              </pre>
            </details>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={onOpenConsole}>
              <DocumentText size={18} variant="Linear" className="mr-2" />
              Console
            </Button>
            <Button variant="ghost" size="sm" onClick={onCopyLogs} disabled={logs.length === 0}>
              <Copy size={18} variant="Linear" className="mr-2" />
              Copy
            </Button>
            {logFolder ? (
              <Button variant="ghost" size="sm" onClick={() => onOpenLogsFolder(logFolder)}>
                <FolderOpen size={18} variant="Linear" className="mr-2" />
                Logs
              </Button>
            ) : null}
          </div>
        </div>
      </Card>

      {status?.state === "launch-failed" || status?.state === "game-crashed" ? (
        <ErrorCallout
          title={failureGuidance.title}
          message={failureGuidance.message}
          details={
            failureDetails ? <pre className="whitespace-pre-wrap font-inherit">{failureDetails}</pre> : undefined
          }
          actions={
            <>
              <Button variant="secondary" size="sm" onClick={onOpenConsole}>
                <PlayCircle size={18} variant="Linear" className="mr-2" />
                View console
              </Button>
              {failureGuidance.showRepair && onRepair ? (
                <Button variant="secondary" size="sm" onClick={onRepair}>
                  Repair instance
                </Button>
              ) : null}
              {failureGuidance.showJavaSettings && onOpenJavaSettings ? (
                <Button variant="secondary" size="sm" onClick={onOpenJavaSettings}>
                  Java settings
                </Button>
              ) : null}
              {instancePath && onOpenInstanceFolder ? (
                <Button variant="ghost" size="sm" onClick={onOpenInstanceFolder}>
                  <FolderOpen size={18} variant="Linear" className="mr-2" />
                  Instance folder
                </Button>
              ) : null}
              <Button variant="ghost" size="sm" onClick={onCopyLogs} disabled={logs.length === 0}>
                Copy details
              </Button>
            </>
          }
        />
      ) : null}
    </div>
  );
};
