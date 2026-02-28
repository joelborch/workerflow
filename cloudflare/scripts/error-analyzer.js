#!/usr/bin/env node

/**
 * WorkerFlow Cloudflare error analyzer.
 *
 * Reads output from scripts/error-query.js and creates:
 * - Category breakdown
 * - Top recurring signatures
 * - Route/schedule hotspots
 * - Action recommendations
 */

const { readFileSync, writeFileSync } = require("node:fs");
const { resolve } = require("node:path");

const INPUT_PATH = resolve(process.cwd(), process.env.INPUT_PATH || "error-query-results.json");
const OUTPUT_PATH = resolve(process.cwd(), process.env.OUTPUT_PATH || "error-analysis-report.md");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function normalize(text) {
  return String(text || "").toLowerCase();
}

function categorize(errorSummary) {
  const e = normalize(errorSummary);

  if (e.includes("unique constraint failed") || e.includes("sqlite_constraint")) return "idempotency-db";
  if (e.includes("is required") || e.includes("missing") || e.includes("invalid")) return "configuration";
  if (e.includes("unauthorized") || e.includes("forbidden") || e.includes("permission")) return "authz";
  if (e.includes("rate") || e.includes("quota") || e.includes("429")) return "rate-limit";
  if (e.includes("timeout") || e.includes("network") || e.includes("connection")) return "network";
  if (e.includes("google token exchange failed") || e.includes("invalid_grant")) return "google-auth";
  if (e.includes("sheets") || e.includes("drive") || e.includes("gmail")) return "google-api";
  if (e.includes("clickup") || e.includes("mailchimp") || e.includes("telegram") || e.includes("zyte")) return "3rd-party-api";
  return "unknown";
}

function tallyBy(array, keyFn) {
  const map = new Map();
  for (const item of array) {
    const key = keyFn(item);
    map.set(key, (map.get(key) || 0) + 1);
  }
  return [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
}

function buildRecommendations(categoryCounts) {
  const out = [];

  const hasIdempotency = categoryCounts.find((item) => item.key === "idempotency-db");
  if (hasIdempotency) {
    out.push(
      "Fix run write idempotency: `runs.trace_id` duplicates indicate the same trace is being inserted multiple times across retries."
    );
  }

  const hasConfig = categoryCounts.find((item) => item.key === "configuration");
  if (hasConfig) {
    out.push("Backfill/validate required secrets and env vars before scheduled windows.");
  }

  const hasGoogleAuth = categoryCounts.find((item) => item.key === "google-auth");
  if (hasGoogleAuth) {
    out.push("Verify delegated service-account setup (domain-wide delegation + impersonated admin user + scopes).");
  }

  const hasThirdParty = categoryCounts.find((item) => item.key === "3rd-party-api");
  if (hasThirdParty) {
    out.push("Add retry/backoff and explicit upstream status logging for third-party integrations.");
  }

  if (out.length === 0) {
    out.push("No high-confidence recommendation generated; inspect top signatures manually.");
  }

  return out;
}

function report(data) {
  const failures = Array.isArray(data.failedRuns) ? data.failedRuns : [];
  const deadLetters = Array.isArray(data.deadLetters) ? data.deadLetters : [];

  const combined = [
    ...failures.map((item) => ({ ...item, source: "runs" })),
    ...deadLetters.map((item) => ({ ...item, source: "dead_letters" }))
  ];

  const categoryCounts = tallyBy(combined, (item) => categorize(item.errorSummary));
  const signatureCounts = tallyBy(combined, (item) => item.errorSummary || "Unknown error");
  const routeCounts = tallyBy(
    failures.filter((item) => item.routePath),
    (item) => item.routePath
  );
  const scheduleCounts = tallyBy(
    failures.filter((item) => item.scheduleId),
    (item) => item.scheduleId
  );

  const recommendations = buildRecommendations(categoryCounts);

  const lines = [];
  lines.push("# WorkerFlow Cloudflare Error Analysis");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("## Summary");
  lines.push(`- Window (hours): ${data.config?.windowHours ?? "unknown"}`);
  lines.push(`- Total runs: ${data.summary?.totalRuns ?? 0}`);
  lines.push(`- Failed runs: ${data.summary?.failedRuns ?? 0}`);
  lines.push(`- Dead letters: ${data.summary?.deadLetters ?? 0}`);
  lines.push("");

  lines.push("## Categories");
  if (categoryCounts.length === 0) {
    lines.push("- No error categories found.");
  } else {
    for (const item of categoryCounts) {
      lines.push(`- ${item.key}: ${item.count}`);
    }
  }
  lines.push("");

  lines.push("## Top Signatures");
  if (signatureCounts.length === 0) {
    lines.push("- No signatures found.");
  } else {
    for (const item of signatureCounts.slice(0, 10)) {
      lines.push(`- ${item.key}: ${item.count}`);
    }
  }
  lines.push("");

  lines.push("## Route Hotspots");
  if (routeCounts.length === 0) {
    lines.push("- No failing HTTP routes in window.");
  } else {
    for (const item of routeCounts.slice(0, 10)) {
      lines.push(`- ${item.key}: ${item.count}`);
    }
  }
  lines.push("");

  lines.push("## Schedule Hotspots");
  if (scheduleCounts.length === 0) {
    lines.push("- No failing cron schedules in window.");
  } else {
    for (const item of scheduleCounts.slice(0, 10)) {
      lines.push(`- ${item.key}: ${item.count}`);
    }
  }
  lines.push("");

  lines.push("## Recommended Actions");
  for (const recommendation of recommendations) {
    lines.push(`- ${recommendation}`);
  }
  lines.push("");

  return lines.join("\n");
}

function main() {
  const data = readJson(INPUT_PATH);
  const markdown = report(data);
  writeFileSync(OUTPUT_PATH, markdown);
  console.log(`Analysis complete: ${OUTPUT_PATH}`);
}

try {
  main();
} catch (error) {
  console.error("error-analyzer failed:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
