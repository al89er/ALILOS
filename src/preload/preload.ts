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
  getAppSettings: () => ipcRenderer.invoke("settings:get"),
  saveAppSettings: (settings) => ipcRenderer.invoke("settings:save", settings),
  getTelegramSettings: () => ipcRenderer.invoke("telegram:get-settings"),
  saveTelegramSettings: (settings) => ipcRenderer.invoke("telegram:save-settings", settings),
  sendTelegramTestNotification: () => ipcRenderer.invoke("telegram:send-test-notification"),
  getNetworkMonitorSettings: () => ipcRenderer.invoke("network:get-settings"),
  saveNetworkMonitorSettings: (settings) => ipcRenderer.invoke("network:save-settings", settings),
  checkNetworkNow: () => ipcRenderer.invoke("network:check-now"),
  openDetectedPortalPage: () => ipcRenderer.invoke("network:open-portal"),
  copyDetectedPortalUrl: () => ipcRenderer.invoke("network:copy-portal-url"),
  startBrowser: () => ipcRenderer.invoke("browser:start"),
  stopBrowser: () => ipcRenderer.invoke("browser:stop"),
  getBrowserStatus: () => ipcRenderer.invoke("browser:get-status"),
  openPerakam: () => ipcRenderer.invoke("perakam:open"),
  getPerakamStatus: () => ipcRenderer.invoke("perakam:get-status"),
  getPerakamAutoLoginSettings: () => ipcRenderer.invoke("perakam:get-auto-login"),
  savePerakamAutoLoginSettings: (settings) => ipcRenderer.invoke("perakam:save-auto-login", settings),
  clearPerakamAutoLoginCredentials: () => ipcRenderer.invoke("perakam:clear-auto-login"),
  testPerakamAutoLogin: (settings) => ipcRenderer.invoke("perakam:test-auto-login", settings),
  getConfirmationReadiness: () => ipcRenderer.invoke("confirmation:get-readiness"),
  createConfirmation: (action) => ipcRenderer.invoke("confirmation:create", action),
  acceptConfirmation: (id) => ipcRenderer.invoke("confirmation:accept", id),
  cancelConfirmation: (id) => ipcRenderer.invoke("confirmation:cancel", id),
  runAttendanceDryRun: (confirmationId) => ipcRenderer.invoke("dry-run:run", confirmationId),
  getLatestDryRun: () => ipcRenderer.invoke("dry-run:get-latest"),
  runGuardedAttendanceClick: (confirmationId) => ipcRenderer.invoke("attendance:execute", confirmationId),
  getLatestAttendanceExecution: () => ipcRenderer.invoke("attendance:get-latest-execution"),
  markAttendanceManuallyVerified: (confirmationId) => ipcRenderer.invoke("attendance:mark-manually-verified", confirmationId),
  checkTestClickReadiness: (targetId) => ipcRenderer.invoke("test-click:check-readiness", targetId),
  inspectTestClickTargets: () => ipcRenderer.invoke("test-click:inspect-targets"),
  createTestClickConfirmation: (targetId) => ipcRenderer.invoke("test-click:create-confirmation", targetId),
  acceptTestClickConfirmation: (id) => ipcRenderer.invoke("test-click:accept-confirmation", id),
  cancelTestClickConfirmation: (id) => ipcRenderer.invoke("test-click:cancel-confirmation", id),
  runTestClickDryRun: (id) => ipcRenderer.invoke("test-click:run-dry-run", id),
  runManualTestClick: (id) => ipcRenderer.invoke("test-click:run", id),
  onSnapshotUpdated: (callback: (snapshot: DashboardSnapshot) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, snapshot: DashboardSnapshot): void => {
      callback(snapshot);
    };

    ipcRenderer.on("dashboard:snapshot-updated", listener);
    return () => ipcRenderer.removeListener("dashboard:snapshot-updated", listener);
  }
};

contextBridge.exposeInMainWorld("alilos", api);
