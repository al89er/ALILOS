const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

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
  assert.match(app, /VITE_SUPABASE_URL/);
  assert.match(app, /VITE_SUPABASE_ANON_KEY/);
  assert.match(app, /VITE_ALILOS_DEVICE_ID/);
  assert.match(config, /PUBLISHABLE_OR_ANON_KEY/);
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

  assert.match(html, /These controls only request non-clicking desktop checks/);
  assert.match(html, /Remote configured-action command is not implemented yet/);
  assert.match(app, /renderActionCards/);
  assert.doesNotMatch(html, /perform-configured-action/i);
  assert.doesNotMatch(html, /password|raw JSON|selector|<form/i);
  assert.match(manifest, /"display": "standalone"/);
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
  assert.doesNotMatch(app, /perform-configured-action|request-confirmation|service[_-]?role|sb_secret_/i);
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
  assert.match(app, /VITE_SUPABASE_URL/);
  assert.match(app, /VITE_SUPABASE_ANON_KEY/);
  assert.match(app, /Authorization: `Bearer \$\{config\.VITE_SUPABASE_ANON_KEY\}`/);
  assert.match(app, /noConfiguredSiteAction: true/);
  assert.doesNotMatch(app, /perform-configured-action|request-confirmation|eval\(|service[_-]?role|sb_secret_/i);
});
