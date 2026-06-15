import type { AlilosApi, BrowserStatusSnapshot, DashboardSnapshot, TelegramSettings, TelegramTestResult } from "../shared/types";

declare global {
  interface Window {
    alilos: AlilosApi;
  }

  type RendererDashboardSnapshot = DashboardSnapshot;
  type RendererBrowserStatusSnapshot = BrowserStatusSnapshot;
  type RendererTelegramSettings = TelegramSettings;
  type RendererTelegramTestResult = TelegramTestResult;
}

export {};
