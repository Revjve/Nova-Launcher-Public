import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, FolderOpen, PlayCircle, RefreshCircle, Save2, Trash } from "iconsax-react";
import { useNavigate, useParams } from "react-router-dom";
import type { InstalledMod, ModrinthVersionOption, UpdateInstanceInput } from "@shared/types";
import { ConsolePanel } from "@renderer/components/launch/ConsolePanel";
import { LaunchStatusPanel } from "@renderer/components/launch/LaunchStatusPanel";
import { ModRow } from "@renderer/components/instance/ModRow";
import { ModBrowserPanel } from "@renderer/components/mods/ModBrowserPanel";
import { Button } from "@renderer/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@renderer/components/ui/Card";
import { EmptyState } from "@renderer/components/ui/EmptyState";
import { ErrorCallout } from "@renderer/components/ui/ErrorCallout";
import { Input } from "@renderer/components/ui/Input";
import { StatusPill } from "@renderer/components/ui/StatusPill";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@renderer/components/ui/Tabs";
import { formatRelativeDate, loaderLabel } from "@renderer/lib/format";
import { useLauncherStore } from "@renderer/state/useLauncherStore";

export const InstanceDetail = () => {
  const { instanceId = "" } = useParams();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<UpdateInstanceInput>({
    memoryMinMb: 2048,
    memoryMaxMb: 4096,
    javaPath: "",
    notes: ""
  });
  const instances = useLauncherStore((state) => state.instances);
  const modsByInstance = useLauncherStore((state) => state.modsByInstance);
  const launchLogs = useLauncherStore((state) => state.launchLogs);
  const launchStatus = useLauncherStore((state) => state.launchStatus);
  const settings = useLauncherStore((state) => state.settings);
  const loadMods = useLauncherStore((state) => state.loadMods);
  const launchInstance = useLauncherStore((state) => state.launchInstance);
  const openPath = useLauncherStore((state) => state.openPath);
  const repairInstance = useLauncherStore((state) => state.repairInstance);
  const duplicateInstance = useLauncherStore((state) => state.duplicateInstance);
  const deleteInstance = useLauncherStore((state) => state.deleteInstance);
  const updateInstance = useLauncherStore((state) => state.updateInstance);
  const toggleMod = useLauncherStore((state) => state.toggleMod);
  const deleteMod = useLauncherStore((state) => state.deleteMod);
  const importLocalMod = useLauncherStore((state) => state.importLocalMod);
  const checkModUpdates = useLauncherStore((state) => state.checkModUpdates);
  const updateAllMods = useLauncherStore((state) => state.updateAllMods);
  const listModrinthVersions = useLauncherStore((state) => state.listModrinthVersions);
  const changeModVersion = useLauncherStore((state) => state.changeModVersion);
  const clearLaunchLogs = useLauncherStore((state) => state.clearLaunchLogs);
  const saveLogsToFile = useLauncherStore((state) => state.saveLogsToFile);
  const [modVersionStates, setModVersionStates] = useState<
    Record<
      string,
      {
        options?: ModrinthVersionOption[];
        selectedVersionId?: string;
        loadingVersions?: boolean;
        changingVersion?: boolean;
        versionRequestId?: number;
        error?: string;
      }
    >
  >({});
  const versionRequestSequence = useRef(0);

  const instance = useMemo(() => instances.find((item) => item.id === instanceId), [instances, instanceId]);
  const mods = useMemo(() => modsByInstance[instanceId] ?? [], [modsByInstance, instanceId]);

  useEffect(() => {
    if (instanceId) {
      void loadMods(instanceId);
    }
  }, [instanceId, loadMods]);

  useEffect(() => {
    if (!instance) return;
    setDraft({
      memoryMinMb: instance.memoryMinMb,
      memoryMaxMb: instance.memoryMaxMb,
      javaPath: instance.javaPath ?? "",
      notes: instance.notes ?? ""
    });
  }, [instance]);

  const incompatibleHint = useMemo(
    () => mods.filter((mod) => mod.enabled && mod.loader && mod.loader !== instance?.loader),
    [instance?.loader, mods]
  );
  const instanceLogs = useMemo(
    () => launchLogs.filter((entry) => entry.instanceId === instanceId || !entry.instanceId),
    [instanceId, launchLogs]
  );
  const scopedStatus = launchStatus?.instanceId === instanceId ? launchStatus : undefined;
  const availableUpdatesCount = useMemo(
    () => mods.filter((mod) => mod.source === "modrinth" && mod.updateAvailable).length,
    [mods]
  );
  const instanceBusy =
    scopedStatus &&
    scopedStatus.state !== "idle" &&
    scopedStatus.state !== "game-exited-successfully" &&
    scopedStatus.state !== "game-crashed" &&
    scopedStatus.state !== "launch-failed";

  useEffect(() => {
    setModVersionStates({});
  }, [instanceId]);

  useEffect(() => {
    const managedMods = mods.filter((mod) => mod.source === "modrinth" && mod.projectId);
    for (const mod of managedMods) {
      const current = modVersionStates[mod.id];
      if (!current?.options && !current?.loadingVersions) {
        void loadCompatibleVersions(mod);
      }
    }
  }, [modVersionStates, mods]);

  if (!instance) {
    return <EmptyState title="Instance not found" description="It may have been deleted." />;
  }

  const handleDelete = async () => {
    if (!window.confirm("Delete this instance?")) return;
    await deleteInstance(instance.id);
    navigate("/instances");
  };

  const handleSaveSettings = async () => {
    await updateInstance(instance.id, {
      memoryMinMb: Number(draft.memoryMinMb),
      memoryMaxMb: Number(draft.memoryMaxMb),
      javaPath: draft.javaPath || undefined,
      notes: draft.notes
    });
  };

  const loadCompatibleVersions = async (mod: InstalledMod) => {
    if (!mod.projectId) {
      return [];
    }

    const currentState = modVersionStates[mod.id];
    if (currentState?.loadingVersions) {
      return currentState.options ?? [];
    }
    if (currentState?.options) {
      return currentState.options;
    }

    const requestId = ++versionRequestSequence.current;
    setModVersionStates((current) => ({
      ...current,
      [mod.id]: {
        ...current[mod.id],
        loadingVersions: true,
        versionRequestId: requestId,
        error: undefined
      }
    }));

    try {
      const options = await listModrinthVersions(mod.projectId, {
        minecraftVersion: instance.minecraftVersion,
        loader: instance.loader
      });
      const currentVersionId = mod.versionId ?? mod.fileId;
      const selectedVersionId =
        options.find((option) => option.id === currentVersionId)?.id ?? options[0]?.id;

      setModVersionStates((current) => {
        if (current[mod.id]?.versionRequestId !== requestId) {
          return current;
        }

        return {
          ...current,
          [mod.id]: {
            ...current[mod.id],
            options,
            selectedVersionId: current[mod.id]?.selectedVersionId ?? selectedVersionId,
            loadingVersions: false,
            error: options.length === 0 ? "No compatible version." : undefined
          }
        };
      });

      return options;
    } catch (error) {
      setModVersionStates((current) => {
        if (current[mod.id]?.versionRequestId !== requestId) {
          return current;
        }

        return {
          ...current,
          [mod.id]: {
            ...current[mod.id],
            loadingVersions: false,
            error: "Couldn't load versions."
          }
        };
      });
      return [];
    }
  };

  const handleChangeVersion = async (mod: InstalledMod) => {
    const currentState = modVersionStates[mod.id];
    const currentVersionId = mod.versionId ?? mod.fileId;
    const selectedVersionId = currentState?.selectedVersionId;

    if (!selectedVersionId || selectedVersionId === currentVersionId) {
      return;
    }

    setModVersionStates((current) => ({
      ...current,
      [mod.id]: {
        ...current[mod.id],
        changingVersion: true,
        error: undefined
      }
    }));

    try {
      await changeModVersion(instance.id, mod.id, selectedVersionId);
    } finally {
      setModVersionStates((current) => ({
        ...current,
        [mod.id]: {
          ...current[mod.id],
          changingVersion: false
        }
      }));
    }
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill label={loaderLabel(instance.loader)} tone="info" compact />
                <StatusPill label={instance.installStatus ?? "ready"} compact />
                <StatusPill label={instance.lastLaunchStatus ?? "idle"} compact />
              </div>
              <CardTitle className="mt-3 text-3xl">{instance.name}</CardTitle>
              <p className="mt-1 text-sm text-nova-400">
                {instance.minecraftVersion}
                {instance.loaderVersion ? ` / ${instance.loaderVersion}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => launchInstance(instance.id)}>
                <PlayCircle size={18} variant="Bold" className="mr-2" />
                Play
              </Button>
              <Button variant="secondary" onClick={() => repairInstance(instance.id)}>
                <RefreshCircle size={18} variant="Linear" className="mr-2" />
                Repair
              </Button>
              <Button variant="secondary" onClick={() => openPath(instance.paths.root)}>
                <FolderOpen size={18} variant="Linear" className="mr-2" />
                Folder
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="mods">Mods</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <LaunchStatusPanel
            instanceId={instance.id}
            instancePath={instance.paths.root}
            status={scopedStatus}
            logs={instanceLogs}
            onOpenConsole={() => navigate("/console")}
            onCopyLogs={() =>
              void navigator.clipboard.writeText(
                instanceLogs.map((entry) => `[${entry.timestamp}] [${entry.source}] ${entry.message}`).join("\n")
              )
            }
            onOpenJavaSettings={() => navigate("/settings")}
            onOpenInstanceFolder={() => void openPath(instance.paths.root)}
            onOpenLogsFolder={(path) => void openPath(path)}
            onRepair={() => void repairInstance(instance.id)}
          />

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
            <Card>
              <CardHeader>
                <CardTitle>Overview</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                {[
                  ["Loader", loaderLabel(instance.loader)],
                  ["Loader version", instance.loaderVersion ?? "Auto"],
                  ["Java", instance.javaPath ?? "Launcher default"],
                  ["Memory", `${instance.memoryMinMb} / ${instance.memoryMaxMb} MB`],
                  ["Game dir", instance.paths.root],
                  ["Last played", formatRelativeDate(instance.lastPlayedAt)]
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-[var(--field-radius)] border border-[var(--panel-border)] bg-[var(--surface-2)] p-3"
                  >
                    <p className="text-xs uppercase tracking-[0.18em] text-nova-500">{label}</p>
                    <p className="mt-2 break-all text-sm text-white">{value}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="secondary" className="w-full justify-start" onClick={() => duplicateInstance(instance.id)}>
                  <Copy size={18} variant="Linear" className="mr-2" />
                  Duplicate
                </Button>
                <Button variant="secondary" className="w-full justify-start" onClick={() => openPath(instance.paths.saves)}>
                  Saves
                </Button>
                <Button variant="secondary" className="w-full justify-start" onClick={() => openPath(instance.paths.resourcepacks)}>
                  Resource packs
                </Button>
                <Button variant="secondary" className="w-full justify-start" onClick={() => openPath(instance.paths.shaderpacks)}>
                  Shader packs
                </Button>
                <Button variant="destructive" className="w-full justify-start" onClick={handleDelete}>
                  <Trash size={18} variant="Linear" className="mr-2" />
                  Delete
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="mods" className="space-y-4">
          {incompatibleHint.length > 0 ? (
            <ErrorCallout title="Mod warning" message="Some mods do not match this loader." tone="warning" />
          ) : null}

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Installed mods</CardTitle>
                <p className="mt-1 text-sm text-nova-400">
                  {mods.length} installed
                  {availableUpdatesCount > 0 ? ` / ${availableUpdatesCount} updates available` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={() => importLocalMod(instance.id)}>
                  Import local mod
                </Button>
                <Button variant="outline" size="sm" onClick={() => checkModUpdates(instance.id)}>
                  Check updates
                </Button>
                {availableUpdatesCount > 0 ? (
                  <Button variant="outline" size="sm" onClick={() => updateAllMods(instance.id)}>
                    Update all
                  </Button>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {mods.length === 0 ? (
                <EmptyState
                  title="No mods"
                  description="Install one from Modrinth or import a local mod."
                  action={
                    <Button variant="secondary" size="sm" onClick={() => importLocalMod(instance.id)}>
                      Import local mod
                    </Button>
                  }
                />
              ) : (
                mods.map((mod: InstalledMod) => (
                  <ModRow
                    key={mod.id}
                    mod={mod}
                    versions={modVersionStates[mod.id]?.options}
                    selectedVersionId={modVersionStates[mod.id]?.selectedVersionId}
                    loadingVersions={modVersionStates[mod.id]?.loadingVersions}
                    changingVersion={modVersionStates[mod.id]?.changingVersion}
                    versionError={modVersionStates[mod.id]?.error}
                    instanceBusy={Boolean(instanceBusy)}
                    onLoadVersions={() => void loadCompatibleVersions(mod)}
                    onSelectVersion={(versionId) =>
                      setModVersionStates((current) => ({
                        ...current,
                        [mod.id]: {
                          ...current[mod.id],
                          selectedVersionId: versionId,
                          error: undefined
                        }
                      }))
                    }
                    onChangeVersion={() => void handleChangeVersion(mod)}
                    onToggle={(item, enabled) => toggleMod(instance.id, item.id, enabled)}
                    onDelete={(item) => deleteMod(instance.id, item.id)}
                  />
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Discover mods</CardTitle>
            </CardHeader>
            <CardContent>
              <ModBrowserPanel instanceId={instance.id} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Instance settings</CardTitle>
                <p className="mt-1 text-sm text-nova-400">Memory, Java, notes.</p>
              </div>
              <Button size="sm" onClick={() => void handleSaveSettings()}>
                <Save2 size={18} variant="Linear" className="mr-2" />
                Save
              </Button>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm text-nova-300">Min RAM (MB)</label>
                <Input
                  type="number"
                  min={1024}
                  step={512}
                  value={draft.memoryMinMb}
                  onChange={(event) => setDraft((current) => ({ ...current, memoryMinMb: Number(event.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-nova-300">Max RAM (MB)</label>
                <Input
                  type="number"
                  min={2048}
                  step={512}
                  value={draft.memoryMaxMb}
                  onChange={(event) => setDraft((current) => ({ ...current, memoryMaxMb: Number(event.target.value) }))}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm text-nova-300">Java path override</label>
                <Input
                  value={draft.javaPath ?? ""}
                  onChange={(event) => setDraft((current) => ({ ...current, javaPath: event.target.value }))}
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm text-nova-300">Game directory</label>
                <Input value={instance.paths.root} readOnly />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm text-nova-300">Notes</label>
                <textarea
                  value={draft.notes ?? ""}
                  onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
                  className="min-h-28 w-full rounded-[var(--field-radius)] border border-[var(--panel-border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-white outline-none focus:border-[var(--accent-border)] focus:ring-2 focus:ring-[var(--accent-ring)]"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <ConsolePanel
            logs={instanceLogs}
            status={scopedStatus}
            defaultAutoScroll={settings.autoScrollConsole}
            onClear={clearLaunchLogs}
            onSave={(sourcePath) => void saveLogsToFile(sourcePath)}
            onOpenLogsFolder={(path) => void openPath(path)}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};
