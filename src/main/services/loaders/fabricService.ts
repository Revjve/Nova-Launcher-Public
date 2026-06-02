import type { LoaderVersionOption } from "../../../shared/types";

type FabricLoaderResponse = Array<{
  loader: { version: string; stable: boolean };
}>;

export class FabricService {
  private readonly cache = new Map<string, { expiresAt: number; value: LoaderVersionOption[] }>();
  private readonly inFlight = new Map<string, Promise<LoaderVersionOption[]>>();

  async listVersions(minecraftVersion: string): Promise<LoaderVersionOption[]> {
    const cached = this.cache.get(minecraftVersion);
    if (cached && cached.expiresAt > Date.now()) {
      return [...cached.value];
    }

    const existing = this.inFlight.get(minecraftVersion);
    if (existing) {
      return existing.then((value) => [...value]);
    }

    const request = (async () => {
      const response = await fetch(`https://meta.fabricmc.net/v2/versions/loader/${minecraftVersion}`);

      if (!response.ok) {
        throw new Error("Unable to fetch Fabric versions.");
      }

      const payload = (await response.json()) as FabricLoaderResponse;
      const baseVersions = payload.map((entry) => ({
        id: entry.loader.version,
        minecraftVersion,
        stable: entry.loader.stable
      }));

      const stable = baseVersions.filter((entry) => entry.stable);
      const unstable = baseVersions.filter((entry) => !entry.stable);
      const ordered = [...stable, ...unstable];
      const recommendedId = stable[0]?.id ?? ordered[0]?.id;

      const versions = ordered.map((entry) => ({
        ...entry,
        recommended: entry.id === recommendedId
      }));
      this.cache.set(minecraftVersion, {
        value: versions,
        expiresAt: Date.now() + 10 * 60_000
      });
      return versions;
    })().finally(() => {
      this.inFlight.delete(minecraftVersion);
    });

    this.inFlight.set(minecraftVersion, request);
    return request.then((value) => [...value]);
  }
}
