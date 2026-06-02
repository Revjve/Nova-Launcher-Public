import type { LoaderVersionOption } from "../../../shared/types";

const extractVersions = (xml: string) =>
  [...xml.matchAll(/<version>([^<]+)<\/version>/g)].map((match) => match[1]);

const parseVersionParts = (value: string) =>
  value
    .split(/[.-]/)
    .map((part) => Number.parseInt(part, 10))
    .filter((part) => Number.isFinite(part));

const compareVersions = (left: string, right: string) => {
  const a = parseVersionParts(left);
  const b = parseVersionParts(right);
  const limit = Math.max(a.length, b.length);

  for (let index = 0; index < limit; index += 1) {
    const diff = (a[index] ?? 0) - (b[index] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }

  return 0;
};

const toNeoForgePrefix = (minecraftVersion: string) => {
  const normalized = minecraftVersion.replace(/^1\./, "");
  const parts = normalized.split(".");
  if (parts.length === 1) {
    return `${normalized}.0`;
  }
  return normalized;
};

export class NeoForgeService {
  private cache?: { expiresAt: number; value: string[] };
  private inFlight?: Promise<string[]>;

  private async getVersions(): Promise<string[]> {
    if (this.cache && this.cache.expiresAt > Date.now()) {
      return this.cache.value;
    }

    if (this.inFlight) {
      return this.inFlight;
    }

    this.inFlight = (async () => {
      const response = await fetch(
        "https://maven.neoforged.net/releases/net/neoforged/neoforge/maven-metadata.xml"
      );

      if (!response.ok) {
        throw new Error("Unable to fetch NeoForge versions.");
      }

      const xml = await response.text();
      const versions = extractVersions(xml);
      this.cache = {
        value: versions,
        expiresAt: Date.now() + 10 * 60_000
      };
      return versions;
    })().finally(() => {
      this.inFlight = undefined;
    });

    return this.inFlight;
  }

  async listVersions(minecraftVersion: string): Promise<LoaderVersionOption[]> {
    const prefix = toNeoForgePrefix(minecraftVersion);
    const versions = (await this.getVersions())
      .filter((version) => version.startsWith(`${prefix}.`) || version.startsWith(`${prefix}-`))
      .sort((left, right) => compareVersions(right, left))
      .slice(0, 30);

    const recommendedId = versions.find((version) => !version.includes("beta")) ?? versions[0];

    return versions
      .map((version) => ({
        id: version,
        minecraftVersion,
        stable: !version.includes("beta"),
        recommended: version === recommendedId
      }))
      .sort((left, right) => {
        if (left.recommended && !right.recommended) return -1;
        if (!left.recommended && right.recommended) return 1;
        if (left.stable && !right.stable) return -1;
        if (!left.stable && right.stable) return 1;
        return compareVersions(right.id, left.id);
      });
  }
}
