const config = window.ALILOS_WEBAPP_CONFIG ?? {};
const today = new Date();
const state = {
  data: sampleDashboard(monthKey(today)),
  source: "mock",
  monthKey: monthKey(today),
  activeTab: "dashboard-panel"
};

const ids = [
  "connection-pill",
  "device-freshness",
  "online-dot",
  "device-label",
  "device-id",
  "last-heartbeat",
  "app-mode",
  "browser-status",
  "site-status",
  "network-status",
  "portal-status",
  "last-error",
  "morning-time",
  "morning-state",
  "evening-time",
  "evening-state",
  "schedule-freshness",
  "schedule-list",
  "next-action",
  "completion-freshness",
  "completion-list",
  "skip-freshness",
  "calendar-month",
  "calendar-grid",
  "prev-month",
  "next-month",
  "skip-note",
  "skip-list",
  "log-freshness",
  "log-list",
  "cmd-pending",
  "cmd-claimed",
  "cmd-completed",
  "cmd-rejected",
  "command-latest",
  "command-message"
];

const elements = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
const commandButtons = [...document.querySelectorAll("[data-command-type]")];
const tabButtons = [...document.querySelectorAll("[data-tab-target]")];
const tabPanels = [...document.querySelectorAll("[data-tab-panel]")];

render();
bindTabs();
bindCommandButtons();
bindMonthButtons();
void loadDashboard();

async function loadDashboard() {
  if (!isConfigured(config)) {
    render("Mock data: configure placeholder values to use the read proxy.", "neutral");
    return;
  }

  try {
    const endpoint = new URL("/functions/v1/alilos-dashboard-read", config.VITE_SUPABASE_URL);
    const response = await fetch(endpoint.toString(), {
      method: "POST",
      headers: {
        apikey: config.VITE_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${config.VITE_SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        deviceId: config.VITE_ALILOS_DEVICE_ID,
        dateKey: todayKey(),
        monthKey: state.monthKey
      })
    });

    if (!response.ok) {
      throw new Error(`Read proxy returned HTTP ${response.status}.`);
    }

    state.data = sanitizeDashboard(await response.json());
    state.source = "live";
    render("Live read proxy", "good");
  } catch (error) {
    state.source = "mock";
    render(sanitizeText(error.message, 120) ?? "Live read unavailable; showing mock state.", "warn");
  }
}

function bindTabs() {
  for (const button of tabButtons) {
    button.addEventListener("click", () => {
      state.activeTab = button.dataset.tabTarget;
      renderTabs();
    });
  }
}

function bindMonthButtons() {
  elements["prev-month"].addEventListener("click", () => {
    state.monthKey = shiftMonth(state.monthKey, -1);
    void loadDashboard();
    render();
  });
  elements["next-month"].addEventListener("click", () => {
    state.monthKey = shiftMonth(state.monthKey, 1);
    void loadDashboard();
    render();
  });
}

function bindCommandButtons() {
  for (const button of commandButtons) {
    button.addEventListener("click", () => {
      void submitSafeCommand(button.dataset.commandType);
    });
  }
}

async function submitSafeCommand(commandType) {
  if (!SAFE_COMMAND_TYPES.has(commandType)) {
    setCommandMessage("Unsupported command rejected by webapp.", "bad");
    return;
  }

  if (!isConfigured(config)) {
    setCommandMessage("Command not submitted: configure Supabase URL, anon key, and device id first.", "warn");
    return;
  }

  setButtonsDisabled(true);
  setCommandMessage(`Submitting ${commandLabel(commandType)}...`, "neutral");

  try {
    const endpoint = new URL("/functions/v1/alilos-command-sync", config.VITE_SUPABASE_URL);
    const response = await fetch(endpoint.toString(), {
      method: "POST",
      headers: {
        apikey: config.VITE_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${config.VITE_SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        deviceId: config.VITE_ALILOS_DEVICE_ID,
        operation: "create-command",
        commandType,
        payload: {
          requestedFrom: "webapp",
          noConfiguredSiteAction: true
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Command proxy returned HTTP ${response.status}.`);
    }

    const result = await response.json();
    const id = result?.command?.id ? shortId(result.command.id) : "pending";
    setCommandMessage(`${commandLabel(commandType)} submitted as ${id}. Desktop must be online with command sync enabled.`, "good");
    await loadDashboard();
  } catch (error) {
    setCommandMessage(sanitizeText(error.message, 160) ?? "Command submission failed.", "bad");
  } finally {
    setButtonsDisabled(false);
  }
}

function render(message = state.source === "live" ? "Live read proxy" : "Mock data", tone = state.source === "live" ? "good" : "neutral") {
  const data = state.data;
  const heartbeat = data.heartbeat;
  const lastSeen = heartbeat?.lastSeenAt ?? data.device?.lastSeenAt ?? null;
  const freshness = heartbeatFreshness(lastSeen);

  renderTabs();
  elements["connection-pill"].textContent = message;
  elements["connection-pill"].className = `pill ${tone}`;
  elements["device-freshness"].textContent = freshness.label;
  elements["online-dot"].className = `dot ${freshness.state}`;
  elements["device-label"].textContent = data.device?.label ?? "A.L.I.L.O.S. desktop";
  elements["device-id"].textContent = data.device?.deviceId ? `Device ${shortId(data.device.deviceId)}` : "Device id not configured";
  elements["last-heartbeat"].textContent = formatTime(lastSeen);
  elements["app-mode"].textContent = heartbeat?.appStatus ?? "unknown";
  elements["browser-status"].textContent = heartbeat?.statusText ?? "status unavailable";
  elements["site-status"].textContent = heartbeat?.configuredSiteStatus ?? "unknown";
  elements["network-status"].textContent = heartbeat?.networkStatus ?? "unknown";
  elements["portal-status"].textContent = inferPortalStatus(heartbeat?.networkStatus);
  elements["last-error"].textContent = heartbeat?.lastErrorText ?? "No sanitized error reported.";

  renderActionCards(data.schedules ?? [], data.completions ?? []);
  renderSchedules(data.schedules ?? []);
  renderCompletions(data.completions ?? []);
  renderSkipCalendar(data.skips ?? []);
  renderLogs(data.eventLogs ?? []);
  renderCommands(data.commandSync);
}

function renderTabs() {
  for (const button of tabButtons) {
    const active = button.dataset.tabTarget === state.activeTab;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  }
  for (const panel of tabPanels) {
    const active = panel.id === state.activeTab;
    panel.classList.toggle("active", active);
    panel.hidden = !active;
  }
}

function renderActionCards(schedules, completions) {
  renderActionCard("clock-in", "morning", schedules, completions);
  renderActionCard("clock-out", "evening", schedules, completions);
}

function renderActionCard(actionKey, prefix, schedules, completions) {
  const schedule = schedules.find((item) => item.actionKey === actionKey);
  const completion = completions.find((item) => item.actionKey === actionKey);
  elements[`${prefix}-time`].textContent = schedule?.targetTimeLocal ?? "--";
  elements[`${prefix}-state`].textContent = completion
    ? `${completion.state} - ${completion.verificationState ?? "verification unknown"}`
    : schedule
      ? `${schedule.status} - ${schedule.source}`
      : "Schedule unavailable";
}

function renderSchedules(schedules) {
  elements["schedule-list"].replaceChildren(...(schedules.length ? schedules.map((item) => listItem(
    actionLabel(item.actionKey),
    `${item.targetTimeLocal} (${item.status})`,
    `Window ${item.windowStartLocal ?? "--"}-${item.windowEndLocal ?? "--"} - ${item.source} - ${formatTime(item.updatedAt)}`
  )) : [listItem("Schedule unavailable", "No synced rows", "Desktop remains source of truth.")]));

  const next = schedules.find((item) => item.status === "active") ?? schedules[0] ?? null;
  elements["next-action"].textContent = next
    ? `Next synced action: ${actionLabel(next.actionKey)} at ${next.targetTimeLocal}.`
    : "Next scheduled action unavailable.";
  elements["schedule-freshness"].textContent = latestTimestampLabel(schedules);
}

function renderSkipCalendar(skips) {
  const skippedDates = new Set(skips.map((item) => item.skipDate).filter(Boolean));
  const current = parseMonthKey(state.monthKey);
  const first = new Date(current.year, current.monthIndex, 1);
  const daysInMonth = new Date(current.year, current.monthIndex + 1, 0).getDate();
  const cells = [];

  elements["calendar-month"].textContent = first.toLocaleString(undefined, { month: "long", year: "numeric" });
  for (let index = 0; index < first.getDay(); index += 1) {
    const filler = document.createElement("span");
    filler.className = "calendar-day filler";
    cells.push(filler);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateKey = `${state.monthKey}-${String(day).padStart(2, "0")}`;
    const cell = document.createElement("button");
    cell.type = "button";
    cell.disabled = true;
    cell.className = "calendar-day";
    cell.textContent = String(day);
    if (dateKey === todayKey()) cell.classList.add("today");
    if (skippedDates.has(dateKey)) {
      cell.classList.add("skipped");
      cell.setAttribute("aria-label", `${dateKey} skipped`);
    } else {
      cell.setAttribute("aria-label", `${dateKey} not skipped`);
    }
    cells.push(cell);
  }

  elements["calendar-grid"].replaceChildren(...cells);
  elements["skip-list"].replaceChildren(...(skips.length ? skips.map((item) => listItem(
    item.skipDate,
    item.actionKey ? `${actionLabel(item.actionKey)} skipped` : "Whole day skipped",
    `${item.reason ?? "No reason supplied"} - ${item.source} - ${formatTime(item.updatedAt)}`
  )) : [listItem("No skipped dates", "Calendar has no synced skip rows", "Missing web data never implies action readiness.")]));
  elements["skip-freshness"].textContent = latestTimestampLabel(skips);
  elements["skip-note"].textContent = "Read-only calendar. Interactive skip/unskip controls are planned next.";
}

function renderCompletions(completions) {
  elements["completion-list"].replaceChildren(...(completions.length ? completions.map((item) => listItem(
    actionLabel(item.actionKey),
    item.state,
    `${item.verificationState ?? "verification unknown"} - ${item.sanitizedReason ?? "No result summary"} - ${formatTime(item.updatedAt ?? item.verifiedAt ?? item.attemptedAt)}`
  )) : [listItem("Completion unknown", "No synced completion row", "Check the desktop before making decisions.")]));
  elements["completion-freshness"].textContent = latestTimestampLabel(completions);
}

function renderLogs(eventLogs) {
  elements["log-list"].replaceChildren(...(eventLogs.length ? eventLogs.map((item) => logItem(item)) : [
    logItem({
      severity: "info",
      eventType: "sync",
      message: "No sanitized event logs are available.",
      eventTime: null
    })
  ]));
  elements["log-freshness"].textContent = eventLogs.length ? latestTimestampLabel(eventLogs.map((row) => ({ updatedAt: row.eventTime ?? row.createdAt }))) : "No synced logs";
}

function renderCommands(commandSync) {
  const counters = commandSync?.counters ?? {};
  elements["cmd-pending"].textContent = String(counters.pending ?? 0);
  elements["cmd-claimed"].textContent = String(counters.claimed ?? 0);
  elements["cmd-completed"].textContent = String((counters.succeeded ?? 0) + (counters.cancelled ?? 0));
  elements["cmd-rejected"].textContent = String((counters.rejected ?? 0) + (counters.failed ?? 0) + (counters.expired ?? 0));
  elements["command-latest"].textContent = commandSync?.latest
    ? `Latest ${commandSync.latest.commandType}: ${commandSync.latest.status}. ${commandSync.latest.resultSummary ?? "No raw details shown."}`
    : "Safe command controls can submit requests, but no command result is synced yet.";
}

const SAFE_COMMAND_TYPES = new Set([
  "request-status-refresh",
  "request-dry-run",
  "recalculate-today-schedule",
  "cancel-confirmation"
]);

function listItem(title, value, detail) {
  const item = document.createElement("div");
  item.className = "list-item";
  item.innerHTML = `<div class="row"><span></span><strong></strong></div><small></small>`;
  item.querySelector("span").textContent = title;
  item.querySelector("strong").textContent = value;
  item.querySelector("small").textContent = detail;
  return item;
}

function logItem(log) {
  const item = document.createElement("div");
  item.className = `log-row ${log.severity ?? "info"}`;
  item.innerHTML = `<span></span><strong></strong><p></p><time></time>`;
  item.querySelector("span").textContent = String(log.severity ?? "info").toUpperCase();
  item.querySelector("strong").textContent = String(log.eventType ?? "event");
  item.querySelector("p").textContent = sanitizeText(log.message, 240) ?? "Sanitized event.";
  item.querySelector("time").textContent = formatTime(log.eventTime ?? log.createdAt);
  return item;
}

function sanitizeDashboard(value) {
  if (!value || typeof value !== "object" || value.success !== true) {
    return sampleDashboard(state.monthKey);
  }

  return value;
}

function isConfigured(value) {
  return Boolean(value.VITE_SUPABASE_URL && value.VITE_SUPABASE_ANON_KEY && value.VITE_ALILOS_DEVICE_ID);
}

function heartbeatFreshness(value) {
  if (!value) {
    return { state: "unknown", label: "No heartbeat" };
  }

  const ageMs = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(ageMs) || ageMs < 0) {
    return { state: "unknown", label: "Unknown freshness" };
  }
  if (ageMs <= 2 * 60 * 1000) {
    return { state: "online", label: "Online" };
  }
  if (ageMs <= 15 * 60 * 1000) {
    return { state: "stale", label: "Stale" };
  }
  return { state: "offline", label: "Offline or unreachable" };
}

function latestTimestampLabel(rows) {
  const latest = rows
    .map((row) => row.updatedAt ?? row.verifiedAt ?? row.attemptedAt ?? row.eventTime ?? row.createdAt ?? null)
    .filter(Boolean)
    .sort()
    .at(-1);
  return latest ? `Synced ${formatTime(latest)}` : "Unavailable";
}

function actionLabel(value) {
  return value === "clock-in" ? "Morning action" : value === "clock-out" ? "Evening action" : "Action";
}

function inferPortalStatus(networkStatus) {
  const text = String(networkStatus ?? "").toLowerCase();
  if (text.includes("captive")) return "possible/detected";
  if (text.includes("online")) return "not detected";
  return "unknown";
}

function commandLabel(value) {
  switch (value) {
    case "request-status-refresh":
      return "Status refresh";
    case "request-dry-run":
      return "Dry-run/check";
    case "recalculate-today-schedule":
      return "Schedule recalculation";
    case "cancel-confirmation":
      return "Confirmation cancellation";
    default:
      return "Command";
  }
}

function setCommandMessage(message, tone) {
  elements["command-message"].textContent = message;
  elements["command-message"].dataset.tone = tone;
}

function setButtonsDisabled(disabled) {
  for (const button of commandButtons) {
    button.disabled = disabled;
  }
}

function formatTime(value) {
  if (!value) return "--";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "--" : date.toLocaleString();
}

function shortId(value) {
  return String(value ?? "").slice(0, 8) || "unknown";
}

function sanitizeText(value, maxLength) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength) || null;
}

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function monthKey(value) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
}

function parseMonthKey(value) {
  const [year, month] = String(value).split("-").map(Number);
  return {
    year: Number.isInteger(year) ? year : today.getFullYear(),
    monthIndex: Number.isInteger(month) ? Math.max(0, Math.min(11, month - 1)) : today.getMonth()
  };
}

function shiftMonth(value, delta) {
  const parsed = parseMonthKey(value);
  const date = new Date(parsed.year, parsed.monthIndex + delta, 1);
  return monthKey(date);
}

function sampleDashboard(inputMonthKey) {
  const now = new Date().toISOString();
  const currentMonth = inputMonthKey ?? monthKey(today);
  return {
    success: true,
    dateKey: todayKey(),
    monthKey: currentMonth,
    device: {
      deviceId: "00000000-0000-4000-8000-000000000000",
      label: "A.L.I.L.O.S. desktop",
      lastSeenAt: now
    },
    heartbeat: {
      appStatus: "manual-confirm",
      networkStatus: "online",
      configuredSiteStatus: "dashboard",
      statusText: "Browser status unavailable in static preview.",
      lastErrorText: null,
      lastSeenAt: now
    },
    schedules: [
      { actionKey: "clock-in", targetTimeLocal: "07:45", windowStartLocal: "07:45", windowEndLocal: "07:50", source: "mock", status: "active", updatedAt: now },
      { actionKey: "clock-out", targetTimeLocal: "17:05", windowStartLocal: "17:05", windowEndLocal: "17:10", source: "mock", status: "active", updatedAt: now }
    ],
    skips: [
      { skipDate: `${currentMonth}-15`, actionKey: null, reason: "Mock read-only skip", source: "mock", updatedAt: now }
    ],
    completions: [],
    eventLogs: [
      { eventTime: now, eventType: "desktop-status", severity: "info", message: "Desktop status preview is sanitized.", createdAt: now },
      { eventTime: now, eventType: "sync", severity: "warn", message: "Live dashboard read is not configured.", createdAt: now }
    ],
    commandSync: {
      counters: { pending: 0, claimed: 0, succeeded: 0, failed: 0, expired: 0, rejected: 0, cancelled: 0 },
      latest: null,
      controlsAvailable: false
    }
  };
}
