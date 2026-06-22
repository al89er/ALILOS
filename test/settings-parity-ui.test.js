const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = process.cwd();

function readRepoFile(...segments) {
  return fs.readFileSync(path.join(root, ...segments), "utf8");
}

test("settings UI exposes parity sync controls with safety wording", () => {
  const html = readRepoFile("src", "renderer", "index.html");

  [
    "settings-parity-enabled",
    "settings-parity-url",
    "settings-parity-key",
    "settings-parity-device-id",
    "settings-parity-device-label",
    "settings-parity-heartbeat-interval",
    "settings-parity-command-interval",
    "settings-parity-log-upload",
    "settings-parity-skip-sync",
    "settings-parity-schedule-completion-sync",
    "settings-parity-command-sync",
    "settings-parity-remote-action",
    "settings-parity-summary"
  ].forEach((id) => assert.match(html, new RegExp(`id="${id}"`)));

  assert.match(html, /Parity Sync \/ Webapp Supabase Sync/);
  assert.match(html, /Use publishable\/anon key only\. Never enter service-role key\./);
  assert.match(html, /Keep remote action off during DEPLOY1/);
  assert.match(html, /legacy status-only sender/);
  assert.doesNotMatch(html, /service[_-]?role key value|SUPABASE_SERVICE_ROLE_KEY|sb_secret_/i);
});

test("desktop schedule UI exposes arbitrary skip date manager", () => {
  const html = readRepoFile("src", "renderer", "index.html");
  const renderer = readRepoFile("src", "renderer", "renderer.ts");
  const preload = readRepoFile("src", "preload", "preload.ts");
  const main = readRepoFile("src", "main", "main.ts");

  assert.match(html, /id="skip-date-input"/);
  assert.match(html, /id="add-skip-date"/);
  assert.match(html, /Add whole-day skip/);
  assert.match(renderer, /skippedDateDetails/);
  assert.match(renderer, /Remove skip/);
  assert.match(renderer, /window\.alilos\.unskipDate\(skip\.date\)/);
  assert.match(renderer, /window\.alilos\.skipDate\(dateKey\)/);
  assert.match(preload, /schedule:skip-date/);
  assert.match(preload, /schedule:unskip-date/);
  assert.match(main, /schedule:skip-date/);
  assert.match(main, /schedule:unskip-date/);
});

test("desktop parity UI exposes safe sync now control", () => {
  const html = readRepoFile("src", "renderer", "index.html");
  const renderer = readRepoFile("src", "renderer", "renderer.ts");
  const preload = readRepoFile("src", "preload", "preload.ts");
  const main = readRepoFile("src", "main", "main.ts");
  const service = readRepoFile("src", "worker", "parity-sync-service.ts");

  assert.match(html, /id="parity-sync-now"/);
  assert.match(html, />Sync now</);
  assert.match(renderer, /window\.alilos\.syncParityNow\(\)/);
  assert.match(renderer, /manualSyncInProgress/);
  assert.match(renderer, /lastManualSyncResult/);
  assert.match(preload, /parity:sync-now/);
  assert.match(main, /parity:sync-now/);
  assert.match(service, /async syncNow\(\)/);
  assert.match(service, /remoteActionEnabled/);
});

test("renderer loads and saves parity settings without exposing key values", () => {
  const renderer = readRepoFile("src", "renderer", "renderer.ts");

  assert.match(renderer, /settingsParityEnabled\.checked = settings\.paritySync\.enabled/);
  assert.match(renderer, /settingsParityUrl\.value = settings\.paritySync\.supabaseUrl/);
  assert.match(renderer, /settingsParityKey\.value = ""/);
  assert.match(renderer, /publishableKey = parityKey/);
  assert.match(renderer, /looksLikeServiceRoleKeyText/);
  assert.match(renderer, /Parity sync publishable key must be a publishable\/anon key/);
  assert.match(renderer, /settingsParitySummary\.textContent/);
  assert.doesNotMatch(renderer, /settingsParitySummary\.textContent[\s\S]{0,400}publishableKey/);
});

test("settings IPC persists parity sync settings and reconfigures service", () => {
  const main = readRepoFile("src", "main", "main.ts");

  assert.match(main, /config\.paritySync = \{/);
  assert.match(main, /publishableKey: typeof next\.paritySync\.publishableKey/);
  assert.match(main, /paritySyncService\.configure\(\)/);
  assert.match(main, /looksLikeSupabaseServiceRoleKey\(publishableKey\)/);
  assert.match(main, /Parity sync publishable key must be a publishable\/anon key/);
  assert.doesNotMatch(main, /logger\.info\([^)]*publishableKey/);
});

test("app settings snapshots omit parity sync key values", () => {
  const types = readRepoFile("src", "shared", "types.ts");
  const snapshotStart = types.indexOf("export interface AppSettingsSnapshot");
  const inputStart = types.indexOf("export interface AppSettingsInput");
  const snapshotBlock = types.slice(snapshotStart, inputStart);

  assert.match(snapshotBlock, /paritySync: \{/);
  assert.match(snapshotBlock, /keyStatus: TelegramSecretStatus/);
  assert.doesNotMatch(snapshotBlock, /publishableKey/);
  assert.match(types.slice(inputStart), /publishableKey\?: string/);
});
