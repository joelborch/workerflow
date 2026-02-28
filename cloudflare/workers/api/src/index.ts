import { isDuplicateDelivery, markIdempotent } from "../../../shared/db";
import { json, readTraceId } from "../../../shared/http";
import { resolveRuntimeManifest } from "../../../shared/manifest";
import { isSyncHttpPassthrough } from "../../../shared/types";
import type { Env, QueueTask } from "../../../shared/types";

const CORS_ALLOWED_METHODS = "POST, OPTIONS";
const CORS_ALLOWED_HEADERS =
  "content-type, authorization, x-api-token, x-api-key, x-webhook-token, x-trace-id, x-signature, x-signature-timestamp";
const LEGACY_ALERT_MAX_BODY_CHARS = 4000;
const DEFAULT_HMAC_MAX_SKEW_SECONDS = 300;

const rateLimitWindow = new Map<string, { windowStartMs: number; count: number }>();

type SecretsStoreBinding = {
  get: () => Promise<string>;
};

function isSecretsStoreBinding(value: unknown): value is SecretsStoreBinding {
  return (
    typeof value === "object" &&
    value !== null &&
    "get" in value &&
    typeof (value as { get?: unknown }).get === "function"
  );
}

function withCors(response: Response, request: Request) {
  const headers = new Headers(response.headers);
  const origin = request.headers.get("origin");
  headers.set("access-control-allow-origin", origin && origin.trim().length > 0 ? origin : "*");
  headers.set("access-control-allow-methods", CORS_ALLOWED_METHODS);
  headers.set("access-control-allow-headers", CORS_ALLOWED_HEADERS);
  headers.set("access-control-max-age", "86400");
  headers.set("vary", "origin");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function routeFromUrl(url: URL) {
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length !== 2 || parts[0] !== "api") {
    return "";
  }
  return parts[1] ?? "";
}

function legacyRouteFromUrl(url: URL) {
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 4 || parts[0] !== "api" || parts[1] !== "r") {
    return "";
  }

  const raw = parts.slice(3).join("/");
  if (!raw) {
    return "";
  }
  return decodeURIComponent(raw);
}

function truncateForAlert(value: string, limit = LEGACY_ALERT_MAX_BODY_CHARS) {
  if (value.length <= limit) {
    return value;
  }
  return `${value.slice(0, limit)}\n...[truncated ${value.length - limit} chars]`;
}

async function readLegacyBodyForAlert(request: Request) {
  if (request.method === "GET" || request.method === "HEAD") {
    return "(no request body)";
  }

  const raw = await request.text();
  if (!raw) {
    return "(empty request body)";
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      const parsed = JSON.parse(raw);
      return truncateForAlert(JSON.stringify(parsed, null, 2));
    } catch {
      return truncateForAlert(raw);
    }
  }

  return truncateForAlert(raw);
}

function devCronScheduleIdFromUrl(url: URL) {
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length !== 4 || parts[0] !== "api" || parts[1] !== "dev" || parts[2] !== "cron") {
    return "";
  }
  return parts[3] ?? "";
}

function readIngressToken(request: Request) {
  const directHeader =
    request.headers.get("x-api-token") ??
    request.headers.get("x-api-key") ??
    request.headers.get("x-webhook-token");
  if (directHeader && directHeader.trim().length > 0) {
    return directHeader.trim();
  }

  const authorization = request.headers.get("authorization");
  if (!authorization) {
    return "";
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (match?.[1]) {
    return match[1].trim();
  }

  return authorization.trim();
}

function isIngressAuthorized(request: Request, env: Env) {
  const requiredToken = env.API_INGRESS_TOKEN?.trim();
  if (!requiredToken) {
    return true;
  }

  const provided = readIngressToken(request);
  return provided === requiredToken;
}

function envInt(env: Env, key: keyof Env) {
  const raw = env[key];
  if (typeof raw !== "string") {
    return 0;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }
  return parsed;
}

function readClientKey(request: Request) {
  const forwarded = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for");
  if (forwarded && forwarded.trim().length > 0) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }
  return "unknown";
}

function checkRateLimit(request: Request, env: Env) {
  const limitPerMinute = envInt(env, "API_RATE_LIMIT_PER_MINUTE");
  if (limitPerMinute === 0) {
    return { allowed: true as const };
  }

  const clientKey = readClientKey(request);
  const now = Date.now();
  const windowMs = 60_000;
  const bucket = rateLimitWindow.get(clientKey);
  if (!bucket || now - bucket.windowStartMs >= windowMs) {
    rateLimitWindow.set(clientKey, { windowStartMs: now, count: 1 });
    return { allowed: true as const };
  }

  if (bucket.count >= limitPerMinute) {
    const retryAfterMs = Math.max(1_000, windowMs - (now - bucket.windowStartMs));
    return { allowed: false as const, retryAfterSeconds: Math.ceil(retryAfterMs / 1_000) };
  }

  bucket.count += 1;
  rateLimitWindow.set(clientKey, bucket);
  return { allowed: true as const };
}

function hex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function normalizeSignature(value: string) {
  const trimmed = value.trim();
  const prefixed = trimmed.match(/^v1=([a-f0-9]{64})$/i);
  if (prefixed?.[1]) {
    return prefixed[1].toLowerCase();
  }
  if (/^[a-f0-9]{64}$/i.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  return "";
}

function secureEqualHex(a: string, b: string) {
  if (a.length !== b.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

async function validateIngressSignature(request: Request, env: Env) {
  const secret = env.API_HMAC_SECRET?.trim();
  if (!secret) {
    return { valid: true as const };
  }

  const timestamp = request.headers.get("x-signature-timestamp")?.trim() ?? "";
  const signatureRaw = request.headers.get("x-signature")?.trim() ?? "";
  if (!timestamp || !signatureRaw) {
    return { valid: false as const, reason: "missing signature headers" };
  }

  const timestampSeconds = Number.parseInt(timestamp, 10);
  if (!Number.isFinite(timestampSeconds) || timestampSeconds <= 0) {
    return { valid: false as const, reason: "invalid signature timestamp" };
  }

  const maxSkew = envInt(env, "API_HMAC_MAX_SKEW_SECONDS") || DEFAULT_HMAC_MAX_SKEW_SECONDS;
  const nowSeconds = Math.floor(Date.now() / 1_000);
  if (Math.abs(nowSeconds - timestampSeconds) > maxSkew) {
    return { valid: false as const, reason: "signature timestamp outside allowed skew" };
  }

  const normalizedSignature = normalizeSignature(signatureRaw);
  if (!normalizedSignature) {
    return { valid: false as const, reason: "invalid signature format" };
  }

  const bodyText = await request.clone().text();
  const payload = `${timestamp}.${bodyText}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const expected = hex(digest);

  if (!secureEqualHex(expected, normalizedSignature)) {
    return { valid: false as const, reason: "signature mismatch" };
  }

  return { valid: true as const };
}

async function postAlertToGoogleChat(webhookUrl: string, text: string) {
  await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ text })
  });
}

async function readSecretString(candidate: unknown) {
  if (typeof candidate === "string" && candidate.trim().length > 0) {
    return candidate.trim();
  }
  if (!isSecretsStoreBinding(candidate)) {
    return "";
  }
  try {
    const value = await candidate.get();
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : "";
  } catch {
    return "";
  }
}

async function readLegacyAlertWebhook(env: Env) {
  const candidates = [
    env.LEGACY_ALERT_WEBHOOK_URL,
    env.GCHAT_ALERTS_WEBHOOK,
    env.GCHAT_ALERTS_WEBHOOK_URL
  ];
  for (const candidate of candidates) {
    const resolved = await readSecretString(candidate);
    if (resolved) {
      return resolved;
    }
  }
  return "";
}

async function alertLegacyEndpointHit(request: Request, url: URL, env: Env, traceId: string, routePath: string) {
  const webhookUrl = await readLegacyAlertWebhook(env);
  if (!webhookUrl) {
    return;
  }

  const bodyText = await readLegacyBodyForAlert(request);
  const message = [
    "LEGACY ENDPOINT HIT",
    `trace=${traceId}`,
    `time=${new Date().toISOString()}`,
    `method=${request.method}`,
    `route=${routePath || "(missing route path)"}`,
    `url=${url.toString()}`,
    `path=${url.pathname}`,
    `query=${url.search || "(none)"}`,
    `host=${url.host}`,
    `content-type=${request.headers.get("content-type") || "(none)"}`,
    `user-agent=${request.headers.get("user-agent") || "(none)"}`,
    "payload:",
    bodyText
  ].join("\n");

  try {
    await postAlertToGoogleChat(webhookUrl, message);
  } catch (error) {
    console.error("failed to send legacy endpoint alert", {
      traceId,
      routePath,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

function parseRouteSet(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (normalized.length === 0) {
    return null;
  }

  return new Set(normalized);
}

function isRouteEnabled(routePath: string, env: Env) {
  const enabled = parseRouteSet(env.ENABLED_HTTP_ROUTES);
  if (enabled && !enabled.has(routePath)) {
    return false;
  }

  const disabled = parseRouteSet(env.DISABLED_HTTP_ROUTES);
  if (disabled && disabled.has(routePath)) {
    return false;
  }

  return true;
}

async function parseBody(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return request.json();
  }
  const text = await request.text();
  return text;
}

async function enqueueAsyncTask(env: Env, task: QueueTask) {
  await env.AUTOMATION_QUEUE.send(task);
  return json({
    accepted: true,
    traceId: task.traceId,
    routePath: task.routePath,
    queuedAt: task.enqueuedAt
  }, { status: 202 });
}

async function runSyncTask(env: Env, task: QueueTask) {
  const response = await env.WORKFLOW_SERVICE.fetch("http://workflow.internal/run-sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(task)
  });

  if (!response.ok) {
    const errorText = await response.text();
    return json(
      {
        traceId: task.traceId,
        error: "sync execution failed",
        details: errorText
      },
      { status: 500 }
    );
  }

  const payload = await response.json();
  if (isSyncHttpPassthrough(payload)) {
    return new Response(payload.body, {
      status: payload.status,
      headers: payload.headers
    });
  }

  return json({ traceId: task.traceId, result: payload });
}

async function enqueueManualScheduleTask(request: Request, env: Env, scheduleId: string) {
  const manifest = resolveRuntimeManifest(env);
  const schedule = manifest.schedules.find((item) => item.id === scheduleId && item.enabled);
  if (!schedule) {
    return json({ error: "unknown schedule", scheduleId }, { status: 404 });
  }

  const traceId = readTraceId(request);
  const now = new Date().toISOString();

  if (await isDuplicateDelivery(env.DB, traceId)) {
    return json({ accepted: true, duplicate: true, traceId, scheduleId }, { status: 202 });
  }

  const task: QueueTask = {
    kind: "scheduled_job",
    traceId,
    scheduleId: schedule.id,
    payload: {
      target: schedule.target,
      cron: schedule.cron,
      timeZone: schedule.timeZone,
      scheduledTime: now,
      trigger: "manual_api"
    },
    enqueuedAt: now
  };

  await markIdempotent(env.DB, traceId);
  await env.AUTOMATION_QUEUE.send(task);

  return json(
    {
      accepted: true,
      traceId,
      scheduleId: schedule.id,
      enqueuedAt: now,
      trigger: "manual_api"
    },
    { status: 202 }
  );
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const manifest = resolveRuntimeManifest(env);
    const respond = (response: Response) => withCors(response, request);
    const legacyRoutePath = legacyRouteFromUrl(url);

    if (request.method === "OPTIONS" && url.pathname.startsWith("/api/")) {
      return respond(new Response(null, { status: 204 }));
    }

    if (url.pathname === "/api/health") {
      return respond(json({ ok: true, env: env.ENV_NAME, worker: "api" }));
    }

    if (legacyRoutePath || url.pathname.startsWith("/api/r/")) {
      const traceId = readTraceId(request);
      await alertLegacyEndpointHit(request, url, env, traceId, legacyRoutePath);
      return respond(
        json(
          {
            error: "legacy endpoint is disabled",
            traceId,
            routePath: legacyRoutePath || null
          },
          { status: 404 }
        )
      );
    }

    if (request.method !== "POST") {
      return respond(json({ error: "method not allowed" }, { status: 405 }));
    }

    if (!isIngressAuthorized(request, env)) {
      return respond(json({ error: "unauthorized" }, { status: 401 }));
    }

    const rateLimit = checkRateLimit(request, env);
    if (!rateLimit.allowed) {
      return respond(
        json(
          {
            error: "rate limit exceeded",
            retryAfterSeconds: rateLimit.retryAfterSeconds
          },
          {
            status: 429,
            headers: {
              "retry-after": String(rateLimit.retryAfterSeconds)
            }
          }
        )
      );
    }

    const signatureValidation = await validateIngressSignature(request, env);
    if (!signatureValidation.valid) {
      return respond(
        json(
          {
            error: "invalid signature",
            reason: signatureValidation.reason
          },
          { status: 401 }
        )
      );
    }

    const devScheduleId = devCronScheduleIdFromUrl(url);
    if (devScheduleId) {
      return respond(await enqueueManualScheduleTask(request, env, devScheduleId));
    }

    const routePath = routeFromUrl(url);
    if (!routePath) {
      return respond(json({ error: "unknown route", hint: "Use POST /api/{route}" }, { status: 404 }));
    }

    const route = manifest.routes.find((item) => item.routePath === routePath);
    if (!route) {
      return respond(json({ error: "unknown route", routePath }, { status: 404 }));
    }
    if (!isRouteEnabled(routePath, env)) {
      return respond(json({ error: "unknown route", routePath }, { status: 404 }));
    }

    const traceId = readTraceId(request);
    if (await isDuplicateDelivery(env.DB, traceId)) {
      return respond(json({ accepted: true, duplicate: true, traceId }, { status: 202 }));
    }

    const rawPayload = await parseBody(request);
    const payload = route.wrapBody ? { body: rawPayload } : rawPayload;

    const task: QueueTask = {
      kind: "http_route",
      traceId,
      routePath: route.routePath,
      payload,
      enqueuedAt: new Date().toISOString()
    };

    await markIdempotent(env.DB, traceId);

    if (route.requestType === "async") {
      return respond(await enqueueAsyncTask(env, task));
    }
    return respond(await runSyncTask(env, task));
  }
};
