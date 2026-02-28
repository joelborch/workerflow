#!/usr/bin/env node

import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const strict = process.argv.includes("--strict");
const cwd = process.cwd();
const migrationsDir = resolve(cwd, "migrations/d1");
const appliedThroughFile = resolve(migrationsDir, "APPLIED_THROUGH");

const sqlFilePattern = /^(\d{4})_[a-z0-9_]+\.sql$/;
const riskyPatterns = [
  { label: "drop table", regex: /\bDROP\s+TABLE\b/i },
  { label: "drop column", regex: /\bDROP\s+COLUMN\b/i },
  { label: "table rename", regex: /\bALTER\s+TABLE\b[\s\S]*?\bRENAME\b/i },
  { label: "create unique index", regex: /\bCREATE\s+UNIQUE\s+INDEX\b/i },
  { label: "delete without where", regex: /\bDELETE\s+FROM\s+[a-z0-9_"]+\s*;?/i }
];

function readAppliedThrough() {
  if (process.env.WORKERFLOW_MIGRATION_APPLIED_THROUGH) {
    return process.env.WORKERFLOW_MIGRATION_APPLIED_THROUGH.trim();
  }
  return readFileSync(appliedThroughFile, "utf8").trim();
}

function collectMigrations() {
  const files = readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .sort((left, right) => left.localeCompare(right));

  const invalidNames = [];
  const migrations = [];

  for (const file of files) {
    const match = file.match(sqlFilePattern);
    if (!match) {
      invalidNames.push(file);
      continue;
    }
    migrations.push({
      file,
      sequence: Number(match[1])
    });
  }

  return { migrations, invalidNames };
}

function findSequenceGaps(migrations) {
  const gaps = [];
  for (let index = 1; index < migrations.length; index += 1) {
    const prev = migrations[index - 1];
    const current = migrations[index];
    if (current.sequence !== prev.sequence + 1) {
      gaps.push(`${prev.file} -> ${current.file}`);
    }
  }
  return gaps;
}

function findRiskyStatements(migrations) {
  const findings = [];

  for (const migration of migrations) {
    const content = readFileSync(resolve(migrationsDir, migration.file), "utf8");
    for (const pattern of riskyPatterns) {
      if (pattern.regex.test(content)) {
        findings.push({
          file: migration.file,
          risk: pattern.label
        });
      }
    }
  }

  return findings;
}

function main() {
  const problems = [];
  const { migrations, invalidNames } = collectMigrations();

  if (migrations.length === 0) {
    problems.push("no SQL migration files found in migrations/d1");
  }

  if (invalidNames.length > 0) {
    problems.push(`invalid migration file names: ${invalidNames.join(", ")}`);
  }

  const sequenceGaps = findSequenceGaps(migrations);
  if (sequenceGaps.length > 0) {
    problems.push(`migration sequence gaps detected: ${sequenceGaps.join(" | ")}`);
  }

  const appliedThrough = readAppliedThrough();
  const appliedExists = migrations.some((migration) => migration.file === appliedThrough);
  if (!appliedExists) {
    problems.push(`APPLIED_THROUGH points to missing migration: ${appliedThrough}`);
  }

  const unapplied = migrations.filter((migration) => migration.file > appliedThrough);
  if (unapplied.length > 0) {
    problems.push(`unapplied migrations detected after ${appliedThrough}: ${unapplied.map((item) => item.file).join(", ")}`);
  }

  const riskyFindings = findRiskyStatements(migrations);
  if (riskyFindings.length > 0) {
    const details = riskyFindings.map((item) => `${item.file} (${item.risk})`).join(", ");
    problems.push(`risky migration statements detected: ${details}`);
  }

  if (problems.length === 0) {
    console.log(`migration guard passed: ${migrations.length} migrations checked, applied through ${appliedThrough}`);
    process.exit(0);
  }

  const level = strict ? "FAIL" : "WARN";
  console.log(`[${level}] migration guard findings:`);
  for (const problem of problems) {
    console.log(`- ${problem}`);
  }

  if (strict) {
    process.exit(1);
  }
}

main();
