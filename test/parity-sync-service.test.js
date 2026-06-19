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

function createStatusPayload(overrides = {}) {
  return {
    deviceId: "11111111-1111-4111-8111-111111111111",
    deviceLabel: "A.L.I.L.O.S. desktop",
    appVersion: "0.1.0",
    appStatus: "Ready",
    workerState: "running",
    executionMode: "manual-confirm",
    networkStatus: "online",
    captivePortalStatus: "not-detected",
    configuredSiteStatus: "dashboard",
    browserState: "stopped",
    syncHealth: "active",
    nextActionStatus: "upcoming",
    nextScheduleSummary: "clock-out:upcoming",
    completionSummary: "localCompletionRecords=0",
    lastErrorText: null,
    recordedAt: "2026-06-19T00:00:00.000Z",
    ...overrides
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

test("disabled parity sync service start is a no-op status", async () => {
  const temp = createTempConfigStore();

  try {
    const config = temp.store.load();
    const logger = createLogger();
    let fetchCalls = 0;
    const service = new ParitySyncService(config, logger, { supabaseUrl: "", publishableKey: "" }, {
      buildDeviceStatusPayload: () => createStatusPayload(),
      fetchFn: async () => {
        fetchCalls += 1;
        return { ok: true, status: 202 };
      }
    });

    service.start();
    await service.publishStatus();
    const status = service.getStatus();

    assert.equal(status.enabled, false);
    assert.equal(status.configured, false);
    assert.equal(status.active, false);
    assert.equal(status.health, "disabled");
    assert.equal(status.lastStartedAt, null);
    assert.equal(status.publishCount, 0);
    assert.equal(status.failureCount, 0);
    assert.match(status.note, /disabled/i);
    assert.equal(fetchCalls, 0);
    assert.equal(logger.entries.length, 1);
    assert.match(logger.entries[0].message, /disabled/);
  } finally {
    temp.cleanup();
  }
});

test("missing parity sync URL or key does not publish", async () => {
  const temp = createTempConfigStore();

  try {
    const config = temp.store.load();
    config.paritySync.enabled = true;
    const logger = createLogger();
    let fetchCalls = 0;
    const service = new ParitySyncService(config, logger, { supabaseUrl: "", publishableKey: "" }, {
      buildDeviceStatusPayload: () => createStatusPayload(),
      fetchFn: async () => {
        fetchCalls += 1;
        return { ok: true, status: 202 };
      }
    });

    await service.publishStatus();
    const status = service.getStatus();

    assert.equal(status.enabled, true);
    assert.equal(status.configured, false);
    assert.equal(status.publishCount, 0);
    assert.equal(status.failureCount, 0);
    assert.equal(fetchCalls, 0);
  } finally {
    temp.cleanup();
  }
});

test("service-role-looking parity sync key prevents publishing", async () => {
  const temp = createTempConfigStore();

  try {
    const config = temp.store.load();
    config.paritySync.enabled = true;
    config.paritySync.supabaseUrl = "https://example.supabase.co";
    config.paritySync.publishableKey = serviceRoleJwt();
    const logger = createLogger();
    let fetchCalls = 0;
    const service = new ParitySyncService(config, logger, { supabaseUrl: "", publishableKey: "" }, {
      buildDeviceStatusPayload: () => createStatusPayload(),
      fetchFn: async () => {
        fetchCalls += 1;
        return { ok: true, status: 202 };
      }
    });

    await service.publishStatus();
    const status = service.getStatus();

    assert.equal(status.configured, false);
    assert.equal(status.keyStatus, "missing");
    assert.equal(fetchCalls, 0);
  } finally {
    temp.cleanup();
  }
});

test("invalid parity sync device id prevents publishing", async () => {
  const temp = createTempConfigStore();

  try {
    const config = temp.store.load();
    config.paritySync.enabled = true;
    config.paritySync.supabaseUrl = "https://example.supabase.co";
    config.paritySync.publishableKey = "anon-publishable-key";
    config.paritySync.deviceId = "not-a-device-id";
    const logger = createLogger();
    let fetchCalls = 0;
    const service = new ParitySyncService(config, logger, { supabaseUrl: "", publishableKey: "" }, {
      buildDeviceStatusPayload: () => createStatusPayload(),
      fetchFn: async () => {
        fetchCalls += 1;
        return { ok: true, status: 202 };
      }
    });

    await service.publishStatus();
    const status = service.getStatus();

    assert.equal(status.configured, false);
    assert.equal(fetchCalls, 0);
  } finally {
    temp.cleanup();
  }
});

test("parity status publishing sanitizes payload and updates success counters", async () => {
  const temp = createTempConfigStore();

  try {
    const config = temp.store.load();
    config.paritySync.enabled = true;
    config.paritySync.supabaseUrl = "https://example.supabase.co";
    config.paritySync.publishableKey = "anon-publishable-key";
    config.paritySync.logUploadEnabled = true;
    const logger = createLogger();
    let request = null;
    const service = new ParitySyncService(config, logger, { supabaseUrl: "", publishableKey: "" }, {
      buildDeviceStatusPayload: () => createStatusPayload({
        deviceLabel: "Work https://secret.example/path?token=abc",
        lastErrorText: "Failed https://portal.example/login?magic=secret&4Tredir=secret link=opaque bot123:secret"
      }),
      fetchFn: async (url, init) => {
        request = { url, init };
        return { ok: true, status: 202 };
      }
    });

    await service.publishStatus("https://source.example/path?token=secret link=opaque");
    const status = service.getStatus();
    const body = JSON.parse(request.init.body);
    const serialized = JSON.stringify(body);

    assert.equal(request.url, "https://example.supabase.co/functions/v1/alilos-parity-status");
    assert.equal(status.publishCount, 1);
    assert.equal(status.failureCount, 0);
    assert.ok(status.lastSuccessAt);
    assert.equal(body.events.length, 1);
    assert.doesNotMatch(serialized, /token=abc|magic=secret|4Tredir=secret|link=opaque|magic=|4Tredir=|link=|bot123:secret/);
    assert.match(body.deviceStatus.deviceLabel, /https:\/\/secret\.example\/\[redacted\]/);
    assert.match(body.deviceStatus.lastErrorText, /\[redacted\]/);
    assert.match(body.events[0].details.source, /\[redacted\]/);
  } finally {
    temp.cleanup();
  }
});

test("parity status publishing records sanitized failure counters", async () => {
  const temp = createTempConfigStore();

  try {
    const config = temp.store.load();
    config.paritySync.enabled = true;
    config.paritySync.supabaseUrl = "https://example.supabase.co";
    config.paritySync.publishableKey = "anon-publishable-key";
    const logger = createLogger();
    const service = new ParitySyncService(config, logger, { supabaseUrl: "", publishableKey: "" }, {
      buildDeviceStatusPayload: () => createStatusPayload(),
      fetchFn: async () => ({ ok: false, status: 403 })
    });

    await service.publishStatus();
    const status = service.getStatus();

    assert.equal(status.publishCount, 0);
    assert.equal(status.failureCount, 1);
    assert.match(status.lastError, /HTTP 403/);
    assert.ok(status.lastAttemptAt);
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
