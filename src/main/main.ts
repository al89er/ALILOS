import path from "node:path";
import { app, BrowserWindow, ipcMain, Tray } from "electron";
import { BackgroundWorker } from "../worker/background-worker";
import { BrowserController } from "../worker/browser-controller";
import { ReminderService } from "../worker/reminder-service";
import { Scheduler } from "../worker/scheduler";
import { ConfigStore } from "./config-store";
import { AppLogger } from "./logger";
import { TelegramService } from "./telegram-service";
import { createAppTray } from "./tray";
import type { AppConfig, AttendancePlaceholder, DashboardSnapshot, ScheduleSnapshot, TelegramSettings } from "../shared/types";

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;
let config: AppConfig;
let configStore: ConfigStore;
let logger: AppLogger;
let worker: BackgroundWorker;
let browserController: BrowserController;
let scheduler: Scheduler;
let telegramService: TelegramService;
let reminderService: ReminderService;
let appTray: Tray | null = null;

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
    browser: browserController.status(),
    perakam: browserController.getPerakamStatus(config.perakam.dashboardUrl),
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
    await broadcastSnapshot();
    return status;
  });
  ipcMain.handle("perakam:get-status", async () => {
    const status = await browserController.refreshPerakamStatus(config.perakam.dashboardUrl);
    await broadcastSnapshot();
    return status;
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
  worker?.stop();
  telegramService?.stopPolling();
  reminderService?.stop();

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
