import type { MinecraftVersionOption } from "../../../shared/types";

type MojangManifest = {
  versions: Array<{
    id: string;
    type: MinecraftVersionOption["type"];
    releaseTime: string;
  }>;
};

export class VersionManifestService {
  private cache?: { expiresAt: number; value: MinecraftVersionOption[] };
  private inFlight?: Promise<MinecraftVersionOption[]>;

  async listVersions(): Promise<MinecraftVersionOption[]> {
    if (this.cache && this.cache.expiresAt > Date.now()) {
      return [...this.cache.value];
    }

    if (this.inFlight) {
      return this.inFlight.then((value) => [...value]);
    }

    this.inFlight = (async () => {
    const response = await fetch("https://piston-meta.mojang.com/mc/game/version_manifest_v2.json");

    if (!response.ok) {
      throw new Error("Unable to fetch the Minecraft version manifest.");
    }

    const manifest = (await response.json()) as MojangManifest;
      const versions = manifest.versions.slice(0, 80).map((version) => ({
        id: version.id,
        type: version.type,
        releaseTime: version.releaseTime
      }));
      this.cache = {
        value: versions,
        expiresAt: Date.now() + 5 * 60_000
      };
      return versions;
    })().finally(() => {
      this.inFlight = undefined;
    });

    return this.inFlight.then((value) => [...value]);
  }
}
