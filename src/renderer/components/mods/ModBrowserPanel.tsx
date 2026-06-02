import type { Dispatch, SetStateAction } from "react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { SearchNormal1 } from "iconsax-react";
import type { ModSearchFilters, ModrinthVersionOption } from "@shared/types";
import { useLauncherStore } from "@renderer/state/useLauncherStore";
import { Button } from "../ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { ErrorCallout } from "../ui/ErrorCallout";
import { Input } from "../ui/Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/Select";
import { Badge } from "../ui/Badge";
import { ModCard } from "./ModCard";
import { PaginationControls } from "./PaginationControls";

type ModBrowserPanelProps = {
  instanceId?: string;
};

type ProjectState = {
  options?: ModrinthVersionOption[];
  selectedVersionId?: string;
  loadingVersions?: boolean;
  installing?: boolean;
  versionRequestId?: number;
  installingVersionId?: string;
  error?: string;
};

const updateProjectState = (
  setter: Dispatch<SetStateAction<Record<string, ProjectState>>>,
  projectId: string,
  patch: Partial<ProjectState>
) => {
  setter((current) => ({
    ...current,
    [projectId]: {
      ...current[projectId],
      ...patch
    }
  }));
};

const BrowserLoadingState = () => (
  <div className="space-y-2">
    {Array.from({ length: 4 }).map((_, index) => (
      <div
        key={index}
        className="rounded-[var(--panel-radius)] border border-[var(--panel-border)] bg-[var(--surface-3)] px-4 py-4"
      >
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-48 rounded bg-white/10" />
          <div className="h-3 w-full rounded bg-white/5" />
          <div className="h-3 w-3/4 rounded bg-white/5" />
        </div>
      </div>
    ))}
  </div>
);

export const ModBrowserPanel = ({ instanceId }: ModBrowserPanelProps) => {
  const instances = useLauncherStore((state) => state.instances);
  const modSearch = useLauncherStore((state) => state.modSearch);
  const searchMods = useLauncherStore((state) => state.searchMods);
  const listModrinthVersions = useLauncherStore((state) => state.listModrinthVersions);
  const installMod = useLauncherStore((state) => state.installMod);
  const importLocalMod = useLauncherStore((state) => state.importLocalMod);
  const openExternalUrl = useLauncherStore((state) => state.openExternalUrl);
  const setModSearchQuery = useLauncherStore((state) => state.setModSearchQuery);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>(instanceId ?? "");
  const [currentPage, setCurrentPage] = useState(1);
  const [projectStates, setProjectStates] = useState<Record<string, ProjectState>>({});
  const lastSearchKey = useRef<string>("");
  const versionRequestSequence = useRef(0);
  const deferredQuery = useDeferredValue(modSearch.query);

  useEffect(() => {
    if (instanceId) {
      setSelectedInstanceId(instanceId);
      return;
    }
    if (!selectedInstanceId && instances[0]?.id) {
      setSelectedInstanceId(instances[0].id);
    }
  }, [instanceId, instances, selectedInstanceId]);

  const selectedInstance = useMemo(
    () => instances.find((instance) => instance.id === selectedInstanceId),
    [instances, selectedInstanceId]
  );

  const searchFilters = useMemo<ModSearchFilters>(
    () => ({
      minecraftVersion: selectedInstance?.minecraftVersion ?? modSearch.filters.minecraftVersion,
      loader: selectedInstance?.loader ?? modSearch.filters.loader
    }),
    [
      modSearch.filters.loader,
      modSearch.filters.minecraftVersion,
      selectedInstance?.loader,
      selectedInstance?.minecraftVersion
    ]
  );

  useEffect(() => {
    setProjectStates({});
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [selectedInstanceId, searchFilters.loader, searchFilters.minecraftVersion]);

  useEffect(() => {
    const trimmedQuery = deferredQuery.trim();
    if (currentPage !== 1) {
      setCurrentPage(1);
      return;
    }

    if (!selectedInstanceId) {
      return;
    }

    const searchKey = JSON.stringify({
      query: trimmedQuery,
      minecraftVersion: searchFilters.minecraftVersion,
      loader: searchFilters.loader,
      selectedInstanceId,
      page: 1
    });

    if (lastSearchKey.current === searchKey) {
      return;
    }

    const timeout = window.setTimeout(() => {
      lastSearchKey.current = searchKey;
      void searchMods(trimmedQuery, searchFilters, 1);
    }, 280);

    return () => window.clearTimeout(timeout);
  }, [currentPage, deferredQuery, searchFilters, searchMods, selectedInstanceId]);

  useEffect(() => {
    if (!selectedInstanceId || currentPage === 1) {
      return;
    }

    const trimmedQuery = deferredQuery.trim();
    const searchKey = JSON.stringify({
      query: trimmedQuery,
      minecraftVersion: searchFilters.minecraftVersion,
      loader: searchFilters.loader,
      selectedInstanceId,
      page: currentPage
    });

    if (lastSearchKey.current === searchKey) {
      return;
    }

    lastSearchKey.current = searchKey;
    void searchMods(trimmedQuery, searchFilters, currentPage);
  }, [currentPage, deferredQuery, searchFilters, searchMods, selectedInstanceId]);

  const runSearch = async () => {
    const trimmedQuery = modSearch.query.trim();
    const nextPage = 1;
    const searchKey = JSON.stringify({
      query: trimmedQuery,
      minecraftVersion: searchFilters.minecraftVersion,
      loader: searchFilters.loader,
      selectedInstanceId,
      page: nextPage
    });

    lastSearchKey.current = searchKey;
    setCurrentPage(nextPage);
    await searchMods(trimmedQuery, searchFilters, nextPage);
  };

  const loadVersions = async (projectId: string) => {
    const current = projectStates[projectId];
    if (current?.loadingVersions) {
      return current.options ?? [];
    }
    if (current?.options) {
      return current.options;
    }

    const requestId = ++versionRequestSequence.current;
    updateProjectState(setProjectStates, projectId, {
      loadingVersions: true,
      versionRequestId: requestId,
      error: undefined
    });

    try {
      const options = await listModrinthVersions(projectId, searchFilters);
      setProjectStates((currentState) => {
        if (currentState[projectId]?.versionRequestId !== requestId) {
          return currentState;
        }

        return {
          ...currentState,
          [projectId]: {
            ...currentState[projectId],
            options,
            selectedVersionId: currentState[projectId]?.selectedVersionId ?? options[0]?.id,
            loadingVersions: false,
            error: options.length === 0 ? "No compatible version." : undefined
          }
        };
      });
      return options;
    } catch (error) {
      setProjectStates((currentState) => {
        if (currentState[projectId]?.versionRequestId !== requestId) {
          return currentState;
        }

        return {
          ...currentState,
          [projectId]: {
            ...currentState[projectId],
            loadingVersions: false,
            error: "Couldn't load versions."
          }
        };
      });
      return [];
    }
  };

  const handleInstall = async (projectId: string) => {
    if (!selectedInstanceId) {
      return;
    }

    const current = projectStates[projectId];
    if (current?.installing) {
      return;
    }

    let options = current?.options;
    let selectedVersionId = current?.selectedVersionId;

    if (!options) {
      options = await loadVersions(projectId);
      selectedVersionId = options[0]?.id;
    }

    if (!options || options.length === 0) {
      return;
    }

    if (options.length > 1 && !selectedVersionId) {
      updateProjectState(setProjectStates, projectId, {
        selectedVersionId: options[0]?.id,
        error: undefined
      });
      return;
    }

    if (options.length > 1 && !current?.options) {
      return;
    }

    updateProjectState(setProjectStates, projectId, {
      installing: true,
      installingVersionId: selectedVersionId ?? options[0]?.id,
      error: undefined
    });

    try {
      await installMod("modrinth", selectedInstanceId, projectId, selectedVersionId);
    } finally {
      updateProjectState(setProjectStates, projectId, {
        installing: false,
        installingVersionId: undefined
      });
    }
  };

  const renderableResults = useMemo(
    () => modSearch.results.filter((result) => typeof result.id === "string" && result.id.length > 0),
    [modSearch.results]
  );

  useEffect(() => {
    if (!selectedInstance || modSearch.loading) {
      return;
    }

    for (const result of renderableResults) {
      const current = projectStates[result.id];
      if (!current?.options && !current?.loadingVersions) {
        void loadVersions(result.id);
      }
    }
  }, [modSearch.loading, projectStates, renderableResults, selectedInstance]);
  const emptyStateDescription = selectedInstance
    ? modSearch.query.trim()
      ? "Try another search."
      : "No compatible mods."
    : "Choose an instance.";
  const resultSummary = modSearch.loading
    ? modSearch.query.trim()
      ? "Searching..."
      : "Loading top mods..."
    : modSearch.totalHits > 0
      ? `${Math.min(renderableResults.length, modSearch.pageSize)} shown / ${modSearch.totalHits} total`
      : "No results";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">Modrinth</CardTitle>
              <CardDescription>Compatible with the selected instance.</CardDescription>
            </div>
            {selectedInstance ? (
              <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--muted-text)]">
                <Badge variant="secondary">Modrinth</Badge>
                <Badge variant="outline">{selectedInstance.minecraftVersion}</Badge>
                <Badge variant="outline">
                  {selectedInstance.loader === "vanilla" ? "Vanilla" : selectedInstance.loader}
                </Badge>
              </div>
            ) : null}
          </div>
        </CardHeader>
        <CardContent
          className={`grid gap-3 p-[var(--card-padding)] ${
            selectedInstance ? "lg:grid-cols-[minmax(0,1fr)_220px_auto_auto]" : "lg:grid-cols-[minmax(0,1fr)_220px_auto]"
          }`}
        >
          <div className="relative">
            <SearchNormal1
              size={16}
              variant="Linear"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-text)]"
            />
            <Input
              value={modSearch.query}
              onChange={(event) => setModSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void runSearch();
                }
              }}
              className="pl-9"
              placeholder="Search mods"
            />
          </div>

          <Select value={selectedInstanceId} onValueChange={setSelectedInstanceId}>
            <SelectTrigger>
              <SelectValue placeholder="Instance" />
            </SelectTrigger>
            <SelectContent>
              {instances.map((instance) => (
                <SelectItem key={instance.id} value={instance.id}>
                  {instance.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={() => void runSearch()} disabled={modSearch.loading || !selectedInstanceId}>
            {modSearch.loading ? "Loading..." : "Search"}
          </Button>

          {selectedInstance ? (
            <Button variant="secondary" onClick={() => importLocalMod(selectedInstance.id)}>
              Import local mod
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--field-radius)] border border-[var(--panel-border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm">
        <div className="flex min-w-0 items-center gap-2 text-[var(--soft-text)]">
          <span>{resultSummary}</span>
        </div>
        {modSearch.query.trim() ? (
          <p className="truncate text-[var(--muted-text)]">
            Search: <span className="text-[var(--soft-text)]">{modSearch.query.trim()}</span>
          </p>
        ) : (
          <p className="truncate text-[var(--muted-text)]">Top mods</p>
        )}
      </div>

      {modSearch.error ? (
        <ErrorCallout
          title="Modrinth unavailable"
          message="Couldn't load mods right now."
          tone="warning"
          actions={
            <Button size="sm" variant="secondary" onClick={() => void runSearch()}>
              Retry
            </Button>
          }
          details={<pre className="whitespace-pre-wrap font-inherit">{modSearch.error}</pre>}
        />
      ) : null}

      {!selectedInstance ? (
        <EmptyState title="Choose an instance" description={emptyStateDescription} />
      ) : null}

      {selectedInstance && modSearch.loading && renderableResults.length === 0 ? <BrowserLoadingState /> : null}

      {selectedInstance && renderableResults.length === 0 && !modSearch.loading ? (
        <EmptyState title="No results" description={emptyStateDescription} />
      ) : null}

      {selectedInstance && renderableResults.length > 0 ? (
        <div className="space-y-2">
          {renderableResults.map((result) => {
            const projectState = projectStates[result.id];
            return (
              <ModCard
                key={`${result.source}-${result.id}`}
                result={result}
                versions={projectState?.options}
                selectedVersionId={projectState?.selectedVersionId}
                loadingVersions={projectState?.loadingVersions}
                installing={projectState?.installing}
                versionError={projectState?.error}
                onLoadVersions={() => void loadVersions(result.id)}
                onSelectVersion={(versionId) =>
                  updateProjectState(setProjectStates, result.id, {
                    selectedVersionId: versionId,
                    error: undefined
                  })
                }
                onInstall={() => void handleInstall(result.id)}
                onViewPage={() => result.projectUrl && openExternalUrl(result.projectUrl)}
              />
            );
          })}
        </div>
      ) : null}

      {selectedInstance && renderableResults.length > 0 && (modSearch.hasPreviousPage || modSearch.hasNextPage) ? (
        <PaginationControls
          page={modSearch.page}
          totalHits={modSearch.totalHits}
          pageSize={modSearch.pageSize}
          hasPreviousPage={modSearch.hasPreviousPage}
          hasNextPage={modSearch.hasNextPage}
          loading={modSearch.loading}
          onPrevious={() => setCurrentPage((page) => Math.max(1, page - 1))}
          onNext={() => setCurrentPage((page) => page + 1)}
        />
      ) : null}
    </div>
  );
};
