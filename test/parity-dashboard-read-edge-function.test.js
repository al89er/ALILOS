const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const functionPath = path.join(process.cwd(), "supabase", "functions", "alilos-dashboard-read", "index.ts");

function readFunctionSource() {
  return fs.readFileSync(functionPath, "utf8");
}

test("dashboard read Edge Function keeps read access behind server-side proxy", () => {
  const source = readFunctionSource();

  assert.match(source, /Deno\.serve/);
  assert.match(source, /request\.method !== "POST"/);
  assert.match(source, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(source, /service-role-client-key-rejected/);
  assert.match(source, /\.from\("devices"\)/);
  assert.match(source, /\.from\("heartbeats"\)/);
  assert.match(source, /\.from\("daily_schedules"\)/);
  assert.match(source, /\.from\("skip_dates"\)/);
  assert.match(source, /\.from\("completion_records"\)/);
  assert.match(source, /\.from\("command_requests"\)/);
  assert.doesNotMatch(source, /grant\s+.*\s+to\s+(anon|authenticated)/i);
  assert.doesNotMatch(source, /\.insert\(|\.upsert\(|\.delete\(/);
});

test("dashboard read Edge Function rejects sensitive fields and returns sanitized display data", () => {
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
  assert.match(source, /readOnly: true/);
  assert.match(source, /webAutomation: false/);
  assert.match(source, /remoteConfiguredActionImplemented: false/);
});
