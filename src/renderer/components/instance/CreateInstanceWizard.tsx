import { useEffect, useMemo, useState } from "react";
import type { CreateInstanceInput, LoaderType, LoaderVersionOption, MinecraftVersionOption } from "@shared/types";
import { loaderLabel } from "@renderer/lib/format";
import { useLauncherStore } from "@renderer/state/useLauncherStore";
import { Button } from "../ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "../ui/Dialog";
import { Input } from "../ui/Input";
import { Progress } from "../ui/Progress";
import { ScrollArea } from "../ui/ScrollArea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/Select";
import { Separator } from "../ui/Separator";
import { StatusPill } from "../ui/StatusPill";

type CreateInstanceWizardProps = {
  onClose: () => void;
};

const loaders: LoaderType[] = ["vanilla", "fabric", "forge", "neoforge"];
const moddedLoaders = loaders.filter((loader): loader is Exclude<LoaderType, "vanilla"> => loader !== "vanilla");
const stepLabels = ["Name", "Version", "Loader", "Advanced"];
const loaderDescriptions: Record<LoaderType, string> = {
  vanilla: "Official Minecraft client",
  fabric: "Lightweight mod loader",
  forge: "Classic Forge mod loader",
  neoforge: "Modern Forge-compatible loader"
};

export const CreateInstanceWizard = ({ onClose }: CreateInstanceWizardProps) => {
  const createInstance = useLauncherStore((state) => state.createInstance);
  const listVersions = useLauncherStore((state) => state.listMinecraftVersions);
  const listLoaders = useLauncherStore((state) => state.listLoaderVersions);
  const settings = useLauncherStore((state) => state.settings);
  const [versions, setVersions] = useState<MinecraftVersionOption[]>([]);
  const [loaderVersionMap, setLoaderVersionMap] = useState<Record<Exclude<LoaderType, "vanilla">, LoaderVersionOption[]>>({
    fabric: [],
    forge: [],
    neoforge: []
  });
  const [loaderMessages, setLoaderMessages] = useState<Partial<Record<LoaderType, string>>>({});
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [loadingLoaders, setLoadingLoaders] = useState(false);
  const [form, setForm] = useState<CreateInstanceInput>({
    name: "New Nova Instance",
    minecraftVersion: "",
    loader: "vanilla",
    javaPath: settings.defaultJavaPath || undefined,
    memoryMinMb: settings.defaultMinMemoryMb,
    memoryMaxMb: settings.defaultMaxMemoryMb,
    notes: ""
  });

  useEffect(() => {
    void listVersions().then((items) => {
      setVersions(items);
      const latestRelease = items.find((item) => item.type === "release")?.id;
      if (latestRelease) {
        setForm((current) => ({ ...current, minecraftVersion: current.minecraftVersion || latestRelease }));
      }
    });
  }, [listVersions]);

  useEffect(() => {
    if (!form.minecraftVersion) {
      setLoaderVersionMap({ fabric: [], forge: [], neoforge: [] });
      setLoaderMessages({});
      setForm((current) => ({ ...current, loader: "vanilla", loaderVersion: undefined }));
      return;
    }

    let cancelled = false;
    setLoadingLoaders(true);

    void Promise.allSettled(
      moddedLoaders.map(async (loader) => ({
        loader,
        items: await listLoaders(loader, form.minecraftVersion)
      }))
    )
      .then((results) => {
        if (cancelled) {
          return;
        }

        const nextMap: Record<Exclude<LoaderType, "vanilla">, LoaderVersionOption[]> = {
          fabric: [],
          forge: [],
          neoforge: []
        };
        const nextMessages: Partial<Record<LoaderType, string>> = {};

        results.forEach((result, index) => {
          const loader = moddedLoaders[index];
          if (result.status === "fulfilled") {
            nextMap[loader] = result.value.items;
            if (result.value.items.length === 0) {
              nextMessages[loader] = `No ${loaderLabel(loader)} builds found for Minecraft ${form.minecraftVersion}.`;
            }
          } else {
            nextMessages[loader] = `Could not load ${loaderLabel(loader)} versions right now.`;
          }
        });

        setLoaderVersionMap(nextMap);
        setLoaderMessages(nextMessages);
        setForm((current) => {
          if (current.loader === "vanilla") {
            return { ...current, loaderVersion: undefined };
          }

          const availableVersions = nextMap[current.loader];
          if (availableVersions.length === 0) {
            return { ...current, loader: "vanilla", loaderVersion: undefined };
          }

          const nextLoaderVersion =
            current.loaderVersion && availableVersions.some((item) => item.id === current.loaderVersion)
              ? current.loaderVersion
              : availableVersions.find((item) => item.recommended)?.id ?? availableVersions[0]?.id;

          return {
            ...current,
            loaderVersion: nextLoaderVersion
          };
        });
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingLoaders(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [form.minecraftVersion, listLoaders]);

  const activeLoaderVersions = useMemo(
    () => (form.loader === "vanilla" ? [] : loaderVersionMap[form.loader] ?? []),
    [form.loader, loaderVersionMap]
  );

  useEffect(() => {
    if (form.loader === "vanilla") {
      if (form.loaderVersion) {
        setForm((current) => ({ ...current, loaderVersion: undefined }));
      }
      return;
    }

    if (activeLoaderVersions.length === 0) {
      if (form.loaderVersion) {
        setForm((current) => ({ ...current, loaderVersion: undefined }));
      }
      return;
    }

    if (form.loaderVersion && activeLoaderVersions.some((item) => item.id === form.loaderVersion)) {
      return;
    }

    setForm((current) => ({
      ...current,
      loaderVersion:
        activeLoaderVersions.find((item) => item.recommended)?.id ?? activeLoaderVersions[0]?.id
    }));
  }, [activeLoaderVersions, form.loader, form.loaderVersion]);

  const next = async () => {
    if (step < stepLabels.length - 1) {
      setStep((value) => value + 1);
      return;
    }
    setSubmitting(true);
    await createInstance(form);
    setSubmitting(false);
    onClose();
  };

  const canContinue =
    (step === 0 && form.name.trim().length > 0) ||
    (step === 1 && Boolean(form.minecraftVersion)) ||
    (step === 2 && (form.loader === "vanilla" || Boolean(form.loaderVersion))) ||
    step === 3;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Create instance</DialogTitle>
          <DialogDescription>Name it, choose Minecraft, pick a loader, then adjust memory if needed.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          {stepLabels.map((label, index) => (
            <StatusPill key={label} label={`${index + 1}. ${label}`} tone={index === step ? "info" : "neutral"} compact />
          ))}
        </div>
        <Progress value={((step + 1) / stepLabels.length) * 100} />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="space-y-4">
            {step === 0 ? (
              <>
                <div className="space-y-2">
                  <label className="text-sm text-[var(--soft-text)]">Name</label>
                  <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-[var(--soft-text)]">Notes</label>
                  <textarea
                    value={form.notes}
                    onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                    className="min-h-28 w-full rounded-[var(--field-radius)] border border-[var(--panel-border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-white outline-none focus:border-[var(--accent-border)] focus:ring-2 focus:ring-[var(--accent-ring)]"
                  />
                </div>
              </>
            ) : null}

            {step === 1 ? (
              <ScrollArea className="h-[340px] rounded-[var(--field-radius)] border border-[var(--panel-border)] bg-[var(--surface-2)] p-1">
                <div className="grid gap-2 p-3 md:grid-cols-2">
                  {versions.map((version) => (
                    <button
                      key={version.id}
                      type="button"
                      onClick={() => setForm((current) => ({ ...current, minecraftVersion: version.id }))}
                      className={`rounded-md border px-3 py-3 text-left text-sm transition ${
                        form.minecraftVersion === version.id
                          ? "border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent-text)] shadow-[var(--button-shadow-subtle)]"
                          : "border-[var(--panel-border)] bg-[var(--surface-1)] text-[var(--soft-text)] hover:bg-[var(--surface-3)]"
                      }`}
                    >
                      <p className="font-medium text-white">{version.id}</p>
                      <p className="mt-1 text-xs text-[var(--muted-text)]">{version.type}</p>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            ) : null}

            {step === 2 ? (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  {loaders.map((loader) => {
                    const available = loader === "vanilla" ? true : (loaderVersionMap[loader]?.length ?? 0) > 0;
                    const helper = loader === "vanilla" ? loaderDescriptions[loader] : loaderMessages[loader] ?? loaderDescriptions[loader];

                    return (
                      <button
                        key={loader}
                        type="button"
                        onClick={() => {
                          if (!available) return;
                          setForm((current) => ({ ...current, loader, loaderVersion: undefined }));
                        }}
                        disabled={!available}
                        className={`rounded-md border p-4 text-left text-sm transition ${
                          form.loader === loader
                            ? "border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent-text)] shadow-[var(--button-shadow-subtle)]"
                            : available
                              ? "border-[var(--panel-border)] bg-[var(--surface-1)] text-[var(--soft-text)] hover:bg-[var(--surface-3)]"
                              : "border-[var(--panel-border)] bg-[var(--surface-2)] text-[var(--muted-text)] opacity-70"
                        }`}
                      >
                        <p className="font-medium text-white">{loaderLabel(loader)}</p>
                        <p className="mt-1 text-xs text-[var(--muted-text)]">{helper}</p>
                      </button>
                    );
                  })}
                </div>

                {form.loader !== "vanilla" ? (
                  <div className="space-y-2">
                    <label className="text-sm text-[var(--soft-text)]">Loader version</label>
                    {activeLoaderVersions.length > 0 ? (
                      <Select value={form.loaderVersion ?? ""} onValueChange={(value) => setForm((current) => ({ ...current, loaderVersion: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select loader version" />
                        </SelectTrigger>
                        <SelectContent>
                          {activeLoaderVersions.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.id}{item.recommended ? " (recommended)" : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="rounded-[var(--field-radius)] border border-[var(--panel-border)] bg-[var(--surface-2)] px-3 py-3 text-sm text-[var(--soft-text)]">
                        {loadingLoaders
                          ? "Loading loader versions..."
                          : loaderMessages[form.loader] ?? `No ${loaderLabel(form.loader)} builds found for Minecraft ${form.minecraftVersion}.`}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}

            {step === 3 ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm text-[var(--soft-text)]">Min RAM (MB)</label>
                  <Input
                    type="number"
                    min={1024}
                    step={512}
                    value={form.memoryMinMb}
                    onChange={(event) => setForm((current) => ({ ...current, memoryMinMb: Number(event.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-[var(--soft-text)]">Max RAM (MB)</label>
                  <Input
                    type="number"
                    min={2048}
                    step={512}
                    value={form.memoryMaxMb}
                    onChange={(event) => setForm((current) => ({ ...current, memoryMaxMb: Number(event.target.value) }))}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm text-[var(--soft-text)]">Java path override</label>
                  <Input
                    value={form.javaPath ?? ""}
                    onChange={(event) => setForm((current) => ({ ...current, javaPath: event.target.value || undefined }))}
                    placeholder="Optional"
                  />
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-[var(--field-radius)] border border-[var(--panel-border)] bg-[var(--surface-2)] p-4">
            <p className="text-sm font-medium text-white">{form.name || "New instance"}</p>
            <p className="mt-1 text-xs text-[var(--muted-text)]">Summary</p>
            <Separator className="my-4" />
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-[var(--muted-text)]">Version</p>
                <p className="text-white">{form.minecraftVersion || "Select a version"}</p>
              </div>
              <div>
                <p className="text-[var(--muted-text)]">Loader</p>
                <p className="text-white">
                  {loaderLabel(form.loader)}
                  {form.loaderVersion ? ` / ${form.loaderVersion}` : ""}
                </p>
                <p className="mt-1 text-xs text-[var(--muted-text)]">{loaderDescriptions[form.loader]}</p>
              </div>
              <div>
                <p className="text-[var(--muted-text)]">Memory</p>
                <p className="text-white">
                  {form.memoryMinMb} / {form.memoryMaxMb} MB
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setStep((value) => Math.max(0, value - 1))} disabled={step === 0 || submitting}>
            Back
          </Button>
          <Button onClick={() => void next()} disabled={!canContinue || submitting}>
            {step === stepLabels.length - 1 ? (submitting ? "Creating..." : "Create") : "Continue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
