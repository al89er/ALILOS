const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const webappDir = path.join(process.cwd(), "webapp");

function readWebappFile(name) {
  return fs.readFileSync(path.join(webappDir, name), "utf8");
}

test("webapp uses safe monitor shell and placeholder client config only", () => {
  const html = readWebappFile("index.html");
  const app = readWebappFile("app.js");
  const config = readWebappFile("config.example.js");

  assert.match(html, /Safe desktop monitor/);
  assert.match(app, /alilos-dashboard-read/);
  assert.match(app, /window\.ALILOS_CONFIG/);
  assert.match(app, /window\.ALILOS_WEBAPP_CONFIG/);
  assert.match(app, /supabaseUrl/);
  assert.match(app, /supabaseAnonKey/);
  assert.match(app, /deviceId/);
  assert.match(app, /VITE_SUPABASE_URL/);
  assert.match(app, /VITE_SUPABASE_ANON_KEY/);
  assert.match(app, /VITE_ALILOS_DEVICE_ID/);
  assert.match(config, /window\.ALILOS_CONFIG/);
  assert.match(config, /<publishable-or-anon-key>/);
  assert.doesNotMatch(`${html}\n${app}\n${config}`, /service[_-]?role|sb_secret_|password|cookie|raw_html|link=/i);
});

test("webapp implements required dashboard sections and safe command controls", () => {
  const html = readWebappFile("index.html");
  const app = readWebappFile("app.js");
  const manifest = readWebappFile("manifest.webmanifest");

  for (const label of [
    "Dashboard",
    "Skip dates",
    "Log history",
    "Morning action",
    "Evening action",
    "Device Status",
    "Observed Perakam Values",
    "Schedule And Completion",
    "Command Sync",
    "Safety Notices"
  ]) {
    assert.match(html, new RegExp(label));
  }

  for (const commandType of [
    "request-status-refresh",
    "request-dry-run",
    "recalculate-today-schedule",
    "cancel-confirmation"
  ]) {
    assert.match(html, new RegExp(`data-command-type="${commandType}"`));
    assert.match(app, new RegExp(`"${commandType}"`));
  }

  assert.match(html, /Safe commands request non-clicking checks/);
  assert.match(html, /Guarded action requests require confirmation and desktop guard approval/);
  assert.match(html, /data-remote-action="clock-in"/);
  assert.match(html, /data-remote-action="clock-out"/);
  assert.match(html, /Request guarded action/);
  assert.match(html, /Credentials stay local/);
  assert.match(app, /renderActionCards/);
  assert.match(app, /renderObservedPerakam/);
  assert.match(app, /parseObservedPerakamStatus/);
  assert.match(app, /actionReadinessText/);
  assert.match(app, /Guarded request available for synced target/);
  assert.match(app, /window\.confirm/);
  assert.match(app, /"perform-configured-action"/);
  assert.match(app, /desktopGuardRequired: true/);
  assert.match(app, /webappDoesNotClick: true/);
  assert.match(app, /credentialsStayLocal: true/);
  assert.doesNotMatch(html, /data-command-type="perform/i);
  assert.doesNotMatch(html, /password|raw JSON|<form/i);
  assert.match(manifest, /"display": "standalone"/);
});

test("webapp renders observed Perakam values from sanitized heartbeat status text", async () => {
  const context = createWebappContext({
    ALILOS_CONFIG: {
      supabaseUrl: "https://live-project.supabase.co",
      supabaseAnonKey: "anon-live-key",
      deviceId: "11111111-1111-4111-8111-111111111111"
    },
    fetch: async () => ({
      ok: true,
      status: 200,
      json: async () => liveDashboardPayload({
        statusText: "worker=running; observedPerakam=page:logged-in-dashboard,date:2026-06-22,in:08:01,out:17:05,source:dashboard-tile,at:2026-06-22T09:00:00.000Z"
      })
    })
  });

  await context.loadDashboard();

  assert.equal(context.elements["observed-scheduled-in"].textContent, "07:45");
  assert.equal(context.elements["observed-scheduled-out"].textContent, "17:05");
  assert.equal(context.elements["observed-clock-in"].textContent, "08:01");
  assert.equal(context.elements["observed-clock-out"].textContent, "17:05");
  assert.equal(context.elements["observed-page-state"].textContent, "logged-in-dashboard");
  assert.equal(context.elements["observed-source"].textContent, "dashboard-tile");
});

test("webapp marks observed values missing when Perakam login is required", async () => {
  const context = createWebappContext({
    ALILOS_CONFIG: {
      supabaseUrl: "https://live-project.supabase.co",
      supabaseAnonKey: "anon-live-key",
      deviceId: "11111111-1111-4111-8111-111111111111"
    },
    fetch: async () => ({
      ok: true,
      status: 200,
      json: async () => liveDashboardPayload({
        statusText: "worker=running; observedPerakam=page:login-required,date:--,in:--,out:--,source:unknown,at:2026-06-22T09:00:00.000Z"
      })
    })
  });

  await context.loadDashboard();

  assert.equal(context.elements["observed-clock-in"].textContent, "not readable");
  assert.equal(context.elements["observed-clock-out"].textContent, "not readable");
  assert.equal(context.elements["observed-page-state"].textContent, "login-required");
  assert.match(context.elements["observed-note"].textContent, /login is required/);
});

test("webapp skip dates calendar renders month navigation and skipped-date state", () => {
  const html = readWebappFile("index.html");
  const app = readWebappFile("app.js");

  assert.match(html, /id="prev-month"/);
  assert.match(html, /id="next-month"/);
  assert.match(html, /id="calendar-grid"/);
  assert.match(html, /Whole-day skip toggles affect scheduling only/);
  assert.match(app, /renderSkipCalendar/);
  assert.match(app, /classList\.add\("skipped"\)/);
  assert.match(app, /classList\.add\("pending"\)/);
  assert.match(app, /submitSkipToggle/);
  assert.match(app, /Action-specific skip controls are future refinement/);
});

test("webapp calendar skip toggles call skip-sync with whole-day payloads", () => {
  const app = readWebappFile("app.js");

  assert.match(app, /alilos-skip-sync/);
  assert.match(app, /const operation = isSkipped \? "delete-skip" : "upsert-skip"/);
  assert.match(app, /skipDate/);
  assert.match(app, /actionKey: null/);
  assert.match(app, /source: "webapp-command"/);
  assert.match(app, /reason: "webapp calendar toggle"/);
  assert.match(app, /Scheduling only; no website action was triggered/);
  assert.doesNotMatch(app, /request-confirmation|service[_-]?role|sb_secret_/i);
});

test("webapp log history renders sanitized event rows without sensitive samples", () => {
  const html = readWebappFile("index.html");
  const app = readWebappFile("app.js");

  assert.match(html, /Log History/);
  assert.match(html, /id="log-list"/);
  assert.match(app, /renderLogs/);
  assert.match(app, /eventLogs/);
  assert.match(app, /Desktop status preview is sanitized/);
  assert.doesNotMatch(app, /https?:\/\/|tokenized|raw_html|screenshot|link=/i);
});

test("webapp command submission uses command Edge Function and anon key placeholders", () => {
  const app = readWebappFile("app.js");

  assert.match(app, /alilos-command-sync/);
  assert.match(app, /operation: "create-command"/);
  assert.match(app, /commandType/);
  assert.match(app, /new URL\("\/functions\/v1\/alilos-command-sync", config\.supabaseUrl\)/);
  assert.match(app, /Authorization: `Bearer \$\{config\.supabaseAnonKey\}`/);
  assert.match(app, /noConfiguredSiteAction: true/);
  assert.match(app, /submitRemoteConfiguredAction/);
  assert.match(app, /commandType: "perform-configured-action"/);
  assert.match(app, /Desktop must be online with remote action enabled locally/);
  assert.doesNotMatch(app, /request-confirmation|eval\(|service[_-]?role|sb_secret_|textarea|raw JSON/i);
});

test("webapp accepts deployed ALILOS_CONFIG shape as live config", () => {
  const context = createWebappContext({
    ALILOS_CONFIG: {
      supabaseUrl: "https://live-project.supabase.co",
      supabaseAnonKey: "anon-live-key",
      deviceId: "11111111-1111-4111-8111-111111111111"
    }
  });

  assert.equal(context.configStatus(context.normalizeRuntimeConfig(context.window.ALILOS_CONFIG)), "ready");
});

test("webapp detects placeholder config values", () => {
  const context = createWebappContext({
    ALILOS_CONFIG: {
      supabaseUrl: "https://<project-ref>.supabase.co",
      supabaseAnonKey: "<publishable-or-anon-key>",
      deviceId: "<device-id>"
    }
  });

  assert.equal(context.configStatus(context.normalizeRuntimeConfig(context.window.ALILOS_CONFIG)), "placeholder");
});

test("webapp mock banner appears only for mock fallback config", async () => {
  const context = createWebappContext({
    ALILOS_CONFIG: {
      supabaseUrl: "https://<project-ref>.supabase.co",
      supabaseAnonKey: "<publishable-or-anon-key>",
      deviceId: "<device-id>"
    }
  });

  await context.loadDashboard();

  assert.match(context.elements["connection-pill"].textContent, /Mock data:/);
  assert.doesNotMatch(context.elements["connection-pill"].textContent, /Live read failed/);
});

test("webapp hides mock warning after successful live dashboard response", async () => {
  const context = createWebappContext({
    ALILOS_CONFIG: {
      supabaseUrl: "https://live-project.supabase.co",
      supabaseAnonKey: "anon-live-key",
      deviceId: "11111111-1111-4111-8111-111111111111"
    },
    fetch: async () => ({
      ok: true,
      status: 200,
      json: async () => liveDashboardPayload()
    })
  });

  await context.loadDashboard();

  assert.equal(context.elements["connection-pill"].textContent, "Live read proxy");
  assert.equal(context.elements["connection-pill"].className, "pill good");
});

test("webapp live fetch failure shows live error instead of placeholder warning", async () => {
  const context = createWebappContext({
    ALILOS_CONFIG: {
      supabaseUrl: "https://live-project.supabase.co",
      supabaseAnonKey: "anon-live-key",
      deviceId: "11111111-1111-4111-8111-111111111111"
    },
    fetch: async () => ({
      ok: false,
      status: 503,
      json: async () => ({ success: false })
    })
  });

  await context.loadDashboard();

  assert.match(context.elements["connection-pill"].textContent, /Live read failed: Read proxy returned HTTP 503/);
  assert.doesNotMatch(context.elements["connection-pill"].textContent, /configure placeholder values/);
});

test("GitHub Pages workflow generates clean ALILOS_CONFIG from variables", () => {
  const workflow = fs.readFileSync(path.join(process.cwd(), ".github", "workflows", "deploy-webapp.yml"), "utf8");

  assert.match(workflow, /ALILOS_SUPABASE_URL: \$\{\{ vars\.ALILOS_SUPABASE_URL \}\}/);
  assert.match(workflow, /ALILOS_SUPABASE_ANON_KEY: \$\{\{ vars\.ALILOS_SUPABASE_ANON_KEY \}\}/);
  assert.match(workflow, /ALILOS_DEVICE_ID: \$\{\{ vars\.ALILOS_DEVICE_ID \}\}/);
  assert.match(workflow, /window\.ALILOS_CONFIG = \$\{JSON\.stringify\(config, null, 2\)\};\\n/);
  assert.doesNotMatch(workflow, /SERVICE_ROLE|sb_secret_/i);
});

function createWebappContext({ ALILOS_CONFIG, ALILOS_WEBAPP_CONFIG, fetch } = {}) {
  const app = readWebappFile("app.js");
  const elements = {};
  const document = {
    getElementById(id) {
      elements[id] ??= createElement();
      return elements[id];
    },
    querySelectorAll() {
      return [];
    },
    querySelector() {
      return null;
    },
    createElement
  };
  const context = {
    window: {
      ALILOS_CONFIG,
      ALILOS_WEBAPP_CONFIG,
      confirm: () => false
    },
    document,
    fetch: fetch ?? (async () => ({ ok: false, status: 500, json: async () => ({ success: false }) })),
    console,
    Date,
    URL,
    Set,
    Map,
    Object,
    String,
    Number,
    Boolean,
    RegExp,
    Math,
    JSON
  };

  vm.createContext(context);
  vm.runInContext(app, context);
  context.elements = elements;
  return context;
}

function createElement() {
  const children = {};
  return {
    textContent: "",
    className: "",
    dataset: {},
    hidden: false,
    disabled: false,
    type: "",
    innerHTML: "",
    classList: {
      add() {},
      toggle() {}
    },
    setAttribute() {},
    addEventListener() {},
    replaceChildren(...items) {
      this.children = items;
    },
    querySelector(selector) {
      children[selector] ??= createElement();
      return children[selector];
    }
  };
}

function liveDashboardPayload(overrides = {}) {
  const now = new Date().toISOString();
  return {
    success: true,
    dateKey: "2026-06-22",
    monthKey: "2026-06",
    device: {
      deviceId: "11111111-1111-4111-8111-111111111111",
      label: "ALILOS test device",
      lastSeenAt: now
    },
    heartbeat: {
      appStatus: "manual-confirm",
      networkStatus: "online",
      configuredSiteStatus: "dashboard",
      statusText: "desktop online",
      lastErrorText: null,
      lastSeenAt: now,
      ...overrides
    },
    schedules: [
      { actionKey: "clock-in", targetTimeLocal: "07:45", windowStartLocal: "07:45", windowEndLocal: "07:50", source: "local-generated", status: "active", updatedAt: now },
      { actionKey: "clock-out", targetTimeLocal: "17:05", windowStartLocal: "17:05", windowEndLocal: "17:10", source: "local-generated", status: "active", updatedAt: now }
    ],
    skips: [],
    completions: [],
    eventLogs: [],
    commandSync: {
      counters: { pending: 0, claimed: 0, succeeded: 0, failed: 0, expired: 0, rejected: 0, cancelled: 0 },
      latest: null
    }
  };
}
