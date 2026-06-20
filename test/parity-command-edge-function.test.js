const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const functionPath = path.join(process.cwd(), "supabase", "functions", "alilos-command-sync", "index.ts");

function readFunctionSource() {
  return fs.readFileSync(functionPath, "utf8");
}

test("command sync Edge Function exposes constrained command operations only", () => {
  const source = readFunctionSource();

  assert.match(source, /Deno\.serve/);
  assert.match(source, /request\.method !== "POST"/);
  assert.match(source, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(source, /service-role-client-key-rejected/);
  assert.match(source, /"list-pending"/);
  assert.match(source, /"create-command"/);
  assert.match(source, /"claim-command"/);
  assert.match(source, /"complete-command"/);
  assert.match(source, /"append-command-event"/);
  assert.match(source, /\.from\("devices"\)/);
  assert.match(source, /\.from\("command_requests"\)/);
  assert.match(source, /\.from\("command_events"\)/);
  assert.match(source, /device-not-registered/);
  assert.match(source, /PARITY7_ALLOWED_COMMAND_TYPES/);
  assert.match(source, /CREATE_COMMAND_TYPES/);
  assert.doesNotMatch(source, /grant\s+.*\s+to\s+(anon|authenticated)/i);
});

test("command sync Edge Function create-command allows safe commands and guarded configured-action requests", () => {
  const source = readFunctionSource();
  const createSet = source.match(/const CREATE_COMMAND_TYPES = new Set\(\[([\s\S]*?)\]\);/)[1];

  assert.match(createSet, /"request-status-refresh"/);
  assert.match(createSet, /"request-dry-run"/);
  assert.match(createSet, /"recalculate-today-schedule"/);
  assert.match(createSet, /"cancel-confirmation"/);
  assert.match(createSet, /"perform-configured-action"/);
  assert.doesNotMatch(createSet, /"request-confirmation"/);
  assert.match(source, /missing-configured-action-preflight-fields/);
  assert.match(source, /invalid-configured-action-preflight-payload/);
  assert.match(source, /guardedRemoteAction: true/);
  assert.match(source, /desktopGuardRequired: true/);
  assert.match(source, /webappDoesNotClick: true/);
  assert.match(source, /credentialsStayLocal: true/);
  assert.match(source, /status: "pending"/);
  assert.match(source, /requested_by: "webapp-guarded-action"/);
  assert.match(source, /\.insert\(\{/);
  assert.match(source, /requested_by: "webapp"/);
  assert.match(source, /expiresAt = new Date\(Date\.now\(\) \+ 10 \* 60 \* 1000\)/);
  assert.match(source, /unsupported-command-type/);
});

test("command sync Edge Function rejects sensitive markers and arbitrary web command data", () => {
  const source = readFunctionSource();

  for (const forbidden of [
    "credentials",
    "password",
    "cookies",
    "rawhtml",
    "screenshot",
    "fullurl",
    "token",
    "selector",
    "script",
    "form",
    "magic",
    "4tredir",
    "link"
  ]) {
    assert.match(source.toLowerCase(), new RegExp(`"${forbidden}"`));
  }

  assert.ok(source.includes("https?:\\/\\/[^\\s?#]+[^\\s]*[?#][^\\s]*"));
  assert.ok(source.includes("\\blink="));
  assert.ok(source.includes("\\bmagic="));
  assert.ok(source.includes("\\b4Tredir="));
  assert.ok(source.includes("\\bBearer\\s+"));
  assert.ok(source.includes("bot\\d+:"));
  assert.doesNotMatch(source, /performConfiguredAction|clickVisibleAttendanceControl|querySelector|eval\(/);
});
