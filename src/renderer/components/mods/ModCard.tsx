import { memo, useMemo, useState } from "react";
import { ExportSquare, ImportCurve } from "iconsax-react";
import type { ModSearchResult, ModrinthVersionOption } from "@shared/types";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { ModVersionSelect, formatModVersionLabel } from "./ModVersionSelect";

type ModCardProps = {
  result: ModSearchResult;
  versions?: ModrinthVersionOption[];
  selectedVersionId?: string;
  loadingVersions?: boolean;
  installing?: boolean;
  versionError?: string;
  onLoadVersions: () => void;
  onSelectVersion: (versionId: string) => void;
  onInstall: () => void;
  onViewPage?: () => void;
};

const formatCompactCount = (value: number) =>
  value >= 1000000
    ? `${(value / 1000000).toFixed(value >= 10000000 ? 0 : 1)}M`
    : value >= 1000
      ? `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`
      : value.toString();

export const ModCard = memo(function ModCard({
  result,
  versions,
  selectedVersionId,
  loadingVersions,
  installing,
  versionError,
  onLoadVersions,
  onSelectVersion,
  onInstall,
  onViewPage
}: ModCardProps) {
  const [iconMissing, setIconMissing] = useState(false);
  const categories = Array.isArray(result.categories) ? result.categories : [];
  const supportedLoaders = Array.isArray(result.supportedLoaders) ? result.supportedLoaders : [];
  const supportedVersions = Array.isArray(result.supportedVersions) ? result.supportedVersions : [];
  const downloads = typeof result.downloads === "number" ? result.downloads : 0;
  const follows = typeof result.follows === "number" ? result.follows : 0;
  const title = typeof result.title === "string" && result.title.trim() ? result.title : "Unknown mod";
  const summary =
    typeof result.summary === "string" && result.summary.trim()
      ? result.summary
      : "No description available.";
  const selectedVersion = useMemo(
    () => versions?.find((option) => option.id === selectedVersionId),
    [selectedVersionId, versions]
  );
  const hasVersions = (versions?.length ?? 0) > 0;
  const canInstall = hasVersions && !versionError;

  return (
    <div className="rounded-[var(--panel-radius)] border border-[var(--panel-border)] bg-[var(--surface-3)] px-4 py-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex min-w-0 gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-[12px] border border-[var(--panel-border)] bg-[var(--surface-2)]">
            {!iconMissing && result.iconUrl ? (
              <img
                src={result.iconUrl}
                alt={title}
                className="h-full w-full object-cover"
                loading="lazy"
                onError={() => setIconMissing(true)}
              />
            ) : (
              <span className="text-sm font-semibold text-[var(--muted-text)]">MR</span>
            )}
          </div>

          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-semibold text-white">{title}</p>
              <Badge variant="secondary">Modrinth</Badge>
              {result.author ? <Badge variant="default">by {result.author}</Badge> : null}
            </div>

            <p className="line-clamp-2 text-sm leading-6 text-[var(--soft-text)]">{summary}</p>

            <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted-text)]">
              <span>{formatCompactCount(downloads)} downloads</span>
              {follows > 0 ? <span>{formatCompactCount(follows)} followers</span> : null}
            </div>

            <div className="flex flex-wrap gap-2">
              {supportedLoaders.slice(0, 3).map((loader) => (
                <Badge key={loader} variant="secondary">
                  {loader}
                </Badge>
              ))}
              {supportedVersions.slice(0, 3).map((version) => (
                <Badge key={version} variant="outline">
                  {version}
                </Badge>
              ))}
              {categories.slice(0, 2).map((category) => (
                <Badge key={category} variant="default">
                  {category}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <div className="flex w-full flex-col items-stretch gap-2 xl:w-[260px] xl:items-end">
          <ModVersionSelect
            value={selectedVersionId}
            options={versions ?? []}
            disabled={installing}
            loading={loadingVersions}
            emptyLabel="No compatible version"
            placeholder="Version"
            onOpenChange={(open) => {
              if (open && !versions?.length) {
                onLoadVersions();
              }
            }}
            onValueChange={onSelectVersion}
          />

          {selectedVersion ? (
            <p className="text-xs text-[var(--muted-text)]">{formatModVersionLabel(selectedVersion)}</p>
          ) : null}

          {versionError ? <p className="text-xs text-amber-200">{versionError}</p> : null}

          <div className="flex flex-wrap gap-2 xl:justify-end">
            <Button size="sm" onClick={onInstall} disabled={installing || loadingVersions || !canInstall}>
              <ImportCurve size={16} variant="Linear" className="mr-2" />
              {installing ? "Installing..." : "Install"}
            </Button>
            {result.projectUrl ? (
              <Button variant="secondary" size="sm" onClick={onViewPage}>
                <ExportSquare size={16} variant="Linear" className="mr-2" />
                View page
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
});
