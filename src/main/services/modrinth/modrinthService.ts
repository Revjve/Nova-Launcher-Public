import type {
  ModCompatibilityLoader,
  ModReleaseChannel,
  ModrinthVersionOption,
  ModSearchFilters,
  ModSearchResult,
  PaginatedModSearchResult
} from "../../../shared/types";
import { normalizeModSearchResult } from "../../../shared/modSearch";

type ModrinthSearchResponse = {
  total_hits?: number;
  hits: Array<{
    project_id: string;
    slug: string;
    title: string;
    author?: string;
    description: string;
    icon_url?: string;
    downloads: number;
    follows: number;
    categories: string[];
    display_categories?: string[];
    versions: string[];
    loaders: ModCompatibilityLoader[];
  }>;
};

type ModrinthDependency = {
  project_id?: string;
  version_id?: string;
  dependency_type: "required" | "optional" | "embedded" | "incompatible";
};

type ModrinthVersionFile = {
  filename: string;
  primary: boolean;
  url: string;
  hashes: { sha1?: string; sha512?: string };
  size: number;
};

type ModrinthVersion = {
  id: string;
  project_id?: string;
  project_slug?: string;
  name: string;
  version_number: string;
  version_type?: ModReleaseChannel;
  featured?: boolean;
  date_published?: string;
  loaders: ModCompatibilityLoader[];
  game_versions: string[];
  dependencies: ModrinthDependency[];
  files: ModrinthVersionFile[];
};

export type ResolvedModrinthVersion = {
  projectId?: string;
  versionId: string;
  name: string;
  versionNumber: string;
  fileName: string;
  fileUrl: string;
  sha1?: string;
  sha512?: string;
  fileSize?: number;
  projectSlug?: string;
  loaders: ModCompatibilityLoader[];
  gameVersions: string[];
  versionType: ModReleaseChannel;
  featured: boolean;
  publishedAt?: string;
  dependencies: ModrinthDependency[];
};

const releasePriority: Record<ModReleaseChannel, number> = {
  release: 0,
  beta: 1,
  alpha: 2
};

const compareVersionPreference = (left: ModrinthVersion, right: ModrinthVersion) => {
  const leftHasPrimary = left.files.some((file) => file.primary);
  const rightHasPrimary = right.files.some((file) => file.primary);

  if (leftHasPrimary !== rightHasPrimary) {
    return leftHasPrimary ? -1 : 1;
  }

  const leftPriority = releasePriority[left.version_type ?? "release"] ?? 99;
  const rightPriority = releasePriority[right.version_type ?? "release"] ?? 99;
  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority;
  }

  if ((left.featured ?? false) !== (right.featured ?? false)) {
    return left.featured ? -1 : 1;
  }

  const leftPublished = left.date_published ? new Date(left.date_published).getTime() : 0;
  const rightPublished = right.date_published ? new Date(right.date_published).getTime() : 0;
  return rightPublished - leftPublished;
};

const resolveVersion = (version: ModrinthVersion): ResolvedModrinthVersion => {
  const file = version.files.find((candidate) => candidate.primary) ?? version.files[0];

  if (!file) {
    throw new Error("No compatible Modrinth file was found for this instance.");
  }

  return {
    projectId: version.project_id,
    versionId: version.id,
    name: version.name,
    versionNumber: version.version_number,
    fileName: file.filename,
    fileUrl: file.url,
    sha1: file.hashes.sha1,
    sha512: file.hashes.sha512,
    fileSize: file.size,
    projectSlug: version.project_slug,
    loaders: version.loaders,
    gameVersions: version.game_versions,
    versionType: version.version_type ?? "release",
    featured: version.featured ?? false,
    publishedAt: version.date_published,
    dependencies: version.dependencies
  };
};

export class ModrinthService {
  private readonly searchCache = new Map<string, { expiresAt: number; value: PaginatedModSearchResult }>();
  private readonly versionCache = new Map<string, { expiresAt: number; value: ResolvedModrinthVersion }>();
  private readonly compatibleVersionsCache = new Map<
    string,
    { expiresAt: number; value: ResolvedModrinthVersion[] }
  >();
  private readonly hashCache = new Map<string, { expiresAt: number; value: ResolvedModrinthVersion }>();

  async search(
    query: string,
    filters: ModSearchFilters,
    page = 1,
    pageSize = 18
  ): Promise<PaginatedModSearchResult> {
    const trimmedQuery = query.trim();
    const safePage = Math.max(1, page);
    const safePageSize = Math.max(1, Math.min(pageSize, 30));
    const cacheKey = JSON.stringify({ query: trimmedQuery, filters, page: safePage, pageSize: safePageSize });
    const cached = this.searchCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return {
        ...cached.value,
        results: [...cached.value.results]
      };
    }

    const facets: string[][] = [["project_type:mod"]];
    if (filters.loader && filters.loader !== "vanilla") {
      facets.push([`categories:${filters.loader}`]);
    }
    if (filters.minecraftVersion) {
      facets.push([`versions:${filters.minecraftVersion}`]);
    }

    const params = new URLSearchParams({
      limit: String(safePageSize),
      offset: String((safePage - 1) * safePageSize),
      facets: JSON.stringify(facets)
    });

    if (trimmedQuery) {
      params.set("query", trimmedQuery);
    } else {
      params.set("index", "downloads");
    }

    const response = await fetch(`https://api.modrinth.com/v2/search?${params.toString()}`);
    if (!response.ok) {
      throw new Error("Unable to search Modrinth.");
    }

    const payload = (await response.json()) as ModrinthSearchResponse;
    const results: ModSearchResult[] = payload.hits
      .map((hit) =>
        normalizeModSearchResult({
          id: typeof hit.project_id === "string" ? hit.project_id : undefined,
          slug: typeof hit.slug === "string" ? hit.slug : undefined,
          source: "modrinth",
          title: typeof hit.title === "string" ? hit.title : "Unknown mod",
          author: typeof hit.author === "string" ? hit.author : undefined,
          summary:
            typeof hit.description === "string" ? hit.description : "No description available.",
          iconUrl: typeof hit.icon_url === "string" ? hit.icon_url : undefined,
          downloads: typeof hit.downloads === "number" ? hit.downloads : 0,
          follows: typeof hit.follows === "number" ? hit.follows : 0,
          categories: Array.isArray(hit.display_categories)
            ? hit.display_categories
            : Array.isArray(hit.categories)
              ? hit.categories
              : [],
          supportedLoaders: Array.isArray(hit.loaders) ? hit.loaders : [],
          supportedVersions: Array.isArray(hit.versions) ? hit.versions : [],
          projectUrl:
            typeof hit.slug === "string" ? `https://modrinth.com/mod/${hit.slug}` : undefined
        })
      )
      .filter((result): result is ModSearchResult => Boolean(result));

    const totalHits =
      typeof payload.total_hits === "number" && Number.isFinite(payload.total_hits)
        ? payload.total_hits
        : results.length;
    const pageResult: PaginatedModSearchResult = {
      query: trimmedQuery,
      page: safePage,
      pageSize: safePageSize,
      totalHits,
      hasPreviousPage: safePage > 1,
      hasNextPage: safePage * safePageSize < totalHits,
      results
    };

    this.searchCache.set(cacheKey, {
      value: pageResult,
      expiresAt: Date.now() + 30_000
    });

    return pageResult;
  }

  private async listResolvedCompatibleVersions(
    projectId: string,
    filters: ModSearchFilters
  ): Promise<ResolvedModrinthVersion[]> {
    const cacheKey = JSON.stringify({ projectId, filters });
    const cached = this.compatibleVersionsCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return [...cached.value];
    }

    const params = new URLSearchParams();
    if (filters.loader) {
      params.set("loaders", JSON.stringify([filters.loader]));
    }
    if (filters.minecraftVersion) {
      params.set("game_versions", JSON.stringify([filters.minecraftVersion]));
    }

    const response = await fetch(
      `https://api.modrinth.com/v2/project/${projectId}/version?${params.toString()}`
    );

    if (!response.ok) {
      throw new Error("Unable to fetch Modrinth version metadata.");
    }

    const versions = (await response.json()) as ModrinthVersion[];
    const resolved = versions
      .filter((version) => version.files.length > 0)
      .sort(compareVersionPreference)
      .map(resolveVersion);

    this.compatibleVersionsCache.set(cacheKey, {
      value: resolved,
      expiresAt: Date.now() + 5 * 60_000
    });

    return [...resolved];
  }

  async getCompatibleVersions(
    projectId: string,
    filters: ModSearchFilters
  ): Promise<ModrinthVersionOption[]> {
    const versions = await this.listResolvedCompatibleVersions(projectId, filters);
    return versions.map((version) => ({
      id: version.versionId,
      projectId: version.projectId,
      projectSlug: version.projectSlug,
      name: version.name,
      versionNumber: version.versionNumber,
      versionType: version.versionType,
      loaders: version.loaders,
      gameVersions: version.gameVersions,
      fileName: version.fileName,
      featured: version.featured,
      publishedAt: version.publishedAt,
      sha1: version.sha1,
      sha512: version.sha512,
      fileSize: version.fileSize
    }));
  }

  async getLatestCompatibleVersion(
    projectId: string,
    filters: ModSearchFilters
  ): Promise<ResolvedModrinthVersion> {
    const cacheKey = JSON.stringify({ projectId, filters, preferred: "latest" });
    const cached = this.versionCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const versions = await this.listResolvedCompatibleVersions(projectId, filters);
    const match = versions[0];

    if (!match) {
      throw new Error("No compatible Modrinth file was found for this instance.");
    }

    this.versionCache.set(cacheKey, {
      value: match,
      expiresAt: Date.now() + 5 * 60_000
    });
    return match;
  }

  async getCompatibleVersion(
    projectId: string,
    filters: ModSearchFilters,
    versionId?: string
  ): Promise<ResolvedModrinthVersion> {
    if (!versionId) {
      return this.getLatestCompatibleVersion(projectId, filters);
    }

    const cacheKey = JSON.stringify({ projectId, filters, versionId });
    const cached = this.versionCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const versions = await this.listResolvedCompatibleVersions(projectId, filters);
    const match = versions.find((version) => version.versionId === versionId);

    if (!match) {
      throw new Error("That Modrinth version is not compatible with this instance.");
    }

    this.versionCache.set(cacheKey, {
      value: match,
      expiresAt: Date.now() + 5 * 60_000
    });
    return match;
  }

  async getVersionByHash(
    hash: string,
    algorithm: "sha1" | "sha512" = "sha1"
  ): Promise<ResolvedModrinthVersion | undefined> {
    const trimmedHash = hash.trim();
    if (!trimmedHash) {
      return undefined;
    }

    const cacheKey = `${algorithm}:${trimmedHash}`;
    const cached = this.hashCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const response = await fetch(
      `https://api.modrinth.com/v2/version_file/${trimmedHash}?algorithm=${algorithm}`
    );

    if (response.status === 404) {
      return undefined;
    }

    if (!response.ok) {
      throw new Error("Unable to look up Modrinth file metadata.");
    }

    const version = (await response.json()) as ModrinthVersion;
    const resolved = resolveVersion(version);
    this.hashCache.set(cacheKey, {
      value: resolved,
      expiresAt: Date.now() + 10 * 60_000
    });
    return resolved;
  }
}
