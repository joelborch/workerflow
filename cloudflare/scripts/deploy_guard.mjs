#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const strict = process.argv.includes("--strict");
const cwd = process.cwd();

const filesToCheck = [
  "workers/api/wrangler.jsonc",
  "workers/ops-dashboard/wrangler.jsonc",
  "workers/scheduler/wrangler.jsonc",
  "workers/queue-consumer/wrangler.jsonc",
  "workers/workflow/wrangler.jsonc",
  "../infra/cloudflare.resources.json"
];

function findPlaceholderLines(content) {
  const lines = content.split(/\r?\n/);
  const matches = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.includes("REPLACE_WITH_")) {
      matches.push({ line: index + 1, text: line.trim() });
    }
  }
  return matches;
}

const offenders = [];

for (const relativePath of filesToCheck) {
  const absolutePath = resolve(cwd, relativePath);
  const content = readFileSync(absolutePath, "utf8");
  const matches = findPlaceholderLines(content);
  if (matches.length > 0) {
    offenders.push({
      path: relativePath,
      matches
    });
  }
}

if (offenders.length === 0) {
  console.log("deploy guard passed: no REPLACE_WITH_* placeholders found");
  process.exit(0);
}

const label = strict ? "FAIL" : "WARN";
console.log(`[${label}] placeholder identifiers found:`);
for (const offender of offenders) {
  console.log(`- ${offender.path}`);
  for (const match of offender.matches) {
    console.log(`  line ${match.line}: ${match.text}`);
  }
}

if (strict) {
  process.exit(1);
}
