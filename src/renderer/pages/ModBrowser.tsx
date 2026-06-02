import { PageHeader } from "@renderer/components/ui/PageHeader";
import { ModBrowserPanel } from "@renderer/components/mods/ModBrowserPanel";

export const ModBrowser = () => (
  <div className="space-y-6">
    <PageHeader
      eyebrow="Mods"
      title="Mods"
      description="Browse compatible Modrinth mods and install them into an instance."
    />
    <ModBrowserPanel />
  </div>
);
