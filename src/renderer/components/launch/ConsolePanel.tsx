import { useDeferredValue, useMemo, useState } from "react";
import { Copy, ExportSquare, FolderOpen, SearchNormal1, Trash } from "iconsax-react";
import type { LaunchLogEntry, LaunchStatusEvent } from "@shared/types";
import { Button } from "@renderer/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@renderer/components/ui/Card";
import { Input } from "@renderer/components/ui/Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@renderer/components/ui/Select";
import { StatusPill } from "@renderer/components/ui/StatusPill";
import { useLauncherStore } from "@renderer/state/useLauncherStore";
import { TerminalConsole, type TerminalLine } from "./TerminalConsole";

type ConsoleFilter = "all" | "launcher" | "minecraft" | "fabric" | "java" | "errors";

const formatTime = (timestamp: string) => {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? timestamp : date.toLocaleTimeString([], { hour12: false });
};

const formatSource = (source: LaunchLogEntry["source"]) => {
  switch (source) {
    case "launcher":
      return "Launcher";
    case "minecraft":
      return "Minecraft";
    case "fabric":
      return "Fabric";
    case "java":
      return "Java";
    default:
      return source;
  }
};

const formatDetails = (entry: LaunchLogEntry) =>
  entry.details
    ? Object.entries(entry.details)
        .filter(([, value]) => value !== undefined && value !== "")
        .map(([key, value]) => `${key}=${String(value)}`)
        .join(" ")
    : "";

const colorLine = (entry: LaunchLogEntry) => {
  const tagColor =
    entry.source === "launcher"
      ? "\u001B[34m"
      : entry.source === "minecraft"
        ? "\u001B[37m"
        : entry.source === "fabric"
          ? "\u001B[35m"
          : "\u001B[36m";
  const levelColor =
    entry.level === "error"
      ? "\u001B[31m"
      : entry.level === "warn"
        ? "\u001B[33m"
        : entry.level === "debug"
          ? "\u001B[90m"
          : "\u001B[0m";
  const details = formatDetails(entry);

  return `\u001B[90m[${formatTime(entry.timestamp)}]\u001B[0m ${tagColor}[${formatSource(entry.source)}]\u001B[0m ${levelColor}${entry.message}${details ? ` ${details}` : ""}\u001B[0m`;
};

const plainLine = (entry: LaunchLogEntry) =>
  `[${formatTime(entry.timestamp)}] [${formatSource(entry.source)}] ${entry.message}${
    formatDetails(entry) ? ` ${formatDetails(entry)}` : ""
  }`;

const logDirectory = (path?: string) => path?.replace(/[\\/][^\\/]+$/, "");

type ConsolePanelProps = {
  logs: LaunchLogEntry[];
  status?: LaunchStatusEvent;
  defaultAutoScroll?: boolean;
  onClear: () => void;
  onSave: (sourcePath?: string) => void;
  onOpenLogsFolder: (path: string) => void;
};

export const ConsolePanel = ({
  logs,
  status,
  defaultAutoScroll = true,
  onClear,
  onSave,
  onOpenLogsFolder
}: ConsolePanelProps) => {
  const settings = useLauncherStore((state) => state.settings);
  const performanceModeEnabled = useLauncherStore((state) => state.performanceModeEnabled);
  const [filter, setFilter] = useState<ConsoleFilter>("all");
  const [query, setQuery] = useState("");
  const [autoScroll, setAutoScroll] = useState(defaultAutoScroll);
  const deferredQuery = useDeferredValue(query);

  const filteredLogs = useMemo(() => {
    const lowered = deferredQuery.trim().toLowerCase();
    return logs.filter((entry) => {
      if (filter === "errors" && entry.level !== "error" && entry.level !== "warn") {
        return false;
      }
      if (filter !== "all" && filter !== "errors" && entry.source !== filter) {
        return false;
      }
      if (!lowered) {
        return true;
      }
      return plainLine(entry).toLowerCase().includes(lowered);
    });
  }, [deferredQuery, filter, logs]);

  const terminalLines = useMemo<TerminalLine[]>(
    () =>
      filteredLogs.map((entry) => ({
        id: entry.id,
        text: colorLine(entry)
      })),
    [filteredLogs]
  );
  const latestLogDirectory = useMemo(() => logDirectory(status?.latestLogPath), [status?.latestLogPath]);
  const scrollback = performanceModeEnabled
    ? Math.min(settings.consoleMaxVisibleLines, 1500)
    : settings.consoleMaxVisibleLines;

  const copyLogs = async () => {
    if (filteredLogs.length === 0) {
      return;
    }
    await navigator.clipboard.writeText(filteredLogs.map(plainLine).join("\n"));
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="gap-4 border-b border-[var(--divider-color)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <CardTitle>Session log</CardTitle>
            <p className="mt-1 text-sm text-nova-400">Launcher and game output.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {latestLogDirectory ? (
              <Button variant="secondary" size="sm" onClick={() => onOpenLogsFolder(latestLogDirectory)}>
                <FolderOpen size={18} variant="Linear" className="mr-2" />
                Logs folder
              </Button>
            ) : null}
            <Button variant="secondary" size="sm" onClick={() => onSave(status?.latestLogPath)} disabled={logs.length === 0}>
              <ExportSquare size={18} variant="Linear" className="mr-2" />
              Save
            </Button>
            <Button variant="ghost" size="sm" onClick={copyLogs} disabled={filteredLogs.length === 0}>
              <Copy size={18} variant="Linear" className="mr-2" />
              Copy
            </Button>
            <Button variant="ghost" size="sm" onClick={onClear} disabled={logs.length === 0}>
              <Trash size={18} variant="Linear" className="mr-2" />
              Clear
            </Button>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_auto_auto]">
          <div className="relative">
            <SearchNormal1 size={16} variant="Linear" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-nova-500" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" placeholder="Search" />
          </div>

          <Select value={filter} onValueChange={(value) => setFilter(value as ConsoleFilter)}>
            <SelectTrigger>
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="errors">Errors</SelectItem>
              <SelectItem value="launcher">Launcher</SelectItem>
              <SelectItem value="minecraft">Minecraft</SelectItem>
              <SelectItem value="fabric">Fabric</SelectItem>
              <SelectItem value="java">Java</SelectItem>
            </SelectContent>
          </Select>

          <Button variant={autoScroll ? "default" : "secondary"} size="sm" onClick={() => setAutoScroll((value) => !value)}>
            Auto-scroll {autoScroll ? "On" : "Off"}
          </Button>

          <div className="flex items-center justify-end">
            <StatusPill label={status?.state?.replace(/-/g, " ") ?? "idle"} compact />
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <TerminalConsole
          lines={terminalLines}
          autoScroll={autoScroll}
          scrollback={scrollback}
          streamKey={`${filter}:${deferredQuery.trim().toLowerCase()}`}
        />
      </CardContent>
    </Card>
  );
};
