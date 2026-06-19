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

test("skip sync disabled does not call fetch", async () => {
  const temp = createTempConfigStore();

  try {
    const config = temp.store.load();
    config.paritySync.enabled = true;
    config.paritySync.supabaseUrl = "https://example.supabase.co";
    config.paritySync.publishableKey = "anon-publishable-key";
    config.paritySync.skipSyncEnabled = false;
    const logger = createLogger();
    let fetchCalls = 0;
    const service = new ParitySyncService(config, logger, { supabaseUrl: "", publishableKey: "" }, {
      buildDeviceStatusPayload: () => createStatusPayload(),
      fetchFn: async () => {
        fetchCalls += 1;
        return { ok: true, status: 200, json: async () => ({ success: true, skips: [] }) };
      }
    });

    await service.syncSkipDates();
    const status = service.getStatus();

    assert.equal(status.skipSync.enabled, false);
    assert.equal(status.skipSync.syncCount, 0);
    assert.equal(fetchCalls, 0);
  } finally {
    temp.cleanup();
  }
});

test("skip sync missing config does not call fetch", async () => {
  const temp = createTempConfigStore();

  try {
    const config = temp.store.load();
    config.paritySync.enabled = true;
    config.paritySync.skipSyncEnabled = true;
    const logger = createLogger();
    let fetchCalls = 0;
    const service = new ParitySyncService(config, logger, { supabaseUrl: "", publishableKey: "" }, {
      buildDeviceStatusPayload: () => createStatusPayload(),
      fetchFn: async () => {
        fetchCalls += 1;
        return { ok: true, status: 200, json: async () => ({ success: true, skips: [] }) };
      }
    });

    await service.syncSkipDates();
    const status = service.getStatus();

    assert.equal(status.configured, false);
    assert.equal(status.skipSync.syncCount, 0);
    assert.equal(fetchCalls, 0);
  } finally {
    temp.cleanup();
  }
});

test("skip sync list merges remote skip dates without deleting local skips", async () => {
  const temp = createTempConfigStore();

  try {
    const config = temp.store.load();
    config.paritySync.enabled = true;
    config.paritySync.supabaseUrl = "https://example.supabase.co";
    config.paritySync.publishableKey = "anon-publishable-key";
    config.paritySync.skipSyncEnabled = true;
    config.scheduler.skippedDates = ["2026-06-20"];
    const logger = createLogger();
    let request = null;
    const service = new ParitySyncService(config, logger, { supabaseUrl: "", publishableKey: "" }, {
      buildDeviceStatusPayload: () => createStatusPayload(),
      mergeRemoteSkippedDates: (dates) => {
        const before = config.scheduler.skippedDates.length;
        config.scheduler.skippedDates = [...new Set([...config.scheduler.skippedDates, ...dates])].sort();
        return config.scheduler.skippedDates.length - before;
      },
      fetchFn: async (url, init) => {
        request = { url, init };
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            skips: [
              {
                deviceId: config.paritySync.deviceId,
                skipDate: "2026-06-21",
                actionKey: "clock-out",
                reason: "webapp requested",
                source: "webapp-command"
              }
            ]
          })
        };
      }
    });

    await service.syncSkipDates("test");
    const status = service.getStatus();
    const body = JSON.parse(request.init.body);

    assert.equal(request.url, "https://example.supabase.co/functions/v1/alilos-skip-sync");
    assert.equal(body.operation, "list-skips");
    assert.equal(body.deviceId, config.paritySync.deviceId);
    assert.deepEqual(config.scheduler.skippedDates, ["2026-06-20", "2026-06-21"]);
    assert.equal(status.skipSync.rowsReceived, 1);
    assert.equal(status.skipSync.rowsApplied, 1);
    assert.equal(status.skipSync.syncCount, 1);
    assert.equal(status.skipSync.failureCount, 0);
  } finally {
    temp.cleanup();
  }
});

test("skip sync empty remote list preserves existing local skip", async () => {
  const temp = createTempConfigStore();

  try {
    const config = temp.store.load();
    config.paritySync.enabled = true;
    config.paritySync.supabaseUrl = "https://example.supabase.co";
    config.paritySync.publishableKey = "anon-publishable-key";
    config.paritySync.skipSyncEnabled = true;
    config.scheduler.skippedDates = ["2026-06-20"];
    const logger = createLogger();
    const service = new ParitySyncService(config, logger, { supabaseUrl: "", publishableKey: "" }, {
      buildDeviceStatusPayload: () => createStatusPayload(),
      mergeRemoteSkippedDates: (dates) => {
        const before = config.scheduler.skippedDates.length;
        config.scheduler.skippedDates = [...new Set([...config.scheduler.skippedDates, ...dates])].sort();
        return config.scheduler.skippedDates.length - before;
      },
      fetchFn: async () => ({ ok: true, status: 200, json: async () => ({ success: true, skips: [] }) })
    });

    await service.syncSkipDates("test");
    const status = service.getStatus();

    assert.deepEqual(config.scheduler.skippedDates, ["2026-06-20"]);
    assert.equal(status.skipSync.rowsReceived, 0);
    assert.equal(status.skipSync.rowsApplied, 0);
    assert.equal(status.skipSync.syncCount, 1);
  } finally {
    temp.cleanup();
  }
});

test("skip sync upsert and delete send sanitized scheduling-only payloads", async () => {
  const temp = createTempConfigStore();

  try {
    const config = temp.store.load();
    config.paritySync.enabled = true;
    config.paritySync.supabaseUrl = "https://example.supabase.co";
    config.paritySync.publishableKey = "anon-publishable-key";
    config.paritySync.skipSyncEnabled = true;
    const logger = createLogger();
    const requests = [];
    const service = new ParitySyncService(config, logger, { supabaseUrl: "", publishableKey: "" }, {
      buildDeviceStatusPayload: () => createStatusPayload(),
      fetchFn: async (url, init) => {
        requests.push({ url, init });
        return { ok: true, status: 202, json: async () => ({ success: true, affectedCount: 1 }) };
      }
    });

    await service.upsertSkipDate("2026-06-22", "Desktop https://secret.example/path?token=abc link=opaque magic=secret");
    await service.deleteSkipDate("2026-06-22");
    const upsertBody = JSON.parse(requests[0].init.body);
    const deleteBody = JSON.parse(requests[1].init.body);
    const serialized = JSON.stringify([upsertBody, deleteBody]);
    const status = service.getStatus();

    assert.equal(upsertBody.operation, "upsert-skip");
    assert.equal(upsertBody.skipDate, "2026-06-22");
    assert.equal(upsertBody.actionKey, null);
    assert.equal(upsertBody.source, "desktop-local");
    assert.equal(deleteBody.operation, "delete-skip");
    assert.equal(deleteBody.skipDate, "2026-06-22");
    assert.doesNotMatch(serialized, /token=abc|link=|magic=secret|magic=/);
    assert.equal(status.skipSync.uploadCount, 1);
    assert.equal(status.skipSync.deleteCount, 1);
    assert.equal(status.skipSync.failureCount, 0);
  } finally {
    temp.cleanup();
  }
});

test("skip sync errors are sanitized and non-fatal", async () => {
  const temp = createTempConfigStore();

  try {
    const config = temp.store.load();
    config.paritySync.enabled = true;
    config.paritySync.supabaseUrl = "https://example.supabase.co";
    config.paritySync.publishableKey = "anon-publishable-key";
    config.paritySync.skipSyncEnabled = true;
    const logger = createLogger();
    const service = new ParitySyncService(config, logger, { supabaseUrl: "", publishableKey: "" }, {
      buildDeviceStatusPayload: () => createStatusPayload(),
      fetchFn: async () => ({ ok: false, status: 403, json: async () => ({ success: false }) })
    });

    await service.syncSkipDates();
    const status = service.getStatus();

    assert.equal(status.skipSync.syncCount, 0);
    assert.equal(status.skipSync.failureCount, 1);
    assert.match(status.skipSync.lastError, /HTTP 403/);
    assert.doesNotMatch(status.skipSync.lastError, /Bearer|apikey|token=/i);
  } finally {
    temp.cleanup();
  }
});

test("schedule/completion sync disabled does not call fetch", async () => {
  const temp = createTempConfigStore();

  try {
    const config = temp.store.load();
    config.paritySync.enabled = true;
    config.paritySync.supabaseUrl = "https://example.supabase.co";
    config.paritySync.publishableKey = "anon-publishable-key";
    config.paritySync.scheduleCompletionSyncEnabled = false;
    const logger = createLogger();
    let fetchCalls = 0;
    const service = new ParitySyncService(config, logger, { supabaseUrl: "", publishableKey: "" }, {
      buildDeviceStatusPayload: () => createStatusPayload(),
      fetchFn: async () => {
        fetchCalls += 1;
        return { ok: true, status: 200, json: async () => ({ success: true }) };
      }
    });

    await service.syncScheduleCompletions("test", "2026-06-19");
    const status = service.getStatus();

    assert.equal(status.scheduleCompletionSync.enabled, false);
    assert.equal(status.scheduleCompletionSync.syncCount, 0);
    assert.equal(fetchCalls, 0);
  } finally {
    temp.cleanup();
  }
});

test("schedule/completion sync missing config does not call fetch", async () => {
  const temp = createTempConfigStore();

  try {
    const config = temp.store.load();
    config.paritySync.enabled = true;
    config.paritySync.scheduleCompletionSyncEnabled = true;
    const logger = createLogger();
    let fetchCalls = 0;
    const service = new ParitySyncService(config, logger, { supabaseUrl: "", publishableKey: "" }, {
      buildDeviceStatusPayload: () => createStatusPayload(),
      fetchFn: async () => {
        fetchCalls += 1;
        return { ok: true, status: 200, json: async () => ({ success: true }) };
      }
    });

    await service.syncScheduleCompletions("test", "2026-06-19");
    const status = service.getStatus();

    assert.equal(status.configured, false);
    assert.equal(status.scheduleCompletionSync.syncCount, 0);
    assert.equal(fetchCalls, 0);
  } finally {
    temp.cleanup();
  }
});

test("schedule/completion sync uploads sanitized local rows without configured-site action", async () => {
  const temp = createTempConfigStore();

  try {
    const config = temp.store.load();
    config.paritySync.enabled = true;
    config.paritySync.supabaseUrl = "https://example.supabase.co";
    config.paritySync.publishableKey = "anon-publishable-key";
    config.paritySync.scheduleCompletionSyncEnabled = true;
    config.scheduler.schedulesByDate["2026-06-19"] = {
      date: "2026-06-19",
      clockInTime: "07:45",
      clockOutTime: "17:05",
      generatedAt: "2026-06-19T00:00:00.000Z"
    };
    config.attendance.completionsByDate["2026-06-19"] = [{
      dateKey: "2026-06-19",
      action: "clock-out",
      confirmationId: "confirmation-123",
      mappedTargetId: "a51",
      completedAt: "2026-06-19T09:00:00.000Z",
      generatedScheduleTime: "17:05",
      sanitizedUrlAfterClick: "https://perakam.example/[redacted]",
      state: "verification-pending",
      verification: {
        action: "clock-out",
        dateKey: "2026-06-19",
        localClickResult: "click-succeeded-local",
        status: "verification-unknown",
        reason: "Checked https://secret.example/path?token=abc link=opaque magic=secret",
        sanitizedUrlAfterClick: null,
        evidenceSnippets: [],
        checkedAt: "2026-06-19T09:01:00.000Z"
      },
      manuallyVerifiedAt: null
    }];
    const logger = createLogger();
    const requests = [];
    const service = new ParitySyncService(config, logger, { supabaseUrl: "", publishableKey: "" }, {
      buildDeviceStatusPayload: () => createStatusPayload(),
      fetchFn: async (url, init) => {
        requests.push({ url, init });
        return { ok: true, status: 202, json: async () => ({ success: true, schedules: [], completions: [] }) };
      }
    });

    await service.syncScheduleCompletions("test", "2026-06-19");
    const status = service.getStatus();
    const bodies = requests.map((request) => JSON.parse(request.init.body));
    const serialized = JSON.stringify(bodies);

    assert.equal(requests.every((request) => request.url === "https://example.supabase.co/functions/v1/alilos-schedule-completion-sync"), true);
    assert.deepEqual(bodies.map((body) => body.operation), ["get-day-state", "upsert-schedule", "upsert-schedule", "upsert-completion"]);
    assert.equal(bodies[1].schedule.targetTimeLocal, "07:45");
    assert.equal(bodies[2].schedule.targetTimeLocal, "17:05");
    assert.equal(bodies[3].completion.state, "verification-pending");
    assert.equal(status.scheduleCompletionSync.scheduleUploadCount, 2);
    assert.equal(status.scheduleCompletionSync.completionUploadCount, 1);
    assert.equal(status.scheduleCompletionSync.syncCount, 1);
    assert.equal(status.scheduleCompletionSync.failureCount, 0);
    assert.doesNotMatch(serialized, /token=abc|link=opaque|magic=secret|magic=|link=/);
    assert.match(logger.entries.at(-1).message, /No configured-site action was attempted/);
  } finally {
    temp.cleanup();
  }
});

test("schedule/completion sync warns on remote-only completion and preserves local state", async () => {
  const temp = createTempConfigStore();

  try {
    const config = temp.store.load();
    config.paritySync.enabled = true;
    config.paritySync.supabaseUrl = "https://example.supabase.co";
    config.paritySync.publishableKey = "anon-publishable-key";
    config.paritySync.scheduleCompletionSyncEnabled = true;
    config.attendance.completionsByDate["2026-06-19"] = [];
    const logger = createLogger();
    const service = new ParitySyncService(config, logger, { supabaseUrl: "", publishableKey: "" }, {
      buildDeviceStatusPayload: () => createStatusPayload(),
      fetchFn: async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          schedules: [],
          completions: [{
            deviceId: config.paritySync.deviceId,
            actionDate: "2026-06-19",
            actionKey: "clock-in",
            dedupeKey: "remote-marker",
            state: "verified-success",
            verificationState: "verified-success",
            sanitizedReason: "remote marker",
            attemptedAt: "2026-06-19T00:00:00.000Z",
            verifiedAt: "2026-06-19T00:01:00.000Z"
          }]
        })
      })
    });

    await service.syncScheduleCompletions("test", "2026-06-19");
    const status = service.getStatus();

    assert.deepEqual(config.attendance.completionsByDate["2026-06-19"], []);
    assert.equal(status.scheduleCompletionSync.fetchedCompletionRows, 1);
    assert.equal(status.scheduleCompletionSync.warningCount, 1);
    assert.match(status.scheduleCompletionSync.lastWarning, /Remote completion marker exists/);
  } finally {
    temp.cleanup();
  }
});

test("schedule/completion sync errors are sanitized and non-fatal", async () => {
  const temp = createTempConfigStore();

  try {
    const config = temp.store.load();
    config.paritySync.enabled = true;
    config.paritySync.supabaseUrl = "https://example.supabase.co";
    config.paritySync.publishableKey = "anon-publishable-key";
    config.paritySync.scheduleCompletionSyncEnabled = true;
    const logger = createLogger();
    const service = new ParitySyncService(config, logger, { supabaseUrl: "", publishableKey: "" }, {
      buildDeviceStatusPayload: () => createStatusPayload(),
      fetchFn: async () => ({ ok: false, status: 403, json: async () => ({ success: false }) })
    });

    await service.syncScheduleCompletions("test", "2026-06-19");
    const status = service.getStatus();

    assert.equal(status.scheduleCompletionSync.syncCount, 0);
    assert.equal(status.scheduleCompletionSync.failureCount, 1);
    assert.match(status.scheduleCompletionSync.lastError, /HTTP 403/);
    assert.doesNotMatch(status.scheduleCompletionSync.lastError, /Bearer|apikey|token=/i);
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

function commandPayload(config, overrides = {}) {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    deviceId: config.paritySync.deviceId,
    commandType: "recalculate-today-schedule",
    actionKey: null,
    scheduleDate: null,
    payload: {},
    status: "pending",
    requestedAt: "2026-06-19T00:00:00.000Z",
    expiresAt: "2999-01-01T00:00:00.000Z",
    ...overrides
  };
}

test("command sync disabled does not poll", async () => {
  const temp = createTempConfigStore();

  try {
    const config = temp.store.load();
    config.paritySync.enabled = true;
    config.paritySync.supabaseUrl = "https://example.supabase.co";
    config.paritySync.publishableKey = "anon-publishable-key";
    config.paritySync.commandSyncEnabled = false;
    const logger = createLogger();
    let fetchCalls = 0;
    const service = new ParitySyncService(config, logger, { supabaseUrl: "", publishableKey: "" }, {
      buildDeviceStatusPayload: () => createStatusPayload(),
      fetchFn: async () => {
        fetchCalls += 1;
        return { ok: true, status: 200, json: async () => ({ success: true, commands: [] }) };
      }
    });

    await service.pollCommands();
    const status = service.getStatus();

    assert.equal(status.commandSync.enabled, false);
    assert.equal(status.commandSync.receivedCount, 0);
    assert.equal(fetchCalls, 0);
  } finally {
    temp.cleanup();
  }
});

test("command sync invalid config does not poll", async () => {
  const temp = createTempConfigStore();

  try {
    const config = temp.store.load();
    config.paritySync.enabled = true;
    config.paritySync.commandSyncEnabled = true;
    const logger = createLogger();
    let fetchCalls = 0;
    const service = new ParitySyncService(config, logger, { supabaseUrl: "", publishableKey: "" }, {
      buildDeviceStatusPayload: () => createStatusPayload(),
      fetchFn: async () => {
        fetchCalls += 1;
        return { ok: true, status: 200, json: async () => ({ success: true, commands: [] }) };
      }
    });

    await service.pollCommands();
    const status = service.getStatus();

    assert.equal(status.configured, false);
    assert.equal(status.commandSync.receivedCount, 0);
    assert.equal(fetchCalls, 0);
  } finally {
    temp.cleanup();
  }
});

test("command sync service-role-looking key prevents polling", async () => {
  const temp = createTempConfigStore();

  try {
    const config = temp.store.load();
    config.paritySync.enabled = true;
    config.paritySync.commandSyncEnabled = true;
    config.paritySync.supabaseUrl = "https://example.supabase.co";
    config.paritySync.publishableKey = serviceRoleJwt();
    const logger = createLogger();
    let fetchCalls = 0;
    const service = new ParitySyncService(config, logger, { supabaseUrl: "", publishableKey: "" }, {
      buildDeviceStatusPayload: () => createStatusPayload(),
      fetchFn: async () => {
        fetchCalls += 1;
        return { ok: true, status: 200, json: async () => ({ success: true, commands: [] }) };
      }
    });

    await service.pollCommands();
    const status = service.getStatus();

    assert.equal(status.configured, false);
    assert.equal(status.keyStatus, "missing");
    assert.equal(fetchCalls, 0);
  } finally {
    temp.cleanup();
  }
});

test("command sync list claim complete flow uses proxy and safe recalculate callback", async () => {
  const temp = createTempConfigStore();

  try {
    const config = temp.store.load();
    config.paritySync.enabled = true;
    config.paritySync.commandSyncEnabled = true;
    config.paritySync.supabaseUrl = "https://example.supabase.co";
    config.paritySync.publishableKey = "anon-publishable-key";
    const logger = createLogger();
    const requests = [];
    let recalculated = false;
    const service = new ParitySyncService(config, logger, { supabaseUrl: "", publishableKey: "" }, {
      buildDeviceStatusPayload: () => createStatusPayload(),
      recalculateTodaySchedule: () => {
        recalculated = true;
        return { summary: "Today schedule recalculated.", details: { scheduleDate: "2026-06-19" } };
      },
      fetchFn: async (url, init) => {
        const body = JSON.parse(init.body);
        requests.push({ url, body });
        if (body.operation === "list-pending") {
          return { ok: true, status: 200, json: async () => ({ success: true, commands: [commandPayload(config)] }) };
        }
        if (body.operation === "claim-command") {
          return { ok: true, status: 200, json: async () => ({ success: true, command: commandPayload(config, { status: "claimed" }) }) };
        }
        return { ok: true, status: 202, json: async () => ({ success: true }) };
      }
    });

    await service.pollCommands("test");
    const status = service.getStatus();

    assert.equal(recalculated, true);
    assert.equal(requests.every((request) => request.url === "https://example.supabase.co/functions/v1/alilos-command-sync"), true);
    assert.deepEqual(requests.map((request) => request.body.operation), ["list-pending", "claim-command", "append-command-event", "complete-command"]);
    assert.equal(requests.at(-1).body.status, "succeeded");
    assert.equal(status.commandSync.receivedCount, 1);
    assert.equal(status.commandSync.claimedCount, 1);
    assert.equal(status.commandSync.completedCount, 1);
    assert.equal(status.commandSync.rejectedCount, 0);
    assert.match(logger.entries.at(-1).message, /No configured-site action was attempted/);
  } finally {
    temp.cleanup();
  }
});

test("command sync rejects unsupported perform-configured-action", async () => {
  const temp = createTempConfigStore();

  try {
    const config = temp.store.load();
    config.paritySync.enabled = true;
    config.paritySync.commandSyncEnabled = true;
    config.paritySync.supabaseUrl = "https://example.supabase.co";
    config.paritySync.publishableKey = "anon-publishable-key";
    const logger = createLogger();
    const requests = [];
    const service = new ParitySyncService(config, logger, { supabaseUrl: "", publishableKey: "" }, {
      buildDeviceStatusPayload: () => createStatusPayload(),
      fetchFn: async (_url, init) => {
        const body = JSON.parse(init.body);
        requests.push(body);
        if (body.operation === "list-pending") {
          return { ok: true, status: 200, json: async () => ({ success: true, commands: [commandPayload(config, { commandType: "perform-configured-action" })] }) };
        }
        if (body.operation === "claim-command") {
          return { ok: true, status: 200, json: async () => ({ success: true, command: commandPayload(config, { commandType: "perform-configured-action", status: "claimed" }) }) };
        }
        return { ok: true, status: 202, json: async () => ({ success: true }) };
      }
    });

    await service.pollCommands("test");
    const status = service.getStatus();
    const complete = requests.find((body) => body.operation === "complete-command");

    assert.equal(complete.status, "rejected");
    assert.match(complete.summary, /deferred/);
    assert.equal(complete.details.noConfiguredSiteAction, true);
    assert.equal(status.commandSync.rejectedCount, 1);
  } finally {
    temp.cleanup();
  }
});

test("command sync request-dry-run rejects missing local confirmation id", async () => {
  const temp = createTempConfigStore();

  try {
    const config = temp.store.load();
    config.paritySync.enabled = true;
    config.paritySync.commandSyncEnabled = true;
    config.paritySync.supabaseUrl = "https://example.supabase.co";
    config.paritySync.publishableKey = "anon-publishable-key";
    const logger = createLogger();
    const requests = [];
    const service = new ParitySyncService(config, logger, { supabaseUrl: "", publishableKey: "" }, {
      buildDeviceStatusPayload: () => createStatusPayload(),
      runAttendanceDryRun: async () => ({ status: "passed", summary: "dry-run passed" }),
      fetchFn: async (_url, init) => {
        const body = JSON.parse(init.body);
        requests.push(body);
        if (body.operation === "list-pending") {
          return { ok: true, status: 200, json: async () => ({ success: true, commands: [commandPayload(config, { commandType: "request-dry-run" })] }) };
        }
        if (body.operation === "claim-command") {
          return { ok: true, status: 200, json: async () => ({ success: true, command: commandPayload(config, { commandType: "request-dry-run", status: "claimed" }) }) };
        }
        return { ok: true, status: 202, json: async () => ({ success: true }) };
      }
    });

    await service.pollCommands("test");
    const complete = requests.find((body) => body.operation === "complete-command");
    const status = service.getStatus();

    assert.equal(complete.status, "rejected");
    assert.match(complete.summary, /requires an existing local confirmation id/);
    assert.equal(status.commandSync.rejectedCount, 1);
  } finally {
    temp.cleanup();
  }
});

test("command sync marks expired command without executing callback", async () => {
  const temp = createTempConfigStore();

  try {
    const config = temp.store.load();
    config.paritySync.enabled = true;
    config.paritySync.commandSyncEnabled = true;
    config.paritySync.supabaseUrl = "https://example.supabase.co";
    config.paritySync.publishableKey = "anon-publishable-key";
    const logger = createLogger();
    let recalculated = false;
    const requests = [];
    const service = new ParitySyncService(config, logger, { supabaseUrl: "", publishableKey: "" }, {
      buildDeviceStatusPayload: () => createStatusPayload(),
      recalculateTodaySchedule: () => {
        recalculated = true;
        return { summary: "should not run" };
      },
      fetchFn: async (_url, init) => {
        const body = JSON.parse(init.body);
        requests.push(body);
        if (body.operation === "list-pending") {
          return { ok: true, status: 200, json: async () => ({ success: true, commands: [commandPayload(config, { expiresAt: "2000-01-01T00:00:00.000Z" })] }) };
        }
        return { ok: true, status: 202, json: async () => ({ success: true }) };
      }
    });

    await service.pollCommands("test");
    const complete = requests.find((body) => body.operation === "complete-command");
    const status = service.getStatus();

    assert.equal(recalculated, false);
    assert.equal(complete.status, "expired");
    assert.equal(status.commandSync.expiredCount, 1);
    assert.equal(status.commandSync.claimedCount, 0);
  } finally {
    temp.cleanup();
  }
});

test("command sync rejects forbidden payload data before processing", async () => {
  const temp = createTempConfigStore();

  try {
    const config = temp.store.load();
    config.paritySync.enabled = true;
    config.paritySync.commandSyncEnabled = true;
    config.paritySync.supabaseUrl = "https://example.supabase.co";
    config.paritySync.publishableKey = "anon-publishable-key";
    const logger = createLogger();
    const requests = [];
    const service = new ParitySyncService(config, logger, { supabaseUrl: "", publishableKey: "" }, {
      buildDeviceStatusPayload: () => createStatusPayload(),
      fetchFn: async (_url, init) => {
        const body = JSON.parse(init.body);
        requests.push(body);
        if (body.operation === "list-pending") {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              commands: [commandPayload(config, { payload: { selector: "#submit", note: "https://secret.example/path?token=abc link=opaque" } })]
            })
          };
        }
        return { ok: true, status: 202, json: async () => ({ success: true }) };
      }
    });

    await service.pollCommands("test");
    const serialized = JSON.stringify(requests);
    const complete = requests.find((body) => body.operation === "complete-command");
    const status = service.getStatus();

    assert.equal(complete.status, "rejected");
    assert.equal(complete.details.reason, "forbidden-content");
    assert.doesNotMatch(serialized, /#submit|token=abc|link=opaque|link=/);
    assert.equal(status.commandSync.rejectedCount, 1);
  } finally {
    temp.cleanup();
  }
});

test("command sync errors are sanitized and non-fatal", async () => {
  const temp = createTempConfigStore();

  try {
    const config = temp.store.load();
    config.paritySync.enabled = true;
    config.paritySync.commandSyncEnabled = true;
    config.paritySync.supabaseUrl = "https://example.supabase.co";
    config.paritySync.publishableKey = "anon-publishable-key";
    const logger = createLogger();
    const service = new ParitySyncService(config, logger, { supabaseUrl: "", publishableKey: "" }, {
      buildDeviceStatusPayload: () => createStatusPayload(),
      fetchFn: async () => ({ ok: false, status: 403, json: async () => ({ success: false }) })
    });

    await service.pollCommands("test");
    const status = service.getStatus();

    assert.equal(status.commandSync.receivedCount, 0);
    assert.equal(status.commandSync.failedCount, 1);
    assert.match(status.commandSync.lastError, /HTTP 403/);
    assert.doesNotMatch(status.commandSync.lastError, /Bearer|apikey|token=/i);
  } finally {
    temp.cleanup();
  }
});
