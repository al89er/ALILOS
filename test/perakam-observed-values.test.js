const assert = require("node:assert/strict");
const test = require("node:test");

const {
  extractPerakamObservedValues,
  observedStatusSummary
} = require("../dist/worker/perakam-observed-values");

const observedAt = "2026-06-22T09:00:00.000Z";
const todayDateKey = "2026-06-22";

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
