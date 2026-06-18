const IPC_TIMEOUT_MS = 10000;

const appStatus = document.querySelector<HTMLSpanElement>("#app-status");
const executionMode = document.querySelector<HTMLSpanElement>("#execution-mode");
const executionModeNote = document.querySelector<HTMLElement>("#execution-mode-note");
const workerStatus = document.querySelector<HTMLSpanElement>("#worker-status");
const workerNote = document.querySelector<HTMLElement>("#worker-note");
const heartbeatStatus = document.querySelector<HTMLElement>("#heartbeat-status");
const heartbeatNote = document.querySelector<HTMLElement>("#heartbeat-note");
const localTime = document.querySelector<HTMLElement>("#local-time");
const todaySkipped = document.querySelector<HTMLElement>("#today-skipped");
const workingDay = document.querySelector<HTMLElement>("#working-day");
const telegramPolling = document.querySelector<HTMLElement>("#telegram-polling");
const telegramPollingNote = document.querySelector<HTMLElement>("#telegram-polling-note");
const reminderStatus = document.querySelector<HTMLElement>("#reminder-status");
const reminderNote = document.querySelector<HTMLElement>("#reminder-note");
const browserStatus = document.querySelector<HTMLElement>("#browser-status");
const browserNote = document.querySelector<HTMLElement>("#browser-note");
const perakamStatus = document.querySelector<HTMLElement>("#perakam-status");
const perakamNote = document.querySelector<HTMLElement>("#perakam-note");
const tabButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[role='tab'][data-tab-target]"));
const tabPanels = Array.from(document.querySelectorAll<HTMLElement>("[role='tabpanel'][data-tab-panel]"));
const overviewTodayTimes = document.querySelector<HTMLElement>("#overview-today-times");
const overviewNextAction = document.querySelector<HTMLElement>("#overview-next-action");
const overviewLastAction = document.querySelector<HTMLElement>("#overview-last-action");
const overviewBrowserSite = document.querySelector<HTMLElement>("#overview-browser-site");
const overviewNetwork = document.querySelector<HTMLElement>("#overview-network");
const overviewCaptivePortal = document.querySelector<HTMLElement>("#overview-captive-portal");
const overviewEventsList = document.querySelector<HTMLOListElement>("#overview-events-list");
const networkInternetStatus = document.querySelector<HTMLElement>("#network-internet-status");
const networkInternetReason = document.querySelector<HTMLElement>("#network-internet-reason");
const networkPerakamStatus = document.querySelector<HTMLElement>("#network-perakam-status");
const networkPerakamReason = document.querySelector<HTMLElement>("#network-perakam-reason");
const networkLastChecked = document.querySelector<HTMLElement>("#network-last-checked");
const networkLastInternet = document.querySelector<HTMLElement>("#network-last-internet");
const networkLastPerakam = document.querySelector<HTMLElement>("#network-last-perakam");
const networkFailures = document.querySelector<HTMLElement>("#network-failures");
const networkError = document.querySelector<HTMLElement>("#network-error");
const portalState = document.querySelector<HTMLElement>("#portal-state");
const portalConfidence = document.querySelector<HTMLElement>("#portal-confidence");
const portalHost = document.querySelector<HTMLElement>("#portal-host");
const portalUrl = document.querySelector<HTMLElement>("#portal-url");
const portalTitle = document.querySelector<HTMLElement>("#portal-title");
const portalEvidence = document.querySelector<HTMLOListElement>("#portal-evidence");
const portalOpen = document.querySelector<HTMLButtonElement>("#portal-open");
const portalCopy = document.querySelector<HTMLButtonElement>("#portal-copy");
const networkCheckNow = document.querySelector<HTMLButtonElement>("#network-check-now");
const networkForm = document.querySelector<HTMLFormElement>("#network-form");
const networkEnabled = document.querySelector<HTMLInputElement>("#network-enabled");
const networkInterval = document.querySelector<HTMLInputElement>("#network-interval");
const networkFailureThreshold = document.querySelector<HTMLInputElement>("#network-failure-threshold");
const networkNotifyInternet = document.querySelector<HTMLInputElement>("#network-notify-internet");
const networkNotifyPerakam = document.querySelector<HTMLInputElement>("#network-notify-perakam");
const networkNotifyRecovery = document.querySelector<HTMLInputElement>("#network-notify-recovery");
const networkCaptiveDetection = document.querySelector<HTMLInputElement>("#network-captive-detection");
const networkRetainPortalEvidence = document.querySelector<HTMLInputElement>("#network-retain-portal-evidence");
const networkSaveSettings = document.querySelector<HTMLButtonElement>("#network-save-settings");
const networkResult = document.querySelector<HTMLElement>("#network-result");
const automationModeDetail = document.querySelector<HTMLElement>("#automation-mode-detail");
const automationLastChecked = document.querySelector<HTMLElement>("#automation-last-checked");
const automationDryRunStatus = document.querySelector<HTMLElement>("#automation-dry-run-status");
const automationDryRunDetail = document.querySelector<HTMLElement>("#automation-dry-run-detail");
const heartbeatEndpoint = document.querySelector<HTMLElement>("#heartbeat-endpoint");
const heartbeatLastSuccess = document.querySelector<HTMLElement>("#heartbeat-last-success");
const heartbeatError = document.querySelector<HTMLElement>("#heartbeat-error");
const automationAuditList = document.querySelector<HTMLOListElement>("#automation-audit-list");
const todayDate = document.querySelector<HTMLElement>("#today-date");
const scheduleSummary = document.querySelector<HTMLElement>("#schedule-summary");
const placeholderList = document.querySelector<HTMLElement>("#placeholder-list");
const skippedList = document.querySelector<HTMLOListElement>("#skipped-list");
const clockInReadiness = document.querySelector<HTMLElement>("#clock-in-readiness");
const clockInReason = document.querySelector<HTMLElement>("#clock-in-reason");
const clockInSchedule = document.querySelector<HTMLElement>("#clock-in-schedule");
const clockInControl = document.querySelector<HTMLElement>("#clock-in-control");
const clockInConfirmation = document.querySelector<HTMLElement>("#clock-in-confirmation");
const clockInExpires = document.querySelector<HTMLElement>("#clock-in-expires");
const clockInDryRun = document.querySelector<HTMLElement>("#clock-in-dry-run");
const clockInDryRunChecks = document.querySelector<HTMLOListElement>("#clock-in-dry-run-checks");
const clockInExecution = document.querySelector<HTMLElement>("#clock-in-execution");
const clockInCompleted = document.querySelector<HTMLElement>("#clock-in-completed");
const clockInRequestConfirmation = document.querySelector<HTMLButtonElement>("#clock-in-request-confirmation");
const clockInAcceptConfirmation = document.querySelector<HTMLButtonElement>("#clock-in-accept-confirmation");
const clockInCancelConfirmation = document.querySelector<HTMLButtonElement>("#clock-in-cancel-confirmation");
const clockInRunDryRun = document.querySelector<HTMLButtonElement>("#clock-in-run-dry-run");
const clockInExecute = document.querySelector<HTMLButtonElement>("#clock-in-execute");
const clockInManualVerify = document.querySelector<HTMLButtonElement>("#clock-in-manual-verify");
const clockOutReadiness = document.querySelector<HTMLElement>("#clock-out-readiness");
const clockOutReason = document.querySelector<HTMLElement>("#clock-out-reason");
const clockOutSchedule = document.querySelector<HTMLElement>("#clock-out-schedule");
const clockOutControl = document.querySelector<HTMLElement>("#clock-out-control");
const clockOutConfirmation = document.querySelector<HTMLElement>("#clock-out-confirmation");
const clockOutExpires = document.querySelector<HTMLElement>("#clock-out-expires");
const clockOutDryRun = document.querySelector<HTMLElement>("#clock-out-dry-run");
const clockOutDryRunChecks = document.querySelector<HTMLOListElement>("#clock-out-dry-run-checks");
const clockOutExecution = document.querySelector<HTMLElement>("#clock-out-execution");
const clockOutCompleted = document.querySelector<HTMLElement>("#clock-out-completed");
const clockOutRequestConfirmation = document.querySelector<HTMLButtonElement>("#clock-out-request-confirmation");
const clockOutAcceptConfirmation = document.querySelector<HTMLButtonElement>("#clock-out-accept-confirmation");
const clockOutCancelConfirmation = document.querySelector<HTMLButtonElement>("#clock-out-cancel-confirmation");
const clockOutRunDryRun = document.querySelector<HTMLButtonElement>("#clock-out-run-dry-run");
const clockOutExecute = document.querySelector<HTMLButtonElement>("#clock-out-execute");
const clockOutManualVerify = document.querySelector<HTMLButtonElement>("#clock-out-manual-verify");
const reminderStageList = document.querySelector<HTMLOListElement>("#reminder-stage-list");
const browserProfile = document.querySelector<HTMLElement>("#browser-profile");
const perakamConfiguredUrl = document.querySelector<HTMLElement>("#perakam-configured-url");
const perakamUrlNote = document.querySelector<HTMLElement>("#perakam-url-note");
const perakamDetailStatus = document.querySelector<HTMLElement>("#perakam-detail-status");
const perakamClockInAvailability = document.querySelector<HTMLElement>("#perakam-clock-in-availability");
const perakamClockInReason = document.querySelector<HTMLElement>("#perakam-clock-in-reason");
const perakamClockOutAvailability = document.querySelector<HTMLElement>("#perakam-clock-out-availability");
const perakamClockOutReason = document.querySelector<HTMLElement>("#perakam-clock-out-reason");
const perakamLastButtonCheck = document.querySelector<HTMLElement>("#perakam-last-button-check");
const perakamCurrentUrl = document.querySelector<HTMLElement>("#perakam-current-url");
const perakamPageTitle = document.querySelector<HTMLElement>("#perakam-page-title");
const perakamLastNavigation = document.querySelector<HTMLElement>("#perakam-last-navigation");
const perakamLastChecked = document.querySelector<HTMLElement>("#perakam-last-checked");
const perakamLastError = document.querySelector<HTMLElement>("#perakam-last-error");
const testClickForm = document.querySelector<HTMLFormElement>("#test-click-form");
const testClickTarget = document.querySelector<HTMLSelectElement>("#test-click-target");
const testClickReadiness = document.querySelector<HTMLElement>("#test-click-readiness");
const testClickTargetStatus = document.querySelector<HTMLElement>("#test-click-target-status");
const testClickConfirmation = document.querySelector<HTMLElement>("#test-click-confirmation");
const testClickExpires = document.querySelector<HTMLElement>("#test-click-expires");
const testClickDryRun = document.querySelector<HTMLElement>("#test-click-dry-run");
const testClickExecution = document.querySelector<HTMLElement>("#test-click-execution");
const testClickReason = document.querySelector<HTMLElement>("#test-click-reason");
const testClickChecks = document.querySelector<HTMLOListElement>("#test-click-checks");
const testClickDiagnostics = document.querySelector<HTMLOListElement>("#test-click-diagnostics");
const testClickInspect = document.querySelector<HTMLButtonElement>("#test-click-inspect");
const testClickCheck = document.querySelector<HTMLButtonElement>("#test-click-check");
const testClickRequest = document.querySelector<HTMLButtonElement>("#test-click-request");
const testClickAccept = document.querySelector<HTMLButtonElement>("#test-click-accept");
const testClickCancel = document.querySelector<HTMLButtonElement>("#test-click-cancel");
const testClickDryRunButton = document.querySelector<HTMLButtonElement>("#test-click-dry-run-button");
const testClickRun = document.querySelector<HTMLButtonElement>("#test-click-run");
const logList = document.querySelector<HTMLOListElement>("#log-list");
const hideWindow = document.querySelector<HTMLButtonElement>("#hide-window");
const skipToday = document.querySelector<HTMLButtonElement>("#skip-today");
const unskipToday = document.querySelector<HTMLButtonElement>("#unskip-today");
const skipTomorrow = document.querySelector<HTMLButtonElement>("#skip-tomorrow");
const unskipTomorrow = document.querySelector<HTMLButtonElement>("#unskip-tomorrow");
const startBrowser = document.querySelector<HTMLButtonElement>("#start-browser");
const stopBrowser = document.querySelector<HTMLButtonElement>("#stop-browser");
const openPerakam = document.querySelector<HTMLButtonElement>("#open-perakam");
const refreshPerakam = document.querySelector<HTMLButtonElement>("#refresh-perakam");
const perakamLoginForm = document.querySelector<HTMLFormElement>("#perakam-login-form");
const perakamLoginEnabled = document.querySelector<HTMLInputElement>("#perakam-login-enabled");
const perakamLoginUsername = document.querySelector<HTMLInputElement>("#perakam-login-username");
const perakamLoginPassword = document.querySelector<HTMLInputElement>("#perakam-login-password");
const perakamLoginPasswordState = document.querySelector<HTMLElement>("#perakam-login-password-state");
const perakamLoginLastResult = document.querySelector<HTMLElement>("#perakam-login-last-result");
const savePerakamLogin = document.querySelector<HTMLButtonElement>("#save-perakam-login");
const clearPerakamLogin = document.querySelector<HTMLButtonElement>("#clear-perakam-login");
const testPerakamLogin = document.querySelector<HTMLButtonElement>("#test-perakam-login");
const perakamLoginResult = document.querySelector<HTMLElement>("#perakam-login-result");
const telegramForm = document.querySelector<HTMLFormElement>("#telegram-form");
const telegramEnabled = document.querySelector<HTMLInputElement>("#telegram-enabled");
const telegramBotToken = document.querySelector<HTMLInputElement>("#telegram-bot-token");
const telegramChatId = document.querySelector<HTMLInputElement>("#telegram-chat-id");
const telegramBotTokenStatus = document.querySelector<HTMLElement>("#telegram-bot-token-status");
const telegramChatIdStatus = document.querySelector<HTMLElement>("#telegram-chat-id-status");
const telegramCommandPrefix = document.querySelector<HTMLElement>("#telegram-command-prefix");
const telegramCommandPrefixInput = document.querySelector<HTMLInputElement>("#telegram-command-prefix-input");
const saveTelegramSettingsButton = document.querySelector<HTMLButtonElement>("#save-telegram-settings");
const sendTelegramTest = document.querySelector<HTMLButtonElement>("#send-telegram-test");
const telegramResult = document.querySelector<HTMLElement>("#telegram-result");
const settingsForm = document.querySelector<HTMLFormElement>("#settings-form");
const settingsWorkerEnabled = document.querySelector<HTMLInputElement>("#settings-worker-enabled");
const settingsLaunchAtLogin = document.querySelector<HTMLInputElement>("#settings-launch-at-login");
const settingsWorkerInterval = document.querySelector<HTMLInputElement>("#settings-worker-interval");
const settingsExecutionMode = document.querySelector<HTMLSelectElement>("#settings-execution-mode");
const settingsAutomationInterval = document.querySelector<HTMLInputElement>("#settings-automation-interval");
const settingsPrepareBrowser = document.querySelector<HTMLInputElement>("#settings-prepare-browser");
const settingsMorningStart = document.querySelector<HTMLInputElement>("#settings-morning-start");
const settingsMorningEnd = document.querySelector<HTMLInputElement>("#settings-morning-end");
const settingsEveningStart = document.querySelector<HTMLInputElement>("#settings-evening-start");
const settingsEveningEnd = document.querySelector<HTMLInputElement>("#settings-evening-end");
const settingsGracePeriod = document.querySelector<HTMLInputElement>("#settings-grace-period");
const settingsRemindersEnabled = document.querySelector<HTMLInputElement>("#settings-reminders-enabled");
const settingsReminderApproaching = document.querySelector<HTMLInputElement>("#settings-reminder-approaching");
const settingsSystemNotifications = document.querySelector<HTMLInputElement>("#settings-system-notifications");
const settingsDashboardUrl = document.querySelector<HTMLInputElement>("#settings-dashboard-url");
const settingsHeartbeatEnabled = document.querySelector<HTMLInputElement>("#settings-heartbeat-enabled");
const settingsHeartbeatEndpoint = document.querySelector<HTMLInputElement>("#settings-heartbeat-endpoint");
const settingsHeartbeatEndpointState = document.querySelector<HTMLElement>("#settings-heartbeat-endpoint-state");
const settingsHeartbeatInterval = document.querySelector<HTMLInputElement>("#settings-heartbeat-interval");
const settingsSave = document.querySelector<HTMLButtonElement>("#settings-save");
const settingsReload = document.querySelector<HTMLButtonElement>("#settings-reload");
const settingsResult = document.querySelector<HTMLElement>("#settings-result");
const settingsScheduleWindow = document.querySelector<HTMLElement>("#settings-schedule-window");
const settingsBrowserSummary = document.querySelector<HTMLElement>("#settings-browser-summary");
const settingsNetworkSummary = document.querySelector<HTMLElement>("#settings-network-summary");
const settingsTelegramSummary = document.querySelector<HTMLElement>("#settings-telegram-summary");
const settingsHeartbeatSummary = document.querySelector<HTMLElement>("#settings-heartbeat-summary");
const settingsConfigPath = document.querySelector<HTMLElement>("#settings-config-path");
const settingsLogPath = document.querySelector<HTMLElement>("#settings-log-path");
let currentTelegramSettings: RendererTelegramSettingsSnapshot | null = null;
let currentPerakamLoginSettings: RendererPerakamAutoLoginSnapshot | null = null;
let currentAppSettings: RendererAppSettingsSnapshot | null = null;
let latestSnapshot: RendererDashboardSnapshot | null = null;
let perakamLoginFormDirty = false;
let networkSettingsDirty = false;
let appSettingsDirty = false;

function requireElement<T extends Element>(element: T | null, name: string): T {
  if (!element) {
    throw new Error(`Missing renderer element: ${name}`);
  }

  return element;
}

const elements = {
  appStatus: requireElement(appStatus, "app-status"),
  executionMode: requireElement(executionMode, "execution-mode"),
  executionModeNote: requireElement(executionModeNote, "execution-mode-note"),
  workerStatus: requireElement(workerStatus, "worker-status"),
  workerNote: requireElement(workerNote, "worker-note"),
  heartbeatStatus: requireElement(heartbeatStatus, "heartbeat-status"),
  heartbeatNote: requireElement(heartbeatNote, "heartbeat-note"),
  localTime: requireElement(localTime, "local-time"),
  todaySkipped: requireElement(todaySkipped, "today-skipped"),
  workingDay: requireElement(workingDay, "working-day"),
  telegramPolling: requireElement(telegramPolling, "telegram-polling"),
  telegramPollingNote: requireElement(telegramPollingNote, "telegram-polling-note"),
  reminderStatus: requireElement(reminderStatus, "reminder-status"),
  reminderNote: requireElement(reminderNote, "reminder-note"),
  browserStatus: requireElement(browserStatus, "browser-status"),
  browserNote: requireElement(browserNote, "browser-note"),
  perakamStatus: requireElement(perakamStatus, "perakam-status"),
  perakamNote: requireElement(perakamNote, "perakam-note"),
  overviewTodayTimes: requireElement(overviewTodayTimes, "overview-today-times"),
  overviewNextAction: requireElement(overviewNextAction, "overview-next-action"),
  overviewLastAction: requireElement(overviewLastAction, "overview-last-action"),
  overviewBrowserSite: requireElement(overviewBrowserSite, "overview-browser-site"),
  overviewNetwork: requireElement(overviewNetwork, "overview-network"),
  overviewCaptivePortal: requireElement(overviewCaptivePortal, "overview-captive-portal"),
  overviewEventsList: requireElement(overviewEventsList, "overview-events-list"),
  networkInternetStatus: requireElement(networkInternetStatus, "network-internet-status"),
  networkInternetReason: requireElement(networkInternetReason, "network-internet-reason"),
  networkPerakamStatus: requireElement(networkPerakamStatus, "network-perakam-status"),
  networkPerakamReason: requireElement(networkPerakamReason, "network-perakam-reason"),
  networkLastChecked: requireElement(networkLastChecked, "network-last-checked"),
  networkLastInternet: requireElement(networkLastInternet, "network-last-internet"),
  networkLastPerakam: requireElement(networkLastPerakam, "network-last-perakam"),
  networkFailures: requireElement(networkFailures, "network-failures"),
  networkError: requireElement(networkError, "network-error"),
  portalState: requireElement(portalState, "portal-state"),
  portalConfidence: requireElement(portalConfidence, "portal-confidence"),
  portalHost: requireElement(portalHost, "portal-host"),
  portalUrl: requireElement(portalUrl, "portal-url"),
  portalTitle: requireElement(portalTitle, "portal-title"),
  portalEvidence: requireElement(portalEvidence, "portal-evidence"),
  portalOpen: requireElement(portalOpen, "portal-open"),
  portalCopy: requireElement(portalCopy, "portal-copy"),
  networkCheckNow: requireElement(networkCheckNow, "network-check-now"),
  networkForm: requireElement(networkForm, "network-form"),
  networkEnabled: requireElement(networkEnabled, "network-enabled"),
  networkInterval: requireElement(networkInterval, "network-interval"),
  networkFailureThreshold: requireElement(networkFailureThreshold, "network-failure-threshold"),
  networkNotifyInternet: requireElement(networkNotifyInternet, "network-notify-internet"),
  networkNotifyPerakam: requireElement(networkNotifyPerakam, "network-notify-perakam"),
  networkNotifyRecovery: requireElement(networkNotifyRecovery, "network-notify-recovery"),
  networkCaptiveDetection: requireElement(networkCaptiveDetection, "network-captive-detection"),
  networkRetainPortalEvidence: requireElement(networkRetainPortalEvidence, "network-retain-portal-evidence"),
  networkSaveSettings: requireElement(networkSaveSettings, "network-save-settings"),
  networkResult: requireElement(networkResult, "network-result"),
  automationModeDetail: requireElement(automationModeDetail, "automation-mode-detail"),
  automationLastChecked: requireElement(automationLastChecked, "automation-last-checked"),
  automationDryRunStatus: requireElement(automationDryRunStatus, "automation-dry-run-status"),
  automationDryRunDetail: requireElement(automationDryRunDetail, "automation-dry-run-detail"),
  heartbeatEndpoint: requireElement(heartbeatEndpoint, "heartbeat-endpoint"),
  heartbeatLastSuccess: requireElement(heartbeatLastSuccess, "heartbeat-last-success"),
  heartbeatError: requireElement(heartbeatError, "heartbeat-error"),
  automationAuditList: requireElement(automationAuditList, "automation-audit-list"),
  todayDate: requireElement(todayDate, "today-date"),
  scheduleSummary: requireElement(scheduleSummary, "schedule-summary"),
  placeholderList: requireElement(placeholderList, "placeholder-list"),
  skippedList: requireElement(skippedList, "skipped-list"),
  clockInReadiness: requireElement(clockInReadiness, "clock-in-readiness"),
  clockInReason: requireElement(clockInReason, "clock-in-reason"),
  clockInSchedule: requireElement(clockInSchedule, "clock-in-schedule"),
  clockInControl: requireElement(clockInControl, "clock-in-control"),
  clockInConfirmation: requireElement(clockInConfirmation, "clock-in-confirmation"),
  clockInExpires: requireElement(clockInExpires, "clock-in-expires"),
  clockInDryRun: requireElement(clockInDryRun, "clock-in-dry-run"),
  clockInDryRunChecks: requireElement(clockInDryRunChecks, "clock-in-dry-run-checks"),
  clockInExecution: requireElement(clockInExecution, "clock-in-execution"),
  clockInCompleted: requireElement(clockInCompleted, "clock-in-completed"),
  clockInRequestConfirmation: requireElement(clockInRequestConfirmation, "clock-in-request-confirmation"),
  clockInAcceptConfirmation: requireElement(clockInAcceptConfirmation, "clock-in-accept-confirmation"),
  clockInCancelConfirmation: requireElement(clockInCancelConfirmation, "clock-in-cancel-confirmation"),
  clockInRunDryRun: requireElement(clockInRunDryRun, "clock-in-run-dry-run"),
  clockInExecute: requireElement(clockInExecute, "clock-in-execute"),
  clockInManualVerify: requireElement(clockInManualVerify, "clock-in-manual-verify"),
  clockOutReadiness: requireElement(clockOutReadiness, "clock-out-readiness"),
  clockOutReason: requireElement(clockOutReason, "clock-out-reason"),
  clockOutSchedule: requireElement(clockOutSchedule, "clock-out-schedule"),
  clockOutControl: requireElement(clockOutControl, "clock-out-control"),
  clockOutConfirmation: requireElement(clockOutConfirmation, "clock-out-confirmation"),
  clockOutExpires: requireElement(clockOutExpires, "clock-out-expires"),
  clockOutDryRun: requireElement(clockOutDryRun, "clock-out-dry-run"),
  clockOutDryRunChecks: requireElement(clockOutDryRunChecks, "clock-out-dry-run-checks"),
  clockOutExecution: requireElement(clockOutExecution, "clock-out-execution"),
  clockOutCompleted: requireElement(clockOutCompleted, "clock-out-completed"),
  clockOutRequestConfirmation: requireElement(clockOutRequestConfirmation, "clock-out-request-confirmation"),
  clockOutAcceptConfirmation: requireElement(clockOutAcceptConfirmation, "clock-out-accept-confirmation"),
  clockOutCancelConfirmation: requireElement(clockOutCancelConfirmation, "clock-out-cancel-confirmation"),
  clockOutRunDryRun: requireElement(clockOutRunDryRun, "clock-out-run-dry-run"),
  clockOutExecute: requireElement(clockOutExecute, "clock-out-execute"),
  clockOutManualVerify: requireElement(clockOutManualVerify, "clock-out-manual-verify"),
  reminderStageList: requireElement(reminderStageList, "reminder-stage-list"),
  browserProfile: requireElement(browserProfile, "browser-profile"),
  perakamConfiguredUrl: requireElement(perakamConfiguredUrl, "perakam-configured-url"),
  perakamUrlNote: requireElement(perakamUrlNote, "perakam-url-note"),
  perakamDetailStatus: requireElement(perakamDetailStatus, "perakam-detail-status"),
  perakamClockInAvailability: requireElement(perakamClockInAvailability, "perakam-clock-in-availability"),
  perakamClockInReason: requireElement(perakamClockInReason, "perakam-clock-in-reason"),
  perakamClockOutAvailability: requireElement(perakamClockOutAvailability, "perakam-clock-out-availability"),
  perakamClockOutReason: requireElement(perakamClockOutReason, "perakam-clock-out-reason"),
  perakamLastButtonCheck: requireElement(perakamLastButtonCheck, "perakam-last-button-check"),
  perakamCurrentUrl: requireElement(perakamCurrentUrl, "perakam-current-url"),
  perakamPageTitle: requireElement(perakamPageTitle, "perakam-page-title"),
  perakamLastNavigation: requireElement(perakamLastNavigation, "perakam-last-navigation"),
  perakamLastChecked: requireElement(perakamLastChecked, "perakam-last-checked"),
  perakamLastError: requireElement(perakamLastError, "perakam-last-error"),
  testClickForm: requireElement(testClickForm, "test-click-form"),
  testClickTarget: requireElement(testClickTarget, "test-click-target"),
  testClickReadiness: requireElement(testClickReadiness, "test-click-readiness"),
  testClickTargetStatus: requireElement(testClickTargetStatus, "test-click-target-status"),
  testClickConfirmation: requireElement(testClickConfirmation, "test-click-confirmation"),
  testClickExpires: requireElement(testClickExpires, "test-click-expires"),
  testClickDryRun: requireElement(testClickDryRun, "test-click-dry-run"),
  testClickExecution: requireElement(testClickExecution, "test-click-execution"),
  testClickReason: requireElement(testClickReason, "test-click-reason"),
  testClickChecks: requireElement(testClickChecks, "test-click-checks"),
  testClickDiagnostics: requireElement(testClickDiagnostics, "test-click-diagnostics"),
  testClickInspect: requireElement(testClickInspect, "test-click-inspect"),
  testClickCheck: requireElement(testClickCheck, "test-click-check"),
  testClickRequest: requireElement(testClickRequest, "test-click-request"),
  testClickAccept: requireElement(testClickAccept, "test-click-accept"),
  testClickCancel: requireElement(testClickCancel, "test-click-cancel"),
  testClickDryRunButton: requireElement(testClickDryRunButton, "test-click-dry-run-button"),
  testClickRun: requireElement(testClickRun, "test-click-run"),
  logList: requireElement(logList, "log-list"),
  hideWindow: requireElement(hideWindow, "hide-window"),
  skipToday: requireElement(skipToday, "skip-today"),
  unskipToday: requireElement(unskipToday, "unskip-today"),
  skipTomorrow: requireElement(skipTomorrow, "skip-tomorrow"),
  unskipTomorrow: requireElement(unskipTomorrow, "unskip-tomorrow"),
  startBrowser: requireElement(startBrowser, "start-browser"),
  stopBrowser: requireElement(stopBrowser, "stop-browser"),
  openPerakam: requireElement(openPerakam, "open-perakam"),
  refreshPerakam: requireElement(refreshPerakam, "refresh-perakam"),
  perakamLoginForm: requireElement(perakamLoginForm, "perakam-login-form"),
  perakamLoginEnabled: requireElement(perakamLoginEnabled, "perakam-login-enabled"),
  perakamLoginUsername: requireElement(perakamLoginUsername, "perakam-login-username"),
  perakamLoginPassword: requireElement(perakamLoginPassword, "perakam-login-password"),
  perakamLoginPasswordState: requireElement(perakamLoginPasswordState, "perakam-login-password-state"),
  perakamLoginLastResult: requireElement(perakamLoginLastResult, "perakam-login-last-result"),
  savePerakamLogin: requireElement(savePerakamLogin, "save-perakam-login"),
  clearPerakamLogin: requireElement(clearPerakamLogin, "clear-perakam-login"),
  testPerakamLogin: requireElement(testPerakamLogin, "test-perakam-login"),
  perakamLoginResult: requireElement(perakamLoginResult, "perakam-login-result"),
  telegramForm: requireElement(telegramForm, "telegram-form"),
  telegramEnabled: requireElement(telegramEnabled, "telegram-enabled"),
  telegramBotToken: requireElement(telegramBotToken, "telegram-bot-token"),
  telegramChatId: requireElement(telegramChatId, "telegram-chat-id"),
  telegramBotTokenStatus: requireElement(telegramBotTokenStatus, "telegram-bot-token-status"),
  telegramChatIdStatus: requireElement(telegramChatIdStatus, "telegram-chat-id-status"),
  telegramCommandPrefix: requireElement(telegramCommandPrefix, "telegram-command-prefix"),
  telegramCommandPrefixInput: requireElement(telegramCommandPrefixInput, "telegram-command-prefix-input"),
  saveTelegramSettingsButton: requireElement(saveTelegramSettingsButton, "save-telegram-settings"),
  sendTelegramTest: requireElement(sendTelegramTest, "send-telegram-test"),
  telegramResult: requireElement(telegramResult, "telegram-result"),
  settingsForm: requireElement(settingsForm, "settings-form"),
  settingsWorkerEnabled: requireElement(settingsWorkerEnabled, "settings-worker-enabled"),
  settingsLaunchAtLogin: requireElement(settingsLaunchAtLogin, "settings-launch-at-login"),
  settingsWorkerInterval: requireElement(settingsWorkerInterval, "settings-worker-interval"),
  settingsExecutionMode: requireElement(settingsExecutionMode, "settings-execution-mode"),
  settingsAutomationInterval: requireElement(settingsAutomationInterval, "settings-automation-interval"),
  settingsPrepareBrowser: requireElement(settingsPrepareBrowser, "settings-prepare-browser"),
  settingsMorningStart: requireElement(settingsMorningStart, "settings-morning-start"),
  settingsMorningEnd: requireElement(settingsMorningEnd, "settings-morning-end"),
  settingsEveningStart: requireElement(settingsEveningStart, "settings-evening-start"),
  settingsEveningEnd: requireElement(settingsEveningEnd, "settings-evening-end"),
  settingsGracePeriod: requireElement(settingsGracePeriod, "settings-grace-period"),
  settingsRemindersEnabled: requireElement(settingsRemindersEnabled, "settings-reminders-enabled"),
  settingsReminderApproaching: requireElement(settingsReminderApproaching, "settings-reminder-approaching"),
  settingsSystemNotifications: requireElement(settingsSystemNotifications, "settings-system-notifications"),
  settingsDashboardUrl: requireElement(settingsDashboardUrl, "settings-dashboard-url"),
  settingsHeartbeatEnabled: requireElement(settingsHeartbeatEnabled, "settings-heartbeat-enabled"),
  settingsHeartbeatEndpoint: requireElement(settingsHeartbeatEndpoint, "settings-heartbeat-endpoint"),
  settingsHeartbeatEndpointState: requireElement(settingsHeartbeatEndpointState, "settings-heartbeat-endpoint-state"),
  settingsHeartbeatInterval: requireElement(settingsHeartbeatInterval, "settings-heartbeat-interval"),
  settingsSave: requireElement(settingsSave, "settings-save"),
  settingsReload: requireElement(settingsReload, "settings-reload"),
  settingsResult: requireElement(settingsResult, "settings-result"),
  settingsScheduleWindow: requireElement(settingsScheduleWindow, "settings-schedule-window"),
  settingsBrowserSummary: requireElement(settingsBrowserSummary, "settings-browser-summary"),
  settingsNetworkSummary: requireElement(settingsNetworkSummary, "settings-network-summary"),
  settingsTelegramSummary: requireElement(settingsTelegramSummary, "settings-telegram-summary"),
  settingsHeartbeatSummary: requireElement(settingsHeartbeatSummary, "settings-heartbeat-summary"),
  settingsConfigPath: requireElement(settingsConfigPath, "settings-config-path"),
  settingsLogPath: requireElement(settingsLogPath, "settings-log-path")
};

function render(snapshot: RendererDashboardSnapshot): void {
  latestSnapshot = snapshot;
  elements.appStatus.textContent = snapshot.appStatus;
  renderAutomationTelemetry(snapshot);
  elements.workerStatus.textContent = snapshot.worker.state;
  elements.workerNote.textContent = snapshot.worker.note;
  elements.localTime.textContent = snapshot.localTime;
  elements.todayDate.textContent = `Today - ${snapshot.schedule.today}`;
  elements.todaySkipped.textContent = snapshot.schedule.isTodaySkipped ? "Yes" : "No";
  elements.workingDay.textContent = snapshot.schedule.isWeekend ? "No, weekend" : "Yes";
  elements.telegramPolling.textContent = snapshot.telegram.running ? "Running" : snapshot.telegram.enabled ? "Not running" : "Disabled";
  elements.telegramPollingNote.textContent = snapshot.telegram.lastError
    ?? (snapshot.telegram.lastCheckedAt ? `Last checked ${new Date(snapshot.telegram.lastCheckedAt).toLocaleTimeString()}` : "No polling check yet");
  elements.reminderStatus.textContent = snapshot.reminders.enabled ? "Enabled" : "Disabled";
  elements.reminderNote.textContent = snapshot.reminders.lastError
    ?? (snapshot.reminders.lastNotificationAt ? `Last sent ${new Date(snapshot.reminders.lastNotificationAt).toLocaleTimeString()}` : `${snapshot.reminders.approachingMinutes} min approaching window`);
  renderNetworkMonitor(snapshot.networkMonitor);
  elements.browserStatus.textContent = snapshot.browser.state;
  elements.browserNote.textContent = snapshot.browser.lastError
    ?? (snapshot.browser.lastStartedAt ? `Started ${new Date(snapshot.browser.lastStartedAt).toLocaleTimeString()}` : "Not started");
  elements.browserProfile.textContent = `Profile: ${snapshot.browser.profilePath}`;
  updateBrowserButtons(snapshot.browser.state);
  renderPerakamStatus(snapshot.perakam, snapshot.browser.state);
  renderPerakamAutoLogin(snapshot.perakamAutoLogin);
  renderConfirmations(snapshot.confirmations);
  renderTestClick(snapshot);
  renderOverviewSummaries(snapshot);
  renderSettingsSummaries(snapshot);
  elements.scheduleSummary.textContent = snapshot.schedule.summary;

  elements.placeholderList.replaceChildren(
    ...snapshot.schedule.actions.map((action) => {
      const item = document.createElement("article");
      item.className = "placeholder";
      item.dataset.status = action.status;

      const label = document.createElement("span");
      label.className = "label";
      label.textContent = action.label;

      const time = document.createElement("strong");
      time.textContent = action.time;

      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = action.statusText;

      item.append(label, time, badge);
      return item;
    })
  );

  const skippedItems = snapshot.schedule.skippedDates.length > 0
    ? snapshot.schedule.skippedDates.map((date) => {
      const item = document.createElement("li");
      item.textContent = date;
      return item;
    })
    : [createEmptyListItem("No skipped dates.")];

  elements.skippedList.replaceChildren(...skippedItems);

  const reminderItems = snapshot.reminders.sentStagesToday.length > 0
    ? snapshot.reminders.sentStagesToday.map((stage) => {
      const item = document.createElement("li");
      item.textContent = reminderStageLabel(stage);
      return item;
    })
    : [createEmptyListItem("No reminders sent today.")];

  elements.reminderStageList.replaceChildren(...reminderItems);

  const logItems = snapshot.logs.length > 0
    ? snapshot.logs.map((entry) => {
      const item = document.createElement("li");

      const time = document.createElement("time");
      time.dateTime = entry.timestamp;
      time.textContent = new Date(entry.timestamp).toLocaleTimeString();

      const level = document.createElement("span");
      level.className = "log-level";
      level.textContent = entry.level;

      const message = document.createElement("span");
      message.textContent = entry.message;

      item.append(time, level, message);
      return item;
    })
    : [createEmptyLogItem()];

  elements.logList.replaceChildren(...logItems);
}

function createEmptyListItem(text: string): HTMLLIElement {
  const item = document.createElement("li");
  item.textContent = text;
  return item;
}

function createEmptyLogItem(): HTMLLIElement {
  const item = document.createElement("li");
  const message = document.createElement("span");
  message.textContent = "No log entries yet.";
  item.append(message);
  return item;
}

function renderOverviewSummaries(snapshot: RendererDashboardSnapshot): void {
  const morning = snapshot.schedule.actions.find((action) => action.action === "clock-in");
  const evening = snapshot.schedule.actions.find((action) => action.action === "clock-out");
  const nextAction = getNextRelevantAction(snapshot);
  const latestExecution = [
    snapshot.confirmations.clockIn.latestExecution,
    snapshot.confirmations.clockOut.latestExecution
  ]
    .filter((result): result is RendererAttendanceExecutionResult => Boolean(result))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null;

  elements.overviewTodayTimes.textContent = `Morning ${morning?.time ?? snapshot.schedule.schedule.clockInTime}; evening ${evening?.time ?? snapshot.schedule.schedule.clockOutTime}.`;
  elements.overviewNextAction.textContent = nextAction
    ? `${nextAction.label} at ${nextAction.time} - ${nextAction.statusText}.`
    : snapshot.schedule.summary;
  elements.overviewLastAction.textContent = latestExecution
    ? `${executionStatusLabel(latestExecution.status)} - ${latestExecution.action ? actionLabel(latestExecution.action) : "Unknown action"}${latestExecution.mappedTargetId ? ` via ${latestExecution.mappedTargetId}` : ""}.`
    : snapshot.automation.latestDryRun
      ? `Simulated ${actionLabel(snapshot.automation.latestDryRun.action)} at ${new Date(snapshot.automation.latestDryRun.simulatedAt).toLocaleTimeString()}.`
      : "No action result recorded yet.";
  elements.overviewBrowserSite.textContent = `${snapshot.browser.state}; ${perakamStatusLabel(snapshot.perakam.status)}. Morning target ${availabilityLabel(snapshot.perakam.clockInAvailable)}, evening target ${availabilityLabel(snapshot.perakam.clockOutAvailable)}.`;
  elements.overviewNetwork.textContent = `${networkConnectivityLabel(snapshot.networkMonitor.connectivityState)}; Perakam ${perakamReachabilityLabel(snapshot.networkMonitor.perakamReachabilityState)}.`;
  elements.overviewCaptivePortal.textContent = `${captivePortalStateLabel(snapshot.networkMonitor.captivePortal.state)} (${snapshot.networkMonitor.captivePortal.confidence} confidence)${snapshot.networkMonitor.captivePortal.portalHost ? ` - ${snapshot.networkMonitor.captivePortal.portalHost}` : ""}.`;

  const eventItems = [
    ...snapshot.automation.auditEvents.slice(0, 4).map((event) => ({
      createdAt: event.createdAt,
      status: event.status,
      text: `${event.type}${event.action ? ` ${actionLabel(event.action)}` : ""}: ${event.message}`
    })),
    ...snapshot.logs.slice(0, 4).map((entry) => ({
      createdAt: entry.timestamp,
      status: entry.level === "error" ? "failed" : entry.level === "warn" ? "blocked" : "info",
      text: `${entry.level.toUpperCase()}: ${entry.message}`
    }))
  ]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 6)
    .map((event) => {
      const item = document.createElement("li");
      item.dataset.status = event.status;
      item.textContent = `${new Date(event.createdAt).toLocaleTimeString()} - ${event.text}`;
      return item;
    });

  elements.overviewEventsList.replaceChildren(
    ...(eventItems.length > 0 ? eventItems : [createEmptyListItem("No recent events yet.")])
  );
}

function renderSettingsSummaries(snapshot: RendererDashboardSnapshot): void {
  const settings = currentAppSettings;
  const clockInWindow = settings?.scheduler.clockInWindow;
  const clockOutWindow = settings?.scheduler.clockOutWindow;
  elements.settingsScheduleWindow.textContent = `Configured windows: morning ${clockInWindow?.start ?? "07:45"}-${clockInWindow?.end ?? "07:50"}, evening ${clockOutWindow?.start ?? "17:05"}-${clockOutWindow?.end ?? "17:10"}. Today generated ${snapshot.schedule.schedule.clockInTime} / ${snapshot.schedule.schedule.clockOutTime}; grace ${snapshot.schedule.gracePeriodMinutes} min.`;
  elements.settingsBrowserSummary.textContent = `Profile ${snapshot.browser.profilePath}. Configured site ${settings?.perakam.dashboardUrl ?? snapshot.perakam.dashboardUrl}. Auto-login ${snapshot.perakamAutoLogin.enabled ? "enabled" : "disabled"}; password ${snapshot.perakamAutoLogin.hasSavedPassword ? "saved locally" : "not saved"}. Launch at login ${(settings?.startup.openAtLogin ?? false) ? "enabled" : "disabled"}.`;
  elements.settingsNetworkSummary.textContent = `${snapshot.networkMonitor.enabled ? "Enabled" : "Disabled"}; interval ${snapshot.networkMonitor.settings.intervalSeconds}s; captive portal detection ${snapshot.networkMonitor.settings.captivePortalDetectionEnabled ? "enabled" : "disabled"}.`;
  elements.settingsTelegramSummary.textContent = currentTelegramSettings
    ? `${currentTelegramSettings.enabled ? "Enabled" : "Disabled"}; bot token ${telegramSecretStatusLabel(currentTelegramSettings.secretStatus.botToken)}; chat ${telegramSecretStatusLabel(currentTelegramSettings.secretStatus.chatId)}; prefix ${commandPrefixLabel(currentTelegramSettings.commandPrefix)}.`
    : `${snapshot.telegram.enabled ? "Enabled" : "Disabled"}; settings are loaded through the secure preload bridge.`;
  elements.settingsHeartbeatSummary.textContent = `${(settings?.heartbeat.enabled ?? snapshot.heartbeat.enabled) ? "Enabled" : "Disabled"}; ${(settings?.heartbeat.configured ?? snapshot.heartbeat.configured) ? `Supabase ${(settings?.heartbeat.endpointHost ?? snapshot.heartbeat.endpointHost) ?? "configured"}` : "Supabase URL/key not configured"}.`;
  elements.settingsConfigPath.textContent = snapshot.configPath;
  elements.settingsLogPath.textContent = snapshot.logPath;
}

function getNextRelevantAction(snapshot: RendererDashboardSnapshot): RendererDashboardSnapshot["schedule"]["actions"][number] | null {
  return snapshot.schedule.actions.find((item) => item.status === "due-now" || item.status === "within-grace-period")
    ?? snapshot.schedule.actions.find((item) => item.status === "upcoming")
    ?? snapshot.schedule.actions.find((item) => item.status === "missed")
    ?? null;
}

function renderAutomationTelemetry(snapshot: RendererDashboardSnapshot): void {
  const automation = snapshot.automation;
  const heartbeat = snapshot.heartbeat;
  const latestDryRun = automation.latestDryRun;

  elements.executionMode.textContent = executionModeLabel(automation.executionMode);
  elements.executionModeNote.textContent = automation.executionMode === "dry-run"
    ? "Due actions are simulated only."
    : automation.executionMode === "notify-only"
      ? "Monitoring and notifications only."
      : "Real clicks require confirmation.";

  elements.heartbeatStatus.textContent = heartbeat.enabled ? heartbeat.configured ? "Enabled" : "Needs Supabase config" : "Disabled";
  elements.heartbeatNote.textContent = heartbeat.lastError
    ?? (heartbeat.lastSuccessAt ? `Last sent ${new Date(heartbeat.lastSuccessAt).toLocaleTimeString()}` : "No heartbeat sent.");

  elements.automationModeDetail.textContent = `${executionModeLabel(automation.executionMode)} - checked every ${automation.monitorIntervalSeconds}s`;
  elements.automationLastChecked.textContent = formatOptionalTime(automation.lastCheckedAt);
  elements.automationDryRunStatus.textContent = latestDryRun
    ? `${simulationStatusLabel(latestDryRun.status)} ${latestDryRun.action} at ${new Date(latestDryRun.simulatedAt).toLocaleTimeString()}`
    : "No simulated action recorded.";
  elements.automationDryRunStatus.dataset.status = latestDryRun?.status === "simulated" ? "passed" : latestDryRun?.status ?? "not-started";
  elements.automationDryRunDetail.textContent = latestDryRun
    ? `${latestDryRun.reason} Perakam: ${statusLabel(latestDryRun.perakamStatus)}. Control: ${availabilityLabel(latestDryRun.controlAvailability)}.`
    : "Dry-run mode records due actions without submitting a real configured action.";

  elements.heartbeatEndpoint.textContent = heartbeat.enabled
    ? heartbeat.endpointHost ?? "Supabase URL/key is invalid or missing."
    : "Disabled.";
  elements.heartbeatLastSuccess.textContent = formatOptionalTime(heartbeat.lastSuccessAt);
  elements.heartbeatError.textContent = heartbeat.lastError ?? "--";

  const auditItems = automation.auditEvents.length > 0
    ? automation.auditEvents.map((event) => {
      const item = document.createElement("li");
      item.dataset.status = event.status;
      const time = new Date(event.createdAt).toLocaleTimeString();
      const action = event.action ? ` ${event.action}` : "";
      item.textContent = `${time} - ${event.type}${action}: ${event.message}`;
      return item;
    })
    : [createEmptyListItem("No automation audit events yet.")];

  elements.automationAuditList.replaceChildren(...auditItems);
}

function executionModeLabel(mode: string): string {
  switch (mode) {
    case "notify-only":
      return "Notify only";
    case "dry-run":
      return "Dry run";
    default:
      return "Manual confirm";
  }
}

function simulationStatusLabel(status: string): string {
  switch (status) {
    case "simulated":
      return "Simulated";
    case "blocked":
      return "Blocked";
    case "failed":
      return "Failed";
    default:
      return status;
  }
}

function reminderStageLabel(stage: string): string {
  const labels = new Map<string, string>([
    ["clockInApproaching", "Morning action approaching"],
    ["clockInDueNow", "Morning action due now"],
    ["clockInGrace", "Morning action grace period"],
    ["clockOutApproaching", "Evening action approaching"],
    ["clockOutDueNow", "Evening action due now"],
    ["clockOutGrace", "Evening action grace period"]
  ]);

  return labels.get(stage) ?? stage;
}

function setupTabNavigation(): void {
  if (tabButtons.length === 0 || tabPanels.length === 0) {
    return;
  }

  const activateTab = (target: string, focusTab = false): void => {
    for (const button of tabButtons) {
      const isActive = button.dataset.tabTarget === target;
      button.setAttribute("aria-selected", String(isActive));
      button.tabIndex = isActive ? 0 : -1;
      if (isActive && focusTab) {
        button.focus();
      }
    }

    for (const panel of tabPanels) {
      panel.hidden = panel.dataset.tabPanel !== target;
    }
  };

  for (const button of tabButtons) {
    button.addEventListener("click", () => {
      activateTab(button.dataset.tabTarget ?? "overview");
    });

    button.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
        return;
      }

      event.preventDefault();
      const currentIndex = tabButtons.indexOf(button);
      const lastIndex = tabButtons.length - 1;
      const nextIndex = event.key === "Home"
        ? 0
        : event.key === "End"
          ? lastIndex
          : event.key === "ArrowRight"
            ? (currentIndex + 1) % tabButtons.length
            : (currentIndex - 1 + tabButtons.length) % tabButtons.length;
      activateTab(tabButtons[nextIndex].dataset.tabTarget ?? "overview", true);
    });
  }

  activateTab(tabButtons.find((button) => button.getAttribute("aria-selected") === "true")?.dataset.tabTarget ?? "overview");
}

async function refresh(): Promise<void> {
  render(await window.alilos.getSnapshot());
}

elements.hideWindow.addEventListener("click", () => {
  void window.alilos.hideWindow();
});

elements.skipToday.addEventListener("click", () => runScheduleAction(() => window.alilos.skipToday()));
elements.unskipToday.addEventListener("click", () => runScheduleAction(() => window.alilos.unskipToday()));
elements.skipTomorrow.addEventListener("click", () => runScheduleAction(() => window.alilos.skipTomorrow()));
elements.unskipTomorrow.addEventListener("click", () => runScheduleAction(() => window.alilos.unskipTomorrow()));
elements.clockInRequestConfirmation.addEventListener("click", () => {
  void runConfirmationAction(() => window.alilos.createConfirmation("clock-in"));
});
elements.clockInAcceptConfirmation.addEventListener("click", () => {
  void acceptActiveConfirmation("clock-in");
});
elements.clockInCancelConfirmation.addEventListener("click", () => {
  void cancelActiveConfirmation("clock-in");
});
elements.clockInRunDryRun.addEventListener("click", () => {
  void runActiveDryRun("clock-in");
});
elements.clockInExecute.addEventListener("click", () => {
  void runActiveAttendanceExecution("clock-in");
});
elements.clockInManualVerify.addEventListener("click", () => {
  void markActiveAttendanceManuallyVerified("clock-in");
});
elements.clockOutRequestConfirmation.addEventListener("click", () => {
  void runConfirmationAction(() => window.alilos.createConfirmation("clock-out"));
});
elements.clockOutAcceptConfirmation.addEventListener("click", () => {
  void acceptActiveConfirmation("clock-out");
});
elements.clockOutCancelConfirmation.addEventListener("click", () => {
  void cancelActiveConfirmation("clock-out");
});
elements.clockOutRunDryRun.addEventListener("click", () => {
  void runActiveDryRun("clock-out");
});
elements.clockOutExecute.addEventListener("click", () => {
  void runActiveAttendanceExecution("clock-out");
});
elements.clockOutManualVerify.addEventListener("click", () => {
  void markActiveAttendanceManuallyVerified("clock-out");
});
elements.startBrowser.addEventListener("click", () => {
  void runBrowserAction(() => window.alilos.startBrowser());
});
elements.stopBrowser.addEventListener("click", () => {
  void runBrowserAction(() => window.alilos.stopBrowser());
});
elements.openPerakam.addEventListener("click", () => {
  void runPerakamAction(() => window.alilos.openPerakam());
});
elements.refreshPerakam.addEventListener("click", () => {
  void runPerakamAction(() => window.alilos.getPerakamStatus());
});
elements.networkForm.addEventListener("submit", (event) => {
  event.preventDefault();
});
[
  elements.networkEnabled,
  elements.networkInterval,
  elements.networkFailureThreshold,
  elements.networkNotifyInternet,
  elements.networkNotifyPerakam,
  elements.networkNotifyRecovery,
  elements.networkCaptiveDetection,
  elements.networkRetainPortalEvidence
].forEach((input) => {
  input.addEventListener("change", markNetworkSettingsDirty);
  input.addEventListener("input", markNetworkSettingsDirty);
});
elements.networkSaveSettings.addEventListener("click", () => {
  void saveNetworkMonitorSettings();
});
elements.networkCheckNow.addEventListener("click", () => {
  void checkNetworkNow();
});
elements.portalOpen.addEventListener("click", () => {
  void openDetectedPortalPage();
});
elements.portalCopy.addEventListener("click", () => {
  void copyDetectedPortalUrl();
});
elements.perakamLoginForm.addEventListener("submit", (event) => {
  event.preventDefault();
});
elements.perakamLoginEnabled.addEventListener("change", markPerakamLoginFormDirty);
elements.perakamLoginUsername.addEventListener("input", markPerakamLoginFormDirty);
elements.perakamLoginPassword.addEventListener("input", markPerakamLoginFormDirty);
elements.savePerakamLogin.addEventListener("click", () => {
  void savePerakamAutoLoginSettings();
});
elements.clearPerakamLogin.addEventListener("click", () => {
  void clearPerakamAutoLoginCredentials();
});
elements.testPerakamLogin.addEventListener("click", () => {
  void testPerakamAutoLogin();
});
elements.testClickForm.addEventListener("submit", (event) => {
  event.preventDefault();
});
elements.testClickTarget.addEventListener("change", () => {
  if (latestSnapshot) {
    renderTestClick(latestSnapshot);
  }
});
elements.testClickInspect.addEventListener("click", () => {
  void runTestClickAction(() => window.alilos.inspectTestClickTargets());
});
elements.testClickCheck.addEventListener("click", () => {
  void runTestClickAction(() => window.alilos.checkTestClickReadiness(readSelectedTestClickTarget()));
});
elements.testClickRequest.addEventListener("click", () => {
  void runTestClickAction(() => window.alilos.createTestClickConfirmation(readSelectedTestClickTarget()));
});
elements.testClickAccept.addEventListener("click", () => {
  void runActiveTestClickConfirmationAction((id) => window.alilos.acceptTestClickConfirmation(id));
});
elements.testClickCancel.addEventListener("click", () => {
  void runActiveTestClickConfirmationAction((id) => window.alilos.cancelTestClickConfirmation(id));
});
elements.testClickDryRunButton.addEventListener("click", () => {
  void runActiveTestClickConfirmationAction((id) => window.alilos.runTestClickDryRun(id));
});
elements.testClickRun.addEventListener("click", () => {
  void runActiveTestClickConfirmationAction((id) => window.alilos.runManualTestClick(id));
});
elements.telegramForm.addEventListener("submit", (event) => {
  event.preventDefault();
});
elements.saveTelegramSettingsButton.addEventListener("click", () => {
  void saveTelegramSettings();
});
elements.sendTelegramTest.addEventListener("click", () => {
  void sendTelegramTestNotification();
});
elements.settingsForm.addEventListener("submit", (event) => {
  event.preventDefault();
});
[
  elements.settingsWorkerEnabled,
  elements.settingsLaunchAtLogin,
  elements.settingsWorkerInterval,
  elements.settingsExecutionMode,
  elements.settingsAutomationInterval,
  elements.settingsPrepareBrowser,
  elements.settingsMorningStart,
  elements.settingsMorningEnd,
  elements.settingsEveningStart,
  elements.settingsEveningEnd,
  elements.settingsGracePeriod,
  elements.settingsRemindersEnabled,
  elements.settingsReminderApproaching,
  elements.settingsSystemNotifications,
  elements.settingsDashboardUrl,
  elements.settingsHeartbeatEnabled,
  elements.settingsHeartbeatEndpoint,
  elements.settingsHeartbeatInterval
].forEach((input) => {
  input.addEventListener("change", markAppSettingsDirty);
  input.addEventListener("input", markAppSettingsDirty);
});
elements.settingsSave.addEventListener("click", () => {
  void saveAppSettings();
});
elements.settingsReload.addEventListener("click", () => {
  void loadAppSettings({ force: true });
});

function runScheduleAction(action: () => Promise<RendererDashboardSnapshot>): void {
  setControlsDisabled(true);
  action()
    .then(render)
    .finally(() => setControlsDisabled(false));
}

function setControlsDisabled(disabled: boolean): void {
  elements.skipToday.disabled = disabled;
  elements.unskipToday.disabled = disabled;
  elements.skipTomorrow.disabled = disabled;
  elements.unskipTomorrow.disabled = disabled;
}

function renderConfirmations(confirmations: RendererConfirmationDashboardSnapshot): void {
  renderConfirmation("clock-in", confirmations.clockIn, {
    readiness: elements.clockInReadiness,
    reason: elements.clockInReason,
    schedule: elements.clockInSchedule,
    control: elements.clockInControl,
    confirmation: elements.clockInConfirmation,
    expires: elements.clockInExpires,
    dryRun: elements.clockInDryRun,
    dryRunChecks: elements.clockInDryRunChecks,
    execution: elements.clockInExecution,
    completed: elements.clockInCompleted,
    request: elements.clockInRequestConfirmation,
    accept: elements.clockInAcceptConfirmation,
    cancel: elements.clockInCancelConfirmation,
    runDryRun: elements.clockInRunDryRun,
    execute: elements.clockInExecute,
    manualVerify: elements.clockInManualVerify
  });
  renderConfirmation("clock-out", confirmations.clockOut, {
    readiness: elements.clockOutReadiness,
    reason: elements.clockOutReason,
    schedule: elements.clockOutSchedule,
    control: elements.clockOutControl,
    confirmation: elements.clockOutConfirmation,
    expires: elements.clockOutExpires,
    dryRun: elements.clockOutDryRun,
    dryRunChecks: elements.clockOutDryRunChecks,
    execution: elements.clockOutExecution,
    completed: elements.clockOutCompleted,
    request: elements.clockOutRequestConfirmation,
    accept: elements.clockOutAcceptConfirmation,
    cancel: elements.clockOutCancelConfirmation,
    runDryRun: elements.clockOutRunDryRun,
    execute: elements.clockOutExecute,
    manualVerify: elements.clockOutManualVerify
  });
}

function renderConfirmation(
  action: RendererAttendanceActionType,
  readiness: RendererConfirmationDashboardSnapshot["clockIn"],
  controls: {
    readiness: HTMLElement;
    reason: HTMLElement;
    schedule: HTMLElement;
    control: HTMLElement;
    confirmation: HTMLElement;
    expires: HTMLElement;
    dryRun: HTMLElement;
    dryRunChecks: HTMLOListElement;
    execution: HTMLElement;
    completed: HTMLElement;
    request: HTMLButtonElement;
    accept: HTMLButtonElement;
    cancel: HTMLButtonElement;
    runDryRun: HTMLButtonElement;
    execute: HTMLButtonElement;
    manualVerify: HTMLButtonElement;
  }
): void {
  const request = readiness.activeConfirmation;
  const pending = request?.status === "pending";
  const accepted = request?.status === "accepted";
  const inFlight = request?.status === "in-flight";
  const used = request?.status === "used";
  const expired = request ? new Date(request.expiresAt).getTime() <= Date.now() : true;
  const dryRunPassed = readiness.latestDryRun?.confirmationId === request?.id && readiness.latestDryRun?.status === "passed";
  const completed = Boolean(readiness.completed);
  const canManuallyVerify = Boolean(readiness.completed && readiness.completed.state !== "manually-verified" && readiness.completed.state !== "not-attempted");

  controls.readiness.textContent = readiness.ready ? "Ready to confirm" : "Not ready";
  controls.readiness.dataset.state = readiness.state;
  controls.reason.textContent = confirmationReasonText(readiness);
  controls.schedule.textContent = `${readiness.generatedScheduleTime} - ${statusLabel(readiness.schedulerStatus)}`;
  controls.control.textContent = `${availabilityLabel(readiness.controlAvailability.availability)} - ${readiness.controlAvailability.reason}`;
  controls.confirmation.textContent = request ? confirmationStatusText(request.status) : "No confirmation requested.";
  controls.expires.textContent = request ? formatOptionalTime(request.expiresAt) : "--";
  renderDryRunResult(readiness.latestDryRun, controls.dryRun, controls.dryRunChecks);
  renderExecutionResult(readiness.latestExecution, controls.execution);
  controls.completed.textContent = readiness.completed
    ? `${completionStateLabel(readiness.completed.state)} ${new Date(readiness.completed.completedAt).toLocaleTimeString()} via ${readiness.completed.mappedTargetId}. ${readiness.completed.verification?.reason ?? "Please visually confirm in the Perakam browser."}`
    : "Not completed today.";
  controls.completed.dataset.status = readiness.completed ? "passed" : "not-started";
  controls.request.disabled = !readiness.ready || pending || accepted || inFlight || used || completed;
  controls.accept.disabled = !pending;
  controls.cancel.disabled = !pending;
  controls.runDryRun.disabled = !accepted || expired;
  controls.execute.disabled = !accepted || expired || !dryRunPassed || inFlight || used || completed;
  controls.manualVerify.disabled = !canManuallyVerify;
  controls.request.dataset.action = action;
}

async function acceptActiveConfirmation(action: RendererAttendanceActionType): Promise<void> {
  const snapshot = await window.alilos.getSnapshot();
  const request = action === "clock-in"
    ? snapshot.confirmations.clockIn.activeConfirmation
    : snapshot.confirmations.clockOut.activeConfirmation;

  if (!request) {
    return;
  }

  await runConfirmationAction(() => window.alilos.acceptConfirmation(request.id));
}

async function cancelActiveConfirmation(action: RendererAttendanceActionType): Promise<void> {
  const snapshot = await window.alilos.getSnapshot();
  const request = action === "clock-in"
    ? snapshot.confirmations.clockIn.activeConfirmation
    : snapshot.confirmations.clockOut.activeConfirmation;

  if (!request) {
    return;
  }

  await runConfirmationAction(() => window.alilos.cancelConfirmation(request.id));
}

async function runActiveDryRun(action: RendererAttendanceActionType): Promise<void> {
  const snapshot = await window.alilos.getSnapshot();
  const request = action === "clock-in"
    ? snapshot.confirmations.clockIn.activeConfirmation
    : snapshot.confirmations.clockOut.activeConfirmation;

  if (!request) {
    return;
  }

  await runConfirmationAction(() => window.alilos.runAttendanceDryRun(request.id));
}

async function runActiveAttendanceExecution(action: RendererAttendanceActionType): Promise<void> {
  const snapshot = await window.alilos.getSnapshot();
  const request = action === "clock-in"
    ? snapshot.confirmations.clockIn.activeConfirmation
    : snapshot.confirmations.clockOut.activeConfirmation;

  if (!request) {
    return;
  }

  await runConfirmationAction(() => window.alilos.runGuardedAttendanceClick(request.id));
}

async function markActiveAttendanceManuallyVerified(action: RendererAttendanceActionType): Promise<void> {
  const snapshot = await window.alilos.getSnapshot();
  const completion = action === "clock-in"
    ? snapshot.confirmations.clockIn.completed
    : snapshot.confirmations.clockOut.completed;

  if (!completion) {
    return;
  }

  await runConfirmationAction(() => window.alilos.markAttendanceManuallyVerified(completion.confirmationId));
}

async function runConfirmationAction(action: () => Promise<RendererDashboardSnapshot>): Promise<void> {
  setConfirmationControlsDisabled(true);

  try {
    render(await withTimeout(action(), "Confirmation request timed out."));
  } finally {
    render(await window.alilos.getSnapshot());
  }
}

function setConfirmationControlsDisabled(disabled: boolean): void {
  elements.clockInRequestConfirmation.disabled = disabled;
  elements.clockInAcceptConfirmation.disabled = disabled;
  elements.clockInCancelConfirmation.disabled = disabled;
  elements.clockInRunDryRun.disabled = disabled;
  elements.clockInExecute.disabled = disabled;
  elements.clockInManualVerify.disabled = disabled;
  elements.clockOutRequestConfirmation.disabled = disabled;
  elements.clockOutAcceptConfirmation.disabled = disabled;
  elements.clockOutCancelConfirmation.disabled = disabled;
  elements.clockOutRunDryRun.disabled = disabled;
  elements.clockOutExecute.disabled = disabled;
  elements.clockOutManualVerify.disabled = disabled;
}

function renderDryRunResult(
  result: RendererDryRunExecutionResult | null,
  summaryElement: HTMLElement,
  checksElement: HTMLOListElement
): void {
  if (!result) {
    summaryElement.textContent = "No dry-run yet.";
    summaryElement.dataset.status = "not-started";
    checksElement.replaceChildren(createEmptyListItem("No safety checks run yet."));
    return;
  }

  const actionText = result.action ? actionLabel(result.action) : "Unknown action";
  const timeText = result.generatedScheduleTime ?? "--";
  const runAt = new Date(result.createdAt).toLocaleTimeString();
  summaryElement.textContent = `${dryRunStatusLabel(result.status)} - ${actionText} at ${timeText}. Ran ${runAt}. ${result.summary}`;
  summaryElement.dataset.status = result.status;

  const checkItems = result.safetyChecks.length > 0
    ? result.safetyChecks.map((check) => {
      const item = document.createElement("li");
      item.textContent = `${check.passed ? "Pass" : "Fail"} - ${check.name}: ${check.reason}`;
      item.dataset.status = check.passed ? "passed" : "rejected";
      return item;
    })
    : [createEmptyListItem("No checks recorded.")];

  if (result.rejectionReasons.length > 0) {
    const rejectionItem = document.createElement("li");
    rejectionItem.textContent = `Rejection reasons: ${result.rejectionReasons.join(", ")}`;
    rejectionItem.dataset.status = "rejected";
    checkItems.unshift(rejectionItem);
  }

  checksElement.replaceChildren(...checkItems);
}

function renderExecutionResult(
  result: RendererAttendanceExecutionResult | null,
  summaryElement: HTMLElement
): void {
  if (!result) {
    summaryElement.textContent = "No execution yet.";
    summaryElement.dataset.status = "not-started";
    return;
  }

  const actionText = result.action ? actionLabel(result.action) : "Unknown action";
  const targetText = result.mappedTargetId ?? "--";
  const runAt = new Date(result.createdAt).toLocaleTimeString();
  const verificationText = result.verification
    ? ` Verification: ${completionStateLabel(result.completionState ?? "verification-unknown")} - ${result.verification.reason}`
    : "";
  const evidenceText = result.verification?.evidenceSnippets.length
    ? ` Evidence: ${result.verification.evidenceSnippets.slice(0, 2).join(" | ")}`
    : "";
  summaryElement.textContent = `${executionStatusLabel(result.status)} - ${actionText} via ${targetText}. Ran ${runAt}. ${result.summary}${verificationText}${evidenceText}`;
  summaryElement.dataset.status = result.status === "succeeded" ? "passed" : result.status;
}

function actionLabel(action: RendererAttendanceActionType): string {
  return action === "clock-in" ? "Morning action" : "Evening action";
}

function dryRunStatusLabel(status: string): string {
  const labels = new Map<string, string>([
    ["not-started", "Not started"],
    ["rejected", "Rejected"],
    ["passed", "Passed"],
    ["failed", "Failed"]
  ]);

  return labels.get(status) ?? status;
}

function executionStatusLabel(status: string): string {
  const labels = new Map<string, string>([
    ["not-started", "Not started"],
    ["in-flight", "In flight"],
    ["rejected", "Rejected"],
    ["succeeded", "Succeeded"],
    ["failed", "Failed"]
  ]);

  return labels.get(status) ?? status;
}

function completionStateLabel(state: string): string {
  const labels = new Map<string, string>([
    ["not-attempted", "Not attempted"],
    ["click-attempted", "Click attempted"],
    ["click-succeeded-local", "Local click succeeded"],
    ["verification-pending", "Verification pending"],
    ["verified-success", "Verified success"],
    ["verification-unknown", "Verification unknown"],
    ["verification-failed", "Verification failed"],
    ["manually-verified", "Manually verified"]
  ]);

  return labels.get(state) ?? state;
}

function confirmationReasonText(readiness: RendererConfirmationDashboardSnapshot["clockIn"]): string {
  const request = readiness.activeConfirmation;

  if (request?.status === "expired") {
    return "Confirmation expired. Run a fresh readiness check before confirming again.";
  }

  if (request?.status === "cancelled") {
    return "Confirmation cancelled. No configured action was performed.";
  }

  if (request?.status === "accepted") {
    return "Confirmation accepted. You may run dry-run, then perform one real configured-target click if checks pass.";
  }

  if (request?.status === "in-flight") {
    return "Execution is in flight. Duplicate attempts are blocked.";
  }

  if (request?.status === "used") {
    return "Configured action completed. This confirmation cannot be reused.";
  }

  if (request?.status === "failed") {
    return "Execution failed. Start a fresh readiness and confirmation flow before retrying.";
  }

  return readiness.reasonText;
}

function confirmationStatusText(status: string): string {
  const labels = new Map<string, string>([
    ["pending", "Pending confirmation."],
    ["accepted", "Accepted. Ready for dry-run and guarded execution."],
    ["in-flight", "In flight. Duplicate execution is blocked."],
    ["used", "Used. Configured action completed."],
    ["failed", "Failed. Fresh confirmation required."],
    ["cancelled", "Cancelled. No configured action was performed."],
    ["expired", "Expired. Fresh readiness check required."]
  ]);

  return labels.get(status) ?? status;
}

function renderTestClick(snapshot: RendererDashboardSnapshot): void {
  const targetId = readSelectedTestClickTarget();
  const readiness = snapshot.testClick.targets[targetId];
  const request = snapshot.testClick.activeConfirmation?.targetId === targetId ? snapshot.testClick.activeConfirmation : null;
  const dryRun = snapshot.testClick.latestDryRun?.targetId === targetId ? snapshot.testClick.latestDryRun : null;
  const execution = snapshot.testClick.latestExecution?.targetId === targetId ? snapshot.testClick.latestExecution : null;
  const pending = request?.status === "pending";
  const accepted = request?.status === "accepted";
  const inFlight = request?.status === "in-flight";
  const used = request?.status === "used";
  const expired = request ? new Date(request.expiresAt).getTime() <= Date.now() : true;

  elements.testClickReadiness.textContent = readiness ? (readiness.ready ? "Ready" : "Not ready") : "Not checked";
  elements.testClickReadiness.dataset.status = readiness?.ready ? "passed" : "not-started";
  elements.testClickTargetStatus.textContent = readiness
    ? `${availabilityLabel(readiness.targetAvailability.availability)} - ${readiness.targetAvailability.reason}`
    : "Not checked.";
  elements.testClickConfirmation.textContent = request ? testClickConfirmationStatusText(request.status) : "No test-click confirmation requested.";
  elements.testClickExpires.textContent = request ? formatOptionalTime(request.expiresAt) : "--";
  elements.testClickDryRun.textContent = dryRun ? `${testClickResultStatusLabel(dryRun.status)} - ${dryRun.summary}` : "No test-click dry-run yet.";
  elements.testClickDryRun.dataset.status = dryRun?.status ?? "not-started";
  elements.testClickExecution.textContent = execution ? `${testClickResultStatusLabel(execution.status)} - ${execution.summary}` : "No test click performed.";
  elements.testClickExecution.dataset.status = execution?.status ?? "not-started";
  elements.testClickReason.textContent = readiness?.reasonText ?? "Check readiness before requesting confirmation.";

  const checks = dryRun?.safetyChecks ?? execution?.safetyChecks ?? [];
  const rejectionReasons = dryRun?.rejectionReasons ?? execution?.rejectionReasons ?? [];
  renderTestClickChecks(checks, rejectionReasons);
  renderTestClickDiagnostics(snapshot, targetId);

  elements.testClickRequest.disabled = !readiness?.ready || pending || accepted || inFlight || used;
  elements.testClickAccept.disabled = !pending;
  elements.testClickCancel.disabled = !pending;
  elements.testClickDryRunButton.disabled = !accepted || expired;
  elements.testClickRun.disabled = !accepted || expired;
}

function renderTestClickChecks(
  checks: Array<{ name: string; passed: boolean; reason: string }>,
  rejectionReasons: string[]
): void {
  const items = checks.length > 0
    ? checks.map((check) => {
      const item = document.createElement("li");
      item.textContent = `${check.passed ? "Pass" : "Fail"} - ${check.name}: ${check.reason}`;
      item.dataset.status = check.passed ? "passed" : "rejected";
      return item;
    })
    : [createEmptyListItem("No manual test-click safety checks run yet.")];

  if (rejectionReasons.length > 0) {
    const item = document.createElement("li");
    item.textContent = `Rejection reasons: ${rejectionReasons.join(", ")}`;
    item.dataset.status = "rejected";
    items.unshift(item);
  }

  elements.testClickChecks.replaceChildren(...items);
}

function renderTestClickDiagnostics(snapshot: RendererDashboardSnapshot, selectedTargetId: RendererTestClickTargetId): void {
  const diagnostics = snapshot.testClick.diagnostics;

  if (!diagnostics) {
    elements.testClickDiagnostics.replaceChildren(createEmptyListItem("No diagnostics inspected yet."));
    return;
  }

  const targetIds: RendererTestClickTargetId[] = ["a56", "a57"];
  const items = targetIds.flatMap((targetId) => {
    const candidates = diagnostics.targets[targetId];

    if (candidates.length === 0) {
      const missing = document.createElement("li");
      missing.textContent = `${targetId}: 0 candidates found. Target is missing from the current page DOM.`;
      missing.dataset.status = targetId === selectedTargetId ? "rejected" : "not-started";
      return [missing];
    }

    const visibleCount = candidates.filter((candidate) => candidate.ownVisible || candidate.meaningfulDescendantVisible).length;
    const hiddenSidebarCount = candidates.filter((candidate) => candidate.insideChildMenu || candidate.insideSidebarMenu || candidate.insideLeftCol).length;
    const disabledCount = candidates.filter((candidate) => candidate.disabled).length;
    const availableCount = candidates.filter((candidate) => candidate.detectorDecision === "available").length;
    const firstReason = candidates.find((candidate) => candidate.detectorDecision !== "available")?.rejectionReason ?? candidates[0].rejectionReason;
    const summary = document.createElement("li");
    summary.textContent = `${targetId}: ${candidates.length} candidate(s); ${visibleCount} visible; ${hiddenSidebarCount} sidebar/hidden-location; ${disabledCount} disabled; ${availableCount} accepted. ${firstReason}`;
    summary.dataset.status = availableCount > 0 ? "passed" : "rejected";

    const details = candidates.slice(0, 4).map((candidate) => {
      const item = document.createElement("li");
      const location = candidate.insideChildMenu || candidate.insideSidebarMenu || candidate.insideLeftCol
        ? "sidebar"
        : candidate.insideRightCol || candidate.insideTopTiles
          ? "main content"
          : "unknown location";
      const rect = `${candidate.boundingRect.width}x${candidate.boundingRect.height}`;
      item.textContent = `${targetId} #${candidate.candidateIndex}: ${candidate.tagName}; ${location}; display=${candidate.computedDisplay}; visibility=${candidate.computedVisibility}; rect=${rect}; text="${candidate.textSnippet ?? ""}"; decision=${candidate.detectorDecision}; ${candidate.rejectionReason}`;
      item.dataset.status = candidate.detectorDecision === "available" ? "passed" : "rejected";
      return item;
    });

    return [summary, ...details];
  });

  elements.testClickDiagnostics.replaceChildren(...items);
}

async function runActiveTestClickConfirmationAction(
  action: (id: string) => Promise<RendererDashboardSnapshot>
): Promise<void> {
  const snapshot = await window.alilos.getSnapshot();
  const targetId = readSelectedTestClickTarget();
  const request = snapshot.testClick.activeConfirmation?.targetId === targetId ? snapshot.testClick.activeConfirmation : null;

  if (!request) {
    return;
  }

  await runTestClickAction(() => action(request.id));
}

async function runTestClickAction(action: () => Promise<RendererDashboardSnapshot>): Promise<void> {
  setTestClickControlsDisabled(true);

  try {
    render(await withTimeout(action(), "Manual test-click request timed out."));
  } finally {
    render(await window.alilos.getSnapshot());
  }
}

function setTestClickControlsDisabled(disabled: boolean): void {
  elements.testClickTarget.disabled = disabled;
  elements.testClickInspect.disabled = disabled;
  elements.testClickCheck.disabled = disabled;
  elements.testClickRequest.disabled = disabled;
  elements.testClickAccept.disabled = disabled;
  elements.testClickCancel.disabled = disabled;
  elements.testClickDryRunButton.disabled = disabled;
  elements.testClickRun.disabled = disabled;
}

function readSelectedTestClickTarget(): RendererTestClickTargetId {
  return elements.testClickTarget.value === "a57" ? "a57" : "a56";
}

function testClickConfirmationStatusText(status: string): string {
  const labels = new Map<string, string>([
    ["pending", "Pending test-click confirmation."],
    ["accepted", "Accepted. No test click has run yet."],
    ["in-flight", "In flight. Execution claim is active; duplicate runs are blocked."],
    ["cancelled", "Cancelled. No test click was performed."],
    ["expired", "Expired. Fresh readiness check required."],
    ["used", "Used. This confirmation cannot run again."],
    ["failed", "Failed. Fresh readiness and confirmation are required before another attempt."]
  ]);

  return labels.get(status) ?? status;
}

function testClickResultStatusLabel(status: string): string {
  const labels = new Map<string, string>([
    ["not-started", "Not started"],
    ["rejected", "Rejected"],
    ["passed", "Passed"],
    ["failed", "Failed"],
    ["succeeded", "Succeeded"]
  ]);

  return labels.get(status) ?? status;
}

async function runBrowserAction(action: () => Promise<RendererBrowserStatusSnapshot>): Promise<void> {
  setBrowserControlsDisabled(true);

  try {
    await withTimeout(action(), "Browser controller request timed out.");
    render(await window.alilos.getSnapshot());
  } finally {
    setBrowserControlsDisabled(false);
  }
}

function updateBrowserButtons(state: string): void {
  const busy = state === "starting" || state === "stopping";
  elements.startBrowser.disabled = busy || state === "running";
  elements.stopBrowser.disabled = busy || state === "stopped";
  updatePerakamButtons(state, elements.perakamDetailStatus.dataset.status ?? "not-opened");
}

function setBrowserControlsDisabled(disabled: boolean): void {
  elements.startBrowser.disabled = disabled;
  elements.stopBrowser.disabled = disabled;
}

async function runPerakamAction(action: () => Promise<RendererPerakamStatusSnapshot>): Promise<void> {
  setPerakamControlsDisabled(true);

  try {
    await withTimeout(action(), "Perakam status request timed out.");
    render(await window.alilos.getSnapshot());
  } finally {
    setPerakamControlsDisabled(false);
  }
}

function renderNetworkMonitor(snapshot: RendererNetworkMonitorSnapshot): void {
  elements.networkInternetStatus.textContent = networkConnectivityLabel(snapshot.connectivityState);
  elements.networkInternetStatus.dataset.status = snapshot.connectivityState;
  elements.networkInternetReason.textContent = snapshot.internetCheckReason;
  elements.networkPerakamStatus.textContent = perakamReachabilityLabel(snapshot.perakamReachabilityState);
  elements.networkPerakamStatus.dataset.status = snapshot.perakamReachabilityState;
  elements.networkPerakamReason.textContent = snapshot.perakamCheckReason;
  elements.networkLastChecked.textContent = formatOptionalTime(snapshot.checkedAt);
  elements.networkLastInternet.textContent = formatOptionalTime(snapshot.lastSuccessfulInternetAt);
  elements.networkLastPerakam.textContent = formatOptionalTime(snapshot.lastSuccessfulPerakamAt);
  elements.networkFailures.textContent = String(snapshot.consecutiveFailures);
  elements.networkError.textContent = snapshot.sanitizedError ?? "--";
  elements.portalState.textContent = captivePortalStateLabel(snapshot.captivePortal.state);
  elements.portalState.dataset.status = snapshot.captivePortal.state;
  elements.portalConfidence.textContent = `Confidence: ${snapshot.captivePortal.confidence}`;
  elements.portalHost.textContent = snapshot.captivePortal.portalHost ?? "--";
  elements.portalUrl.textContent = snapshot.captivePortal.portalUrl ?? "--";
  elements.portalTitle.textContent = snapshot.captivePortal.sanitizedTitle ?? "--";
  elements.portalOpen.disabled = !snapshot.captivePortal.portalUrl;
  elements.portalCopy.disabled = !snapshot.captivePortal.portalUrl;
  elements.portalEvidence.replaceChildren(
    ...(snapshot.captivePortal.evidence.length > 0
      ? snapshot.captivePortal.evidence.map((evidence) => {
        const item = document.createElement("li");
        item.textContent = evidence;
        return item;
      })
      : [createEmptyListItem("No captive portal evidence detected.")])
  );

  if (!networkSettingsDirty) {
    applyNetworkSettingsToForm(snapshot.settings);
  }
}

async function checkNetworkNow(): Promise<void> {
  setNetworkControlsDisabled(true);
  setNetworkResult("Checking network and Perakam reachability.", "neutral");

  try {
    render(await withTimeout(window.alilos.checkNetworkNow(), "Network check timed out."));
    setNetworkResult(`Network check completed at ${new Date().toLocaleTimeString()}.`, "success");
  } catch (error) {
    setNetworkResult(error instanceof Error ? error.message : "Unable to check network now.", "error");
  } finally {
    setNetworkControlsDisabled(false);
  }
}

async function openDetectedPortalPage(): Promise<void> {
  setNetworkControlsDisabled(true);
  setNetworkResult("Opening detected portal page.", "neutral");

  try {
    render(await withTimeout(window.alilos.openDetectedPortalPage(), "Opening detected portal page timed out."));
    setNetworkResult("Detected portal page opened externally.", "success");
  } catch (error) {
    setNetworkResult(error instanceof Error ? error.message : "Unable to open detected portal page.", "error");
  } finally {
    setNetworkControlsDisabled(false);
  }
}

async function copyDetectedPortalUrl(): Promise<void> {
  setNetworkControlsDisabled(true);
  setNetworkResult("Copying detected portal URL.", "neutral");

  try {
    const result = await withTimeout(window.alilos.copyDetectedPortalUrl(), "Copying detected portal URL timed out.");
    setNetworkResult(result.message, result.ok ? "success" : "error");
  } catch (error) {
    setNetworkResult(error instanceof Error ? error.message : "Unable to copy detected portal URL.", "error");
  } finally {
    setNetworkControlsDisabled(false);
  }
}

async function saveNetworkMonitorSettings(): Promise<void> {
  setNetworkControlsDisabled(true);
  setNetworkResult("Saving network monitor settings.", "neutral");

  try {
    const settings = await withTimeout(window.alilos.saveNetworkMonitorSettings(readNetworkMonitorSettings()), "Saving network monitor settings timed out.");
    networkSettingsDirty = false;
    applyNetworkSettingsToForm(settings);
    setNetworkResult(`Network monitor settings saved at ${new Date().toLocaleTimeString()}.`, "success");
  } catch (error) {
    setNetworkResult(error instanceof Error ? error.message : "Unable to save network monitor settings.", "error");
  } finally {
    setNetworkControlsDisabled(false);
  }
}

function readNetworkMonitorSettings(): Partial<RendererNetworkMonitorSettings> {
  return {
    enabled: elements.networkEnabled.checked,
    intervalSeconds: Number(elements.networkInterval.value),
    failureThreshold: Number(elements.networkFailureThreshold.value),
    notifyOnInternetDown: elements.networkNotifyInternet.checked,
    notifyOnPerakamDown: elements.networkNotifyPerakam.checked,
    notifyOnRecovery: elements.networkNotifyRecovery.checked,
    captivePortalDetectionEnabled: elements.networkCaptiveDetection.checked,
    openDetectedPortalIn: "external",
    retainPortalEvidenceMinutes: Number(elements.networkRetainPortalEvidence.value)
  };
}

function applyNetworkSettingsToForm(settings: RendererNetworkMonitorSettings): void {
  elements.networkEnabled.checked = settings.enabled;
  elements.networkInterval.value = String(settings.intervalSeconds);
  elements.networkFailureThreshold.value = String(settings.failureThreshold);
  elements.networkNotifyInternet.checked = settings.notifyOnInternetDown;
  elements.networkNotifyPerakam.checked = settings.notifyOnPerakamDown;
  elements.networkNotifyRecovery.checked = settings.notifyOnRecovery;
  elements.networkCaptiveDetection.checked = settings.captivePortalDetectionEnabled;
  elements.networkRetainPortalEvidence.value = String(settings.retainPortalEvidenceMinutes);
}

function setNetworkControlsDisabled(disabled: boolean): void {
  elements.networkCheckNow.disabled = disabled;
  elements.networkEnabled.disabled = disabled;
  elements.networkInterval.disabled = disabled;
  elements.networkFailureThreshold.disabled = disabled;
  elements.networkNotifyInternet.disabled = disabled;
  elements.networkNotifyPerakam.disabled = disabled;
  elements.networkNotifyRecovery.disabled = disabled;
  elements.networkCaptiveDetection.disabled = disabled;
  elements.networkRetainPortalEvidence.disabled = disabled;
  elements.networkSaveSettings.disabled = disabled;
  elements.portalOpen.disabled = disabled || !latestSnapshot?.networkMonitor.captivePortal.portalUrl;
  elements.portalCopy.disabled = disabled || !latestSnapshot?.networkMonitor.captivePortal.portalUrl;
}

function setNetworkResult(message: string, tone: "neutral" | "success" | "error"): void {
  elements.networkResult.textContent = message;
  elements.networkResult.dataset.tone = tone;
}

function markNetworkSettingsDirty(): void {
  if (elements.networkSaveSettings.disabled) {
    return;
  }

  networkSettingsDirty = true;
  setNetworkResult("Unsaved network monitor settings.", "neutral");
}

function networkConnectivityLabel(state: string): string {
  const labels = new Map<string, string>([
    ["checking", "Checking"],
    ["online", "Online"],
    ["offline", "Offline"],
    ["local-network-only", "Local network only"],
    ["captive-portal-suspected", "Captive portal suspected"],
    ["captive-portal-detected", "Captive portal detected"],
    ["unknown", "Unknown"],
    ["error", "Error"]
  ]);

  return labels.get(state) ?? state;
}

function captivePortalStateLabel(state: string): string {
  const labels = new Map<string, string>([
    ["not-detected", "Not detected"],
    ["suspected", "Suspected"],
    ["detected", "Detected"],
    ["unknown", "Unknown"]
  ]);

  return labels.get(state) ?? state;
}

function perakamReachabilityLabel(state: string): string {
  const labels = new Map<string, string>([
    ["checking", "Checking"],
    ["reachable", "Reachable"],
    ["unreachable", "Unreachable"],
    ["login-required", "Login page reachable"],
    ["stale-session", "Stale-session page reachable"],
    ["dashboard", "Dashboard markers reachable"],
    ["unknown", "Unknown"],
    ["error", "Error"]
  ]);

  return labels.get(state) ?? state;
}

function renderPerakamStatus(status: RendererPerakamStatusSnapshot, browserState: string): void {
  elements.perakamStatus.textContent = perakamStatusLabel(status.status);
  elements.perakamNote.textContent = status.lastError
    ?? `${status.statusReason}${status.lastCheckedAt ? ` Checked ${new Date(status.lastCheckedAt).toLocaleTimeString()}` : ""}`;
  elements.perakamConfiguredUrl.textContent = status.dashboardUrl;
  elements.perakamUrlNote.textContent = buildPerakamUrlNote(status.dashboardUrl, status.legacyDashboardUrl);
  elements.perakamDetailStatus.textContent = `${perakamStatusLabel(status.status)} - ${status.statusReason}`;
  elements.perakamDetailStatus.dataset.status = status.status;
  elements.perakamClockInAvailability.textContent = availabilityLabel(status.clockInAvailable);
  elements.perakamClockInAvailability.dataset.availability = status.clockInAvailable;
  elements.perakamClockInReason.textContent = status.clockInReason;
  elements.perakamClockOutAvailability.textContent = availabilityLabel(status.clockOutAvailable);
  elements.perakamClockOutAvailability.dataset.availability = status.clockOutAvailable;
  elements.perakamClockOutReason.textContent = status.clockOutReason;
  elements.perakamLastButtonCheck.textContent = formatOptionalTime(status.lastButtonCheckAt);
  elements.perakamCurrentUrl.textContent = status.currentUrl ?? "--";
  elements.perakamPageTitle.textContent = status.pageTitle ?? "--";
  elements.perakamLastNavigation.textContent = formatOptionalTime(status.lastNavigationAt);
  elements.perakamLastChecked.textContent = formatOptionalTime(status.lastCheckedAt);
  elements.perakamLastError.textContent = status.lastError ?? "--";
  updatePerakamButtons(browserState, status.status);
}

function updatePerakamButtons(browserState: string, perakamState: string): void {
  const browserBusy = browserState === "starting" || browserState === "stopping";
  const perakamBusy = perakamState === "loading";
  elements.openPerakam.disabled = browserBusy || perakamBusy;
  elements.refreshPerakam.disabled = browserBusy || perakamBusy || browserState === "stopped";
}

function setPerakamControlsDisabled(disabled: boolean): void {
  elements.openPerakam.disabled = disabled;
  elements.refreshPerakam.disabled = disabled;
}

function perakamStatusLabel(status: string): string {
  const labels = new Map<string, string>([
    ["not-opened", "Not opened"],
    ["loading", "Loading"],
    ["reachable", "Reachable"],
    ["dashboard", "Dashboard detected"],
    ["login-required", "Login required"],
    ["stale-session", "Session stale"],
    ["likely-logged-in", "Likely logged in"],
    ["likely-login-required", "Likely login required"],
    ["unknown", "Unknown"],
    ["error", "Error"]
  ]);

  return labels.get(status) ?? status;
}

function availabilityLabel(availability: string): string {
  const labels = new Map<string, string>([
    ["available", "Available"],
    ["unavailable", "Unavailable"],
    ["unknown", "Unknown"]
  ]);

  return labels.get(availability) ?? availability;
}

function statusLabel(status: string): string {
  const labels = new Map<string, string>([
    ["upcoming", "Upcoming"],
    ["due-now", "Due now"],
    ["within-grace-period", "Within grace period"],
    ["missed", "Missed"],
    ["skipped", "Skipped"],
    ["weekend", "Weekend"]
  ]);

  return labels.get(status) ?? status;
}

function formatOptionalTime(value: string | null): string {
  return value ? new Date(value).toLocaleString() : "--";
}

function buildPerakamUrlNote(configuredUrl: string, legacyUrl: string): string {
  return normalizeUrlForCompare(configuredUrl) === normalizeUrlForCompare(legacyUrl)
    ? "Using older Perakam endpoint."
    : `Configured endpoint differs from older ${legacyUrl}`;
}

function normalizeUrlForCompare(url: string): string {
  return url.trim().replace(/\/+$/, "").toLowerCase();
}

function renderPerakamAutoLogin(settings: RendererPerakamAutoLoginSnapshot, options: { forceFormSync?: boolean } = {}): void {
  currentPerakamLoginSettings = settings;
  if (options.forceFormSync || !perakamLoginFormDirty) {
    elements.perakamLoginEnabled.checked = settings.enabled;
    elements.perakamLoginUsername.value = settings.username;
  }

  elements.perakamLoginPasswordState.textContent = settings.hasSavedPassword ? "Password saved locally" : "No password saved";
  elements.perakamLoginLastResult.textContent = `${settings.lastLoginResult}${settings.lastLoginReason ? ` - ${settings.lastLoginReason}` : ""}`;
  if (!perakamLoginFormDirty || options.forceFormSync) {
    setPerakamLoginResult(
      settings.secureStorageAvailable
        ? "UPM credentials are stored locally on this Windows user profile. Captive portal login is not enabled in this phase."
        : "Secure local password storage is unavailable on this device.",
      settings.secureStorageAvailable ? "neutral" : "error"
    );
  }
}

function readPerakamAutoLoginInput(): RendererPerakamAutoLoginInput {
  return {
    enabled: elements.perakamLoginEnabled.checked,
    username: elements.perakamLoginUsername.value,
    password: elements.perakamLoginPassword.value || undefined
  };
}

async function savePerakamAutoLoginSettings(): Promise<void> {
  setPerakamLoginControlsDisabled(true);
  setPerakamLoginResult("Saving UPM credentials used for Perakam login.", "neutral");

  try {
    const result = await withTimeout(window.alilos.savePerakamAutoLoginSettings(readPerakamAutoLoginInput()), "Saving UPM credentials timed out.");
    elements.perakamLoginPassword.value = "";
    perakamLoginFormDirty = false;
    renderPerakamAutoLogin(result, { forceFormSync: true });
    setPerakamLoginResult(`UPM credentials saved at ${new Date().toLocaleTimeString()}.`, "success");
  } catch (error) {
    setPerakamLoginResult(error instanceof Error ? error.message : "Unable to save UPM credentials.", "error");
  } finally {
    setPerakamLoginControlsDisabled(false);
  }
}

async function clearPerakamAutoLoginCredentials(): Promise<void> {
  setPerakamLoginControlsDisabled(true);
  setPerakamLoginResult("Clearing saved UPM credentials.", "neutral");

  try {
    const result = await withTimeout(window.alilos.clearPerakamAutoLoginCredentials(), "Clearing UPM credentials timed out.");
    elements.perakamLoginPassword.value = "";
    perakamLoginFormDirty = false;
    renderPerakamAutoLogin(result, { forceFormSync: true });
    setPerakamLoginResult("Saved UPM credentials cleared.", "success");
  } catch (error) {
    setPerakamLoginResult(error instanceof Error ? error.message : "Unable to clear UPM credentials.", "error");
  } finally {
    setPerakamLoginControlsDisabled(false);
  }
}

async function testPerakamAutoLogin(): Promise<void> {
  setPerakamLoginControlsDisabled(true);
  setPerakamLoginResult("Testing Perakam login.", "neutral");

  try {
    const snapshot = await withTimeout(window.alilos.testPerakamAutoLogin(readPerakamAutoLoginInput()), "Perakam login test timed out.");
    elements.perakamLoginPassword.value = "";
    perakamLoginFormDirty = false;
    render(snapshot);
    setPerakamLoginResult(snapshot.perakamAutoLogin.lastLoginReason ?? "Perakam login test completed.", snapshot.perakamAutoLogin.lastLoginResult === "success" ? "success" : "error");
  } catch (error) {
    setPerakamLoginResult(error instanceof Error ? error.message : "Unable to test Perakam login.", "error");
  } finally {
    setPerakamLoginControlsDisabled(false);
  }
}

function setPerakamLoginControlsDisabled(disabled: boolean): void {
  elements.perakamLoginEnabled.disabled = disabled;
  elements.perakamLoginUsername.disabled = disabled;
  elements.perakamLoginPassword.disabled = disabled;
  elements.savePerakamLogin.disabled = disabled;
  elements.clearPerakamLogin.disabled = disabled;
  elements.testPerakamLogin.disabled = disabled;
}

function setPerakamLoginResult(message: string, tone: "neutral" | "success" | "error"): void {
  elements.perakamLoginResult.textContent = message;
  elements.perakamLoginResult.dataset.tone = tone;
}

function markPerakamLoginFormDirty(): void {
  if (elements.perakamLoginEnabled.disabled) {
    return;
  }

  perakamLoginFormDirty = true;
  setPerakamLoginResult("Unsaved Perakam auto-login changes.", "neutral");
}

async function loadAppSettings(options: { force?: boolean } = {}): Promise<void> {
  if (appSettingsDirty && !options.force) {
    return;
  }

  setAppSettingsControlsDisabled(true);
  setSettingsResult("Loading app settings.", "neutral");

  try {
    const settings = await withTimeout(window.alilos.getAppSettings(), "Loading app settings timed out.");
    appSettingsDirty = false;
    renderAppSettings(settings, { force: true });
    setSettingsResult("Settings loaded.", "success");
  } catch (error) {
    setSettingsResult(error instanceof Error ? error.message : "Unable to load app settings.", "error");
  } finally {
    setAppSettingsControlsDisabled(false);
  }
}

async function saveAppSettings(): Promise<void> {
  setAppSettingsControlsDisabled(true);
  setSettingsResult("Saving app settings.", "neutral");

  try {
    const settings = await withTimeout(window.alilos.saveAppSettings(readAppSettings()), "Saving app settings timed out.");
    appSettingsDirty = false;
    renderAppSettings(settings, { force: true });
    render(await window.alilos.getSnapshot());
    setSettingsResult(`Settings saved at ${new Date().toLocaleTimeString()}.`, "success");
  } catch (error) {
    setSettingsResult(error instanceof Error ? error.message : "Unable to save app settings.", "error");
  } finally {
    setAppSettingsControlsDisabled(false);
  }
}

function renderAppSettings(settings: RendererAppSettingsSnapshot, options: { force?: boolean } = {}): void {
  currentAppSettings = settings;

  if (!appSettingsDirty || options.force) {
    elements.settingsWorkerEnabled.checked = settings.worker.enabled;
    elements.settingsLaunchAtLogin.checked = settings.startup.launchAtLogin;
    elements.settingsWorkerInterval.value = String(settings.worker.pollIntervalSeconds);
    elements.settingsExecutionMode.value = settings.automation.executionMode;
    elements.settingsAutomationInterval.value = String(settings.automation.monitorIntervalSeconds);
    elements.settingsPrepareBrowser.checked = settings.automation.prepareBrowserInDryRun;
    elements.settingsMorningStart.value = settings.scheduler.clockInWindow.start;
    elements.settingsMorningEnd.value = settings.scheduler.clockInWindow.end;
    elements.settingsEveningStart.value = settings.scheduler.clockOutWindow.start;
    elements.settingsEveningEnd.value = settings.scheduler.clockOutWindow.end;
    elements.settingsGracePeriod.value = String(settings.scheduler.gracePeriodMinutes);
    elements.settingsRemindersEnabled.checked = settings.scheduler.reminders.enabled;
    elements.settingsReminderApproaching.value = String(settings.scheduler.reminders.approachingMinutes);
    elements.settingsSystemNotifications.checked = settings.scheduler.reminders.systemNotificationsEnabled;
    elements.settingsDashboardUrl.value = settings.perakam.dashboardUrl;
    elements.settingsHeartbeatEnabled.checked = settings.heartbeat.enabled;
    elements.settingsHeartbeatEndpoint.value = "";
  elements.settingsHeartbeatEndpoint.placeholder = settings.heartbeat.configured
      ? "Configured - leave blank to keep"
      : "Not configured";
    elements.settingsHeartbeatInterval.value = String(settings.heartbeat.intervalSeconds);
  }

  elements.settingsHeartbeatEndpointState.textContent = settings.heartbeat.configured
    ? `Configured for ${settings.heartbeat.endpointHost ?? "Supabase project"} with key ${telegramSecretStatusLabel(settings.heartbeat.keyStatus)}; leave blank to keep the current URL.`
    : `Supabase URL/key not configured; key ${telegramSecretStatusLabel(settings.heartbeat.keyStatus)}.`;

  if (latestSnapshot) {
    renderSettingsSummaries(latestSnapshot);
  }
}

function readAppSettings(): RendererAppSettingsInput {
  validateTimePair(elements.settingsMorningStart.value, elements.settingsMorningEnd.value, "morning window");
  validateTimePair(elements.settingsEveningStart.value, elements.settingsEveningEnd.value, "evening window");

  const endpointUrl = elements.settingsHeartbeatEndpoint.value.trim();
  const heartbeat: RendererAppSettingsInput["heartbeat"] = {
    enabled: elements.settingsHeartbeatEnabled.checked,
    intervalSeconds: readPositiveNumber(elements.settingsHeartbeatInterval.value, "Heartbeat interval")
  };

  if (endpointUrl.length > 0) {
    heartbeat.endpointUrl = endpointUrl;
  }

  return {
    worker: {
      enabled: elements.settingsWorkerEnabled.checked,
      pollIntervalSeconds: readPositiveNumber(elements.settingsWorkerInterval.value, "Worker interval")
    },
    startup: {
      launchAtLogin: elements.settingsLaunchAtLogin.checked
    },
    automation: {
      executionMode: readExecutionMode(elements.settingsExecutionMode.value),
      monitorIntervalSeconds: readPositiveNumber(elements.settingsAutomationInterval.value, "Automation interval"),
      prepareBrowserInDryRun: elements.settingsPrepareBrowser.checked
    },
    scheduler: {
      clockInWindow: {
        start: elements.settingsMorningStart.value,
        end: elements.settingsMorningEnd.value
      },
      clockOutWindow: {
        start: elements.settingsEveningStart.value,
        end: elements.settingsEveningEnd.value
      },
      gracePeriodMinutes: readPositiveNumber(elements.settingsGracePeriod.value, "Grace period"),
      reminders: {
        enabled: elements.settingsRemindersEnabled.checked,
        approachingMinutes: readPositiveNumber(elements.settingsReminderApproaching.value, "Reminder lead time"),
        systemNotificationsEnabled: elements.settingsSystemNotifications.checked
      }
    },
    perakam: {
      dashboardUrl: elements.settingsDashboardUrl.value.trim()
    },
    heartbeat
  };
}

function setAppSettingsControlsDisabled(disabled: boolean): void {
  elements.settingsWorkerEnabled.disabled = disabled;
  elements.settingsLaunchAtLogin.disabled = disabled || !currentAppSettings?.startup.supported;
  elements.settingsWorkerInterval.disabled = disabled;
  elements.settingsExecutionMode.disabled = disabled;
  elements.settingsAutomationInterval.disabled = disabled;
  elements.settingsPrepareBrowser.disabled = disabled;
  elements.settingsMorningStart.disabled = disabled;
  elements.settingsMorningEnd.disabled = disabled;
  elements.settingsEveningStart.disabled = disabled;
  elements.settingsEveningEnd.disabled = disabled;
  elements.settingsGracePeriod.disabled = disabled;
  elements.settingsRemindersEnabled.disabled = disabled;
  elements.settingsReminderApproaching.disabled = disabled;
  elements.settingsSystemNotifications.disabled = disabled;
  elements.settingsDashboardUrl.disabled = disabled;
  elements.settingsHeartbeatEnabled.disabled = disabled;
  elements.settingsHeartbeatEndpoint.disabled = disabled;
  elements.settingsHeartbeatInterval.disabled = disabled;
  elements.settingsSave.disabled = disabled;
  elements.settingsReload.disabled = disabled;
}

function markAppSettingsDirty(): void {
  if (elements.settingsSave.disabled) {
    return;
  }

  appSettingsDirty = true;
  setSettingsResult("Unsaved app settings changes.", "neutral");
}

function setSettingsResult(message: string, tone: "neutral" | "success" | "error"): void {
  elements.settingsResult.textContent = message;
  elements.settingsResult.dataset.tone = tone;
}

function readExecutionMode(value: string): RendererAppSettingsInput["automation"]["executionMode"] {
  if (value === "notify-only" || value === "dry-run" || value === "manual-confirm") {
    return value;
  }

  throw new Error("Choose a valid execution mode.");
}

function readPositiveNumber(value: string, label: string): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive number.`);
  }

  return Math.round(parsed);
}

function validateTimePair(start: string, end: string, label: string): void {
  if (minutesFromTimeInput(start) >= minutesFromTimeInput(end)) {
    throw new Error(`The ${label} start time must be before its end time.`);
  }
}

function minutesFromTimeInput(value: string): number {
  const [hourText, minuteText] = value.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);

  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error("Time values must use HH:MM format.");
  }

  return hour * 60 + minute;
}

async function loadTelegramSettings(): Promise<void> {
  const settings = await window.alilos.getTelegramSettings();
  renderTelegramSettings(settings);
}

async function saveTelegramSettings(): Promise<void> {
  setTelegramControlsDisabled(true);
  setTelegramResult("Saving Telegram settings.", "neutral");

  try {
    const settings = await withTimeout(window.alilos.saveTelegramSettings(readTelegramSettings()), "Saving Telegram settings timed out.");
    renderTelegramSettings(settings);
    setTelegramResult(`Telegram settings saved at ${new Date().toLocaleTimeString()}.`, "success");
  } catch (error) {
    setTelegramResult(error instanceof Error ? error.message : "Unable to save Telegram settings.", "error");
  } finally {
    setTelegramControlsDisabled(false);
  }
}

async function sendTelegramTestNotification(): Promise<void> {
  setTelegramControlsDisabled(true);
  setTelegramResult("Sending Telegram test notification.", "neutral");

  try {
    await withTimeout(window.alilos.saveTelegramSettings(readTelegramSettings()), "Saving Telegram settings timed out.");
    const result = await withTimeout(window.alilos.sendTelegramTestNotification(), "Telegram test notification timed out.");
    renderTelegramTestResult(result);
  } catch (error) {
    setTelegramResult(error instanceof Error ? error.message : "Unable to send Telegram test notification.", "error");
  } finally {
    setTelegramControlsDisabled(false);
  }
}

function readTelegramSettings(): RendererTelegramSettingsInput {
  const botToken = elements.telegramBotToken.value.trim();
  const chatId = elements.telegramChatId.value.trim();
  const commandPrefix = elements.telegramCommandPrefixInput.value.trim() || currentTelegramSettings?.commandPrefix || "alilos";

  const settings: RendererTelegramSettingsInput = {
    enabled: elements.telegramEnabled.checked,
    commandPrefix
  };

  if (botToken) {
    settings.botToken = botToken;
  }

  if (chatId) {
    settings.chatId = chatId;
  }

  return settings;
}

function renderTelegramSettings(settings: RendererTelegramSettingsSnapshot): void {
  currentTelegramSettings = settings;
  elements.telegramEnabled.checked = settings.enabled;
  elements.telegramBotToken.value = "";
  elements.telegramBotToken.placeholder = `${telegramSecretStatusLabel(settings.secretStatus.botToken)} - leave blank to keep`;
  elements.telegramChatId.value = "";
  elements.telegramChatId.placeholder = `${telegramSecretStatusLabel(settings.secretStatus.chatId)} - leave blank to keep`;
  elements.telegramBotTokenStatus.textContent = telegramSecretStatusLabel(settings.secretStatus.botToken);
  elements.telegramChatIdStatus.textContent = telegramSecretStatusLabel(settings.secretStatus.chatId);
  elements.telegramCommandPrefixInput.value = settings.commandPrefix;
  elements.telegramCommandPrefix.textContent = commandPrefixLabel(settings.commandPrefix);

  if (latestSnapshot) {
    renderSettingsSummaries(latestSnapshot);
  }
}

function renderTelegramTestResult(result: RendererTelegramTestResult): void {
  setTelegramResult(result.message, result.ok ? "success" : "error");
}

function setTelegramControlsDisabled(disabled: boolean): void {
  elements.telegramEnabled.disabled = disabled;
  elements.telegramBotToken.disabled = disabled;
  elements.telegramChatId.disabled = disabled;
  elements.telegramCommandPrefixInput.disabled = disabled;
  elements.saveTelegramSettingsButton.disabled = disabled;
  elements.sendTelegramTest.disabled = disabled;
}

function setTelegramResult(message: string, tone: "neutral" | "success" | "error"): void {
  elements.telegramResult.textContent = message;
  elements.telegramResult.dataset.tone = tone;
}

function commandPrefixLabel(prefix: string | undefined): string {
  const trimmed = prefix?.trim() || "alilos";
  return `/${trimmed}`;
}

function telegramSecretStatusLabel(status: RendererTelegramSettingsSnapshot["secretStatus"]["botToken"]): string {
  switch (status) {
    case "configured":
      return "configured";
    case "env-local":
      return "available from .env.local";
    default:
      return "not configured";
  }
}

function withTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), IPC_TIMEOUT_MS);

    promise
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(timer));
  });
}

setupTabNavigation();
window.alilos.onSnapshotUpdated(render);
setInterval(refresh, 1000);
void refresh();
void loadAppSettings();
void loadTelegramSettings();
