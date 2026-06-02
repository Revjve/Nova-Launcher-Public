import type {
  BackgroundPattern,
  BootstrapStep,
  ImportedTheme,
  LauncherSettings,
  NewsItem,
  PerformanceMode,
  SettingsTheme,
  UiDensity
} from "./types";
import {
  BUILT_IN_THEME_IDS,
  isImportedThemeId,
  sanitizeImportedThemes
} from "./themes";

export const APP_NAME = "Nova Launcher";
export const STUDIO_NAME = "Nova Studios";
export const DEFAULT_MICROSOFT_CLIENT_ID = "9fca4b56-aeda-4249-99c2-fa70638e9b41";
export const DEFAULT_MICROSOFT_REDIRECT_URI = "http://127.0.0.1:42813/auth/callback";
export const DEFAULT_DISCORD_RPC_CLIENT_ID = "1506477355458367580";

export const BRAND_COPY = {
  heroHeadline: "Play Minecraft.",
  heroSubhead: "Launch, manage, and mod your instances.",
  dashboardStatus: "Ready to launch.",
  instancesTagline: "One place for every instance.",
  modsTagline: "Discover mods.",
  worldsTagline: "Manage your worlds."
} as const;

export const DEFAULT_BOOT_STEPS: BootstrapStep[] = [
  { id: "files", label: "Checking local launcher files" },
  { id: "accounts", label: "Checking accounts" },
  { id: "java", label: "Detecting Java runtimes" },
  { id: "instances", label: "Loading instances" }
];

export const DEFAULT_SETTINGS: LauncherSettings = {
  theme: "nova-dark",
  importedThemes: [],
  backgroundStrength: 0.74,
  borderStrength: 0.82,
  cornerRadius: 24,
  uiDensity: "normal",
  reducedMotion: false,
  backgroundPattern: "plain",
  performanceMode: "auto",
  disableAnimatedBackgrounds: false,
  consoleMaxVisibleLines: 2500,
  defaultMinMemoryMb: 2048,
  defaultMaxMemoryMb: 4096,
  defaultJavaPath: "",
  defaultInstanceRoot: "",
  downloadCacheRoot: "",
  maxParallelDownloads: 4,
  closeLauncherOnGameStart: false,
  keepLauncherOpen: true,
  openConsoleOnGameStart: false,
  autoScrollConsole: true,
  showAdvancedLaunchCommand: false,
  debugLogs: false,
  keepFullLogsOnDisk: true,
  retryFailedDownloads: true,
  discordRichPresence: false,
  developerMode: false
};

const themeValues = BUILT_IN_THEME_IDS;
const densityValues = ["compact", "normal", "spacious"] as const satisfies readonly UiDensity[];
const patternValues = ["plain", "aurora", "grid"] as const satisfies readonly BackgroundPattern[];
const performanceModeValues = ["off", "auto", "on"] as const satisfies readonly PerformanceMode[];

const legacyThemeMap: Record<string, SettingsTheme> = {
  obsidian: "nova-dark",
  midnight: "midnight-blue",
  forest: "emerald",
  violet: "amethyst",
  contrast: "high-contrast",
  "high-contrast": "high-contrast",
  ember: "nova-dark"
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";

const isString = (value: unknown): value is string => typeof value === "string";

const isOneOf = <T extends readonly string[]>(value: unknown, options: T): value is T[number] =>
  typeof value === "string" && options.includes(value as T[number]);

const clampNumber = (value: unknown, min: number, max: number, fallback: number) => {
  if (!isFiniteNumber(value)) {
    return fallback;
  }

  return Math.min(Math.max(value, min), max);
};

export const normalizeSettingsTheme = (
  value: unknown,
  importedThemes: ImportedTheme[] = [],
  fallback: SettingsTheme = DEFAULT_SETTINGS.theme
): SettingsTheme => {
  if (isOneOf(value, themeValues)) {
    return value;
  }

  if (isImportedThemeId(value) && importedThemes.some((theme) => theme.id === value)) {
    return value;
  }

  if (isString(value)) {
    return legacyThemeMap[value] ?? fallback;
  }

  return fallback;
};

export const sanitizeLauncherSettings = (
  input: Partial<LauncherSettings> | Record<string, unknown> | undefined,
  defaults: LauncherSettings = DEFAULT_SETTINGS
): LauncherSettings => {
  const source =
    input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const importedThemes = sanitizeImportedThemes(source.importedThemes);
  const fallbackTheme =
    isImportedThemeId(defaults.theme) && !importedThemes.some((theme) => theme.id === defaults.theme)
      ? "nova-dark"
      : defaults.theme;

  return {
    theme: normalizeSettingsTheme(source.theme, importedThemes, fallbackTheme),
    importedThemes,
    backgroundStrength: clampNumber(source.backgroundStrength, 0.2, 1, defaults.backgroundStrength),
    borderStrength: clampNumber(source.borderStrength, 0.35, 1.25, defaults.borderStrength),
    cornerRadius: clampNumber(source.cornerRadius, 12, 32, defaults.cornerRadius),
    uiDensity: isOneOf(source.uiDensity, densityValues) ? source.uiDensity : defaults.uiDensity,
    reducedMotion: isBoolean(source.reducedMotion) ? source.reducedMotion : defaults.reducedMotion,
    backgroundPattern: isOneOf(source.backgroundPattern, patternValues)
      ? source.backgroundPattern
      : defaults.backgroundPattern,
    performanceMode: isOneOf(source.performanceMode, performanceModeValues)
      ? source.performanceMode
      : defaults.performanceMode,
    disableAnimatedBackgrounds: isBoolean(source.disableAnimatedBackgrounds)
      ? source.disableAnimatedBackgrounds
      : defaults.disableAnimatedBackgrounds,
    consoleMaxVisibleLines: clampNumber(
      source.consoleMaxVisibleLines,
      250,
      10000,
      defaults.consoleMaxVisibleLines
    ),
    defaultMinMemoryMb: clampNumber(
      source.defaultMinMemoryMb,
      1024,
      65536,
      defaults.defaultMinMemoryMb
    ),
    defaultMaxMemoryMb: clampNumber(
      source.defaultMaxMemoryMb,
      2048,
      65536,
      defaults.defaultMaxMemoryMb
    ),
    defaultJavaPath: isString(source.defaultJavaPath) ? source.defaultJavaPath : defaults.defaultJavaPath,
    defaultInstanceRoot: isString(source.defaultInstanceRoot)
      ? source.defaultInstanceRoot
      : defaults.defaultInstanceRoot,
    downloadCacheRoot: isString(source.downloadCacheRoot)
      ? source.downloadCacheRoot
      : defaults.downloadCacheRoot,
    maxParallelDownloads: clampNumber(
      source.maxParallelDownloads,
      1,
      8,
      defaults.maxParallelDownloads
    ),
    closeLauncherOnGameStart: isBoolean(source.closeLauncherOnGameStart)
      ? source.closeLauncherOnGameStart
      : defaults.closeLauncherOnGameStart,
    keepLauncherOpen: isBoolean(source.keepLauncherOpen)
      ? source.keepLauncherOpen
      : defaults.keepLauncherOpen,
    openConsoleOnGameStart: isBoolean(source.openConsoleOnGameStart)
      ? source.openConsoleOnGameStart
      : defaults.openConsoleOnGameStart,
    autoScrollConsole: isBoolean(source.autoScrollConsole)
      ? source.autoScrollConsole
      : defaults.autoScrollConsole,
    showAdvancedLaunchCommand: isBoolean(source.showAdvancedLaunchCommand)
      ? source.showAdvancedLaunchCommand
      : defaults.showAdvancedLaunchCommand,
    debugLogs: isBoolean(source.debugLogs) ? source.debugLogs : defaults.debugLogs,
    keepFullLogsOnDisk: isBoolean(source.keepFullLogsOnDisk)
      ? source.keepFullLogsOnDisk
      : defaults.keepFullLogsOnDisk,
    retryFailedDownloads: isBoolean(source.retryFailedDownloads)
      ? source.retryFailedDownloads
      : defaults.retryFailedDownloads,
    discordRichPresence: isBoolean(source.discordRichPresence)
      ? source.discordRichPresence
      : defaults.discordRichPresence,
    developerMode: isBoolean(source.developerMode) ? source.developerMode : defaults.developerMode
  };
};

export const DEFAULT_NEWS: NewsItem[] = [
  {
    id: "welcome",
    title: "Welcome to Nova Launcher",
    summary:
      "Create, manage, and launch Minecraft instances from one place.",
    publishedAt: "2026-05-14T08:00:00.000Z",
    tag: "Product"
  },
  {
    id: "instances",
    title: "Build the setup you want",
    summary:
      "Create Vanilla, Fabric, Forge, and NeoForge instances with launcher-managed folders and settings.",
    publishedAt: "2026-05-13T12:00:00.000Z",
    tag: "Instances"
  },
  {
    id: "mods",
    title: "Browse compatible Modrinth mods",
    summary:
      "Browse and install compatible mods from Modrinth, or import local .jar files into any instance.",
    publishedAt: "2026-05-12T16:30:00.000Z",
    tag: "Mods"
  }
];
