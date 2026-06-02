import { useEffect, useMemo, type CSSProperties, type PropsWithChildren } from "react";
import { resolveThemeDefinition, themeTokensToCssVars } from "@shared/themes";
import { useLauncherStore } from "@renderer/state/useLauncherStore";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { DownloadDrawer } from "./DownloadDrawer";

export const ShellLayout = ({ children }: PropsWithChildren) => {
  const settings = useLauncherStore((state) => state.settings);
  const performanceModeEnabled = useLauncherStore((state) => state.performanceModeEnabled);
  const activeTheme = useMemo(
    () => resolveThemeDefinition(settings.theme, settings.importedThemes),
    [settings.importedThemes, settings.theme]
  );
  const themeVars = useMemo(() => themeTokensToCssVars(activeTheme.tokens), [activeTheme.tokens]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", activeTheme.id);
    for (const [name, value] of Object.entries(themeVars)) {
      document.documentElement.style.setProperty(name, value);
    }
  }, [activeTheme.id, themeVars]);

  const style = {
    ...themeVars,
    "--background-strength": String(settings.backgroundStrength),
    "--border-strength": String(settings.borderStrength),
    "--corner-radius-base": `${settings.cornerRadius}px`
  } as CSSProperties;

  return (
    <div
      data-theme={activeTheme.id}
      data-pattern={settings.backgroundPattern}
      data-density={settings.uiDensity}
      data-performance-mode={performanceModeEnabled ? "on" : "off"}
      data-reduced-motion={settings.reducedMotion ? "on" : "off"}
      data-animated-background={settings.disableAnimatedBackgrounds ? "off" : "on"}
      className="nova-shell flex h-screen overflow-hidden text-white"
      style={style}
    >
      <Sidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto px-[var(--page-padding-x)] py-[var(--page-padding-y)] pb-28">
          {children}
        </main>
        <DownloadDrawer />
      </div>
    </div>
  );
};
