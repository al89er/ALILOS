const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const webappDir = path.join(process.cwd(), "webapp");

function readWebappFile(name) {
  return fs.readFileSync(path.join(webappDir, name), "utf8");
}

test("webapp is read-only and uses placeholder client config only", () => {
  const html = readWebappFile("index.html");
  const app = readWebappFile("app.js");
  const config = readWebappFile("config.example.js");

  assert.match(html, /Read-only desktop monitor/);
  assert.match(app, /alilos-dashboard-read/);
  assert.match(app, /VITE_SUPABASE_URL/);
  assert.match(app, /VITE_SUPABASE_ANON_KEY/);
  assert.match(app, /VITE_ALILOS_DEVICE_ID/);
  assert.match(config, /PUBLISHABLE_OR_ANON_KEY/);
  assert.doesNotMatch(`${html}\n${app}\n${config}`, /service[_-]?role|sb_secret_|password|cookie|raw_html|screenshot|link=/i);
});

test("webapp implements required dashboard sections without command creation controls", () => {
  const html = readWebappFile("index.html");
  const app = readWebappFile("app.js");
  const manifest = readWebappFile("manifest.webmanifest");

  for (const label of [
    "Device Status",
    "Schedule Summary",
    "Skip State",
    "Completion State",
    "Command Sync",
    "Safety Notices"
  ]) {
    assert.match(html, new RegExp(label));
  }

  assert.match(html, /No web automation, credentials, or command buttons/);
  assert.match(app, /Command buttons are not available in PARITY8/);
  assert.doesNotMatch(html, /<button/i);
  assert.match(manifest, /"display": "standalone"/);
});
