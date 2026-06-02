export type LoaderType = "vanilla" | "fabric" | "forge" | "neoforge";
export type ModSource = "modrinth" | "local";
export type ModCompatibilityLoader = LoaderType | "quilt";
export type ModReleaseChannel = "release" | "beta" | "alpha";
export type BuiltInThemeId =
  | "nova-dark"
  | "midnight-blue"
  | "obsidian"
  | "carbon"
  | "arctic"
  | "emerald"
  | "amethyst"
  | "crimson"
  | "solar"
  | "void"
  | "monochrome"
  | "matrix"
  | "high-contrast";
export type ImportedThemeId = `imported:${string}`;
export type SettingsTheme = BuiltInThemeId | ImportedThemeId;
export type ThemeCategory = "Dark" | "Color" | "Contrast" | "Minimal" | "Imported";
export type ThemeTokens = {
  shellBg: string;
  surface1: string;
  surface2: string;
  surface3: string;
  panelBg: string;
  panelBorderBase: string;
  panelBorderStrongBase: string;
  dividerBase: string;
  shellGlow: string;
  accentBase: string;
  accentSolid: string;
  accentSolidHover: string;
  accentSoft: string;
  accentBorder: string;
  accentGlow: string;
  accentText: string;
  accentRing: string;
  accentContrast: string;
  mutedText: string;
  softText: string;
  chromeBg: string;
  chromePanel: string;
  buttonShadowSubtle: string;
  buttonShadowStrong: string;
};
export type NovaThemeFile = {
  formatVersion: 1;
  type: "nova-theme";
  name: string;
  description?: string;
  author?: string;
  baseTheme?: BuiltInThemeId;
  tokens: Partial<ThemeTokens>;
};
export type ImportedTheme = NovaThemeFile & {
  id: ImportedThemeId;
  importedAt: string;
};
export type BackgroundPattern = "aurora" | "grid" | "plain";
export type PerformanceMode = "off" | "auto" | "on";
export type UiDensity = "compact" | "normal" | "spacious";
export type LauncherAccountType = "microsoft" | "offline-dev";
export type InstanceTab =
  | "overview"
  | "mods"
  | "resourcepacks"
  | "shaderpacks"
  | "versions"
  | "logs"
  | "settings";

export type LauncherAccount = {
  id: string;
  type: LauncherAccountType;
  username: string;
  displayName?: string;
  uuid: string;
  avatarUrl?: string;
  active: boolean;
  xuid?: string;
  status?: "ready" | "expired" | "error";
  isOffline?: boolean;
  devOnly?: boolean;
};

export type AccountSecurePayload = {
  accountId: string;
  accessToken: string;
  refreshToken: string;
  minecraftToken: string;
  expiresAt: string;
};

export type InstancePaths = {
  root: string;
  mods: string;
  resourcepacks: string;
  shaderpacks: string;
  screenshots: string;
  saves: string;
  logs: string;
};

export type Instance = {
  id: string;
  name: string;
  icon?: string;
  minecraftVersion: string;
  loader: LoaderType;
  loaderVersion?: string;
  gameDir: string;
  javaPath?: string;
  memoryMinMb: number;
  memoryMaxMb: number;
  createdAt: string;
  lastPlayedAt?: string;
  notes?: string;
  description?: string;
  pinned?: boolean;
  favorite?: boolean;
  lastLaunchStatus?: "idle" | "success" | "error";
  installStatus?: "not-installed" | "installing" | "ready" | "needs-repair" | "failed";
  paths: InstancePaths;
};

export type InstalledMod = {
  id: string;
  modId?: string;
  fileName: string;
  displayName: string;
  version: string;
  source: ModSource;
  projectId?: string;
  projectSlug?: string;
  projectUrl?: string;
  versionId?: string;
  fileId?: string;
  enabled: boolean;
  requiredDependencies?: string[];
  loader?: LoaderType;
  fileSizeBytes?: number;
  installedFilePath?: string;
  sha1?: string;
  sha512?: string;
  minecraftVersions?: string[];
  releaseChannel?: ModReleaseChannel;
  installedAt?: string;
  updateAvailable?: boolean;
  latestVersion?: string;
  latestFileId?: string;
  latestFileName?: string;
  updateCheckedAt?: string;
  updateError?: string;
  requiredJavaMajor?: number;
  compatibilityWarnings?: string[];
};

export type ModSearchFilters = {
  minecraftVersion?: string;
  loader?: LoaderType;
  category?: string;
  side?: "client" | "server" | "both";
  sortBy?: "relevance" | "downloads" | "updated";
};

export type ModSearchResult = {
  id: string;
  slug?: string;
  source: Exclude<ModSource, "local">;
  title: string;
  author?: string;
  summary: string;
  iconUrl?: string;
  downloads: number;
  follows?: number;
  categories: string[];
  supportedLoaders: ModCompatibilityLoader[];
  supportedVersions: string[];
  projectUrl?: string;
};

export type PaginatedModSearchResult = {
  query: string;
  page: number;
  pageSize: number;
  totalHits: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  results: ModSearchResult[];
};

export type ModrinthVersionOption = {
  id: string;
  projectId?: string;
  projectSlug?: string;
  name: string;
  versionNumber: string;
  versionType: ModReleaseChannel;
  loaders: ModCompatibilityLoader[];
  gameVersions: string[];
  fileName: string;
  featured: boolean;
  publishedAt?: string;
  sha1?: string;
  sha512?: string;
  fileSize?: number;
};

export type LoaderVersionOption = {
  id: string;
  minecraftVersion: string;
  stable: boolean;
  recommended?: boolean;
  releaseTime?: string;
};

export type MinecraftVersionOption = {
  id: string;
  type: "release" | "snapshot" | "old_beta" | "old_alpha";
  releaseTime: string;
};

export type JavaInstallation = {
  path: string;
  version: string;
  majorVersion: number;
  architecture?: string;
  source: "path" | "registry" | "manual" | "bundled";
  recommendedFor?: string[];
};

export type JavaRuntimeVendor = "adoptium" | "microsoft";
export type JavaRuntimePackageType = "zip" | "msi" | "exe";

export type JavaRuntimeDownloadOption = {
  id: string;
  vendor: JavaRuntimeVendor;
  majorVersion: number;
  versionLabel: string;
  packageType: JavaRuntimePackageType;
  fileName: string;
  url: string;
  checksumSha256?: string;
  sizeBytes?: number;
  recommended?: boolean;
};

export type JavaRuntimeInstallResult = {
  installation: JavaInstallation;
  javaInstallations: JavaInstallation[];
};

export type DownloadTask = {
  id: string;
  label: string;
  source: string;
  destination: string;
  bytesTotal?: number;
  bytesTransferred: number;
  status: "queued" | "running" | "completed" | "failed" | "canceled";
  error?: string;
  startedAt: string;
  finishedAt?: string;
};

export type ModpackImportStage =
  | "reading-modpack"
  | "parsing-manifest"
  | "creating-instance"
  | "installing-loader"
  | "downloading-files"
  | "copying-overrides"
  | "finalizing"
  | "completed"
  | "completed-with-errors"
  | "failed";

export type ModpackImportFailure = {
  path: string;
  reason: string;
  url?: string;
};

export type ModpackImportStatusEvent = {
  type: "mrpack-import-status";
  stage: ModpackImportStage;
  message: string;
  progress: number;
  current?: number;
  total?: number;
  packName?: string;
  packVersion?: string;
  instanceId?: string;
  failedFiles?: ModpackImportFailure[];
};

export type LaunchLogEntry = {
  id: string;
  instanceId?: string;
  sessionId?: string;
  source: "launcher" | "minecraft" | "fabric" | "java";
  level: "info" | "warn" | "error" | "debug";
  message: string;
  timestamp: string;
  details?: Record<string, string | number | boolean | undefined>;
};

export type LaunchState =
  | "idle"
  | "preparing-instance"
  | "validating-instance"
  | "checking-java"
  | "resolving-version"
  | "downloading-version-manifest"
  | "downloading-client"
  | "downloading-libraries"
  | "downloading-assets"
  | "checking-loader"
  | "installing-loader"
  | "checking-installed-mods"
  | "checking-sodium-compatibility"
  | "extracting-natives"
  | "building-classpath"
  | "launching-game"
  | "game-running"
  | "game-exited-successfully"
  | "game-crashed"
  | "launch-failed"
  | "cancelled";

export type LaunchStatusEvent = {
  type: "launch-status";
  instanceId: string;
  sessionId: string;
  state: LaunchState;
  message: string;
  progress?: number;
  current?: number;
  total?: number;
  timestamp: string;
  latestLogPath?: string;
  crashReportPath?: string;
  exitCode?: number;
  durationMs?: number;
  failedUrl?: string;
  destinationPath?: string;
  errorSummary?: string;
};

export type LaunchResult = {
  launched: boolean;
  sessionId?: string;
  commandPreview?: string;
  latestLogPath?: string;
  message: string;
};

export type ModpackImportResult = {
  instance: Instance;
  packName: string;
  packVersion?: string;
  minecraftVersion: string;
  loader: LoaderType;
  loaderVersion?: string;
  downloadedFiles: number;
  copiedOverrideFiles: number;
  skippedOptionalFiles: number;
  failedFiles: ModpackImportFailure[];
};

export type LauncherSettings = {
  theme: SettingsTheme;
  importedThemes: ImportedTheme[];
  backgroundStrength: number;
  borderStrength: number;
  cornerRadius: number;
  uiDensity: UiDensity;
  reducedMotion: boolean;
  backgroundPattern: BackgroundPattern;
  performanceMode: PerformanceMode;
  disableAnimatedBackgrounds: boolean;
  consoleMaxVisibleLines: number;
  defaultMinMemoryMb: number;
  defaultMaxMemoryMb: number;
  defaultJavaPath: string;
  defaultInstanceRoot: string;
  downloadCacheRoot: string;
  maxParallelDownloads: number;
  closeLauncherOnGameStart: boolean;
  keepLauncherOpen: boolean;
  openConsoleOnGameStart: boolean;
  autoScrollConsole: boolean;
  showAdvancedLaunchCommand: boolean;
  debugLogs: boolean;
  keepFullLogsOnDisk: boolean;
  retryFailedDownloads: boolean;
  discordRichPresence: boolean;
  developerMode: boolean;
};

export type NewsItem = {
  id: string;
  title: string;
  summary: string;
  publishedAt: string;
  tag: string;
};

export type BootstrapStep = {
  id: string;
  label: string;
};

export type BootstrapSnapshot = {
  steps: BootstrapStep[];
  accounts: LauncherAccount[];
  instances: Instance[];
  settings: LauncherSettings;
  runtimeConfig: RuntimeConfig;
  javaInstallations: JavaInstallation[];
  downloads: DownloadTask[];
  news: NewsItem[];
  authConfigured: boolean;
};

export type ServiceResponse<T> = {
  ok: boolean;
  data?: T;
  error?: string;
};

export type CreateOfflineDevAccountInput = {
  username: string;
};

export type CreateInstanceInput = {
  name: string;
  icon?: string;
  minecraftVersion: string;
  loader: LoaderType;
  loaderVersion?: string;
  memoryMinMb: number;
  memoryMaxMb: number;
  javaPath?: string;
  notes?: string;
};

export type UpdateInstanceInput = Partial<CreateInstanceInput> & {
  pinned?: boolean;
  favorite?: boolean;
  description?: string;
  lastLaunchStatus?: "idle" | "success" | "error";
  installStatus?: "not-installed" | "installing" | "ready" | "needs-repair" | "failed";
  lastPlayedAt?: string;
};

export type LauncherDataFile = {
  accounts: LauncherAccount[];
  instances: Instance[];
  settings: LauncherSettings;
};

export type AuthConfiguration = {
  configured: boolean;
  clientId?: string;
  redirectUri?: string;
};

export type RuntimeConfig = {
  microsoftClientId: string;
  microsoftRedirectUri: string;
  discordRpcClientId: string;
};

export type MicrosoftProfile = {
  id: string;
  name: string;
  skins?: Array<{ url: string; state: string }>;
  capes?: Array<{ alias: string; url: string }>;
};

export interface NovaApi {
  bootstrap: () => Promise<BootstrapSnapshot>;
  addMicrosoftAccount: () => Promise<ServiceResponse<LauncherAccount>>;
  addOfflineDevAccount: (
    input: CreateOfflineDevAccountInput
  ) => Promise<ServiceResponse<LauncherAccount>>;
  removeAccount: (accountId: string) => Promise<ServiceResponse<boolean>>;
  setActiveAccount: (accountId: string) => Promise<ServiceResponse<LauncherAccount>>;
  getAuthConfiguration: () => Promise<AuthConfiguration>;
  getRuntimeConfig: () => Promise<RuntimeConfig>;
  updateRuntimeConfig: (patch: Partial<RuntimeConfig>) => Promise<RuntimeConfig>;
  setEffectivePerformanceMode: (enabled: boolean) => Promise<void>;
  getInstances: () => Promise<Instance[]>;
  createInstance: (input: CreateInstanceInput) => Promise<ServiceResponse<Instance>>;
  updateInstance: (
    instanceId: string,
    input: UpdateInstanceInput
  ) => Promise<ServiceResponse<Instance>>;
  duplicateInstance: (instanceId: string) => Promise<ServiceResponse<Instance>>;
  deleteInstance: (instanceId: string) => Promise<ServiceResponse<boolean>>;
  openPath: (targetPath: string) => Promise<ServiceResponse<boolean>>;
  openExternalUrl: (targetUrl: string) => Promise<ServiceResponse<boolean>>;
  repairInstance: (instanceId: string) => Promise<ServiceResponse<Instance>>;
  listMinecraftVersions: () => Promise<MinecraftVersionOption[]>;
  listLoaderVersions: (
    loader: LoaderType,
    minecraftVersion: string
  ) => Promise<LoaderVersionOption[]>;
  listJavaInstallations: () => Promise<JavaInstallation[]>;
  listJavaDownloads: (majorVersion: number) => Promise<JavaRuntimeDownloadOption[]>;
  downloadJavaRuntime: (
    option: JavaRuntimeDownloadOption
  ) => Promise<ServiceResponse<JavaRuntimeInstallResult>>;
  updateSettings: (patch: Partial<LauncherSettings>) => Promise<LauncherSettings>;
  listMods: (instanceId: string) => Promise<InstalledMod[]>;
  toggleMod: (
    instanceId: string,
    modId: string,
    enabled: boolean
  ) => Promise<ServiceResponse<InstalledMod>>;
  deleteMod: (instanceId: string, modId: string) => Promise<ServiceResponse<boolean>>;
  importLocalMod: (instanceId: string) => Promise<ServiceResponse<InstalledMod[]>>;
  checkModUpdates: (instanceId: string) => Promise<ServiceResponse<InstalledMod[]>>;
  updateMod: (instanceId: string, modId: string) => Promise<ServiceResponse<InstalledMod>>;
  updateAllMods: (instanceId: string) => Promise<ServiceResponse<InstalledMod[]>>;
  importMrpack: () => Promise<ServiceResponse<ModpackImportResult>>;
  importTheme: () => Promise<ServiceResponse<LauncherSettings>>;
  exportTheme: () => Promise<ServiceResponse<string>>;
  deleteTheme: (themeId: ImportedThemeId) => Promise<ServiceResponse<LauncherSettings>>;
  searchModrinth: (
    query: string,
    filters: ModSearchFilters,
    page?: number,
    pageSize?: number
  ) => Promise<ServiceResponse<PaginatedModSearchResult>>;
  listModrinthVersions: (
    projectId: string,
    filters: ModSearchFilters
  ) => Promise<ServiceResponse<ModrinthVersionOption[]>>;
  installMod: (
    source: "modrinth",
    instanceId: string,
    projectId: string,
    versionId?: string
  ) => Promise<ServiceResponse<InstalledMod>>;
  changeModVersion: (
    instanceId: string,
    modId: string,
    versionId: string
  ) => Promise<ServiceResponse<InstalledMod>>;
  getNews: () => Promise<NewsItem[]>;
  launchInstance: (instanceId: string) => Promise<ServiceResponse<LaunchResult>>;
  getLaunchCommandPreview: (instanceId: string) => Promise<ServiceResponse<string>>;
  saveTextFile: (defaultFileName: string, contents: string) => Promise<ServiceResponse<string>>;
  openDataDirectory: () => Promise<ServiceResponse<boolean>>;
  clearDownloadCache: () => Promise<ServiceResponse<boolean>>;
  saveSessionLogCopy: (
    sourcePath: string,
    defaultFileName?: string
  ) => Promise<ServiceResponse<string>>;
  onDownloadUpdate: (
    callback: (tasks: DownloadTask[]) => void
  ) => (() => void) | undefined;
  onLaunchLogs: (
    callback: (entries: LaunchLogEntry[]) => void
  ) => (() => void) | undefined;
  onLaunchStatus: (
    callback: (entry: LaunchStatusEvent) => void
  ) => (() => void) | undefined;
  onMrpackImportStatus: (
    callback: (entry: ModpackImportStatusEvent) => void
  ) => (() => void) | undefined;
}
