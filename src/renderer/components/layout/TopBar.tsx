import { useMemo } from "react";
import { Layer } from "iconsax-react";
import { AccountAvatar } from "@renderer/components/ui/AccountAvatar";
import { AppIcon } from "@renderer/components/ui/AppIcon";
import { StatusPill } from "@renderer/components/ui/StatusPill";
import { formatRelativeDate } from "@renderer/lib/format";
import { useLauncherStore } from "@renderer/state/useLauncherStore";

export const TopBar = () => {
  const accounts = useLauncherStore((state) => state.accounts);
  const instances = useLauncherStore((state) => state.instances);
  const selectedInstanceId = useLauncherStore((state) => state.selectedInstanceId);
  const launchStatus = useLauncherStore((state) => state.launchStatus);

  const activeAccount = useMemo(() => accounts.find((account) => account.active), [accounts]);
  const selectedInstance = useMemo(
    () => instances.find((instance) => instance.id === selectedInstanceId),
    [instances, selectedInstanceId]
  );
  const launchTone =
    launchStatus?.state === "launch-failed" || launchStatus?.state === "game-crashed"
      ? "error"
      : launchStatus?.state === "game-running" || launchStatus?.state === "game-exited-successfully"
        ? "success"
        : "info";
  const launchMessage = launchStatus && launchStatus.state !== "idle" ? launchStatus.message : undefined;

  return (
    <header className="nova-topbar performance-blur border-b border-b-[var(--divider-color)] px-4 py-3 backdrop-blur-xl lg:px-6 xl:px-7">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-end">
        <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--soft-text)]">
          <div className="flex min-w-0 items-center gap-2">
            {activeAccount ? (
              <AccountAvatar account={activeAccount} sizeClassName="h-7 w-7" />
            ) : (
              <div className="grid h-7 w-7 place-items-center rounded-full border border-[var(--panel-border)] bg-[var(--surface-2)] text-[10px] text-[var(--soft-text)]">
                ?
              </div>
            )}
            <span className="truncate">
              {activeAccount?.displayName ?? activeAccount?.username ?? "No account"}
            </span>
          </div>

          <span className="hidden text-[var(--muted-text)] md:inline">/</span>

          <div className="flex min-w-0 items-center gap-2">
            <AppIcon icon={Layer} size={15} variant="Linear" className="text-[var(--soft-text)]" />
            <span className="truncate">
              {selectedInstance
                ? `${selectedInstance.name} / ${selectedInstance.minecraftVersion}`
                : "No instance"}
            </span>
          </div>

          <span className="hidden text-[var(--muted-text)] md:inline">/</span>

          <StatusPill
            label={
              launchStatus?.state === "game-running"
                ? "Running"
                : launchStatus?.state === "launch-failed" || launchStatus?.state === "game-crashed"
                  ? "Attention needed"
                  : launchMessage ?? "Ready to launch"
            }
            compact
            tone={launchTone}
          />

          {selectedInstance?.lastPlayedAt ? (
            <>
              <span className="hidden text-[var(--muted-text)] md:inline">/</span>
              <span className="text-[var(--muted-text)]">
                Last played {formatRelativeDate(selectedInstance.lastPlayedAt)}
              </span>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
};
