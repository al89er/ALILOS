#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const identityPath = path.join(root, ".project-identity.json");

const results = {
  errors: [],
  warnings: [],
};

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  return {
    status: result.status,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
    ok: result.status === 0,
  };
}

function readIdentity() {
  if (!fs.existsSync(identityPath)) {
    results.errors.push(".project-identity.json is missing.");
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(identityPath, "utf8"));
  } catch (error) {
    results.errors.push(`.project-identity.json is not valid JSON: ${error.message}`);
    return null;
  }
}

function isPlaceholder(value) {
  return typeof value !== "string" || !value.trim() || value.includes("TODO_") || value.includes("work-or-personal") || value.includes("your-");
}

function print(status, message) {
  console.log(`${status}: ${message}`);
}

console.log("Project identity check");
console.log("======================");

const identity = readIdentity();

if (identity) {
  const expectedProjectType = identity.projectType;
  const expectedHostAlias = identity.githubHostAlias;
  const expectedName = identity.gitUserName;
  const expectedEmail = identity.gitUserEmail;

  if (!["work", "personal"].includes(expectedProjectType)) {
    results.errors.push('projectType must be "work" or "personal".');
  }

  if (isPlaceholder(expectedHostAlias)) {
    results.errors.push("githubHostAlias must be set.");
  }

  if (isPlaceholder(expectedName)) {
    results.errors.push("gitUserName must be set.");
  }

  if (isPlaceholder(expectedEmail)) {
    results.errors.push("gitUserEmail must be set.");
  }

  print("INFO", `Expected project type: ${String(expectedProjectType || "missing").toUpperCase()}`);
  print("INFO", `Expected GitHub host alias: ${expectedHostAlias || "missing"}`);

  const remote = run("git", ["remote", "get-url", "origin"]);
  if (!remote.ok) {
    results.warnings.push("Git origin remote is not configured.");
  } else {
    print("INFO", `Git origin remote: ${remote.stdout}`);
    if (expectedHostAlias && remote.stdout.includes(`${expectedHostAlias}:`)) {
      print("PASS", "Git origin remote uses expected GitHub SSH host alias.");
    } else if (remote.stdout.includes("github.com")) {
      results.warnings.push("Git origin remote uses plain github.com instead of the expected host alias.");
    } else {
      results.warnings.push("Git origin remote does not clearly use the expected GitHub host alias.");
    }
  }

  const name = run("git", ["config", "user.name"]);
  const email = run("git", ["config", "user.email"]);

  if (!name.ok || !name.stdout) {
    results.warnings.push("Git user.name is not set for this repo.");
  } else if (name.stdout === expectedName) {
    print("PASS", "Git user.name matches .project-identity.json.");
  } else {
    results.errors.push("Git user.name does not match .project-identity.json.");
  }

  if (!email.ok || !email.stdout) {
    results.warnings.push("Git user.email is not set for this repo.");
  } else if (email.stdout === expectedEmail) {
    print("PASS", "Git user.email matches .project-identity.json.");
  } else {
    results.errors.push("Git user.email does not match .project-identity.json.");
  }
}

const supabaseScript = path.join(root, "scripts", "check-supabase-identity.js");
if (fs.existsSync(supabaseScript)) {
  console.log("");
  const supabase = run(process.execPath, [supabaseScript]);
  if (supabase.stdout) {
    console.log(supabase.stdout);
  }
  if (!supabase.ok) {
    results.errors.push("Supabase identity check did not pass.");
  }
} else {
  results.warnings.push("scripts/check-supabase-identity.js is missing.");
}

console.log("");
if (results.errors.length) {
  results.errors.forEach((message) => print("ERROR", message));
}
if (results.warnings.length) {
  results.warnings.forEach((message) => print("WARNING", message));
}

if (results.errors.length) {
  print("ERROR", "Project identity check failed.");
  process.exit(1);
}

if (results.warnings.length) {
  print("WARNING", "Project identity check completed with warnings.");
  process.exit(0);
}

print("PASS", "Project identity check passed.");
