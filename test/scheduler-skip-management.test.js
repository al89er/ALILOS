const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { ConfigStore } = require("../dist/main/config-store");
const { Scheduler } = require("../dist/worker/scheduler");

function createLogger() {
  const entries = [];
  return {
    entries,
    info: (message) => entries.push({ level: "info", message }),
    warn: (message) => entries.push({ level: "warn", message }),
    error: (message) => entries.push({ level: "error", message })
  };
}

function createScheduler() {
  const dir = fs.mkdtempSync(path.join(process.cwd(), ".tmp-alilos-scheduler-"));
  const store = new ConfigStore(dir, dir);
  const config = store.load();
  const logger = createLogger();
  const scheduler = new Scheduler(config, store, logger);

  return {
    config,
    store,
    logger,
    scheduler,
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true })
  };
}

test("remote skip row adds local whole-day skip with remote-managed metadata", () => {
  const temp = createScheduler();

  try {
    const result = temp.scheduler.applyRemoteSkippedDates([
      { skipDate: "2026-06-24", actionKey: null, source: "webapp-command" }
    ]);
    const snapshot = temp.scheduler.getSnapshot(new Date(2026, 5, 23, 8, 0, 0));

    assert.equal(result.added, 1);
    assert.deepEqual(temp.config.scheduler.skippedDates, ["2026-06-24"]);
    assert.equal(temp.config.scheduler.skipMetadataByDate["2026-06-24"].source, "remote-managed");
    assert.equal(snapshot.skippedDateDetails[0].source, "remote-managed");
  } finally {
    temp.cleanup();
  }
});

test("remote row deletion removes skip only when it was remote-managed", () => {
  const temp = createScheduler();

  try {
    temp.scheduler.applyRemoteSkippedDates([
      { skipDate: "2026-06-24", actionKey: null, source: "webapp-command" }
    ]);
    const result = temp.scheduler.applyRemoteSkippedDates([]);

    assert.equal(result.remoteRemovalsApplied, 1);
    assert.deepEqual(temp.config.scheduler.skippedDates, []);
    assert.equal(temp.config.scheduler.skipMetadataByDate["2026-06-24"], undefined);
  } finally {
    temp.cleanup();
  }
});

test("remote row deletion preserves local-only desktop skip", () => {
  const temp = createScheduler();

  try {
    temp.scheduler.skipDateKey("2026-06-24");
    temp.scheduler.applyRemoteSkippedDates([
      { skipDate: "2026-06-24", actionKey: null, source: "webapp-command" }
    ]);
    const result = temp.scheduler.applyRemoteSkippedDates([]);

    assert.equal(result.remoteRemovalsApplied, 0);
    assert.equal(result.remoteRemovalsPreserved, 1);
    assert.deepEqual(temp.config.scheduler.skippedDates, ["2026-06-24"]);
    assert.equal(temp.config.scheduler.skipMetadataByDate["2026-06-24"].source, "local");
  } finally {
    temp.cleanup();
  }
});

test("user-initiated desktop removal removes arbitrary legacy skip", () => {
  const temp = createScheduler();

  try {
    temp.config.scheduler.skippedDates = ["2026-07-10"];
    temp.store.save(temp.config);
    const removed = temp.scheduler.unskipDateKey("2026-07-10");

    assert.equal(removed, true);
    assert.deepEqual(temp.config.scheduler.skippedDates, []);
    assert.equal(temp.config.scheduler.skipMetadataByDate["2026-07-10"], undefined);
  } finally {
    temp.cleanup();
  }
});

test("desktop uploaded skip is removable by later remote deletion", () => {
  const temp = createScheduler();

  try {
    temp.scheduler.skipDateKey("2026-07-10");
    temp.scheduler.markSkipDateUploaded("2026-07-10");
    const result = temp.scheduler.applyRemoteSkippedDates([]);

    assert.equal(result.remoteRemovalsApplied, 1);
    assert.deepEqual(temp.config.scheduler.skippedDates, []);
  } finally {
    temp.cleanup();
  }
});

test("action-specific remote skip is conservatively represented as whole-day local skip", () => {
  const temp = createScheduler();

  try {
    temp.scheduler.applyRemoteSkippedDates([
      { skipDate: "2026-06-24", actionKey: "clock-out", source: "webapp-command" }
    ]);
    const detail = temp.scheduler.getSnapshot(new Date(2026, 5, 23, 8, 0, 0)).skippedDateDetails[0];

    assert.equal(detail.scope, "whole-day");
    assert.equal(detail.actionKey, "clock-out");
  } finally {
    temp.cleanup();
  }
});
