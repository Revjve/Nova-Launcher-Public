import { appendFileSync, mkdirSync } from "node:fs";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { app, dialog, ipcMain, shell } from "electron";
import type {
  CreateOfflineDevAccountInput,
  CreateInstanceInput,
  ImportedThemeId,
  JavaRuntimeDownloadOption,
  LauncherSettings,
  LoaderType,
  ModSearchFilters,
  ModpackImportStatusEvent,
  ServiceResponse,
  UpdateInstanceInput
} from "../../shared/types";
import { sanitizeLauncherSettings } from "../../shared/constants";
import {
  createImportedTheme,
  exportThemeFile,
  sanitizeThemeFile,
  slugifyThemeName
} from "../../shared/themes";
import { AccountService } from "../services/accounts/accountService";
import { AuthService } from "../services/auth/authService";
import { DownloadManager } from "../services/downloads/downloadManager";
import { InstanceService } from "../services/instances/instanceService";
import { ModService } from "../services/instances/modService";
import { JavaService } from "../services/java/javaService";
import { FabricService } from "../services/loaders/fabricService";
import { ForgeService } from "../services/loaders/forgeService";
import { NeoForgeService } from "../services/loaders/neoforgeService";
import { LaunchService } from "../services/minecraft/launchService";
import { NewsService } from "../services/minecraft/newsService";
import { VersionManifestService } from "../services/minecraft/versionManifestService";
import { ModrinthService } from "../services/modrinth/modrinthService";
import { LauncherRepository } from "../services/storage/launcherRepository";
import { RuntimeConfigService } from "../services/storage/runtimeConfigService";

type Services = {
  accounts: AccountService;
  auth: AuthService;
  downloads: DownloadManager;
  instances: InstanceService;
  mods: ModService;
  java: JavaService;
  fabric: FabricService;
  forge: ForgeService;
  neoforge: NeoForgeService;
  launch: LaunchService;
  news: NewsService;
  versions: VersionManifestService;
  modrinth: ModrinthService;
  repository: LauncherRepository;
  runtimeConfig: RuntimeConfigService;
};

type RegisterIpcOptions = {
  onRuntimeConfigChanged?: () => void | Promise<void>;
  onSettingsChanged?: (settings: LauncherSettings) => void | Promise<void>;
  onEffectivePerformanceModeChanged?: (enabled: boolean) => void | Promise<void>;
};

const toResponse = async <T>(callback: () => Promise<T>): Promise<ServiceResponse<T>> => {
  try {
    return { ok: true, data: await callback() };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Something went wrong."
    };
  }
};

const isAllowedExternalUrl = (value: string) => {
  try {
    const target = new URL(value);
    return (
      target.protocol === "https:" &&
      (target.hostname === "modrinth.com" || target.hostname === "www.modrinth.com")
    );
  } catch {
    return false;
  }
};

const toShortModError = (
  action: "install" | "change-version",
  error: unknown
) => {
  const message = error instanceof Error ? error.message : "Something went wrong.";

  if (/no compatible/i.test(message)) {
    return "No compatible version.";
  }

  if (/already installed/i.test(message)) {
    return "Already installed.";
  }

  if (
    /download failed|expected hash|missing|empty|invalid|size did not match|ENOENT/i.test(message)
  ) {
    return action === "install" ? "Download failed." : "Couldn't change mod version.";
  }

  return action === "install" ? "Couldn't install mod." : "Couldn't change mod version.";
};

type MrpackImportContext = {
  packPath?: string;
  packName?: string;
  packVersion?: string;
  instanceId?: string;
};

const appendMrpackImportLog = (
  level: "info" | "error",
  step: string,
  context: MrpackImportContext,
  extra?: Record<string, unknown>
) => {
  const entry = {
    timestamp: new Date().toISOString(),
    area: "mrpack-import",
    level,
    step,
    ...context,
    ...extra
  };

  const line = JSON.stringify(entry);
  if (level === "error") {
    console.error(`[nova][mrpack] ${step}`, entry);
  } else {
    console.info(`[nova][mrpack] ${step}`, entry);
  }

  try {
    const userDataPath = app.getPath("userData");
    mkdirSync(userDataPath, { recursive: true });
    appendFileSync(join(userDataPath, "mrpack-imports.log"), `${line}\n`);
  } catch {
    // Ignore file logging failures and keep console diagnostics.
  }
};

export const registerIpc = (services: Services, options: RegisterIpcOptions = {}) => {
  ipcMain.handle("nova:bootstrap", async () => {
    const [data, news, runtimeConfig, authConfiguration] = await Promise.all([
      services.repository.getData(),
      services.news.getNews(),
      services.runtimeConfig.get(),
      services.auth.getConfiguration()
    ]);

    return {
      steps: [
        { id: "files", label: "Checking local launcher files" },
        { id: "accounts", label: "Checking accounts" },
        { id: "java", label: "Detecting Java runtimes" },
        { id: "instances", label: "Loading instances" }
      ],
      accounts: data.accounts,
      instances: data.instances,
      settings: data.settings,
      runtimeConfig,
      javaInstallations: [],
      downloads: services.downloads.snapshot(),
      news,
      authConfigured: authConfiguration.configured
    };
  });

  ipcMain.handle("nova:get-auth-configuration", async () => services.auth.getConfiguration());
  ipcMain.handle("nova:get-runtime-config", async () => services.runtimeConfig.get());
  ipcMain.handle("nova:update-runtime-config", async (_event, patch) => {
    const runtimeConfig = await services.runtimeConfig.update(patch);
    await options.onRuntimeConfigChanged?.();
    return runtimeConfig;
  });
  ipcMain.handle("nova:set-effective-performance-mode", async (_event, enabled: boolean) => {
    await options.onEffectivePerformanceModeChanged?.(enabled);
  });
  ipcMain.handle("nova:add-account", async () => toResponse(() => services.auth.addMicrosoftAccount()));
  ipcMain.handle("nova:add-offline-dev-account", async (_event, input: CreateOfflineDevAccountInput) =>
    toResponse(() => services.accounts.addOfflineDevAccount(input))
  );
  ipcMain.handle("nova:remove-account", async (_event, accountId: string) =>
    toResponse(() => services.accounts.removeAccount(accountId))
  );
  ipcMain.handle("nova:set-active-account", async (_event, accountId: string) =>
    toResponse(() => services.accounts.setActiveAccount(accountId))
  );

  ipcMain.handle("nova:get-instances", async () => services.instances.list());
  ipcMain.handle("nova:create-instance", async (_event, input: CreateInstanceInput) =>
    toResponse(() => services.instances.create(input))
  );
  ipcMain.handle("nova:update-instance", async (_event, instanceId: string, patch: UpdateInstanceInput) =>
    toResponse(() => services.instances.update(instanceId, patch))
  );
  ipcMain.handle("nova:duplicate-instance", async (_event, instanceId: string) =>
    toResponse(() => services.instances.duplicate(instanceId))
  );
  ipcMain.handle("nova:delete-instance", async (_event, instanceId: string) =>
    toResponse(() => services.instances.delete(instanceId))
  );
  ipcMain.handle("nova:repair-instance", async (_event, instanceId: string) =>
    toResponse(() => services.launch.repair(instanceId))
  );
  ipcMain.handle("nova:open-path", async (_event, targetPath: string) =>
    toResponse(async () => {
      await shell.openPath(targetPath);
      return true;
    })
  );
  ipcMain.handle("nova:open-external-url", async (_event, targetUrl: string) =>
    toResponse(async () => {
      if (!isAllowedExternalUrl(targetUrl)) {
        throw new Error("That page could not be opened.");
      }
      await shell.openExternal(targetUrl);
      return true;
    })
  );

  ipcMain.handle("nova:list-minecraft-versions", async () => services.versions.listVersions());
  ipcMain.handle("nova:list-loader-versions", async (_event, loader: LoaderType, version: string) => {
    if (loader === "fabric") {
      return services.fabric.listVersions(version);
    }
    if (loader === "forge") {
      return services.forge.listVersions(version);
    }
    if (loader === "neoforge") {
      return services.neoforge.listVersions(version);
    }
    return [];
  });

  ipcMain.handle("nova:list-java", async () => services.java.listInstallations());
  ipcMain.handle("nova:list-java-downloads", async (_event, majorVersion: number) =>
    services.java.listDownloads(majorVersion)
  );
  ipcMain.handle("nova:download-java-runtime", async (_event, option: JavaRuntimeDownloadOption) =>
    toResponse(async () => {
      const data = await services.repository.getData();
      const destination = join(data.settings.downloadCacheRoot, "java", option.vendor, option.fileName);
      await services.downloads.enqueue({
        label: `Downloading ${option.vendor} JDK ${option.majorVersion} (${option.packageType})`,
        source: option.url,
        destination
      });
      const installation = await services.java.installDownloadedRuntime(option, destination);
      const javaInstallations = await services.java.listInstallations();
      return {
        installation,
        javaInstallations
      };
    })
  );

  ipcMain.handle("nova:update-settings", async (_event, patch: Partial<LauncherSettings>) => {
    const data = await services.repository.getData();
    const nextSettings = sanitizeLauncherSettings({ ...data.settings, ...patch }, data.settings);
    await mkdir(nextSettings.defaultInstanceRoot, { recursive: true });
    await mkdir(nextSettings.downloadCacheRoot, { recursive: true });
    services.downloads.setMaxParallel(nextSettings.maxParallelDownloads);
    const savedSettings = await services.repository.setSettings(nextSettings);
    await options.onSettingsChanged?.(savedSettings);
    return savedSettings;
  });
  ipcMain.handle("nova:import-theme", async () =>
    toResponse(async () => {
      const selection = await dialog.showOpenDialog({
        filters: [{ name: "Nova Theme", extensions: ["json"] }],
        properties: ["openFile"]
      });

      if (selection.canceled || !selection.filePaths[0]) {
        throw new Error("Selection cancelled.");
      }

      const raw = await readFile(selection.filePaths[0], "utf8");
      let parsed: unknown;

      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new Error("This theme file is not valid.");
      }

      const file = sanitizeThemeFile(parsed);
      if (!file) {
        throw new Error("This theme file is not valid.");
      }

      const data = await services.repository.getData();
      const id = `imported:${slugifyThemeName(file.name)}-${crypto.randomUUID().slice(0, 8)}` as ImportedThemeId;
      const importedTheme = createImportedTheme(file, id, new Date().toISOString());
      const nextSettings = await services.repository.setSettings({
        ...data.settings,
        importedThemes: [...data.settings.importedThemes, importedTheme]
      });
      await options.onSettingsChanged?.(nextSettings);
      return nextSettings;
    })
  );
  ipcMain.handle("nova:export-theme", async () =>
    toResponse(async () => {
      const data = await services.repository.getData();
      const file = exportThemeFile(data.settings.theme, data.settings.importedThemes);
      const selection = await dialog.showSaveDialog({
        defaultPath: `${slugifyThemeName(file.name)}.nova-theme.json`,
        filters: [{ name: "Nova Theme", extensions: ["json"] }]
      });

      if (selection.canceled || !selection.filePath) {
        throw new Error("Save cancelled.");
      }

      await writeFile(selection.filePath, `${JSON.stringify(file, null, 2)}\n`, "utf8");
      return selection.filePath;
    })
  );
  ipcMain.handle("nova:delete-theme", async (_event, themeId: ImportedThemeId) =>
    toResponse(async () => {
      const data = await services.repository.getData();
      const nextSettings = await services.repository.setSettings({
        ...data.settings,
        theme: data.settings.theme === themeId ? "nova-dark" : data.settings.theme,
        importedThemes: data.settings.importedThemes.filter((theme) => theme.id !== themeId)
      });
      await options.onSettingsChanged?.(nextSettings);
      return nextSettings;
    })
  );

  ipcMain.handle("nova:list-mods", async (_event, instanceId: string) => services.mods.list(instanceId));
  ipcMain.handle("nova:toggle-mod", async (_event, instanceId: string, modId: string, enabled: boolean) =>
    toResponse(() => services.mods.toggle(instanceId, modId, enabled))
  );
  ipcMain.handle("nova:delete-mod", async (_event, instanceId: string, modId: string) =>
    toResponse(() => services.mods.delete(instanceId, modId))
  );
  ipcMain.handle("nova:check-mod-updates", async (_event, instanceId: string) =>
    toResponse(() => services.mods.checkModUpdates(instanceId))
  );
  ipcMain.handle("nova:update-mod", async (_event, instanceId: string, modId: string) =>
    toResponse(() => services.mods.updateMod(instanceId, modId))
  );
  ipcMain.handle("nova:update-all-mods", async (_event, instanceId: string) =>
    toResponse(() => services.mods.updateAllMods(instanceId))
  );
  ipcMain.handle("nova:import-local-mod", async (_event, instanceId: string) =>
    toResponse(async () => {
      const selection = await dialog.showOpenDialog({
        filters: [{ name: "Minecraft Mod", extensions: ["jar"] }],
        properties: ["openFile", "multiSelections"]
      });

      if (selection.canceled || selection.filePaths.length === 0) {
        throw new Error("Selection cancelled.");
      }

      return services.mods.importLocalMods(instanceId, selection.filePaths);
    })
  );
  ipcMain.handle("nova:import-mrpack", async (event) =>
    toResponse(async () => {
      const selection = await dialog.showOpenDialog({
        filters: [
          { name: "Modrinth Pack", extensions: ["mrpack"] },
          { name: "Zip Archive", extensions: ["zip"] }
        ],
        properties: ["openFile"]
      });

      if (selection.canceled || !selection.filePaths[0]) {
        throw new Error("Selection cancelled.");
      }

      const context: MrpackImportContext = {
        packPath: selection.filePaths[0]
      };
      appendMrpackImportLog("info", "Starting mrpack import", context);

      const result = await services.mods.importMrpack(
        selection.filePaths[0],
        (status: ModpackImportStatusEvent) => {
          context.packName = status.packName ?? context.packName;
          context.packVersion = status.packVersion ?? context.packVersion;
          context.instanceId = status.instanceId ?? context.instanceId;

          event.sender.send("nova:mrpack-import-status", status);
          appendMrpackImportLog(
            status.stage === "failed" ? "error" : "info",
            status.stage,
            context,
            {
              message: status.message,
              progress: status.progress,
              current: status.current,
              total: status.total,
              failedFiles: status.failedFiles?.length
            }
          );
        }
      );

      appendMrpackImportLog("info", "Mrpack import completed", context, {
        downloadedFiles: result.downloadedFiles,
        copiedOverrideFiles: result.copiedOverrideFiles,
        skippedOptionalFiles: result.skippedOptionalFiles,
        failedFiles: result.failedFiles.length
      });

      return result;
    })
  );

  ipcMain.handle(
    "nova:search-modrinth",
    async (_event, query: string, filters: ModSearchFilters, page?: number, pageSize?: number) =>
      toResponse(() => services.modrinth.search(query, filters, page, pageSize))
  );
  ipcMain.handle("nova:list-modrinth-versions", async (_event, projectId: string, filters: ModSearchFilters) =>
    toResponse(() => services.modrinth.getCompatibleVersions(projectId, filters))
  );
  ipcMain.handle(
    "nova:install-mod",
    async (_event, source: "modrinth", instanceId: string, projectId: string, versionId?: string) =>
      toResponse(async () => {
        let tempPath: string | undefined;
        try {
          const instance = await services.instances.get(instanceId);
          await services.instances.ensurePaths(instance);
          const filters = {
            minecraftVersion: instance.minecraftVersion,
            loader: instance.loader
          } satisfies ModSearchFilters;

          const version = await services.modrinth.getCompatibleVersion(projectId, filters, versionId);
          tempPath = join(instance.paths.mods, `.nova-install-${crypto.randomUUID()}.tmp`);

          await services.downloads.enqueue({
            label: `Downloading ${version.name}`,
            source: version.fileUrl,
            destination: tempPath,
            sha512: version.sha512,
            sha1: version.sha1
          });

          return services.mods.addDownloadedMod(instanceId, tempPath, {
            fileName: version.fileName,
            displayName: version.name,
            version: version.versionNumber,
            source: "modrinth",
            projectId: version.projectId ?? projectId,
            projectSlug: version.projectSlug,
            versionId: version.versionId,
            fileId: version.versionId,
            loader: instance.loader,
            sha1: version.sha1,
            sha512: version.sha512,
            expectedFileSize: version.fileSize,
            minecraftVersions: version.gameVersions,
            releaseChannel: version.versionType,
            requiredDependencies: version.dependencies
              .filter((dependency) => dependency.dependency_type === "required")
              .map((dependency) => dependency.project_id ?? dependency.version_id ?? "")
              .filter(Boolean)
          });
        } catch (error) {
          console.error("[nova][mods] install failed", {
            instanceId,
            projectId,
            versionId,
            error
          });
          throw new Error(toShortModError("install", error));
        } finally {
          if (tempPath) {
            await rm(tempPath, { force: true }).catch(() => undefined);
          }
        }
      })
  );
  ipcMain.handle("nova:change-mod-version", async (_event, instanceId: string, modId: string, versionId: string) =>
    toResponse(async () => {
      try {
        return await services.mods.changeModVersion(instanceId, modId, versionId);
      } catch (error) {
        console.error("[nova][mods] version change failed", {
          instanceId,
          modId,
          versionId,
          error
        });
        throw new Error(toShortModError("change-version", error));
      }
    })
  );

  ipcMain.handle("nova:get-news", async () => services.news.getNews());
  ipcMain.handle("nova:launch-instance", async (_event, instanceId: string) =>
    toResponse(() => services.launch.launch(instanceId))
  );
  ipcMain.handle("nova:get-launch-command-preview", async (_event, instanceId: string) =>
    toResponse(() => services.launch.getLaunchCommandPreview(instanceId))
  );
  ipcMain.handle("nova:save-text-file", async (_event, defaultFileName: string, contents: string) =>
    toResponse(async () => {
      const selection = await dialog.showSaveDialog({
        defaultPath: defaultFileName
      });

      if (selection.canceled || !selection.filePath) {
        throw new Error("Save cancelled.");
      }

      await writeFile(selection.filePath, contents, "utf8");
      return selection.filePath;
    })
  );
  ipcMain.handle("nova:save-session-log-copy", async (_event, sourcePath: string, defaultFileName?: string) =>
    toResponse(async () => {
      const selection = await dialog.showSaveDialog({
        defaultPath: defaultFileName || basename(sourcePath)
      });

      if (selection.canceled || !selection.filePath) {
        throw new Error("Save cancelled.");
      }

      await copyFile(sourcePath, selection.filePath);
      return selection.filePath;
    })
  );
  ipcMain.handle("nova:open-data-directory", async () =>
    toResponse(async () => {
      const data = await services.repository.getData();
      const dataRoot = dirname(data.settings.defaultInstanceRoot);
      await shell.openPath(dataRoot);
      return true;
    })
  );
  ipcMain.handle("nova:clear-download-cache", async () =>
    toResponse(async () => {
      const data = await services.repository.getData();
      await rm(data.settings.downloadCacheRoot, { recursive: true, force: true });
      await mkdir(data.settings.downloadCacheRoot, { recursive: true });
      return true;
    })
  );
};
