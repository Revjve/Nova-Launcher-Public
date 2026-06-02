import type { LoaderVersionOption } from "../../../shared/types";

type ForgePromotions = {
  promos: Record<string, string>;
};

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

export class ForgeService {
  private promotionsCache?: { expiresAt: number; value: ForgePromotions };
  private promotionsInFlight?: Promise<ForgePromotions>;
  private metadataCache?: { expiresAt: number; value: string[] };
  private metadataInFlight?: Promise<string[]>;

  private async getPromotions(): Promise<ForgePromotions> {
    if (this.promotionsCache && this.promotionsCache.expiresAt > Date.now()) {
      return this.promotionsCache.value;
    }

    if (this.promotionsInFlight) {
      return this.promotionsInFlight;
    }

    this.promotionsInFlight = (async () => {
      const response = await fetch(
        "https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json"
      );

      if (!response.ok) {
        throw new Error("Unable to fetch Forge promotions.");
      }

      const payload = (await response.json()) as ForgePromotions;
      this.promotionsCache = {
        value: payload,
        expiresAt: Date.now() + 10 * 60_000
      };
      return payload;
    })().finally(() => {
      this.promotionsInFlight = undefined;
    });

    return this.promotionsInFlight;
  }

  private async getMetadataVersions(): Promise<string[]> {
    if (this.metadataCache && this.metadataCache.expiresAt > Date.now()) {
      return this.metadataCache.value;
    }

    if (this.metadataInFlight) {
      return this.metadataInFlight;
    }

    this.metadataInFlight = (async () => {
      const response = await fetch(
        "https://maven.minecraftforge.net/net/minecraftforge/forge/maven-metadata.xml"
      );

      if (!response.ok) {
        throw new Error("Unable to fetch Forge versions.");
      }

      const versions = extractVersions(await response.text());
      this.metadataCache = {
        value: versions,
        expiresAt: Date.now() + 10 * 60_000
      };
      return versions;
    })().finally(() => {
      this.metadataInFlight = undefined;
    });

    return this.metadataInFlight;
  }

  async listVersions(minecraftVersion: string): Promise<LoaderVersionOption[]> {
    const [versions, promotions] = await Promise.all([
      this.getMetadataVersions(),
      this.getPromotions().catch(() => ({ promos: {} }))
    ]);
    const prefix = `${minecraftVersion}-`;
    const promotionEntries = Object.entries(promotions.promos).filter(([key]) => key.startsWith(prefix));
    const recommendedId = promotionEntries.find(([key]) => key.endsWith("-recommended"))?.[1];
    const latestId = promotionEntries.find(([key]) => key.endsWith("-latest"))?.[1];
    const installableVersions = new Set(
      versions
        .filter((value) => value.startsWith(prefix))
        .map((value) => value.slice(prefix.length))
    );

    for (const [, value] of promotionEntries) {
      installableVersions.add(value);
    }

    return [...installableVersions]
      .map((id) => ({
        id,
        minecraftVersion,
        stable: true,
        recommended: id === recommendedId,
        releaseTime: id === latestId ? "latest" : undefined
      }))
      .sort((left, right) => {
        if (left.recommended && !right.recommended) return -1;
        if (!left.recommended && right.recommended) return 1;
        return compareVersions(right.id, left.id);
      });
  }
}
