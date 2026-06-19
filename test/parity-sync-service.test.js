const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { ConfigStore, looksLikeSupabaseServiceRoleKey } = require("../dist/main/config-store");
const {
  PARITY_COMMAND_STATUSES,
  PARITY_COMMAND_TYPES,
  ParitySyncService
} = require("../dist/worker/parity-sync-service");

function createLogger() {
  const entries = [];
  return {
    entries,
    info: (message) => entries.push({ level: "info", message }),
    warn: (message) => entries.push({ level: "warn", message }),
    error: (message) => entries.push({ level: "error", message })
  };
}

function createTempConfigStore() {
  const dir = fs.mkdtempSync(path.join(process.cwd(), ".tmp-alilos-parity-sync-"));
  return {
    dir,
    store: new ConfigStore(dir, dir),
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true })
  };
}

function serviceRoleJwt() {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url");
  return `${header}.${payload}.signature`;
}

test("parity sync config defaults disabled and empty", () => {
  const temp = createTempConfigStore();

  try {
    const config = temp.store.load();

    assert.equal(config.paritySync.enabled, false);
    assert.equal(config.paritySync.supabaseUrl, "");
    assert.equal(config.paritySync.publishableKey, "");
    assert.match(config.paritySync.deviceId, /^[0-9a-f-]{36}$/i);
    assert.equal(config.paritySync.deviceLabel, "A.L.I.L.O.S. desktop");
    assert.equal(config.paritySync.heartbeatIntervalSeconds, 60);
    assert.equal(config.paritySync.commandPollIntervalSeconds, 60);
    assert.equal(config.paritySync.logUploadEnabled, false);
    assert.equal(config.paritySync.skipSyncEnabled, false);
    assert.equal(config.paritySync.commandSyncEnabled, false);
    assert.equal(config.paritySync.scheduleCompletionSyncEnabled, false);
  } finally {
    temp.cleanup();
  }
});

test("parity sync config rejects service-role-looking keys", () => {
  const temp = createTempConfigStore();

  try {
    const config = temp.store.load();
    config.paritySync.publishableKey = serviceRoleJwt();
    temp.store.save(config);

    const reloaded = temp.store.load();
    assert.equal(looksLikeSupabaseServiceRoleKey(serviceRoleJwt()), true);
    assert.equal(looksLikeSupabaseServiceRoleKey("sb_secret_test"), true);
    assert.equal(reloaded.paritySync.publishableKey, "");
  } finally {
    temp.cleanup();
  }
});

test("disabled parity sync service start is a no-op status", () => {
  const temp = createTempConfigStore();

  try {
    const config = temp.store.load();
    const logger = createLogger();
    const service = new ParitySyncService(config, logger, { supabaseUrl: "", publishableKey: "" });

    service.start();
    const status = service.getStatus();

    assert.equal(status.enabled, false);
    assert.equal(status.configured, false);
    assert.equal(status.active, false);
    assert.equal(status.health, "disabled");
    assert.equal(status.lastStartedAt, null);
    assert.match(status.note, /disabled/i);
    assert.equal(logger.entries.length, 1);
    assert.match(logger.entries[0].message, /disabled/);
  } finally {
    temp.cleanup();
  }
});

test("parity command constants match migration allow lists", () => {
  assert.deepEqual([...PARITY_COMMAND_TYPES], [
    "request-status-refresh",
    "request-dry-run",
    "request-confirmation",
    "cancel-confirmation",
    "perform-configured-action",
    "recalculate-today-schedule"
  ]);

  assert.deepEqual([...PARITY_COMMAND_STATUSES], [
    "pending",
    "claimed",
    "succeeded",
    "failed",
    "expired",
    "rejected",
    "cancelled"
  ]);
});
