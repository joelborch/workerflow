import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

type ServiceRecord = {
  connectorName: string;
  officialApiDocsUrl: string | null;
  bestBaseLink: string | null;
  authDocsUrl: string | null;
  webhookDocsUrl: string | null;
  rateLimitDocsUrl: string | null;
  openapiUrl: string | null;
  officialSdkUrl: string | null;
  changelogUrl: string | null;
  sources: string[];
};

type ServiceRegistry = {
  services: ServiceRecord[];
};

type UrlCheckResult = {
  url: string;
  ok: boolean;
  status?: number;
  reason?: string;
};

const REQUEST_TIMEOUT_MS = 15000;
const MAX_RETRIES = 2;
const CONCURRENCY = 8;
const URL_FIELDS: Array<keyof ServiceRecord> = [
  "officialApiDocsUrl",
  "bestBaseLink",
  "authDocsUrl",
  "webhookDocsUrl",
  "rateLimitDocsUrl",
  "openapiUrl",
  "officialSdkUrl",
  "changelogUrl"
];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

async function fetchWithTimeout(url: string, method: "HEAD" | "GET") {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, {
      method,
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "workerflow-service-registry-url-check/1.0"
      }
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function checkSingleUrl(url: string): Promise<UrlCheckResult> {
  let lastFailure: UrlCheckResult | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      let response = await fetchWithTimeout(url, "HEAD");
      if (response.status < 200 || response.status >= 400) {
        response.body?.cancel();
        response = await fetchWithTimeout(url, "GET");
      }

      const { status, statusText } = response;
      response.body?.cancel();

      if (status >= 200 && status < 400) {
        return { url, ok: true, status };
      }

      if (attempt < MAX_RETRIES && isRetryableStatus(status)) {
        await sleep(250 * (attempt + 1));
        continue;
      }
      lastFailure = { url, ok: false, status, reason: `${status} ${statusText}`.trim() };
      break;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      if (attempt < MAX_RETRIES) {
        await sleep(250 * (attempt + 1));
        continue;
      }
      lastFailure = { url, ok: false, reason };
      break;
    }
  }

  // Some docs hosts intermittently fail under undici but still resolve with curl.
  const curlResult = spawnSync(
    "curl",
    ["-L", "-s", "-o", "/dev/null", "-w", "%{http_code}", "--max-time", "20", url],
    { encoding: "utf8" }
  );

  if (curlResult.status === 0) {
    const statusCode = Number.parseInt(curlResult.stdout.trim(), 10);
    if (Number.isFinite(statusCode) && statusCode >= 200 && statusCode < 400) {
      return { url, ok: true, status: statusCode };
    }
    return { url, ok: false, status: statusCode, reason: `curl status ${statusCode}` };
  }

  if (lastFailure != null) {
    return lastFailure;
  }
  return { url, ok: false, reason: "unknown error" };
}

function collectUniqueUrls(services: ServiceRecord[]) {
  const urls: string[] = [];
  const seen = new Set<string>();

  for (const service of services) {
    for (const field of URL_FIELDS) {
      const value = service[field];
      if (typeof value === "string" && value.startsWith("https://") && !seen.has(value)) {
        seen.add(value);
        urls.push(value);
      }
    }
    for (const source of service.sources) {
      if (source.startsWith("https://") && !seen.has(source)) {
        seen.add(source);
        urls.push(source);
      }
    }
  }

  return urls;
}

async function run() {
  const filePath = join(process.cwd(), "connector-registry", "services.json");
  const raw = readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw) as ServiceRegistry;

  const urls = collectUniqueUrls(parsed.services);
  assert.ok(urls.length > 0, "services.json: expected at least one URL to validate");

  const failures: UrlCheckResult[] = [];
  let index = 0;
  const workers = Array.from({ length: Math.min(CONCURRENCY, urls.length) }, async () => {
    while (index < urls.length) {
      const current = urls[index];
      index += 1;
      const result = await checkSingleUrl(current);
      if (!result.ok) {
        failures.push(result);
      }
    }
  });

  await Promise.all(workers);

  if (failures.length > 0) {
    console.error(`service registry URL health failed: checked=${urls.length} failed=${failures.length}`);
    for (const failure of failures) {
      const statusPart = failure.status != null ? ` status=${failure.status}` : "";
      const reasonPart = failure.reason ? ` reason="${failure.reason}"` : "";
      console.error(`- ${failure.url}${statusPart}${reasonPart}`);
    }
    process.exit(1);
  }

  console.log(`service registry URL health passed: checked=${urls.length}`);
}

run().catch((error) => {
  const reason = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(reason);
  process.exit(1);
});
