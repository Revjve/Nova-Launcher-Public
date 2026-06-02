import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { DEFAULT_SETTINGS, sanitizeLauncherSettings } from "../../../shared/constants";
import type {
  CreateInstanceInput,
  Instance,
  InstancePaths,
  LauncherDataFile,
  LauncherSettings,
  LauncherAccount
} from "../../../shared/types";
import { JsonStore } from "./jsonStore";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "instance";

export const createInstancePaths = (root: string): InstancePaths => ({
  root,
  mods: join(root, "mods"),
  resourcepacks: join(root, "resourcepacks"),
  shaderpacks: join(root, "shaderpacks"),
  screenshots: join(root, "screenshots"),
  saves: join(root, "saves"),
  logs: join(root, "logs")
});

export const createSeedInstance = (
  input: CreateInstanceInput,
  defaultRoot: string
): Instance => {
  const createdAt = new Date().toISOString();
  const instanceRoot = join(defaultRoot, `${slugify(input.name)}-${crypto.randomUUID().slice(0, 8)}`);

  return {
    id: crypto.randomUUID(),
    name: input.name,
    icon: input.icon,
    minecraftVersion: input.minecraftVersion,
    loader: input.loader,
    loaderVersion: input.loaderVersion,
    gameDir: instanceRoot,
    javaPath: input.javaPath,
    memoryMinMb: input.memoryMinMb,
    memoryMaxMb: input.memoryMaxMb,
    createdAt,
    lastPlayedAt: undefined,
    notes: input.notes,
    description: "A polished instance scaffolded by Nova Launcher.",
    pinned: true,
    favorite: true,
    lastLaunchStatus: "idle",
    installStatus: "not-installed",
    paths: createInstancePaths(instanceRoot)
  };
};

export class LauncherRepository {
  private readonly store: JsonStore<LauncherDataFile>;
  private cache?: LauncherDataFile;

  constructor(private readonly userDataPath: string) {
    this.store = new JsonStore<LauncherDataFile>(join(userDataPath, "launcher-data.json"));
  }

  private buildDefaultSettings(): LauncherSettings {
    return {
      ...DEFAULT_SETTINGS,
      defaultInstanceRoot: join(this.userDataPath, "instances"),
      downloadCacheRoot: join(this.userDataPath, "cache")
    };
  }

  private async ensureInitialData(): Promise<LauncherDataFile> {
    const settings = this.buildDefaultSettings();
    await mkdir(settings.defaultInstanceRoot, { recursive: true });
    await mkdir(settings.downloadCacheRoot, { recursive: true });

    const starter = createSeedInstance(
      {
        name: "Nova Vanilla",
        minecraftVersion: "1.21.5",
        loader: "vanilla",
        memoryMinMb: 2048,
        memoryMaxMb: 4096,
        notes: "Ready to play."
      },
      settings.defaultInstanceRoot
    );

    const data: LauncherDataFile = {
      accounts: [],
      instances: [starter],
      settings
    };

    this.cache = data;
    await this.store.write(data);
    return structuredClone(data);
  }

  async getData(): Promise<LauncherDataFile> {
    if (this.cache) {
      return structuredClone(this.cache);
    }

    const stored = await this.store.read();

    if (!stored) {
      return this.ensureInitialData();
    }

    const defaults = this.buildDefaultSettings();
    const next: LauncherDataFile = {
      accounts: stored.accounts ?? [],
      instances: stored.instances ?? [],
      settings: sanitizeLauncherSettings(stored.settings as Record<string, unknown> | undefined, defaults)
    };

    this.cache = next;
    return structuredClone(next);
  }

  async writeData(data: LauncherDataFile): Promise<LauncherDataFile> {
    this.cache = structuredClone(data);
    await this.store.write(data);
    return structuredClone(data);
  }

  async mutate(
    mutator: (data: LauncherDataFile) => Promise<LauncherDataFile> | LauncherDataFile
  ): Promise<LauncherDataFile> {
    const current = await this.getData();
    const next = await mutator(current);
    return this.writeData(next);
  }

  async setAccounts(accounts: LauncherAccount[]): Promise<LauncherAccount[]> {
    const data = await this.mutate((current) => ({ ...current, accounts }));
    return data.accounts;
  }

  async setSettings(settings: LauncherSettings): Promise<LauncherSettings> {
    const normalized = sanitizeLauncherSettings(settings, this.buildDefaultSettings());
    const data = await this.mutate((current) => ({ ...current, settings: normalized }));
    return data.settings;
  }
}
