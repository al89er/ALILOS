#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const identityPath = path.join(root, ".project-identity.json");
const configPath = path.join(root, "supabase", "config.toml");
const envLocalPath = path.join(root, ".env.local");

const PLACEHOLDER_RE = /^(TODO_|your-|work-or-personal|github-work-or-github-personal)/i;
const results = {
  errors: [],
  warnings: [],
};

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, ...options.env },
  });

  return {
    status: result.status,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
    ok: result.status === 0,
  };
}

function findExecutable(command) {
  const lookup = run(process.platform === "win32" ? "where" : "command", process.platform === "win32" ? [command] : ["-v", command]);
  if (lookup.ok && lookup.stdout) {
    return lookup.stdout.split(/\r?\n/)[0];
  }

  const pathEntries = String(process.env.PATH || "").split(path.delimiter);
  const names = process.platform === "win32" ? [`${command}.exe`, `${command}.cmd`, command] : [command];
  for (const entry of pathEntries) {
    for (const name of names) {
      const candidate = path.join(entry, name);
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

function print(status, message) {
  console.log(`${status}: ${message}`);
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    results.errors.push(`${path.basename(filePath)} is not valid JSON: ${error.message}`);
    return null;
  }
}

function isPlaceholder(value) {
  return typeof value !== "string" || !value.trim() || PLACEHOLDER_RE.test(value.trim()) || value.includes("TODO_");
}

function extractProjectRefFromConfig(contents) {
  const match = contents.match(/^\s*project_id\s*=\s*["']([^"']+)["']/m);
  return match ? match[1].trim() : null;
}

function readLocalLinkedProjectRef() {
  const candidates = [
    path.join(root, "supabase", ".temp", "project-ref"),
    path.join(root, "supabase", ".temp", "project_ref"),
    path.join(root, "supabase", ".temp", "profile"),
  ];

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) {
      continue;
    }

    const value = fs.readFileSync(candidate, "utf8").trim();
    if (!value) {
      continue;
    }

    if (path.basename(candidate) === "profile") {
      try {
        const parsed = JSON.parse(value);
        if (typeof parsed.project_ref === "string") return parsed.project_ref;
        if (typeof parsed.projectRef === "string") return parsed.projectRef;
      } catch {
        continue;
      }
    }

    return value;
  }

  return null;
}

function isEnvIgnored() {
  const ignored = run("git", ["check-ignore", "-q", ".env.local"]);
  return ignored.ok;
}

function isEnvTracked() {
  const tracked = run("git", ["ls-files", "--error-unmatch", ".env.local"]);
  return tracked.ok;
}

console.log("Supabase identity check");
console.log("=======================");

if (!fs.existsSync(identityPath)) {
  print("ERROR", ".project-identity.json is missing.");
  process.exit(1);
}

const identity = readJson(identityPath);
if (!identity) {
  process.exit(1);
}

const accountType = identity.supabaseAccountType;
const expectedRef = identity.supabaseProjectRef;
const expectedUrl = identity.supabaseProjectUrl;

if (!["work", "personal"].includes(accountType)) {
  results.errors.push('supabaseAccountType must be "work" or "personal".');
} else {
  print("INFO", `Expected account type: ${accountType.toUpperCase()}`);
}

if (isPlaceholder(expectedRef)) {
  results.errors.push("supabaseProjectRef must be set to the real project ref before remote Supabase commands are safe.");
} else {
  print("INFO", `Expected project ref: ${expectedRef}`);
}

if (isPlaceholder(expectedUrl)) {
  results.errors.push("supabaseProjectUrl must be set to the real project URL before env checks can pass.");
} else if (expectedRef && !expectedUrl.includes(expectedRef)) {
  results.errors.push("supabaseProjectUrl does not contain supabaseProjectRef.");
}

const supabaseBin = findExecutable("supabase");
const cli = supabaseBin ? run(supabaseBin, ["--version"], { env: { SUPABASE_TELEMETRY_DISABLED: "1" } }) : { ok: false, stdout: "" };
if (cli.ok && cli.stdout) {
  print("PASS", `Supabase CLI installed: ${cli.stdout}`);
} else if (supabaseBin) {
  print("WARNING", `Supabase CLI executable found at ${supabaseBin}, but the version probe did not complete cleanly.`);
  results.warnings.push("Supabase CLI was found, but `supabase --version` failed in this environment.");
} else {
  results.errors.push("Supabase CLI is not installed or not available on PATH.");
}

let linkedRef = readLocalLinkedProjectRef();
let configRef = null;

if (fs.existsSync(configPath)) {
  const config = fs.readFileSync(configPath, "utf8");
  configRef = extractProjectRefFromConfig(config);
  if (configRef) {
    print("INFO", "supabase/config.toml has a project_id value.");
  } else {
    results.warnings.push("supabase/config.toml exists but no project_id was found.");
  }
} else {
  results.warnings.push("supabase/config.toml does not exist.");
}

if (!linkedRef && configRef) {
  linkedRef = configRef;
}

if (!linkedRef) {
  print("WARNING", "No local Supabase project link was detected.");
  results.warnings.push("Run supabase link manually after filling .project-identity.json.");
} else if (!isPlaceholder(expectedRef) && linkedRef === expectedRef) {
  print("PASS", "Linked Supabase project ref matches .project-identity.json.");
} else if (!isPlaceholder(expectedRef)) {
  print("ERROR", "Linked Supabase project ref differs from .project-identity.json.");
  results.errors.push("Current Supabase project does not match this repo.");
}

if (fs.existsSync(envLocalPath)) {
  print("INFO", ".env.local exists.");
  const envContents = fs.readFileSync(envLocalPath, "utf8");
  if (!isPlaceholder(expectedUrl) && envContents.includes(expectedUrl)) {
    print("PASS", ".env.local contains the expected Supabase project URL.");
  } else if (!isPlaceholder(expectedUrl)) {
    results.errors.push(".env.local does not contain the expected Supabase project URL.");
  } else {
    results.warnings.push("Skipped .env.local URL match because supabaseProjectUrl is still a placeholder.");
  }
} else {
  results.warnings.push(".env.local does not exist.");
}

if (isEnvIgnored()) {
  print("PASS", ".env.local is ignored by Git.");
} else {
  results.errors.push(".env.local is not ignored by Git.");
}

if (isEnvTracked()) {
  results.errors.push(".env.local is tracked by Git. Remove it from the index without deleting the local file.");
} else {
  print("PASS", ".env.local is not tracked by Git.");
}

if (results.errors.includes("Current Supabase project does not match this repo.")) {
  console.log("");
  console.log("Current Supabase project does not match this repo.");
  console.log("");
  console.log("Expected account type:");
  console.log(String(accountType || "UNKNOWN").toUpperCase());
  console.log("");
  console.log("Expected project ref:");
  console.log(expectedRef || "UNKNOWN");
  console.log("");
  console.log("Recommended manual fix:");
  console.log("");
  console.log("supabase logout");
  console.log("supabase login");
  console.log(`supabase link --project-ref ${expectedRef || "EXPECTED_PROJECT_REF"}`);
  console.log("");
  console.log("Then re-run:");
  console.log("");
  console.log("npm run check:supabase");
}

console.log("");
results.errors.forEach((message) => print("ERROR", message));
results.warnings.forEach((message) => print("WARNING", message));

if (results.errors.length) {
  print("ERROR", "Supabase identity check failed.");
  process.exit(1);
}

if (results.warnings.length) {
  print("WARNING", "Supabase identity check completed with warnings.");
  process.exit(0);
}

print("PASS", "Supabase identity check passed.");
