import { contextBridge, ipcRenderer } from "electron";
import type { AlilosApi, DashboardSnapshot } from "../shared/types";

const api: AlilosApi = {
  getSnapshot: () => ipcRenderer.invoke("dashboard:get-snapshot"),
  showWindow: () => ipcRenderer.invoke("window:show"),
  hideWindow: () => ipcRenderer.invoke("window:hide"),
  skipToday: () => ipcRenderer.invoke("schedule:skip-today"),
  unskipToday: () => ipcRenderer.invoke("schedule:unskip-today"),
  skipTomorrow: () => ipcRenderer.invoke("schedule:skip-tomorrow"),
  unskipTomorrow: () => ipcRenderer.invoke("schedule:unskip-tomorrow"),
  getTelegramSettings: () => ipcRenderer.invoke("telegram:get-settings"),
  saveTelegramSettings: (settings) => ipcRenderer.invoke("telegram:save-settings", settings),
  sendTelegramTestNotification: () => ipcRenderer.invoke("telegram:send-test-notification"),
  startBrowser: () => ipcRenderer.invoke("browser:start"),
  stopBrowser: () => ipcRenderer.invoke("browser:stop"),
  getBrowserStatus: () => ipcRenderer.invoke("browser:get-status"),
  onSnapshotUpdated: (callback: (snapshot: DashboardSnapshot) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, snapshot: DashboardSnapshot): void => {
      callback(snapshot);
    };

    ipcRenderer.on("dashboard:snapshot-updated", listener);
    return () => ipcRenderer.removeListener("dashboard:snapshot-updated", listener);
  }
};

contextBridge.exposeInMainWorld("alilos", api);
