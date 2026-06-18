import path from "node:path";
import { app, BrowserWindow, clipboard, ipcMain, shell, Tray } from "electron";
import { appendAutomationAuditEvent } from "../worker/automation-audit";
import { AutomationMonitor } from "../worker/automation-monitor";
import { BackgroundWorker } from "../worker/background-worker";
import { BrowserController } from "../worker/browser-controller";
import { ConfirmationService } from "../worker/confirmation-service";
import { HeartbeatService } from "../worker/heartbeat-service";
import { NetworkMonitor, normalizeNetworkMonitorSettings } from "../worker/network-monitor";
import { ReminderService } from "../worker/reminder-service";
import { Scheduler } from "../worker/scheduler";
import { TestClickService } from "../worker/test-click-service";
import { ConfigStore } from "./config-store";
import { AppLogger } from "./logger";
import { decryptSecret, encryptSecret, isSecureStorageAvailable } from "./secret-store";
import { TelegramService } from "./telegram-service";
import { createAppTray } from "./tray";
import type { AppConfig, AppSettingsInput, AppSettingsSnapshot, AttendanceActionType, AttendanceCompletionRecord, AttendanceExecutionResult, AttendancePlaceholder, DashboardSnapshot, ExecutionMode, HeartbeatPayload, NetworkMonitorSettings, PerakamAutoLoginAttemptResult, PerakamAutoLoginInput, PerakamAutoLoginSnapshot, PerakamPageStatus, PerakamStatusSnapshot, ReminderSettings, ScheduleSnapshot, TelegramSecretStatus, TelegramSettings, TelegramSettingsInput, TelegramSettingsSnapshot, TestClickTargetId, TimeWindow } from "../shared/types";

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
let heartbeatService: HeartbeatService;
let automationMonitor: AutomationMonitor;
let appTray: Tray | null = null;
let perakamLoginInFlight = false;
let lastPerakamLoginAttemptMs = 0;
let perakamAutoLoginRetryTimer: ReturnType<typeof setTimeout> | null = null;
const PERAKAM_LOGIN_COOLDOWN_MS = 60 * 1000;
const HIDDEN_AT_LOGIN_ARG = "--hidden-at-login";

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
}

function appIconPath(): string {
  return path.join(app.getAppPath(), "assets", "app-icon.ico");
}

function shouldStartHiddenAtLogin(): boolean {
  return process.argv.includes(HIDDEN_AT_LOGIN_ARG);
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1080,
    height: 760,
    minWidth: 760,
    minHeight: 560,
    title: "A.L.I.L.O.S.",
    icon: appIconPath(),
    show: !shouldStartHiddenAtLogin(),
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
    appStatus: appStatusText(),
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
    automation: automationMonitor.snapshot(),
    heartbeat: heartbeatService.snapshot(),
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

  configStore = new ConfigStore(app.getPath("userData"), app.getAppPath());
  config = configStore.load();
  logger = new AppLogger(app.getPath("userData"));
  applyLaunchAtLoginSetting("startup");
  worker = new BackgroundWorker(config, logger);
  browserController = new BrowserController(app.getPath("userData"), logger, () => {
    void maybeAttemptPerakamAutoLogin("status-change");
    void broadcastSnapshot();
  });
  scheduler = new Scheduler(config, configStore, logger);
  telegramService = new TelegramService(logger, buildEffectiveTelegramSettings, {
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
    setLastUpdateId: (lastUpdateId) => {
      config.telegram.lastUpdateId = lastUpdateId;
    },
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
  heartbeatService = new HeartbeatService(config, logger, buildHeartbeatPayload, configStore.supabaseEnvLocal, app.getVersion());
  automationMonitor = new AutomationMonitor(
    config,
    configStore,
    logger,
    telegramService,
    {
      getScheduleSnapshot: () => scheduler.getSnapshot(),
      getBrowserStatus: () => browserController.status(),
      getPerakamStatus: () => browserController.getPerakamStatus(config.perakam.dashboardUrl),
      openPerakam: async () => {
        const status = await browserController.openPerakam(config.perakam.dashboardUrl);
        await maybeAttemptPerakamAutoLogin("automation-open", status);
        return browserController.getPerakamStatus(config.perakam.dashboardUrl);
      },
      refreshPerakamStatus: async () => {
        const status = await browserController.refreshPerakamStatus(config.perakam.dashboardUrl);
        await maybeAttemptPerakamAutoLogin("automation-refresh", status);
        return browserController.getPerakamStatus(config.perakam.dashboardUrl);
      },
      publishHeartbeat: async (source) => {
        await heartbeatService.send(source);
        await broadcastSnapshot();
      },
      broadcastSnapshot: () => {
        void broadcastSnapshot();
      }
    }
  );

  mainWindow = createWindow();
  appTray = createAppTray(mainWindow, appIconPath());

  logger.info("A.L.I.L.O.S. Phase 1 app started.");
  if (shouldStartHiddenAtLogin()) {
    logger.info("Started from Windows sign-in; main window remains hidden in tray.");
  }
  worker.on("updated", broadcastSnapshot);
  logger.on("entry", broadcastSnapshot);

  if (config.worker.enabled) {
    worker.start();
  }
  telegramService.configure();
  reminderService.start();
  networkMonitor.start();
  heartbeatService.start();
  automationMonitor.start();

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
  ipcMain.handle("settings:get", () => buildAppSettingsSnapshot());
  ipcMain.handle("settings:save", async (_event, settings: Partial<AppSettingsInput> | null) => {
    const previousWorkerEnabled = config.worker.enabled;
    const previousWorkerInterval = config.worker.pollIntervalSeconds;
    const next = normalizeAppSettings(settings);

    config.worker = next.worker;
    config.startup = next.startup;
    config.automation = {
      ...config.automation,
      ...next.automation
    };
    config.scheduler = {
      ...config.scheduler,
      clockInWindow: next.scheduler.clockInWindow,
      clockOutWindow: next.scheduler.clockOutWindow,
      gracePeriodMinutes: next.scheduler.gracePeriodMinutes,
      reminders: next.scheduler.reminders
    };
    config.perakam = {
      ...config.perakam,
      dashboardUrl: next.perakam.dashboardUrl
    };
    config.heartbeat = {
      ...config.heartbeat,
      enabled: next.heartbeat.enabled,
      supabaseUrl: typeof next.heartbeat.endpointUrl === "string" && next.heartbeat.endpointUrl.trim()
        ? next.heartbeat.endpointUrl.trim()
        : config.heartbeat.supabaseUrl,
      intervalSeconds: next.heartbeat.intervalSeconds
    };

    configStore.save(config);

    if (config.worker.enabled !== previousWorkerEnabled || config.worker.pollIntervalSeconds !== previousWorkerInterval) {
      worker.stop();
      if (config.worker.enabled) {
        worker.start();
      }
    }
    automationMonitor.configure();
    heartbeatService.configure();
    applyLaunchAtLoginSetting("settings");

    logger.info(`App settings saved. Execution mode: ${config.automation.executionMode}. Worker: ${config.worker.enabled ? "enabled" : "disabled"}. Launch at login: ${config.startup.launchAtLogin ? "enabled" : "disabled"}.`);
    await broadcastSnapshot();
    return buildAppSettingsSnapshot();
  });
  ipcMain.handle("telegram:get-settings", () => buildTelegramSettingsSnapshot());
  ipcMain.handle("telegram:save-settings", (_event, settings: Partial<TelegramSettingsInput> | null) => {
    config.telegram = normalizeTelegramSettings(settings);
    configStore.save(config);
    telegramService.configure();
    logger.info(`Telegram settings saved. Enabled: ${config.telegram.enabled ? "yes" : "no"}.`);
    return buildTelegramSettingsSnapshot();
  });
  ipcMain.handle("telegram:send-test-notification", () => telegramService.sendTestNotification(buildEffectiveTelegramSettings()));
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
    const result = await confirmationService.runGuardedAttendanceClick(String(confirmationId ?? ""));
    recordAttendanceExecutionAudit(result);
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
  heartbeatService?.stop();
  automationMonitor?.stop();

  if (browserController && browserController.status().state !== "stopped") {
    event.preventDefault();
    void browserController.stop().finally(() => app.quit());
  }
});

app.on("window-all-closed", () => {
  // Keep the app resident in the tray until the user chooses Quit.
});

function normalizeTelegramSettings(settings: Partial<TelegramSettingsInput> | null): TelegramSettings {
  const botToken = normalizeOptionalSecret(settings?.botToken, config.telegram.botToken);
  const chatId = normalizeOptionalSecret(settings?.chatId, config.telegram.chatId);

  return {
    enabled: settings?.enabled ?? config.telegram.enabled,
    botToken,
    chatId,
    commandPrefix: normalizeCommandPrefix(settings?.commandPrefix ?? config.telegram.commandPrefix ?? "alilos"),
    lastUpdateId: config.telegram.lastUpdateId ?? 0
  };
}

function buildEffectiveTelegramSettings(): TelegramSettings {
  const envLocal = configStore.telegramEnvLocal;

  return {
    ...config.telegram,
    botToken: config.telegram.botToken.trim() || envLocal.botToken,
    chatId: config.telegram.chatId.trim() || envLocal.chatId
  };
}

function buildTelegramSettingsSnapshot(): TelegramSettingsSnapshot {
  return {
    enabled: config.telegram.enabled,
    commandPrefix: config.telegram.commandPrefix,
    secretStatus: {
      botToken: telegramSecretStatus(config.telegram.botToken, configStore.telegramEnvLocal.botToken),
      chatId: telegramSecretStatus(config.telegram.chatId, configStore.telegramEnvLocal.chatId)
    }
  };
}

function telegramSecretStatus(configValue: string, envLocalValue: string): TelegramSecretStatus {
  if (configValue.trim()) {
    return "configured";
  }

  if (envLocalValue.trim()) {
    return "env-local";
  }

  return "missing";
}

function isLaunchAtLoginSupported(): boolean {
  return process.platform === "win32" && app.isPackaged;
}

function launchAtLoginItemSettings(): Electron.LoginItemSettingsOptions {
  return {
    path: process.execPath,
    args: [HIDDEN_AT_LOGIN_ARG]
  };
}

function applyLaunchAtLoginSetting(source: "startup" | "settings"): void {
  if (!isLaunchAtLoginSupported()) {
    return;
  }

  app.setLoginItemSettings({
    ...launchAtLoginItemSettings(),
    openAtLogin: config.startup.launchAtLogin
  });

  const effective = launchAtLoginSettingsSnapshot();
  logger.info(`Launch-at-login setting applied from ${source}. Saved: ${config.startup.launchAtLogin ? "enabled" : "disabled"}. Effective: ${effective.openAtLogin ? "enabled" : "disabled"}.`);
}

function launchAtLoginSettingsSnapshot(): Electron.LoginItemSettings {
  if (!isLaunchAtLoginSupported()) {
    return {
      openAtLogin: false,
      openAsHidden: false,
      wasOpenedAtLogin: shouldStartHiddenAtLogin(),
      wasOpenedAsHidden: shouldStartHiddenAtLogin(),
      restoreState: false,
      status: "not-found",
      executableWillLaunchAtLogin: false,
      launchItems: []
    };
  }

  return app.getLoginItemSettings(launchAtLoginItemSettings());
}

function normalizeOptionalSecret(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed || fallback;
}

function buildAppSettingsSnapshot(): AppSettingsSnapshot {
  const loginItemSettings = launchAtLoginSettingsSnapshot();
  return {
    worker: {
      enabled: config.worker.enabled,
      pollIntervalSeconds: config.worker.pollIntervalSeconds
    },
    startup: {
      launchAtLogin: config.startup.launchAtLogin,
      supported: isLaunchAtLoginSupported(),
      openAtLogin: loginItemSettings.openAtLogin
    },
    automation: {
      executionMode: config.automation.executionMode,
      monitorIntervalSeconds: config.automation.monitorIntervalSeconds,
      prepareBrowserInDryRun: config.automation.prepareBrowserInDryRun
    },
    scheduler: {
      clockInWindow: config.scheduler.clockInWindow,
      clockOutWindow: config.scheduler.clockOutWindow,
      gracePeriodMinutes: config.scheduler.gracePeriodMinutes,
      reminders: config.scheduler.reminders
    },
    perakam: {
      dashboardUrl: config.perakam.dashboardUrl
    },
    heartbeat: {
      enabled: config.heartbeat.enabled,
      configured: Boolean(effectiveSupabaseUrl()) && Boolean(effectiveSupabasePublishableKey()),
      endpointHost: effectiveSupabaseUrl()?.host ?? null,
      keyStatus: config.heartbeat.publishableKey.trim()
        ? "configured"
        : configStore.supabaseEnvLocal.publishableKey.trim()
          ? "env-local"
          : "missing",
      intervalSeconds: config.heartbeat.intervalSeconds
    }
  };
}

function normalizeAppSettings(settings: Partial<AppSettingsInput> | null): AppSettingsInput {
  const clockInWindow = normalizeTimeWindow(settings?.scheduler?.clockInWindow, config.scheduler.clockInWindow, "Morning action window");
  const clockOutWindow = normalizeTimeWindow(settings?.scheduler?.clockOutWindow, config.scheduler.clockOutWindow, "Evening action window");
  const dashboardUrl = normalizeRequiredHttpUrl(settings?.perakam?.dashboardUrl ?? config.perakam.dashboardUrl, "Perakam dashboard URL");
  const heartbeatEndpoint = normalizeOptionalSupabaseUrl(settings?.heartbeat?.endpointUrl, "Supabase project URL");

  return {
    worker: {
      enabled: settings?.worker?.enabled ?? config.worker.enabled,
      pollIntervalSeconds: clampSettingNumber(settings?.worker?.pollIntervalSeconds, 15, 24 * 60 * 60, config.worker.pollIntervalSeconds, "Worker poll interval")
    },
    startup: {
      launchAtLogin: settings?.startup?.launchAtLogin ?? config.startup.launchAtLogin
    },
    automation: {
      executionMode: normalizeSettingsExecutionMode(settings?.automation?.executionMode),
      monitorIntervalSeconds: clampSettingNumber(settings?.automation?.monitorIntervalSeconds, 15, 24 * 60 * 60, config.automation.monitorIntervalSeconds, "Automation monitor interval"),
      prepareBrowserInDryRun: settings?.automation?.prepareBrowserInDryRun ?? config.automation.prepareBrowserInDryRun
    },
    scheduler: {
      clockInWindow,
      clockOutWindow,
      gracePeriodMinutes: clampSettingNumber(settings?.scheduler?.gracePeriodMinutes, 1, 120, config.scheduler.gracePeriodMinutes, "Grace period"),
      reminders: normalizeReminderSettings(settings?.scheduler?.reminders)
    },
    perakam: {
      dashboardUrl
    },
    heartbeat: {
      enabled: settings?.heartbeat?.enabled ?? config.heartbeat.enabled,
      endpointUrl: heartbeatEndpoint ?? undefined,
      intervalSeconds: clampSettingNumber(settings?.heartbeat?.intervalSeconds, 30, 24 * 60 * 60, config.heartbeat.intervalSeconds, "Heartbeat interval")
    }
  };
}

function normalizeReminderSettings(settings: Partial<ReminderSettings> | undefined): ReminderSettings {
  return {
    enabled: settings?.enabled ?? config.scheduler.reminders.enabled,
    approachingMinutes: clampSettingNumber(settings?.approachingMinutes, 1, 120, config.scheduler.reminders.approachingMinutes, "Reminder approaching window"),
    systemNotificationsEnabled: settings?.systemNotificationsEnabled ?? config.scheduler.reminders.systemNotificationsEnabled
  };
}

function normalizeTimeWindow(input: Partial<TimeWindow> | undefined, fallback: TimeWindow, label: string): TimeWindow {
  const start = normalizeTimeText(input?.start ?? fallback.start, `${label} start`);
  const end = normalizeTimeText(input?.end ?? fallback.end, `${label} end`);

  if (minutesFromTimeText(start) > minutesFromTimeText(end)) {
    throw new Error(`${label} start must be before or equal to the end time.`);
  }

  return { start, end };
}

function normalizeTimeText(value: unknown, label: string): string {
  const text = String(value ?? "").trim();
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(text);
  if (!match) {
    throw new Error(`${label} must use HH:MM 24-hour format.`);
  }

  return text;
}

function minutesFromTimeText(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function normalizeSettingsExecutionMode(value: unknown): ExecutionMode {
  if (value === "notify-only" || value === "manual-confirm" || value === "dry-run") {
    return value;
  }

  return config.automation.executionMode;
}

function clampSettingNumber(value: unknown, minimum: number, maximum: number, fallback: number, label: string): number {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    throw new Error(`${label} must be a number.`);
  }

  return Math.min(maximum, Math.max(minimum, Math.round(numeric)));
}

function normalizeRequiredHttpUrl(value: unknown, label: string): string {
  const raw = String(value ?? "").trim();
  const parsed = parseHttpUrl(raw);
  if (!parsed) {
    throw new Error(`${label} must be a valid http or https URL.`);
  }

  return parsed.toString();
}

function normalizeOptionalSupabaseUrl(value: unknown, label: string): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return null;
  }

  const parsed = parseHttpUrl(raw);
  if (!parsed || parsed.protocol !== "https:") {
    throw new Error(`${label} must be blank or a valid https URL.`);
  }

  parsed.pathname = "/";
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString();
}

function parseHttpUrl(value: string): URL | null {
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed : null;
  } catch {
    return null;
  }
}

function normalizeCommandPrefix(prefix: unknown): string {
  const normalized = String(prefix ?? "").trim().replace(/^\/+/, "").toLowerCase();
  return normalized || "alilos";
}

function effectiveSupabaseUrl(): URL | null {
  const raw = config.heartbeat.supabaseUrl.trim() || configStore.supabaseEnvLocal.supabaseUrl.trim();
  const parsed = parseHttpUrl(raw);
  if (!parsed || parsed.protocol !== "https:") {
    return null;
  }

  parsed.pathname = "/";
  parsed.search = "";
  parsed.hash = "";
  return parsed;
}

function effectiveSupabasePublishableKey(): string {
  const key = config.heartbeat.publishableKey.trim() || configStore.supabaseEnvLocal.publishableKey.trim();
  return looksLikeSecretKey(key) ? "" : key;
}

function looksLikeSecretKey(value: string): boolean {
  if (value.startsWith("sb_secret_")) {
    return true;
  }

  const parts = value.split(".");
  if (parts.length < 2) {
    return false;
  }

  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as { role?: unknown };
    return payload.role === "service_role";
  } catch {
    return false;
  }
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

function appStatusText(): string {
  switch (config.automation.executionMode) {
    case "notify-only":
      return "Notify-only monitoring active";
    case "dry-run":
      return "Dry-run automation monitoring active";
    default:
      return "Ready for manual action confirmation";
  }
}

function buildHeartbeatPayload(): HeartbeatPayload {
  const workerSnapshot = worker.snapshot();
  const network = networkMonitor.snapshot();
  const perakam = browserController.getPerakamStatus(config.perakam.dashboardUrl);
  const telegram = telegramService.snapshot();
  const lastSeenAt = new Date().toISOString();

  return {
    appStatus: sanitizeHeartbeatText(appStatusText(), 80) ?? "unknown",
    workerState: workerSnapshot.state,
    executionMode: config.automation.executionMode,
    networkStatus: sanitizeHeartbeatText(`connectivity=${network.connectivityState}; perakam=${network.perakamReachabilityState}; captivePortal=${network.captivePortal.state}`, 120) ?? "unknown",
    perakamPageStatus: sanitizeHeartbeatText(`status=${perakam.status}; clockIn=${perakam.clockInAvailable}; clockOut=${perakam.clockOutAvailable}`, 120) ?? "unknown",
    telegramStatus: sanitizeHeartbeatText(`enabled=${telegram.enabled}; running=${telegram.running}`, 120) ?? "unknown",
    lastSeenAt,
    statusText: sanitizeHeartbeatText(`worker=${workerSnapshot.state}; executionMode=${config.automation.executionMode}`, 500),
    lastErrorText: lastSanitizedErrorSummary(network.sanitizedError, perakam.lastError, browserController.status().lastError, telegram.lastError, reminderService.snapshot().lastError)
  };
}

function lastSanitizedErrorSummary(...messages: Array<string | null>): string | null {
  const message = messages.find((item) => item && item.trim());
  return message ? sanitizeHeartbeatText(message, 500) : null;
}

function sanitizeHeartbeatText(value: string, maxLength: number): string | null {
  const sanitized = value
    .replace(/https?:\/\/[^\s]+/gi, (match) => {
      try {
        const url = new URL(match);
        return `${url.protocol}//${url.host}/[redacted]`;
      } catch {
        return "[redacted-url]";
      }
    })
    .replace(/[?#][^\s]*/g, "?[redacted]")
    .replace(/bot[0-9]+:[A-Za-z0-9_-]+/g, "bot[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

  return sanitized || null;
}

function recordAttendanceExecutionAudit(result: AttendanceExecutionResult): void {
  if (!result.action || !result.dateKey) {
    return;
  }

  if (result.status === "succeeded" || result.status === "failed") {
    appendAutomationAuditEvent(config, configStore, logger, {
      type: "real-action-attempted-after-confirmation",
      action: result.action,
      dateKey: result.dateKey,
      status: result.status === "succeeded" ? "passed" : "failed",
      message: result.status === "succeeded"
        ? `Confirmed real ${result.action} action attempted through guarded execution.`
        : `Confirmed real ${result.action} action failed through guarded execution.`,
      details: {
        mappedTargetId: result.mappedTargetId,
        executionStatus: result.status,
        completionState: result.completionState,
        confirmationRequired: true
      }
    });
  }

  if (result.verification) {
    appendAutomationAuditEvent(config, configStore, logger, {
      type: "verification-result",
      action: result.action,
      dateKey: result.dateKey,
      status: result.verification.status === "verified-success" || result.verification.status === "manually-verified" ? "passed" : "blocked",
      message: result.verification.reason,
      details: {
        verificationStatus: result.verification.status,
        localClickResult: result.verification.localClickResult
      }
    });
  }
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
