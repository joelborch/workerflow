#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const cloudflareDir = resolve(__dirname, "..");
const repoRoot = resolve(cloudflareDir, "..");
const force = process.argv.includes("--force");

function ensureFile(target, source) {
  if (!force && existsSync(target)) {
    return { created: false, target };
  }
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
  return { created: true, target };
}

const tasks = [
  ensureFile(resolve(cloudflareDir, ".dev.vars"), resolve(cloudflareDir, ".dev.vars.example")),
  ensureFile(resolve(cloudflareDir, "config/routes.config.json"), resolve(cloudflareDir, "config/routes.config.example.json")),
  ensureFile(resolve(cloudflareDir, "config/schedules.config.json"), resolve(cloudflareDir, "config/schedules.config.example.json")),
  ensureFile(resolve(repoRoot, "infra/cloudflare.resources.local.json"), resolve(repoRoot, "infra/cloudflare.resources.json"))
];

console.log("workerflow init completed");
for (const item of tasks) {
  const label = item.created ? "created" : "kept";
  console.log(`- ${label}: ${item.target}`);
}

console.log("next steps:");
console.log("1) edit infra/cloudflare.resources.local.json with real IDs");
console.log("2) review cloudflare/.dev.vars for local secrets");
console.log("3) run: cd cloudflare && npm run preflight && npm run bootstrap");
