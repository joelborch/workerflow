#!/usr/bin/env node

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const failures = [];
const warnings = [];

function hasPlaceholderIds(content) {
  return content.includes("REPLACE_WITH_");
}

function safeExec(command) {
  try {
    return execSync(command, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
  } catch {
    return null;
  }
}

function ok(message) {
  console.log(`[ok] ${message}`);
}

function warn(message) {
  warnings.push(message);
  console.log(`[warn] ${message}`);
}

function fail(message) {
  failures.push(message);
  console.log(`[fail] ${message}`);
}

function checkNode() {
  const [major] = process.versions.node.split(".").map((part) => Number.parseInt(part, 10));
  if (!Number.isFinite(major) || major < 20) {
    fail(`Node.js >=20 is required (found ${process.versions.node})`);
    return;
  }
  ok(`Node.js ${process.versions.node}`);
}

function checkNpm() {
  const version = safeExec("npm --version");
  if (version == null || version.length === 0) {
    fail("npm is not available on PATH");
    return;
  }
  ok(`npm ${version}`);
}

function checkWrangler() {
  const local = safeExec("npx --no-install wrangler --version");
  if (local != null && local.length > 0) {
    ok(`wrangler ${local}`);
    return;
  }

  if (existsSync(join(root, "node_modules", ".bin", "wrangler"))) {
    warn("wrangler binary exists but version check failed; run npm install in cloudflare/");
    return;
  }

  warn("wrangler is not installed yet (run npm install in cloudflare/)");
}

function checkInitArtifacts() {
  const required = [
    ".dev.vars",
    "config/routes.config.json",
    "config/schedules.config.json",
    "../infra/cloudflare.resources.local.json"
  ];

  const missing = required.filter((relPath) => !existsSync(join(root, relPath)));
  if (missing.length > 0) {
    warn(`init files missing: ${missing.join(", ")} (run npm run init)`);
    return;
  }

  ok("init artifacts present");
}

function checkWranglerPlaceholders() {
  const wranglerFiles = [
    "workers/api/wrangler.jsonc",
    "workers/workflow/wrangler.jsonc",
    "workers/queue-consumer/wrangler.jsonc",
    "workers/scheduler/wrangler.jsonc",
    "workers/ops-dashboard/wrangler.jsonc"
  ];

  const pending = [];
  for (const relPath of wranglerFiles) {
    const absPath = join(root, relPath);
    if (!existsSync(absPath)) {
      fail(`missing required file: ${relPath}`);
      continue;
    }

    const content = readFileSync(absPath, "utf8");
    if (hasPlaceholderIds(content)) {
      pending.push(relPath);
    }
  }

  if (pending.length === 0) {
    ok("wrangler configs contain no placeholder IDs");
    return;
  }

  warn(`placeholder IDs remain in wrangler configs: ${pending.join(", ")}`);
}

function checkServiceRegistry() {
  const relPath = "connector-registry/services.json";
  const absPath = join(root, relPath);

  if (!existsSync(absPath)) {
    fail(`missing service registry: ${relPath}`);
    return;
  }

  try {
    const parsed = JSON.parse(readFileSync(absPath, "utf8"));
    const count = Array.isArray(parsed.services) ? parsed.services.length : 0;
    if (count === 0) {
      fail("service registry contains no services");
      return;
    }
    ok(`service registry loaded (${count} services)`);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    fail(`service registry JSON is invalid: ${reason}`);
  }
}

function main() {
  console.log("WorkerFlow Doctor (cloudflare)");
  checkNode();
  checkNpm();
  checkWrangler();
  checkInitArtifacts();
  checkWranglerPlaceholders();
  checkServiceRegistry();

  console.log("\nSummary");
  console.log(`- failures: ${failures.length}`);
  console.log(`- warnings: ${warnings.length}`);

  if (failures.length > 0) {
    process.exitCode = 1;
    return;
  }

  if (warnings.length > 0) {
    console.log("Doctor completed with warnings.");
    return;
  }

  console.log("Doctor passed.");
}

main();
