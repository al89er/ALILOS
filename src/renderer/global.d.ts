import type {
  AlilosApi,
  AppSettingsInput,
  AppSettingsSnapshot,
  AttendanceExecutionResult,
  AttendanceActionType,
  BrowserStatusSnapshot,
  ConfirmationDashboardSnapshot,
  DashboardSnapshot,
  DryRunExecutionResult,
  NetworkMonitorSettings,
  NetworkMonitorSnapshot,
  PerakamStatusSnapshot,
  PerakamAutoLoginInput,
  PerakamAutoLoginSnapshot,
  TelegramSettingsInput,
  TelegramSettingsSnapshot,
  TelegramTestResult,
  TestClickTargetId
} from "../shared/types";

declare global {
  interface Window {
    alilos: AlilosApi;
  }

  type RendererDashboardSnapshot = DashboardSnapshot;
  type RendererAppSettingsInput = AppSettingsInput;
  type RendererAppSettingsSnapshot = AppSettingsSnapshot;
  type RendererAttendanceActionType = AttendanceActionType;
  type RendererBrowserStatusSnapshot = BrowserStatusSnapshot;
  type RendererConfirmationDashboardSnapshot = ConfirmationDashboardSnapshot;
  type RendererDryRunExecutionResult = DryRunExecutionResult;
  type RendererAttendanceExecutionResult = AttendanceExecutionResult;
  type RendererNetworkMonitorSettings = NetworkMonitorSettings;
  type RendererNetworkMonitorSnapshot = NetworkMonitorSnapshot;
  type RendererPerakamStatusSnapshot = PerakamStatusSnapshot;
  type RendererPerakamAutoLoginInput = PerakamAutoLoginInput;
  type RendererPerakamAutoLoginSnapshot = PerakamAutoLoginSnapshot;
  type RendererTelegramSettingsInput = TelegramSettingsInput;
  type RendererTelegramSettingsSnapshot = TelegramSettingsSnapshot;
  type RendererTelegramTestResult = TelegramTestResult;
  type RendererTestClickTargetId = TestClickTargetId;
}

export {};
