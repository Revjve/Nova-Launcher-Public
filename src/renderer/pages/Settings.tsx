import { useEffect, useMemo, useState, type CSSProperties } from "react";
import packageJson from "../../../package.json";
import {
  ArrowLeft2,
  Code,
  Colorfilter,
  FolderOpen,
  ImportCurve,
  Magicpen,
  Refresh
} from "iconsax-react";
import { Shuffle, Trash2, Upload, Download } from "lucide-react";
import { APP_NAME, STUDIO_NAME } from "@shared/constants";
import {
  BUILT_IN_THEMES,
  isImportedThemeId,
  resolveThemeDefinition,
  themeTokensToCssVars,
  type ThemeDefinition
} from "@shared/themes";
import type {
  BackgroundPattern,
  JavaRuntimeDownloadOption,
  PerformanceMode,
  UiDensity
} from "@shared/types";
import { Badge } from "@renderer/components/ui/Badge";
import { Button } from "@renderer/components/ui/Button";
import { ErrorCallout } from "@renderer/components/ui/ErrorCallout";
import { Input } from "@renderer/components/ui/Input";
import { PageHeader } from "@renderer/components/ui/PageHeader";
import { Progress } from "@renderer/components/ui/Progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@renderer/components/ui/Select";
import { SettingsSection } from "@renderer/components/ui/SettingsSection";
import { StatusPill } from "@renderer/components/ui/StatusPill";
import { Switch } from "@renderer/components/ui/Switch";
import { formatBytes } from "@renderer/lib/format";
import { useLauncherStore } from "@renderer/state/useLauncherStore";

const patternOptions: Array<{ id: BackgroundPattern; label: string }> = [
  { id: "plain", label: "Plain" },
  { id: "aurora", label: "Aurora" },
  { id: "grid", label: "Grid" }
];

const densityOptions: Array<{ id: UiDensity; label: string }> = [
  { id: "compact", label: "Compact" },
  { id: "normal", label: "Normal" },
  { id: "spacious", label: "Spacious" }
];

const performanceModeOptions: Array<{ id: PerformanceMode; label: string }> = [
  { id: "off", label: "Off" },
  { id: "auto", label: "Auto" },
  { id: "on", label: "On" }
];

const consoleLineOptions = [1000, 2500, 5000];
const downloadConcurrencyOptions = [2, 3, 4, 6, 8];

const SliderRow = ({
  label,
  valueLabel,
  min,
  max,
  step,
  value,
  onChange
}: {
  label: string;
  valueLabel: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}) => (
  <div className="rounded-[var(--field-radius)] border border-[var(--panel-border)] bg-[var(--surface-3)] px-3 py-3">
    <div className="mb-2 flex items-center justify-between gap-3 text-sm">
      <span className="text-white">{label}</span>
      <span className="text-[var(--accent-text)]">{valueLabel}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      className="w-full"
    />
  </div>
);

const themeCategoryToneClass: Record<ThemeDefinition["category"], string> = {
  Dark: "border-[var(--panel-border)] bg-[var(--surface-3)] text-[var(--soft-text)]",
  Color: "border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent-text)]",
  Contrast: "border-white/20 bg-white/10 text-white",
  Minimal: "border-[var(--panel-border)] bg-[var(--surface-2)] text-[var(--soft-text)]",
  Imported: "border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent-text)]"
};

const ThemeMiniPreview = ({ theme }: { theme: ThemeDefinition }) => {
  const style = themeTokensToCssVars(theme.tokens) as CSSProperties;

  return (
    <div
      style={style}
      className="rounded-[14px] border border-[var(--panel-border-base)] bg-[var(--panel-bg)] p-2.5"
    >
      <div className="grid grid-cols-[52px_minmax(0,1fr)] gap-2">
        <div className="rounded-[10px] border border-[var(--panel-border-base)] bg-[var(--surface-2)] p-2">
          <div className="rounded-[8px] border border-[var(--accent-border)] bg-[var(--accent-soft)] px-2 py-1 text-[9px] font-medium text-[var(--accent-text)]">
            Play
          </div>
        </div>
        <div className="space-y-2">
          <div className="rounded-[10px] border border-[var(--panel-border-base)] bg-[var(--surface-2)] px-2 py-2">
            <div className="h-2 w-16 rounded-full" style={{ background: "var(--soft-text)", opacity: 0.88 }} />
            <div
              className="mt-2 h-2 w-10 rounded-full"
              style={{ background: "var(--muted-text)", opacity: 0.68 }}
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-[8px] border border-[var(--accent-border)] bg-[var(--accent-solid)] px-2 py-1 text-[9px] font-medium text-[var(--accent-contrast)] shadow-[var(--button-shadow-subtle)]">
              Button
            </div>
            <div className="rounded-full border border-[var(--accent-border)] bg-[var(--accent-soft)] px-2 py-1 text-[9px] text-[var(--accent-text)]">
              Ready
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ThemeGalleryCard = ({
  theme,
  active,
  onApply,
  onDelete
}: {
  theme: ThemeDefinition;
  active: boolean;
  onApply: () => void;
  onDelete?: () => void;
}) => (
  <div
    role="button"
    tabIndex={0}
    onClick={onApply}
    onKeyDown={(event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onApply();
      }
    }}
    className={`rounded-[var(--field-radius)] border p-3 text-left transition ${
      active
        ? "border-[var(--accent-border)] bg-[var(--accent-soft)] shadow-[var(--button-shadow-subtle)]"
        : "border-[var(--panel-border)] bg-[var(--surface-2)] hover:border-[var(--panel-border-strong)] hover:bg-[var(--surface-3)]"
    }`}
  >
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium text-white">{theme.name}</p>
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${themeCategoryToneClass[theme.category]}`}
          >
            {theme.category}
          </span>
          {active ? <Badge variant="secondary">Active</Badge> : null}
        </div>
        <p className="mt-1 text-xs leading-5 text-[var(--muted-text)]">{theme.description}</p>
        {!theme.builtIn && theme.author ? (
          <p className="mt-1 text-[11px] text-[var(--muted-text)]">By {theme.author}</p>
        ) : null}
      </div>
      {!theme.builtIn && onDelete ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
    <div className="mt-3">
      <ThemeMiniPreview theme={theme} />
    </div>
  </div>
);

const ThemePreviewCard = () => (
  <div className="rounded-[var(--panel-radius)] border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4 shadow-[var(--panel-shadow)]">
    <div className="grid gap-4 lg:grid-cols-[150px_minmax(0,1fr)]">
      <div className="rounded-[var(--field-radius)] border border-[var(--panel-border)] bg-[var(--surface-2)] p-3">
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted-text)]">Sidebar</p>
        <div className="mt-3 space-y-2">
          <div className="rounded-[12px] border border-[var(--accent-border)] bg-[var(--accent-soft)] px-3 py-2 text-sm font-medium text-[var(--accent-text)] shadow-[var(--button-shadow-subtle)]">
            Play
          </div>
          <div className="rounded-[12px] border border-transparent px-3 py-2 text-sm text-[var(--soft-text)]">
            Instances
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm">Play</Button>
          <Button size="sm" variant="secondary">
            Secondary
          </Button>
          <StatusPill label="Ready" tone="info" compact />
        </div>

        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px]">
          <div className="rounded-[var(--field-radius)] border border-[var(--accent-border)] bg-[var(--accent-soft)] p-3 shadow-[var(--button-shadow-subtle)]">
            <p className="text-sm font-medium text-[var(--accent-text)]">Selected card</p>
            <p className="mt-1 text-xs text-[var(--soft-text)]">Theme accent drives the active state.</p>
          </div>
          <div className="rounded-[var(--field-radius)] border border-[var(--accent-border)] bg-[var(--surface-2)] px-3.5 py-3 ring-2 ring-[var(--accent-ring)]">
            <p className="text-xs text-[var(--muted-text)]">Focused input</p>
            <p className="mt-1 text-sm text-white">Search instances</p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_240px]">
          <div className="rounded-[var(--field-radius)] border border-[var(--panel-border)] bg-[var(--surface-2)] px-3 py-3">
            <div className="mb-3 flex items-center justify-between text-xs text-[var(--muted-text)]">
              <span>Progress</span>
              <span>62%</span>
            </div>
            <Progress value={62} />
          </div>
          <Switch checked onCheckedChange={() => undefined} label="Static background" />
        </div>
      </div>
    </div>
  </div>
);

const aboutRows = [
  { label: "App", value: APP_NAME },
  { label: "Version", value: packageJson.version },
  { label: "Studio", value: STUDIO_NAME },
  { label: "Channel", value: import.meta.env.DEV ? "Development" : "Production" }
];

export const Settings = () => {
  const settings = useLauncherStore((state) => state.settings);
  const instances = useLauncherStore((state) => state.instances);
  const javaInstallations = useLauncherStore((state) => state.javaInstallations);
  const updateSettings = useLauncherStore((state) => state.updateSettings);
  const importTheme = useLauncherStore((state) => state.importTheme);
  const exportTheme = useLauncherStore((state) => state.exportTheme);
  const deleteTheme = useLauncherStore((state) => state.deleteTheme);
  const refreshJava = useLauncherStore((state) => state.refreshJava);
  const openDataDirectory = useLauncherStore((state) => state.openDataDirectory);
  const openPath = useLauncherStore((state) => state.openPath);
  const clearDownloadCache = useLauncherStore((state) => state.clearDownloadCache);
  const listJavaDownloads = useLauncherStore((state) => state.listJavaDownloads);
  const downloadJavaRuntime = useLauncherStore((state) => state.downloadJavaRuntime);
  const [downloadMajor, setDownloadMajor] = useState(21);
  const [javaDownloads, setJavaDownloads] = useState<JavaRuntimeDownloadOption[]>([]);
  const [loadingJavaDownloads, setLoadingJavaDownloads] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadingJavaDownloads(true);
    void listJavaDownloads(downloadMajor)
      .then((items) => {
        if (!cancelled) {
          setJavaDownloads(items);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingJavaDownloads(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [downloadMajor, listJavaDownloads]);

  const activeTheme = useMemo(
    () => resolveThemeDefinition(settings.theme, settings.importedThemes),
    [settings.importedThemes, settings.theme]
  );
  const importedThemeCards = useMemo(
    () => settings.importedThemes.map((theme) => resolveThemeDefinition(theme.id, settings.importedThemes)),
    [settings.importedThemes]
  );
  const activeThemeLabel = activeTheme.name;
  const activePatternLabel =
    patternOptions.find((option) => option.id === settings.backgroundPattern)?.label ??
    settings.backgroundPattern;
  const activeDensityLabel =
    densityOptions.find((option) => option.id === settings.uiDensity)?.label ?? settings.uiDensity;
  const logsFolder = instances[0]?.paths.logs;
  const showDeveloperSettings = import.meta.env.DEV || settings.developerMode;
  const noJavaFound = javaInstallations.length === 0;
  const randomizeBuiltInTheme = () => {
    const candidates = BUILT_IN_THEMES.filter((theme) => theme.id !== settings.theme);
    const nextTheme = candidates[Math.floor(Math.random() * candidates.length)] ?? BUILT_IN_THEMES[0];
    void updateSettings({ theme: nextTheme.id });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings"
        title={themeOpen ? "Appearance" : "Settings"}
        description={themeOpen ? "Choose the launcher look." : "Launcher settings."}
      />

      {themeOpen ? (
        <SettingsSection
          title="Appearance"
          aside={
            <Button variant="secondary" size="sm" onClick={() => setThemeOpen(false)}>
              <ArrowLeft2 size={18} variant="Linear" className="mr-2" />
              Back
            </Button>
          }
        >
          <div className="space-y-4">
            <div className="space-y-3 rounded-[var(--field-radius)] border border-[var(--panel-border)] bg-[var(--surface-3)] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-medium text-white">Live preview</h4>
                  <p className="mt-1 text-sm text-[var(--soft-text)]">
                    Theme changes apply to the full launcher and this preview card.
                  </p>
                </div>
                <StatusPill label={activeThemeLabel} tone="info" compact />
              </div>
              <ThemePreviewCard />
            </div>

            <div className="space-y-3 rounded-[var(--field-radius)] border border-[var(--panel-border)] bg-[var(--surface-3)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-medium text-white">Theme gallery</h4>
                  <p className="mt-1 text-sm text-[var(--soft-text)]">
                    Pick a built-in preset or an imported theme.
                  </p>
                </div>
                <Button variant="secondary" size="sm" onClick={randomizeBuiltInTheme}>
                  <Shuffle className="mr-2 h-4 w-4" />
                  Randomize theme
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                {BUILT_IN_THEMES.map((theme) => (
                  <ThemeGalleryCard
                    key={theme.id}
                    theme={theme}
                    active={settings.theme === theme.id}
                    onApply={() => void updateSettings({ theme: theme.id })}
                  />
                ))}
              </div>
              <div className="border-t border-[var(--divider-color)] pt-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h5 className="text-sm font-medium text-white">Imported</h5>
                    <p className="mt-1 text-sm text-[var(--soft-text)]">
                      Imported themes stay local to this launcher.
                    </p>
                  </div>
                  <Badge variant="default">{settings.importedThemes.length}</Badge>
                </div>
                {importedThemeCards.length > 0 ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                    {importedThemeCards.map((theme) => (
                      <ThemeGalleryCard
                        key={theme.id}
                        theme={theme}
                        active={settings.theme === theme.id}
                        onApply={() => void updateSettings({ theme: theme.id })}
                        onDelete={() => {
                          if (!isImportedThemeId(theme.id)) {
                            return;
                          }
                          if (!window.confirm(`Delete ${theme.name}?`)) {
                            return;
                          }
                          void deleteTheme(theme.id);
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 rounded-[var(--field-radius)] border border-dashed border-[var(--panel-border)] bg-[var(--surface-2)] px-4 py-4 text-sm text-[var(--soft-text)]">
                    Import a local `.nova-theme.json` file to add it here.
                  </div>
                )}
              </div>
            </div>

            <div className="grid gap-4 2xl:grid-cols-2">
              <div className="space-y-3 rounded-[var(--field-radius)] border border-[var(--panel-border)] bg-[var(--surface-3)] p-4">
                <h4 className="text-sm font-medium text-white">Layout</h4>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm text-[var(--soft-text)]">Density</label>
                    <Select
                      value={settings.uiDensity}
                      onValueChange={(value) => void updateSettings({ uiDensity: value as UiDensity })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {densityOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                  <SliderRow
                    label="Border strength"
                    valueLabel={`${Math.round(settings.borderStrength * 100)}%`}
                    min={0.35}
                    max={1.25}
                    step={0.05}
                    value={settings.borderStrength}
                    onChange={(value) => void updateSettings({ borderStrength: value })}
                  />
                  <SliderRow
                    label="Corner radius"
                    valueLabel={`${Math.round(settings.cornerRadius)}px`}
                    min={12}
                    max={32}
                    step={2}
                    value={settings.cornerRadius}
                    onChange={(value) => void updateSettings({ cornerRadius: value })}
                  />
                </div>
              </div>

              <div className="space-y-3 rounded-[var(--field-radius)] border border-[var(--panel-border)] bg-[var(--surface-3)] p-4">
                <h4 className="text-sm font-medium text-white">Background</h4>
                <div className="space-y-2">
                  <label className="text-sm text-[var(--soft-text)]">Style</label>
                  <Select
                    value={settings.backgroundPattern}
                    onValueChange={(value) =>
                      void updateSettings({ backgroundPattern: value as BackgroundPattern })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {patternOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <SliderRow
                  label="Background strength"
                  valueLabel={`${Math.round(settings.backgroundStrength * 100)}%`}
                  min={0.2}
                  max={1}
                  step={0.05}
                  value={settings.backgroundStrength}
                  onChange={(value) => void updateSettings({ backgroundStrength: value })}
                />
              </div>
            </div>

            <div className="space-y-3 rounded-[var(--field-radius)] border border-[var(--panel-border)] bg-[var(--surface-3)] p-4">
                <h4 className="text-sm font-medium text-white">Motion</h4>
                <div className="grid gap-3">
                  <Switch
                    checked={settings.reducedMotion}
                    onCheckedChange={(checked) => void updateSettings({ reducedMotion: checked })}
                    label="Reduced motion"
                  />
                  <Switch
                    checked={settings.disableAnimatedBackgrounds}
                    onCheckedChange={(checked) =>
                      void updateSettings({ disableAnimatedBackgrounds: checked })
                    }
                  label="Static background"
                />
              </div>
            </div>

            <div className="space-y-3 rounded-[var(--field-radius)] border border-[var(--panel-border)] bg-[var(--surface-3)] p-4">
              <h4 className="text-sm font-medium text-white">Theme sharing</h4>
              <p className="text-sm text-[var(--soft-text)]">
                Import or export local theme files. Nova does not download themes from the internet.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={() => importTheme()}>
                  <Upload className="mr-2 h-4 w-4" />
                  Import theme
                </Button>
                <Button size="sm" onClick={() => exportTheme()}>
                  <Download className="mr-2 h-4 w-4" />
                  Export theme
                </Button>
              </div>
            </div>
          </div>
        </SettingsSection>
      ) : (
        <>
          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
            <SettingsSection
              title="Appearance"
              aside={
                <Button size="sm" onClick={() => setThemeOpen(true)}>
                  <Magicpen size={18} variant="Bold" className="mr-2" />
                  Open
                </Button>
              }
            >
              <div className="grid gap-3 text-sm text-[var(--soft-text)] sm:grid-cols-3">
                <div>
                  <p className="text-xs text-[var(--muted-text)]">Theme</p>
                  <p className="mt-1 text-white">{activeThemeLabel}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--muted-text)]">Background</p>
                  <p className="mt-1 text-white">{activePatternLabel}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--muted-text)]">Density</p>
                  <p className="mt-1 text-white">{activeDensityLabel}</p>
                </div>
              </div>
            </SettingsSection>

            <SettingsSection
              title="Java"
              aside={
                <Button variant="secondary" size="sm" onClick={() => refreshJava()}>
                  <Refresh size={18} variant="Linear" className="mr-2" />
                  Refresh
                </Button>
              }
            >
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm text-[var(--soft-text)]">Default Java path</label>
                  <Input
                    value={settings.defaultJavaPath}
                    onChange={(event) =>
                      void updateSettings({ defaultJavaPath: event.target.value })
                    }
                    placeholder="Auto-detect if blank"
                  />
                </div>
                {noJavaFound ? (
                  <ErrorCallout
                    title="Java not found"
                    tone="warning"
                    message="Install Java 21 or choose a java.exe path below."
                  />
                ) : null}
                <div className="grid gap-3">
                  {javaInstallations.map((java) => (
                    <div
                      key={java.path}
                      className="rounded-[var(--field-radius)] border border-[var(--panel-border)] bg-[var(--surface-3)] p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm text-white">{java.version}</p>
                        <StatusPill label={`Java ${java.majorVersion}`} tone="info" compact />
                      </div>
                      <p className="mt-2 break-all text-xs text-[var(--muted-text)]">{java.path}</p>
                    </div>
                  ))}
                </div>
              </div>
            </SettingsSection>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <SettingsSection title="Memory">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm text-[var(--soft-text)]">Min RAM (MB)</label>
                  <Input
                    type="number"
                    min={1024}
                    step={512}
                    value={settings.defaultMinMemoryMb}
                    onChange={(event) =>
                      void updateSettings({ defaultMinMemoryMb: Number(event.target.value) })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-[var(--soft-text)]">Max RAM (MB)</label>
                  <Input
                    type="number"
                    min={2048}
                    step={512}
                    value={settings.defaultMaxMemoryMb}
                    onChange={(event) =>
                      void updateSettings({ defaultMaxMemoryMb: Number(event.target.value) })
                    }
                  />
                </div>
              </div>
            </SettingsSection>

            <SettingsSection title="Launcher">
              <div className="grid gap-3">
                <Switch
                  checked={settings.keepLauncherOpen}
                  onCheckedChange={(checked) => void updateSettings({ keepLauncherOpen: checked })}
                  label="Keep launcher open"
                />
                <Switch
                  checked={settings.closeLauncherOnGameStart}
                  onCheckedChange={(checked) =>
                    void updateSettings({ closeLauncherOnGameStart: checked })
                  }
                  label="Close launcher on game start"
                />
                <Switch
                  checked={settings.openConsoleOnGameStart}
                  onCheckedChange={(checked) =>
                    void updateSettings({ openConsoleOnGameStart: checked })
                  }
                  label="Open console on launch"
                />
                <Switch
                  checked={settings.discordRichPresence}
                  onCheckedChange={(checked) =>
                    void updateSettings({ discordRichPresence: checked })
                  }
                  label="Discord Rich Presence"
                />
              </div>
            </SettingsSection>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <SettingsSection
              title="Downloads"
              aside={
                <Button variant="ghost" size="sm" onClick={() => clearDownloadCache()}>
                  <Colorfilter size={18} variant="Linear" className="mr-2" />
                  Clear cache
                </Button>
              }
            >
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-[180px_minmax(0,1fr)]">
                  <div className="space-y-2">
                    <label className="text-sm text-[var(--soft-text)]">Java version</label>
                    <Select value={String(downloadMajor)} onValueChange={(value) => setDownloadMajor(Number(value))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="17">Java 17</SelectItem>
                        <SelectItem value="21">Java 21</SelectItem>
                        <SelectItem value="25">Java 25</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm text-[var(--soft-text)]">Download concurrency</label>
                      <Select
                        value={String(settings.maxParallelDownloads)}
                        onValueChange={(value) =>
                          void updateSettings({ maxParallelDownloads: Number(value) })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {downloadConcurrencyOptions.map((option) => (
                            <SelectItem key={option} value={String(option)}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end">
                      <Switch
                        checked={settings.retryFailedDownloads}
                        onCheckedChange={(checked) =>
                          void updateSettings({ retryFailedDownloads: checked })
                        }
                        label="Retry failed downloads"
                      />
                    </div>
                  </div>
                </div>

                {loadingJavaDownloads ? (
                  <div className="rounded-[var(--field-radius)] border border-[var(--panel-border)] bg-[var(--surface-3)] p-4 text-sm text-[var(--soft-text)]">
                    Loading downloads...
                  </div>
                ) : (
                  <div className="grid gap-4 xl:grid-cols-2">
                    {javaDownloads.map((option) => (
                      <div
                        key={option.id}
                        className="rounded-[var(--field-radius)] border border-[var(--panel-border)] bg-[var(--surface-3)] p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-white">
                              {option.vendor === "adoptium"
                                ? "Eclipse Temurin"
                                : "Microsoft OpenJDK"}
                            </p>
                            <p className="mt-1 text-xs text-[var(--muted-text)]">
                              {option.versionLabel}
                            </p>
                          </div>
                          {option.recommended ? (
                            <StatusPill label="Recommended" tone="info" compact />
                          ) : null}
                        </div>
                        <p className="mt-3 text-sm text-[var(--soft-text)]">
                          {option.packageType.toUpperCase()}
                          {option.sizeBytes ? ` / ${formatBytes(option.sizeBytes)}` : ""}
                        </p>
                        <div className="mt-4">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => void downloadJavaRuntime(option)}
                          >
                            <ImportCurve size={18} variant="Linear" className="mr-2" />
                            Download and install
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </SettingsSection>

            <SettingsSection title="Files">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm text-[var(--soft-text)]">Instance folder</label>
                  <Input
                    value={settings.defaultInstanceRoot}
                    onChange={(event) =>
                      void updateSettings({ defaultInstanceRoot: event.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-[var(--soft-text)]">Cache folder</label>
                  <Input
                    value={settings.downloadCacheRoot}
                    onChange={(event) =>
                      void updateSettings({ downloadCacheRoot: event.target.value })
                    }
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" onClick={() => openDataDirectory()}>
                    <FolderOpen size={18} variant="Linear" className="mr-2" />
                    Open data folder
                  </Button>
                  {logsFolder ? (
                    <Button variant="ghost" size="sm" onClick={() => void openPath(logsFolder)}>
                      <Code size={18} variant="Linear" className="mr-2" />
                      Open logs folder
                    </Button>
                  ) : null}
                </div>
              </div>
            </SettingsSection>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <SettingsSection title="Advanced">
              <div className="grid gap-3">
                <Switch
                  checked={settings.autoScrollConsole}
                  onCheckedChange={(checked) => void updateSettings({ autoScrollConsole: checked })}
                  label="Auto-scroll console"
                />
                <Switch
                  checked={settings.keepFullLogsOnDisk}
                  onCheckedChange={(checked) =>
                    void updateSettings({ keepFullLogsOnDisk: checked })
                  }
                  label="Keep full logs on disk"
                />
                <div className="space-y-2">
                  <label className="text-sm text-[var(--soft-text)]">Performance mode</label>
                  <Select
                    value={settings.performanceMode}
                    onValueChange={(value) =>
                      void updateSettings({ performanceMode: value as PerformanceMode })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {performanceModeOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-[var(--soft-text)]">Console max lines</label>
                  <Select
                    value={String(settings.consoleMaxVisibleLines)}
                    onValueChange={(value) =>
                      void updateSettings({ consoleMaxVisibleLines: Number(value) })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {consoleLineOptions.map((option) => (
                        <SelectItem key={option} value={String(option)}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </SettingsSection>

            <SettingsSection title="About">
              <div className="space-y-4">
                <div className="grid gap-3 text-sm md:grid-cols-2">
                  {aboutRows.map((row) => (
                    <div
                      key={row.label}
                      className="rounded-[var(--field-radius)] border border-[var(--panel-border)] bg-[var(--surface-3)] px-4 py-3"
                    >
                      <p className="text-xs text-[var(--muted-text)]">{row.label}</p>
                      <p className="mt-1 text-white">{row.value}</p>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" onClick={() => openDataDirectory()}>
                    <FolderOpen size={18} variant="Linear" className="mr-2" />
                    Data folder
                  </Button>
                  {logsFolder ? (
                    <Button variant="ghost" size="sm" onClick={() => void openPath(logsFolder)}>
                      <Code size={18} variant="Linear" className="mr-2" />
                      Logs folder
                    </Button>
                  ) : null}
                </div>
              </div>
            </SettingsSection>
          </div>

          {showDeveloperSettings ? (
            <SettingsSection title="Developer" description="Internal tools for local debugging.">
              <div className="grid gap-3">
                <Switch
                  checked={settings.developerMode}
                  onCheckedChange={(checked) => void updateSettings({ developerMode: checked })}
                  label="Developer mode"
                  hint="Opens Chromium DevTools."
                />
                <Switch
                  checked={settings.showAdvancedLaunchCommand}
                  onCheckedChange={(checked) =>
                    void updateSettings({ showAdvancedLaunchCommand: checked })
                  }
                  label="Show launch command"
                />
                <Switch
                  checked={settings.debugLogs}
                  onCheckedChange={(checked) => void updateSettings({ debugLogs: checked })}
                  label="Debug logging"
                />
              </div>
            </SettingsSection>
          ) : null}
        </>
      )}
    </div>
  );
};
