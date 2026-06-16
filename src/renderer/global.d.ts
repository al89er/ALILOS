import type {
  AlilosApi,
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
  TelegramSettings,
  TelegramTestResult,
  TestClickTargetId
} from "../shared/types";

declare global {
  interface Window {
    alilos: AlilosApi;
  }

  type RendererDashboardSnapshot = DashboardSnapshot;
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
  type RendererTelegramSettings = TelegramSettings;
  type RendererTelegramTestResult = TelegramTestResult;
  type RendererTestClickTargetId = TestClickTargetId;
}

export {};
