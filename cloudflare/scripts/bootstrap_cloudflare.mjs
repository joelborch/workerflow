#!/usr/bin/env node

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const args = new Set(process.argv.slice(2));
const shouldApply = args.has("--apply");
const shouldPrint = args.has("--print-plan") || !shouldApply;

const specPath = resolve(root, "../infra/cloudflare.resources.json");
const spec = JSON.parse(readFileSync(specPath, "utf8"));

function isPlaceholder(value) {
  return typeof value === "string" && value.startsWith("REPLACE_WITH_");
}

function buildPlan() {
  const d1Name = spec?.d1?.name;
  const queueName = spec?.queue?.name;
  const migrationsDir = spec?.d1?.migrations_dir ?? "cloudflare/migrations/d1";

  return [
    { id: "wrangler_login", cmd: "npx wrangler login" },
    { id: "create_d1", cmd: `npx wrangler d1 create ${d1Name} --json` },
    { id: "create_queue", cmd: `npx wrangler queues create ${queueName} --json` },
    {
      id: "apply_d1_local_migrations",
      cmd: `npx wrangler d1 migrations apply ${d1Name} --local --config workers/api/wrangler.jsonc`
    },
    {
      id: "apply_d1_remote_migrations",
      cmd: `npx wrangler d1 migrations apply ${d1Name} --remote --config workers/api/wrangler.jsonc`
    },
    {
      id: "set_workflow_secret_example",
      cmd: "npx wrangler secret put GOOGLEAI_API_KEY --config workers/workflow/wrangler.jsonc"
    },
    {
      id: "deploy_workers",
      cmd: "npm run deploy:workflow && npm run deploy:queue && npm run deploy:api && npm run deploy:scheduler && npm run deploy:ops"
    },
    {
      id: "notes",
      cmd: `d1_migrations_dir=${migrationsDir}; secrets_store_id=${spec?.secrets_store?.id ?? ""}`
    }
  ];
}

const plan = buildPlan();

if (shouldPrint) {
  console.log(
    JSON.stringify(
      {
        specPath,
        applyMode: shouldApply,
        plan
      },
      null,
      2
    )
  );
}

if (!shouldApply) {
  process.exit(0);
}

if (isPlaceholder(spec?.account_id) || isPlaceholder(spec?.d1?.database_id) || isPlaceholder(spec?.secrets_store?.id)) {
  console.error("Cannot run --apply while infra spec still contains REPLACE_WITH_* placeholders.");
  process.exit(1);
}

for (const step of plan) {
  if (step.id === "set_workflow_secret_example" || step.id === "notes") {
    continue;
  }

  console.log(`[run] ${step.id}`);
  execSync(step.cmd, { cwd: root, stdio: "inherit" });
}

console.log("Bootstrap apply completed.");
