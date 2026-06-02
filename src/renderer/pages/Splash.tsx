import type { BootstrapStep } from "@shared/types";
import { brandAssets } from "@renderer/lib/brand";
import { ProgressBar } from "@renderer/components/ui/ProgressBar";

type SplashProps = {
  steps: BootstrapStep[];
  activeIndex: number;
};

export const Splash = ({ steps, activeIndex }: SplashProps) => {
  const progress = ((activeIndex + 1) / Math.max(steps.length, 1)) * 100;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--shell-bg)]">
      <div className="w-full max-w-xl px-6">
        <div className="mx-auto grid place-items-center">
          <img src={brandAssets.blackBgLogo} alt="Nova Launcher" className="h-44 w-44 rounded-[2.5rem]" />
        </div>
        <div className="mt-10 rounded-4xl border border-[var(--panel-border)] bg-[var(--surface-3)] p-6">
          <p className="text-xs uppercase tracking-[0.28em] text-nova-400">Nova Launcher</p>
          <h2 className="mt-3 text-2xl font-semibold text-white">Preparing your launcher</h2>
          <p className="mt-2 text-sm text-nova-300">{steps[activeIndex]?.label ?? "Loading your workspace"}</p>
          <ProgressBar value={progress} className="mt-6" />
          <div className="mt-5 grid gap-2">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center justify-between text-sm">
                <span className={index <= activeIndex ? "text-white" : "text-nova-500"}>{step.label}</span>
                <span className={index < activeIndex ? "text-white" : "text-nova-500"}>
                  {index < activeIndex ? "Done" : index === activeIndex ? "Running" : "Queued"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
