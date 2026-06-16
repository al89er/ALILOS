import path from "node:path";
import { app, BrowserWindow, clipboard, ipcMain, shell, Tray } from "electron";
import { BackgroundWorker } from "../worker/background-worker";
import { BrowserController } from "../worker/browser-controller";
import { ConfirmationService } from "../worker/confirmation-service";
import { NetworkMonitor, normalizeNetworkMonitorSettings } from "../worker/network-monitor";
import { ReminderService } from "../worker/reminder-service";
import { Scheduler } from "../worker/scheduler";
import { TestClickService } from "../worker/test-click-service";
import { ConfigStore } from "./config-store";
import { AppLogger } from "./logger";
import { decryptSecret, encryptSecret, isSecureStorageAvailable } from "./secret-store";
import { TelegramService } from "./telegram-service";
import { createAppTray } from "./tray";
import type { AppConfig, AttendanceActionType, AttendanceCompletionRecord, AttendancePlaceholder, DashboardSnapshot, NetworkMonitorSettings, PerakamAutoLoginAttemptResult, PerakamAutoLoginInput, PerakamAutoLoginSnapshot, PerakamPageStatus, PerakamStatusSnapshot, ScheduleSnapshot, TelegramSettings, TestClickTargetId } from "../shared/types";

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;
let config: AppConfig;
let configStore: ConfigStore;
let logger: AppLogger;
let worker: BackgroundWorker;
let browserController: BrowserController;
let confirmationService: ConfirmationService;
let testClickService: TestClickService;
let scheduler: Scheduler;
let telegramService: TelegramService;
let reminderService: ReminderService;
let networkMonitor: NetworkMonitor;
let appTray: Tray | null = null;
let perakamLoginInFlight = false;
let lastPerakamLoginAttemptMs = 0;
let perakamAutoLoginRetryTimer: ReturnType<typeof setTimeout> | null = null;
const PERAKAM_LOGIN_COOLDOWN_MS = 60 * 1000;

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1080,
    height: 760,
    minWidth: 760,
    minHeight: 560,
    title: "A.L.I.L.O.S.",
    backgroundColor: "#f5f7fb",
    webPreferences: {
      preload: path.join(__dirname, "..", "preload", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  window.loadFile(path.join(__dirname, "..", "renderer", "index.html"));

  window.on("close", (event) => {
    if (isQuitting) {
      return;
    }

    event.preventDefault();
    window.hide();
    logger.info("Main window hidden to tray.");
    broadcastSnapshot();
  });

  return window;
}

async function buildSnapshot(): Promise<DashboardSnapshot> {
  const schedule = scheduler.getSnapshot();

  return {
    appStatus: "Ready for manual attendance confirmation",
    worker: worker.snapshot(),
    localTime: new Date().toLocaleString(),
    placeholders: buildPlaceholders(schedule),
    schedule,
    telegram: telegramService.snapshot(),
    reminders: reminderService.snapshot(),
    networkMonitor: networkMonitor.snapshot(),
    browser: browserController.status(),
    perakam: browserController.getPerakamStatus(config.perakam.dashboardUrl),
    perakamAutoLogin: buildPerakamAutoLoginSnapshot(),
    confirmations: confirmationService.snapshot(),
    testClick: testClickService.snapshot(),
    logs: await logger.recent(20),
    configPath: configStore.path,
    logPath: logger.path
  };
}

function buildPlaceholders(schedule: ScheduleSnapshot): AttendancePlaceholder[] {
  return schedule.actions.map((action) => ({
    label: action.label,
    targetTime: action.time,
    status: action.status
  }));
}

async function broadcastSnapshot(): Promise<void> {
  if (!mainWindow) {
    return;
  }

  mainWindow.webContents.send("dashboard:snapshot-updated", await buildSnapshot());
}

app.whenReady().then(() => {
  if (!hasSingleInstanceLock) {
    return;
  }

  configStore = new ConfigStore(app.getPath("userData"));
  config = configStore.load();
  logger = new AppLogger(app.getPath("userData"));
  worker = new BackgroundWorker(config, logger);
  browserController = new BrowserController(app.getPath("userData"), logger, () => {
    void maybeAttemptPerakamAutoLogin("status-change");
    void broadcastSnapshot();
  });
  scheduler = new Scheduler(config, configStore, logger);
  telegramService = new TelegramService(logger, () => config.telegram, {
    getScheduleSnapshot: () => scheduler.getSnapshot(),
    skipToday: () => {
      scheduler.skipToday();
      reminderService.clearLogMarkersForDate(formatDateKey(new Date()));
    },
    unskipToday: () => {
      scheduler.unskipToday();
      reminderService.clearLogMarkersForDate(formatDateKey(new Date()));
    },
    skipTomorrow: () => {
      scheduler.skipTomorrow();
      reminderService.clearLogMarkersForDate(formatDateKey(addDays(new Date(), 1)));
    },
    unskipTomorrow: () => {
      scheduler.unskipTomorrow();
      reminderService.clearLogMarkersForDate(formatDateKey(addDays(new Date(), 1)));
    },
    persistSettings: () => configStore.save(config),
    broadcastSnapshot: () => {
      void broadcastSnapshot();
    }
  });
  reminderService = new ReminderService(
    config,
    configStore,
    logger,
    telegramService,
    () => scheduler.getSnapshot(),
    () => {
      void broadcastSnapshot();
    }
  );
  networkMonitor = new NetworkMonitor(
    config,
    configStore,
    logger,
    telegramService,
    () => {
      void broadcastSnapshot();
    }
  );
  confirmationService = new ConfirmationService(logger, {
    getScheduleSnapshot: () => scheduler.getSnapshot(),
    getBrowserStatus: () => browserController.status(),
    getPerakamStatus: () => browserController.getPerakamStatus(config.perakam.dashboardUrl),
    refreshPerakamStatus: () => browserController.refreshPerakamStatus(config.perakam.dashboardUrl),
    getConfiguredPerakamUrl: () => config.perakam.dashboardUrl,
    getPerakamAutoLoginSnapshot: () => buildPerakamAutoLoginSnapshot(),
    clickVisibleAttendanceControl: (action) => browserController.clickVisibleAttendanceControl(action),
    verifyAttendanceAfterClick: (action, dateKey, localClickResult) => browserController.verifyAttendanceAfterClick(action, dateKey, localClickResult),
    persistCompletion: (record) => persistAttendanceCompletion(record),
    broadcastSnapshot: () => {
      void broadcastSnapshot();
    }
  }, allAttendanceCompletions(config));
  testClickService = new TestClickService(logger, {
    getBrowserStatus: () => browserController.status(),
    getPerakamStatus: () => browserController.getPerakamStatus(config.perakam.dashboardUrl),
    refreshPerakamStatus: () => browserController.refreshPerakamStatus(config.perakam.dashboardUrl),
    getConfiguredPerakamUrl: () => config.perakam.dashboardUrl,
    detectTestClickTarget: (targetId) => browserController.detectTestClickTarget(targetId),
    inspectTestClickTargets: () => browserController.inspectTestClickTargets(),
    clickVisibleTestTarget: (targetId) => browserController.clickVisibleTestTarget(targetId),
    broadcastSnapshot: () => {
      void broadcastSnapshot();
    }
  });

  mainWindow = createWindow();
  appTray = createAppTray(mainWindow);

  logger.info("A.L.I.L.O.S. Phase 1 app started.");
  worker.on("updated", broadcastSnapshot);
  logger.on("entry", broadcastSnapshot);

  if (config.worker.enabled) {
    worker.start();
  }
  telegramService.configure();
  reminderService.start();
  networkMonitor.start();

  ipcMain.handle("dashboard:get-snapshot", buildSnapshot);
  ipcMain.handle("schedule:skip-today", async () => {
    scheduler.skipToday();
    reminderService.clearLogMarkersForDate(formatDateKey(new Date()));
    await broadcastSnapshot();
    return buildSnapshot();
  });
  ipcMain.handle("schedule:unskip-today", async () => {
    scheduler.unskipToday();
    reminderService.clearLogMarkersForDate(formatDateKey(new Date()));
    await broadcastSnapshot();
    return buildSnapshot();
  });
  ipcMain.handle("schedule:skip-tomorrow", async () => {
    scheduler.skipTomorrow();
    reminderService.clearLogMarkersForDate(formatDateKey(addDays(new Date(), 1)));
    await broadcastSnapshot();
    return buildSnapshot();
  });
  ipcMain.handle("schedule:unskip-tomorrow", async () => {
    scheduler.unskipTomorrow();
    reminderService.clearLogMarkersForDate(formatDateKey(addDays(new Date(), 1)));
    await broadcastSnapshot();
    return buildSnapshot();
  });
  ipcMain.handle("telegram:get-settings", () => config.telegram);
  ipcMain.handle("telegram:save-settings", (_event, settings: Partial<TelegramSettings> | null) => {
    config.telegram = normalizeTelegramSettings(settings);
    configStore.save(config);
    telegramService.configure();
    logger.info(`Telegram settings saved. Enabled: ${config.telegram.enabled ? "yes" : "no"}.`);
    return config.telegram;
  });
  ipcMain.handle("telegram:send-test-notification", () => telegramService.sendTestNotification(config.telegram));
  ipcMain.handle("network:get-settings", () => config.networkMonitor);
  ipcMain.handle("network:save-settings", (_event, settings: Partial<NetworkMonitorSettings> | null) => {
    config.networkMonitor = normalizeNetworkMonitorSettings({
      ...config.networkMonitor,
      ...settings
    });
    configStore.save(config);
    networkMonitor.configure();
    logger.info(`Network monitor settings saved. Enabled: ${config.networkMonitor.enabled ? "yes" : "no"}.`);
    return config.networkMonitor;
  });
  ipcMain.handle("network:check-now", async () => {
    await networkMonitor.checkNow("manual");
    await broadcastSnapshot();
    return buildSnapshot();
  });
  ipcMain.handle("network:open-portal", async () => {
    const portalUrl = networkMonitor.detectedPortalUrl();
    if (!portalUrl || !isHttpUrl(portalUrl)) {
      logger.warn("Open detected portal page ignored: no sanitized portal URL is available.");
      return buildSnapshot();
    }

    await shell.openExternal(portalUrl);
    logger.info("Detected captive portal page opened externally by user.");
    await broadcastSnapshot();
    return buildSnapshot();
  });
  ipcMain.handle("network:copy-portal-url", () => {
    const portalUrl = networkMonitor.detectedPortalUrl();
    if (!portalUrl || !isHttpUrl(portalUrl)) {
      return {
        ok: false,
        message: "No detected portal URL is available."
      };
    }

    clipboard.writeText(portalUrl);
    logger.info("Detected captive portal URL copied by user.");
    return {
      ok: true,
      message: "Detected portal URL copied."
    };
  });
  ipcMain.handle("browser:get-status", () => browserController.status());
  ipcMain.handle("browser:start", async () => {
    const status = await browserController.start();
    await broadcastSnapshot();
    return status;
  });
  ipcMain.handle("browser:stop", async () => {
    const status = await browserController.stop();
    await broadcastSnapshot();
    return status;
  });
  ipcMain.handle("perakam:open", async () => {
    const status = await browserController.openPerakam(config.perakam.dashboardUrl);
    await maybeAttemptPerakamAutoLogin("manual-open", status);
    await broadcastSnapshot();
    return browserController.getPerakamStatus(config.perakam.dashboardUrl);
  });
  ipcMain.handle("perakam:get-status", async () => {
    const status = await browserController.refreshPerakamStatus(config.perakam.dashboardUrl);
    await maybeAttemptPerakamAutoLogin("status-refresh", status);
    await broadcastSnapshot();
    return browserController.getPerakamStatus(config.perakam.dashboardUrl);
  });
  ipcMain.handle("perakam:get-auto-login", () => buildPerakamAutoLoginSnapshot());
  ipcMain.handle("perakam:save-auto-login", (_event, settings: Partial<PerakamAutoLoginInput> | null) => {
    savePerakamAutoLoginSettings(settings);
    return buildPerakamAutoLoginSnapshot();
  });
  ipcMain.handle("perakam:clear-auto-login", () => {
    config.perakam.autoLogin = {
      ...config.perakam.autoLogin,
      enabled: false,
      useSharedCredential: true,
      username: "",
      encryptedPassword: "",
      lastUpdatedAt: new Date().toISOString(),
      lastLoginResult: "unknown",
      lastLoginReason: "Saved UPM credentials cleared."
    };
    config.institutionCredential = {
      ...config.institutionCredential,
      username: "",
      encryptedPassword: "",
      lastUpdatedAt: new Date().toISOString()
    };
    configStore.save(config);
    logger.info("Saved UPM credentials used for Perakam login cleared.");
    return buildPerakamAutoLoginSnapshot();
  });
  ipcMain.handle("perakam:test-auto-login", async (_event, settings: Partial<PerakamAutoLoginInput> | null) => {
    const transientPassword = typeof settings?.password === "string" && settings.password.length > 0 ? settings.password : undefined;
    if (typeof settings?.enabled === "boolean" || typeof settings?.username === "string") {
      config.perakam.autoLogin.enabled = Boolean(settings.enabled);
      config.perakam.autoLogin.useSharedCredential = true;
      config.institutionCredential.username = sanitizeCredentialText(settings.username ?? config.institutionCredential.username);
      config.institutionCredential.lastUpdatedAt = new Date().toISOString();
      syncLegacyPerakamCredential();
      configStore.save(config);
    }
    await attemptPerakamAutoLogin(true, transientPassword);
    await broadcastSnapshot();
    return buildSnapshot();
  });
  ipcMain.handle("confirmation:get-readiness", () => confirmationService.snapshot());
  ipcMain.handle("confirmation:create", async (_event, action: unknown) => {
    if (!isAttendanceAction(action)) {
      logger.warn("Confirmation rejected due to stale state: invalid action.");
      return buildSnapshot();
    }

    confirmationService.createConfirmation(action);
    await broadcastSnapshot();
    return buildSnapshot();
  });
  ipcMain.handle("confirmation:accept", async (_event, id: string) => {
    confirmationService.acceptConfirmation(String(id ?? ""));
    await broadcastSnapshot();
    return buildSnapshot();
  });
  ipcMain.handle("confirmation:cancel", async (_event, id: string) => {
    confirmationService.cancelConfirmation(String(id ?? ""));
    await broadcastSnapshot();
    return buildSnapshot();
  });
  ipcMain.handle("dry-run:run", async (_event, confirmationId: string) => {
    await confirmationService.runAttendanceDryRun(String(confirmationId ?? ""));
    await broadcastSnapshot();
    return buildSnapshot();
  });
  ipcMain.handle("dry-run:get-latest", () => confirmationService.latestDryRun());
  ipcMain.handle("attendance:execute", async (_event, confirmationId: string) => {
    await confirmationService.runGuardedAttendanceClick(String(confirmationId ?? ""));
    await broadcastSnapshot();
    return buildSnapshot();
  });
  ipcMain.handle("attendance:get-latest-execution", () => confirmationService.latestExecution());
  ipcMain.handle("attendance:mark-manually-verified", async (_event, confirmationId: string) => {
    confirmationService.markAttendanceManuallyVerified(String(confirmationId ?? ""));
    await broadcastSnapshot();
    return buildSnapshot();
  });
  ipcMain.handle("test-click:check-readiness", async (_event, targetId: unknown) => {
    if (!isTestClickTarget(targetId)) {
      logger.warn("Manual test-click readiness rejected: invalid target.");
      return buildSnapshot();
    }

    await testClickService.checkReadiness(targetId);
    await broadcastSnapshot();
    return buildSnapshot();
  });
  ipcMain.handle("test-click:inspect-targets", async () => {
    await testClickService.inspectTargets();
    await broadcastSnapshot();
    return buildSnapshot();
  });
  ipcMain.handle("test-click:create-confirmation", async (_event, targetId: unknown) => {
    if (!isTestClickTarget(targetId)) {
      logger.warn("Manual test-click confirmation rejected: invalid target.");
      return buildSnapshot();
    }

    await testClickService.createConfirmation(targetId);
    await broadcastSnapshot();
    return buildSnapshot();
  });
  ipcMain.handle("test-click:accept-confirmation", async (_event, id: string) => {
    testClickService.acceptConfirmation(String(id ?? ""));
    await broadcastSnapshot();
    return buildSnapshot();
  });
  ipcMain.handle("test-click:cancel-confirmation", async (_event, id: string) => {
    testClickService.cancelConfirmation(String(id ?? ""));
    await broadcastSnapshot();
    return buildSnapshot();
  });
  ipcMain.handle("test-click:run-dry-run", async (_event, id: string) => {
    await testClickService.runDryRun(String(id ?? ""));
    await broadcastSnapshot();
    return buildSnapshot();
  });
  ipcMain.handle("test-click:run", async (_event, id: string) => {
    await testClickService.runManualTestClick(String(id ?? ""));
    await broadcastSnapshot();
    return buildSnapshot();
  });
  ipcMain.handle("window:show", () => {
    mainWindow?.show();
    mainWindow?.focus();
  });
  ipcMain.handle("window:hide", () => {
    mainWindow?.hide();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
    } else {
      mainWindow?.show();
    }
  });
});

app.on("second-instance", () => {
  if (!mainWindow) {
    return;
  }

  if (!mainWindow.isVisible()) {
    mainWindow.show();
  }

  mainWindow.focus();
});

app.on("before-quit", (event) => {
  isQuitting = true;
  clearPerakamAutoLoginRetry();
  worker?.stop();
  telegramService?.stopPolling();
  reminderService?.stop();
  networkMonitor?.stop();

  if (browserController && browserController.status().state !== "stopped") {
    event.preventDefault();
    void browserController.stop().finally(() => app.quit());
  }
});

app.on("window-all-closed", () => {
  // Keep the app resident in the tray until the user chooses Quit.
});

function normalizeTelegramSettings(settings: Partial<TelegramSettings> | null): TelegramSettings {
  return {
    enabled: Boolean(settings?.enabled),
    botToken: String(settings?.botToken ?? "").trim(),
    chatId: String(settings?.chatId ?? "").trim(),
    commandPrefix: normalizeCommandPrefix(settings?.commandPrefix ?? config.telegram.commandPrefix ?? "alilos"),
    lastUpdateId: Number.isFinite(settings?.lastUpdateId) ? Number(settings?.lastUpdateId) : config.telegram.lastUpdateId ?? 0
  };
}

function normalizeCommandPrefix(prefix: unknown): string {
  const normalized = String(prefix ?? "").trim().replace(/^\/+/, "").toLowerCase();
  return normalized || "alilos";
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function buildPerakamAutoLoginSnapshot(): PerakamAutoLoginSnapshot {
  const credential = effectiveInstitutionCredential();

  return {
    enabled: config.perakam.autoLogin.enabled,
    useSharedCredential: config.perakam.autoLogin.useSharedCredential,
    username: credential.username,
    hasSavedPassword: Boolean(credential.encryptedPassword),
    secureStorageAvailable: isSecureStorageAvailable(),
    inFlight: perakamLoginInFlight,
    lastUpdatedAt: credential.lastUpdatedAt,
    lastLoginAttemptAt: config.perakam.autoLogin.lastLoginAttemptAt,
    lastLoginResult: config.perakam.autoLogin.lastLoginResult,
    lastLoginReason: config.perakam.autoLogin.lastLoginReason
  };
}

function savePerakamAutoLoginSettings(settings: Partial<PerakamAutoLoginInput> | null): void {
  const password = typeof settings?.password === "string" ? settings.password : "";
  const now = new Date().toISOString();

  config.perakam.autoLogin.enabled = Boolean(settings?.enabled);
  config.perakam.autoLogin.useSharedCredential = true;
  config.institutionCredential.enabled = true;
  config.institutionCredential.username = sanitizeCredentialText(settings?.username ?? "");
  config.institutionCredential.lastUpdatedAt = now;
  syncLegacyPerakamCredential();

  if (password) {
    config.institutionCredential.encryptedPassword = encryptSecret(password);
    syncLegacyPerakamCredential();
  } else if (!config.institutionCredential.encryptedPassword) {
    config.perakam.autoLogin.lastLoginResult = "unavailable";
    config.perakam.autoLogin.lastLoginReason = "No saved UPM password.";
  }

  configStore.save(config);
  logger.info(`UPM credentials used for Perakam login saved. Perakam auto-login enabled: ${config.perakam.autoLogin.enabled ? "yes" : "no"}.`);
}

async function maybeAttemptPerakamAutoLogin(source: string, status?: PerakamStatusSnapshot): Promise<void> {
  const pageStatus = status?.status ?? browserController.getPerakamStatus(config.perakam.dashboardUrl).status;
  if (!isAutoLoginCandidateStatus(pageStatus)) {
    return;
  }

  if (!canAttemptPerakamAutoLogin()) {
    return;
  }

  const remainingCooldownMs = PERAKAM_LOGIN_COOLDOWN_MS - (Date.now() - lastPerakamLoginAttemptMs);
  if (remainingCooldownMs > 0) {
    schedulePerakamAutoLoginRetry(remainingCooldownMs, source, pageStatus);
    return;
  }

  clearPerakamAutoLoginRetry();
  logger.info(`Perakam auto-login triggered by ${source}: ${pageStatus}.`);
  await attemptPerakamAutoLogin(false);
}

function isAutoLoginCandidateStatus(status: PerakamPageStatus): boolean {
  return status === "login-required" || status === "stale-session";
}

function canAttemptPerakamAutoLogin(): boolean {
  if (perakamLoginInFlight) {
    return false;
  }

  if (!config.perakam.autoLogin.enabled) {
    return false;
  }

  const credential = effectiveInstitutionCredential();
  if (!credential.username || !credential.encryptedPassword) {
    return false;
  }

  return true;
}

function schedulePerakamAutoLoginRetry(delayMs: number, source: string, status: PerakamPageStatus): void {
  if (perakamAutoLoginRetryTimer) {
    return;
  }

  const safeDelayMs = Math.max(1000, delayMs + 250);
  logger.info(`Perakam auto-login cooldown active after ${source}: ${status}. Retry scheduled in ${Math.ceil(safeDelayMs / 1000)}s.`);
  perakamAutoLoginRetryTimer = setTimeout(() => {
    perakamAutoLoginRetryTimer = null;
    void runPerakamAutoLoginRetry();
  }, safeDelayMs);
}

async function runPerakamAutoLoginRetry(): Promise<void> {
  if (!canAttemptPerakamAutoLogin()) {
    return;
  }

  const status = await browserController.refreshPerakamStatus(config.perakam.dashboardUrl).catch(() => browserController.getPerakamStatus(config.perakam.dashboardUrl));
  if (!isAutoLoginCandidateStatus(status.status)) {
    await broadcastSnapshot();
    return;
  }

  logger.info(`Perakam auto-login retry triggered after cooldown: ${status.status}.`);
  await attemptPerakamAutoLogin(false);
  await broadcastSnapshot();
}

function clearPerakamAutoLoginRetry(): void {
  if (!perakamAutoLoginRetryTimer) {
    return;
  }

  clearTimeout(perakamAutoLoginRetryTimer);
  perakamAutoLoginRetryTimer = null;
}

async function attemptPerakamAutoLogin(force: boolean, transientPassword?: string): Promise<PerakamAutoLoginAttemptResult> {
  const nowMs = Date.now();
  const now = new Date().toISOString();

  if (perakamLoginInFlight) {
    return updatePerakamLoginResult({
      ok: false,
      status: "unavailable",
      reason: "Perakam auto-login is already in progress.",
      attemptedAt: now,
      pageState: browserController.getPerakamStatus(config.perakam.dashboardUrl).status
    });
  }

  if (!force && nowMs - lastPerakamLoginAttemptMs < PERAKAM_LOGIN_COOLDOWN_MS) {
    return updatePerakamLoginResult({
      ok: false,
      status: "unavailable",
      reason: "Perakam auto-login cooldown is active.",
      attemptedAt: now,
      pageState: browserController.getPerakamStatus(config.perakam.dashboardUrl).status
    });
  }

  if (!config.perakam.autoLogin.enabled) {
    return updatePerakamLoginResult({
      ok: false,
      status: "unavailable",
      reason: "Perakam auto-login is disabled.",
      attemptedAt: now,
      pageState: browserController.getPerakamStatus(config.perakam.dashboardUrl).status
    });
  }

  const credential = effectiveInstitutionCredential();
  const username = sanitizeCredentialText(credential.username);
  const password = transientPassword ?? decryptSecret(credential.encryptedPassword);
  if (!username || !password) {
    const pageState = browserController.getPerakamStatus(config.perakam.dashboardUrl).status;
    return updatePerakamLoginResult({
      ok: false,
      status: "unavailable",
      reason: pageState === "stale-session"
        ? "Session stale: saved Perakam credentials are missing."
        : "Login required: saved Perakam credentials are missing.",
      attemptedAt: now,
      pageState
    });
  }

  perakamLoginInFlight = true;
  lastPerakamLoginAttemptMs = nowMs;
  config.perakam.autoLogin.lastLoginAttemptAt = now;
  config.perakam.autoLogin.lastLoginResult = "unknown";
  config.perakam.autoLogin.lastLoginReason = "Perakam auto-login in progress.";
  configStore.save(config);
  await broadcastSnapshot();

  try {
    const result = await browserController.attemptPerakamAutoLogin({
      dashboardUrl: config.perakam.dashboardUrl,
      username,
      password,
      force
    });
    return updatePerakamLoginResult(result);
  } finally {
    perakamLoginInFlight = false;
    await broadcastSnapshot();
  }
}

function updatePerakamLoginResult(result: PerakamAutoLoginAttemptResult): PerakamAutoLoginAttemptResult {
  config.perakam.autoLogin.lastLoginAttemptAt = result.attemptedAt;
  config.perakam.autoLogin.lastLoginResult = result.status;
  config.perakam.autoLogin.lastLoginReason = sanitizeLoginReason(result.reason);
  configStore.save(config);
  return result;
}

function effectiveInstitutionCredential(): AppConfig["institutionCredential"] {
  if (config.perakam.autoLogin.useSharedCredential === false) {
    return {
      enabled: true,
      username: config.perakam.autoLogin.username,
      encryptedPassword: config.perakam.autoLogin.encryptedPassword,
      lastUpdatedAt: config.perakam.autoLogin.lastUpdatedAt
    };
  }

  if (!config.institutionCredential.username && config.perakam.autoLogin.username) {
    config.institutionCredential.username = config.perakam.autoLogin.username;
  }

  if (!config.institutionCredential.encryptedPassword && config.perakam.autoLogin.encryptedPassword) {
    config.institutionCredential.encryptedPassword = config.perakam.autoLogin.encryptedPassword;
  }

  if (!config.institutionCredential.lastUpdatedAt && config.perakam.autoLogin.lastUpdatedAt) {
    config.institutionCredential.lastUpdatedAt = config.perakam.autoLogin.lastUpdatedAt;
  }

  return config.institutionCredential;
}

function syncLegacyPerakamCredential(): void {
  config.perakam.autoLogin.username = config.institutionCredential.username;
  config.perakam.autoLogin.encryptedPassword = config.institutionCredential.encryptedPassword;
  config.perakam.autoLogin.lastUpdatedAt = config.institutionCredential.lastUpdatedAt;
}

function sanitizeCredentialText(value: unknown): string {
  return String(value ?? "").trim().slice(0, 120);
}

function sanitizeLoginReason(value: string): string {
  return value.replace(/[?#][^\s]*/g, "?[redacted]").slice(0, 240);
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function allAttendanceCompletions(appConfig: AppConfig): AttendanceCompletionRecord[] {
  return Object.values(appConfig.attendance.completionsByDate).flat();
}

function persistAttendanceCompletion(record: AttendanceCompletionRecord): void {
  const records = config.attendance.completionsByDate[record.dateKey] ?? [];
  const withoutDuplicate = records.filter((entry) => entry.action !== record.action);
  config.attendance.completionsByDate[record.dateKey] = [...withoutDuplicate, record];
  configStore.save(config);
}

function isAttendanceAction(action: unknown): action is AttendanceActionType {
  return action === "clock-in" || action === "clock-out";
}

function isTestClickTarget(targetId: unknown): targetId is TestClickTargetId {
  return targetId === "a56" || targetId === "a57";
}
