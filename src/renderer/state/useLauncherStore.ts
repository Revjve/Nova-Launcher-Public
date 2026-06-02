import { create } from "zustand";
import type {
  BootstrapStep,
  DownloadTask,
  ImportedThemeId,
  Instance,
  InstalledMod,
  JavaInstallation,
  JavaRuntimeDownloadOption,
  LauncherAccount,
  LauncherSettings,
  LaunchLogEntry,
  LaunchStatusEvent,
  LoaderType,
  LoaderVersionOption,
  MinecraftVersionOption,
  ModSearchFilters,
  PerformanceMode,
  ModSearchResult,
  ModpackImportStatusEvent,
  ModrinthVersionOption,
  PaginatedModSearchResult,
  NewsItem
} from "@shared/types";
import type { RuntimeConfig } from "@shared/types";
import {
  DEFAULT_DISCORD_RPC_CLIENT_ID,
  DEFAULT_MICROSOFT_CLIENT_ID,
  DEFAULT_MICROSOFT_REDIRECT_URI,
  DEFAULT_SETTINGS
} from "@shared/constants";
import { normalizeModSearchResult } from "@shared/modSearch";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type ModSearchState = {
  query: string;
  filters: ModSearchFilters;
  results: ModSearchResult[];
  page: number;
  pageSize: number;
  totalHits: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  loading: boolean;
  error?: string;
  requestId: number;
};

type Banner = {
  type: "success" | "error" | "info";
  text: string;
};

type LauncherState = {
  booting: boolean;
  booted: boolean;
  bootError?: string;
  bootSteps: BootstrapStep[];
  bootStepIndex: number;
  listenersReady: boolean;
  javaScanComplete: boolean;
  performanceModeEnabled: boolean;
  accounts: LauncherAccount[];
  instances: Instance[];
  selectedInstanceId?: string;
  settings: LauncherSettings;
  javaInstallations: JavaInstallation[];
  downloads: DownloadTask[];
  news: NewsItem[];
  runtimeConfig: RuntimeConfig;
  authConfigured: boolean;
  modsByInstance: Record<string, InstalledMod[]>;
  launchLogs: LaunchLogEntry[];
  launchStatus?: LaunchStatusEvent;
  mrpackImportStatus?: ModpackImportStatusEvent;
  pendingRoute?: string;
  modSearch: ModSearchState;
  launchCommandPreviewByInstance: Record<string, string>;
  banner?: Banner;
  bootstrap: () => Promise<void>;
  dismissBanner: () => void;
  dismissMrpackImportStatus: () => void;
  consumePendingRoute: () => void;
  setSelectedInstance: (instanceId: string) => void;
  addMicrosoftAccount: () => Promise<void>;
  addOfflineDevAccount: (username?: string) => Promise<void>;
  removeAccount: (accountId: string) => Promise<void>;
  setActiveAccount: (accountId: string) => Promise<void>;
  createInstance: (input: Parameters<typeof window.nova.createInstance>[0]) => Promise<void>;
  updateInstance: (instanceId: string, patch: Parameters<typeof window.nova.updateInstance>[1]) => Promise<void>;
  duplicateInstance: (instanceId: string) => Promise<void>;
  deleteInstance: (instanceId: string) => Promise<void>;
  repairInstance: (instanceId: string) => Promise<void>;
  openPath: (targetPath: string) => Promise<void>;
  openExternalUrl: (targetUrl: string) => Promise<void>;
  launchInstance: (instanceId: string) => Promise<void>;
  loadMods: (instanceId: string) => Promise<void>;
  toggleMod: (instanceId: string, modId: string, enabled: boolean) => Promise<void>;
  deleteMod: (instanceId: string, modId: string) => Promise<void>;
  importLocalMod: (instanceId: string) => Promise<void>;
  checkModUpdates: (instanceId: string) => Promise<void>;
  updateMod: (instanceId: string, modId: string) => Promise<void>;
  updateAllMods: (instanceId: string) => Promise<void>;
  importMrpack: () => Promise<void>;
  setModSearchQuery: (query: string) => void;
  searchMods: (
    query: string,
    filters: ModSearchFilters,
    page?: number
  ) => Promise<PaginatedModSearchResult | undefined>;
  listModrinthVersions: (
    projectId: string,
    filters: ModSearchFilters
  ) => Promise<ModrinthVersionOption[]>;
  installMod: (
    source: "modrinth",
    instanceId: string,
    projectId: string,
    versionId?: string
  ) => Promise<InstalledMod | undefined>;
  changeModVersion: (
    instanceId: string,
    modId: string,
    versionId: string
  ) => Promise<InstalledMod | undefined>;
  updateSettings: (patch: Partial<LauncherSettings>) => Promise<void>;
  importTheme: () => Promise<void>;
  exportTheme: () => Promise<void>;
  deleteTheme: (themeId: ImportedThemeId) => Promise<void>;
  updateRuntimeConfig: (patch: Partial<RuntimeConfig>) => Promise<void>;
  refreshJava: () => Promise<void>;
  clearLaunchLogs: () => void;
  saveLogsToFile: (sourcePath?: string) => Promise<void>;
  openDataDirectory: () => Promise<void>;
  clearDownloadCache: () => Promise<void>;
  listMinecraftVersions: () => Promise<MinecraftVersionOption[]>;
  listLoaderVersions: (loader: LoaderType, version: string) => Promise<LoaderVersionOption[]>;
  listJavaDownloads: (majorVersion: number) => Promise<JavaRuntimeDownloadOption[]>;
  downloadJavaRuntime: (option: JavaRuntimeDownloadOption) => Promise<void>;
};

const defaultRuntimeConfig: RuntimeConfig = {
  microsoftClientId: DEFAULT_MICROSOFT_CLIENT_ID,
  microsoftRedirectUri: DEFAULT_MICROSOFT_REDIRECT_URI,
  discordRpcClientId: DEFAULT_DISCORD_RPC_CLIENT_ID
};

const setBanner = (text: string, type: Banner["type"] = "info") =>
  useLauncherStore.setState({ banner: { text, type } });

const LOW_END_DEVICE_MEMORY_GB = 8;
const LOW_END_HARDWARE_CONCURRENCY = 8;
let modSearchRequestSequence = 0;
const pendingLaunchMeasurements = new Map<string, number>();

const supportsReducedMotion = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const shouldAutoEnablePerformanceMode = () => {
  if (supportsReducedMotion()) {
    return true;
  }

  const deviceMemory = navigator.deviceMemory;
  const hardwareConcurrency = navigator.hardwareConcurrency;

  if (typeof deviceMemory === "number" && deviceMemory <= LOW_END_DEVICE_MEMORY_GB) {
    return true;
  }

  if (typeof hardwareConcurrency === "number" && hardwareConcurrency <= LOW_END_HARDWARE_CONCURRENCY) {
    return true;
  }

  return false;
};

const isPerformanceModeEnabled = (mode: PerformanceMode) =>
  mode === "on" || (mode === "auto" && shouldAutoEnablePerformanceMode());

const getEffectiveConsoleLimit = (settings: LauncherSettings, performanceModeEnabled: boolean) =>
  performanceModeEnabled
    ? Math.min(settings.consoleMaxVisibleLines, 2500)
    : settings.consoleMaxVisibleLines;

const trimLogs = (
  logs: LaunchLogEntry[],
  settings: LauncherSettings,
  performanceModeEnabled: boolean
) => {
  const limit = Math.max(getEffectiveConsoleLimit(settings, performanceModeEnabled), 200);
  return logs.length > limit ? logs.slice(logs.length - limit) : logs;
};

const applyLaunchStatusToInstances = (instances: Instance[], entry: LaunchStatusEvent) => {
  let changed = false;

  const nextInstances = instances.map((instance) => {
    if (instance.id !== entry.instanceId) {
      return instance;
    }

    const installStatus =
      entry.state === "launch-failed"
        ? "failed"
        : entry.state === "game-crashed"
          ? "needs-repair"
          : entry.state === "game-exited-successfully" || entry.state === "game-running"
            ? "ready"
            : entry.state === "preparing-instance" ||
                entry.state === "resolving-version" ||
                entry.state === "downloading-version-manifest" ||
                entry.state === "downloading-client" ||
                entry.state === "downloading-libraries" ||
                entry.state === "downloading-assets" ||
                entry.state === "checking-loader" ||
                entry.state === "installing-loader" ||
                entry.state === "extracting-natives"
              ? "installing"
              : instance.installStatus;
    const lastLaunchStatus =
      entry.state === "launch-failed" || entry.state === "game-crashed"
        ? "error"
        : entry.state === "game-exited-successfully" || entry.state === "game-running"
          ? "success"
          : instance.lastLaunchStatus;

    if (installStatus === instance.installStatus && lastLaunchStatus === instance.lastLaunchStatus) {
      return instance;
    }

    changed = true;
    return {
      ...instance,
      installStatus,
      lastLaunchStatus
    };
  });

  return changed ? nextInstances : instances;
};

const formatLogEntry = (entry: LaunchLogEntry) => {
  const details = entry.details
    ? Object.entries(entry.details)
        .filter(([, value]) => value !== undefined && value !== "")
        .map(([key, value]) => `${key}=${String(value)}`)
        .join(" ")
    : "";

  return `[${entry.timestamp}] [${entry.level}] [${entry.source}] ${entry.message}${details ? ` ${details}` : ""}`;
};

const sanitizeModSearchResults = (results: unknown): ModSearchResult[] =>
  Array.isArray(results)
    ? results
        .map((result) => normalizeModSearchResult(result as Record<string, unknown>))
        .filter((result): result is ModSearchResult => Boolean(result))
    : [];

const wasCancelled = (message?: string) =>
  message === "Selection cancelled." || message === "Save cancelled.";

const isInstanceBusy = (instanceId: string, status?: LaunchStatusEvent) =>
  status?.instanceId === instanceId &&
  status.state !== "idle" &&
  status.state !== "game-exited-successfully" &&
  status.state !== "game-crashed" &&
  status.state !== "launch-failed";

const toUserFacingModActionError = (
  action: "install" | "change-version",
  message?: string
) => {
  if (!message) {
    return action === "install" ? "Couldn't install mod." : "Couldn't change mod version.";
  }

  if (/no compatible/i.test(message)) {
    return "No compatible version.";
  }

  if (/already installed/i.test(message)) {
    return "Already installed.";
  }

  if (/download failed/i.test(message)) {
    return "Download failed.";
  }

  return action === "install" ? "Couldn't install mod." : "Couldn't change mod version.";
};

export const useLauncherStore = create<LauncherState>((set, get) => ({
  booting: true,
  booted: false,
  bootError: undefined,
  bootSteps: [],
  bootStepIndex: 0,
  listenersReady: false,
  javaScanComplete: false,
  performanceModeEnabled: isPerformanceModeEnabled(DEFAULT_SETTINGS.performanceMode),
  accounts: [],
  instances: [],
  settings: DEFAULT_SETTINGS,
  javaInstallations: [],
  downloads: [],
  news: [],
  runtimeConfig: defaultRuntimeConfig,
  authConfigured: false,
  modsByInstance: {},
  launchLogs: [],
  launchStatus: undefined,
  mrpackImportStatus: undefined,
  pendingRoute: undefined,
  modSearch: {
    query: "",
    filters: {},
    results: [],
    page: 1,
    pageSize: 18,
    totalHits: 0,
    hasPreviousPage: false,
    hasNextPage: false,
    loading: false,
    requestId: 0
  },
  launchCommandPreviewByInstance: {},
  dismissBanner: () => set({ banner: undefined }),
  dismissMrpackImportStatus: () => set({ mrpackImportStatus: undefined }),
  consumePendingRoute: () => set({ pendingRoute: undefined }),
  setSelectedInstance: (instanceId) => set({ selectedInstanceId: instanceId }),
  bootstrap: async () => {
    const startedAt = performance.now();
    set({ booting: true, booted: false, bootError: undefined, javaScanComplete: false });
    const provisionalSteps = [
      { id: "files", label: "Checking local launcher files" },
      { id: "accounts", label: "Checking accounts" },
      { id: "java", label: "Detecting Java runtimes" },
      { id: "instances", label: "Loading instances" }
    ];

    set({ bootSteps: provisionalSteps, bootStepIndex: 0 });
    try {
      if (!window.nova?.bootstrap) {
        throw new Error("Nova preload bridge is unavailable. Check the Electron preload script.");
      }

      const snapshotPromise = window.nova.bootstrap();
      for (let index = 0; index < provisionalSteps.length; index += 1) {
        set({ bootStepIndex: index });
        await wait(220);
      }

      const snapshot = await snapshotPromise;
      const performanceModeEnabled = isPerformanceModeEnabled(snapshot.settings.performanceMode);

      if (!get().listenersReady) {
        window.nova.onDownloadUpdate?.((tasks) => set({ downloads: tasks }));
        window.nova.onLaunchLogs?.((entries) =>
          set((state) => {
            const nextEntries = state.settings.debugLogs
              ? entries
              : entries.filter((entry) => entry.level !== "debug");

            if (nextEntries.length === 0) {
              return state;
            }

            if (import.meta.env.DEV) {
              console.info("[nova][perf] log batch", {
                entries: nextEntries.length,
                totalVisibleLines: Math.min(
                  state.launchLogs.length + nextEntries.length,
                  getEffectiveConsoleLimit(state.settings, state.performanceModeEnabled)
                )
              });
            }

            return {
              launchLogs: trimLogs(
                [...state.launchLogs, ...nextEntries],
                state.settings,
                state.performanceModeEnabled
              )
            };
          })
        );
        window.nova.onLaunchStatus?.((entry) =>
          set((state) => {
            const startedAtMs = pendingLaunchMeasurements.get(entry.instanceId);
            if (startedAtMs && entry.state !== "preparing-instance") {
              pendingLaunchMeasurements.delete(entry.instanceId);
              if (import.meta.env.DEV) {
                console.info("[nova][perf] launch interaction", {
                  instanceId: entry.instanceId,
                  firstStatusState: entry.state,
                  latencyMs: Math.round(performance.now() - startedAtMs)
                });
              }
            }

            return {
              launchStatus: entry,
              instances: applyLaunchStatusToInstances(state.instances, entry)
            };
          })
        );
        window.nova.onMrpackImportStatus?.((entry) =>
          set((state) => ({
            mrpackImportStatus: entry,
            selectedInstanceId:
              entry.instanceId && (entry.stage === "creating-instance" || entry.stage === "completed" || entry.stage === "completed-with-errors" || entry.stage === "failed")
                ? entry.instanceId
                : state.selectedInstanceId
          }))
        );
      }

      await window.nova.setEffectivePerformanceMode(performanceModeEnabled);
      set({
        booting: false,
        booted: true,
        bootError: undefined,
        listenersReady: true,
        bootSteps: snapshot.steps,
        bootStepIndex: snapshot.steps.length - 1,
        accounts: snapshot.accounts,
        instances: snapshot.instances,
        selectedInstanceId: snapshot.instances[0]?.id,
        settings: snapshot.settings,
        performanceModeEnabled,
        runtimeConfig: snapshot.runtimeConfig,
        javaInstallations: snapshot.javaInstallations,
        downloads: snapshot.downloads,
        news: snapshot.news,
        authConfigured: snapshot.authConfigured
      });
      void get().refreshJava().catch(() => {
        set({ javaScanComplete: true });
      });
      if (import.meta.env.DEV) {
        console.info("[nova][perf] bootstrap", {
          startupMs: Math.round(performance.now() - startedAt),
          instances: snapshot.instances.length,
          accounts: snapshot.accounts.length
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Launcher bootstrap failed.";
      set({
        booting: false,
        booted: false,
        bootError: message
      });
      setBanner(message, "error");
    }
  },
  addMicrosoftAccount: async () => {
    const response = await window.nova.addMicrosoftAccount();
    if (!response.ok || !response.data) {
      setBanner(response.error ?? "Unable to add that Microsoft account.", "error");
      return;
    }
    set((state) => ({
      accounts: [response.data!, ...state.accounts.filter((account) => account.id !== response.data!.id)],
      banner: { text: `${response.data!.username} is connected.`, type: "success" }
    }));
  },
  addOfflineDevAccount: async (username = "DevPlayer") => {
    const response = await window.nova.addOfflineDevAccount({ username });
    if (!response.ok || !response.data) {
      setBanner(response.error ?? "Unable to create the Offline Account.", "error");
      return;
    }
    set((state) => ({
      accounts: [response.data!, ...state.accounts.filter((account) => account.id !== response.data!.id)],
      banner: { text: `${response.data!.username} is ready for local testing.`, type: "success" }
    }));
  },
  removeAccount: async (accountId) => {
    const response = await window.nova.removeAccount(accountId);
    if (!response.ok) {
      setBanner(response.error ?? "Unable to remove that account.", "error");
      return;
    }
    set((state) => ({
      accounts: state.accounts.filter((account) => account.id !== accountId),
      banner: { text: "Account removed.", type: "success" }
    }));
  },
  setActiveAccount: async (accountId) => {
    const response = await window.nova.setActiveAccount(accountId);
    if (!response.ok || !response.data) {
      setBanner(response.error ?? "Unable to switch accounts.", "error");
      return;
    }
    set((state) => ({
      accounts: state.accounts.map((account) => ({ ...account, active: account.id === accountId })),
      banner: { text: `${response.data!.username} is now active.`, type: "success" }
    }));
  },
  createInstance: async (input) => {
    const response = await window.nova.createInstance(input);
    if (!response.ok || !response.data) {
      setBanner(response.error ?? "Unable to create the instance.", "error");
      return;
    }
    set((state) => ({
      instances: [response.data!, ...state.instances],
      selectedInstanceId: response.data!.id,
      banner: { text: `${response.data!.name} is ready.`, type: "success" }
    }));
  },
  updateInstance: async (instanceId, patch) => {
    const response = await window.nova.updateInstance(instanceId, patch);
    if (!response.ok || !response.data) {
      setBanner(response.error ?? "Unable to update the instance.", "error");
      return;
    }
    set((state) => ({
      instances: state.instances.map((instance) => (instance.id === instanceId ? response.data! : instance)),
      banner: { text: "Instance updated.", type: "success" }
    }));
  },
  duplicateInstance: async (instanceId) => {
    const response = await window.nova.duplicateInstance(instanceId);
    if (!response.ok || !response.data) {
      setBanner(response.error ?? "Unable to duplicate that instance.", "error");
      return;
    }
    set((state) => ({
      instances: [response.data!, ...state.instances],
      banner: { text: `${response.data!.name} was duplicated.`, type: "success" }
    }));
  },
  deleteInstance: async (instanceId) => {
    const response = await window.nova.deleteInstance(instanceId);
    if (!response.ok) {
      setBanner(response.error ?? "Unable to delete that instance.", "error");
      return;
    }
    set((state) => {
      const remaining = state.instances.filter((instance) => instance.id !== instanceId);
      return {
        instances: remaining,
        selectedInstanceId:
          state.selectedInstanceId === instanceId ? remaining[0]?.id : state.selectedInstanceId,
        banner: { text: "Instance deleted.", type: "success" }
      };
    });
  },
  repairInstance: async (instanceId) => {
    const response = await window.nova.repairInstance(instanceId);
    if (!response.ok || !response.data) {
      setBanner(response.error ?? "Unable to repair the instance.", "error");
      return;
    }
    set((state) => ({
      instances: state.instances.map((instance) => (instance.id === instanceId ? response.data! : instance)),
      banner: { text: `${response.data!.name} was checked and repaired.`, type: "success" }
    }));
  },
  openPath: async (targetPath) => {
    const response = await window.nova.openPath(targetPath);
    if (!response.ok) {
      setBanner(response.error ?? "Unable to open that folder.", "error");
    }
  },
  openExternalUrl: async (targetUrl) => {
    const response = await window.nova.openExternalUrl(targetUrl);
    if (!response.ok) {
      setBanner(response.error ?? "Unable to open that page.", "error");
    }
  },
  launchInstance: async (instanceId) => {
    const shouldOpenConsole = get().settings.openConsoleOnGameStart;
    pendingLaunchMeasurements.set(instanceId, performance.now());
    set({
      launchStatus: {
        type: "launch-status",
        instanceId,
        sessionId: crypto.randomUUID(),
        state: "preparing-instance",
        message: "Preparing instance.",
        progress: 6,
        timestamp: new Date().toISOString()
      },
      pendingRoute: shouldOpenConsole ? "/console" : undefined
    });
    const response = await window.nova.launchInstance(instanceId);
    if (!response.ok || !response.data) {
      setBanner(response.error ?? "Launch failed.", "error");
      return;
    }
    set((state) => ({
      launchCommandPreviewByInstance: response.data?.commandPreview
        ? {
            ...state.launchCommandPreviewByInstance,
            [instanceId]: response.data.commandPreview
          }
        : state.launchCommandPreviewByInstance
    }));
    setBanner(response.data.message, response.data.launched ? "success" : "info");
  },
  loadMods: async (instanceId) => {
    const mods = await window.nova.listMods(instanceId);
    set((state) => ({
      modsByInstance: {
        ...state.modsByInstance,
        [instanceId]: mods
      }
    }));
  },
  toggleMod: async (instanceId, modId, enabled) => {
    const response = await window.nova.toggleMod(instanceId, modId, enabled);
    if (!response.ok || !response.data) {
      setBanner(response.error ?? "Unable to update that mod.", "error");
      return;
    }
    await get().loadMods(instanceId);
  },
  deleteMod: async (instanceId, modId) => {
    const response = await window.nova.deleteMod(instanceId, modId);
    if (!response.ok) {
      setBanner(response.error ?? "Unable to remove that mod.", "error");
      return;
    }
    await get().loadMods(instanceId);
  },
  importLocalMod: async (instanceId) => {
    const response = await window.nova.importLocalMod(instanceId);
    if (wasCancelled(response.error)) {
      return;
    }
    if (!response.ok) {
      setBanner(response.error ?? "Unable to import the local mod.", "error");
      return;
    }
    await get().loadMods(instanceId);
    const count = response.data?.length ?? 0;
    if (count > 1) {
      setBanner(`${count} local mods imported.`, "success");
      return;
    }
    setBanner("Local mod imported.", "success");
  },
  checkModUpdates: async (instanceId) => {
    setBanner("Checking for updates...");
    const response = await window.nova.checkModUpdates(instanceId);
    if (!response.ok || !response.data) {
      setBanner(response.error ?? "Unable to check for mod updates.", "error");
      return;
    }
    const availableCount = response.data.filter((mod) => mod.updateAvailable).length;
    set((state) => ({
      modsByInstance: {
        ...state.modsByInstance,
        [instanceId]: response.data!
      }
    }));
    if (availableCount === 0) {
      setBanner("No updates found.", "info");
      return;
    }
    setBanner(`${availableCount} updates available.`, "success");
  },
  updateMod: async (instanceId, modId) => {
    const response = await window.nova.updateMod(instanceId, modId);
    if (!response.ok || !response.data) {
      setBanner(response.error ?? "Unable to update that mod.", "error");
      return;
    }
    await get().loadMods(instanceId);
    setBanner("Mod updated.", "success");
  },
  updateAllMods: async (instanceId) => {
    const pendingCount = (get().modsByInstance[instanceId] ?? []).filter((mod) => mod.updateAvailable).length;
    const response = await window.nova.updateAllMods(instanceId);
    if (!response.ok || !response.data) {
      setBanner(response.error ?? "Unable to update mods right now.", "error");
      return;
    }
    set((state) => ({
      modsByInstance: {
        ...state.modsByInstance,
        [instanceId]: response.data!
      }
    }));
    if (pendingCount === 0) {
      setBanner("No updates found.", "info");
      return;
    }
    const failedCount = response.data.filter((mod) => mod.updateError).length;
    if (failedCount > 0) {
      setBanner("Some mods could not be updated.", "info");
      return;
    }
    setBanner("Mods updated.", "success");
  },
  importMrpack: async () => {
    set({ mrpackImportStatus: undefined });
    const response = await window.nova.importMrpack();
    if (wasCancelled(response.error)) {
      return;
    }
    if (!response.ok || !response.data) {
      const failedInstanceId = get().mrpackImportStatus?.instanceId;
      if (failedInstanceId) {
        const instances = await window.nova.getInstances();
        set((state) => ({
          instances,
          selectedInstanceId: instances.some((instance) => instance.id === failedInstanceId)
            ? failedInstanceId
            : state.selectedInstanceId
        }));
      }
      setBanner(response.error ?? "Unable to import that modpack.", "error");
      return;
    }
    const result = response.data;
    const instances = await window.nova.getInstances();
    set((state) => ({
      instances,
      selectedInstanceId: result.instance.id,
      modsByInstance: state.modsByInstance
    }));
    await get().loadMods(result.instance.id);
    if (result.failedFiles.length > 0) {
      setBanner(
        `${result.packName} was imported, but ${result.failedFiles.length} file${result.failedFiles.length === 1 ? "" : "s"} failed.`,
        "info"
      );
      return;
    }
    setBanner(`${result.packName} is ready in Nova.`, "success");
  },
  setModSearchQuery: (query) =>
    set((state) => ({ modSearch: { ...state.modSearch, query } })),
  searchMods: async (query, filters, page = 1) => {
    const requestId = ++modSearchRequestSequence;
    set((state) => ({
      modSearch: {
        ...state.modSearch,
        query,
        filters,
        page,
        loading: true,
        error: undefined,
        requestId
      }
    }));

    const response = await window.nova.searchModrinth(query, filters, page, get().modSearch.pageSize);

    if (get().modSearch.requestId !== requestId) {
      return undefined;
    }

    if (!response.ok || !response.data) {
      set((state) => ({
        modSearch: {
          ...state.modSearch,
          loading: false,
          error: response.error ?? "Mod search failed.",
          requestId
        }
      }));
      return undefined;
    }

    const payload = response.data;
    set((state) => ({
      modSearch: {
        ...state.modSearch,
        loading: false,
        results: sanitizeModSearchResults(payload.results),
        page: payload.page,
        pageSize: payload.pageSize,
        totalHits: payload.totalHits,
        hasPreviousPage: payload.hasPreviousPage,
        hasNextPage: payload.hasNextPage,
        error: undefined,
        requestId
      }
    }));
    return payload;
  },
  listModrinthVersions: async (projectId, filters) => {
    const response = await window.nova.listModrinthVersions(projectId, filters);
    if (!response.ok || !response.data) {
      throw new Error(response.error ?? "Unable to load compatible versions.");
    }
    return response.data;
  },
  installMod: async (source, instanceId, projectId, versionId) => {
    if (isInstanceBusy(instanceId, get().launchStatus)) {
      setBanner("Close the game before changing mods.", "info");
      return undefined;
    }
    const response = await window.nova.installMod(source, instanceId, projectId, versionId);
    if (!response.ok) {
      setBanner(toUserFacingModActionError("install", response.error), "error");
      return undefined;
    }
    await get().loadMods(instanceId);
    setBanner("Mod installed into the selected instance.", "success");
    return response.data;
  },
  changeModVersion: async (instanceId, modId, versionId) => {
    if (isInstanceBusy(instanceId, get().launchStatus)) {
      setBanner("Close the game before changing mod versions.", "info");
      return undefined;
    }
    const response = await window.nova.changeModVersion(instanceId, modId, versionId);
    if (!response.ok || !response.data) {
      setBanner(toUserFacingModActionError("change-version", response.error), "error");
      return undefined;
    }
    await get().loadMods(instanceId);
    setBanner("Mod version changed.", "success");
    return response.data;
  },
  updateSettings: async (patch) => {
    const settings = await window.nova.updateSettings(patch);
    const performanceModeEnabled = isPerformanceModeEnabled(settings.performanceMode);
    await window.nova.setEffectivePerformanceMode(performanceModeEnabled);
    set((state) => ({
      settings,
      performanceModeEnabled,
      launchLogs: trimLogs(
        patch.debugLogs === false ? state.launchLogs.filter((entry) => entry.level !== "debug") : state.launchLogs,
        settings,
        performanceModeEnabled
      )
    }));
  },
  importTheme: async () => {
    const response = await window.nova.importTheme();
    if (wasCancelled(response.error)) {
      return;
    }
    if (!response.ok || !response.data) {
      setBanner(response.error ?? "This theme file is not valid.", "error");
      return;
    }
    const performanceModeEnabled = isPerformanceModeEnabled(response.data.performanceMode);
    await window.nova.setEffectivePerformanceMode(performanceModeEnabled);
    set({ settings: response.data, performanceModeEnabled });
    setBanner("Theme imported.", "success");
  },
  exportTheme: async () => {
    const response = await window.nova.exportTheme();
    if (wasCancelled(response.error)) {
      return;
    }
    if (!response.ok) {
      setBanner(response.error ?? "Unable to export the current theme.", "error");
      return;
    }
    setBanner("Theme exported.", "success");
  },
  deleteTheme: async (themeId) => {
    const response = await window.nova.deleteTheme(themeId);
    if (!response.ok || !response.data) {
      setBanner(response.error ?? "Unable to delete that theme.", "error");
      return;
    }
    const performanceModeEnabled = isPerformanceModeEnabled(response.data.performanceMode);
    await window.nova.setEffectivePerformanceMode(performanceModeEnabled);
    set({ settings: response.data, performanceModeEnabled });
    setBanner("Theme deleted.", "success");
  },
  updateRuntimeConfig: async (patch) => {
    const runtimeConfig = await window.nova.updateRuntimeConfig(patch);
    set({
      runtimeConfig,
      authConfigured:
        Boolean(runtimeConfig.microsoftClientId) &&
        runtimeConfig.microsoftRedirectUri === DEFAULT_MICROSOFT_REDIRECT_URI,
      banner: { text: "Launcher integrations saved.", type: "success" }
    });
  },
  refreshJava: async () => {
    const javaInstallations = await window.nova.listJavaInstallations();
    set({ javaInstallations, javaScanComplete: true });
  },
  clearLaunchLogs: () => set({ launchLogs: [] }),
  saveLogsToFile: async (sourcePath) => {
    const latestLogPath = sourcePath ?? get().launchStatus?.latestLogPath;
    if (get().settings.keepFullLogsOnDisk && latestLogPath) {
      const response = await window.nova.saveSessionLogCopy(latestLogPath);
      if (!response.ok) {
        setBanner(response.error ?? "Unable to save the log file.", "error");
        return;
      }
      setBanner("Logs saved.", "success");
      return;
    }

    const contents = get().launchLogs.map(formatLogEntry).join("\n");
    if (!contents.trim()) {
      setBanner("There are no logs to save yet.", "info");
      return;
    }
    const response = await window.nova.saveTextFile("nova-launch-log.txt", contents);
    if (!response.ok) {
      setBanner(response.error ?? "Unable to save the log file.", "error");
      return;
    }
    setBanner("Logs saved.", "success");
  },
  openDataDirectory: async () => {
    const response = await window.nova.openDataDirectory();
    if (!response.ok) {
      setBanner(response.error ?? "Unable to open the data folder.", "error");
    }
  },
  clearDownloadCache: async () => {
    const response = await window.nova.clearDownloadCache();
    if (!response.ok) {
      setBanner(response.error ?? "Unable to clear the download cache.", "error");
      return;
    }
    setBanner("Download cache cleared.", "success");
  },
  listMinecraftVersions: () => window.nova.listMinecraftVersions(),
  listLoaderVersions: (loader, version) => window.nova.listLoaderVersions(loader, version),
  listJavaDownloads: (majorVersion) => window.nova.listJavaDownloads(majorVersion),
  downloadJavaRuntime: async (option) => {
    const response = await window.nova.downloadJavaRuntime(option);
    if (!response.ok || !response.data) {
      setBanner(response.error ?? "Unable to download that Java runtime.", "error");
      return;
    }
    set({
      javaInstallations: response.data.javaInstallations,
      banner: {
        text: `Java ${response.data.installation.version} installed and ready in Nova.`,
        type: "success"
      }
    });
  }
}));
