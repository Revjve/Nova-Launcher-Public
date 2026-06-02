import type { ModCompatibilityLoader, ModSearchResult } from "./types";

const fallbackTitle = "Unknown mod";
const fallbackSummary = "No description available.";

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];

const toLoaderArray = (value: unknown): ModCompatibilityLoader[] =>
  Array.isArray(value)
    ? value.filter(
        (entry): entry is ModCompatibilityLoader =>
          entry === "vanilla" ||
          entry === "fabric" ||
          entry === "forge" ||
          entry === "neoforge" ||
          entry === "quilt"
      )
    : [];

export const normalizeModSearchResult = (
  value: Partial<ModSearchResult> | Record<string, unknown> | null | undefined
): ModSearchResult | undefined => {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const id =
    typeof record.id === "string" && record.id.trim()
      ? record.id.trim()
      : typeof record.projectId === "string" && record.projectId.trim()
        ? record.projectId.trim()
        : undefined;

  if (!id) {
    return undefined;
  }

  return {
    id,
    slug: typeof record.slug === "string" ? record.slug : undefined,
    source: "modrinth",
    title: typeof record.title === "string" && record.title.trim() ? record.title : fallbackTitle,
    author: typeof record.author === "string" && record.author.trim() ? record.author : undefined,
    summary:
      typeof record.summary === "string" && record.summary.trim()
        ? record.summary
        : fallbackSummary,
    iconUrl: typeof record.iconUrl === "string" && record.iconUrl.trim() ? record.iconUrl : undefined,
    downloads: typeof record.downloads === "number" ? record.downloads : 0,
    follows: typeof record.follows === "number" ? record.follows : 0,
    categories: toStringArray(record.categories),
    supportedLoaders: toLoaderArray(record.supportedLoaders),
    supportedVersions: toStringArray(record.supportedVersions),
    projectUrl: typeof record.projectUrl === "string" && record.projectUrl.trim() ? record.projectUrl : undefined
  };
};
