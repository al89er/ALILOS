const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "..");
const fixtureRoot = path.join(repoRoot, "fixtures", "perakam");

function readFixture(name) {
  return fs.readFileSync(path.join(fixtureRoot, name), "utf8");
}

function countOccurrences(text, pattern) {
  const matches = text.match(pattern);
  return matches ? matches.length : 0;
}

test("dashboard fixture preserves supported workplace target structure", () => {
  const html = readFixture("dashboard.sanitized.html");

  for (const id of ["a50", "a51", "a56", "a57"]) {
    assert.match(html, new RegExp(`id="${id}"`), `${id} should be present`);
  }

  for (const marker of ["left_col", "sidebar-menu", "nav child_menu", "right_col", "top_tiles", "animated", "tile-stats", "count"]) {
    assert.match(html, new RegExp(marker), `${marker} should be present`);
  }

  for (const textHint of ["Klik Masuk", "Klik Keluar", "Masa Hadir", "Masa Keluar"]) {
    assert.match(html, new RegExp(textHint), `${textHint} should be present`);
  }

  assert.equal(countOccurrences(html, /id="a50"/g), 2, "a50 should appear once in sidebar and once in dashboard tile");
  assert.equal(countOccurrences(html, /id="a51"/g), 2, "a51 should appear once in sidebar and once in dashboard tile");
  assert.match(html, /left_col[\s\S]*id="a50"[\s\S]*Klik Masuk[\s\S]*id="a51"[\s\S]*Klik Keluar/, "sidebar duplicate target structure should be preserved");
  assert.match(html, /right_col[\s\S]*top_tiles[\s\S]*id="a50"[\s\S]*tile-stats[\s\S]*Masa Hadir[\s\S]*id="a51"[\s\S]*tile-stats[\s\S]*Masa Keluar/, "visible dashboard tile structure should be preserved");
});

test("dashboard fixture remains sanitized", () => {
  const html = readFixture("dashboard.sanitized.html");

  assert.doesNotMatch(html, /TELEGRAM_BOT_TOKEN=/, "must not include raw Telegram token env assignment");
  assert.doesNotMatch(html, /TELEGRAM_CHAT_ID=/, "must not include raw Telegram chat env assignment");
  assert.doesNotMatch(html, /https:\/\/api\.telegram\.org\/bot[0-9]+:[A-Za-z0-9_-]+/, "must not include a real Telegram bot API URL");
  assert.doesNotMatch(html, /link=(?!REDACTED_LINK)/, "link query values must be redacted");
  assert.doesNotMatch(html, /\b(?:\d{1,3}\.){3}\d{1,3}\b/, "must not include IP addresses");
});

test("login fixture preserves supported login markers", () => {
  const html = readFixture("login.sanitized.html");

  for (const marker of ["frmchklogin", "chklogin.php", "username", "password", "Log Masuk!"]) {
    assert.match(html, new RegExp(marker), `${marker} should be present`);
  }
});

test("stale-page fixture preserves supported stale-session markers", () => {
  const html = readFixture("stale-page.sanitized.html");

  for (const marker of ["No User Informations", "Sorry! We couldn't find this user's record.", "Go to login page"]) {
    assert.match(html, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${marker} should be present`);
  }
});

test("sanitized Tampermonkey reference preserves legacy constants without secrets", () => {
  const js = readFixture("tampermonkey-original.sanitized.js");

  for (const marker of [
    "a50",
    "a51",
    "a56",
    "a57",
    "07:45",
    "07:50",
    "17:05",
    "17:10",
    "REDACTED_TELEGRAM_BOT_TOKEN",
    "REDACTED_TELEGRAM_CHAT_ID"
  ]) {
    assert.match(js, new RegExp(marker), `${marker} should be present`);
  }

  assert.doesNotMatch(js, /https:\/\/api\.telegram\.org\/bot[0-9]+:[A-Za-z0-9_-]+/, "must not include a real Telegram bot API URL");
  assert.doesNotMatch(js, /botToken:\s*["'][0-9]+:[A-Za-z0-9_-]+["']/, "must not include a real Telegram token literal");
});
