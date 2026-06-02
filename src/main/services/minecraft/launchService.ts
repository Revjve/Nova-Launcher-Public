import { createMinecraftProcessWatcher, diagnoseLibraries, generateArguments, launch, MinecraftFolder, Version } from "@xmcl/core";
import {
  getVersionList,
  installAssets,
  installFabric,
  installForge,
  installLibraries,
  installNeoForged,
  installVersion
} from "@xmcl/installer";
import { EventEmitter } from "node:events";
import { createHash } from "node:crypto";
import { appendFile, copyFile, mkdir, readFile, stat, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Agent } from "undici";
import type {
  Instance,
  InstalledMod,
  LaunchLogEntry,
  LaunchResult,
  LaunchState,
  LaunchStatusEvent,
  LauncherAccount
} from "../../../shared/types";
import { AuthService } from "../auth/authService";
import { InstanceService } from "../instances/instanceService";
import { ModService } from "../instances/modService";
import { JavaService } from "../java/javaService";
import { ForgeService } from "../loaders/forgeService";
import { NeoForgeService } from "../loaders/neoforgeService";
import { LauncherRepository } from "../storage/launcherRepository";

type LaunchContext = {
  account: LauncherAccount;
  accessToken?: string;
  instance: Instance;
  javaPath: string;
  javaMajor: number;
  sessionId: string;
  userType: "mojang" | "legacy";
  versionId: string;
};

type PreparedInstance = {
  requiredJavaMajor: number;
  versionId: string;
};

type SessionRuntime = {
  instanceId: string;
  sessionId: string;
  logPath: string;
  startedAt: number;
};

type PendingLogFlush = {
  entries: LaunchLogEntry[];
  lines: string[];
};

type FriendlyLaunchError = {
  destinationPath?: string;
  failedUrl?: string;
  message: string;
  summary: string;
};

type LibraryIssue = Awaited<ReturnType<typeof diagnoseLibraries>>[number];

const isAggregateErrorLike = (error: unknown): error is { errors: unknown[] } =>
  typeof error === "object" &&
  error !== null &&
  "errors" in error &&
  Array.isArray((error as { errors?: unknown[] }).errors);

const HOST_MESSAGES: Array<{
  host: string;
  summary: string;
}> = [
  { host: "piston-meta.mojang.com", summary: "Could not download Minecraft version metadata." },
  { host: "launchermeta.mojang.com", summary: "Could not download Minecraft version metadata." },
  { host: "piston-data.mojang.com", summary: "Could not download the Minecraft client jar." },
  { host: "libraries.minecraft.net", summary: "Could not download a required Minecraft library." },
  { host: "resources.download.minecraft.net", summary: "Could not download a required Minecraft asset." },
  { host: "meta.fabricmc.net", summary: "Could not download Fabric loader metadata." },
  { host: "maven.fabricmc.net", summary: "Could not download a required Fabric library." },
  { host: "maven.minecraftforge.net", summary: "Could not download a required Forge library." },
  { host: "files.minecraftforge.net", summary: "Could not download Forge loader metadata." },
  { host: "maven.neoforged.net", summary: "Could not download a required NeoForge library." },
  { host: "cdn.modrinth.com", summary: "Could not download a required mod file." }
];

const statusProgress: Record<LaunchState, number> = {
  idle: 0,
  "preparing-instance": 6,
  "validating-instance": 12,
  "checking-java": 18,
  "resolving-version": 26,
  "downloading-version-manifest": 32,
  "downloading-client": 42,
  "checking-loader": 48,
  "installing-loader": 56,
  "checking-installed-mods": 62,
  "checking-sodium-compatibility": 68,
  "downloading-libraries": 74,
  "downloading-assets": 84,
  "extracting-natives": 90,
  "building-classpath": 94,
  "launching-game": 97,
  "game-running": 100,
  "game-exited-successfully": 100,
  "game-crashed": 100,
  "launch-failed": 100,
  cancelled: 100
};

const parseVersionParts = (version: string) =>
  version
    .split(/[.-]/)
    .map((part) => Number.parseInt(part, 10))
    .filter((part) => Number.isFinite(part));

const compareVersions = (left: string, right: string) => {
  const a = parseVersionParts(left);
  const b = parseVersionParts(right);
  const limit = Math.max(a.length, b.length);

  for (let index = 0; index < limit; index += 1) {
    const diff = (a[index] ?? 0) - (b[index] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }

  return 0;
};

const requiredJavaMajor = (minecraftVersion: string) => {
  if (compareVersions(minecraftVersion, "1.20.5") >= 0) {
    return 21;
  }
  if (compareVersions(minecraftVersion, "1.18") >= 0) {
    return 17;
  }
  return 8;
};

const loaderDisplayName = (loader: Instance["loader"]) => {
  switch (loader) {
    case "fabric":
      return "Fabric";
    case "forge":
      return "Forge";
    case "neoforge":
      return "NeoForge";
    default:
      return "Minecraft";
  }
};

const runtimeLabel = (instance: Instance) =>
  instance.loader === "vanilla"
    ? "Minecraft runtime"
    : `Minecraft and ${loaderDisplayName(instance.loader)} runtime`;

const summarizeHost = (url?: string) => {
  if (!url) {
    return undefined;
  }

  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.pathname}`;
  } catch {
    return url;
  }
};

const toError = (error: unknown, fallback = "Unknown launcher error.") => {
  if (error instanceof Error) {
    if (error.message?.trim()) {
      return error;
    }
    const wrapped = new Error(fallback);
    Object.assign(wrapped, error);
    if ((error as Error & { cause?: unknown }).cause && (error as Error & { cause?: unknown }).cause !== error) {
      Object.assign(wrapped, { cause: (error as Error & { cause?: unknown }).cause });
    }
    return wrapped;
  }

  const stringified = typeof error === "string" ? error.trim() : String(error ?? "").trim();
  return new Error(stringified || fallback);
};

export class LaunchService {
  private readonly logEmitter = new EventEmitter();
  private readonly statusEmitter = new EventEmitter();
  private readonly processes = new Map<string, Awaited<ReturnType<typeof launch>>>();
  private readonly sessions = new Map<string, SessionRuntime>();
  private readonly pendingLogs = new Map<string, PendingLogFlush>();
  private logFlushTimer?: NodeJS.Timeout;
  private readonly lastStatusBySession = new Map<string, string>();

  constructor(
    private readonly instances: InstanceService,
    private readonly auth: AuthService,
    private readonly java: JavaService,
    private readonly mods: ModService,
    private readonly repository: LauncherRepository,
    private readonly forgeVersions: ForgeService,
    private readonly neoforgeVersions: NeoForgeService
  ) {}

  onLogs(listener: (entries: LaunchLogEntry[]) => void): () => void {
    this.logEmitter.on("logs", listener);
    return () => this.logEmitter.off("logs", listener);
  }

  onStatus(listener: (entry: LaunchStatusEvent) => void): () => void {
    this.statusEmitter.on("status", listener);
    return () => this.statusEmitter.off("status", listener);
  }

  private async getActiveAccount(): Promise<LauncherAccount | undefined> {
    const data = await this.repository.getData();
    return data.accounts.find((account) => account.active);
  }

  private async createSession(instance: Instance): Promise<SessionRuntime> {
    const sessionId = crypto.randomUUID();
    const logsRoot = join(instance.paths.logs, "nova-launcher");
    await mkdir(logsRoot, { recursive: true });
    const logPath = join(logsRoot, `${new Date().toISOString().replace(/[:.]/g, "-")}-${sessionId}.log`);
    const runtime: SessionRuntime = {
      instanceId: instance.id,
      sessionId,
      logPath,
      startedAt: Date.now()
    };

    this.sessions.set(sessionId, runtime);
    return runtime;
  }

  private queueSessionLog(sessionId: string, entry: LaunchLogEntry): void {
    const pending = this.pendingLogs.get(sessionId) ?? { entries: [], lines: [] };
    pending.entries.push(entry);
    pending.lines.push(this.formatLogLine(entry));
    this.pendingLogs.set(sessionId, pending);
    this.scheduleLogFlush();
  }

  private formatLogLine(entry: LaunchLogEntry): string {
    const details = entry.details
      ? Object.entries(entry.details)
          .filter(([, value]) => value !== undefined && value !== "")
          .map(([key, value]) => `${key}=${String(value)}`)
          .join(" ")
      : "";

    return `[${entry.timestamp}] [${entry.level}] [${entry.source}] ${entry.message}${details ? ` ${details}` : ""}`;
  }

  private scheduleLogFlush(): void {
    if (this.logFlushTimer) {
      return;
    }

    this.logFlushTimer = setTimeout(() => {
      this.logFlushTimer = undefined;
      void this.flushPendingLogs();
    }, 50);
  }

  private async flushPendingLogs(): Promise<void> {
    if (this.pendingLogs.size === 0) {
      return;
    }

    const pending = [...this.pendingLogs.entries()];
    this.pendingLogs.clear();
    const emittedEntries: LaunchLogEntry[] = [];

    for (const [sessionId, batch] of pending) {
      emittedEntries.push(...batch.entries);
      const runtime = this.sessions.get(sessionId);
      if (!runtime || batch.lines.length === 0) {
        continue;
      }

      await appendFile(runtime.logPath, `${batch.lines.join("\n")}\n`).catch(() => undefined);
    }

    if (emittedEntries.length > 0) {
      this.logEmitter.emit("logs", emittedEntries);
    }
  }

  private scheduleSessionCleanup(sessionId: string): void {
    const cleanup = setTimeout(() => {
      this.sessions.delete(sessionId);
      this.pendingLogs.delete(sessionId);
      this.lastStatusBySession.delete(sessionId);
    }, 5 * 60_000);

    cleanup.unref?.();
  }

  private async emitLog(
    sessionId: string,
    instanceId: string,
    source: LaunchLogEntry["source"],
    level: LaunchLogEntry["level"],
    message: string,
    details?: LaunchLogEntry["details"]
  ): Promise<void> {
    const entry: LaunchLogEntry = {
      id: crypto.randomUUID(),
      instanceId,
      sessionId,
      source,
      level,
      message,
      timestamp: new Date().toISOString(),
      details
    };
    this.queueSessionLog(sessionId, entry);
  }

  private emitStatus(sessionId: string, instanceId: string, state: LaunchState, message: string, patch: Partial<LaunchStatusEvent> = {}): void {
    const runtime = this.sessions.get(sessionId);
    const payload = {
      type: "launch-status",
      instanceId,
      sessionId,
      state,
      message,
      progress: patch.progress ?? statusProgress[state],
      timestamp: new Date().toISOString(),
      latestLogPath: runtime?.logPath,
      ...patch
    } satisfies LaunchStatusEvent;
    const statusKey = JSON.stringify([
      payload.state,
      payload.message,
      payload.progress,
      payload.current,
      payload.total,
      payload.exitCode
    ]);

    if (this.lastStatusBySession.get(sessionId) === statusKey) {
      return;
    }

    this.lastStatusBySession.set(sessionId, statusKey);
    this.statusEmitter.emit("status", payload);
  }

  private createLoggedFetch(
    sessionId: string,
    instanceId: string,
    source: LaunchLogEntry["source"],
    logicalStep: string
  ): typeof fetch {
    return async (url, init) => {
      const target = typeof url === "string" ? url : url.toString();
      const parsed = new URL(target);
      const timeout = AbortSignal.timeout(30_000);
      const signal = init?.signal
        ? AbortSignal.any([init.signal as AbortSignal, timeout])
        : timeout;

      await this.emitLog(sessionId, instanceId, source, "debug", `${logicalStep} request`, {
        host: parsed.hostname,
        path: parsed.pathname,
        process: "main"
      });

      try {
        const response = await fetch(target, { ...init, signal });
        if (!response.ok) {
          const body = (await response.text().catch(() => "")).slice(0, 300);
          const error = new Error(`${logicalStep} failed with status ${response.status}. ${body}`.trim());
          Object.assign(error, {
            failedUrl: target,
            httpStatus: response.status,
            responseBody: body
          });
          throw error;
        }

        return response;
      } catch (error) {
        const failure = error instanceof Error ? error : new Error(String(error));
        Object.assign(failure, {
          failedUrl: target,
          logicalStep
        });
        await this.emitLog(sessionId, instanceId, source, "error", `${logicalStep} failed`, {
          host: parsed.hostname,
          path: parsed.pathname,
          error: failure.message
        });
        throw failure;
      }
    };
  }

  private describeError(error: unknown, seen = new Set<unknown>()): FriendlyLaunchError {
    const err = toError(error);
    if (seen.has(err)) {
      const cycleMessage = err.message?.trim() || "Unknown launcher error.";
      return {
        failedUrl:
          (err as { failedUrl?: string }).failedUrl ??
          (err as { url?: string }).url ??
          (err as { urls?: string[] }).urls?.[0],
        destinationPath:
          (err as { destinationPath?: string }).destinationPath ??
          (err as { destination?: string }).destination,
        summary: cycleMessage,
        message: cycleMessage
      };
    }
    seen.add(err);
    const fallbackMessage = err.message?.trim() || "Unknown launcher error.";
    const failedUrl =
      (err as { failedUrl?: string }).failedUrl ??
      (err as { url?: string }).url ??
      (err as { urls?: string[] }).urls?.[0];
    const destinationPath =
      (err as { destinationPath?: string }).destinationPath ??
      (err as { destination?: string }).destination;
    const tlsCode =
      typeof (err as { code?: unknown }).code === "string"
        ? (err as { code?: string }).code
        : undefined;
    const cause = (err as Error & { cause?: unknown }).cause;
    const fromCause =
      cause && cause instanceof Error
        ? this.describeError(cause, seen)
        : undefined;
    const summaryFromHost = HOST_MESSAGES.find((entry) => failedUrl?.includes(entry.host))?.summary;

    if (failedUrl && /^[a-zA-Z]:\\/.test(failedUrl)) {
      return {
        failedUrl,
        destinationPath,
        summary: "Launcher tried to fetch a local file as a URL. This is a launcher bug and has been fixed to use file system reads.",
        message: fallbackMessage
      };
    }

    if (
      fallbackMessage.toLowerCase().includes("unable to get local issuer certificate") ||
      tlsCode === "UNABLE_TO_GET_ISSUER_CERT_LOCALLY"
    ) {
      return {
        failedUrl,
        destinationPath,
        summary:
          "Nova could not verify the TLS certificate while downloading Minecraft libraries. This is usually caused by antivirus HTTPS scanning, VPN/proxy filtering, or an invalid system certificate chain.",
        message: fallbackMessage
      };
    }

    if (summaryFromHost) {
      return {
        failedUrl,
        destinationPath,
        summary: summaryFromHost,
        message: fallbackMessage
      };
    }

    if (fallbackMessage.includes("No Java runtime was found")) {
      return {
        failedUrl,
        destinationPath,
        summary: "Java was not found. Select a Java executable in Settings.",
        message: fallbackMessage
      };
    }

    if (fallbackMessage.includes("Sodium version does not support")) {
      return {
        failedUrl,
        destinationPath,
        summary: fallbackMessage,
        message: fallbackMessage
      };
    }

    if (fromCause) {
      return {
        failedUrl: failedUrl ?? fromCause.failedUrl,
        destinationPath: destinationPath ?? fromCause.destinationPath,
        summary: fromCause.summary,
        message: fallbackMessage
      };
    }

    return {
      failedUrl,
      destinationPath,
      summary: fallbackMessage,
      message: fallbackMessage
    };
  }

  private withStepError<T>(summary: string, details: Record<string, unknown> = {}) {
    return (error: unknown): never => {
      const err = toError(error, summary);
      const existingCause = (err as Error & { cause?: unknown }).cause;
      const safeCause =
        existingCause && existingCause !== err
          ? existingCause
          : error !== err
            ? error
            : undefined;
      Object.assign(err, {
        launchSummary: summary,
        ...details,
      });
      if (safeCause) {
        Object.assign(err, { cause: safeCause });
      }
      throw err;
    };
  }

  private async resolveJava(instance: Instance, sessionId: string): Promise<{ javaMajor: number; javaPath: string }> {
    this.emitStatus(sessionId, instance.id, "checking-java", "Checking Java.");
    const data = await this.repository.getData();
    const requiredMajor = requiredJavaMajor(instance.minecraftVersion);
    const javaPath = await this.java.resolveJavaPath(
      instance.javaPath || data.settings.defaultJavaPath,
      requiredMajor
    );
    if (!javaPath) {
      throw new Error("No Java runtime was found.");
    }

    const installation = await this.java.inspect(javaPath);
    if (installation.majorVersion < requiredMajor) {
      throw new Error(
        `Java ${requiredMajor}+ is required for Minecraft ${instance.minecraftVersion}. Nova found Java ${installation.majorVersion}.`
      );
    }

    await this.emitLog(sessionId, instance.id, "java", "info", `Using Java ${installation.version}.`, {
      path: installation.path,
      major: installation.majorVersion,
      recommendedMajor: requiredMajor
    });

    return {
      javaMajor: installation.majorVersion,
      javaPath
    };
  }

  private async sha1Matches(filePath: string, expectedSha1: string): Promise<boolean> {
    const buffer = await readFile(filePath);
    const actualSha1 = createHash("sha1").update(buffer).digest("hex");
    return actualSha1 === expectedSha1;
  }

  private async validateLibraryFile(library: LibraryIssue["library"], filePath: string): Promise<boolean> {
    if (!library?.download) {
      return false;
    }

    try {
      const fileStat = await stat(filePath);
      if (library.download.size && fileStat.size !== library.download.size) {
        return false;
      }
      if (library.download.sha1) {
        return this.sha1Matches(filePath, library.download.sha1);
      }
      return fileStat.size > 0;
    } catch {
      return false;
    }
  }

  private async diagnoseLibraryIssues(instance: Instance, versionId: string): Promise<LibraryIssue[]> {
    const resolved = await Version.parse(instance.paths.root, versionId);
    return diagnoseLibraries(resolved, MinecraftFolder.from(instance.paths.root));
  }

  private async reuseLocalLibraries(instance: Instance, issues: LibraryIssue[], sessionId: string): Promise<number> {
    const data = await this.repository.getData();
    const otherRoots = [...new Set(data.instances.filter((entry) => entry.id !== instance.id).map((entry) => entry.paths.root))];
    let reusedCount = 0;

    for (const issue of issues) {
      const library = issue.library;
      if (!library?.download?.path) {
        continue;
      }

      const destination = issue.file || join(instance.paths.root, "libraries", library.download.path);
      await unlink(destination).catch(() => undefined);

      for (const root of otherRoots) {
        const candidate = join(root, "libraries", library.download.path);
        if (!(await this.validateLibraryFile(library, candidate))) {
          continue;
        }

        await mkdir(dirname(destination), { recursive: true });
        await copyFile(candidate, destination);
        reusedCount += 1;
        await this.emitLog(sessionId, instance.id, "launcher", "debug", `Reused local library: ${library.name}`, {
          sourcePath: candidate,
          destinationPath: destination
        });
        break;
      }
    }

    return reusedCount;
  }

  private libraryErrorDetails(error: unknown): Record<string, unknown> {
    if (isAggregateErrorLike(error) && error.errors.length > 0) {
      const first = error.errors[0] as {
        code?: string;
        destination?: string;
        message?: string;
        url?: string;
        urls?: string[];
      };

      return {
        failedUrl: first.url ?? first.urls?.[0],
        destinationPath: first.destination,
        nestedCode: first.code,
        nestedMessage: first.message
      };
    }

    return {};
  }

  private createDownloadDispatcher(maxConnections: number): Agent {
    return new Agent({
      connections: Math.max(maxConnections, 1),
      connectTimeout: 30_000,
      headersTimeout: 300_000,
      bodyTimeout: 300_000,
      autoSelectFamily: true,
      autoSelectFamilyAttemptTimeout: 2_000
    });
  }

  private toInstallerDispatcher(dispatcher: Agent) {
    return dispatcher as unknown as NonNullable<Parameters<typeof installAssets>[1]>["dispatcher"];
  }

  private async resolveCompatibleLoaderVersion(instance: Instance, sessionId: string): Promise<Instance> {
    if (instance.loader === "vanilla") {
      return instance;
    }

    if (instance.loader === "fabric") {
      if (!instance.loaderVersion) {
        throw new Error("No Fabric loader version is set for this instance.");
      }
      return instance;
    }

    const versions =
      instance.loader === "forge"
        ? await this.forgeVersions.listVersions(instance.minecraftVersion)
        : await this.neoforgeVersions.listVersions(instance.minecraftVersion);

    if (versions.length === 0) {
      throw new Error(`No ${loaderDisplayName(instance.loader)} builds were found for Minecraft ${instance.minecraftVersion}.`);
    }

    const nextLoaderVersion =
      versions.find((entry) => entry.id === instance.loaderVersion)?.id ??
      versions.find((entry) => entry.recommended)?.id ??
      versions[0]?.id;

    if (!nextLoaderVersion) {
      throw new Error(`No ${loaderDisplayName(instance.loader)} builds were found for Minecraft ${instance.minecraftVersion}.`);
    }

    if (instance.loaderVersion === nextLoaderVersion) {
      return instance;
    }

    await this.emitLog(
      sessionId,
      instance.id,
      "launcher",
      "warn",
      `Updated ${loaderDisplayName(instance.loader)} loader version for this instance.`,
      {
        minecraftVersion: instance.minecraftVersion,
        previousLoaderVersion: instance.loaderVersion,
        nextLoaderVersion
      }
    );

    return this.instances.update(instance.id, { loaderVersion: nextLoaderVersion });
  }

  private async prepareFiles(instance: Instance, javaPath: string, sessionId: string): Promise<PreparedInstance> {
    await this.instances.ensurePaths(instance);
    await this.instances.update(instance.id, { installStatus: "installing" });
    this.emitStatus(sessionId, instance.id, "preparing-instance", "Preparing instance.");
    const settings = (await this.repository.getData()).settings;
    const maxParallelDownloads = Math.max(settings.maxParallelDownloads, 1);
    const dispatcher = this.createDownloadDispatcher(maxParallelDownloads);

    try {
      this.emitStatus(sessionId, instance.id, "resolving-version", `Resolving Minecraft ${instance.minecraftVersion}.`);
      this.emitStatus(sessionId, instance.id, "downloading-version-manifest", "Downloading version manifest.");
      const versionList = await getVersionList({
        fetch: this.createLoggedFetch(sessionId, instance.id, "launcher", "Version manifest")
      });
      const versionMeta = versionList.versions.find((item) => item.id === instance.minecraftVersion);

      if (!versionMeta) {
        throw new Error(`Minecraft version ${instance.minecraftVersion} was not found in the manifest.`);
      }

      this.emitStatus(sessionId, instance.id, "downloading-client", "Downloading client.");
      const baseResolved = await installVersion(versionMeta, instance.paths.root, {
        dispatcher: this.toInstallerDispatcher(dispatcher)
      }).catch(
        this.withStepError("Could not install the selected Minecraft version.", {
          failedUrl: versionMeta.url,
          minecraftVersion: instance.minecraftVersion,
          step: "install-version"
        })
      );
      let versionId = baseResolved.id;
      const installTarget = await this.resolveCompatibleLoaderVersion(instance, sessionId);

      if (installTarget.loader !== "vanilla" && !installTarget.loaderVersion) {
        throw new Error(`No ${loaderDisplayName(installTarget.loader)} loader version is set for this instance.`);
      }

      if (installTarget.loader === "fabric" && installTarget.loaderVersion) {
        this.emitStatus(sessionId, installTarget.id, "checking-loader", "Checking Fabric loader.");
        this.emitStatus(sessionId, installTarget.id, "installing-loader", "Installing Fabric.");
        versionId = await installFabric({
          minecraftVersion: installTarget.minecraftVersion,
          version: installTarget.loaderVersion,
          minecraft: installTarget.paths.root,
          side: "client",
          fetch: this.createLoggedFetch(sessionId, installTarget.id, "fabric", "Fabric metadata")
        }).catch(
          this.withStepError("Could not install the Fabric loader.", {
            loaderVersion: installTarget.loaderVersion,
            minecraftVersion: installTarget.minecraftVersion,
            step: "install-fabric"
          })
        );
      } else if (installTarget.loader === "forge" && installTarget.loaderVersion) {
        this.emitStatus(sessionId, installTarget.id, "checking-loader", "Checking Forge loader.");
        this.emitStatus(sessionId, installTarget.id, "installing-loader", "Installing Forge.");
        versionId = await installForge(
          {
            mcversion: installTarget.minecraftVersion,
            version: installTarget.loaderVersion
          },
          installTarget.paths.root,
          {
            java: javaPath,
            side: "client"
          }
        ).catch(
          this.withStepError("Could not install Forge loader.", {
            loader: "forge",
            loaderVersion: installTarget.loaderVersion,
            minecraftVersion: installTarget.minecraftVersion,
            step: "install-forge"
          })
        );
      } else if (installTarget.loader === "neoforge" && installTarget.loaderVersion) {
        this.emitStatus(sessionId, installTarget.id, "checking-loader", "Checking NeoForge loader.");
        this.emitStatus(sessionId, installTarget.id, "installing-loader", "Installing NeoForge.");
        versionId = await installNeoForged("neoforge", installTarget.loaderVersion, installTarget.paths.root, {
          java: javaPath,
          side: "client"
        }).catch(
          this.withStepError("Could not install NeoForge loader.", {
            loader: "neoforge",
            loaderVersion: installTarget.loaderVersion,
            minecraftVersion: installTarget.minecraftVersion,
            step: "install-neoforge"
          })
        );
      }

      const resolved = await Version.parse(instance.paths.root, versionId).catch(
        this.withStepError("Could not parse the installed Minecraft version profile.", {
          versionId,
          step: "parse-version"
        })
      );
      const resolvedJavaMajor = resolved.javaVersion?.majorVersion ?? requiredJavaMajor(instance.minecraftVersion);
      await this.emitLog(sessionId, instance.id, "launcher", "debug", "Resolved runtime requirements.", {
        versionId,
        requiredJavaMajor: resolvedJavaMajor,
        loader: installTarget.loader
      });
      this.emitStatus(sessionId, instance.id, "downloading-libraries", "Downloading libraries.");
      const initialLibraryIssues = await this.diagnoseLibraryIssues(instance, versionId);
      if (initialLibraryIssues.length > 0) {
        await this.emitLog(
          sessionId,
          instance.id,
          "launcher",
          "warn",
          `Detected ${initialLibraryIssues.length} missing or corrupted libraries before repair.`,
          {
            examples: initialLibraryIssues.slice(0, 3).map((issue) => issue.library?.name ?? issue.file).join(", ")
          }
        );
        const reusedCount = await this.reuseLocalLibraries(instance, initialLibraryIssues, sessionId);
        if (reusedCount > 0) {
          await this.emitLog(sessionId, instance.id, "launcher", "info", `Recovered ${reusedCount} libraries from existing local instances.`);
        }
      }

      const remainingLibraryIssues = await this.diagnoseLibraryIssues(instance, versionId);
      if (remainingLibraryIssues.length > 0) {
        await installLibraries(resolved, {
          dispatcher: this.toInstallerDispatcher(dispatcher),
          librariesDownloadConcurrency: maxParallelDownloads
        }).catch((error) =>
          this.withStepError("Could not download required Minecraft or loader libraries.", {
            versionId,
            step: "install-libraries",
            ...this.libraryErrorDetails(error)
          })(error)
        );
      }

      const postInstallLibraryIssues = await this.diagnoseLibraryIssues(instance, versionId);
      if (postInstallLibraryIssues.length > 0) {
        throw Object.assign(
          new Error(`Library repair is incomplete. ${postInstallLibraryIssues[0]?.library?.name ?? "A required library"} is still missing or corrupted.`),
          {
            failedUrl: postInstallLibraryIssues[0]?.library?.download?.url,
            destinationPath: postInstallLibraryIssues[0]?.file,
            step: "install-libraries",
            versionId
          }
        );
      }
      this.emitStatus(sessionId, instance.id, "downloading-assets", "Downloading assets.");
      await installAssets(resolved, {
        dispatcher: this.toInstallerDispatcher(dispatcher),
        assetsDownloadConcurrency: maxParallelDownloads,
        fetch: this.createLoggedFetch(sessionId, instance.id, "launcher", "Asset metadata")
      }).catch(
        this.withStepError("Could not download required Minecraft assets.", {
          versionId,
          step: "install-assets"
        })
      );
      this.emitStatus(sessionId, instance.id, "extracting-natives", "Extracting natives.");
      await this.instances.update(instance.id, { installStatus: "ready" });
      return {
        requiredJavaMajor: resolvedJavaMajor,
        versionId
      };
    } finally {
      await dispatcher.close();
    }
  }

  private async validateMods(instance: Instance, sessionId: string, javaMajor: number): Promise<InstalledMod[]> {
    this.emitStatus(sessionId, instance.id, "checking-installed-mods", "Checking installed mods.");
    const mods = await this.mods.list(instance.id);
    const enabledMods = mods.filter((mod) => mod.enabled);
    const logSource = instance.loader === "fabric" ? "fabric" : "launcher";
    if (enabledMods.length === 0) {
      return [];
    }

    const sodium = enabledMods.find(
      (mod) => mod.modId === "sodium" || mod.displayName.toLowerCase().includes("sodium")
    );

    if (sodium) {
      this.emitStatus(sessionId, instance.id, "checking-sodium-compatibility", "Checking Sodium compatibility.");
    }

    for (const mod of enabledMods) {
      if (mod.requiredJavaMajor && mod.requiredJavaMajor > javaMajor) {
        const message = `${mod.displayName} requires Java ${mod.requiredJavaMajor}, but Nova is using Java ${javaMajor}. Select a compatible Java runtime in Settings or install a mod version built for your current Minecraft setup.`;
        await this.emitLog(sessionId, instance.id, logSource, "error", message, {
          mod: mod.displayName,
          requiredJavaMajor: mod.requiredJavaMajor,
          activeJavaMajor: javaMajor
        });
        throw new Error(message);
      }

      for (const warning of mod.compatibilityWarnings ?? []) {
        await this.emitLog(sessionId, instance.id, logSource, "warn", warning, {
          mod: mod.displayName
        });
      }
    }

    const blockingCompatibility = enabledMods.find((mod) =>
      mod.compatibilityWarnings?.some(
        (warning) =>
          warning.includes("may not support Minecraft") ||
          (instance.loader === "fabric" &&
            (warning.includes("may require a different Fabric loader version") ||
              warning.includes("Requires Fabric API")))
      )
    );

    if (blockingCompatibility) {
      throw new Error(
        blockingCompatibility.compatibilityWarnings?.[0] ??
          `${blockingCompatibility.displayName} looks incompatible with this instance.`
      );
    }

    const blockingWarning = sodium?.compatibilityWarnings?.[0];
    if (blockingWarning) {
      throw new Error(`Sodium version does not support Minecraft ${instance.minecraftVersion}. Install a compatible version.`);
    }

    return enabledMods;
  }

  private async resolveOnlineContext(account: LauncherAccount, instance: Instance, sessionId: string): Promise<LaunchContext> {
    const session = await this.auth.getActiveSession();
    if (!session) {
      throw new Error("Sign in with a Microsoft account before launching.");
    }

    let { javaPath, javaMajor } = await this.resolveJava(instance, sessionId);
    const prepared = await this.prepareFiles(instance, javaPath, sessionId);
    if (javaMajor < prepared.requiredJavaMajor) {
      const upgradedJavaPath = await this.java.resolveJavaPath(
        instance.javaPath || (await this.repository.getData()).settings.defaultJavaPath,
        prepared.requiredJavaMajor
      );
      if (!upgradedJavaPath) {
        throw new Error(
          `Java ${prepared.requiredJavaMajor}+ is required for this ${runtimeLabel(instance)}, but Nova could not find a matching Java installation.`
        );
      }
      const upgraded = await this.java.inspect(upgradedJavaPath);
      if (upgraded.majorVersion < prepared.requiredJavaMajor) {
        throw new Error(
          `Java ${prepared.requiredJavaMajor}+ is required for this ${runtimeLabel(instance)}, but Nova found Java ${upgraded.majorVersion}.`
        );
      }
      javaPath = upgraded.path;
      javaMajor = upgraded.majorVersion;
      await this.emitLog(sessionId, instance.id, "java", "info", `Switching to Java ${upgraded.version} for this launch.`, {
        path: upgraded.path,
        major: upgraded.majorVersion,
        requiredMajor: prepared.requiredJavaMajor
      });
    }
    await this.validateMods(instance, sessionId, javaMajor);

    return {
      account,
      accessToken: session.secure.minecraftToken,
      instance,
      javaPath,
      javaMajor,
      sessionId,
      userType: "mojang",
      versionId: prepared.versionId
    };
  }

  private async resolveOfflineContext(account: LauncherAccount, instance: Instance, sessionId: string): Promise<LaunchContext> {
    let { javaPath, javaMajor } = await this.resolveJava(instance, sessionId);
    const prepared = await this.prepareFiles(instance, javaPath, sessionId);
    if (javaMajor < prepared.requiredJavaMajor) {
      const upgradedJavaPath = await this.java.resolveJavaPath(
        instance.javaPath || (await this.repository.getData()).settings.defaultJavaPath,
        prepared.requiredJavaMajor
      );
      if (!upgradedJavaPath) {
        throw new Error(
          `Java ${prepared.requiredJavaMajor}+ is required for this ${runtimeLabel(instance)}, but Nova could not find a matching Java installation.`
        );
      }
      const upgraded = await this.java.inspect(upgradedJavaPath);
      if (upgraded.majorVersion < prepared.requiredJavaMajor) {
        throw new Error(
          `Java ${prepared.requiredJavaMajor}+ is required for this ${runtimeLabel(instance)}, but Nova found Java ${upgraded.majorVersion}.`
        );
      }
      javaPath = upgraded.path;
      javaMajor = upgraded.majorVersion;
      await this.emitLog(sessionId, instance.id, "java", "info", `Switching to Java ${upgraded.version} for this launch.`, {
        path: upgraded.path,
        major: upgraded.majorVersion,
        requiredMajor: prepared.requiredJavaMajor
      });
    }
    await this.validateMods(instance, sessionId, javaMajor);

    return {
      account,
      accessToken: "OFFLINE_DEV",
      instance,
      javaPath,
      javaMajor,
      sessionId,
      userType: "legacy",
      versionId: prepared.versionId
    };
  }

  private async resolveLaunchContext(instanceId: string): Promise<LaunchContext> {
    const activeAccount = await this.getActiveAccount();
    if (!activeAccount) {
      throw new Error("Add a Microsoft account or an Offline Account before launching.");
    }

    const instance = await this.instances.get(instanceId);
    const session = await this.createSession(instance);

    if (activeAccount.type === "offline-dev") {
      await this.emitLog(session.sessionId, instanceId, "launcher", "info", "Launching with Offline Account.");
      return this.resolveOfflineContext(activeAccount, instance, session.sessionId);
    }

    await this.emitLog(session.sessionId, instanceId, "launcher", "info", "Launching with Microsoft account.");
    return this.resolveOnlineContext(activeAccount, instance, session.sessionId);
  }

  private createLaunchOptions(context: LaunchContext) {
    return {
      gamePath: context.instance.paths.root,
      resourcePath: context.instance.paths.root,
      javaPath: context.javaPath,
      version: context.versionId,
      minMemory: context.instance.memoryMinMb,
      maxMemory: context.instance.memoryMaxMb,
      accessToken: context.accessToken,
      gameProfile: {
        id: context.account.uuid,
        name: context.account.username
      },
      userType: context.userType,
      launcherName: "Nova Launcher",
      launcherBrand: "Nova Studios",
      extraJVMArgs: ["-Dnova.launcher=true", `-Dloader.type=${context.instance.loader}`]
    };
  }

  private async buildCommandPreview(context: LaunchContext): Promise<string> {
    this.emitStatus(context.sessionId, context.instance.id, "building-classpath", "Building launch command.");
    const args = await generateArguments(this.createLaunchOptions(context));
    const command = [`"${context.javaPath}"`, ...args].join(" ");

    return context.account.type === "offline-dev"
      ? command
      : context.accessToken
        ? command.replace(context.accessToken, "<redacted>")
        : command;
  }

  async getLaunchCommandPreview(instanceId: string): Promise<string> {
    const context = await this.resolveLaunchContext(instanceId);
    return this.buildCommandPreview(context);
  }

  async repair(instanceId: string): Promise<Instance> {
    const instance = await this.instances.get(instanceId);
    const session = await this.createSession(instance);

    try {
      const { javaPath } = await this.resolveJava(instance, session.sessionId);
      await this.prepareFiles(instance, javaPath, session.sessionId);
      const updated = await this.instances.update(instance.id, { installStatus: "ready" });
      await this.emitLog(session.sessionId, instance.id, "launcher", "info", "Instance repair finished.");
      await this.flushPendingLogs();
      this.emitStatus(session.sessionId, instance.id, "game-exited-successfully", "Instance is ready.");
      this.scheduleSessionCleanup(session.sessionId);
      return updated;
    } catch (error) {
      const friendly = this.describeError(error);
      await this.instances.update(instance.id, { installStatus: "failed" }).catch(() => undefined);
      await this.emitLog(session.sessionId, instance.id, "launcher", "error", friendly.message, {
        failedUrl: summarizeHost(friendly.failedUrl),
        destinationPath: friendly.destinationPath
      });
      await this.flushPendingLogs();
      this.emitStatus(session.sessionId, instance.id, "launch-failed", friendly.summary, {
        failedUrl: friendly.failedUrl,
        destinationPath: friendly.destinationPath,
        errorSummary: friendly.summary
      });
      this.scheduleSessionCleanup(session.sessionId);
      throw new Error(friendly.summary);
    }
  }

  async launch(instanceId: string): Promise<LaunchResult> {
    const instance = await this.instances.get(instanceId);
    let context: LaunchContext | undefined;

    try {
      context = await this.resolveLaunchContext(instanceId);
      const preview = await this.buildCommandPreview(context);
      this.emitStatus(context.sessionId, context.instance.id, "launching-game", "Starting Java process.");

      const child = await launch({
        ...this.createLaunchOptions(context),
        extraExecOption: {
          cwd: context.instance.paths.root,
          windowsHide: false
        }
      });

      this.processes.set(instanceId, child);
      const watcher = createMinecraftProcessWatcher(child);
      watcher.on("minecraft-window-ready", () => {
        this.emitStatus(context!.sessionId, context!.instance.id, "game-running", "Game running.");
      });
      watcher.on("minecraft-exit", async ({ code, crashReport, crashReportLocation }) => {
        this.processes.delete(instanceId);
        const durationMs = Date.now() - (this.sessions.get(context!.sessionId)?.startedAt ?? Date.now());
        await this.instances.update(instanceId, {
          lastLaunchStatus: code === 0 ? "success" : "error",
          installStatus: code === 0 ? "ready" : "needs-repair"
        });
        if (crashReport) {
          await this.emitLog(context!.sessionId, context!.instance.id, "minecraft", "error", "Crash report detected.", {
            crashReportPath: crashReportLocation,
            exitCode: code
          });
        }
        await this.flushPendingLogs();
        this.emitStatus(
          context!.sessionId,
          context!.instance.id,
          code === 0 ? "game-exited-successfully" : "game-crashed",
          code === 0 ? "Game exited successfully." : "Game crashed.",
          {
            crashReportPath: crashReportLocation,
            durationMs,
            exitCode: code
          }
        );
        this.scheduleSessionCleanup(context!.sessionId);
      });
      watcher.on("error", async (error) => {
        await this.emitLog(context!.sessionId, context!.instance.id, "java", "error", error instanceof Error ? error.message : String(error));
      });

      child.stdout?.on("data", (chunk: Buffer | string) => {
        for (const line of chunk.toString().split(/\r?\n/).filter(Boolean)) {
          void this.emitLog(context!.sessionId, context!.instance.id, "minecraft", "info", line);
        }
      });
      child.stderr?.on("data", (chunk: Buffer | string) => {
        for (const line of chunk.toString().split(/\r?\n/).filter(Boolean)) {
          void this.emitLog(context!.sessionId, context!.instance.id, "minecraft", "warn", line);
        }
      });

      await this.instances.update(instanceId, {
        lastPlayedAt: new Date().toISOString(),
        lastLaunchStatus: "success",
        installStatus: "ready"
      });

      return {
        launched: true,
        sessionId: context.sessionId,
        commandPreview: preview,
        latestLogPath: this.sessions.get(context.sessionId)?.logPath,
        message:
          context.account.type === "offline-dev"
            ? `${context.instance.name} is launching in local offline mode.`
            : `${context.instance.name} is launching now.`
      };
    } catch (error) {
      const sessionId = context?.sessionId ?? crypto.randomUUID();
      const friendly = this.describeError(error);
      const activeSession = this.sessions.get(sessionId);
      if (!activeSession) {
        const session = await this.createSession(instance);
        context = {
          account: (await this.getActiveAccount()) ?? {
            id: "anonymous",
            type: "offline-dev",
            username: "Nova",
            uuid: crypto.randomUUID(),
            active: true
          },
          instance,
          javaPath: "",
          javaMajor: 0,
          sessionId: session.sessionId,
          userType: "legacy",
          versionId: instance.minecraftVersion
        };
      }

      await this.instances.update(instanceId, {
        lastLaunchStatus: "error",
        installStatus: "failed"
      }).catch(() => undefined);

      const finalSessionId = context?.sessionId ?? sessionId;
      await this.emitLog(finalSessionId, instanceId, "launcher", "error", friendly.message, {
        failedUrl: summarizeHost(friendly.failedUrl),
        destinationPath: friendly.destinationPath
      });
      await this.flushPendingLogs();
      this.emitStatus(finalSessionId, instanceId, "launch-failed", friendly.summary, {
        failedUrl: friendly.failedUrl,
        destinationPath: friendly.destinationPath,
        errorSummary: friendly.summary
      });
      this.scheduleSessionCleanup(finalSessionId);
      throw new Error(friendly.summary);
    }
  }
}
