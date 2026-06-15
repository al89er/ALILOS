const IPC_TIMEOUT_MS = 10000;

const appStatus = document.querySelector<HTMLSpanElement>("#app-status");
const workerStatus = document.querySelector<HTMLSpanElement>("#worker-status");
const workerNote = document.querySelector<HTMLElement>("#worker-note");
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
const todayDate = document.querySelector<HTMLElement>("#today-date");
const scheduleSummary = document.querySelector<HTMLElement>("#schedule-summary");
const placeholderList = document.querySelector<HTMLElement>("#placeholder-list");
const skippedList = document.querySelector<HTMLOListElement>("#skipped-list");
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
const telegramForm = document.querySelector<HTMLFormElement>("#telegram-form");
const telegramEnabled = document.querySelector<HTMLInputElement>("#telegram-enabled");
const telegramBotToken = document.querySelector<HTMLInputElement>("#telegram-bot-token");
const telegramChatId = document.querySelector<HTMLInputElement>("#telegram-chat-id");
const saveTelegramSettingsButton = document.querySelector<HTMLButtonElement>("#save-telegram-settings");
const sendTelegramTest = document.querySelector<HTMLButtonElement>("#send-telegram-test");
const telegramResult = document.querySelector<HTMLElement>("#telegram-result");
let currentTelegramSettings: RendererTelegramSettings | null = null;

function requireElement<T extends Element>(element: T | null, name: string): T {
  if (!element) {
    throw new Error(`Missing renderer element: ${name}`);
  }

  return element;
}

const elements = {
  appStatus: requireElement(appStatus, "app-status"),
  workerStatus: requireElement(workerStatus, "worker-status"),
  workerNote: requireElement(workerNote, "worker-note"),
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
  todayDate: requireElement(todayDate, "today-date"),
  scheduleSummary: requireElement(scheduleSummary, "schedule-summary"),
  placeholderList: requireElement(placeholderList, "placeholder-list"),
  skippedList: requireElement(skippedList, "skipped-list"),
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
  telegramForm: requireElement(telegramForm, "telegram-form"),
  telegramEnabled: requireElement(telegramEnabled, "telegram-enabled"),
  telegramBotToken: requireElement(telegramBotToken, "telegram-bot-token"),
  telegramChatId: requireElement(telegramChatId, "telegram-chat-id"),
  saveTelegramSettingsButton: requireElement(saveTelegramSettingsButton, "save-telegram-settings"),
  sendTelegramTest: requireElement(sendTelegramTest, "send-telegram-test"),
  telegramResult: requireElement(telegramResult, "telegram-result")
};

function render(snapshot: RendererDashboardSnapshot): void {
  elements.appStatus.textContent = snapshot.appStatus;
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
  elements.browserStatus.textContent = snapshot.browser.state;
  elements.browserNote.textContent = snapshot.browser.lastError
    ?? (snapshot.browser.lastStartedAt ? `Started ${new Date(snapshot.browser.lastStartedAt).toLocaleTimeString()}` : "Not started");
  elements.browserProfile.textContent = `Profile: ${snapshot.browser.profilePath}`;
  updateBrowserButtons(snapshot.browser.state);
  renderPerakamStatus(snapshot.perakam, snapshot.browser.state);
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

function reminderStageLabel(stage: string): string {
  const labels = new Map<string, string>([
    ["clockInApproaching", "Clock-in approaching"],
    ["clockInDueNow", "Clock-in due now"],
    ["clockInGrace", "Clock-in grace period"],
    ["clockOutApproaching", "Clock-out approaching"],
    ["clockOutDueNow", "Clock-out due now"],
    ["clockOutGrace", "Clock-out grace period"]
  ]);

  return labels.get(stage) ?? stage;
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
elements.telegramForm.addEventListener("submit", (event) => {
  event.preventDefault();
});
elements.saveTelegramSettingsButton.addEventListener("click", () => {
  void saveTelegramSettings();
});
elements.sendTelegramTest.addEventListener("click", () => {
  void sendTelegramTestNotification();
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

function renderPerakamStatus(status: RendererPerakamStatusSnapshot, browserState: string): void {
  elements.perakamStatus.textContent = perakamStatusLabel(status.status);
  elements.perakamNote.textContent = status.lastError
    ?? (status.lastCheckedAt ? `Checked ${new Date(status.lastCheckedAt).toLocaleTimeString()}` : "Not checked");
  elements.perakamConfiguredUrl.textContent = status.dashboardUrl;
  elements.perakamUrlNote.textContent = buildPerakamUrlNote(status.dashboardUrl, status.legacyDashboardUrl);
  elements.perakamDetailStatus.textContent = perakamStatusLabel(status.status);
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

function readTelegramSettings(): RendererTelegramSettings {
  return {
    enabled: elements.telegramEnabled.checked,
    botToken: elements.telegramBotToken.value,
    chatId: elements.telegramChatId.value,
    commandPrefix: currentTelegramSettings?.commandPrefix ?? "alilos",
    lastUpdateId: currentTelegramSettings?.lastUpdateId ?? 0
  };
}

function renderTelegramSettings(settings: RendererTelegramSettings): void {
  currentTelegramSettings = settings;
  elements.telegramEnabled.checked = settings.enabled;
  elements.telegramBotToken.value = settings.botToken;
  elements.telegramChatId.value = settings.chatId;
}

function renderTelegramTestResult(result: RendererTelegramTestResult): void {
  setTelegramResult(result.message, result.ok ? "success" : "error");
}

function setTelegramControlsDisabled(disabled: boolean): void {
  elements.telegramEnabled.disabled = disabled;
  elements.telegramBotToken.disabled = disabled;
  elements.telegramChatId.disabled = disabled;
  elements.saveTelegramSettingsButton.disabled = disabled;
  elements.sendTelegramTest.disabled = disabled;
}

function setTelegramResult(message: string, tone: "neutral" | "success" | "error"): void {
  elements.telegramResult.textContent = message;
  elements.telegramResult.dataset.tone = tone;
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

window.alilos.onSnapshotUpdated(render);
setInterval(refresh, 1000);
void refresh();
void loadTelegramSettings();
