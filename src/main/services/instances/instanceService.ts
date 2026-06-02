import { cp, mkdir, rm } from "node:fs/promises";
import { basename, join } from "node:path";
import type { CreateInstanceInput, Instance, UpdateInstanceInput } from "../../../shared/types";
import {
  LauncherRepository,
  createInstancePaths,
  createSeedInstance
} from "../storage/launcherRepository";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "instance";

export class InstanceService {
  constructor(private readonly repository: LauncherRepository) {}

  async list(): Promise<Instance[]> {
    const data = await this.repository.getData();
    return data.instances;
  }

  async get(instanceId: string): Promise<Instance> {
    const data = await this.repository.getData();
    const instance = data.instances.find((item) => item.id === instanceId);

    if (!instance) {
      throw new Error("Instance not found.");
    }

    return instance;
  }

  async create(input: CreateInstanceInput): Promise<Instance> {
    const data = await this.repository.getData();
    const instance = createSeedInstance(input, data.settings.defaultInstanceRoot);
    await this.ensurePaths(instance);

    await this.repository.writeData({
      ...data,
      instances: [instance, ...data.instances]
    });

    return instance;
  }

  async update(instanceId: string, patch: UpdateInstanceInput): Promise<Instance> {
    const data = await this.repository.getData();
    const nextInstances = data.instances.map((instance) => {
      if (instance.id !== instanceId) {
        return instance;
      }

      const nextName = patch.name ?? instance.name;
      const nextRoot =
        patch.name && patch.name !== instance.name
          ? join(data.settings.defaultInstanceRoot, `${slugify(nextName)}-${instance.id.slice(0, 8)}`)
          : instance.paths.root;

      return {
        ...instance,
        ...patch,
        name: nextName,
        gameDir: nextRoot,
        paths: createInstancePaths(nextRoot)
      };
    });

    const updated = nextInstances.find((item) => item.id === instanceId);
    if (!updated) {
      throw new Error("Instance not found.");
    }

    await this.ensurePaths(updated);
    await this.repository.writeData({ ...data, instances: nextInstances });
    return updated;
  }

  async duplicate(instanceId: string): Promise<Instance> {
    const source = await this.get(instanceId);
    const data = await this.repository.getData();
    const clone = createSeedInstance(
      {
        name: `${source.name} Copy`,
        icon: source.icon,
        minecraftVersion: source.minecraftVersion,
        loader: source.loader,
        loaderVersion: source.loaderVersion,
        memoryMinMb: source.memoryMinMb,
        memoryMaxMb: source.memoryMaxMb,
        javaPath: source.javaPath,
        notes: source.notes
      },
      data.settings.defaultInstanceRoot
    );

    await this.ensurePaths(clone);
    await cp(source.paths.root, clone.paths.root, { recursive: true, force: true }).catch(() => undefined);
    await this.repository.writeData({
      ...data,
      instances: [clone, ...data.instances]
    });

    return clone;
  }

  async delete(instanceId: string): Promise<boolean> {
    const instance = await this.get(instanceId);
    const data = await this.repository.getData();
    await rm(instance.paths.root, { recursive: true, force: true });

    await this.repository.writeData({
      ...data,
      instances: data.instances.filter((item) => item.id !== instanceId)
    });

    return true;
  }

  async repair(instanceId: string): Promise<Instance> {
    const instance = await this.get(instanceId);
    await this.ensurePaths(instance);
    return instance;
  }

  async ensurePaths(instance: Instance): Promise<void> {
    await mkdir(instance.paths.root, { recursive: true });
    await Promise.all(
      Object.values(instance.paths).map((target) => mkdir(target, { recursive: true }))
    );
    await mkdir(join(instance.paths.root, basename(instance.paths.logs)), { recursive: true });
  }
}
