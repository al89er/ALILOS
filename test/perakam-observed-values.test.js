const assert = require("node:assert/strict");
const test = require("node:test");

const {
  extractPerakamObservedValues,
  observedStatusSummary,
  verifyObservedAttendanceValue
} = require("../dist/worker/perakam-observed-values");

const observedAt = "2026-06-22T09:00:00.000Z";
const todayDateKey = "2026-06-22";

function tile(action, valueText, overrides = {}) {
  return {
    action,
    text: action === "clock-in" ? `Masa Hadir ${valueText ?? ""} Klik Masuk` : `Masa Keluar ${valueText ?? ""} Klik Keluar`,
    valueText,
    dateText: "22/06/2026",
    valueSelector: action === "clock-in" ? "#wm" : "#wk",
    visible: true,
    inSidebar: false,
    ...overrides
  };
}

function observed(overrides = {}) {
  return {
    observedDate: todayDateKey,
    clockInTime: null,
    clockOutTime: null,
    source: "dashboard-tile",
    observedAt,
    pageState: "logged-in-dashboard",
    confidence: "low",
    reason: "test observed snapshot",
    ...overrides
  };
}

function verify(action, before, after) {
  return verifyObservedAttendanceValue({
    action,
    dateKey: todayDateKey,
    localClickResult: "click-succeeded-local",
    before,
    after,
    sanitizedUrlAfterClick: "https://perakamwaktu3.upm.edu.my/[redacted]",
    checkedAt: observedAt
  });
}

test("Perakam dashboard tile parser reads morning and evening values", () => {
  const result = extractPerakamObservedValues({
    pageStatus: "dashboard",
    dashboardTileTexts: [
      "Masa Hadir 08:01 Klik Masuk",
      "Masa Keluar 17:05 Klik Keluar"
    ],
    observedAt,
    todayDateKey
  });

  assert.equal(result.observedDate, todayDateKey);
  assert.equal(result.clockInTime, "08:01");
  assert.equal(result.clockOutTime, "17:05");
  assert.equal(result.source, "dashboard-tile");
  assert.equal(result.pageState, "logged-in-dashboard");
  assert.equal(result.confidence, "high");
});

test("Perakam dashboard parser chooses dashboard tile values over duplicate sidebar anchors", () => {
  const result = extractPerakamObservedValues({
    pageStatus: "dashboard",
    dashboardTiles: [
      tile("clock-in", null, { text: "Klik Masuk", visible: true, inSidebar: true }),
      tile("clock-out", null, { text: "Klik Keluar", visible: true, inSidebar: true }),
      tile("clock-in", "07:49 AM"),
      tile("clock-out", "05:07 PM")
    ],
    observedAt,
    todayDateKey
  });

  assert.equal(result.observedDate, todayDateKey);
  assert.equal(result.clockInTime, "07:49");
  assert.equal(result.clockOutTime, "17:07");
  assert.match(result.reason, /clock-in value 07:49 from #wm/);
  assert.match(result.reason, /clock-out value 17:07 from #wk/);
});

test("Perakam dashboard parser does not produce values from sidebar-only anchors", () => {
  const result = extractPerakamObservedValues({
    pageStatus: "dashboard",
    dashboardTiles: [
      tile("clock-in", "07:49 AM", { inSidebar: true }),
      tile("clock-out", "05:07 PM", { inSidebar: true })
    ],
    observedAt,
    todayDateKey
  });

  assert.equal(result.clockInTime, null);
  assert.equal(result.clockOutTime, null);
  assert.equal(result.source, "unknown");
  assert.equal(result.pageState, "logged-in-dashboard");
});

test("Perakam dashboard parser reads #wm and treats #wk placeholder as missing", () => {
  const result = extractPerakamObservedValues({
    pageStatus: "dashboard",
    dashboardTiles: [
      tile("clock-in", "07:49 AM"),
      tile("clock-out", "?")
    ],
    observedAt,
    todayDateKey
  });

  assert.equal(result.clockInTime, "07:49");
  assert.equal(result.clockOutTime, null);
  assert.equal(result.confidence, "medium");
  assert.match(result.reason, /clock-out missing placeholder from #wk/);
});

test("Perakam dashboard parser reads #wm and #wk values with AM/PM", () => {
  const result = extractPerakamObservedValues({
    pageStatus: "dashboard",
    dashboardTiles: [
      tile("clock-in", "07:49 AM"),
      tile("clock-out", "05:07 PM")
    ],
    observedAt,
    todayDateKey
  });

  assert.equal(result.clockInTime, "07:49");
  assert.equal(result.clockOutTime, "17:07");
  assert.equal(result.confidence, "high");
});

test("Perakam dashboard parser ignores hidden dashboard tiles", () => {
  const result = extractPerakamObservedValues({
    pageStatus: "dashboard",
    dashboardTiles: [
      tile("clock-in", "07:49 AM", { visible: false }),
      tile("clock-out", "05:07 PM", { visible: false })
    ],
    observedAt,
    todayDateKey
  });

  assert.equal(result.clockInTime, null);
  assert.equal(result.clockOutTime, null);
  assert.equal(result.source, "unknown");
  assert.equal(result.pageState, "logged-in-dashboard");
});

test("Perakam dashboard tile parser handles only morning value", () => {
  const result = extractPerakamObservedValues({
    pageStatus: "dashboard",
    dashboardTileTexts: [
      "Masa Hadir 07:59 Klik Masuk",
      "Masa Keluar Klik Keluar"
    ],
    observedAt,
    todayDateKey
  });

  assert.equal(result.clockInTime, "07:59");
  assert.equal(result.clockOutTime, null);
  assert.equal(result.confidence, "medium");
});

test("Perakam dashboard tile parser handles no values yet", () => {
  const result = extractPerakamObservedValues({
    pageStatus: "dashboard",
    dashboardTileTexts: [
      "Masa Hadir Klik Masuk",
      "Masa Keluar Klik Keluar"
    ],
    observedAt,
    todayDateKey
  });

  assert.equal(result.clockInTime, null);
  assert.equal(result.clockOutTime, null);
  assert.equal(result.source, "dashboard-tile");
  assert.equal(result.confidence, "low");
});

test("Perakam login and stale states do not produce observed times", () => {
  for (const pageStatus of ["login-required", "likely-login-required", "stale-session"]) {
    const result = extractPerakamObservedValues({
      pageStatus,
      dashboardTileTexts: ["Masa Hadir 08:01 Masa Keluar 17:05"],
      observedAt,
      todayDateKey
    });

    assert.equal(result.clockInTime, null);
    assert.equal(result.clockOutTime, null);
    assert.notEqual(result.pageState, "logged-in-dashboard");
  }
});

test("Perakam observed status summary is sanitized and compact", () => {
  const result = extractPerakamObservedValues({
    pageStatus: "dashboard",
    dashboardTileTexts: [
      "Masa Hadir 08:01 https://example.test/path?token=secret link=opaque",
      "Masa Keluar 17:05 cookie=secret"
    ],
    observedAt,
    todayDateKey
  });
  const serialized = JSON.stringify(result);
  const summary = observedStatusSummary(result);

  assert.doesNotMatch(serialized, /token=secret|link=opaque|cookie=secret|https:\/\/example\.test/);
  assert.match(summary, /observedPerakam=page:logged-in-dashboard/);
  assert.match(summary, /in:08:01/);
  assert.match(summary, /out:17:05/);
});

test("post-action verification marks clock-in already present before action", () => {
  const result = verify("clock-in", observed({ clockInTime: "07:49" }), observed({ clockInTime: "07:49" }));

  assert.equal(result.status, "already-present");
  assert.equal(result.observedValueBefore, "07:49");
  assert.equal(result.observedValueAfter, "07:49");
  assert.match(result.reason, /already present/);
});

test("post-action verification marks clock-in success when value appears after action", () => {
  const result = verify("clock-in", observed(), observed({ clockInTime: "07:50", confidence: "medium" }));

  assert.equal(result.status, "verified-success");
  assert.equal(result.observedValueBefore, null);
  assert.equal(result.observedValueAfter, "07:50");
});

test("post-action verification fails when clock-in remains missing on dashboard", () => {
  const result = verify("clock-in", observed(), observed());

  assert.equal(result.status, "verification-failed");
  assert.equal(result.observedPageState, "logged-in-dashboard");
});

test("post-action verification supports clock-out already-present and success", () => {
  const already = verify("clock-out", observed({ clockOutTime: "17:07" }), observed({ clockOutTime: "17:07" }));
  const success = verify("clock-out", observed(), observed({ clockOutTime: "17:08" }));

  assert.equal(already.status, "already-present");
  assert.equal(success.status, "verified-success");
  assert.equal(success.observedValueAfter, "17:08");
});

test("post-action verification returns unknown for stale/login/unreachable states", () => {
  for (const pageState of ["stale-session", "login-required", "unreachable"]) {
    const result = verify("clock-in", observed(), observed({ pageState, source: "unknown" }));

    assert.equal(result.status, "verification-unknown");
    assert.equal(result.observedPageState, pageState);
  }
});

test("post-action verification evidence stays sanitized", () => {
  const result = verifyObservedAttendanceValue({
    action: "clock-in",
    dateKey: todayDateKey,
    localClickResult: "click-succeeded-local",
    before: observed(),
    after: observed({ reason: "cookie=secret https://example.test/path?token=secret link=opaque" }),
    sanitizedUrlAfterClick: "https://perakamwaktu3.upm.edu.my/path?token=secret#access_token=secret",
    checkedAt: observedAt
  });
  const serialized = JSON.stringify(result);

  assert.doesNotMatch(serialized, /cookie=secret|token=secret|access_token=secret|link=opaque/);
  assert.match(serialized, /\[redacted-url\]/);
});
