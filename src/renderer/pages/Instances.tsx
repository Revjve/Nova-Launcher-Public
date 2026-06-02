import { useEffect, useState } from "react";
import { Add } from "iconsax-react";
import { useNavigate } from "react-router-dom";
import { CreateInstanceWizard } from "@renderer/components/instance/CreateInstanceWizard";
import { InstanceCard } from "@renderer/components/instance/InstanceCard";
import { Button } from "@renderer/components/ui/Button";
import { EmptyState } from "@renderer/components/ui/EmptyState";
import { ErrorCallout } from "@renderer/components/ui/ErrorCallout";
import { PageHeader } from "@renderer/components/ui/PageHeader";
import { ProgressPanel } from "@renderer/components/ui/ProgressPanel";
import { useLauncherStore } from "@renderer/state/useLauncherStore";

const stageTone = (stage?: string) => {
  switch (stage) {
    case "completed":
      return "success" as const;
    case "completed-with-errors":
      return "warning" as const;
    case "failed":
      return "error" as const;
    default:
      return "info" as const;
  }
};

const stageLabel = (stage?: string) => {
  switch (stage) {
    case "reading-modpack":
      return "Reading modpack";
    case "parsing-manifest":
      return "Parsing manifest";
    case "creating-instance":
      return "Creating instance";
    case "installing-loader":
      return "Installing loader";
    case "downloading-files":
      return "Downloading files";
    case "copying-overrides":
      return "Copying overrides";
    case "finalizing":
      return "Finalizing";
    case "completed-with-errors":
      return "Imported with warnings";
    case "completed":
      return "Complete";
    case "failed":
      return "Import failed";
    default:
      return "Importing";
  }
};

export const Instances = () => {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const instances = useLauncherStore((state) => state.instances);
  const selectedInstanceId = useLauncherStore((state) => state.selectedInstanceId);
  const setSelectedInstance = useLauncherStore((state) => state.setSelectedInstance);
  const launchInstance = useLauncherStore((state) => state.launchInstance);
  const repairInstance = useLauncherStore((state) => state.repairInstance);
  const deleteInstance = useLauncherStore((state) => state.deleteInstance);
  const openPath = useLauncherStore((state) => state.openPath);
  const importMrpack = useLauncherStore((state) => state.importMrpack);
  const loadMods = useLauncherStore((state) => state.loadMods);
  const modsByInstance = useLauncherStore((state) => state.modsByInstance);
  const mrpackImportStatus = useLauncherStore((state) => state.mrpackImportStatus);
  const dismissMrpackImportStatus = useLauncherStore((state) => state.dismissMrpackImportStatus);

  useEffect(() => {
    instances.forEach((instance) => {
      if (!modsByInstance[instance.id]) {
        void loadMods(instance.id);
      }
    });
  }, [instances, loadMods, modsByInstance]);

  const handleDelete = async (instanceId: string) => {
    if (!window.confirm("Delete this instance from Nova?")) {
      return;
    }
    await deleteInstance(instanceId);
  };

  const failedFiles = mrpackImportStatus?.failedFiles ?? [];
  const isImportFinished =
    mrpackImportStatus?.stage === "completed" ||
    mrpackImportStatus?.stage === "completed-with-errors" ||
    mrpackImportStatus?.stage === "failed";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Instances"
        title="Instances"
        description="Manage and launch your Minecraft instances."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => importMrpack()}>
              Import modpack
            </Button>
            <Button onClick={() => setCreating(true)}>
              <Add size={18} variant="Bold" className="mr-2" />
              Create instance
            </Button>
          </div>
        }
      />

      {mrpackImportStatus ? (
        isImportFinished && failedFiles.length > 0 ? (
          <ErrorCallout
            tone={mrpackImportStatus.stage === "failed" ? "error" : "warning"}
            title={mrpackImportStatus.stage === "failed" ? "Modpack import failed" : "Modpack imported with warnings"}
            message={mrpackImportStatus.message}
            details={
              <div className="space-y-2">
                {failedFiles.slice(0, 8).map((failure) => (
                  <div key={`${failure.path}-${failure.reason}`}>
                    <div className="font-medium">{failure.path}</div>
                    <div>{failure.reason}</div>
                  </div>
                ))}
                {failedFiles.length > 8 ? <div>{failedFiles.length - 8} more files failed.</div> : null}
              </div>
            }
            actions={
              <Button variant="secondary" size="sm" onClick={dismissMrpackImportStatus}>
                Dismiss
              </Button>
            }
          />
        ) : (
          <ProgressPanel
            title={mrpackImportStatus.packName ? `Importing ${mrpackImportStatus.packName}` : "Importing modpack"}
            description={mrpackImportStatus.message}
            statusLabel={stageLabel(mrpackImportStatus.stage)}
            statusTone={stageTone(mrpackImportStatus.stage)}
            progress={mrpackImportStatus.progress}
            footer={
              isImportFinished ? (
                <Button variant="secondary" size="sm" onClick={dismissMrpackImportStatus}>
                  Dismiss
                </Button>
              ) : undefined
            }
          >
            {mrpackImportStatus.total ? (
              <p className="text-sm text-[var(--soft-text)]">
                {mrpackImportStatus.current ?? 0} of {mrpackImportStatus.total}
              </p>
            ) : null}
          </ProgressPanel>
        )
      ) : null}

      {instances.length === 0 ? (
        <EmptyState
          title="No instances yet"
          description="Create your first one or import a Modrinth pack."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="secondary" onClick={() => importMrpack()}>
                Import modpack
              </Button>
              <Button onClick={() => setCreating(true)}>Create instance</Button>
            </div>
          }
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
          {instances.map((instance) => (
            <InstanceCard
              key={instance.id}
              instance={instance}
              modsCount={modsByInstance[instance.id]?.length}
              selected={instance.id === selectedInstanceId}
              onSelect={setSelectedInstance}
              onPlay={(instanceId) => {
                setSelectedInstance(instanceId);
                void launchInstance(instanceId);
              }}
              onRepair={(instanceId) => void repairInstance(instanceId)}
              onOpenFolder={(_instanceId, path) => void openPath(path)}
              onOpenLogs={(instanceId) => {
                setSelectedInstance(instanceId);
                navigate("/console");
              }}
              onDelete={(instanceId) => void handleDelete(instanceId)}
              onManage={(instanceId) => {
                setSelectedInstance(instanceId);
                navigate(`/instances/${instanceId}`);
              }}
            />
          ))}
        </div>
      )}

      {creating ? <CreateInstanceWizard onClose={() => setCreating(false)} /> : null}
    </div>
  );
};
