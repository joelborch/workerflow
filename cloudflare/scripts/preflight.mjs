#!/usr/bin/env node

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const strict = process.argv.includes("--strict");
const root = process.cwd();

function read(relPath) {
  return readFileSync(join(root, relPath), "utf8");
}

function extractRoutePaths(routesTs) {
  const values = new Set();
  const regex = /routePath:\s*"([^"]+)"/g;
  let match;
  while ((match = regex.exec(routesTs)) !== null) {
    values.add(match[1]);
  }
  return values;
}

function extractScheduleIds(schedulesTs) {
  const values = new Set();
  const regex = /id:\s*"([^"]+)"/g;
  let match;
  while ((match = regex.exec(schedulesTs)) !== null) {
    values.add(match[1]);
  }
  return values;
}

function extractHandlerKeys(indexTs, objectName) {
  const blockRegex = new RegExp(`${objectName}[\\s\\S]*?=\\s*\\{([\\s\\S]*?)\\};`);
  const blockMatch = indexTs.match(blockRegex);
  if (!blockMatch?.[1]) {
    throw new Error(`Could not locate object ${objectName}`);
  }

  const keys = new Set();
  const keyRegex = /^\s*([a-z0-9_]+)\s*:/gm;
  let match;
  while ((match = keyRegex.exec(blockMatch[1])) !== null) {
    keys.add(match[1]);
  }
  return keys;
}

function diff(expected, actual) {
  const missing = [...expected].filter((item) => !actual.has(item));
  const extra = [...actual].filter((item) => !expected.has(item));
  return { missing, extra };
}

function printDiff(title, result) {
  if (result.missing.length === 0 && result.extra.length === 0) {
    console.log(`[ok] ${title}`);
    return false;
  }

  console.log(`[fail] ${title}`);
  if (result.missing.length > 0) {
    console.log(`  missing: ${result.missing.join(", ")}`);
  }
  if (result.extra.length > 0) {
    console.log(`  extra:   ${result.extra.join(", ")}`);
  }
  return true;
}

function checkPlaceholders() {
  const files = [
    "workers/api/wrangler.jsonc",
    "workers/ops-dashboard/wrangler.jsonc",
    "workers/scheduler/wrangler.jsonc",
    "workers/queue-consumer/wrangler.jsonc",
    "workers/workflow/wrangler.jsonc"
  ];

  const offenders = [];
  for (const file of files) {
    const content = read(file);
    if (content.includes("REPLACE_WITH_")) {
      offenders.push(file);
    }
  }

  if (offenders.length === 0) {
    console.log("[ok] Wrangler configs have no placeholder IDs");
    return false;
  }

  const mode = strict ? "fail" : "warn";
  console.log(`[${mode}] Placeholder IDs remain in wrangler configs:`);
  for (const file of offenders) {
    console.log(`  - ${file}`);
  }
  return strict;
}

function runTypecheck() {
  console.log("[run] npm run typecheck");
  execSync("npm run typecheck", { stdio: "inherit" });
}

function main() {
  runTypecheck();

  const routesTs = read("shared/routes.ts");
  const schedulesTs = read("shared/schedules.ts");
  const httpIndexTs = read("workers/workflow/src/handlers/http/index.ts");
  const cronIndexTs = read("workers/workflow/src/handlers/cron/index.ts");

  const routePaths = extractRoutePaths(routesTs);
  const httpKeys = extractHandlerKeys(httpIndexTs, "HTTP_ROUTE_HANDLERS");
  const routeDiff = diff(routePaths, httpKeys);

  const scheduleIds = extractScheduleIds(schedulesTs);
  const cronKeys = extractHandlerKeys(cronIndexTs, "CRON_SCHEDULE_HANDLERS");
  const scheduleDiff = diff(scheduleIds, cronKeys);

  let failed = false;
  failed = printDiff("HTTP route coverage", routeDiff) || failed;
  failed = printDiff("Cron schedule coverage", scheduleDiff) || failed;
  failed = checkPlaceholders() || failed;

  if (failed) {
    process.exitCode = 1;
    return;
  }

  console.log("[ok] Preflight passed");
}

main();
