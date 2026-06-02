import { useEffect, useMemo } from "react";
import {
  Add,
  Code,
  DriverRefresh,
  FolderOpen,
  Layer,
  Login,
  PlayCircle,
  Setting2,
  Shield,
  UserSquare,
} from "iconsax-react";
import { Link, useNavigate } from "react-router-dom";
import { LaunchStatusPanel } from "@renderer/components/launch/LaunchStatusPanel";
import { Button } from "@renderer/components/ui/Button";
import { Card } from "@renderer/components/ui/Card";
import { EmptyState } from "@renderer/components/ui/EmptyState";
import { PageHeader } from "@renderer/components/ui/PageHeader";
import { StatusPill } from "@renderer/components/ui/StatusPill";
import { formatRelativeDate, loaderLabel } from "@renderer/lib/format";
import { useLauncherStore } from "@renderer/state/useLauncherStore";

const busyStates = new Set([
  "preparing-instance",
  "validating-instance",
  "checking-java",
  "resolving-version",
  "downloading-version-manifest",
  "downloading-client",
  "checking-loader",
  "installing-loader",
  "checking-installed-mods",
  "checking-sodium-compatibility",
  "downloading-libraries",
  "downloading-assets",
  "extracting-natives",
  "building-classpath",
  "launching-game"
]);

const requiresJava21 = (minecraftVersion?: string) => {
  if (!minecraftVersion) {
    return false;
  }

  const match = minecraftVersion.match(/^1\.(\d+)(?:\.(\d+))?/);
  if (!match) {
    return false;
  }

  const minor = Number(match[1] ?? 0);
  const patch = Number(match[2] ?? 0);

  return minor > 20 || (minor === 20 && patch >= 5);
};

export const Home = () => {
  const navigate = useNavigate();
  const instances = useLauncherStore((state) => state.instances);
  const accounts = useLauncherStore((state) => state.accounts);
  const selectedInstanceId = useLauncherStore((state) => state.selectedInstanceId);
  const launchStatus = useLauncherStore((state) => state.launchStatus);
  const launchLogs = useLauncherStore((state) => state.launchLogs);
  const javaInstallations = useLauncherStore((state) => state.javaInstallations);
  const javaScanComplete = useLauncherStore((state) => state.javaScanComplete);
  const launchInstance = useLauncherStore((state) => state.launchInstance);
  const repairInstance = useLauncherStore((state) => state.repairInstance);
  const addMicrosoftAccount = useLauncherStore((state) => state.addMicrosoftAccount);
  const addOfflineDevAccount = useLauncherStore((state) => state.addOfflineDevAccount);
  const openPath = useLauncherStore((state) => state.openPath);
  const modsByInstance = useLauncherStore((state) => state.modsByInstance);
  const loadMods = useLauncherStore((state) => state.loadMods);

  const activeAccount = useMemo(() => accounts.find((account) => account.active), [accounts]);
  const selectedInstance = useMemo(
    () => instances.find((instance) => instance.id === selectedInstanceId) ?? instances[0],
    [instances, selectedInstanceId]
  );
  const missingJava =
    javaScanComplete && javaInstallations.length === 0 && !selectedInstance?.javaPath;
  const needsRepair = Boolean(
    selectedInstance &&
      (selectedInstance.installStatus === "failed" || selectedInstance.installStatus === "needs-repair")
  );

  const playDisabledReason = useMemo(() => {
    if (!selectedInstance) return "Select an instance.";
    if (missingJava) return "Java setup needed.";
    if (launchStatus && launchStatus.instanceId === selectedInstance.id && busyStates.has(launchStatus.state)) {
      return "Launch in progress.";
    }
    if (needsRepair) return undefined;
    if (!activeAccount) return "Select an account.";
    if (selectedInstance.installStatus === "not-installed") return "Instance needs install.";
    if (activeAccount.type === "microsoft" && activeAccount.status === "error") {
      return "Microsoft account needs attention.";
    }
    return undefined;
  }, [activeAccount, launchStatus, missingJava, needsRepair, selectedInstance]);

  const primaryAction = useMemo(() => {
    if (!selectedInstance) {
      return {
        label: "Play",
        busyLabel: "Launching...",
        run: undefined as (() => void) | undefined,
        repair: false
      };
    }

    if (needsRepair) {
      return {
        label: "Repair",
        busyLabel: "Repairing...",
        run: () => void repairInstance(selectedInstance.id),
        repair: true
      };
    }

    return {
      label: "Play",
      busyLabel: "Launching...",
      run: () => void launchInstance(selectedInstance.id),
      repair: false
    };
  }, [launchInstance, needsRepair, repairInstance, selectedInstance]);

  useEffect(() => {
    if (!selectedInstance) {
      return;
    }
    if (modsByInstance[selectedInstance.id]) {
      return;
    }
    void loadMods(selectedInstance.id);
  }, [loadMods, modsByInstance, selectedInstance]);

  const modsCount = selectedInstance ? modsByInstance[selectedInstance.id]?.length : undefined;
  const readyLabel = useMemo(() => {
    if (playDisabledReason) return playDisabledReason;
    if (primaryAction.repair) return "Repair required";
    return "Ready to launch";
  }, [playDisabledReason, primaryAction.repair]);

  const helperLabel = useMemo(() => {
    if (playDisabledReason === "Select an account.") {
      return "Add a Microsoft account or create an offline testing account.";
    }
    if (playDisabledReason === "Java setup needed.") {
      return requiresJava21(selectedInstance?.minecraftVersion)
        ? "Java 21 is required for Minecraft 1.20.5 and newer."
        : "Select a Java executable in Settings.";
    }
    if (playDisabledReason === "Instance needs install.") {
      return "Nova will install the required files before launch.";
    }
    if (launchStatus?.message) return launchStatus.message;
    if (primaryAction.repair) return "Files need repair before launch.";
    return "Everything looks good.";
  }, [launchStatus?.message, playDisabledReason, primaryAction.repair, selectedInstance?.minecraftVersion]);

  const copyLogs = async () => {
    if (launchLogs.length === 0) return;
    await navigator.clipboard.writeText(
      launchLogs.map((entry) => `[${entry.timestamp}] [${entry.source}] ${entry.message}`).join("\n")
    );
  };

  if (!selectedInstance) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Play" title="Play" description="Set up the launcher, then press Play." />
        <Card>
          <div className="grid gap-4 p-[var(--card-padding)] xl:grid-cols-3">
            <div className="rounded-[var(--field-radius)] border border-[var(--panel-border)] bg-[var(--surface-3)] p-4">
              <p className="text-sm font-medium text-white">1. Add an account</p>
              <p className="mt-2 text-sm text-[var(--soft-text)]">Sign in with Microsoft or create an offline testing account.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => void addMicrosoftAccount()}>
                  <Login size={18} variant="Bold" className="mr-2" />
                  Add Microsoft account
                </Button>
                <Button size="sm" variant="secondary" onClick={() => void addOfflineDevAccount("DevPlayer")}>
                  <Shield size={18} variant="Linear" className="mr-2" />
                  Create offline testing account
                </Button>
              </div>
            </div>

            <div className="rounded-[var(--field-radius)] border border-[var(--panel-border)] bg-[var(--surface-3)] p-4">
              <p className="text-sm font-medium text-white">2. Create an instance</p>
              <p className="mt-2 text-sm text-[var(--soft-text)]">Pick a Minecraft version and loader before you launch.</p>
              <div className="mt-4">
                <Button size="sm" variant="secondary" onClick={() => navigate("/instances")}>
                  <Add size={18} variant="Bold" className="mr-2" />
                  Create instance
                </Button>
              </div>
            </div>

            <div className="rounded-[var(--field-radius)] border border-[var(--panel-border)] bg-[var(--surface-3)] p-4">
              <p className="text-sm font-medium text-white">3. Check Java</p>
              <p className="mt-2 text-sm text-[var(--soft-text)]">Install Java 21 or choose a Java executable in Settings.</p>
              <div className="mt-4">
                <Button size="sm" variant="ghost" onClick={() => navigate("/settings")}>
                  <Setting2 size={18} variant="Linear" className="mr-2" />
                  Open Java settings
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const showSetupChecklist = !activeAccount || missingJava;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Play" title="Play" description="Launch the selected instance." />

      {showSetupChecklist ? (
        <Card>
          <div className="grid gap-3 p-[var(--card-padding)] lg:grid-cols-2">
            {!activeAccount ? (
              <div className="rounded-[var(--field-radius)] border border-[var(--panel-border)] bg-[var(--surface-3)] p-4">
                <p className="text-sm font-medium text-white">Add an account</p>
                <p className="mt-2 text-sm text-[var(--soft-text)]">Choose Microsoft sign-in or create an offline testing account.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => void addMicrosoftAccount()}>
                    <Login size={18} variant="Bold" className="mr-2" />
                    Add Microsoft account
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => void addOfflineDevAccount("DevPlayer")}>
                    <Shield size={18} variant="Linear" className="mr-2" />
                    Create offline testing account
                  </Button>
                </div>
              </div>
            ) : null}

            {missingJava ? (
              <div className="rounded-[var(--field-radius)] border border-amber-500/20 bg-amber-500/10 p-4">
                <p className="text-sm font-medium text-white">Finish Java setup</p>
                <p className="mt-2 text-sm text-amber-50/90">
                  {requiresJava21(selectedInstance.minecraftVersion)
                    ? "Java 21 is required for Minecraft 1.20.5 and newer."
                    : "Select a Java executable in Settings."}
                </p>
                <div className="mt-4">
                  <Button size="sm" variant="secondary" onClick={() => navigate("/settings")}>
                    <Setting2 size={18} variant="Linear" className="mr-2" />
                    Open Java settings
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </Card>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-6 p-[var(--card-padding)]">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 max-w-3xl">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill label={selectedInstance.installStatus ?? "ready"} compact />
                  <StatusPill label={loaderLabel(selectedInstance.loader)} tone="info" compact />
                </div>
                <h2 className="mt-4 text-2xl font-semibold text-white lg:text-3xl">{selectedInstance.name}</h2>
                <p className="mt-2 text-sm text-[var(--soft-text)]">
                  Minecraft {selectedInstance.minecraftVersion}
                  {selectedInstance.loaderVersion ? ` / ${selectedInstance.loaderVersion}` : ""}
                </p>
                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-[var(--field-radius)] border border-[var(--panel-border)] bg-[var(--surface-3)] px-4 py-3">
                    <p className="text-xs text-[var(--muted-text)]">Account</p>
                    <p className="mt-2 truncate text-sm text-white">
                      {activeAccount?.displayName ?? activeAccount?.username ?? "No account"}
                    </p>
                  </div>
                  <div className="rounded-[var(--field-radius)] border border-[var(--panel-border)] bg-[var(--surface-3)] px-4 py-3">
                    <p className="text-xs text-[var(--muted-text)]">RAM</p>
                    <p className="mt-2 text-sm text-white">
                      {selectedInstance.memoryMinMb} - {selectedInstance.memoryMaxMb} MB
                    </p>
                  </div>
                  <div className="rounded-[var(--field-radius)] border border-[var(--panel-border)] bg-[var(--surface-3)] px-4 py-3">
                    <p className="text-xs text-[var(--muted-text)]">Mods</p>
                    <p className="mt-2 text-sm text-white">
                      {modsCount === undefined ? "Loading..." : `${modsCount} installed`}
                    </p>
                  </div>
                  <div className="rounded-[var(--field-radius)] border border-[var(--panel-border)] bg-[var(--surface-3)] px-4 py-3">
                    <p className="text-xs text-[var(--muted-text)]">Last played</p>
                    <p className="mt-2 text-sm text-white">{formatRelativeDate(selectedInstance.lastPlayedAt)}</p>
                  </div>
                </div>
              </div>

              <div className="w-full max-w-sm rounded-[var(--field-radius)] border border-[var(--panel-border)] bg-[var(--surface-3)] px-4 py-4">
                <div className="flex items-center gap-2 text-xs text-[var(--muted-text)]">
                  <UserSquare size={16} variant="Linear" />
                  Instance details
                </div>
                <div className="mt-3 grid gap-2 text-sm text-white">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[var(--muted-text)]">Loader</span>
                    <span>{loaderLabel(selectedInstance.loader)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[var(--muted-text)]">Status</span>
                    <span>{selectedInstance.installStatus ?? "ready"}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[var(--muted-text)]">Path</span>
                    <span className="max-w-[220px] truncate text-right text-[var(--soft-text)]" title={selectedInstance.paths.root}>
                      {selectedInstance.paths.root}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4 border-t border-[var(--divider-color)] pt-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-medium text-white">{readyLabel}</p>
                <p className="mt-1 text-sm text-[var(--soft-text)]">{helperLabel}</p>
              </div>

              <Button
                size="lg"
                glow
                className="min-w-[220px]"
                onClick={primaryAction.run}
                disabled={Boolean(playDisabledReason)}
              >
                {primaryAction.repair ? (
                  <DriverRefresh size={18} variant="Bold" className="mr-2" />
                ) : (
                  <PlayCircle size={18} variant="Bold" className="mr-2" />
                )}
                {launchStatus?.state === "launching-game" ? primaryAction.busyLabel : primaryAction.label}
              </Button>
            </div>

            <div className="flex flex-wrap gap-2 border-t border-[var(--divider-color)] pt-5">
              <Button variant="secondary" size="sm" onClick={() => navigate("/instances")}>
                <Layer size={18} variant="Linear" className="mr-2" />
                Change
              </Button>
              <Button variant="secondary" size="sm" onClick={() => navigate("/console")}>
                <Code size={18} variant="Linear" className="mr-2" />
                Console
              </Button>
              <Button variant="secondary" size="sm" onClick={() => void openPath(selectedInstance.paths.root)}>
                <FolderOpen size={18} variant="Linear" className="mr-2" />
                Folder
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate("/settings")}>
                <Setting2 size={18} variant="Linear" className="mr-2" />
                Settings
              </Button>
            </div>
          </div>
        </Card>

        <LaunchStatusPanel
          instanceId={selectedInstance.id}
          instancePath={selectedInstance.paths.root}
          status={launchStatus}
          logs={launchLogs}
          onOpenConsole={() => navigate("/console")}
          onCopyLogs={() => void copyLogs()}
          onOpenJavaSettings={() => navigate("/settings")}
          onOpenInstanceFolder={() => void openPath(selectedInstance.paths.root)}
          onOpenLogsFolder={(path) => void openPath(path)}
          onRepair={() => void repairInstance(selectedInstance.id)}
        />
      </div>
    </div>
  );
};
