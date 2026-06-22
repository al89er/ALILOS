const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const functionNames = [
  "alilos-dashboard-read",
  "alilos-command-sync",
  "alilos-skip-sync",
  "alilos-schedule-completion-sync",
  "alilos-parity-status"
];

function readFunction(name) {
  return fs.readFileSync(path.join(process.cwd(), "supabase", "functions", name, "index.ts"), "utf8");
}

test("shared CORS headers allow browser webapp requests", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "supabase", "functions", "_shared", "cors.ts"), "utf8");

  assert.match(source, /Access-Control-Allow-Origin": "\*"/);
  assert.match(source, /authorization, x-client-info, apikey, content-type/);
  assert.match(source, /GET, POST, OPTIONS/);
  assert.match(source, /status: 204/);
});

for (const functionName of functionNames) {
  test(`${functionName} handles OPTIONS and returns CORS headers on JSON responses`, () => {
    const source = readFunction(functionName);

    assert.match(source, /import \{ corsHeaders, corsPreflightResponse \} from "\.\.\/_shared\/cors\.ts"/);
    assert.match(source, /request\.method === "OPTIONS"/);
    assert.match(source, /return corsPreflightResponse\(\)/);
    assert.match(source, /request\.method !== "POST"/);
    assert.match(source, /method-not-allowed/);
    assert.match(source, /\.\.\.corsHeaders/);
    assert.match(source, /"Content-Type": "application\/json"/);
    assert.match(source, /missing-authorization/);
    assert.match(source, /service-role-client-key-rejected/);
  });
}

test("dashboard-read cannot return CORS-less auth or device failures", () => {
  const source = readFunction("alilos-dashboard-read");
  const jsonResponseStart = source.indexOf("function jsonResponse");
  const jsonResponseBlock = source.slice(jsonResponseStart);

  assert.match(source, /missing-authorization/);
  assert.match(source, /device-not-registered/);
  assert.match(source, /device-check-failed/);
  assert.match(jsonResponseBlock, /\.\.\.corsHeaders/);
});
