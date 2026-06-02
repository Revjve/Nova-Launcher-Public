import { Suspense, lazy, useEffect } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ShellLayout } from "./components/layout/ShellLayout";
import { Button } from "./components/ui/Button";
import { Card } from "./components/ui/Card";
import { ErrorBoundary } from "./components/ui/ErrorBoundary";
import { AppToaster } from "./components/ui/Toaster";
import { useLauncherStore } from "./state/useLauncherStore";
import { Splash } from "./pages/Splash";

const Home = lazy(() => import("./pages/Home").then((module) => ({ default: module.Home })));
const Accounts = lazy(() => import("./pages/Accounts").then((module) => ({ default: module.Accounts })));
const Instances = lazy(() => import("./pages/Instances").then((module) => ({ default: module.Instances })));
const InstanceDetail = lazy(() =>
  import("./pages/InstanceDetail").then((module) => ({ default: module.InstanceDetail }))
);
const ModBrowser = lazy(() => import("./pages/ModBrowser").then((module) => ({ default: module.ModBrowser })));
const Downloads = lazy(() => import("./pages/Downloads").then((module) => ({ default: module.Downloads })));
const Settings = lazy(() => import("./pages/Settings").then((module) => ({ default: module.Settings })));

const PageFallback = () => (
  <div className="space-y-4">
    <div className="h-8 w-40 rounded-2xl bg-[var(--surface-3)]" />
    <div className="h-40 rounded-3xl bg-[var(--surface-3)]" />
    <div className="h-64 rounded-3xl bg-[var(--surface-3)]" />
  </div>
);

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const booting = useLauncherStore((state) => state.booting);
  const bootSteps = useLauncherStore((state) => state.bootSteps);
  const bootStepIndex = useLauncherStore((state) => state.bootStepIndex);
  const booted = useLauncherStore((state) => state.booted);
  const bootError = useLauncherStore((state) => state.bootError);
  const banner = useLauncherStore((state) => state.banner);
  const dismissBanner = useLauncherStore((state) => state.dismissBanner);
  const pendingRoute = useLauncherStore((state) => state.pendingRoute);
  const consumePendingRoute = useLauncherStore((state) => state.consumePendingRoute);

  useEffect(() => {
    void useLauncherStore.getState().bootstrap();
  }, []);

  useEffect(() => {
    if (!pendingRoute) {
      return;
    }
    navigate(pendingRoute);
    consumePendingRoute();
  }, [consumePendingRoute, navigate, pendingRoute]);

  useEffect(() => {
    if (!banner) {
      return;
    }

    if (banner.type === "error") {
      toast.error(banner.text);
    } else if (banner.type === "success") {
      toast.success(banner.text);
    } else {
      toast.message(banner.text);
    }

    dismissBanner();
  }, [banner, dismissBanner]);

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return;
    }

    const startedAt = performance.now();
    const frame = requestAnimationFrame(() => {
      console.info("[nova][perf] route ready", {
        path: location.pathname,
        renderMs: Math.round(performance.now() - startedAt)
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [location.pathname]);

  return (
    <>
      {booting ? <Splash steps={bootSteps} activeIndex={bootStepIndex} /> : null}

      {booted ? (
        <ErrorBoundary>
          <ShellLayout>
            <Suspense fallback={<PageFallback />}>
              <div className="min-h-full min-w-0">
                <Routes location={location}>
                  <Route path="/" element={<Home />} />
                  <Route path="/instances" element={<Instances />} />
                  <Route path="/instances/:instanceId" element={<InstanceDetail />} />
                  <Route path="/mods" element={<ModBrowser />} />
                  <Route path="/accounts" element={<Accounts />} />
                  <Route path="/console" element={<Downloads />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/discover" element={<Navigate to="/mods" replace />} />
                  <Route path="/downloads" element={<Navigate to="/console" replace />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </div>
            </Suspense>
          </ShellLayout>
        </ErrorBoundary>
      ) : null}

      {!booting && !booted && bootError ? (
        <div className="fixed inset-0 grid place-items-center bg-[var(--shell-bg)] px-6">
          <Card className="w-full max-w-2xl p-8">
            <p className="text-sm font-medium text-[var(--muted-text)]">Launcher error</p>
            <h2 className="mt-3 text-3xl font-semibold text-white">Nova could not finish starting.</h2>
            <p className="mt-4 text-sm leading-7 text-[var(--soft-text)]">{bootError}</p>
            <div className="mt-6 flex gap-3">
              <Button onClick={() => void useLauncherStore.getState().bootstrap()}>Retry</Button>
            </div>
          </Card>
        </div>
      ) : null}
      <AppToaster />
    </>
  );
}
