import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { appendFileSync, mkdirSync } from "node:fs";
import { app, BrowserWindow } from "electron";
import { registerIpc } from "./ipc/registerIpc";
import { AccountService } from "./services/accounts/accountService";
import { AuthService } from "./services/auth/authService";
import { DownloadManager } from "./services/downloads/downloadManager";
import { DiscordPresenceService } from "./services/integrations/discordPresenceService";
import { InstanceService } from "./services/instances/instanceService";
import { ModService } from "./services/instances/modService";
import { JavaService } from "./services/java/javaService";
import { FabricService } from "./services/loaders/fabricService";
import { ForgeService } from "./services/loaders/forgeService";
import { NeoForgeService } from "./services/loaders/neoforgeService";
import { LaunchService } from "./services/minecraft/launchService";
import { NewsService } from "./services/minecraft/newsService";
import { VersionManifestService } from "./services/minecraft/versionManifestService";
import { ModrinthService } from "./services/modrinth/modrinthService";
import { LauncherRepository } from "./services/storage/launcherRepository";
import { RuntimeConfigService } from "./services/storage/runtimeConfigService";
import { SecureStore } from "./services/storage/secureStore";

let mainWindow: BrowserWindow | null = null;
const __dirname = dirname(fileURLToPath(import.meta.url));

const writeStartupLog = (message: string) => {
  try {
    const userDataPath = app.getPath("userData");
    mkdirSync(userDataPath, { recursive: true });
    appendFileSync(join(userDataPath, "startup.log"), `${new Date().toISOString()} ${message}\n`);
  } catch {
    // Ignore startup logging failures.
  }
};

const isIgnorableDiscordRpcError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message.includes("ECONNREFUSED") && message.includes("127.0.0.1:6463");
};

const createWindow = async () => {
  mainWindow = new BrowserWindow({
    width: 1520,
    height: 940,
    minWidth: 1240,
    minHeight: 780,
    backgroundColor: "#060607",
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.webContents.on("did-fail-load", (_event, code, description, validatedURL) => {
    writeStartupLog(`did-fail-load code=${code} description=${description} url=${validatedURL}`);
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    await mainWindow.loadFile(join(__dirname, "../dist/index.html"));
  }
};

process.on("uncaughtException", (error) => {
  if (isIgnorableDiscordRpcError(error)) {
    return;
  }
  writeStartupLog(`uncaughtException ${error?.stack || error?.message || String(error)}`);
});

process.on("unhandledRejection", (reason) => {
  const error = reason instanceof Error ? reason : new Error(String(reason));
  if (isIgnorableDiscordRpcError(error)) {
    return;
  }
  writeStartupLog(`unhandledRejection ${error.stack || error.message}`);
});

app.whenReady().then(async () => {
  const repository = new LauncherRepository(app.getPath("userData"));
  const runtimeConfig = new RuntimeConfigService(app.getPath("userData"));
  const initialData = await repository.getData();
  let currentSettings = initialData.settings;
  let effectivePerformanceMode = false;
  const secureStore = new SecureStore(join(app.getPath("userData"), "secure-tokens.json"));
  const auth = new AuthService(
    repository,
    secureStore,
    runtimeConfig
  );
  const accounts = new AccountService(repository, secureStore);
  const java = new JavaService(join(app.getPath("userData"), "java-runtimes"));
  const instances = new InstanceService(repository);
  const fabric = new FabricService();
  const forge = new ForgeService();
  const neoforge = new NeoForgeService();
  const news = new NewsService();
  const modrinth = new ModrinthService();
  const resolveDownloadConcurrency = (settings = currentSettings, performanceMode = effectivePerformanceMode) =>
    performanceMode ? Math.min(Math.max(settings.maxParallelDownloads, 1), 4) : Math.max(settings.maxParallelDownloads, 1);

  const downloads = new DownloadManager(
    resolveDownloadConcurrency(initialData.settings, effectivePerformanceMode),
    initialData.settings.retryFailedDownloads
  );
  const mods = new ModService(
    instances,
    repository,
    downloads,
    modrinth,
    fabric,
    forge,
    neoforge
  );
  const launch = new LaunchService(instances, auth, java, mods, repository, forge, neoforge);
  const discordPresence = new DiscordPresenceService(repository, runtimeConfig);

  const applyDeveloperMode = (enabled: boolean) => {
    if (!mainWindow) {
      return;
    }

    if (enabled) {
      if (!mainWindow.webContents.isDevToolsOpened()) {
        mainWindow.webContents.openDevTools({ mode: "detach" });
      }
      return;
    }

    if (mainWindow.webContents.isDevToolsOpened()) {
      mainWindow.webContents.closeDevTools();
    }
  };

  const handleLaunchWindowState = (state: string) => {
    if (!mainWindow) {
      return;
    }

    if (state === "launching-game" || state === "game-running") {
      if (currentSettings.closeLauncherOnGameStart) {
        mainWindow.hide();
      } else if (!currentSettings.keepLauncherOpen) {
        mainWindow.minimize();
      }
      return;
    }

    if (
      state === "launch-failed" ||
      state === "game-crashed" ||
      state === "game-exited-successfully"
    ) {
      if (currentSettings.closeLauncherOnGameStart && !mainWindow.isVisible()) {
        mainWindow.show();
      }
      if (!currentSettings.keepLauncherOpen && mainWindow.isMinimized()) {
        mainWindow.restore();
      }
    }
  };

  registerIpc({
    accounts,
    auth,
    downloads,
    instances,
    mods,
    java,
    fabric,
    forge,
    neoforge,
    launch,
    news,
    versions: new VersionManifestService(),
    modrinth,
    repository,
    runtimeConfig
  }, {
    onEffectivePerformanceModeChanged: async (enabled) => {
      effectivePerformanceMode = enabled;
      downloads.setMaxParallel(resolveDownloadConcurrency());
    },
    onRuntimeConfigChanged: async () => {
      await discordPresence.refresh();
    },
    onSettingsChanged: async (settings) => {
      currentSettings = settings;
      downloads.setRetryFailed(settings.retryFailedDownloads);
      downloads.setMaxParallel(resolveDownloadConcurrency(settings));
      applyDeveloperMode(settings.developerMode);
      await discordPresence.refresh();
    }
  });

  downloads.subscribe((tasks) => {
    mainWindow?.webContents.send("nova:downloads-updated", tasks);
  });

  launch.onLogs((entries) => {
    mainWindow?.webContents.send("nova:launch-logs", entries);
  });

  launch.onStatus((entry) => {
    mainWindow?.webContents.send("nova:launch-status", entry);
    handleLaunchWindowState(entry.state);
    void discordPresence.onLaunchStatus(entry);
  });

  await createWindow();
  applyDeveloperMode(currentSettings.developerMode);
  await discordPresence.refresh().catch(() => undefined);

  app.on("certificate-error", (_event, _webContents, url, error, certificate) => {
    console.warn(
      `[Nova Auth] [main] [chromium-certificate-error] ${error} for ${url}` +
        (certificate?.issuerName ? ` issuer=${certificate.issuerName}` : "") +
        (certificate?.subjectName ? ` subject=${certificate.subjectName}` : "")
    );
  });

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
