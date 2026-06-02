import { contextBridge, ipcRenderer } from "electron";
import type { NovaApi } from "../shared/types";

const api: NovaApi = {
  bootstrap: () => ipcRenderer.invoke("nova:bootstrap"),
  addMicrosoftAccount: () => ipcRenderer.invoke("nova:add-account"),
  addOfflineDevAccount: (input) => ipcRenderer.invoke("nova:add-offline-dev-account", input),
  removeAccount: (accountId) => ipcRenderer.invoke("nova:remove-account", accountId),
  setActiveAccount: (accountId) => ipcRenderer.invoke("nova:set-active-account", accountId),
  getAuthConfiguration: () => ipcRenderer.invoke("nova:get-auth-configuration"),
  getRuntimeConfig: () => ipcRenderer.invoke("nova:get-runtime-config"),
  updateRuntimeConfig: (patch) => ipcRenderer.invoke("nova:update-runtime-config", patch),
  setEffectivePerformanceMode: (enabled) =>
    ipcRenderer.invoke("nova:set-effective-performance-mode", enabled),
  getInstances: () => ipcRenderer.invoke("nova:get-instances"),
  createInstance: (input) => ipcRenderer.invoke("nova:create-instance", input),
  updateInstance: (instanceId, input) => ipcRenderer.invoke("nova:update-instance", instanceId, input),
  duplicateInstance: (instanceId) => ipcRenderer.invoke("nova:duplicate-instance", instanceId),
  deleteInstance: (instanceId) => ipcRenderer.invoke("nova:delete-instance", instanceId),
  openPath: (targetPath) => ipcRenderer.invoke("nova:open-path", targetPath),
  openExternalUrl: (targetUrl) => ipcRenderer.invoke("nova:open-external-url", targetUrl),
  repairInstance: (instanceId) => ipcRenderer.invoke("nova:repair-instance", instanceId),
  listMinecraftVersions: () => ipcRenderer.invoke("nova:list-minecraft-versions"),
  listLoaderVersions: (loader, minecraftVersion) =>
    ipcRenderer.invoke("nova:list-loader-versions", loader, minecraftVersion),
  listJavaInstallations: () => ipcRenderer.invoke("nova:list-java"),
  listJavaDownloads: (majorVersion) => ipcRenderer.invoke("nova:list-java-downloads", majorVersion),
  downloadJavaRuntime: (option) => ipcRenderer.invoke("nova:download-java-runtime", option),
  updateSettings: (patch) => ipcRenderer.invoke("nova:update-settings", patch),
  listMods: (instanceId) => ipcRenderer.invoke("nova:list-mods", instanceId),
  toggleMod: (instanceId, modId, enabled) =>
    ipcRenderer.invoke("nova:toggle-mod", instanceId, modId, enabled),
  deleteMod: (instanceId, modId) => ipcRenderer.invoke("nova:delete-mod", instanceId, modId),
  importLocalMod: (instanceId) => ipcRenderer.invoke("nova:import-local-mod", instanceId),
  checkModUpdates: (instanceId) => ipcRenderer.invoke("nova:check-mod-updates", instanceId),
  updateMod: (instanceId, modId) => ipcRenderer.invoke("nova:update-mod", instanceId, modId),
  updateAllMods: (instanceId) => ipcRenderer.invoke("nova:update-all-mods", instanceId),
  importMrpack: () => ipcRenderer.invoke("nova:import-mrpack"),
  importTheme: () => ipcRenderer.invoke("nova:import-theme"),
  exportTheme: () => ipcRenderer.invoke("nova:export-theme"),
  deleteTheme: (themeId) => ipcRenderer.invoke("nova:delete-theme", themeId),
  searchModrinth: (query, filters, page, pageSize) =>
    ipcRenderer.invoke("nova:search-modrinth", query, filters, page, pageSize),
  listModrinthVersions: (projectId, filters) =>
    ipcRenderer.invoke("nova:list-modrinth-versions", projectId, filters),
  installMod: (source, instanceId, projectId, versionId) =>
    ipcRenderer.invoke("nova:install-mod", source, instanceId, projectId, versionId),
  changeModVersion: (instanceId, modId, versionId) =>
    ipcRenderer.invoke("nova:change-mod-version", instanceId, modId, versionId),
  getNews: () => ipcRenderer.invoke("nova:get-news"),
  launchInstance: (instanceId) => ipcRenderer.invoke("nova:launch-instance", instanceId),
  getLaunchCommandPreview: (instanceId) =>
    ipcRenderer.invoke("nova:get-launch-command-preview", instanceId),
  saveTextFile: (defaultFileName, contents) =>
    ipcRenderer.invoke("nova:save-text-file", defaultFileName, contents),
  openDataDirectory: () => ipcRenderer.invoke("nova:open-data-directory"),
  clearDownloadCache: () => ipcRenderer.invoke("nova:clear-download-cache"),
  saveSessionLogCopy: (sourcePath, defaultFileName) =>
    ipcRenderer.invoke("nova:save-session-log-copy", sourcePath, defaultFileName),
  onDownloadUpdate: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, tasks: unknown) =>
      callback(tasks as never);
    ipcRenderer.on("nova:downloads-updated", listener);
    return () => ipcRenderer.off("nova:downloads-updated", listener);
  },
  onLaunchLogs: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, entries: unknown) =>
      callback(entries as never);
    ipcRenderer.on("nova:launch-logs", listener);
    return () => ipcRenderer.off("nova:launch-logs", listener);
  },
  onLaunchStatus: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, entry: unknown) =>
      callback(entry as never);
    ipcRenderer.on("nova:launch-status", listener);
    return () => ipcRenderer.off("nova:launch-status", listener);
  },
  onMrpackImportStatus: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, entry: unknown) =>
      callback(entry as never);
    ipcRenderer.on("nova:mrpack-import-status", listener);
    return () => ipcRenderer.off("nova:mrpack-import-status", listener);
  }
};

contextBridge.exposeInMainWorld("nova", api);
