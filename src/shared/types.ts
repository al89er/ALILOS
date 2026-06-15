export type WorkerState = "idle" | "running" | "stopped";
export type ScheduleAction = "clock-in" | "clock-out";
export type ScheduleActionStatus =
  | "upcoming"
  | "due-now"
  | "within-grace-period"
  | "missed"
  | "skipped"
  | "weekend";
export type ReminderStage =
  | "clockInApproaching"
  | "clockInDueNow"
  | "clockInGrace"
  | "clockOutApproaching"
  | "clockOutDueNow"
  | "clockOutGrace";
export type ReminderSuppressionReason = "weekend" | "skipped";
export type BrowserControllerState = "stopped" | "starting" | "running" | "stopping" | "error";
export type PerakamPageStatus =
  | "not-opened"
  | "loading"
  | "reachable"
  | "likely-logged-in"
  | "likely-login-required"
  | "unknown"
  | "error";
export type AttendanceControlAvailability = "available" | "unavailable" | "unknown";

export interface AttendancePlaceholder {
  label: "Clock In" | "Clock Out";
  targetTime: string;
  status: ScheduleActionStatus;
}

export interface AppConfig {
  worker: {
    enabled: boolean;
    pollIntervalSeconds: number;
  };
  attendance: {
    clockInPlaceholder: string;
    clockOutPlaceholder: string;
  };
  scheduler: {
    clockInWindow: TimeWindow;
    clockOutWindow: TimeWindow;
    gracePeriodMinutes: number;
    reminders: ReminderSettings;
    schedulesByDate: Record<string, DailySchedule>;
    skippedDates: string[];
    notificationsByDate: Record<string, ReminderDateState>;
  };
  telegram: TelegramSettings;
  perakam: PerakamSettings;
}

export interface ReminderSettings {
  enabled: boolean;
  approachingMinutes: number;
  systemNotificationsEnabled: boolean;
}

export interface ReminderDateState {
  sentStages: ReminderStage[];
  loggedSuppressions: ReminderSuppressionReason[];
  loggedDuplicates: ReminderStage[];
}

export interface TelegramSettings {
  enabled: boolean;
  botToken: string;
  chatId: string;
  commandPrefix: string;
  lastUpdateId: number;
}

export interface PerakamSettings {
  dashboardUrl: string;
}

export interface TelegramTestResult {
  ok: boolean;
  message: string;
  testedAt: string;
}

export interface TelegramPollingSnapshot {
  enabled: boolean;
  running: boolean;
  lastCheckedAt: string | null;
  lastError: string | null;
}

export interface ReminderSnapshot {
  enabled: boolean;
  active: boolean;
  approachingMinutes: number;
  sentStagesToday: ReminderStage[];
  lastCheckedAt: string | null;
  lastNotificationAt: string | null;
  lastError: string | null;
}

export interface BrowserStatusSnapshot {
  state: BrowserControllerState;
  profilePath: string;
  lastStartedAt: string | null;
  lastStoppedAt: string | null;
  lastError: string | null;
}

export interface PerakamStatusSnapshot {
  status: PerakamPageStatus;
  dashboardUrl: string;
  legacyDashboardUrl: string;
  currentUrl: string | null;
  pageTitle: string | null;
  lastNavigationAt: string | null;
  lastCheckedAt: string | null;
  clockInAvailable: AttendanceControlAvailability;
  clockOutAvailable: AttendanceControlAvailability;
  clockInReason: string;
  clockOutReason: string;
  lastButtonCheckAt: string | null;
  lastError: string | null;
}

export interface TimeWindow {
  start: string;
  end: string;
}

export interface DailySchedule {
  date: string;
  clockInTime: string;
  clockOutTime: string;
  generatedAt: string;
}

export interface ScheduleActionSnapshot {
  action: ScheduleAction;
  label: "Clock In" | "Clock Out";
  time: string;
  status: ScheduleActionStatus;
  statusText: string;
}

export interface ScheduleSnapshot {
  today: string;
  isWeekend: boolean;
  isTodaySkipped: boolean;
  gracePeriodMinutes: number;
  schedule: DailySchedule;
  actions: ScheduleActionSnapshot[];
  skippedDates: string[];
  summary: string;
}

export interface AppLogEntry {
  timestamp: string;
  level: "info" | "warn" | "error";
  message: string;
}

export interface WorkerSnapshot {
  state: WorkerState;
  lastStartedAt: string | null;
  lastHeartbeatAt: string | null;
  note: string;
}

export interface DashboardSnapshot {
  appStatus: string;
  worker: WorkerSnapshot;
  localTime: string;
  placeholders: AttendancePlaceholder[];
  schedule: ScheduleSnapshot;
  telegram: TelegramPollingSnapshot;
  reminders: ReminderSnapshot;
  browser: BrowserStatusSnapshot;
  perakam: PerakamStatusSnapshot;
  logs: AppLogEntry[];
  configPath: string;
  logPath: string;
}

export interface AlilosApi {
  getSnapshot: () => Promise<DashboardSnapshot>;
  showWindow: () => Promise<void>;
  hideWindow: () => Promise<void>;
  skipToday: () => Promise<DashboardSnapshot>;
  unskipToday: () => Promise<DashboardSnapshot>;
  skipTomorrow: () => Promise<DashboardSnapshot>;
  unskipTomorrow: () => Promise<DashboardSnapshot>;
  getTelegramSettings: () => Promise<TelegramSettings>;
  saveTelegramSettings: (settings: TelegramSettings) => Promise<TelegramSettings>;
  sendTelegramTestNotification: () => Promise<TelegramTestResult>;
  startBrowser: () => Promise<BrowserStatusSnapshot>;
  stopBrowser: () => Promise<BrowserStatusSnapshot>;
  getBrowserStatus: () => Promise<BrowserStatusSnapshot>;
  openPerakam: () => Promise<PerakamStatusSnapshot>;
  getPerakamStatus: () => Promise<PerakamStatusSnapshot>;
  onSnapshotUpdated: (callback: (snapshot: DashboardSnapshot) => void) => () => void;
}
