import {
  copyFile,
  mkdir,
  mkdtemp,
  readdir,
  rename,
  rm,
  stat,
  unlink,
  writeFile
} from "node:fs/promises";
import { basename, dirname, extname, join, posix } from "node:path";
import { tmpdir } from "node:os";
import { filterEntries, open, readAllEntries, readEntry } from "@xmcl/unzip";
import type {
  InstalledMod,
  Instance,
  LoaderType,
  ModSource,
  ModpackImportFailure,
  ModpackImportResult,
  ModpackImportStage,
  ModpackImportStatusEvent
} from "../../../shared/types";
import type { DownloadManager } from "../downloads/downloadManager";
import { FabricService } from "../loaders/fabricService";
import { ForgeService } from "../loaders/forgeService";
import { NeoForgeService } from "../loaders/neoforgeService";
import type {
  ResolvedModrinthVersion
} from "../modrinth/modrinthService";
import { ModrinthService } from "../modrinth/modrinthService";
import { JsonStore } from "../storage/jsonStore";
import { LauncherRepository } from "../storage/launcherRepository";
import { InstanceService } from "./instanceService";

type ModMetadataEntry = InstalledMod & { fileName: string };

type FabricModManifest = {
  id?: string;
  name?: string;
  version?: string;
  depends?: Record<string, unknown>;
  mixins?: Array<string | { config?: string }> | string;
};

type ParsedJarMetadata = {
  modId?: string;
  displayName?: string;
  version?: string;
  loader?: LoaderType;
  requiredDependencies?: string[];
  requiredJavaMajor?: number;
  compatibilityWarnings?: string[];
};

type ModInstallHook = (step: string, details?: Record<string, unknown>) => void;

type MrpackManifestFile = {
  path?: string;
  hashes?: Record<string, string>;
  downloads?: string[];
  fileSize?: number;
  env?: {
    client?: "required" | "optional" | "unsupported";
    server?: "required" | "optional" | "unsupported";
  };
};

type MrpackManifest = {
  formatVersion?: number;
  game?: string;
  versionId?: string;
  name?: string;
  summary?: string;
  files?: MrpackManifestFile[];
  dependencies?: Record<string, string>;
};

type ParsedMrpack = {
  manifest: MrpackManifest;
  name: string;
  instanceName: string;
  versionId?: string;
  minecraftVersion: string;
  loader: LoaderType;
  loaderVersion?: string;
};

type MrpackImportHook = (status: ModpackImportStatusEvent) => void;

type MrpackResolvedFile = {
  relativePath: string;
  destination: string;
  tempPath: string;
  downloadUrl: string;
};

const cleanDisplayName = (fileName: string) =>
  fileName
    .replace(/\.disabled$/i, "")
    .replace(/\.jar$/i, "")
    .replace(/[-_]+/g, " ");

const normalizeDependency = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.flatMap(normalizeDependency);
  }
  if (typeof value === "string") {
    return [value];
  }
  return [];
};

const normalizeStoredSource = (value: unknown): ModSource => {
  if (value === "modrinth") {
    return "modrinth";
  }
  return "local";
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isTransientVerificationError = (error: unknown) => {
  if (!(error instanceof Error) || !("code" in error)) {
    return false;
  }

  return ["EBUSY", "EPERM", "EACCES", "ENOENT"].includes(String(error.code));
};

const isTransientMoveError = (error: unknown) => {
  if (!(error instanceof Error) || !("code" in error)) {
    return false;
  }

  return ["EBUSY", "EPERM", "EACCES"].includes(String(error.code));
};

const sanitizeModFileName = (requestedFileName: string) => {
  const rawFileName = basename(requestedFileName.trim());
  const disabledSuffix = rawFileName.toLowerCase().endsWith(".disabled") ? ".disabled" : "";
  const withoutDisabled = disabledSuffix ? rawFileName.slice(0, -disabledSuffix.length) : rawFileName;
  const withoutJar = withoutDisabled.replace(/\.jar$/i, "");
  const sanitizedBase =
    withoutJar
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
      .replace(/\s+/g, " ")
      .trim() || `mod-${crypto.randomUUID().slice(0, 8)}`;

  return `${sanitizedBase}.jar${disabledSuffix}`;
};

const parseVersion = (value: string) =>
  value
    .split(/[.-]/)
    .map((part) => Number.parseInt(part, 10))
    .filter((part) => Number.isFinite(part));

const compareVersions = (left: string, right: string) => {
  const a = parseVersion(left);
  const b = parseVersion(right);
  const limit = Math.max(a.length, b.length);

  for (let index = 0; index < limit; index += 1) {
    const diff = (a[index] ?? 0) - (b[index] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }

  return 0;
};

const matchesExactPrefix = (currentVersion: string, token: string) => {
  if (token.includes("x") || token.includes("*")) {
    const prefix = token.replace(/[x*]/gi, "").replace(/\.$/, "");
    return currentVersion === prefix || currentVersion.startsWith(`${prefix}.`);
  }

  const parts = token.split(".");
  if (parts.length < 3) {
    return currentVersion === token || currentVersion.startsWith(`${token}.`);
  }

  return currentVersion === token;
};

const matchesComparator = (currentVersion: string, token: string) => {
  const trimmed = token.trim();
  if (!trimmed) {
    return true;
  }

  const comparatorMatch = trimmed.match(/^(>=|<=|>|<|=|~)?\s*(.+)$/);
  if (!comparatorMatch) {
    return false;
  }

  const [, comparator = "", rawTarget] = comparatorMatch;
  const target = rawTarget.trim();
  if (!target) {
    return true;
  }

  switch (comparator) {
    case ">=":
      return compareVersions(currentVersion, target) >= 0;
    case "<=":
      return compareVersions(currentVersion, target) <= 0;
    case ">":
      return compareVersions(currentVersion, target) > 0;
    case "<":
      return compareVersions(currentVersion, target) < 0;
    case "~":
    case "=":
    case "":
      return matchesExactPrefix(currentVersion, target);
    default:
      return false;
  }
};

const versionLooksCompatible = (declared: string[], currentVersion: string) => {
  if (declared.length === 0 || declared.some((value) => value === "*" || value === "")) {
    return true;
  }

  return declared.some((value) =>
    value
      .split("||")
      .some((clause) =>
        clause
          .trim()
          .split(/\s+/)
          .every((token) => matchesComparator(currentVersion, token))
      )
  );
};

const extractRequiredJavaMajor = (declared: string[]) => {
  const values = declared
    .map((entry) => entry.match(/\d+/g)?.map((part) => Number.parseInt(part, 10)) ?? [])
    .flat()
    .filter((part) => Number.isFinite(part));

  return values.length > 0 ? Math.max(...values) : undefined;
};

const normalizeMixinConfigs = (mixins: FabricModManifest["mixins"]) => {
  if (!mixins) {
    return [];
  }
  const items = Array.isArray(mixins) ? mixins : [mixins];
  return items
    .map((entry) => (typeof entry === "string" ? entry : entry.config))
    .filter((entry): entry is string => Boolean(entry));
};

const parseCompatibilityLevel = (value?: string) => {
  if (!value) {
    return undefined;
  }
  const match = value.match(/JAVA_(\d+)/i);
  return match ? Number.parseInt(match[1], 10) : undefined;
};

const normalizeArchivePath = (value: string) => value.replace(/\\/g, "/").replace(/^\/+/, "");

const toSafeRelativePath = (value: string) => {
  if (!value || /^[a-zA-Z]:/.test(value)) {
    return undefined;
  }

  const normalized = posix.normalize(normalizeArchivePath(value));
  if (!normalized || normalized === "." || normalized === "..") {
    return undefined;
  }
  if (normalized.startsWith("../") || normalized.includes("/../")) {
    return undefined;
  }
  if (normalized.startsWith("/")) {
    return undefined;
  }
  return normalized;
};

const isAllowedOverridePath = (relativePath: string) => {
  const segments = relativePath.split("/").filter(Boolean);
  if (segments.length === 0) {
    return false;
  }

  const firstSegment = segments[0]?.toLowerCase();
  return firstSegment !== ".git" && firstSegment !== ".nova";
};

const shouldDownloadClientFile = (file: MrpackManifestFile) => {
  const clientState = file.env?.client;
  if (clientState === "unsupported" || clientState === "optional") {
    return false;
  }
  return true;
};

const isMrpackModPath = (relativePath: string) =>
  relativePath.startsWith("mods/") && relativePath.toLowerCase().endsWith(".jar");

const buildMrpackFailure = (path: string, reason: string, url?: string): ModpackImportFailure => ({
  path,
  reason,
  url
});

const buildMrpackInstanceName = (packName: string, versionId?: string) => {
  const normalizedVersion = versionId?.trim();
  if (!normalizedVersion) {
    return packName;
  }

  return packName.toLowerCase().includes(normalizedVersion.toLowerCase())
    ? packName
    : `${packName} ${normalizedVersion}`;
};

const normalizeVersionText = (value?: string) => {
  if (!value || value.startsWith("${")) {
    return undefined;
  }
  return value;
};

const extractTomlValue = (text: string, key: string) => {
  const match = text.match(new RegExp(`^\\s*${key}\\s*=\\s*["']([^"']+)["']`, "m"));
  return match?.[1];
};

const parseForgeMetadata = (text: string, loader: LoaderType): ParsedJarMetadata | undefined => {
  const modBlock = text.split(/\[\[mods\]\]/i)[1] ?? text;
  const modId = extractTomlValue(modBlock, "modId");
  const displayName = extractTomlValue(modBlock, "displayName");
  const version = normalizeVersionText(extractTomlValue(modBlock, "version"));

  if (!modId && !displayName && !version) {
    return undefined;
  }

  return {
    modId,
    displayName,
    version,
    loader
  };
};

const requiredDependencyIds = (dependencies?: Record<string, unknown>) =>
  Object.entries(dependencies ?? {})
    .filter(([key]) => !["minecraft", "fabricloader", "java"].includes(key))
    .map(([key]) => key);

export class ModService {
  constructor(
    private readonly instances: InstanceService,
    private readonly repository: LauncherRepository,
    private readonly downloads: DownloadManager,
    private readonly modrinth: ModrinthService,
    private readonly fabric: FabricService,
    private readonly forge: ForgeService,
    private readonly neoforge: NeoForgeService
  ) {}

  private async metadataStore(instanceId: string): Promise<JsonStore<ModMetadataEntry[]>> {
    const instance = await this.instances.get(instanceId);
    return new JsonStore<ModMetadataEntry[]>(join(instance.paths.root, "nova-mods.json"));
  }

  private async loadMetadata(instanceId: string): Promise<ModMetadataEntry[]> {
    const store = await this.metadataStore(instanceId);
    return (await store.read()) ?? [];
  }

  private async saveMetadata(instanceId: string, entries: ModMetadataEntry[]): Promise<void> {
    const store = await this.metadataStore(instanceId);
    await store.write(entries);
  }

  private mergeMetadata(
    existing: ModMetadataEntry[],
    updates: ModMetadataEntry[],
    removedFileNames: string[] = []
  ) {
    const removed = new Set(removedFileNames);
    const byFileName = new Map(
      existing
        .filter((entry) => !removed.has(entry.fileName))
        .map((entry) => [entry.fileName, entry] as const)
    );

    for (const update of updates) {
      byFileName.set(update.fileName, update);
    }

    return [...byFileName.values()];
  }

  private async readEntryText(filePath: string, entryNames: string[]): Promise<string | undefined> {
    try {
      const zip = await open(filePath, { lazyEntries: true, autoClose: true });
      try {
        const [entry] = await filterEntries(zip, entryNames);
        if (!entry) {
          return undefined;
        }
        const raw = await readEntry(zip, entry);
        return raw.toString("utf8");
      } finally {
        zip.close();
      }
    } catch {
      return undefined;
    }
  }

  private async readFabricManifest(filePath: string): Promise<FabricModManifest | undefined> {
    const raw = await this.readEntryText(filePath, ["fabric.mod.json"]);
    if (!raw) {
      return undefined;
    }

    try {
      return JSON.parse(raw) as FabricModManifest;
    } catch {
      return undefined;
    }
  }

  private async readForgeManifest(filePath: string): Promise<ParsedJarMetadata | undefined> {
    const neoForgeRaw = await this.readEntryText(filePath, ["META-INF/neoforge.mods.toml"]);
    if (neoForgeRaw) {
      return parseForgeMetadata(neoForgeRaw, "neoforge");
    }

    const forgeRaw = await this.readEntryText(filePath, ["META-INF/mods.toml"]);
    if (forgeRaw) {
      return parseForgeMetadata(forgeRaw, "forge");
    }

    return undefined;
  }

  private async readMixinCompatibility(filePath: string, mixinConfigs: string[]) {
    if (mixinConfigs.length === 0) {
      return undefined;
    }

    try {
      const zip = await open(filePath, { lazyEntries: true, autoClose: true });
      try {
        const entries = (await filterEntries(zip, mixinConfigs)).filter(
          (entry): entry is NonNullable<typeof entry> => Boolean(entry)
        );
        const required = (
          await Promise.all(
            entries.map(async (entry) => {
              const raw = await readEntry(zip, entry);
              const config = JSON.parse(raw.toString("utf8")) as { compatibilityLevel?: string };
              return parseCompatibilityLevel(config.compatibilityLevel);
            })
          )
        ).filter((value): value is number => Number.isFinite(value));
        return required.length > 0 ? Math.max(...required) : undefined;
      } finally {
        zip.close();
      }
    } catch {
      return undefined;
    }
  }

  private async inspectJarMetadata(
    filePath: string,
    fileName: string,
    instanceMinecraftVersion?: string,
    instanceLoader?: LoaderType,
    instanceLoaderVersion?: string
  ): Promise<ParsedJarMetadata> {
    const fabricManifest = await this.readFabricManifest(filePath);
    const compatibilityWarnings: string[] = [];

    if (fabricManifest) {
      const javaDependency = extractRequiredJavaMajor(
        normalizeDependency(fabricManifest.depends?.java)
      );
      const mixinJavaCompatibility = await this.readMixinCompatibility(
        filePath,
        normalizeMixinConfigs(fabricManifest.mixins)
      );
      const requiredJavaMajor =
        Math.max(javaDependency ?? 0, mixinJavaCompatibility ?? 0) || undefined;

      if (instanceLoader === "fabric" && instanceMinecraftVersion && fabricManifest.depends) {
        const minecraftRange = normalizeDependency(fabricManifest.depends.minecraft);
        const loaderRange = normalizeDependency(fabricManifest.depends.fabricloader);

        if (!versionLooksCompatible(minecraftRange, instanceMinecraftVersion)) {
          compatibilityWarnings.push(
            `${fabricManifest.name ?? cleanDisplayName(fileName)} may not support Minecraft ${instanceMinecraftVersion}.`
          );
        }

        if (
          instanceLoaderVersion &&
          !versionLooksCompatible(loaderRange, instanceLoaderVersion)
        ) {
          compatibilityWarnings.push(
            `${fabricManifest.name ?? cleanDisplayName(fileName)} may require a different Fabric loader version.`
          );
        }
      }

      return {
        modId: fabricManifest.id,
        displayName: fabricManifest.name,
        version: fabricManifest.version,
        loader: "fabric",
        requiredDependencies: requiredDependencyIds(fabricManifest.depends),
        requiredJavaMajor,
        compatibilityWarnings
      };
    }

    const forgeMetadata = await this.readForgeManifest(filePath);
    if (forgeMetadata) {
      return forgeMetadata;
    }

    return {};
  }

  private async getUniqueModFileName(instanceId: string, requestedFileName: string) {
    const instance = await this.instances.get(instanceId);
    const extension = extname(requestedFileName);
    const baseName = requestedFileName.slice(0, requestedFileName.length - extension.length);
    let candidate = requestedFileName;
    let counter = 1;

    while (true) {
      const destination = join(instance.paths.mods, candidate);
      const exists = await stat(destination)
        .then(() => true)
        .catch(() => false);

      if (!exists) {
        return candidate;
      }

      candidate = `${baseName} (${counter})${extension}`;
      counter += 1;
    }
  }

  private async ensureModsDirectory(instanceId: string) {
    const instance = await this.instances.get(instanceId);
    await this.instances.ensurePaths(instance);
    await mkdir(instance.paths.mods, { recursive: true });
    return instance;
  }

  private async assertDownloadedFileReady(filePath: string, expectedSize?: number) {
    let fileInfo;
    try {
      fileInfo = await stat(filePath);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        throw new Error("Downloaded mod file is missing.");
      }
      throw new Error("Downloaded mod file could not be verified.");
    }

    if (!fileInfo.isFile()) {
      throw new Error("Downloaded mod file is invalid.");
    }

    if (fileInfo.size <= 0) {
      throw new Error("Downloaded mod file is empty.");
    }

    if (expectedSize && expectedSize > 0 && fileInfo.size !== expectedSize) {
      throw new Error("Downloaded mod file size did not match the expected value.");
    }

    return fileInfo;
  }

  private async moveDownloadedFile(tempPath: string, destination: string) {
    if (tempPath === destination) {
      return;
    }

    try {
      await rename(tempPath, destination);
      return;
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "EXDEV") {
        throw error;
      }
    }

    await copyFile(tempPath, destination);
    await unlink(tempPath).catch(() => undefined);
  }

  private toMetadataEntry(
    fileName: string,
    patch: Partial<InstalledMod> & Pick<InstalledMod, "displayName" | "version" | "source" | "enabled">
  ): ModMetadataEntry {
    return {
      id: patch.id ?? crypto.randomUUID(),
      modId: patch.modId,
      fileName,
      displayName: patch.displayName,
      version: patch.version,
      source: patch.source,
      projectId: patch.projectId,
      projectSlug: patch.projectSlug,
      projectUrl: patch.projectUrl,
      versionId: patch.versionId ?? patch.fileId,
      fileId: patch.fileId ?? patch.versionId,
      enabled: patch.enabled,
      requiredDependencies: patch.requiredDependencies,
      loader: patch.loader,
      installedFilePath: patch.installedFilePath,
      sha1: patch.sha1,
      sha512: patch.sha512,
      minecraftVersions: patch.minecraftVersions,
      releaseChannel: patch.releaseChannel,
      installedAt: patch.installedAt,
      updateAvailable: patch.updateAvailable,
      latestVersion: patch.latestVersion,
      latestFileId: patch.latestFileId,
      latestFileName: patch.latestFileName,
      updateCheckedAt: patch.updateCheckedAt,
      updateError: patch.updateError,
      requiredJavaMajor: patch.requiredJavaMajor,
      compatibilityWarnings: patch.compatibilityWarnings
    };
  }

  private async resolveLoaderVersion(loader: LoaderType, minecraftVersion: string, declared?: string) {
    if (loader === "vanilla") {
      return undefined;
    }

    if (declared) {
      return declared;
    }

    const options =
      loader === "fabric"
        ? await this.fabric.listVersions(minecraftVersion)
        : loader === "forge"
          ? await this.forge.listVersions(minecraftVersion)
          : await this.neoforge.listVersions(minecraftVersion);

    const recommended = options.find((option) => option.recommended) ?? options[0];
    if (!recommended) {
      throw new Error(`Nova could not resolve a ${loader} version for this modpack.`);
    }

    return recommended.id;
  }

  private emitMrpackStatus(
    onStatus: MrpackImportHook | undefined,
    stage: ModpackImportStage,
    message: string,
    progress: number,
    details: Omit<ModpackImportStatusEvent, "type" | "stage" | "message" | "progress"> = {}
  ) {
    onStatus?.({
      type: "mrpack-import-status",
      stage,
      message,
      progress,
      ...details
    });
  }

  private parseMrpackManifest(buffer: Buffer): MrpackManifest {
    let manifest: unknown;

    try {
      manifest = JSON.parse(buffer.toString("utf8"));
    } catch {
      throw new Error("The Modrinth modpack manifest is not valid JSON.");
    }

    if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
      throw new Error("The Modrinth modpack manifest must be a JSON object.");
    }

    const typedManifest = manifest as MrpackManifest;
    if (typedManifest.formatVersion !== 1) {
      throw new Error("This Modrinth pack format is not supported yet.");
    }

    if (typedManifest.game !== "minecraft") {
      throw new Error("Only Minecraft Modrinth packs are supported.");
    }

    if (typedManifest.files !== undefined && !Array.isArray(typedManifest.files)) {
      throw new Error("The Modrinth manifest has an invalid files list.");
    }

    if (
      !typedManifest.dependencies ||
      typeof typedManifest.dependencies !== "object" ||
      Array.isArray(typedManifest.dependencies)
    ) {
      throw new Error("The modpack is missing its dependency information.");
    }

    return typedManifest;
  }

  private async parseMrpack(
    packPath: string,
    zip: Awaited<ReturnType<typeof open>>,
    entries: Awaited<ReturnType<typeof readAllEntries>>,
    onStatus?: MrpackImportHook
  ): Promise<ParsedMrpack> {
    this.emitMrpackStatus(onStatus, "reading-modpack", "Reading modpack.", 6);

    const manifestEntry = entries.find(
      (entry) => normalizeArchivePath(entry.fileName) === "modrinth.index.json"
    );
    if (!manifestEntry) {
      throw new Error("This file does not contain a Modrinth modpack manifest.");
    }

    this.emitMrpackStatus(onStatus, "parsing-manifest", "Parsing manifest.", 14);

    const manifest = this.parseMrpackManifest(await readEntry(zip, manifestEntry));
    const minecraftVersion = manifest.dependencies?.minecraft?.trim();
    if (!minecraftVersion) {
      throw new Error("The modpack is missing its Minecraft version.");
    }

    const loaderDependencies = [
      { key: "fabric-loader", loader: "fabric" as const },
      { key: "forge", loader: "forge" as const },
      { key: "neoforge", loader: "neoforge" as const },
      { key: "quilt-loader", loader: "quilt" as const }
    ].filter((entry) => manifest.dependencies?.[entry.key]?.trim());

    if (loaderDependencies.length > 1) {
      throw new Error("The modpack declares multiple loaders. Nova can only import one loader per instance.");
    }

    const declaredLoader = loaderDependencies[0];
    if (declaredLoader?.loader === "quilt") {
      throw new Error("This modpack requires Quilt. Nova does not support Quilt instances yet.");
    }

    const loader: LoaderType = declaredLoader?.loader ?? "vanilla";
    const loaderVersion = await this.resolveLoaderVersion(
      loader,
      minecraftVersion,
      declaredLoader ? manifest.dependencies?.[declaredLoader.key] : undefined
    );

    const packName =
      manifest.name?.trim() ||
      cleanDisplayName(basename(packPath).replace(/\.mrpack$/i, "").replace(/\.zip$/i, ""));
    const versionId = manifest.versionId?.trim() || undefined;

    return {
      manifest,
      name: packName,
      instanceName: buildMrpackInstanceName(packName, versionId),
      versionId,
      minecraftVersion,
      loader,
      loaderVersion
    };
  }

  async list(instanceId: string): Promise<InstalledMod[]> {
    const instance = await this.instances.get(instanceId);
    const metadata = await this.loadMetadata(instanceId);
    const files = await readdir(instance.paths.mods).catch(() => []);

    const mods = await Promise.all(
      files
        .filter((fileName) => fileName.endsWith(".jar") || fileName.endsWith(".jar.disabled"))
        .map(async (fileName) => {
          const filePath = join(instance.paths.mods, fileName);
          const fileInfo = await stat(filePath);
          const meta = metadata.find((entry) => entry.fileName === fileName);
          const parsed = await this.inspectJarMetadata(
            filePath,
            fileName,
            instance.minecraftVersion,
            instance.loader,
            instance.loaderVersion
          );

          return {
            id: meta?.id ?? fileName,
            modId: meta?.modId ?? parsed.modId,
            fileName,
            displayName: meta?.displayName ?? parsed.displayName ?? cleanDisplayName(fileName),
            version: meta?.version ?? parsed.version ?? "Unknown",
            source: normalizeStoredSource(meta?.source),
            projectId: meta?.projectId,
            projectSlug: meta?.projectSlug,
            projectUrl: meta?.projectUrl,
            versionId: meta?.versionId ?? meta?.fileId,
            fileId: meta?.fileId ?? meta?.versionId,
            enabled: meta?.enabled ?? !fileName.endsWith(".disabled"),
            requiredDependencies: meta?.requiredDependencies ?? parsed.requiredDependencies,
            loader: meta?.loader ?? parsed.loader,
            fileSizeBytes: fileInfo.size,
            installedFilePath: meta?.installedFilePath ?? filePath,
            sha1: meta?.sha1,
            sha512: meta?.sha512,
            minecraftVersions:
              meta?.minecraftVersions ??
              (normalizeStoredSource(meta?.source) === "modrinth" ? [instance.minecraftVersion] : undefined),
            releaseChannel: meta?.releaseChannel,
            installedAt: meta?.installedAt,
            updateAvailable: meta?.updateAvailable ?? false,
            latestVersion: meta?.latestVersion,
            latestFileId: meta?.latestFileId,
            latestFileName: meta?.latestFileName,
            updateCheckedAt: meta?.updateCheckedAt,
            updateError: meta?.updateError,
            requiredJavaMajor: meta?.requiredJavaMajor ?? parsed.requiredJavaMajor,
            compatibilityWarnings: [
              ...(meta?.compatibilityWarnings ?? []),
              ...(parsed.compatibilityWarnings ?? [])
            ]
          } satisfies InstalledMod;
        })
    );

    const installedIds = new Set(mods.map((mod) => mod.modId).filter(Boolean));
    const finalMods = mods.map((mod) => {
      if (
        instance.loader !== "fabric" ||
        !mod.enabled ||
        !mod.modId ||
        !mod.requiredDependencies?.includes("fabric-api")
      ) {
        return mod;
      }

      return installedIds.has("fabric-api")
        ? mod
        : {
            ...mod,
            compatibilityWarnings: [
              ...(mod.compatibilityWarnings ?? []),
              "Requires Fabric API, but it is not installed in this instance."
            ]
          };
    });

    return finalMods.sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  async importLocalMods(instanceId: string, sourcePaths: string[]): Promise<InstalledMod[]> {
    if (sourcePaths.length === 0) {
      throw new Error("No mod file was selected.");
    }

    const instance = await this.instances.get(instanceId);
    const metadata = await this.loadMetadata(instanceId);
    const imported: InstalledMod[] = [];
    const updates: ModMetadataEntry[] = [];

    for (const sourcePath of sourcePaths) {
      if (!sourcePath.toLowerCase().endsWith(".jar")) {
        throw new Error("That file is not a .jar mod.");
      }

      const targetFileName = await this.getUniqueModFileName(instanceId, basename(sourcePath));
      const destination = join(instance.paths.mods, targetFileName);
      await copyFile(sourcePath, destination);

      const parsed = await this.inspectJarMetadata(
        destination,
        targetFileName,
        instance.minecraftVersion,
        instance.loader,
        instance.loaderVersion
      );

      const mod: InstalledMod = {
        id: crypto.randomUUID(),
        modId: parsed.modId,
        fileName: targetFileName,
        displayName: parsed.displayName ?? cleanDisplayName(targetFileName),
        version: parsed.version ?? "Local mod",
        source: "local",
        enabled: true,
        requiredDependencies: parsed.requiredDependencies,
        loader: parsed.loader,
        updateAvailable: false,
        requiredJavaMajor: parsed.requiredJavaMajor,
        compatibilityWarnings: parsed.compatibilityWarnings
      };

      imported.push(mod);
      updates.push(this.toMetadataEntry(targetFileName, mod));
    }

    await this.saveMetadata(instanceId, this.mergeMetadata(metadata, updates));
    return imported.sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  async copyLocalMod(instanceId: string, sourcePath: string): Promise<InstalledMod> {
    const [mod] = await this.importLocalMods(instanceId, [sourcePath]);
    if (!mod) {
      throw new Error("Unable to import the local mod.");
    }
    return mod;
  }

  async addDownloadedMod(
    instanceId: string,
    filePath: string,
    metadataPatch: {
      fileName?: string;
      displayName: string;
      version: string;
      source: ModSource;
      projectId?: string;
      projectSlug?: string;
      projectUrl?: string;
      versionId?: string;
      fileId?: string;
      loader?: LoaderType;
      requiredDependencies?: string[];
      sha1?: string;
      sha512?: string;
      expectedFileSize?: number;
      minecraftVersions?: string[];
      releaseChannel?: InstalledMod["releaseChannel"];
      installedAt?: string;
    }
  ): Promise<InstalledMod> {
    const instance = await this.ensureModsDirectory(instanceId);
    if (metadataPatch.source === "modrinth" && metadataPatch.projectId) {
      const existingMods = await this.list(instanceId);
      if (existingMods.some((mod) => mod.source === "modrinth" && mod.projectId === metadataPatch.projectId)) {
        throw new Error("This mod is already installed. Change its version from the instance mods list.");
      }
    }

    const requestedFileName = metadataPatch.fileName ?? basename(filePath);
    const fileName = await this.getUniqueModFileName(instanceId, requestedFileName);
    const destination = join(instance.paths.mods, fileName);
    await this.assertDownloadedFileReady(filePath, metadataPatch.expectedFileSize);
    if (filePath !== destination) {
      await this.moveDownloadedFile(filePath, destination);
    }
    await this.assertDownloadedFileReady(destination, metadataPatch.expectedFileSize);

    const mod: InstalledMod = {
      id: crypto.randomUUID(),
      fileName,
      displayName: metadataPatch.displayName,
      version: metadataPatch.version,
      source: metadataPatch.source,
      projectId: metadataPatch.projectId,
      projectSlug: metadataPatch.projectSlug,
      projectUrl:
        metadataPatch.projectUrl ??
        (metadataPatch.projectSlug ? `https://modrinth.com/mod/${metadataPatch.projectSlug}` : undefined),
      versionId: metadataPatch.versionId ?? metadataPatch.fileId,
      fileId: metadataPatch.fileId ?? metadataPatch.versionId,
      enabled: true,
      loader: metadataPatch.loader,
      requiredDependencies: metadataPatch.requiredDependencies,
      installedFilePath: destination,
      sha1: metadataPatch.sha1,
      sha512: metadataPatch.sha512,
      minecraftVersions: metadataPatch.minecraftVersions,
      releaseChannel: metadataPatch.releaseChannel,
      installedAt: metadataPatch.installedAt ?? new Date().toISOString(),
      updateAvailable: false
    };

    const metadata = await this.loadMetadata(instanceId);
    await this.saveMetadata(instanceId, this.mergeMetadata(metadata, [this.toMetadataEntry(fileName, mod)]));
    return mod;
  }

  async checkModUpdates(instanceId: string): Promise<InstalledMod[]> {
    const instance = await this.instances.get(instanceId);
    const mods = await this.list(instanceId);
    const metadata = await this.loadMetadata(instanceId);
    const checkedAt = new Date().toISOString();
    const nextEntries: ModMetadataEntry[] = [];

    for (const mod of mods) {
      const currentEntry = metadata.find((entry) => entry.fileName === mod.fileName);
      if (mod.source !== "modrinth" || !mod.projectId) {
        nextEntries.push(
          this.toMetadataEntry(mod.fileName, {
            ...mod,
            id: currentEntry?.id ?? mod.id,
            updateAvailable: false,
            latestVersion: undefined,
            latestFileId: undefined,
            latestFileName: undefined,
            updateCheckedAt: checkedAt,
            updateError: undefined
          })
        );
        continue;
      }

      try {
        const latest = await this.modrinth.getLatestCompatibleVersion(mod.projectId, {
          minecraftVersion: instance.minecraftVersion,
          loader: instance.loader
        });

        const updateAvailable =
          (mod.versionId ?? mod.fileId) !== latest.versionId ||
          mod.version !== latest.versionNumber ||
          mod.fileName.replace(/\.disabled$/i, "") !== latest.fileName;

        nextEntries.push(
          this.toMetadataEntry(mod.fileName, {
            ...mod,
            id: currentEntry?.id ?? mod.id,
            updateAvailable,
            latestVersion: latest.versionNumber,
            latestFileId: latest.versionId,
            latestFileName: latest.fileName,
            updateCheckedAt: checkedAt,
            updateError: undefined
          })
        );
      } catch (error) {
        nextEntries.push(
          this.toMetadataEntry(mod.fileName, {
            ...mod,
            id: currentEntry?.id ?? mod.id,
            updateAvailable: false,
            latestVersion: undefined,
            latestFileId: undefined,
            latestFileName: undefined,
            updateCheckedAt: checkedAt,
            updateError:
              error instanceof Error ? error.message : "Unable to check for updates right now."
          })
        );
      }
    }

    await this.saveMetadata(
      instanceId,
      this.mergeMetadata(metadata, nextEntries)
    );
    return this.list(instanceId);
  }

  private async resolveCompatibleVersionForMod(
    instanceId: string,
    mod: InstalledMod,
    versionId?: string
  ) {
    const instance = await this.instances.get(instanceId);
    if (mod.source !== "modrinth" || !mod.projectId) {
      throw new Error("Local mods cannot be updated from Modrinth.");
    }

    return this.modrinth.getCompatibleVersion(
      mod.projectId,
      {
        minecraftVersion: instance.minecraftVersion,
        loader: instance.loader
      },
      versionId
    );
  }

  private requiredDependencyProjectIds(version: ResolvedModrinthVersion) {
    return version.dependencies
      .filter((dependency) => dependency.dependency_type === "required")
      .map((dependency) => dependency.project_id ?? dependency.version_id ?? "")
      .filter(Boolean);
  }

  private async downloadMrpackFile(
    file: MrpackManifestFile,
    relativePath: string,
    destination: string
  ): Promise<MrpackResolvedFile> {
    const candidates = (file.downloads ?? [])
      .filter((value): value is string => typeof value === "string")
      .map((value) => {
        try {
          const parsedUrl = new URL(value);
          return parsedUrl.protocol === "https:" ? parsedUrl.toString() : undefined;
        } catch {
          return undefined;
        }
      })
      .filter((value): value is string => Boolean(value));

    if (candidates.length === 0) {
      if ((file.downloads ?? []).length === 0) {
        throw new Error(`The modpack manifest does not list a download URL for ${relativePath}.`);
      }

      throw new Error(`The modpack manifest only lists invalid download URLs for ${relativePath}.`);
    }

    let lastError: unknown;
    for (const downloadUrl of candidates) {
      try {
        await this.downloads.enqueue({
          label: `Importing ${basename(relativePath)}`,
          source: downloadUrl,
          destination,
          sha512: file.hashes?.sha512,
          sha1: file.hashes?.sha1
        });

        await this.assertDownloadedFileReady(destination, file.fileSize);
        return {
          relativePath,
          destination,
          tempPath: destination,
          downloadUrl
        };
      } catch (error) {
        lastError = error;
        await unlink(destination).catch(() => undefined);
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error(`Nova could not download ${relativePath} from any manifest URL.`);
  }

  private async buildMrpackModMetadataEntry(
    instance: Instance,
    filePath: string,
    relativePath: string,
    expectedLoader: LoaderType,
    hashes?: Record<string, string>
  ) {
    const resolved =
      (hashes?.sha512 &&
        (await this.modrinth.getVersionByHash(hashes.sha512, "sha512").catch(() => undefined))) ||
      (hashes?.sha1 &&
        (await this.modrinth.getVersionByHash(hashes.sha1, "sha1").catch(() => undefined)));

    if (resolved) {
      return this.toMetadataEntry(basename(relativePath), {
        id: crypto.randomUUID(),
        displayName: resolved.name,
        version: resolved.versionNumber,
        source: "modrinth",
        enabled: true,
        projectId: resolved.projectId,
        projectSlug: resolved.projectSlug,
        projectUrl: resolved.projectSlug ? `https://modrinth.com/mod/${resolved.projectSlug}` : undefined,
        versionId: resolved.versionId,
        fileId: resolved.versionId,
        installedFilePath: filePath,
        sha1: resolved.sha1,
        sha512: resolved.sha512,
        minecraftVersions: resolved.gameVersions,
        releaseChannel: resolved.versionType,
        installedAt: new Date().toISOString(),
        requiredDependencies: this.requiredDependencyProjectIds(resolved),
        loader: expectedLoader,
        updateAvailable: false
      });
    }

    const parsedMetadata = await this.inspectJarMetadata(
      filePath,
      basename(relativePath),
      instance.minecraftVersion,
      instance.loader,
      instance.loaderVersion
    );

    return this.toMetadataEntry(basename(relativePath), {
      id: crypto.randomUUID(),
      modId: parsedMetadata.modId,
      displayName: parsedMetadata.displayName ?? cleanDisplayName(basename(relativePath)),
      version: parsedMetadata.version ?? "Local mod",
      source: "local",
      enabled: true,
      requiredDependencies: parsedMetadata.requiredDependencies,
      loader: parsedMetadata.loader,
      installedFilePath: filePath,
      sha1: hashes?.sha1,
      sha512: hashes?.sha512,
      updateAvailable: false,
      requiredJavaMajor: parsedMetadata.requiredJavaMajor,
      compatibilityWarnings: parsedMetadata.compatibilityWarnings
    });
  }

  private async replaceManagedModVersion(
    instanceId: string,
    modId: string,
    requestedVersionId?: string
  ): Promise<InstalledMod> {
    const instance = await this.instances.get(instanceId);
    const mods = await this.list(instanceId);
    const target = mods.find((mod) => mod.id === modId);

    if (!target) {
      throw new Error("Mod not found.");
    }

    if (target.source !== "modrinth" || !target.projectId) {
      throw new Error("Local mods can only be updated manually.");
    }

    const latest = await this.resolveCompatibleVersionForMod(instanceId, target, requestedVersionId);
    const currentBaseFileName = target.fileName.replace(/\.disabled$/i, "");
    const nextBaseFileName = sanitizeModFileName(latest.fileName).replace(/\.disabled$/i, "");
    const nextFileName = target.enabled ? nextBaseFileName : `${nextBaseFileName}.disabled`;
    const currentPath = join(instance.paths.mods, target.fileName);
    const finalPath = join(instance.paths.mods, nextFileName);
    const tempPath = join(instance.paths.mods, `.nova-update-${crypto.randomUUID()}.tmp`);
    const backupPath = join(instance.paths.mods, `.nova-backup-${crypto.randomUUID()}.jar`);

    if (
      currentBaseFileName === nextBaseFileName &&
      (target.versionId ?? target.fileId) === latest.versionId &&
      target.version === latest.versionNumber
    ) {
      const metadata = await this.loadMetadata(instanceId);
      const refreshed: InstalledMod = {
        ...target,
        projectSlug: latest.projectSlug ?? target.projectSlug,
        projectUrl:
          latest.projectSlug ? `https://modrinth.com/mod/${latest.projectSlug}` : target.projectUrl,
        versionId: latest.versionId,
        fileId: latest.versionId,
        installedFilePath: currentPath,
        sha1: latest.sha1,
        sha512: latest.sha512,
        minecraftVersions: latest.gameVersions,
        releaseChannel: latest.versionType,
        requiredDependencies: this.requiredDependencyProjectIds(latest),
        updateAvailable: false,
        latestVersion: undefined,
        latestFileId: undefined,
        latestFileName: undefined,
        updateCheckedAt: new Date().toISOString(),
        updateError: undefined
      };
      await this.saveMetadata(
        instanceId,
        this.mergeMetadata(metadata, [
          this.toMetadataEntry(target.fileName, refreshed)
        ])
      );
      return (await this.list(instanceId)).find((mod) => mod.id === modId) ?? refreshed;
    }

    const conflictingTarget =
      finalPath !== currentPath &&
      (await stat(finalPath).then(() => true).catch(() => false));
    if (conflictingTarget) {
      throw new Error("Nova found another mod file with the updated name. Remove it and try again.");
    }

    try {
      await this.downloads.enqueue({
        label: `Updating ${target.displayName}`,
        source: latest.fileUrl,
        destination: tempPath,
        sha512: latest.sha512,
        sha1: latest.sha1
      });
      await this.assertDownloadedFileReady(tempPath, latest.fileSize);
    } catch (error) {
      await unlink(tempPath).catch(() => undefined);
      throw error;
    }

    await rename(currentPath, backupPath);

    try {
      await rename(tempPath, finalPath);
      await unlink(backupPath).catch(() => undefined);
    } catch (error) {
      await unlink(tempPath).catch(() => undefined);
      await rename(backupPath, currentPath).catch(() => undefined);
      throw error instanceof Error ? error : new Error("Unable to replace the old mod file.");
    }

    const metadata = await this.loadMetadata(instanceId);
    const updated: InstalledMod = {
      ...target,
      fileName: nextFileName,
      version: latest.versionNumber,
      projectSlug: latest.projectSlug ?? target.projectSlug,
      projectUrl:
        latest.projectSlug ? `https://modrinth.com/mod/${latest.projectSlug}` : target.projectUrl,
      versionId: latest.versionId,
      fileId: latest.versionId,
      enabled: target.enabled,
      installedFilePath: finalPath,
      sha1: latest.sha1,
      sha512: latest.sha512,
      minecraftVersions: latest.gameVersions,
      releaseChannel: latest.versionType,
      installedAt: target.installedAt ?? new Date().toISOString(),
      requiredDependencies: this.requiredDependencyProjectIds(latest),
      updateAvailable: false,
      latestVersion: undefined,
      latestFileId: undefined,
      latestFileName: undefined,
      updateCheckedAt: new Date().toISOString(),
      updateError: undefined
    };

    await this.saveMetadata(
      instanceId,
      this.mergeMetadata(
        metadata,
        [this.toMetadataEntry(nextFileName, updated)],
        [target.fileName]
      )
    );

    return (await this.list(instanceId)).find((mod) => mod.fileName === nextFileName) ?? updated;
  }

  async updateMod(instanceId: string, modId: string): Promise<InstalledMod> {
    return this.replaceManagedModVersion(instanceId, modId);
  }

  async changeModVersion(instanceId: string, modId: string, versionId: string): Promise<InstalledMod> {
    return this.replaceManagedModVersion(instanceId, modId, versionId);
  }

  async updateAllMods(instanceId: string): Promise<InstalledMod[]> {
    const mods = await this.list(instanceId);
    const updatable = mods.filter(
      (mod) => mod.source === "modrinth" && mod.projectId && mod.updateAvailable
    );

    if (updatable.length === 0) {
      return mods;
    }

    const failures = new Map<string, string>();
    for (const mod of updatable) {
      try {
        await this.updateMod(instanceId, mod.id);
      } catch (error) {
        failures.set(
          mod.fileName,
          error instanceof Error ? error.message : "Unable to update this mod."
        );
      }
    }

    if (failures.size > 0) {
      const metadata = await this.loadMetadata(instanceId);
      await this.saveMetadata(
        instanceId,
        metadata.map((entry) =>
          failures.has(entry.fileName)
            ? {
                ...entry,
                updateError: failures.get(entry.fileName),
                updateCheckedAt: new Date().toISOString()
              }
            : entry
        )
      );
    }

    return this.list(instanceId);
  }

  async importMrpack(packPath: string, onStatus?: MrpackImportHook): Promise<ModpackImportResult> {
    const tempRoot = await mkdtemp(join(tmpdir(), "nova-mrpack-"));
    let createdInstance: Instance | undefined;
    let parsed: ParsedMrpack | undefined;

    const emit = (
      stage: ModpackImportStage,
      message: string,
      progress: number,
      details: Omit<ModpackImportStatusEvent, "type" | "stage" | "message" | "progress"> = {}
    ) =>
      this.emitMrpackStatus(onStatus, stage, message, progress, {
        packName: parsed?.name,
        packVersion: parsed?.versionId,
        instanceId: createdInstance?.id,
        ...details
      });

    const zip = await open(packPath, { lazyEntries: true, autoClose: true });
    try {
      const archiveEntries = await readAllEntries(zip);
      parsed = await this.parseMrpack(packPath, zip, archiveEntries, onStatus);

      emit("creating-instance", `Creating ${parsed.instanceName}.`, 24);
      const data = await this.repository.getData();
      createdInstance = await this.instances.create({
        name: parsed.instanceName,
        minecraftVersion: parsed.minecraftVersion,
        loader: parsed.loader,
        loaderVersion: parsed.loaderVersion,
        memoryMinMb: data.settings.defaultMinMemoryMb,
        memoryMaxMb: data.settings.defaultMaxMemoryMb,
        javaPath: data.settings.defaultJavaPath || undefined,
        notes: parsed.manifest.summary
      });

      createdInstance = await this.instances.update(createdInstance.id, { installStatus: "installing" });

      emit(
        "installing-loader",
        parsed.loader === "vanilla"
          ? "Using vanilla Minecraft."
          : `Configuring ${parsed.loader} ${parsed.loaderVersion ?? ""}.`.trim(),
        34
      );

      const metadataEntries: ModMetadataEntry[] = [];
      const failedFiles: ModpackImportFailure[] = [];
      const fileEntries = parsed.manifest.files ?? [];
      const clientFiles = fileEntries.filter(shouldDownloadClientFile);
      const skippedOptionalFiles = fileEntries.length - clientFiles.length;
      let downloadedFiles = 0;

      if (clientFiles.length === 0) {
        emit("downloading-files", "No manifest downloads were listed.", 78, { current: 0, total: 0 });
      }

      for (let index = 0; index < clientFiles.length; index += 1) {
        const file = clientFiles[index];
        const relativePath = file.path ? toSafeRelativePath(file.path) : undefined;
        const displayPath = relativePath ?? file.path ?? `file-${index + 1}`;

        if (!relativePath) {
          const failure = buildMrpackFailure(displayPath, "The modpack manifest contains an unsafe file path.");
          failedFiles.push(failure);
          console.warn("[nova][mrpack] skipped unsafe manifest path", failure);
          continue;
        }

        const progress = 36 + Math.round(((index + 1) / Math.max(clientFiles.length, 1)) * 44);
        emit("downloading-files", `Downloading ${basename(relativePath)}.`, progress, {
          current: index + 1,
          total: clientFiles.length
        });

        const tempFilePath = join(
          tempRoot,
          `${String(index + 1).padStart(4, "0")}-${crypto.randomUUID()}${extname(relativePath) || ".bin"}`
        );

        try {
          const resolvedDownload = await this.downloadMrpackFile(file, relativePath, tempFilePath);
          const destination = join(createdInstance.paths.root, ...relativePath.split("/"));

          await mkdir(dirname(destination), { recursive: true });
          await this.moveDownloadedFile(resolvedDownload.tempPath, destination);
          await this.assertDownloadedFileReady(destination, file.fileSize);
          downloadedFiles += 1;

          if (isMrpackModPath(relativePath)) {
            metadataEntries.push(
              await this.buildMrpackModMetadataEntry(
                createdInstance,
                destination,
                relativePath,
                parsed.loader,
                file.hashes
              )
            );
          }
        } catch (error) {
          await unlink(tempFilePath).catch(() => undefined);
          const reason = error instanceof Error ? error.message : "Download failed.";
          const failure = buildMrpackFailure(
            relativePath,
            reason,
            (file.downloads ?? []).find((value) => typeof value === "string")
          );
          failedFiles.push(failure);
          console.error("[nova][mrpack] download failed", failure);
        }
      }

      const overrideEntries = archiveEntries
        .map((entry) => ({
          entry,
          normalized: normalizeArchivePath(entry.fileName)
        }))
        .filter(({ normalized }) => normalized.startsWith("overrides/") || normalized.startsWith("client-overrides/"))
        .sort((left, right) => {
          const leftRank = left.normalized.startsWith("client-overrides/") ? 1 : 0;
          const rightRank = right.normalized.startsWith("client-overrides/") ? 1 : 0;
          return leftRank - rightRank;
        });

      if (overrideEntries.length === 0) {
        emit("copying-overrides", "No overrides were included in this pack.", 94, { current: 0, total: 0 });
      }

      let copiedOverrideFiles = 0;
      for (let index = 0; index < overrideEntries.length; index += 1) {
        const { entry, normalized } = overrideEntries[index];
        if (normalized.endsWith("/")) {
          continue;
        }

        const basePrefix = normalized.startsWith("client-overrides/") ? "client-overrides/" : "overrides/";
        const relativePath = toSafeRelativePath(normalized.slice(basePrefix.length));
        const displayPath = relativePath ?? normalized;

        if (!relativePath || !isAllowedOverridePath(relativePath)) {
          const failure = buildMrpackFailure(displayPath, "The override file path is not allowed.");
          failedFiles.push(failure);
          console.warn("[nova][mrpack] skipped override path", failure);
          continue;
        }

        const progress = 82 + Math.round(((index + 1) / Math.max(overrideEntries.length, 1)) * 12);
        emit("copying-overrides", `Copying ${basename(relativePath)}.`, progress, {
          current: index + 1,
          total: overrideEntries.length
        });

        try {
          const destination = join(createdInstance.paths.root, ...relativePath.split("/"));
          await mkdir(dirname(destination), { recursive: true });
          const buffer = await readEntry(zip, entry);
          await writeFile(destination, buffer);
          copiedOverrideFiles += 1;

          if (isMrpackModPath(relativePath)) {
            metadataEntries.push(
              await this.buildMrpackModMetadataEntry(
                createdInstance,
                destination,
                relativePath,
                parsed.loader
              )
            );
          }
        } catch (error) {
          const failure = buildMrpackFailure(
            relativePath,
            error instanceof Error ? error.message : "Could not copy this override file."
          );
          failedFiles.push(failure);
          console.error("[nova][mrpack] override copy failed", failure);
        }
      }

      emit("finalizing", "Finalizing imported instance.", 96);
      await this.saveMetadata(createdInstance.id, this.mergeMetadata([], metadataEntries));

      const installStatus = failedFiles.length > 0 ? "needs-repair" : "ready";
      const instance = await this.instances.update(createdInstance.id, { installStatus });

      emit(
        failedFiles.length > 0 ? "completed-with-errors" : "completed",
        failedFiles.length > 0
          ? `Imported ${parsed.name}, but ${failedFiles.length} file${failedFiles.length === 1 ? "" : "s"} failed.`
          : `${parsed.name} is ready in Nova.`,
        100,
        { failedFiles }
      );

      return {
        instance,
        packName: parsed.name,
        packVersion: parsed.versionId,
        minecraftVersion: parsed.minecraftVersion,
        loader: parsed.loader,
        loaderVersion: parsed.loaderVersion,
        downloadedFiles,
        copiedOverrideFiles,
        skippedOptionalFiles,
        failedFiles
      };
    } catch (error) {
      if (createdInstance) {
        await this.instances.update(createdInstance.id, { installStatus: "failed" }).catch(() => undefined);
      }

      emit(
        "failed",
        error instanceof Error ? error.message : "Unable to import that modpack.",
        100
      );
      throw error;
    } finally {
      zip.close();
      await rm(tempRoot, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  async toggle(instanceId: string, modId: string, enabled: boolean): Promise<InstalledMod> {
    const instance = await this.instances.get(instanceId);
    const mods = await this.list(instanceId);
    const target = mods.find((mod) => mod.id === modId);

    if (!target) {
      throw new Error("Mod not found.");
    }

    const from = join(instance.paths.mods, target.fileName);
    const normalizedFileName = target.fileName.replace(/\.disabled$/i, "");
    const nextFileName = enabled ? normalizedFileName : `${normalizedFileName}.disabled`;
    const to = join(instance.paths.mods, nextFileName);

    if (from !== to) {
      await rename(from, to);
    }

    const updated: InstalledMod = {
      ...target,
      fileName: nextFileName,
      enabled,
      installedFilePath: to
    };

    const metadata = await this.loadMetadata(instanceId);
    await this.saveMetadata(
      instanceId,
      this.mergeMetadata(
        metadata,
        [this.toMetadataEntry(nextFileName, updated)],
        [target.fileName]
      )
    );

    return updated;
  }

  async delete(instanceId: string, modId: string): Promise<boolean> {
    const instance = await this.instances.get(instanceId);
    const mods = await this.list(instanceId);
    const target = mods.find((mod) => mod.id === modId);

    if (!target) {
      throw new Error("Mod not found.");
    }

    await rm(join(instance.paths.mods, target.fileName), { force: true });
    const metadata = await this.loadMetadata(instanceId);
    await this.saveMetadata(
      instanceId,
      metadata.filter((entry) => entry.id !== modId && entry.fileName !== target.fileName)
    );
    return true;
  }
}
