const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const functionPath = path.join(process.cwd(), "supabase", "functions", "alilos-skip-sync", "index.ts");

function readFunctionSource() {
  return fs.readFileSync(functionPath, "utf8");
}

test("skip sync Edge Function exposes constrained skip operations only", () => {
  const source = readFunctionSource();

  assert.match(source, /Deno\.serve/);
  assert.match(source, /request\.method !== "POST"/);
  assert.match(source, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(source, /service-role-client-key-rejected/);
  assert.match(source, /"list-skips"/);
  assert.match(source, /"upsert-skip"/);
  assert.match(source, /"delete-skip"/);
  assert.match(source, /\.from\("devices"\)/);
  assert.match(source, /\.from\("skip_dates"\)/);
  assert.match(source, /device-not-registered/);
  assert.doesNotMatch(source, /grant\s+.*\s+to\s+(anon|authenticated)/i);
});

test("skip sync Edge Function rejects arbitrary payload and sensitive markers", () => {
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
    "link",
    "payload"
  ]) {
    assert.match(source.toLowerCase(), new RegExp(`"${forbidden}"`));
  }

  assert.ok(source.includes("https?:\\/\\/[^\\s?#]+[^\\s]*[?#][^\\s]*"));
  assert.ok(source.includes("\\blink="));
  assert.ok(source.includes("\\bmagic="));
  assert.ok(source.includes("\\b4Tredir="));
  assert.ok(source.includes("\\bBearer\\s+"));
  assert.ok(source.includes("bot\\d+:"));
});
