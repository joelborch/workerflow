#!/usr/bin/env node

/**
 * WorkerFlow Cloudflare error query script.
 *
 * Purpose:
 * - Pull failed runs + dead letters from D1
 * - Group errors by signature and count
 * - Save a machine-readable snapshot for downstream analysis
 *
 * Configuration via env:
 * - D1_DATABASE (default: workerflow-runtime)
 * - WRANGLER_CONFIG (default: workers/workflow/wrangler.jsonc)
 * - D1_REMOTE (default: true)
 * - ERROR_WINDOW_HOURS (default: 24)
 * - ERROR_LIMIT (default: 200)
 * - OUTPUT_PATH (default: ./error-query-results.json)
 */

const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const { writeFileSync } = require("node:fs");
const { resolve } = require("node:path");

const execFileAsync = promisify(execFile);

const D1_DATABASE = process.env.D1_DATABASE || "workerflow-runtime";
const WRANGLER_CONFIG = process.env.WRANGLER_CONFIG || "workers/workflow/wrangler.jsonc";
const D1_REMOTE = (process.env.D1_REMOTE || "true").toLowerCase() !== "false";
const ERROR_WINDOW_HOURS = Number(process.env.ERROR_WINDOW_HOURS || "24");
const ERROR_LIMIT = Number(process.env.ERROR_LIMIT || "200");
const OUTPUT_PATH = resolve(process.cwd(), process.env.OUTPUT_PATH || "error-query-results.json");

function validateConfig() {
  if (!Number.isFinite(ERROR_WINDOW_HOURS) || ERROR_WINDOW_HOURS <= 0) {
    throw new Error("ERROR_WINDOW_HOURS must be a positive number");
  }

  if (!Number.isFinite(ERROR_LIMIT) || ERROR_LIMIT <= 0) {
    throw new Error("ERROR_LIMIT must be a positive number");
  }
}

function cutoffIso() {
  return new Date(Date.now() - ERROR_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
}

function oneLine(value) {
  if (!value) {
    return "";
  }
  return String(value).replace(/\s+/g, " ").trim();
}

function summarizeError(error) {
  const text = oneLine(error);
  if (!text) {
    return "Unknown error";
  }
  const firstLine = text.split(" at ")[0].trim();
  return firstLine.slice(0, 240);
}

async function runD1Query(sql) {
  const args = [
    "wrangler",
    "d1",
    "execute",
    D1_DATABASE,
    ...(D1_REMOTE ? ["--remote"] : []),
    "--config",
    WRANGLER_CONFIG,
    "--command",
    sql,
    "--json"
  ];

  const { stdout } = await execFileAsync("npx", args, {
    maxBuffer: 10 * 1024 * 1024
  });

  const parsed = JSON.parse(stdout);
  if (!Array.isArray(parsed) || parsed.length === 0 || !parsed[0].success) {
    throw new Error(`Unexpected D1 response: ${stdout.slice(0, 500)}`);
  }

  return parsed[0].results || [];
}

async function querySummary(cutoff) {
  const rows = await runD1Query(`
    SELECT
      COUNT(*) AS total_runs,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed_runs,
      SUM(CASE WHEN status = 'succeeded' THEN 1 ELSE 0 END) AS succeeded_runs,
      SUM(CASE WHEN status = 'started' THEN 1 ELSE 0 END) AS started_runs
    FROM runs
    WHERE started_at >= '${cutoff}'
  `);

  const deadRows = await runD1Query(`
    SELECT COUNT(*) AS dead_letters
    FROM dead_letters
    WHERE created_at >= '${cutoff}'
  `);

  return {
    totalRuns: Number(rows[0]?.total_runs || 0),
    failedRuns: Number(rows[0]?.failed_runs || 0),
    succeededRuns: Number(rows[0]?.succeeded_runs || 0),
    startedRuns: Number(rows[0]?.started_runs || 0),
    deadLetters: Number(deadRows[0]?.dead_letters || 0)
  };
}

async function queryFailedRuns(cutoff) {
  const rows = await runD1Query(`
    SELECT
      trace_id AS traceId,
      kind,
      route_path AS routePath,
      schedule_id AS scheduleId,
      status,
      started_at AS startedAt,
      finished_at AS finishedAt,
      error
    FROM runs
    WHERE started_at >= '${cutoff}'
      AND (status = 'failed' OR (error IS NOT NULL AND TRIM(error) <> ''))
    ORDER BY started_at DESC
    LIMIT ${Math.floor(ERROR_LIMIT)}
  `);

  return rows.map((row) => ({
    ...row,
    errorSummary: summarizeError(row.error)
  }));
}

async function queryFailedBySignature(cutoff) {
  const rows = await runD1Query(`
    SELECT
      COALESCE(NULLIF(TRIM(error), ''), 'Unknown error') AS error,
      COUNT(*) AS count
    FROM runs
    WHERE started_at >= '${cutoff}'
      AND (status = 'failed' OR (error IS NOT NULL AND TRIM(error) <> ''))
    GROUP BY error
    ORDER BY count DESC
    LIMIT ${Math.floor(ERROR_LIMIT)}
  `);

  return rows.map((row) => ({
    error: row.error,
    count: Number(row.count || 0),
    errorSummary: summarizeError(row.error)
  }));
}

async function queryDeadLetters(cutoff) {
  const rows = await runD1Query(`
    SELECT
      id,
      trace_id AS traceId,
      created_at AS createdAt,
      error
    FROM dead_letters
    WHERE created_at >= '${cutoff}'
    ORDER BY created_at DESC
    LIMIT ${Math.floor(ERROR_LIMIT)}
  `);

  return rows.map((row) => ({
    ...row,
    errorSummary: summarizeError(row.error)
  }));
}

async function queryDeadBySignature(cutoff) {
  const rows = await runD1Query(`
    SELECT
      COALESCE(NULLIF(TRIM(error), ''), 'Unknown error') AS error,
      COUNT(*) AS count
    FROM dead_letters
    WHERE created_at >= '${cutoff}'
    GROUP BY error
    ORDER BY count DESC
    LIMIT ${Math.floor(ERROR_LIMIT)}
  `);

  return rows.map((row) => ({
    error: row.error,
    count: Number(row.count || 0),
    errorSummary: summarizeError(row.error)
  }));
}

async function main() {
  validateConfig();
  const cutoff = cutoffIso();
  const generatedAt = new Date().toISOString();

  console.log(`Querying D1 errors (database=${D1_DATABASE}, remote=${D1_REMOTE}, cutoff=${cutoff})...`);

  const [summary, failedRuns, failedBySignature, deadLetters, deadBySignature] = await Promise.all([
    querySummary(cutoff),
    queryFailedRuns(cutoff),
    queryFailedBySignature(cutoff),
    queryDeadLetters(cutoff),
    queryDeadBySignature(cutoff)
  ]);

  const payload = {
    generatedAt,
    config: {
      database: D1_DATABASE,
      wranglerConfig: WRANGLER_CONFIG,
      remote: D1_REMOTE,
      windowHours: ERROR_WINDOW_HOURS,
      limit: ERROR_LIMIT,
      cutoff
    },
    summary,
    failedRuns,
    failedBySignature,
    deadLetters,
    deadBySignature
  };

  writeFileSync(OUTPUT_PATH, JSON.stringify(payload, null, 2));

  console.log("Done.");
  console.log(`- Failed runs: ${failedRuns.length}`);
  console.log(`- Dead letters: ${deadLetters.length}`);
  console.log(`- Output: ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error("error-query failed:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
