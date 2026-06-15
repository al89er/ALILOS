import type {
  AlilosApi,
  BrowserStatusSnapshot,
  DashboardSnapshot,
  PerakamStatusSnapshot,
  TelegramSettings,
  TelegramTestResult
} from "../shared/types";

declare global {
  interface Window {
    alilos: AlilosApi;
  }

  type RendererDashboardSnapshot = DashboardSnapshot;
  type RendererBrowserStatusSnapshot = BrowserStatusSnapshot;
  type RendererPerakamStatusSnapshot = PerakamStatusSnapshot;
  type RendererTelegramSettings = TelegramSettings;
  type RendererTelegramTestResult = TelegramTestResult;
}

export {};
