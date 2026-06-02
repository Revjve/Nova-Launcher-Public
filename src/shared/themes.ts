import type {
  BuiltInThemeId,
  ImportedTheme,
  ImportedThemeId,
  NovaThemeFile,
  SettingsTheme,
  ThemeCategory,
  ThemeTokens
} from "./types";

export type ThemeDefinition = {
  id: SettingsTheme;
  name: string;
  description: string;
  category: ThemeCategory;
  builtIn: boolean;
  author?: string;
  baseTheme?: BuiltInThemeId;
  tokens: ThemeTokens;
};

const baseTokens: ThemeTokens = {
  shellBg: "#0a0d14",
  surface1: "rgba(17, 21, 31, 0.82)",
  surface2: "rgba(19, 24, 35, 0.96)",
  surface3: "rgba(255, 255, 255, 0.05)",
  panelBg: "rgba(16, 21, 31, 0.78)",
  panelBorderBase: "rgba(255, 255, 255, 0.08)",
  panelBorderStrongBase: "rgba(255, 255, 255, 0.14)",
  dividerBase: "rgba(255, 255, 255, 0.08)",
  shellGlow: "rgba(126, 168, 255, 0.16)",
  accentBase: "#7ea8ff",
  accentSolid: "#86adff",
  accentSolidHover: "#9abaff",
  accentSoft: "rgba(126, 168, 255, 0.18)",
  accentBorder: "rgba(126, 168, 255, 0.34)",
  accentGlow: "rgba(126, 168, 255, 0.24)",
  accentText: "#edf4ff",
  accentRing: "rgba(126, 168, 255, 0.42)",
  accentContrast: "#06111f",
  mutedText: "#8d96aa",
  softText: "#d0d8e9",
  chromeBg: "rgba(6, 9, 14, 0.36)",
  chromePanel: "rgba(255, 255, 255, 0.04)",
  buttonShadowSubtle:
    "0 0 0 1px rgba(126, 168, 255, 0.24), 0 10px 24px rgba(50, 77, 138, 0.28)",
  buttonShadowStrong:
    "0 0 0 1px rgba(126, 168, 255, 0.28), 0 16px 34px rgba(50, 77, 138, 0.34)"
};

const createTheme = (
  id: BuiltInThemeId,
  name: string,
  description: string,
  category: ThemeCategory,
  overrides: Partial<ThemeTokens>
): ThemeDefinition => ({
  id,
  name,
  description,
  category,
  builtIn: true,
  tokens: {
    ...baseTokens,
    ...overrides
  }
});

export const BUILT_IN_THEMES = [
  createTheme("nova-dark", "Nova Dark", "The default Nova look with cool blue highlights.", "Dark", {}),
  createTheme("midnight-blue", "Midnight Blue", "Deep navy panels with stronger blue contrast.", "Color", {
    shellBg: "#06111d",
    surface1: "rgba(9, 19, 33, 0.82)",
    surface2: "rgba(12, 24, 40, 0.96)",
    surface3: "rgba(255, 255, 255, 0.045)",
    panelBg: "rgba(10, 21, 35, 0.8)",
    panelBorderBase: "rgba(125, 181, 255, 0.12)",
    panelBorderStrongBase: "rgba(125, 181, 255, 0.18)",
    dividerBase: "rgba(125, 181, 255, 0.1)",
    shellGlow: "rgba(90, 141, 255, 0.22)",
    accentBase: "#4f87ff",
    accentSolid: "#5f94ff",
    accentSolidHover: "#77a6ff",
    accentSoft: "rgba(79, 135, 255, 0.2)",
    accentBorder: "rgba(79, 135, 255, 0.38)",
    accentGlow: "rgba(79, 135, 255, 0.28)",
    accentText: "#eef4ff",
    accentRing: "rgba(79, 135, 255, 0.46)",
    accentContrast: "#041221",
    mutedText: "#88a0bd",
    softText: "#d2e1f6",
    chromeBg: "rgba(6, 13, 23, 0.4)",
    chromePanel: "rgba(79, 135, 255, 0.08)",
    buttonShadowSubtle:
      "0 0 0 1px rgba(79, 135, 255, 0.26), 0 10px 26px rgba(28, 61, 148, 0.3)",
    buttonShadowStrong:
      "0 0 0 1px rgba(79, 135, 255, 0.3), 0 16px 36px rgba(28, 61, 148, 0.36)"
  }),
  createTheme("obsidian", "Obsidian", "Mostly black with a cold white-blue edge.", "Minimal", {
    shellBg: "#050608",
    surface1: "rgba(11, 12, 14, 0.84)",
    surface2: "rgba(14, 16, 19, 0.96)",
    surface3: "rgba(255, 255, 255, 0.03)",
    panelBg: "rgba(10, 12, 15, 0.82)",
    panelBorderBase: "rgba(220, 231, 255, 0.08)",
    panelBorderStrongBase: "rgba(220, 231, 255, 0.13)",
    dividerBase: "rgba(220, 231, 255, 0.08)",
    shellGlow: "rgba(170, 198, 255, 0.12)",
    accentBase: "#c9d8ff",
    accentSolid: "#d7e3ff",
    accentSolidHover: "#e8f0ff",
    accentSoft: "rgba(201, 216, 255, 0.12)",
    accentBorder: "rgba(201, 216, 255, 0.24)",
    accentGlow: "rgba(201, 216, 255, 0.16)",
    accentText: "#f4f8ff",
    accentRing: "rgba(201, 216, 255, 0.36)",
    accentContrast: "#050608",
    mutedText: "#98a1b2",
    softText: "#d8deeb",
    chromeBg: "rgba(5, 6, 8, 0.44)",
    chromePanel: "rgba(255, 255, 255, 0.025)",
    buttonShadowSubtle:
      "0 0 0 1px rgba(201, 216, 255, 0.14), 0 10px 22px rgba(0, 0, 0, 0.3)",
    buttonShadowStrong:
      "0 0 0 1px rgba(201, 216, 255, 0.18), 0 16px 30px rgba(0, 0, 0, 0.36)"
  }),
  createTheme("carbon", "Carbon", "Clean graphite with restrained effects.", "Minimal", {
    shellBg: "#0b0d10",
    surface1: "rgba(18, 21, 24, 0.84)",
    surface2: "rgba(22, 25, 29, 0.96)",
    panelBg: "rgba(17, 20, 24, 0.82)",
    panelBorderBase: "rgba(255, 255, 255, 0.07)",
    panelBorderStrongBase: "rgba(255, 255, 255, 0.11)",
    dividerBase: "rgba(255, 255, 255, 0.07)",
    shellGlow: "rgba(154, 169, 192, 0.08)",
    accentBase: "#b4bcc8",
    accentSolid: "#c1cad7",
    accentSolidHover: "#d1d9e6",
    accentSoft: "rgba(180, 188, 200, 0.12)",
    accentBorder: "rgba(180, 188, 200, 0.2)",
    accentGlow: "rgba(180, 188, 200, 0.14)",
    accentText: "#f4f6f9",
    accentRing: "rgba(180, 188, 200, 0.3)",
    accentContrast: "#0b0d10",
    mutedText: "#8f98a8",
    softText: "#d2d8e1",
    chromeBg: "rgba(8, 10, 12, 0.42)",
    chromePanel: "rgba(255, 255, 255, 0.022)",
    buttonShadowSubtle:
      "0 0 0 1px rgba(180, 188, 200, 0.12), 0 10px 20px rgba(0, 0, 0, 0.24)",
    buttonShadowStrong:
      "0 0 0 1px rgba(180, 188, 200, 0.14), 0 14px 28px rgba(0, 0, 0, 0.3)"
  }),
  createTheme("arctic", "Arctic", "Dark blue-gray surfaces with an icy edge.", "Color", {
    shellBg: "#091118",
    surface1: "rgba(14, 22, 31, 0.84)",
    surface2: "rgba(18, 28, 39, 0.96)",
    panelBg: "rgba(13, 21, 30, 0.82)",
    panelBorderBase: "rgba(152, 211, 255, 0.11)",
    panelBorderStrongBase: "rgba(152, 211, 255, 0.16)",
    dividerBase: "rgba(152, 211, 255, 0.09)",
    shellGlow: "rgba(111, 191, 255, 0.18)",
    accentBase: "#8cd2ff",
    accentSolid: "#99daff",
    accentSolidHover: "#afe3ff",
    accentSoft: "rgba(140, 210, 255, 0.18)",
    accentBorder: "rgba(140, 210, 255, 0.34)",
    accentGlow: "rgba(140, 210, 255, 0.22)",
    accentText: "#effaff",
    accentRing: "rgba(140, 210, 255, 0.42)",
    accentContrast: "#07131c",
    mutedText: "#8ea7ba",
    softText: "#d6e8f4",
    chromeBg: "rgba(8, 14, 20, 0.42)",
    chromePanel: "rgba(140, 210, 255, 0.05)"
  }),
  createTheme("emerald", "Emerald", "Green accents with a cooler forest tint.", "Color", {
    shellBg: "#08120f",
    surface1: "rgba(12, 24, 19, 0.84)",
    surface2: "rgba(14, 30, 24, 0.96)",
    surface3: "rgba(255, 255, 255, 0.045)",
    panelBg: "rgba(11, 23, 19, 0.8)",
    panelBorderBase: "rgba(83, 206, 145, 0.12)",
    panelBorderStrongBase: "rgba(83, 206, 145, 0.18)",
    dividerBase: "rgba(83, 206, 145, 0.1)",
    shellGlow: "rgba(83, 206, 145, 0.18)",
    accentBase: "#53ce91",
    accentSolid: "#5bd99a",
    accentSolidHover: "#70e4aa",
    accentSoft: "rgba(83, 206, 145, 0.18)",
    accentBorder: "rgba(83, 206, 145, 0.34)",
    accentGlow: "rgba(83, 206, 145, 0.22)",
    accentText: "#e9fff5",
    accentRing: "rgba(83, 206, 145, 0.42)",
    accentContrast: "#04180f",
    mutedText: "#89a99a",
    softText: "#d1e7dc",
    chromeBg: "rgba(6, 13, 10, 0.38)",
    chromePanel: "rgba(83, 206, 145, 0.06)",
    buttonShadowSubtle:
      "0 0 0 1px rgba(83, 206, 145, 0.24), 0 10px 24px rgba(19, 88, 58, 0.28)",
    buttonShadowStrong:
      "0 0 0 1px rgba(83, 206, 145, 0.28), 0 16px 34px rgba(19, 88, 58, 0.34)"
  }),
  createTheme("amethyst", "Amethyst", "A violet preset with softer glow.", "Color", {
    shellBg: "#0f0c18",
    surface1: "rgba(21, 17, 32, 0.84)",
    surface2: "rgba(27, 22, 41, 0.96)",
    panelBg: "rgba(20, 16, 31, 0.8)",
    panelBorderBase: "rgba(160, 122, 255, 0.12)",
    panelBorderStrongBase: "rgba(160, 122, 255, 0.18)",
    dividerBase: "rgba(160, 122, 255, 0.1)",
    shellGlow: "rgba(160, 122, 255, 0.18)",
    accentBase: "#a07aff",
    accentSolid: "#a987ff",
    accentSolidHover: "#b79aff",
    accentSoft: "rgba(160, 122, 255, 0.18)",
    accentBorder: "rgba(160, 122, 255, 0.34)",
    accentGlow: "rgba(160, 122, 255, 0.22)",
    accentText: "#f4edff",
    accentRing: "rgba(160, 122, 255, 0.44)",
    accentContrast: "#10091a",
    mutedText: "#9e93b4",
    softText: "#ddd3ef",
    chromeBg: "rgba(12, 10, 20, 0.4)",
    chromePanel: "rgba(160, 122, 255, 0.07)",
    buttonShadowSubtle:
      "0 0 0 1px rgba(160, 122, 255, 0.24), 0 10px 24px rgba(73, 45, 125, 0.28)",
    buttonShadowStrong:
      "0 0 0 1px rgba(160, 122, 255, 0.28), 0 16px 34px rgba(73, 45, 125, 0.34)"
  }),
  createTheme("crimson", "Crimson", "Dark red panels with a sharper edge.", "Color", {
    shellBg: "#12080a",
    surface1: "rgba(28, 14, 18, 0.84)",
    surface2: "rgba(34, 18, 22, 0.96)",
    panelBg: "rgba(24, 12, 16, 0.82)",
    panelBorderBase: "rgba(255, 109, 120, 0.12)",
    panelBorderStrongBase: "rgba(255, 109, 120, 0.18)",
    dividerBase: "rgba(255, 109, 120, 0.1)",
    shellGlow: "rgba(255, 89, 108, 0.16)",
    accentBase: "#ff6676",
    accentSolid: "#ff7282",
    accentSolidHover: "#ff8795",
    accentSoft: "rgba(255, 102, 118, 0.18)",
    accentBorder: "rgba(255, 102, 118, 0.32)",
    accentGlow: "rgba(255, 102, 118, 0.22)",
    accentText: "#fff0f2",
    accentRing: "rgba(255, 102, 118, 0.42)",
    accentContrast: "#22070d",
    mutedText: "#b79aa1",
    softText: "#ebd9dd",
    chromeBg: "rgba(18, 8, 10, 0.42)",
    chromePanel: "rgba(255, 102, 118, 0.06)"
  }),
  createTheme("solar", "Solar", "Warm amber light on a dark shell.", "Color", {
    shellBg: "#120d07",
    surface1: "rgba(28, 21, 13, 0.84)",
    surface2: "rgba(35, 25, 16, 0.96)",
    panelBg: "rgba(24, 18, 11, 0.82)",
    panelBorderBase: "rgba(255, 187, 95, 0.12)",
    panelBorderStrongBase: "rgba(255, 187, 95, 0.18)",
    dividerBase: "rgba(255, 187, 95, 0.1)",
    shellGlow: "rgba(255, 181, 76, 0.16)",
    accentBase: "#ffb44d",
    accentSolid: "#ffc061",
    accentSolidHover: "#ffcb7c",
    accentSoft: "rgba(255, 180, 77, 0.18)",
    accentBorder: "rgba(255, 180, 77, 0.32)",
    accentGlow: "rgba(255, 180, 77, 0.22)",
    accentText: "#fff7eb",
    accentRing: "rgba(255, 180, 77, 0.42)",
    accentContrast: "#211308",
    mutedText: "#b69f84",
    softText: "#eadbc7",
    chromeBg: "rgba(18, 13, 7, 0.42)",
    chromePanel: "rgba(255, 180, 77, 0.06)"
  }),
  createTheme("void", "Void", "A darker purple shell with a deeper mood.", "Dark", {
    shellBg: "#08060d",
    surface1: "rgba(15, 11, 24, 0.84)",
    surface2: "rgba(20, 15, 31, 0.96)",
    panelBg: "rgba(13, 10, 22, 0.82)",
    panelBorderBase: "rgba(144, 96, 255, 0.11)",
    panelBorderStrongBase: "rgba(144, 96, 255, 0.16)",
    dividerBase: "rgba(144, 96, 255, 0.09)",
    shellGlow: "rgba(118, 72, 255, 0.14)",
    accentBase: "#8c62ff",
    accentSolid: "#9871ff",
    accentSolidHover: "#a787ff",
    accentSoft: "rgba(140, 98, 255, 0.16)",
    accentBorder: "rgba(140, 98, 255, 0.28)",
    accentGlow: "rgba(140, 98, 255, 0.2)",
    accentText: "#f2edff",
    accentRing: "rgba(140, 98, 255, 0.38)",
    accentContrast: "#0c0716",
    mutedText: "#9c90b6",
    softText: "#d8d0ea",
    chromeBg: "rgba(7, 5, 12, 0.44)",
    chromePanel: "rgba(140, 98, 255, 0.045)"
  }),
  createTheme("monochrome", "Monochrome", "Near-black and white with almost no tint.", "Minimal", {
    shellBg: "#070707",
    surface1: "rgba(12, 12, 12, 0.88)",
    surface2: "rgba(16, 16, 16, 0.98)",
    surface3: "rgba(255, 255, 255, 0.04)",
    panelBg: "rgba(11, 11, 11, 0.9)",
    panelBorderBase: "rgba(255, 255, 255, 0.1)",
    panelBorderStrongBase: "rgba(255, 255, 255, 0.14)",
    dividerBase: "rgba(255, 255, 255, 0.1)",
    shellGlow: "rgba(255, 255, 255, 0.06)",
    accentBase: "#dddddd",
    accentSolid: "#ededed",
    accentSolidHover: "#ffffff",
    accentSoft: "rgba(255, 255, 255, 0.14)",
    accentBorder: "rgba(255, 255, 255, 0.24)",
    accentGlow: "rgba(255, 255, 255, 0.1)",
    accentText: "#ffffff",
    accentRing: "rgba(255, 255, 255, 0.3)",
    accentContrast: "#050505",
    mutedText: "#9f9f9f",
    softText: "#e5e5e5",
    chromeBg: "rgba(7, 7, 7, 0.46)",
    chromePanel: "rgba(255, 255, 255, 0.025)",
    buttonShadowSubtle:
      "0 0 0 1px rgba(255, 255, 255, 0.12), 0 10px 20px rgba(0, 0, 0, 0.26)",
    buttonShadowStrong:
      "0 0 0 1px rgba(255, 255, 255, 0.15), 0 16px 28px rgba(0, 0, 0, 0.3)"
  }),
  createTheme("matrix", "Matrix", "A terminal-inspired green preset without the joke.", "Color", {
    shellBg: "#071008",
    surface1: "rgba(11, 22, 13, 0.84)",
    surface2: "rgba(14, 28, 17, 0.96)",
    panelBg: "rgba(10, 20, 12, 0.82)",
    panelBorderBase: "rgba(92, 228, 128, 0.11)",
    panelBorderStrongBase: "rgba(92, 228, 128, 0.16)",
    dividerBase: "rgba(92, 228, 128, 0.09)",
    shellGlow: "rgba(92, 228, 128, 0.14)",
    accentBase: "#59d989",
    accentSolid: "#65e493",
    accentSolidHover: "#7bee9f",
    accentSoft: "rgba(89, 217, 137, 0.16)",
    accentBorder: "rgba(89, 217, 137, 0.28)",
    accentGlow: "rgba(89, 217, 137, 0.2)",
    accentText: "#ecfff2",
    accentRing: "rgba(89, 217, 137, 0.36)",
    accentContrast: "#04110a",
    mutedText: "#8ea994",
    softText: "#d7eadb",
    chromeBg: "rgba(6, 12, 7, 0.42)",
    chromePanel: "rgba(89, 217, 137, 0.045)"
  }),
  createTheme("high-contrast", "High Contrast", "Maximum readability with bright controls.", "Contrast", {
    shellBg: "#050505",
    surface1: "rgba(8, 8, 8, 0.9)",
    surface2: "rgba(12, 12, 12, 0.98)",
    surface3: "rgba(255, 255, 255, 0.08)",
    panelBg: "rgba(10, 10, 10, 0.92)",
    panelBorderBase: "rgba(255, 255, 255, 0.18)",
    panelBorderStrongBase: "rgba(255, 255, 255, 0.28)",
    dividerBase: "rgba(255, 255, 255, 0.18)",
    shellGlow: "rgba(255, 255, 255, 0.12)",
    accentBase: "#f4f4f6",
    accentSolid: "#f7f7f8",
    accentSolidHover: "#ffffff",
    accentSoft: "rgba(255, 255, 255, 0.2)",
    accentBorder: "rgba(255, 255, 255, 0.42)",
    accentGlow: "rgba(255, 255, 255, 0.18)",
    accentText: "#ffffff",
    accentRing: "rgba(255, 255, 255, 0.48)",
    accentContrast: "#050505",
    mutedText: "#b7b7bb",
    softText: "#efeff1",
    chromeBg: "rgba(5, 5, 5, 0.48)",
    chromePanel: "rgba(255, 255, 255, 0.06)",
    buttonShadowSubtle:
      "0 0 0 1px rgba(255, 255, 255, 0.28), 0 10px 24px rgba(255, 255, 255, 0.08)",
    buttonShadowStrong:
      "0 0 0 1px rgba(255, 255, 255, 0.34), 0 16px 34px rgba(255, 255, 255, 0.1)"
  })
] as const satisfies readonly ThemeDefinition[];

export const BUILT_IN_THEME_IDS = BUILT_IN_THEMES.map((theme) => theme.id) as readonly BuiltInThemeId[];
const builtInThemeMap = new Map(BUILT_IN_THEMES.map((theme) => [theme.id, theme] as const));

export const THEME_TOKEN_KEYS = Object.keys(baseTokens) as Array<keyof ThemeTokens>;

export const THEME_CSS_VAR_MAP: Record<keyof ThemeTokens, string> = {
  shellBg: "--shell-bg",
  surface1: "--surface-1",
  surface2: "--surface-2",
  surface3: "--surface-3",
  panelBg: "--panel-bg",
  panelBorderBase: "--panel-border-base",
  panelBorderStrongBase: "--panel-border-strong-base",
  dividerBase: "--divider-base",
  shellGlow: "--shell-glow",
  accentBase: "--accent-base",
  accentSolid: "--accent-solid",
  accentSolidHover: "--accent-solid-hover",
  accentSoft: "--accent-soft",
  accentBorder: "--accent-border",
  accentGlow: "--accent-glow",
  accentText: "--accent-text",
  accentRing: "--accent-ring",
  accentContrast: "--accent-contrast",
  mutedText: "--muted-text",
  softText: "--soft-text",
  chromeBg: "--chrome-bg",
  chromePanel: "--chrome-panel",
  buttonShadowSubtle: "--button-shadow-subtle",
  buttonShadowStrong: "--button-shadow-strong"
};

const unsafeThemeValuePattern = /(url\(|var\(|expression\(|calc\(|;|\{|\}|<script)/i;
const hexColorPattern = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const rgbaPattern =
  /^rgba\(\s*(25[0-5]|2[0-4]\d|1?\d?\d)\s*,\s*(25[0-5]|2[0-4]\d|1?\d?\d)\s*,\s*(25[0-5]|2[0-4]\d|1?\d?\d)\s*,\s*(0|0?\.\d+|1(?:\.0+)?)\s*\)$/i;

const isString = (value: unknown): value is string => typeof value === "string";

const normalizeText = (value: unknown, fallback?: string) => {
  if (!isString(value)) {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
};

export const isBuiltInThemeId = (value: unknown): value is BuiltInThemeId =>
  isString(value) && BUILT_IN_THEME_IDS.includes(value as BuiltInThemeId);

export const isImportedThemeId = (value: unknown): value is ImportedThemeId =>
  isString(value) && value.startsWith("imported:");

export const getBuiltInTheme = (themeId: BuiltInThemeId) =>
  builtInThemeMap.get(themeId) ?? builtInThemeMap.get("nova-dark")!;

export const slugifyThemeName = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "theme";

export const sanitizeThemeTokenValue = (value: unknown) => {
  if (!isString(value)) {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed || unsafeThemeValuePattern.test(trimmed)) {
    return undefined;
  }

  if (hexColorPattern.test(trimmed) || rgbaPattern.test(trimmed)) {
    return trimmed;
  }

  return undefined;
};

export const sanitizeThemeTokens = (value: unknown): Partial<ThemeTokens> => {
  if (!value || typeof value !== "object") {
    return {};
  }

  const source = value as Record<string, unknown>;
  const next: Partial<ThemeTokens> = {};

  for (const key of THEME_TOKEN_KEYS) {
    const safeValue = sanitizeThemeTokenValue(source[key]);
    if (safeValue) {
      next[key] = safeValue;
    }
  }

  return next;
};

export const sanitizeThemeFile = (value: unknown): NovaThemeFile | undefined => {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const source = value as Record<string, unknown>;
  if (source.formatVersion !== 1 || source.type !== "nova-theme") {
    return undefined;
  }

  const name = normalizeText(source.name);
  if (!name) {
    return undefined;
  }

  const tokens = sanitizeThemeTokens(source.tokens);
  if (Object.keys(tokens).length === 0) {
    return undefined;
  }

  const baseTheme = isBuiltInThemeId(source.baseTheme) ? source.baseTheme : "nova-dark";

  return {
    formatVersion: 1,
    type: "nova-theme",
    name,
    description: normalizeText(source.description),
    author: normalizeText(source.author),
    baseTheme,
    tokens
  };
};

export const createImportedTheme = (
  file: NovaThemeFile,
  id: ImportedThemeId,
  importedAt: string
): ImportedTheme => ({
  ...file,
  id,
  importedAt
});

export const sanitizeImportedTheme = (value: unknown): ImportedTheme | undefined => {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const source = value as Record<string, unknown>;
  const file = sanitizeThemeFile(source);
  const importedAt = normalizeText(source.importedAt);
  if (!file || !isImportedThemeId(source.id) || !importedAt) {
    return undefined;
  }

  return {
    ...file,
    id: source.id,
    importedAt
  };
};

export const sanitizeImportedThemes = (value: unknown): ImportedTheme[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const unique = new Map<ImportedThemeId, ImportedTheme>();

  for (const item of value) {
    const theme = sanitizeImportedTheme(item);
    if (theme) {
      unique.set(theme.id, theme);
    }
  }

  return [...unique.values()].slice(0, 48);
};

export const resolveThemeDefinition = (
  themeId: SettingsTheme | unknown,
  importedThemes: ImportedTheme[]
): ThemeDefinition => {
  if (isBuiltInThemeId(themeId)) {
    return getBuiltInTheme(themeId);
  }

  if (isImportedThemeId(themeId)) {
    const imported = importedThemes.find((theme) => theme.id === themeId);
    if (imported) {
      const baseTheme = getBuiltInTheme(imported.baseTheme ?? "nova-dark");
      return {
        id: imported.id,
        name: imported.name,
        description: imported.description ?? "Imported theme.",
        category: "Imported",
        builtIn: false,
        author: imported.author,
        baseTheme: imported.baseTheme ?? "nova-dark",
        tokens: {
          ...baseTheme.tokens,
          ...imported.tokens
        }
      };
    }
  }

  return getBuiltInTheme("nova-dark");
};

export const resolveThemeName = (themeId: SettingsTheme | unknown, importedThemes: ImportedTheme[]) =>
  resolveThemeDefinition(themeId, importedThemes).name;

export const themeTokensToCssVars = (tokens: ThemeTokens) => {
  const entries = THEME_TOKEN_KEYS.map((key) => [THEME_CSS_VAR_MAP[key], tokens[key]] as const);
  return Object.fromEntries(entries);
};

export const exportThemeFile = (
  themeId: SettingsTheme,
  importedThemes: ImportedTheme[]
): NovaThemeFile => {
  const resolved = resolveThemeDefinition(themeId, importedThemes);
  return {
    formatVersion: 1,
    type: "nova-theme",
    name: resolved.name,
    description: resolved.description,
    author: resolved.author,
    baseTheme:
      resolved.builtIn && isBuiltInThemeId(resolved.id)
        ? resolved.id
        : resolved.baseTheme ?? "nova-dark",
    tokens: resolved.tokens
  };
};
