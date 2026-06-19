export type WorkerState = "idle" | "running" | "stopped";
export type ScheduleAction = "clock-in" | "clock-out";
export type AttendanceActionType = ScheduleAction;
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
export type ReadinessState = "ready" | "not-ready";
export type NotReadyReason =
  | "weekend"
  | "skipped"
  | "outside-schedule-window"
  | "browser-not-running"
  | "perakam-not-opened"
  | "perakam-not-reachable"
  | "perakam-url-mismatch"
  | "browser-error"
  | "perakam-error"
  | "perakam-login-required"
  | "perakam-stale-session"
  | "perakam-state-unknown"
  | "control-unavailable"
  | "already-completed"
  | "unknown";
export type ConfirmationStatus = "pending" | "accepted" | "in-flight" | "used" | "cancelled" | "expired" | "failed";
export type DryRunStatus = "not-started" | "rejected" | "passed" | "failed";
export type AttendanceExecutionStatus = "not-started" | "in-flight" | "rejected" | "succeeded" | "failed";
export type AttendanceCompletionState =
  | "not-attempted"
  | "click-attempted"
  | "click-succeeded-local"
  | "verification-pending"
  | "verified-success"
  | "verification-unknown"
  | "verification-failed"
  | "manually-verified";
export type AttendanceVerificationStatus = "pending" | "verified-success" | "verification-unknown" | "verification-failed" | "manually-verified";
export type TestClickTargetId = "a56" | "a57";
export type TestClickConfirmationStatus = ConfirmationStatus | "in-flight" | "used" | "failed";
export type TestClickResultStatus = "not-started" | "rejected" | "passed" | "failed" | "succeeded";
export type DryRunRejectionReason =
  | "missing-confirmation"
  | "confirmation-expired"
  | "confirmation-cancelled"
  | "confirmation-pending"
  | "confirmation-in-flight"
  | "confirmation-used"
  | "confirmation-failed"
  | "confirmation-not-accepted"
  | "date-mismatch"
  | "invalid-action"
  | "outside-schedule-window"
  | "weekend"
  | "skipped"
  | "browser-not-running"
  | "perakam-not-opened"
  | "perakam-not-reachable"
  | "perakam-url-mismatch"
  | "browser-error"
  | "perakam-error"
  | "control-unavailable"
  | "already-completed"
  | "stale-confirmation"
  | "unknown";
export type TestClickRejectionReason =
  | "missing-confirmation"
  | "confirmation-expired"
  | "confirmation-cancelled"
  | "confirmation-pending"
  | "confirmation-in-flight"
  | "confirmation-used"
  | "confirmation-failed"
  | "confirmation-not-accepted"
  | "invalid-target"
  | "browser-not-running"
  | "perakam-not-opened"
  | "perakam-not-reachable"
  | "perakam-url-mismatch"
  | "browser-error"
  | "perakam-error"
  | "target-unavailable"
  | "stale-confirmation"
  | "unknown";
export type PerakamPageStatus =
  | "not-opened"
  | "loading"
  | "reachable"
  | "dashboard"
  | "login-required"
  | "stale-session"
  | "likely-logged-in"
  | "likely-login-required"
  | "unknown"
  | "error";
export type AttendanceControlAvailability = "available" | "unavailable" | "unknown";
export type NetworkConnectivityState =
  | "checking"
  | "online"
  | "offline"
  | "local-network-only"
  | "captive-portal-suspected"
  | "captive-portal-detected"
  | "unknown"
  | "error";
export type PerakamReachabilityState =
  | "checking"
  | "reachable"
  | "unreachable"
  | "login-required"
  | "stale-session"
  | "dashboard"
  | "unknown"
  | "error";
export type CaptivePortalState = "not-detected" | "suspected" | "detected" | "unknown";
export type CaptivePortalConfidence = "low" | "medium" | "high";
export type CaptivePortalOpenTarget = "playwright" | "external";
export type ExecutionMode = "notify-only" | "manual-confirm" | "dry-run";
export type TelegramSecretStatus = "configured" | "env-local" | "missing";
export type ParitySyncHealth = "disabled" | "not-configured" | "idle" | "active" | "error";
export type ParityCommandType =
  | "request-status-refresh"
  | "request-dry-run"
  | "request-confirmation"
  | "cancel-confirmation"
  | "perform-configured-action"
  | "recalculate-today-schedule";
export type ParityCommandStatus =
  | "pending"
  | "claimed"
  | "succeeded"
  | "failed"
  | "expired"
  | "rejected"
  | "cancelled";
export type AutomationAuditEventType =
  | "schedule-due"
  | "page-prepared"
  | "candidate-detected"
  | "dry-run-action-simulated"
  | "confirmation-required"
  | "real-action-attempted-after-confirmation"
  | "verification-result";

export interface AttendancePlaceholder {
  label: "Morning Action" | "Evening Action";
  targetTime: string;
  status: ScheduleActionStatus;
}

export interface AppConfig {
  worker: {
    enabled: boolean;
    pollIntervalSeconds: number;
  };
  startup: StartupSettings;
  automation: AutomationSettings;
  heartbeat: HeartbeatSettings;
  paritySync: ParitySyncSettings;
  attendance: {
    clockInPlaceholder: string;
    clockOutPlaceholder: string;
    completionsByDate: Record<string, AttendanceCompletionRecord[]>;
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
  institutionCredential: InstitutionCredentialSettings;
  perakam: PerakamSettings;
  networkMonitor: NetworkMonitorSettings;
}

export interface ReminderSettings {
  enabled: boolean;
  approachingMinutes: number;
  systemNotificationsEnabled: boolean;
}

export interface AutomationSettings {
  executionMode: ExecutionMode;
  monitorIntervalSeconds: number;
  prepareBrowserInDryRun: boolean;
  auditEvents: AutomationAuditEvent[];
}

export interface StartupSettings {
  launchAtLogin: boolean;
}

export interface AutomationAuditEvent {
  id: string;
  type: AutomationAuditEventType;
  action: AttendanceActionType | null;
  dateKey: string | null;
  status: "info" | "passed" | "blocked" | "failed";
  message: string;
  createdAt: string;
  details: Record<string, string | number | boolean | null>;
}

export interface AutomationDryRunRecord {
  action: AttendanceActionType;
  dateKey: string;
  scheduledTime: string;
  status: "simulated" | "blocked" | "failed";
  perakamStatus: PerakamPageStatus;
  controlAvailability: AttendanceControlAvailability;
  reason: string;
  simulatedAt: string;
  auditEventId: string;
}

export interface AutomationSnapshot {
  executionMode: ExecutionMode;
  active: boolean;
  monitorIntervalSeconds: number;
  prepareBrowserInDryRun: boolean;
  lastCheckedAt: string | null;
  latestDryRun: AutomationDryRunRecord | null;
  auditEvents: AutomationAuditEvent[];
}

export interface HeartbeatSettings {
  enabled: boolean;
  deviceId: string;
  deviceLabel: string;
  supabaseUrl: string;
  publishableKey: string;
  intervalSeconds: number;
}

export interface HeartbeatPayload {
  appStatus: string;
  workerState: WorkerState;
  executionMode: ExecutionMode;
  networkStatus: string;
  perakamPageStatus: string;
  telegramStatus: string;
  lastSeenAt: string;
  statusText: string | null;
  lastErrorText: string | null;
}

export interface HeartbeatSnapshot {
  enabled: boolean;
  configured: boolean;
  active: boolean;
  intervalSeconds: number;
  endpointHost: string | null;
  keyStatus: TelegramSecretStatus;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  lastPayload: HeartbeatPayload | null;
}

export interface ParitySyncSettings {
  enabled: boolean;
  supabaseUrl: string;
  publishableKey: string;
  deviceId: string;
  deviceLabel: string;
  heartbeatIntervalSeconds: number;
  commandPollIntervalSeconds: number;
  logUploadEnabled: boolean;
  skipSyncEnabled: boolean;
  commandSyncEnabled: boolean;
  scheduleCompletionSyncEnabled: boolean;
}

export interface ParityDeviceStatusPayload {
  deviceId: string;
  deviceLabel: string;
  appVersion: string;
  appStatus: string;
  workerState: WorkerState;
  executionMode: ExecutionMode;
  networkStatus: string;
  captivePortalStatus: CaptivePortalState;
  configuredSiteStatus: PerakamPageStatus;
  browserState: BrowserControllerState;
  syncHealth: ParitySyncHealth;
  nextActionStatus: ScheduleActionStatus | null;
  nextScheduleSummary: string | null;
  completionSummary: string | null;
  lastErrorText: string | null;
  recordedAt: string;
}

export interface ParityEventLogPayload {
  deviceId: string;
  eventTime: string;
  eventType:
    | "startup"
    | "shutdown"
    | "desktop-status"
    | "network-status"
    | "configured-site-status"
    | "captive-portal-status"
    | "schedule"
    | "skip"
    | "command"
    | "dry-run"
    | "configured-action"
    | "sync"
    | "error";
  severity: "debug" | "info" | "warn" | "error";
  actionKey: AttendanceActionType | null;
  scheduleDate: string | null;
  message: string;
  details: Record<string, string | number | boolean | null>;
}

export interface ParitySkipDatePayload {
  deviceId: string;
  skipDate: string;
  actionKey: AttendanceActionType | null;
  reason: string | null;
  source: "desktop-local" | "webapp-command" | "manual-import";
}

export interface ParitySkipSyncSnapshot {
  enabled: boolean;
  active: boolean;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  syncCount: number;
  uploadCount: number;
  deleteCount: number;
  failureCount: number;
  rowsReceived: number;
  rowsApplied: number;
}

export interface ParityCommandRequestPayload {
  id: string;
  deviceId: string;
  commandType: ParityCommandType;
  actionKey: AttendanceActionType | null;
  scheduleDate: string | null;
  payload: Record<string, string | number | boolean | null>;
  status: ParityCommandStatus;
  requestedAt: string;
  expiresAt: string;
}

export interface ParityCommandResultPayload {
  commandId: string;
  deviceId: string;
  status: Extract<ParityCommandStatus, "succeeded" | "failed" | "expired" | "rejected" | "cancelled">;
  summary: string;
  details: Record<string, string | number | boolean | null>;
  completedAt: string;
}

export interface ParitySyncSnapshot {
  enabled: boolean;
  configured: boolean;
  active: boolean;
  health: ParitySyncHealth;
  endpointHost: string | null;
  keyStatus: TelegramSecretStatus;
  deviceId: string;
  deviceLabel: string;
  heartbeatIntervalSeconds: number;
  commandPollIntervalSeconds: number;
  featureFlags: {
    logUploadEnabled: boolean;
    skipSyncEnabled: boolean;
    commandSyncEnabled: boolean;
    scheduleCompletionSyncEnabled: boolean;
  };
  lastStartedAt: string | null;
  lastStoppedAt: string | null;
  lastCheckedAt: string | null;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  publishCount: number;
  failureCount: number;
  skipSync: ParitySkipSyncSnapshot;
  note: string;
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

export interface TelegramSettingsSnapshot {
  enabled: boolean;
  commandPrefix: string;
  secretStatus: {
    botToken: TelegramSecretStatus;
    chatId: TelegramSecretStatus;
  };
}

export interface TelegramSettingsInput {
  enabled: boolean;
  botToken?: string;
  chatId?: string;
  commandPrefix: string;
}

export interface PerakamSettings {
  dashboardUrl: string;
  autoLogin: PerakamAutoLoginSettings;
}

export interface InstitutionCredentialSettings {
  enabled: boolean;
  username: string;
  encryptedPassword: string;
  lastUpdatedAt: string | null;
}

export interface NetworkMonitorSettings {
  enabled: boolean;
  intervalSeconds: number;
  notifyOnInternetDown: boolean;
  notifyOnPerakamDown: boolean;
  notifyOnRecovery: boolean;
  failureThreshold: number;
  captivePortalDetectionEnabled: boolean;
  openDetectedPortalIn: CaptivePortalOpenTarget;
  retainPortalEvidenceMinutes: number;
}

export interface AppSettingsSnapshot {
  worker: {
    enabled: boolean;
    pollIntervalSeconds: number;
  };
  startup: {
    launchAtLogin: boolean;
    supported: boolean;
    openAtLogin: boolean;
  };
  automation: {
    executionMode: ExecutionMode;
    monitorIntervalSeconds: number;
    prepareBrowserInDryRun: boolean;
  };
  scheduler: {
    clockInWindow: TimeWindow;
    clockOutWindow: TimeWindow;
    gracePeriodMinutes: number;
    reminders: ReminderSettings;
  };
  perakam: {
    dashboardUrl: string;
  };
  heartbeat: {
    enabled: boolean;
    configured: boolean;
    endpointHost: string | null;
    keyStatus: TelegramSecretStatus;
    intervalSeconds: number;
  };
}

export interface AppSettingsInput {
  worker: {
    enabled: boolean;
    pollIntervalSeconds: number;
  };
  startup: {
    launchAtLogin: boolean;
  };
  automation: {
    executionMode: ExecutionMode;
    monitorIntervalSeconds: number;
    prepareBrowserInDryRun: boolean;
  };
  scheduler: {
    clockInWindow: TimeWindow;
    clockOutWindow: TimeWindow;
    gracePeriodMinutes: number;
    reminders: ReminderSettings;
  };
  perakam: {
    dashboardUrl: string;
  };
  heartbeat: {
    enabled: boolean;
    endpointUrl?: string;
    intervalSeconds: number;
  };
}

export interface CaptivePortalSnapshot {
  state: CaptivePortalState;
  detectedAt: string | null;
  portalUrl: string | null;
  portalHost: string | null;
  evidence: string[];
  confidence: CaptivePortalConfidence;
  lastProbeUrl: string | null;
  redirectedFrom: string | null;
  redirectedTo: string | null;
  httpStatus: number | null;
  sanitizedTitle: string | null;
  sanitizedTextSnippet: string | null;
}

export interface NetworkMonitorSnapshot {
  enabled: boolean;
  active: boolean;
  checkedAt: string | null;
  connectivityState: NetworkConnectivityState;
  perakamReachabilityState: PerakamReachabilityState;
  internetCheckReason: string;
  perakamCheckReason: string;
  lastSuccessfulInternetAt: string | null;
  lastSuccessfulPerakamAt: string | null;
  consecutiveFailures: number;
  sanitizedError: string | null;
  captivePortal: CaptivePortalSnapshot;
  isNotifyOnly: true;
  settings: NetworkMonitorSettings;
}

export type PerakamLoginResultStatus = "success" | "failed" | "unavailable" | "unknown";

export interface PerakamAutoLoginSettings {
  enabled: boolean;
  useSharedCredential: boolean;
  // Legacy compatibility fields. New credential writes should use institutionCredential.
  username: string;
  encryptedPassword: string;
  lastUpdatedAt: string | null;
  lastLoginAttemptAt: string | null;
  lastLoginResult: PerakamLoginResultStatus;
  lastLoginReason: string | null;
}

export interface PerakamAutoLoginSnapshot {
  enabled: boolean;
  useSharedCredential: boolean;
  username: string;
  hasSavedPassword: boolean;
  secureStorageAvailable: boolean;
  inFlight: boolean;
  lastUpdatedAt: string | null;
  lastLoginAttemptAt: string | null;
  lastLoginResult: PerakamLoginResultStatus;
  lastLoginReason: string | null;
}

export interface PerakamAutoLoginInput {
  enabled: boolean;
  username: string;
  password?: string;
}

export interface PerakamAutoLoginAttemptResult {
  ok: boolean;
  status: PerakamLoginResultStatus;
  reason: string;
  attemptedAt: string;
  pageState: PerakamPageStatus;
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
  pageState: PerakamPageStatus;
  statusReason: string;
  evidenceSnippets: string[];
  lastNavigationAt: string | null;
  lastCheckedAt: string | null;
  clockInAvailable: AttendanceControlAvailability;
  clockOutAvailable: AttendanceControlAvailability;
  clockInReason: string;
  clockOutReason: string;
  lastButtonCheckAt: string | null;
  lastError: string | null;
}

export interface AttendanceControlSnapshot {
  availability: AttendanceControlAvailability;
  reason: string;
  checkedAt: string | null;
}

export interface ConfirmationRequest {
  id: string;
  dateKey: string;
  action: AttendanceActionType;
  generatedScheduleTime: string;
  schedulerStatusAtCreation: ScheduleActionStatus;
  perakamStatusAtCreation: PerakamStatusSnapshot;
  sanitizedUrl: string | null;
  controlAvailabilityAtCreation: AttendanceControlSnapshot;
  createdAt: string;
  expiresAt: string;
  status: ConfirmationStatus;
  claimedAt: string | null;
  usedAt: string | null;
  failedAt: string | null;
  failureReason: string | null;
}

export interface DryRunSafetyCheckResult {
  name: string;
  passed: boolean;
  reason: string;
}

export interface DryRunExecutionRequest {
  confirmationId: string;
}

export interface DryRunExecutionResult {
  confirmationId: string;
  dateKey: string | null;
  action: AttendanceActionType | null;
  generatedScheduleTime: string | null;
  schedulerStatusAtDryRun: ScheduleActionStatus | null;
  sanitizedPerakamUrl: string | null;
  browserStatus: BrowserStatusSnapshot;
  perakamStatus: PerakamStatusSnapshot;
  controlAvailability: AttendanceControlSnapshot;
  safetyChecks: DryRunSafetyCheckResult[];
  rejectionReasons: DryRunRejectionReason[];
  status: DryRunStatus;
  summary: string;
  createdAt: string;
}

export interface AttendanceExecutionResult {
  confirmationId: string;
  dateKey: string | null;
  action: AttendanceActionType | null;
  mappedTargetId: "a50" | "a51" | null;
  generatedScheduleTime: string | null;
  schedulerStatusAtExecution: ScheduleActionStatus | null;
  sanitizedUrlBeforeClick: string | null;
  sanitizedUrlAfterClick: string | null;
  browserStatus: BrowserStatusSnapshot;
  perakamStatus: PerakamStatusSnapshot;
  controlAvailability: AttendanceControlSnapshot;
  safetyChecks: DryRunSafetyCheckResult[];
  rejectionReasons: DryRunRejectionReason[];
  status: AttendanceExecutionStatus;
  completionState: AttendanceCompletionState | null;
  verification: AttendanceVerificationResult | null;
  summary: string;
  createdAt: string;
}

export interface AttendanceVerificationResult {
  action: AttendanceActionType;
  dateKey: string;
  localClickResult: "not-attempted" | "click-attempted" | "click-succeeded-local" | "click-failed";
  status: AttendanceVerificationStatus;
  reason: string;
  sanitizedUrlAfterClick: string | null;
  evidenceSnippets: string[];
  checkedAt: string;
}

export interface AttendanceCompletionRecord {
  dateKey: string;
  action: AttendanceActionType;
  confirmationId: string;
  mappedTargetId: "a50" | "a51";
  completedAt: string;
  generatedScheduleTime: string;
  sanitizedUrlAfterClick: string | null;
  state: AttendanceCompletionState;
  verification: AttendanceVerificationResult | null;
  manuallyVerifiedAt: string | null;
}

export interface TestClickTargetSnapshot {
  targetId: TestClickTargetId;
  availability: AttendanceControlAvailability;
  reason: string;
  checkedAt: string | null;
}

export interface TestClickNearestElementSummary {
  tagName: string | null;
  id: string | null;
  className: string | null;
  role: string | null;
  href: string | null;
  textSnippet: string | null;
}

export interface TestClickTargetCandidateDiagnostic {
  targetId: TestClickTargetId;
  candidateIndex: number;
  tagName: string;
  id: string | null;
  name: string | null;
  type: string | null;
  href: string | null;
  className: string | null;
  role: string | null;
  ariaHidden: string | null;
  hidden: boolean;
  disabled: boolean;
  textSnippet: string | null;
  valueSnippet: string | null;
  title: string | null;
  nearestAnchor: TestClickNearestElementSummary | null;
  nearestButton: TestClickNearestElementSummary | null;
  nearestRoleButton: TestClickNearestElementSummary | null;
  nearestLiClass: string | null;
  nearestUlClass: string | null;
  insideChildMenu: boolean;
  insideSidebarMenu: boolean;
  insideLeftCol: boolean;
  insideRightCol: boolean;
  insideTopTiles: boolean;
  computedDisplay: string;
  computedVisibility: string;
  computedOpacity: string;
  boundingRect: {
    width: number;
    height: number;
    top: number;
    left: number;
  };
  offsetParentPresent: boolean;
  ownVisible: boolean;
  meaningfulDescendantVisible: boolean;
  detectorDecision: AttendanceControlAvailability;
  rejectionReason: string;
}

export interface TestClickTargetDiagnostics {
  checkedAt: string;
  targets: Record<TestClickTargetId, TestClickTargetCandidateDiagnostic[]>;
}

export interface TestClickConfirmationRequest {
  id: string;
  targetId: TestClickTargetId;
  sanitizedUrl: string | null;
  browserStatusAtCreation: BrowserStatusSnapshot;
  perakamStatusAtCreation: PerakamStatusSnapshot;
  targetAvailabilityAtCreation: TestClickTargetSnapshot;
  createdAt: string;
  expiresAt: string;
  status: TestClickConfirmationStatus;
  claimedAt: string | null;
  usedAt: string | null;
  failedAt: string | null;
  failureReason: string | null;
}

export interface TestClickSafetyCheckResult {
  name: string;
  passed: boolean;
  reason: string;
}

export interface TestClickReadinessResult {
  targetId: TestClickTargetId;
  ready: boolean;
  reasons: TestClickRejectionReason[];
  reasonText: string;
  browserStatus: BrowserStatusSnapshot;
  perakamStatus: PerakamStatusSnapshot;
  targetAvailability: TestClickTargetSnapshot;
  checkedAt: string;
}

export interface TestClickDryRunResult {
  confirmationId: string;
  targetId: TestClickTargetId | null;
  sanitizedPerakamUrl: string | null;
  browserStatus: BrowserStatusSnapshot;
  perakamStatus: PerakamStatusSnapshot;
  targetAvailability: TestClickTargetSnapshot | null;
  safetyChecks: TestClickSafetyCheckResult[];
  rejectionReasons: TestClickRejectionReason[];
  status: TestClickResultStatus;
  summary: string;
  createdAt: string;
}

export interface TestClickExecutionResult {
  confirmationId: string;
  targetId: TestClickTargetId | null;
  beforeUrl: string | null;
  afterUrl: string | null;
  sanitizedPerakamUrl: string | null;
  targetAvailability: TestClickTargetSnapshot | null;
  safetyChecks: TestClickSafetyCheckResult[];
  rejectionReasons: TestClickRejectionReason[];
  status: TestClickResultStatus;
  summary: string;
  createdAt: string;
}

export interface TestClickDashboardSnapshot {
  targets: Record<TestClickTargetId, TestClickReadinessResult | null>;
  diagnostics: TestClickTargetDiagnostics | null;
  activeConfirmation: TestClickConfirmationRequest | null;
  latestDryRun: TestClickDryRunResult | null;
  latestExecution: TestClickExecutionResult | null;
}

export interface ReadinessSnapshot {
  action: AttendanceActionType;
  state: ReadinessState;
  ready: boolean;
  statusText: string;
  reasons: NotReadyReason[];
  reasonText: string;
  dateKey: string;
  generatedScheduleTime: string;
  schedulerStatus: ScheduleActionStatus;
  controlAvailability: AttendanceControlSnapshot;
  activeConfirmation: ConfirmationRequest | null;
  latestDryRun: DryRunExecutionResult | null;
  latestExecution: AttendanceExecutionResult | null;
  completed: AttendanceCompletionRecord | null;
}

export interface ConfirmationDashboardSnapshot {
  clockIn: ReadinessSnapshot;
  clockOut: ReadinessSnapshot;
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
  label: "Morning Action" | "Evening Action";
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
  networkMonitor: NetworkMonitorSnapshot;
  browser: BrowserStatusSnapshot;
  perakam: PerakamStatusSnapshot;
  perakamAutoLogin: PerakamAutoLoginSnapshot;
  confirmations: ConfirmationDashboardSnapshot;
  testClick: TestClickDashboardSnapshot;
  automation: AutomationSnapshot;
  heartbeat: HeartbeatSnapshot;
  paritySync: ParitySyncSnapshot;
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
  recalculateTodaySchedule: () => Promise<DashboardSnapshot>;
  getAppSettings: () => Promise<AppSettingsSnapshot>;
  saveAppSettings: (settings: AppSettingsInput) => Promise<AppSettingsSnapshot>;
  getTelegramSettings: () => Promise<TelegramSettingsSnapshot>;
  saveTelegramSettings: (settings: TelegramSettingsInput) => Promise<TelegramSettingsSnapshot>;
  sendTelegramTestNotification: () => Promise<TelegramTestResult>;
  getNetworkMonitorSettings: () => Promise<NetworkMonitorSettings>;
  saveNetworkMonitorSettings: (settings: Partial<NetworkMonitorSettings>) => Promise<NetworkMonitorSettings>;
  checkNetworkNow: () => Promise<DashboardSnapshot>;
  openDetectedPortalPage: () => Promise<DashboardSnapshot>;
  copyDetectedPortalUrl: () => Promise<{ ok: boolean; message: string }>;
  startBrowser: () => Promise<BrowserStatusSnapshot>;
  stopBrowser: () => Promise<BrowserStatusSnapshot>;
  getBrowserStatus: () => Promise<BrowserStatusSnapshot>;
  openPerakam: () => Promise<PerakamStatusSnapshot>;
  getPerakamStatus: () => Promise<PerakamStatusSnapshot>;
  getPerakamAutoLoginSettings: () => Promise<PerakamAutoLoginSnapshot>;
  savePerakamAutoLoginSettings: (settings: PerakamAutoLoginInput) => Promise<PerakamAutoLoginSnapshot>;
  clearPerakamAutoLoginCredentials: () => Promise<PerakamAutoLoginSnapshot>;
  testPerakamAutoLogin: (settings?: Partial<PerakamAutoLoginInput>) => Promise<DashboardSnapshot>;
  getConfirmationReadiness: () => Promise<ConfirmationDashboardSnapshot>;
  createConfirmation: (action: AttendanceActionType) => Promise<DashboardSnapshot>;
  acceptConfirmation: (id: string) => Promise<DashboardSnapshot>;
  cancelConfirmation: (id: string) => Promise<DashboardSnapshot>;
  runAttendanceDryRun: (confirmationId: string) => Promise<DashboardSnapshot>;
  getLatestDryRun: () => Promise<DryRunExecutionResult | null>;
  runGuardedAttendanceClick: (confirmationId: string) => Promise<DashboardSnapshot>;
  getLatestAttendanceExecution: () => Promise<AttendanceExecutionResult | null>;
  markAttendanceManuallyVerified: (confirmationId: string) => Promise<DashboardSnapshot>;
  checkTestClickReadiness: (targetId: TestClickTargetId) => Promise<DashboardSnapshot>;
  inspectTestClickTargets: () => Promise<DashboardSnapshot>;
  createTestClickConfirmation: (targetId: TestClickTargetId) => Promise<DashboardSnapshot>;
  acceptTestClickConfirmation: (id: string) => Promise<DashboardSnapshot>;
  cancelTestClickConfirmation: (id: string) => Promise<DashboardSnapshot>;
  runTestClickDryRun: (id: string) => Promise<DashboardSnapshot>;
  runManualTestClick: (id: string) => Promise<DashboardSnapshot>;
  onSnapshotUpdated: (callback: (snapshot: DashboardSnapshot) => void) => () => void;
}
