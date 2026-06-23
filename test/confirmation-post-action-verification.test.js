const assert = require("node:assert/strict");
const test = require("node:test");

const { ConfirmationService } = require("../dist/worker/confirmation-service");

const now = new Date(2026, 5, 22, 9, 0, 0, 0);

function createLogger() {
  const entries = [];
  return {
    entries,
    info: (message) => entries.push({ level: "info", message }),
    warn: (message) => entries.push({ level: "warn", message }),
    error: (message) => entries.push({ level: "error", message })
  };
}

function observed(overrides = {}) {
  return {
    observedDate: "2026-06-22",
    clockInTime: null,
    clockOutTime: null,
    source: "dashboard-tile",
    observedAt: now.toISOString(),
    pageState: "logged-in-dashboard",
    confidence: "low",
    reason: "test observed values",
    ...overrides
  };
}

function perakamStatus() {
  return {
    status: "dashboard",
    dashboardUrl: "https://perakamwaktu3.upm.edu.my/",
    legacyDashboardUrl: "https://perakamwaktu.upm.edu.my/",
    currentUrl: "https://perakamwaktu3.upm.edu.my/",
    pageTitle: "Salam Sejahtera",
    pageState: "dashboard",
    statusReason: "Dashboard detected.",
    evidenceSnippets: [],
    lastNavigationAt: now.toISOString(),
    lastCheckedAt: now.toISOString(),
    clockInAvailable: "available",
    clockOutAvailable: "available",
    clockInReason: "visible dashboard tile",
    clockOutReason: "visible dashboard tile",
    lastButtonCheckAt: now.toISOString(),
    observedValues: observed(),
    lastError: null
  };
}

function scheduleSnapshot() {
  return {
    today: "2026-06-22",
    isWeekend: false,
    isTodaySkipped: false,
    gracePeriodMinutes: 10,
    schedule: {
      date: "2026-06-22",
      clockInTime: "09:00",
      clockOutTime: "17:00",
      generatedAt: now.toISOString()
    },
    actions: [
      { action: "clock-in", label: "Morning Action", time: "09:00", status: "due-now", statusText: "Due now" },
      { action: "clock-out", label: "Evening Action", time: "17:00", status: "upcoming", statusText: "Upcoming" }
    ],
    skippedDates: [],
    skippedDateDetails: [],
    summary: "test schedule"
  };
}

test("post-action verification does not trigger a second attendance click", async () => {
  const logger = createLogger();
  const completions = [];
  let clickCount = 0;
  let verifyCount = 0;
  const beforeObserved = observed();

  const service = new ConfirmationService(logger, {
    getScheduleSnapshot: scheduleSnapshot,
    getBrowserStatus: () => ({
      state: "running",
      profilePath: "profile",
      lastStartedAt: now.toISOString(),
      lastStoppedAt: null,
      lastError: null
    }),
    getPerakamStatus: perakamStatus,
    refreshPerakamStatus: async () => perakamStatus(),
    refreshObservedPerakamValues: async () => beforeObserved,
    getConfiguredPerakamUrl: () => "https://perakamwaktu3.upm.edu.my/",
    getPerakamAutoLoginSnapshot: () => ({
      enabled: false,
      useSharedCredential: false,
      username: "",
      hasSavedPassword: false,
      secureStorageAvailable: false,
      inFlight: false,
      lastUpdatedAt: null,
      lastLoginAttemptAt: null,
      lastLoginResult: "unknown",
      lastLoginReason: null
    }),
    clickVisibleAttendanceControl: async (action) => {
      clickCount += 1;
      return {
        action,
        mappedTargetId: "a50",
        beforeUrl: "https://perakamwaktu3.upm.edu.my/",
        afterUrl: "https://perakamwaktu3.upm.edu.my/",
        controlAvailability: {
          availability: "available",
          reason: "visible dashboard tile",
          checkedAt: now.toISOString()
        }
      };
    },
    verifyAttendanceAfterClick: async (action, dateKey, localClickResult, observedBefore) => {
      verifyCount += 1;
      assert.equal(observedBefore, beforeObserved);
      return {
        action,
        dateKey,
        localClickResult,
        status: "verified-success",
        reason: "clock-in verified from observed website value 09:01.",
        sanitizedUrlAfterClick: "https://perakamwaktu3.upm.edu.my/",
        evidenceSnippets: ["after=09:01", "page=logged-in-dashboard"],
        checkedAt: now.toISOString(),
        observedValueBefore: null,
        observedValueAfter: "09:01",
        observedPageState: "logged-in-dashboard",
        observedSource: "dashboard-tile",
        observedAt: now.toISOString()
      };
    },
    persistCompletion: (record) => {
      completions.push(record);
    },
    broadcastSnapshot: () => {}
  });

  const confirmation = service.createConfirmation("clock-in", now);
  assert.ok(confirmation);
  service.acceptConfirmation(confirmation.id, now);
  const result = await service.runGuardedAttendanceClick(confirmation.id, now);

  assert.equal(clickCount, 1);
  assert.equal(verifyCount, 1);
  assert.equal(result.status, "succeeded");
  assert.equal(result.completionState, "verified-success");
  assert.equal(completions.at(-1).state, "verified-success");
});
