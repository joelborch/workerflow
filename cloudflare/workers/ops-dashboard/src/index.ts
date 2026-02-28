import { recordAuditEvent } from "../../../shared/db";
import { json } from "../../../shared/http";
import { resolveRuntimeManifest } from "../../../shared/manifest";
import {
  listOAuthTokens,
  oauthTokenNeedsRefresh,
  redactToken,
  upsertOAuthToken
} from "../../../shared/oauth_tokens";
import { checkTaskReplayEnablement } from "../../../shared/task_enablement";
import type { QueueTask, RouteDefinition, ScheduleDefinition } from "../../../shared/types";
import { readWorkspaceId, workspaceFilterValue } from "../../../shared/workspace";

type Env = {
  DB: D1Database;
  AUTOMATION_QUEUE: Queue<QueueTask>;
  WORKFLOW_SERVICE?: Fetcher;
  ENV_NAME: string;
  OPS_DASHBOARD_TOKEN?: string;
  OPS_DASHBOARD_READ_TOKEN?: string;
  OPS_DASHBOARD_WRITE_TOKEN?: string;
  OPS_DASHBOARD_EXTENSIONS_JSON?: string;
  MANIFEST_MODE?: string;
  ROUTES_CONFIG_JSON?: string;
  SCHEDULES_CONFIG_JSON?: string;
  ENABLED_HTTP_ROUTES?: string;
  DISABLED_HTTP_ROUTES?: string;
  API_RATE_LIMIT_PER_MINUTE?: string;
  API_ROUTE_LIMITS_JSON?: string;
  DEFAULT_WORKSPACE_ID?: string;
};

type SummaryStatusRow = {
  status: string;
  count: number | string;
};

type SummaryTopRouteRow = {
  routePath: string;
  count: number | string;
};

type CatalogRouteCountRow = {
  routePath: string;
  succeeded: number | string;
  failed: number | string;
  started: number | string;
  total: number | string;
};

type CatalogScheduleCountRow = {
  scheduleId: string;
  succeeded: number | string;
  failed: number | string;
  started: number | string;
  total: number | string;
};

type RunRow = {
  traceId: string;
  workspaceId: string | null;
  kind: string;
  routePath: string | null;
  scheduleId: string | null;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  output: string | null;
  error: string | null;
};

type DeadLetterRow = {
  id: number;
  traceId: string;
  workspaceId: string | null;
  payloadJson: string;
  error: string;
  createdAt: string;
};

type ReplayRow = {
  parentTraceId: string;
  childTraceId: string;
  sourceDeadLetterId: number | null;
  retryCount: number;
  createdAt: string;
  parentStatus: string | null;
  childStatus: string | null;
  childError: string | null;
};

type TimelineRow = {
  bucket: string;
  status: string;
  count: number | string;
};

type TimelineScopeRow = {
  bucket: string;
  scope: string;
  count: number | string;
};

type TimelineDetailStatusRow = {
  status: string;
  count: number | string;
};

type TimelineDetailRunRow = {
  traceId: string;
  workspaceId: string | null;
  kind: string;
  routePath: string | null;
  scheduleId: string | null;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  error: string | null;
};

type FailureErrorRow = {
  routePath: string | null;
  scheduleId: string | null;
  workspaceId: string | null;
  error: string;
  startedAt: string;
};

type WorkflowTemplate = {
  id: string;
  name: string;
  category: string;
  description: string;
  routes: string[];
  schedules: string[];
};

type DashboardExtension = {
  id: string;
  label: string;
  description?: string;
  docsUrl?: string;
};

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;
const MAX_TIME_WINDOW_MS = 31 * 24 * 60 * 60 * 1000;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 250;
const MAX_FILTER_LEN = 120;
const DEFAULT_WORKSPACE = "default";
const CONNECTOR_SECRETS: Array<{ id: string; requiredSecrets: string[]; routes: string[] }> = [
  {
    id: "slack",
    requiredSecrets: ["SLACK_WEBHOOK_URL"],
    routes: ["slack_message"]
  },
  {
    id: "github",
    requiredSecrets: ["GITHUB_TOKEN"],
    routes: ["github_issue_create"]
  },
  {
    id: "openai",
    requiredSecrets: ["OPENAI_API_KEY"],
    routes: ["openai_chat"]
  },
  {
    id: "stripe",
    requiredSecrets: ["STRIPE_API_KEY"],
    routes: ["stripe_payment_intent_create", "stripe_customer_upsert"]
  },
  {
    id: "notion",
    requiredSecrets: ["NOTION_TOKEN"],
    routes: ["notion_database_item_create", "notion_database_item_get"]
  },
  {
    id: "hubspot",
    requiredSecrets: ["HUBSPOT_ACCESS_TOKEN"],
    routes: ["hubspot_contact_upsert", "hubspot_deal_upsert"]
  }
];

const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: "lead-capture-normalize",
    name: "Lead Capture + Normalize",
    category: "Sales",
    description: "Capture inbound webhook leads and normalize payload shape.",
    routes: ["webhook_echo", "lead_normalizer"],
    schedules: []
  },
  {
    id: "incident-to-slack",
    name: "Incident To Slack",
    category: "Ops",
    description: "Create incident payload and push chat/slack alerts.",
    routes: ["incident_create", "chat_notify", "slack_message"],
    schedules: []
  },
  {
    id: "github-ticket-on-failure",
    name: "GitHub Ticket On Failure",
    category: "Engineering",
    description: "Create GitHub issue for failed automation traces.",
    routes: ["github_issue_create"],
    schedules: ["retry_dead_letters_hourly"]
  },
  {
    id: "openai-summary-to-chat",
    name: "OpenAI Summary To Chat",
    category: "AI",
    description: "Generate summary via OpenAI and send to chat channel.",
    routes: ["openai_chat", "chat_notify"],
    schedules: []
  },
  {
    id: "stripe-customer-sync",
    name: "Stripe Customer Sync",
    category: "Finance",
    description: "Upsert Stripe customer records from inbound events.",
    routes: ["stripe_customer_upsert"],
    schedules: []
  },
  {
    id: "stripe-intent-create",
    name: "Stripe Intent Create",
    category: "Finance",
    description: "Create payment intents from internal order payloads.",
    routes: ["stripe_payment_intent_create"],
    schedules: []
  },
  {
    id: "notion-database-ingest",
    name: "Notion Database Ingest",
    category: "Knowledge",
    description: "Write automation outcomes into Notion database rows.",
    routes: ["notion_database_item_create"],
    schedules: []
  },
  {
    id: "hubspot-contact-enrichment",
    name: "HubSpot Contact Enrichment",
    category: "Sales",
    description: "Upsert HubSpot contacts and deals from normalized leads.",
    routes: ["hubspot_contact_upsert", "hubspot_deal_upsert"],
    schedules: []
  }
];
const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#c9572f"/>
      <stop offset="100%" stop-color="#8d2f14"/>
    </linearGradient>
  </defs>
  <rect x="2" y="2" width="60" height="60" rx="14" fill="#f8efe0" stroke="#d8cdb8" stroke-width="3"/>
  <circle cx="32" cy="32" r="16" fill="none" stroke="url(#g)" stroke-width="6"/>
  <circle cx="32" cy="32" r="4" fill="#8d2f14"/>
  <path d="M32 10v8M32 46v8M10 32h8M46 32h8M16 16l6 6M42 42l6 6M48 16l-6 6M22 42l-6 6" stroke="#8d2f14" stroke-width="3" stroke-linecap="round"/>
</svg>`;

function parseLimit(rawLimit: string | null) {
  if (!rawLimit) {
    return DEFAULT_LIMIT;
  }

  const parsed = Number.parseInt(rawLimit, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_LIMIT;
  }

  return Math.min(parsed, MAX_LIMIT);
}

function sanitizeFilterValue(value: string | null) {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  return trimmed.slice(0, MAX_FILTER_LEN);
}

function readWorkspaceFilter(url: URL) {
  return workspaceFilterValue(url.searchParams.get("workspace"), null);
}

function withWorkspaceClause(
  baseClauses: string[],
  bindings: unknown[],
  workspaceId: string | null,
  column = "workspace_id"
) {
  if (!workspaceId) {
    return;
  }
  baseClauses.push(`${column} = ?${bindings.length + 1}`);
  bindings.push(workspaceId);
}

function parseRouteRateLimitConfig(env: Env) {
  const raw = env.API_ROUTE_LIMITS_JSON?.trim();
  if (!raw) {
    return {} as Record<string, { rpm: number; burst: number }>;
  }
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {} as Record<string, { rpm: number; burst: number }>;
    }
    const output: Record<string, { rpm: number; burst: number }> = {};
    for (const [routePath, value] of Object.entries(parsed)) {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        continue;
      }
      const candidate = value as Record<string, unknown>;
      const rpm = typeof candidate.rpm === "number" ? Math.floor(candidate.rpm) : 0;
      const burst = typeof candidate.burst === "number" ? Math.floor(candidate.burst) : 0;
      if (rpm > 0) {
        output[routePath] = { rpm, burst: Math.max(0, burst) };
      }
    }
    return output;
  } catch {
    return {} as Record<string, { rpm: number; burst: number }>;
  }
}

async function parseJsonBody(request: Request) {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function actorFromRequest(request: Request) {
  const authHeader = request.headers.get("authorization") || request.headers.get("x-dashboard-token") || "";
  if (!authHeader) {
    return "dashboard:anonymous";
  }
  const trimmed = authHeader.trim();
  const short = trimmed.length > 12 ? `${trimmed.slice(0, 8)}...` : trimmed;
  return `dashboard:${short}`;
}

async function safeAuditEvent(
  env: Env,
  request: Request,
  input: {
    workspaceId?: string;
    action: string;
    resourceType: string;
    resourceId?: string | null;
    details?: Record<string, unknown>;
  }
) {
  try {
    await recordAuditEvent(env.DB, {
      workspaceId: input.workspaceId,
      actor: actorFromRequest(request),
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      details: input.details
    });
  } catch {
    // audit logging is best-effort and should not block control-plane actions
  }
}

function parseIsoTimestamp(value: string | null) {
  const normalized = sanitizeFilterValue(value);
  if (!normalized) {
    return null;
  }

  const timestamp = Date.parse(normalized);
  if (!Number.isFinite(timestamp)) {
    return null;
  }

  return new Date(timestamp).toISOString();
}

function parseRequestedHours(value: string | null) {
  const normalized = sanitizeFilterValue(value);
  if (!normalized) {
    return null;
  }

  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return null;
  }

  return Math.min(parsed, Math.floor(MAX_TIME_WINDOW_MS / ONE_HOUR_MS));
}

function resolveTimeRange(url: URL, defaultWindowMs = TWENTY_FOUR_HOURS_MS) {
  const nowMs = Date.now();
  const requestedHours = parseRequestedHours(url.searchParams.get("hours"));
  const requestedWindowMs = requestedHours ? requestedHours * ONE_HOUR_MS : defaultWindowMs;

  const parsedSince = parseIsoTimestamp(url.searchParams.get("since"));
  const parsedUntil = parseIsoTimestamp(url.searchParams.get("until"));

  let sinceMs: number;
  let untilMs: number;

  if (parsedSince && parsedUntil) {
    sinceMs = Date.parse(parsedSince);
    untilMs = Date.parse(parsedUntil);
  } else if (parsedSince) {
    sinceMs = Date.parse(parsedSince);
    untilMs = nowMs;
  } else if (parsedUntil) {
    untilMs = Date.parse(parsedUntil);
    sinceMs = untilMs - requestedWindowMs;
  } else {
    untilMs = nowMs;
    sinceMs = untilMs - requestedWindowMs;
  }

  untilMs = Math.min(untilMs, nowMs);
  if (!Number.isFinite(sinceMs) || !Number.isFinite(untilMs) || sinceMs >= untilMs) {
    untilMs = nowMs;
    sinceMs = untilMs - defaultWindowMs;
  }

  const windowMs = Math.max(ONE_HOUR_MS, Math.min(MAX_TIME_WINDOW_MS, untilMs - sinceMs));
  sinceMs = untilMs - windowMs;

  return {
    since: new Date(sinceMs).toISOString(),
    until: new Date(untilMs).toISOString(),
    windowHours: Number((windowMs / ONE_HOUR_MS).toFixed(1))
  };
}

function readAuthToken(request: Request) {
  const tokenHeader = request.headers.get("x-dashboard-token");
  if (tokenHeader && tokenHeader.trim().length > 0) {
    return tokenHeader.trim();
  }

  const authorization = request.headers.get("authorization");
  if (!authorization) {
    return undefined;
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (match?.[1]) {
    return match[1].trim();
  }

  return authorization.trim();
}

type DashboardAccess = "none" | "read" | "write";

function dashboardAccess(request: Request, env: Env): DashboardAccess {
  const writeToken = env.OPS_DASHBOARD_WRITE_TOKEN?.trim() || env.OPS_DASHBOARD_TOKEN?.trim() || "";
  const readToken = env.OPS_DASHBOARD_READ_TOKEN?.trim() || writeToken;

  if (!readToken && !writeToken) {
    return "write";
  }

  const providedToken = readAuthToken(request);
  if (!providedToken) {
    return "none";
  }

  if (writeToken && providedToken === writeToken) {
    return "write";
  }

  if (readToken && providedToken === readToken) {
    return "read";
  }

  return "none";
}

function unauthorizedResponse() {
  return json(
    {
      error: "unauthorized",
      message:
        "Provide Authorization: Bearer <OPS_DASHBOARD_WRITE_TOKEN|OPS_DASHBOARD_READ_TOKEN|OPS_DASHBOARD_TOKEN> or x-dashboard-token"
    },
    {
      status: 401,
      headers: {
        "www-authenticate": "Bearer"
      }
    }
  );
}

function forbiddenResponse() {
  return json(
    {
      error: "forbidden",
      message: "Write operations require OPS_DASHBOARD_WRITE_TOKEN (or OPS_DASHBOARD_TOKEN)"
    },
    { status: 403 }
  );
}

function isDashboardExtension(value: unknown): value is DashboardExtension {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<DashboardExtension>;
  if (typeof candidate.id !== "string" || candidate.id.trim().length === 0) {
    return false;
  }
  if (typeof candidate.label !== "string" || candidate.label.trim().length === 0) {
    return false;
  }
  if (candidate.description !== undefined && typeof candidate.description !== "string") {
    return false;
  }
  if (candidate.docsUrl !== undefined && typeof candidate.docsUrl !== "string") {
    return false;
  }
  return true;
}

function readDashboardExtensions(env: Env): DashboardExtension[] {
  const raw = env.OPS_DASHBOARD_EXTENSIONS_JSON;
  if (!raw || raw.trim().length === 0) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.filter(isDashboardExtension);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function toCount(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
}

function durationMs(startedAt: string, finishedAt: string | null) {
  if (!finishedAt) {
    return null;
  }

  const started = Date.parse(startedAt);
  const finished = Date.parse(finishedAt);
  if (!Number.isFinite(started) || !Number.isFinite(finished)) {
    return null;
  }

  return Math.max(0, finished - started);
}

function percentile(values: number[], p: number) {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index] ?? null;
}

function formatDuration(ms: number | null) {
  if (ms === null) {
    return null;
  }

  if (ms < 1000) {
    return `${ms}ms`;
  }

  if (ms < 60_000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }

  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
}

function routePath(url: URL) {
  const normalized = url.pathname.replace(/\/+$/, "");
  return normalized.length === 0 ? "/" : normalized;
}

function retryTraceIdFromPath(pathname: string) {
  const match = pathname.match(/^\/api\/retry\/([^/]+)$/);
  if (!match?.[1]) {
    return undefined;
  }

  return decodeURIComponent(match[1]);
}

function replayTraceIdFromPath(pathname: string) {
  const match = pathname.match(/^\/api\/replay\/([^/]+)$/);
  if (!match?.[1]) {
    return undefined;
  }

  return decodeURIComponent(match[1]);
}

function routePathFromDetailPath(pathname: string) {
  const match = pathname.match(/^\/api\/route-detail\/([^/]+)$/);
  if (!match?.[1]) {
    return undefined;
  }

  return decodeURIComponent(match[1]);
}

function scheduleIdFromDetailPath(pathname: string) {
  const match = pathname.match(/^\/api\/cron-detail\/([^/]+)$/);
  if (!match?.[1]) {
    return undefined;
  }

  return decodeURIComponent(match[1]);
}

function scheduleIdFromRunPath(pathname: string) {
  const match = pathname.match(/^\/api\/cron-run\/([^/]+)$/);
  if (!match?.[1]) {
    return undefined;
  }

  return decodeURIComponent(match[1]);
}

function traceIdFromRunDetailPath(pathname: string) {
  const match = pathname.match(/^\/api\/run-detail\/([^/]+)$/);
  if (!match?.[1]) {
    return undefined;
  }

  return decodeURIComponent(match[1]);
}

function isQueueTask(value: unknown): value is QueueTask {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<QueueTask>;
  if (candidate.kind !== "http_route" && candidate.kind !== "scheduled_job") {
    return false;
  }

  if (!candidate.traceId || typeof candidate.traceId !== "string") {
    return false;
  }

  if (!candidate.enqueuedAt || typeof candidate.enqueuedAt !== "string") {
    return false;
  }

  if (candidate.kind === "http_route" && typeof candidate.routePath !== "string") {
    return false;
  }

  if (candidate.kind === "scheduled_job" && typeof candidate.scheduleId !== "string") {
    return false;
  }

  return true;
}

function normalizeErrorForCluster(error: string) {
  return error
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, "{url}")
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi, "{uuid}")
    .replace(/\b\d{3,}\b/g, "{n}")
    .replace(/"[^"]{8,}"/g, '"{str}"')
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 260);
}

function mapWeekdayToken(value: number) {
  if (value === 7) {
    return 0;
  }
  return value;
}

function parseCronField(field: string, min: number, max: number) {
  if (field === "*") {
    return null;
  }

  if (!/^\d+$/.test(field)) {
    return undefined;
  }

  const parsed = Number.parseInt(field, 10);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    return undefined;
  }

  return parsed;
}

function getZonedParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short"
  });

  const parts = formatter.formatToParts(date);
  const lookup = new Map(parts.map((part) => [part.type, part.value]));
  const weekdayText = (lookup.get("weekday") ?? "Sun").slice(0, 3);
  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6
  };

  return {
    minute: Number(lookup.get("minute") ?? "0"),
    hour: Number(lookup.get("hour") ?? "0"),
    day: Number(lookup.get("day") ?? "1"),
    month: Number(lookup.get("month") ?? "1"),
    dayOfWeek: dayMap[weekdayText] ?? 0
  };
}

function computeNextRun(cron: string, timeZone: string) {
  const fields = cron.trim().split(/\s+/);
  if (fields.length !== 5) {
    return null;
  }

  const minute = parseCronField(fields[0] ?? "", 0, 59);
  const hour = parseCronField(fields[1] ?? "", 0, 23);
  const dayOfMonth = parseCronField(fields[2] ?? "", 1, 31);
  const month = parseCronField(fields[3] ?? "", 1, 12);
  const dayOfWeekRaw = parseCronField(fields[4] ?? "", 0, 7);

  if (
    minute === undefined ||
    hour === undefined ||
    dayOfMonth === undefined ||
    month === undefined ||
    dayOfWeekRaw === undefined
  ) {
    return null;
  }

  const dayOfWeek = dayOfWeekRaw === null ? null : mapWeekdayToken(dayOfWeekRaw);
  const now = Date.now();
  const maxLookaheadMinutes = 60 * 24 * 45;

  for (let offset = 1; offset <= maxLookaheadMinutes; offset += 1) {
    const candidate = new Date(now + offset * 60_000);
    const zoned = getZonedParts(candidate, timeZone);

    if (minute !== null && zoned.minute !== minute) {
      continue;
    }
    if (hour !== null && zoned.hour !== hour) {
      continue;
    }
    if (dayOfMonth !== null && zoned.day !== dayOfMonth) {
      continue;
    }
    if (month !== null && zoned.month !== month) {
      continue;
    }
    if (dayOfWeek !== null && zoned.dayOfWeek !== dayOfWeek) {
      continue;
    }

    return candidate.toISOString();
  }

  return null;
}

function parseTimelineResolution(raw: string | null) {
  return sanitizeFilterValue(raw) === "minute" ? "minute" : "hour";
}

function getTimelineBucketExpr(resolution: "hour" | "minute") {
  return resolution === "minute"
    ? `substr(started_at, 1, 16) || ':00Z'`
    : `substr(started_at, 1, 13) || ':00:00Z'`;
}

function timelineBucketWindowMs(resolution: "hour" | "minute") {
  return resolution === "minute" ? 60_000 : 60 * 60_000;
}

function timelineBucketRange(bucket: string, resolution: "hour" | "minute") {
  const startMs = Date.parse(bucket);
  if (!Number.isFinite(startMs)) {
    return null;
  }

  const endMs = startMs + timelineBucketWindowMs(resolution);
  return {
    startIso: new Date(startMs).toISOString(),
    endIso: new Date(endMs).toISOString()
  };
}

function buildDashboardHtml(env: Env) {
  const authEnabled = false;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>WorkerFlow Cloudflare Ops</title>
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
    <style>
      :root {
        --bg: #f4eee1;
        --panel: #fff9ef;
        --ink: #181611;
        --ink-faded: #4b4435;
        --accent: #b6451f;
        --accent-soft: #f2c5a6;
        --ok: #1f7a37;
        --warn: #ad5f00;
        --bad: #a72121;
        --border: #d8cdb8;
        --shadow: 0 20px 40px rgba(31, 24, 14, 0.12);
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        min-height: 100vh;
        font-family: "IBM Plex Mono", Menlo, monospace;
        color: var(--ink);
        background:
          radial-gradient(circle at 15% 20%, rgba(255, 236, 205, 0.8), transparent 40%),
          radial-gradient(circle at 80% 0%, rgba(255, 208, 170, 0.7), transparent 35%),
          linear-gradient(180deg, #f7f1e6 0%, #f1e8d8 100%);
      }

      .shell {
        max-width: 1320px;
        margin: 0 auto;
        padding: 24px 16px 42px;
      }

      .masthead {
        border: 1px solid var(--border);
        background: var(--panel);
        box-shadow: var(--shadow);
        border-radius: 24px;
        padding: 18px;
        display: grid;
        gap: 14px;
      }

      .masthead h1 {
        margin: 0;
        font-family: "Fraunces", Georgia, serif;
        font-size: clamp(1.7rem, 2.4vw, 2.8rem);
        letter-spacing: 0.02em;
        line-height: 1.03;
      }

      .masthead-meta {
        color: var(--ink-faded);
        font-size: 0.92rem;
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      .toolbar {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
      }

      .status-banner {
        margin-top: 4px;
        border-radius: 12px;
        border: 1px solid var(--border);
        padding: 8px 10px;
        font-size: 0.78rem;
        color: var(--ink-faded);
        background: rgba(255, 249, 239, 0.8);
      }

      .status-banner.error {
        border-color: rgba(167, 33, 33, 0.4);
        background: rgba(255, 234, 234, 0.8);
        color: var(--bad);
      }

      .status-banner.ok {
        border-color: rgba(31, 122, 55, 0.28);
        background: rgba(235, 255, 240, 0.7);
        color: var(--ok);
      }

      .tabs {
        margin-top: 14px;
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .tab-btn.active {
        background: linear-gradient(180deg, #ffd9b7, #f4b889);
        border-color: #c88654;
      }

      .panel-grid {
        margin-top: 16px;
        display: grid;
        gap: 16px;
      }

      .tab-panel { display: none; }
      .tab-panel.active { display: block; }

      .summary-grid {
        display: grid;
        gap: 10px;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      }

      .card {
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 16px;
        padding: 14px;
        box-shadow: var(--shadow);
      }

      .label {
        color: var(--ink-faded);
        font-size: 0.78rem;
        text-transform: uppercase;
        letter-spacing: 0.07em;
      }

      .value {
        margin-top: 6px;
        font-family: "Fraunces", Georgia, serif;
        font-size: 1.7rem;
      }

      .status-ok { color: var(--ok); }
      .status-warn { color: var(--warn); }
      .status-bad { color: var(--bad); }

      .section {
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 16px;
        padding: 16px;
        box-shadow: var(--shadow);
      }

      .section + .section {
        margin-top: 12px;
      }

      .section-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
        margin-bottom: 12px;
      }

      h2 {
        margin: 0;
        font-family: "Fraunces", Georgia, serif;
        font-size: 1.3rem;
      }

      h3 {
        margin: 0;
        font-family: "Fraunces", Georgia, serif;
        font-size: 1rem;
      }

      .controls {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .control-line {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin-bottom: 8px;
      }

      input, select, button, textarea {
        border: 1px solid var(--border);
        border-radius: 10px;
        padding: 8px 10px;
        background: #fffdf8;
        color: var(--ink);
        font: inherit;
      }

      button {
        cursor: pointer;
        background: linear-gradient(180deg, #fff2df, #fbd9b7);
        border-color: #d9af89;
        transition: transform 130ms ease, box-shadow 130ms ease;
      }

      button:hover {
        transform: translateY(-1px);
        box-shadow: 0 8px 16px rgba(131, 81, 42, 0.2);
      }

      button:disabled {
        opacity: 0.6;
        cursor: default;
        transform: none;
        box-shadow: none;
      }

      .tables {
        overflow-x: auto;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        min-width: 900px;
      }

      th, td {
        text-align: left;
        border-bottom: 1px solid var(--border);
        padding: 8px 6px;
        vertical-align: top;
        font-size: 0.84rem;
      }

      th {
        color: var(--ink-faded);
        text-transform: uppercase;
        letter-spacing: 0.06em;
        font-size: 0.72rem;
        position: sticky;
        top: 0;
        background: var(--panel);
        z-index: 1;
      }

      .mono {
        font-family: "IBM Plex Mono", Menlo, monospace;
        word-break: break-word;
      }

      .pill {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 999px;
        border: 1px solid var(--border);
      }

      .muted { color: var(--ink-faded); }
      .error { color: var(--bad); white-space: pre-wrap; }

      .status-chip-succeeded { color: var(--ok); border-color: rgba(31, 122, 55, 0.35); }
      .status-chip-started, .status-chip-running { color: var(--warn); border-color: rgba(173, 95, 0, 0.35); }
      .status-chip-failed { color: var(--bad); border-color: rgba(167, 33, 33, 0.35); }

      .stack { display: grid; gap: 12px; }

      .top-routes {
        margin: 0;
        padding-left: 18px;
        display: grid;
        gap: 4px;
      }

      .timeline-shell {
        position: relative;
        display: grid;
        gap: 10px;
        grid-template-columns: minmax(0, 1fr) minmax(260px, 340px);
        align-items: start;
      }

      .timeline-main {
        min-width: 0;
      }

      .timeline-chart {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(10px, 1fr));
        gap: 3px;
        align-items: end;
        min-height: 120px;
      }

      .timeline-bar {
        position: relative;
        border-radius: 4px;
        border: 1px solid var(--border);
        overflow: hidden;
        min-height: 8px;
        background: #fff;
        display: flex;
        flex-direction: column-reverse;
      }

      .timeline-bar.is-pinned {
        box-shadow: inset 0 0 0 2px #6b2c11;
      }

      .timeline-bar.is-anomaly::after {
        content: "";
        position: absolute;
        top: 2px;
        right: 2px;
        width: 6px;
        height: 6px;
        border-radius: 999px;
        background: var(--bad);
        box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.9);
      }

      .timeline-seg {
        width: 100%;
        border: 0;
        padding: 0;
        margin: 0;
        min-height: 2px;
        cursor: pointer;
      }

      .timeline-seg-succeeded { background: rgba(31, 122, 55, 0.75); }
      .timeline-seg-failed { background: rgba(167, 33, 33, 0.75); }
      .timeline-seg-running { background: rgba(173, 95, 0, 0.75); }

      .timeline-labels {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        color: var(--ink-faded);
        font-size: 0.72rem;
        margin-top: 6px;
      }

      .timeline-detail {
        border: 1px solid var(--border);
        border-radius: 12px;
        background: #fffefb;
        padding: 10px;
        min-height: 120px;
        display: grid;
        gap: 8px;
      }

      .timeline-detail table {
        min-width: 0;
      }

      .timeline-tooltip {
        position: fixed;
        z-index: 60;
        max-width: min(380px, 88vw);
        pointer-events: none;
        background: rgba(21, 18, 13, 0.94);
        color: #fff7ea;
        border: 1px solid rgba(255, 212, 168, 0.3);
        border-radius: 10px;
        box-shadow: 0 14px 26px rgba(0, 0, 0, 0.35);
        padding: 8px 10px;
        font-size: 0.75rem;
        line-height: 1.4;
        display: none;
        white-space: normal;
      }

      .timeline-tooltip strong {
        color: #ffd39c;
      }

      .timeline-related-highlight {
        border-color: #c5561f !important;
      }

      tr.timeline-related-highlight td {
        background: rgba(255, 230, 204, 0.75) !important;
      }

      .incident-card-grid {
        display: grid;
        gap: 10px;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      }

      .incident-card {
        position: relative;
        border: 1px solid rgba(167, 33, 33, 0.28);
        border-radius: 14px;
        padding: 12px;
        background:
          linear-gradient(180deg, rgba(255, 247, 240, 0.96), rgba(255, 237, 232, 0.94)),
          repeating-linear-gradient(
            90deg,
            rgba(255, 255, 255, 0.35) 0px,
            rgba(255, 255, 255, 0.35) 8px,
            rgba(255, 255, 255, 0.18) 8px,
            rgba(255, 255, 255, 0.18) 16px
          );
        box-shadow: 0 10px 18px rgba(138, 66, 38, 0.12);
      }

      .incident-card::before {
        content: "";
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 4px;
        border-radius: 14px 0 0 14px;
        background: linear-gradient(180deg, #cf5a2d, #a8321d);
      }

      .incident-card-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }

      .incident-card-count {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        border: 1px solid rgba(167, 33, 33, 0.34);
        border-radius: 999px;
        padding: 2px 10px;
        color: var(--bad);
        background: rgba(255, 255, 255, 0.8);
        font-size: 0.74rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }

      .incident-card-title {
        font-family: "Fraunces", Georgia, serif;
        font-size: 1rem;
        margin: 0;
      }

      .incident-card-scope {
        margin-top: 8px;
        padding: 6px 8px;
        border: 1px dashed rgba(137, 70, 44, 0.35);
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.5);
      }

      .incident-card-scope .mono {
        font-size: 0.78rem;
      }

      .incident-card > .muted {
        margin-top: 8px;
        font-size: 0.74rem;
      }

      .incident-card-sample {
        margin-top: 8px;
        border: 1px solid rgba(167, 33, 33, 0.22);
        border-radius: 10px;
        padding: 8px;
        background: rgba(255, 252, 250, 0.86);
        font-size: 0.75rem;
        line-height: 1.4;
        max-height: 105px;
        overflow: auto;
        white-space: pre-wrap;
        word-break: break-word;
      }

      .incident-grid {
        display: grid;
        gap: 12px;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      }

      .hotspot-table td:nth-child(1),
      .hotspot-table td:nth-child(2),
      .hotspot-table td:nth-child(3) {
        white-space: nowrap;
      }

      .preset-row {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
      }

      .drawer {
        position: fixed;
        top: 0;
        right: -680px;
        width: min(680px, 100vw);
        height: 100vh;
        background: #fffdf8;
        border-left: 1px solid var(--border);
        box-shadow: -12px 0 24px rgba(0,0,0,0.14);
        transition: right 200ms ease;
        z-index: 40;
        overflow: auto;
      }

      .drawer.open { right: 0; }

      .drawer-head {
        position: sticky;
        top: 0;
        padding: 12px;
        border-bottom: 1px solid var(--border);
        background: #fffdf8;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }

      .drawer-body {
        padding: 12px;
        display: grid;
        gap: 10px;
      }

      .drawer pre {
        background: #f8f1e8;
        border: 1px solid var(--border);
        border-radius: 10px;
        padding: 10px;
        overflow: auto;
        margin: 0;
      }

      .run-expanded {
        background: #fcf6ec;
      }

      .run-row-failed td {
        background: rgba(255, 234, 234, 0.55);
      }

      .run-row-started td {
        background: rgba(255, 244, 226, 0.65);
      }

      .run-cockpit {
        display: grid;
        gap: 14px;
      }

      .run-kpis {
        display: grid;
        gap: 8px;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      }

      .run-kpi {
        border: 1px solid var(--border);
        border-radius: 12px;
        background: #fffef9;
        padding: 10px;
      }

      .run-kpi .value {
        font-size: 1.2rem;
        margin-top: 4px;
      }

      .filter-rail {
        display: grid;
        gap: 8px;
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 10px;
        background: rgba(255, 250, 243, 0.9);
      }

      .filter-row {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        align-items: center;
      }

      .filter-chip {
        border-radius: 999px;
        padding: 5px 10px;
        background: #fff;
        border: 1px solid var(--border);
      }

      .run-grid {
        display: grid;
        grid-template-columns: minmax(0, 1.4fr) minmax(280px, 1fr);
        gap: 12px;
        align-items: start;
      }

      .run-list-panel,
      .run-inspector {
        border: 1px solid var(--border);
        border-radius: 12px;
        background: #fffdf8;
        overflow: hidden;
      }

      .run-list-head,
      .run-inspector-head {
        border-bottom: 1px solid var(--border);
        padding: 10px;
        background: linear-gradient(180deg, #fff8ec, #fff2e0);
      }

      .run-list-head {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        align-items: center;
      }

      .run-list-table {
        max-height: 560px;
        overflow: auto;
      }

      .run-list-table table {
        min-width: 720px;
      }

      .run-list-table th:nth-child(1) {
        width: 280px;
      }

      .run-list-table th:nth-child(3) {
        width: 220px;
      }

      .run-trace-cell {
        display: flex;
        align-items: center;
        gap: 6px;
        white-space: nowrap;
      }

      .run-trace-value {
        display: inline-block;
        max-width: 210px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .copy-trace {
        flex: 0 0 auto;
        border-radius: 999px;
        padding: 2px 7px;
        font-size: 0.68rem;
        line-height: 1.2;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        background: #fffef8;
      }

      .run-row-selected td {
        background: rgba(255, 229, 193, 0.75) !important;
      }

      .run-click {
        cursor: pointer;
      }

      .inspector-tabs {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
        margin-top: 8px;
      }

      .inspector-tab {
        border-radius: 999px;
        padding: 4px 10px;
        border: 1px solid var(--border);
        background: #fff8ee;
      }

      .inspector-tab.active {
        background: linear-gradient(180deg, #ffd7b3, #f5b987);
        border-color: #cf8853;
      }

      .inspector-body {
        padding: 10px;
        display: grid;
        gap: 10px;
        min-height: 420px;
      }

      .inspector-code {
        border: 1px solid var(--border);
        border-radius: 10px;
        background: #fbf3e8;
        padding: 10px;
        white-space: pre-wrap;
        word-break: break-word;
        max-height: 420px;
        overflow: auto;
      }

      .inspector-grid {
        display: grid;
        gap: 8px;
      }

      .inspector-row {
        display: grid;
        grid-template-columns: 130px minmax(0, 1fr);
        gap: 8px;
        align-items: start;
      }

      @media (max-width: 820px) {
        .shell { padding: 16px 10px 28px; }
        table { min-width: 740px; }
        .timeline-shell {
          grid-template-columns: 1fr;
        }
        .run-grid {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body data-auth-required="${authEnabled ? "1" : "0"}">
    <main class="shell">
      <section class="masthead">
        <div>
          <h1>WorkerFlow Cloudflare Ops Deck</h1>
          <div class="masthead-meta">
            <span>Environment: <strong>${escapeHtml(env.ENV_NAME)}</strong></span>
            <span>Window: <strong>Last 24 hours</strong></span>
            <span id="last-refresh">Refreshed: never</span>
          </div>
        </div>
        <div class="toolbar">
          <label><input id="incident-toggle" type="checkbox" /> Incident Mode</label>
          <button id="refresh-all" type="button">Refresh All</button>
        </div>
        <div class="status-banner" id="status-banner">Waiting for first refresh...</div>
      </section>

      <nav class="tabs" id="tabs">
        <button class="tab-btn active" data-tab="overview">Overview</button>
        <button class="tab-btn" data-tab="incidents">Incidents</button>
        <button class="tab-btn" data-tab="routes">HTTP Routes</button>
        <button class="tab-btn" data-tab="crons">Cron Jobs</button>
        <button class="tab-btn" data-tab="runs">Runs</button>
        <button class="tab-btn" data-tab="deadletters">Dead Letters</button>
        <button class="tab-btn" data-tab="replays">Replays</button>
      </nav>

      <div class="panel-grid">
        <section class="tab-panel active" id="tab-overview">
          <section class="section">
            <div class="section-head">
              <h2>Summary</h2>
            </div>
            <div class="summary-grid" id="summary-cards"></div>
            <div class="stack" style="margin-top: 10px;">
              <div>
                <div class="label">Top Routes (24h)</div>
                <ol id="top-routes" class="top-routes muted"></ol>
              </div>
            </div>
          </section>

          <section class="section">
            <div class="section-head">
              <h2>Run Timeline</h2>
              <div class="controls">
                <select id="timeline-bucket">
                  <option value="hour">Hourly</option>
                  <option value="minute">Minute</option>
                </select>
                <button id="refresh-timeline" type="button">Reload Timeline</button>
              </div>
            </div>
            <div class="timeline-shell">
              <div class="timeline-main">
                <div id="timeline-chart" class="timeline-chart"></div>
                <div id="timeline-labels" class="timeline-labels"></div>
              </div>
              <aside id="timeline-detail" class="timeline-detail muted">Hover a bar to inspect a bucket. Click to pin.</aside>
            </div>
          </section>

          <section class="section">
            <div class="section-head">
              <h2>Error Clusters</h2>
              <div class="controls">
                <button id="refresh-clusters" type="button">Reload Clusters</button>
              </div>
            </div>
            <div id="error-clusters" class="stack muted"></div>
            <div class="incident-card-grid" id="incident-cards"></div>
          </section>

          <section class="section">
            <div class="section-head">
              <h2>Secrets Health</h2>
              <div class="controls">
                <button id="refresh-secrets-health" type="button">Reload</button>
              </div>
            </div>
            <div id="secrets-health" class="stack muted"></div>
          </section>
        </section>

        <section class="tab-panel" id="tab-incidents">
          <section class="section">
            <div class="section-head">
              <h2>Incident Snapshot</h2>
              <div class="controls">
                <button id="refresh-incidents" type="button">Reload Incident Data</button>
              </div>
            </div>
            <div id="incident-kpis" class="incident-grid"></div>
          </section>

          <section class="section">
            <div class="section-head">
              <h2>Failure Hotspots (24h)</h2>
            </div>
            <div class="tables">
              <table class="hotspot-table">
                <thead>
                  <tr>
                    <th>scope</th>
                    <th>type</th>
                    <th>failed</th>
                    <th>started</th>
                    <th>success</th>
                    <th>total</th>
                  </tr>
                </thead>
                <tbody id="incident-hotspots-body"></tbody>
              </table>
            </div>
          </section>

          <section class="section">
            <div class="section-head">
              <h2>Latest Failed Runs</h2>
            </div>
            <div class="tables">
              <table>
                <thead>
                  <tr>
                    <th>trace</th>
                    <th>kind</th>
                    <th>route/schedule</th>
                    <th>started</th>
                    <th>duration</th>
                    <th>error</th>
                  </tr>
                </thead>
                <tbody id="incident-failed-runs"></tbody>
              </table>
            </div>
          </section>
        </section>

        <section class="tab-panel" id="tab-routes">
          <section class="section">
            <div class="section-head">
              <h2>Routes Catalog</h2>
              <div class="controls">
                <button id="refresh-routes" type="button">Reload Catalog</button>
              </div>
            </div>
            <div class="tables">
              <table>
                <thead>
                  <tr>
                    <th>route</th>
                    <th>type</th>
                    <th>flow</th>
                    <th>24h (ok/fail/running)</th>
                    <th>detail</th>
                  </tr>
                </thead>
                <tbody id="routes-body"></tbody>
              </table>
            </div>
          </section>

          <section class="section">
            <div class="section-head">
              <h2>Flows</h2>
            </div>
            <div class="tables">
              <table>
                <thead>
                  <tr>
                    <th>flow target</th>
                    <th>http</th>
                    <th>cron</th>
                    <th>24h</th>
                  </tr>
                </thead>
                <tbody id="flows-body"></tbody>
              </table>
            </div>
          </section>
        </section>

        <section class="tab-panel" id="tab-crons">
          <section class="section">
            <div class="section-head">
              <h2>Cron Catalog</h2>
              <div class="controls">
                <button id="refresh-crons" type="button">Reload Cron Catalog</button>
              </div>
            </div>
            <div class="tables">
              <table>
                <thead>
                  <tr>
                    <th>schedule id</th>
                    <th>cron</th>
                    <th>target</th>
                    <th>24h (ok/fail/running)</th>
                    <th>actions</th>
                  </tr>
                </thead>
                <tbody id="cron-body"></tbody>
              </table>
            </div>
          </section>
        </section>

        <section class="tab-panel" id="tab-runs">
          <section class="section">
            <div class="section-head">
              <h2>Runs Cockpit</h2>
            </div>
            <div class="run-cockpit">
              <div class="run-kpis" id="runs-kpis"></div>
              <div class="filter-rail">
                <div class="filter-row">
                  <select id="runs-status">
                    <option value="">All status</option>
                    <option value="succeeded">succeeded</option>
                    <option value="failed">failed</option>
                    <option value="started">started</option>
                  </select>
                  <select id="runs-kind">
                    <option value="">All kind</option>
                    <option value="http_route">http_route</option>
                    <option value="scheduled_job">scheduled_job</option>
                  </select>
                  <input id="runs-route" type="text" placeholder="route path" />
                  <input id="runs-schedule" type="text" placeholder="schedule id" />
                  <input id="runs-limit" type="number" min="1" max="250" value="80" />
                  <button id="refresh-runs" type="button">Refresh Runs</button>
                </div>
                <div class="filter-row">
                  <button class="preset-filter filter-chip" data-preset="all">All</button>
                  <button class="preset-filter filter-chip" data-preset="failed">Failed</button>
                  <button class="preset-filter filter-chip" data-preset="http">HTTP</button>
                  <button class="preset-filter filter-chip" data-preset="cron">Cron</button>
                  <button class="preset-filter filter-chip" data-preset="running">Running</button>
                </div>
              </div>

              <div class="run-grid">
                <section class="run-list-panel">
                  <div class="run-list-head">
                    <strong>Recent Runs</strong>
                    <span id="runs-count" class="muted">0 loaded</span>
                  </div>
                  <div class="run-list-table">
                    <table>
                      <thead>
                        <tr>
                          <th>trace</th>
                          <th>kind</th>
                          <th>route/schedule</th>
                          <th>status</th>
                          <th>started</th>
                          <th>duration</th>
                          <th>error</th>
                        </tr>
                      </thead>
                      <tbody id="runs-body"></tbody>
                    </table>
                  </div>
                </section>

                <section class="run-inspector">
                  <div class="run-inspector-head">
                    <strong id="inspector-title">Run Inspector</strong>
                    <div class="inspector-tabs" id="inspector-tabs">
                      <button class="inspector-tab active" data-tab="overview" type="button">Overview</button>
                      <button class="inspector-tab" data-tab="input" type="button">Input</button>
                      <button class="inspector-tab" data-tab="output" type="button">Output</button>
                      <button class="inspector-tab" data-tab="error" type="button">Error</button>
                      <button class="inspector-tab" data-tab="retries" type="button">Retries</button>
                    </div>
                  </div>
                  <div class="inspector-body" id="inspector-body">
                    <div class="muted">Select a run row to inspect details.</div>
                  </div>
                </section>
              </div>
            </div>
          </section>
        </section>

        <section class="tab-panel" id="tab-deadletters">
          <section class="section">
            <div class="section-head">
              <h2>Dead Letters</h2>
              <div class="controls">
                <input id="dead-letters-limit" type="number" min="1" max="250" value="50" />
                <button id="refresh-dead-letters" type="button">Load Dead Letters</button>
              </div>
            </div>
            <div class="tables">
              <table>
                <thead>
                  <tr>
                    <th>id</th>
                    <th>trace</th>
                    <th>created</th>
                    <th>error</th>
                    <th>action</th>
                  </tr>
                </thead>
                <tbody id="dead-letters-body"></tbody>
              </table>
            </div>
          </section>
        </section>

        <section class="tab-panel" id="tab-replays">
          <section class="section">
            <div class="section-head">
              <h2>Replay Center</h2>
              <div class="controls">
                <input id="replays-limit" type="number" min="1" max="250" value="100" />
                <button id="refresh-replays" type="button">Load Replays</button>
              </div>
            </div>
            <div class="tables">
              <table>
                <thead>
                  <tr>
                    <th>parent trace</th>
                    <th>attempts</th>
                    <th>latest child</th>
                    <th>latest status</th>
                    <th>latest retry time</th>
                  </tr>
                </thead>
                <tbody id="replays-body"></tbody>
              </table>
            </div>
          </section>
        </section>
      </div>
    </main>

    <aside class="drawer" id="detail-drawer" aria-hidden="true">
      <div class="drawer-head">
        <strong id="drawer-title">Details</strong>
        <button id="drawer-close" type="button">Close</button>
      </div>
      <div class="drawer-body" id="drawer-body"></div>
    </aside>
    <div id="timeline-tooltip" class="timeline-tooltip" aria-hidden="true"></div>

    <script>
      if (window.__wmOpsDashboardBooted) {
        // no-op
      } else {
        window.__wmOpsDashboardBooted = true;

        const state = {
          activeTab: "overview",
          incidentMode: false,
          summary: null,
          routes: [],
          schedules: [],
          clusters: [],
          failedRuns: [],
          runs: [],
          selectedRunTraceId: null,
          selectedRunDetail: null,
          inspectorTab: "overview",
          timeline: {
            resolution: "hour",
            items: [],
            focusedBucket: null,
            pinnedBucket: null,
            focusedSegment: null,
            detailCache: new Map(),
            detailPending: new Map(),
            activeDetail: null
          }
        };

        const summaryCards = document.getElementById("summary-cards");
        const topRoutes = document.getElementById("top-routes");
        const routesBody = document.getElementById("routes-body");
        const cronBody = document.getElementById("cron-body");
        const flowsBody = document.getElementById("flows-body");
        const runsBody = document.getElementById("runs-body");
        const runsKpis = document.getElementById("runs-kpis");
        const runsCount = document.getElementById("runs-count");
        const inspectorTitle = document.getElementById("inspector-title");
        const inspectorBody = document.getElementById("inspector-body");
        const deadLettersBody = document.getElementById("dead-letters-body");
        const replaysBody = document.getElementById("replays-body");
        const timelineChart = document.getElementById("timeline-chart");
        const timelineLabels = document.getElementById("timeline-labels");
        const timelineDetail = document.getElementById("timeline-detail");
        const timelineTooltip = document.getElementById("timeline-tooltip");
        const errorClusters = document.getElementById("error-clusters");
        const incidentCards = document.getElementById("incident-cards");
        const incidentKpis = document.getElementById("incident-kpis");
        const incidentHotspotsBody = document.getElementById("incident-hotspots-body");
        const incidentFailedRuns = document.getElementById("incident-failed-runs");
        const secretsHealth = document.getElementById("secrets-health");
        const statusBanner = document.getElementById("status-banner");
        const lastRefresh = document.getElementById("last-refresh");
        const drawer = document.getElementById("detail-drawer");
        const drawerTitle = document.getElementById("drawer-title");
        const drawerBody = document.getElementById("drawer-body");

        function setStatusBanner(text, statusClass) {
          statusBanner.classList.remove("ok", "error");
          if (statusClass) {
            statusBanner.classList.add(statusClass);
          }
          statusBanner.textContent = text;
        }

        async function fetchJson(url, init = {}) {
          const response = await fetch(url, init);
          const contentType = (response.headers.get("content-type") || "").toLowerCase();
          if (!contentType.includes("application/json")) {
            const redirectedToAccess = response.url.includes("/cdn-cgi/access/login");
            const hint = redirectedToAccess
              ? "Cloudflare Access blocked this /api request. Ensure your Access policy covers /api/*."
              : \`Non-JSON response from \${url} (\${response.status}).\`;
            throw new Error(hint);
          }

          const data = await response.json().catch(() => ({}));
          if (!response.ok) {
            const message = data && data.error
              ? \`\${data.error}\${data.message ? \`: \${data.message}\` : ""}\${data.reason ? \` (\${data.reason})\` : ""}\`
              : \`request failed (\${response.status})\`;
            throw new Error(message);
          }

          return data;
        }

        function formatTs(value) {
          if (!value) {
            return "-";
          }
          const date = new Date(value);
          if (Number.isNaN(date.getTime())) {
            return value;
          }
          return date.toLocaleString();
        }

        function formatRelative(value) {
          if (!value) {
            return "-";
          }
          const date = new Date(value);
          if (Number.isNaN(date.getTime())) {
            return "-";
          }

          const diffMs = Date.now() - date.getTime();
          const sign = diffMs >= 0 ? "ago" : "from now";
          const abs = Math.abs(diffMs);
          if (abs < 60_000) return \`\${Math.round(abs / 1000)}s \${sign}\`;
          if (abs < 3_600_000) return \`\${Math.round(abs / 60_000)}m \${sign}\`;
          if (abs < 86_400_000) return \`\${Math.round(abs / 3_600_000)}h \${sign}\`;
          return \`\${Math.round(abs / 86_400_000)}d \${sign}\`;
        }

        function formatError(error) {
          const text = String(error || "");
          if (!text) {
            return "-";
          }
          return text.length > 160 ? text.slice(0, 157) + "..." : text;
        }

        function escapeText(value) {
          return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
        }

        function statusChipClass(status) {
          const value = String(status || "").toLowerCase();
          if (value === "succeeded") return "status-chip-succeeded";
          if (value === "failed") return "status-chip-failed";
          if (value === "started" || value === "running") return "status-chip-started";
          return "";
        }

        function runRowClass(status) {
          const value = String(status || "").toLowerCase();
          if (value === "failed") return "run-row-failed";
          if (value === "started" || value === "running") return "run-row-started";
          return "";
        }

        function readUiStateFromUrl() {
          const params = new URLSearchParams(window.location.search);
          return {
            tab: params.get("tab") || "",
            status: params.get("status") || "",
            kind: params.get("kind") || "",
            routePath: params.get("routePath") || "",
            scheduleId: params.get("scheduleId") || "",
            limit: params.get("limit") || "",
            timelineBucket: params.get("timelineBucket") || "",
            selectedTrace: params.get("trace") || "",
            inspectorTab: params.get("inspectorTab") || ""
          };
        }

        function writeUiStateToUrl() {
          const params = new URLSearchParams(window.location.search);
          const status = document.getElementById("runs-status").value.trim();
          const kind = document.getElementById("runs-kind").value.trim();
          const routePath = document.getElementById("runs-route").value.trim();
          const scheduleId = document.getElementById("runs-schedule").value.trim();
          const limit = document.getElementById("runs-limit").value.trim();
          const timelineBucket = document.getElementById("timeline-bucket").value.trim();

          if (state.activeTab) params.set("tab", state.activeTab); else params.delete("tab");
          if (status) params.set("status", status); else params.delete("status");
          if (kind) params.set("kind", kind); else params.delete("kind");
          if (routePath) params.set("routePath", routePath); else params.delete("routePath");
          if (scheduleId) params.set("scheduleId", scheduleId); else params.delete("scheduleId");
          if (limit) params.set("limit", limit); else params.delete("limit");
          if (timelineBucket) params.set("timelineBucket", timelineBucket); else params.delete("timelineBucket");
          if (state.selectedRunTraceId) params.set("trace", state.selectedRunTraceId); else params.delete("trace");
          if (state.inspectorTab) params.set("inspectorTab", state.inspectorTab); else params.delete("inspectorTab");

          const next = params.toString();
          const nextUrl = next ? \`\${window.location.pathname}?\${next}\` : window.location.pathname;
          window.history.replaceState({}, "", nextUrl);
        }

        function applyUiStateFromUrl() {
          const saved = readUiStateFromUrl();
          if (saved.tab && document.getElementById(\`tab-\${saved.tab}\`)) {
            state.activeTab = saved.tab;
          }
          if (saved.status) document.getElementById("runs-status").value = saved.status;
          if (saved.kind) document.getElementById("runs-kind").value = saved.kind;
          if (saved.routePath) document.getElementById("runs-route").value = saved.routePath;
          if (saved.scheduleId) document.getElementById("runs-schedule").value = saved.scheduleId;
          if (saved.limit && /^[0-9]+$/.test(saved.limit)) document.getElementById("runs-limit").value = saved.limit;
          if (saved.timelineBucket === "minute" || saved.timelineBucket === "hour") {
            document.getElementById("timeline-bucket").value = saved.timelineBucket;
          }
          if (saved.selectedTrace) {
            state.selectedRunTraceId = saved.selectedTrace;
          }
          if (saved.inspectorTab && ["overview", "input", "output", "error", "retries"].includes(saved.inspectorTab)) {
            state.inspectorTab = saved.inspectorTab;
          }
        }

        function setInspectorTab(tab) {
          state.inspectorTab = tab;
          document.querySelectorAll(".inspector-tab").forEach((button) => {
            if (!(button instanceof HTMLElement)) return;
            button.classList.toggle("active", button.dataset.tab === tab);
          });
          writeUiStateToUrl();
          renderRunInspector();
        }

        function renderRunsKpis() {
          const runs = state.runs || [];
          const totals = runs.reduce((acc, run) => {
            const status = String(run.status || "");
            acc.total += 1;
            if (status === "failed") acc.failed += 1;
            if (status === "succeeded") acc.succeeded += 1;
            if (status === "started" || status === "running") acc.running += 1;
            return acc;
          }, { total: 0, failed: 0, succeeded: 0, running: 0 });

          const failRate = totals.total > 0 ? ((totals.failed / totals.total) * 100).toFixed(1) : "0.0";
          runsKpis.innerHTML = [
            { label: "Loaded Runs", value: totals.total, className: "" },
            { label: "Succeeded", value: totals.succeeded, className: "status-ok" },
            { label: "Failed", value: totals.failed, className: totals.failed > 0 ? "status-bad" : "status-ok" },
            { label: "Running", value: totals.running, className: totals.running > 0 ? "status-warn" : "" },
            { label: "Fail Rate", value: \`\${failRate}%\`, className: Number(failRate) >= 20 ? "status-bad" : Number(failRate) > 0 ? "status-warn" : "status-ok" }
          ].map((item) => \`
            <article class="run-kpi">
              <div class="label">\${escapeText(item.label)}</div>
              <div class="value \${escapeText(item.className)}">\${escapeText(item.value)}</div>
            </article>
          \`).join("");
        }

        async function loadRunDetail(traceId) {
          if (!traceId) {
            state.selectedRunDetail = null;
            renderRunInspector();
            return null;
          }
          const detail = await fetchJson(\`/api/run-detail/\${encodeURIComponent(traceId)}\`);
          state.selectedRunDetail = detail;
          renderRunInspector();
          return detail;
        }

        async function selectRun(traceId) {
          state.selectedRunTraceId = traceId || null;
          writeUiStateToUrl();
          renderRuns(state.runs || []);
          if (!traceId) {
            state.selectedRunDetail = null;
            renderRunInspector();
            return;
          }
          inspectorBody.innerHTML = '<div class="muted">Loading run detail...</div>';
          try {
            await loadRunDetail(traceId);
          } catch (error) {
            const message = error && error.message ? error.message : String(error);
            inspectorBody.innerHTML = \`<div class="error">Failed to load run detail: \${escapeText(message)}</div>\`;
          }
        }

        function renderRunInspector() {
          const detail = state.selectedRunDetail;
          const run = detail?.run;
          inspectorTitle.textContent = run ? \`Run Inspector: \${run.traceId}\` : "Run Inspector";
          if (!run) {
            inspectorBody.innerHTML = '<div class="muted">Select a run row to inspect details.</div>';
            return;
          }

          const tab = state.inspectorTab || "overview";
          if (tab === "overview") {
            inspectorBody.innerHTML = \`
              <div class="inspector-grid">
                <div class="inspector-row"><div class="label">Trace</div><div class="mono">\${escapeText(run.traceId)}</div></div>
                <div class="inspector-row"><div class="label">Kind</div><div>\${escapeText(run.kind)}</div></div>
                <div class="inspector-row"><div class="label">Scope</div><div class="mono">\${escapeText(run.routePath || run.scheduleId || "-")}</div></div>
                <div class="inspector-row"><div class="label">Status</div><div><span class="pill \${statusChipClass(run.status)}">\${escapeText(run.status)}</span></div></div>
                <div class="inspector-row"><div class="label">Started</div><div>\${escapeText(formatTs(run.startedAt))}</div></div>
                <div class="inspector-row"><div class="label">Finished</div><div>\${escapeText(formatTs(run.finishedAt))}</div></div>
                <div class="inspector-row"><div class="label">Duration</div><div>\${escapeText(run.duration || "-")}</div></div>
              </div>
            \`;
            return;
          }

          if (tab === "input") {
            const payload = detail?.deadLetter?.payloadJson || "Input payload not available for this run.";
            inspectorBody.innerHTML = \`<pre class="inspector-code">\${escapeText(payload)}</pre>\`;
            return;
          }

          if (tab === "output") {
            const output = run.output || "No output captured.";
            inspectorBody.innerHTML = \`<pre class="inspector-code">\${escapeText(output)}</pre>\`;
            return;
          }

          if (tab === "error") {
            const err = run.error || "No error for this run.";
            inspectorBody.innerHTML = \`<pre class="inspector-code">\${escapeText(err)}</pre>\`;
            return;
          }

          const attempts = detail?.retries?.attempts || [];
          if (attempts.length === 0) {
            inspectorBody.innerHTML = '<div class="muted">No retry lineage for this trace.</div>';
            return;
          }
          inspectorBody.innerHTML = \`
            <div class="tables">
              <table>
                <thead><tr><th>attempt</th><th>child trace</th><th>status</th><th>time</th></tr></thead>
                <tbody>
                  \${attempts.map((attempt) => \`
                    <tr>
                      <td>\${escapeText(attempt.retryCount)}</td>
                      <td class="mono">\${escapeText(attempt.childTraceId)}</td>
                      <td><span class="pill \${statusChipClass(attempt.childStatus || "")}">\${escapeText(attempt.childStatus || "-")}</span></td>
                      <td>\${escapeText(formatTs(attempt.createdAt))}</td>
                    </tr>
                  \`).join("")}
                </tbody>
              </table>
            </div>
          \`;
        }

        function timelineKey(bucket) {
          return \`\${state.timeline.resolution}:\${bucket}\`;
        }

        function timelineRangeForBucket(bucket) {
          const start = Date.parse(bucket);
          if (!Number.isFinite(start)) {
            return null;
          }
          const widthMs = state.timeline.resolution === "minute" ? 60_000 : 60 * 60_000;
          return {
            startMs: start,
            endMs: start + widthMs
          };
        }

        function isRunInBucket(startedAt, bucket) {
          const range = timelineRangeForBucket(bucket);
          if (!range) {
            return false;
          }
          const runStart = Date.parse(startedAt || "");
          if (!Number.isFinite(runStart)) {
            return false;
          }
          return runStart >= range.startMs && runStart < range.endMs;
        }

        function hideTimelineTooltip() {
          timelineTooltip.style.display = "none";
          timelineTooltip.setAttribute("aria-hidden", "true");
        }

        function showTimelineTooltip(html, pointerEvent) {
          if (!pointerEvent) {
            return;
          }

          timelineTooltip.innerHTML = html;
          timelineTooltip.style.display = "block";
          timelineTooltip.setAttribute("aria-hidden", "false");

          const margin = 12;
          const maxLeft = window.innerWidth - timelineTooltip.offsetWidth - margin;
          const maxTop = window.innerHeight - timelineTooltip.offsetHeight - margin;
          const left = Math.min(
            Math.max(margin, pointerEvent.clientX + 14),
            Math.max(margin, maxLeft)
          );
          const top = Math.min(
            Math.max(margin, pointerEvent.clientY + 14),
            Math.max(margin, maxTop)
          );
          timelineTooltip.style.left = \`\${left}px\`;
          timelineTooltip.style.top = \`\${top}px\`;
        }

        function setTimelineFocusStyles() {
          const pinned = state.timeline.pinnedBucket;

          document.querySelectorAll(".timeline-bar").forEach((bar) => {
            if (!(bar instanceof HTMLElement)) {
              return;
            }
            const bucket = bar.dataset.bucket || "";
            bar.classList.toggle("is-pinned", bucket.length > 0 && bucket === pinned);
          });
        }

        function clearTimelineRelatedHighlights() {
          document.querySelectorAll(".timeline-related-highlight").forEach((node) => {
            node.classList.remove("timeline-related-highlight");
          });
        }

        function applyTimelineCrossHighlights(detail) {
          clearTimelineRelatedHighlights();
          if (!detail || !detail.window || !detail.topScopes) {
            return;
          }

          const startMs = Date.parse(detail.window.start);
          const endMs = Date.parse(detail.window.end);
          if (Number.isFinite(startMs) && Number.isFinite(endMs)) {
            document.querySelectorAll("#runs-body tr[data-started-at]").forEach((row) => {
              if (!(row instanceof HTMLElement)) {
                return;
              }
              const runStart = Date.parse(row.dataset.startedAt || "");
              if (!Number.isFinite(runStart)) {
                return;
              }
              if (runStart >= startMs && runStart < endMs) {
                row.classList.add("timeline-related-highlight");
              }
            });
          }

          const scopes = new Set((detail.topScopes || []).map((item) => String(item.scope || "")));
          if (scopes.size === 0) {
            return;
          }

          document.querySelectorAll(".error-cluster-card").forEach((card) => {
            if (!(card instanceof HTMLElement)) {
              return;
            }
            const scope = card.dataset.scope || "";
            if (scopes.has(scope)) {
              card.classList.add("timeline-related-highlight");
            }
          });
        }

        function renderTimelineDetail(detail, source) {
          if (!detail) {
            timelineDetail.classList.add("muted");
            timelineDetail.innerHTML = '<div class="muted">Hover a bar to inspect a bucket. Click to pin.</div>';
            return;
          }

          const status = detail.statusCounts || {};
          const total = Number(status.total || 0);
          const failed = Number(status.failed || 0);
          const running = Number(status.running || 0);
          const succeeded = Number(status.succeeded || 0);
          const failRate = total > 0 ? ((failed / total) * 100).toFixed(1) : "0.0";
          const topScopes = (detail.topScopes || [])
            .slice(0, 4)
            .map((item) => \`<li><span class="mono">\${escapeText(item.scope)}</span> <strong>\${escapeText(item.count)}</strong></li>\`)
            .join("");
          const runs = (detail.runs || [])
            .slice(0, 12)
            .map((run) => \`
              <tr>
                <td class="mono">\${escapeText(run.traceId)}</td>
                <td>\${escapeText(run.status)}</td>
                <td class="mono">\${escapeText(run.routePath || run.scheduleId || "-")}</td>
              </tr>
            \`)
            .join("");

          timelineDetail.classList.remove("muted");
          timelineDetail.innerHTML = \`
            <div class="label">\${source === "pinned" ? "Pinned Bucket" : "Focused Bucket"}</div>
            <div><strong>\${escapeText(detail.bucket)}</strong></div>
            <div class="muted">Window: \${escapeText(formatTs(detail.window.start))} - \${escapeText(formatTs(detail.window.end))}</div>
            <div class="muted">Total \${escapeText(total)} | <span class="status-ok">ok \${escapeText(succeeded)}</span> | <span class="status-bad">failed \${escapeText(failed)}</span> | <span class="status-warn">running \${escapeText(running)}</span> | fail rate \${escapeText(failRate)}%</div>
            <div>
              <div class="label">Top Failure Scopes</div>
              <ol class="top-routes">\${topScopes || '<li class="muted">No failures in this bucket.</li>'}</ol>
            </div>
            <div class="tables">
              <table>
                <thead><tr><th>trace</th><th>status</th><th>scope</th></tr></thead>
                <tbody>\${runs || '<tr><td colspan="3" class="muted">No runs in bucket.</td></tr>'}</tbody>
              </table>
            </div>
          \`;
        }

        async function getTimelineDetail(bucket) {
          const key = timelineKey(bucket);
          if (state.timeline.detailCache.has(key)) {
            return state.timeline.detailCache.get(key);
          }

          if (state.timeline.detailPending.has(key)) {
            return state.timeline.detailPending.get(key);
          }

          const params = new URLSearchParams({
            bucket,
            resolution: state.timeline.resolution,
            limit: "120"
          });
          const detailPromise = fetchJson(\`/api/timeline-detail?\${params.toString()}\`)
            .then((detail) => {
              state.timeline.detailCache.set(key, detail);
              state.timeline.detailPending.delete(key);
              return detail;
            })
            .catch((error) => {
              state.timeline.detailPending.delete(key);
              throw error;
            });

          state.timeline.detailPending.set(key, detailPromise);
          return detailPromise;
        }

        function buildTimelineTooltipHtml(item, segment) {
          const segmentName = segment || "succeeded";
          const failRate = item.total > 0 ? ((item.failed / item.total) * 100).toFixed(1) : "0.0";
          const segmentCount = segmentName === "failed"
            ? item.failed
            : segmentName === "running"
              ? item.running
              : item.succeeded;
          const segmentRate = item.total > 0 ? ((segmentCount / item.total) * 100).toFixed(1) : "0.0";
          const scopeText = item.topFailureScope
            ? \`Top failing scope: \${item.topFailureScope} (\${item.topFailureCount})\`
            : "No failing scope in this bucket";
          return \`<strong>\${escapeText(item.bucket)}</strong><br/>Total: \${escapeText(item.total)} | OK: \${escapeText(item.succeeded)} | Failed: \${escapeText(item.failed)} | Running: \${escapeText(item.running)}<br/>Fail rate: \${escapeText(failRate)}%<br/>Segment: <strong>\${escapeText(segmentName)}</strong> (\${escapeText(segmentCount)} / \${escapeText(segmentRate)}%)<br/>\${escapeText(scopeText)}\`;
        }

        async function focusTimelineBucket(bucket, segment, source, pointerEvent) {
          if (!bucket) {
            return;
          }

          const item = state.timeline.items.find((candidate) => candidate.bucket === bucket);
          if (item) {
            showTimelineTooltip(buildTimelineTooltipHtml(item, segment), pointerEvent);
          }

          if (source === "hover") {
            // Hover should only be lightweight tooltip UX; no detail fetch and no reflow-heavy highlighting.
            return;
          }

          const previouslyFocused = state.timeline.focusedBucket === bucket && state.timeline.focusedSegment === (segment || null);
          state.timeline.focusedBucket = bucket;
          state.timeline.focusedSegment = segment || null;
          if (source === "pinned") {
            state.timeline.pinnedBucket = bucket;
          }
          setTimelineFocusStyles();

          if (previouslyFocused && state.timeline.activeDetail && state.timeline.activeDetail.bucket === bucket) {
            applyTimelineCrossHighlights(state.timeline.activeDetail);
            return;
          }

          timelineDetail.innerHTML = '<div class="muted">Loading bucket detail...</div>';
          try {
            const detail = await getTimelineDetail(bucket);
            state.timeline.activeDetail = detail;
            renderTimelineDetail(detail, source);
            applyTimelineCrossHighlights(detail);
          } catch (error) {
            const message = error && error.message ? error.message : String(error);
            timelineDetail.classList.remove("muted");
            timelineDetail.innerHTML = \`<div class="error">Timeline detail failed: \${escapeText(message)}</div>\`;
            clearTimelineRelatedHighlights();
          }
        }

        function releaseTimelineHover() {
          hideTimelineTooltip();
          if (state.timeline.pinnedBucket) {
            state.timeline.focusedBucket = state.timeline.pinnedBucket;
            setTimelineFocusStyles();
            if (state.timeline.activeDetail) {
              applyTimelineCrossHighlights(state.timeline.activeDetail);
            }
            return;
          }

          state.timeline.focusedBucket = null;
          state.timeline.focusedSegment = null;
          state.timeline.activeDetail = null;
          setTimelineFocusStyles();
          clearTimelineRelatedHighlights();
          renderTimelineDetail(null, "hover");
        }

        function updateLastRefresh() {
          lastRefresh.textContent = \`Refreshed: \${new Date().toLocaleTimeString()}\`;
        }

        function openDrawer(title, html) {
          drawerTitle.textContent = title;
          drawerBody.innerHTML = html;
          drawer.classList.add("open");
          drawer.setAttribute("aria-hidden", "false");
        }

        function closeDrawer() {
          drawer.classList.remove("open");
          drawer.setAttribute("aria-hidden", "true");
        }

        function setActiveTab(tab, persist = true) {
          state.activeTab = tab;
          document.querySelectorAll(".tab-btn").forEach((button) => {
            button.classList.toggle("active", button.dataset.tab === tab);
          });
          document.querySelectorAll(".tab-panel").forEach((panel) => {
            panel.classList.toggle("active", panel.id === \`tab-\${tab}\`);
          });
          if (persist) {
            writeUiStateToUrl();
          }
        }

        function renderSummary(summary) {
          const cards = [
            { label: "Total Runs", value: summary.totalRuns, className: "" },
            { label: "Succeeded", value: summary.succeededRuns, className: "status-ok" },
            { label: "Failed", value: summary.failedRuns, className: "status-bad" },
            { label: "In Progress", value: summary.startedRuns, className: "status-warn" },
            { label: "Dead Letters", value: summary.deadLetters, className: summary.deadLetters > 0 ? "status-bad" : "status-ok" }
          ];

          summaryCards.innerHTML = cards.map((card) => \`
            <article class="card">
              <div class="label">\${card.label}</div>
              <div class="value \${card.className}">\${escapeText(card.value)}</div>
            </article>
          \`).join("");

          const routes = summary.topRoutes || [];
          if (routes.length === 0) {
            topRoutes.innerHTML = \`<li>No route activity in this window.</li>\`;
            return;
          }

          topRoutes.innerHTML = routes
            .map((item) => \`<li><span class="mono">\${escapeText(item.routePath)}</span> <strong>\${escapeText(item.count)}</strong></li>\`)
            .join("");
        }

        function formatRunTriplet(item) {
          const succeeded = Number(item.succeeded || 0);
          const failed = Number(item.failed || 0);
          const started = Number(item.started || 0);
          return \`<span class="status-ok">\${succeeded}</span>/<span class="status-bad">\${failed}</span>/<span class="status-warn">\${started}</span>\`;
        }

        function renderIncidentKpis() {
          const summary = state.summary || {
            totalRuns: 0,
            failedRuns: 0,
            startedRuns: 0,
            deadLetters: 0
          };

          const scopeCount = [...state.routes, ...state.schedules]
            .filter((item) => Number(item.failed || 0) > 0).length;
          const failRate = summary.totalRuns > 0
            ? \`\${((summary.failedRuns / summary.totalRuns) * 100).toFixed(1)}%\`
            : "0.0%";
          const topCluster = state.clusters[0];

          const cards = [
            { label: "Failure Rate", value: failRate, className: Number(summary.failedRuns) > 0 ? "status-bad" : "status-ok" },
            { label: "Failing Scopes", value: scopeCount, className: scopeCount > 0 ? "status-bad" : "status-ok" },
            { label: "Running Now", value: summary.startedRuns || 0, className: Number(summary.startedRuns) > 0 ? "status-warn" : "" },
            { label: "Dead Letters", value: summary.deadLetters || 0, className: Number(summary.deadLetters) > 0 ? "status-bad" : "status-ok" },
            { label: "Top Error Cluster", value: topCluster ? \`\${topCluster.count} hits\` : "none", className: topCluster ? "status-bad" : "status-ok" }
          ];

          incidentKpis.innerHTML = cards.map((card) => \`
            <article class="card">
              <div class="label">\${escapeText(card.label)}</div>
              <div class="value \${escapeText(card.className)}">\${escapeText(card.value)}</div>
            </article>
          \`).join("");
        }

        function renderIncidentHotspots() {
          const routeRows = state.routes.map((item) => ({
            scope: \`/api/\${item.routePath}\`,
            type: "http_route",
            failed: Number(item.failed || 0),
            started: Number(item.started || 0),
            succeeded: Number(item.succeeded || 0),
            total: Number(item.total || 0)
          }));

          const scheduleRows = state.schedules.map((item) => ({
            scope: item.id,
            type: "scheduled_job",
            failed: Number(item.failed || 0),
            started: Number(item.started || 0),
            succeeded: Number(item.succeeded || 0),
            total: Number(item.total || 0)
          }));

          const hotspots = [...routeRows, ...scheduleRows]
            .filter((item) => item.failed > 0 || item.started > 0)
            .sort((a, b) => b.failed - a.failed || b.started - a.started || b.total - a.total)
            .slice(0, 30);

          if (hotspots.length === 0) {
            incidentHotspotsBody.innerHTML = \`<tr><td colspan="6" class="muted">No active incident hotspots in the last 24h.</td></tr>\`;
            return;
          }

          incidentHotspotsBody.innerHTML = hotspots.map((item) => \`
            <tr>
              <td class="mono">\${escapeText(item.scope)}</td>
              <td>\${escapeText(item.type)}</td>
              <td class="status-bad">\${escapeText(item.failed)}</td>
              <td class="status-warn">\${escapeText(item.started)}</td>
              <td class="status-ok">\${escapeText(item.succeeded)}</td>
              <td>\${escapeText(item.total)}</td>
            </tr>
          \`).join("");
        }

        function renderFailedRuns() {
          const runs = state.failedRuns || [];
          if (runs.length === 0) {
            incidentFailedRuns.innerHTML = \`<tr><td colspan="6" class="muted">No failed runs in current query window.</td></tr>\`;
            return;
          }

          incidentFailedRuns.innerHTML = runs.map((run) => \`
            <tr class="run-row-failed">
              <td class="mono">\${escapeText(run.traceId)}</td>
              <td>\${escapeText(run.kind)}</td>
              <td class="mono">\${escapeText(run.routePath || run.scheduleId || "-")}</td>
              <td>\${escapeText(formatRelative(run.startedAt))}</td>
              <td>\${escapeText(run.duration || "-")}</td>
              <td><span class="error">\${escapeText(formatError(run.error))}</span></td>
            </tr>
          \`).join("");
        }

        async function loadCatalog() {
          const catalog = await fetchJson("/api/catalog");
          state.routes = catalog.routes || [];
          state.schedules = catalog.schedules || [];

          routesBody.innerHTML = state.routes.length === 0
            ? \`<tr><td colspan="5" class="muted">No routes in manifest.</td></tr>\`
            : state.routes.map((item) => \`
                <tr>
                  <td class="mono">/api/\${escapeText(item.routePath)}</td>
                  <td>\${escapeText(item.requestType)}</td>
                  <td class="mono">\${escapeText(item.flowPath)}</td>
                  <td class="mono">\${formatRunTriplet(item)}</td>
                  <td><button type="button" class="route-detail-btn" data-route="\${escapeText(item.routePath)}">Open</button></td>
                </tr>
              \`).join("");

          cronBody.innerHTML = state.schedules.length === 0
            ? \`<tr><td colspan="5" class="muted">No schedules in manifest.</td></tr>\`
            : state.schedules.map((item) => \`
                <tr>
                  <td class="mono">\${escapeText(item.id)}</td>
                  <td class="mono">\${escapeText(item.cron)}</td>
                  <td class="mono">\${escapeText(item.target)}</td>
                  <td class="mono">\${formatRunTriplet(item)}</td>
                  <td>
                    <button type="button" class="cron-detail-btn" data-schedule="\${escapeText(item.id)}">Details</button>
                    <button type="button" class="cron-run-btn" data-schedule="\${escapeText(item.id)}">Run now</button>
                  </td>
                </tr>
              \`).join("");

          flowsBody.innerHTML = (catalog.flows || []).length === 0
            ? \`<tr><td colspan="4" class="muted">No flows found.</td></tr>\`
            : (catalog.flows || []).map((item) => \`
                <tr>
                  <td class="mono">\${escapeText(item.flowPath)}</td>
                  <td>\${escapeText(item.httpRoutes.length)}</td>
                  <td>\${escapeText(item.schedules.length)}</td>
                  <td class="mono">\${formatRunTriplet(item)}</td>
                </tr>
              \`).join("");

          document.querySelectorAll(".route-detail-btn").forEach((button) => {
            button.addEventListener("click", () => openRouteDetail(button.dataset.route));
          });

          document.querySelectorAll(".cron-detail-btn").forEach((button) => {
            button.addEventListener("click", () => openCronDetail(button.dataset.schedule));
          });

          document.querySelectorAll(".cron-run-btn").forEach((button) => {
            button.addEventListener("click", () => triggerCronRun(button.dataset.schedule, button));
          });

          renderIncidentKpis();
          renderIncidentHotspots();
          return catalog;
        }

        async function openRouteDetail(routePath) {
          if (!routePath) {
            return;
          }

          try {
            const data = await fetchJson(\`/api/route-detail/\${encodeURIComponent(routePath)}\`);
            const errors = (data.errorClusters || []).map((item) => \`
              <li><strong>\${escapeText(item.count)}</strong> \${escapeText(item.sample)}</li>
            \`).join("");
            const errorsHtml = errors || '<li class="muted">No failures</li>';

            const recent = (data.recentRuns || []).map((run) => \`
              <tr>
                <td>\${formatTs(run.startedAt)}</td>
                <td>\${escapeText(run.status)}</td>
                <td>\${escapeText(run.duration || "-")}</td>
                <td class="mono">\${escapeText(run.traceId)}</td>
              </tr>
            \`).join("");
            const recentHtml = recent || '<tr><td colspan="4" class="muted">No runs</td></tr>';

            openDrawer(
              \`Route \${routePath}\`,
              \`
                <div class="card">
                  <div class="label">Flow</div>
                  <div class="mono">\${escapeText(data.route.flowPath)}</div>
                  <div style="margin-top:8px;" class="muted">24h: \${escapeText(data.metrics.succeeded)} succeeded, \${escapeText(data.metrics.failed)} failed, \${escapeText(data.metrics.started)} running</div>
                  <div class="muted">P95 duration: \${escapeText(data.metrics.p95Duration || "-")}</div>
                  <div class="muted">Last success: \${formatTs(data.metrics.lastSuccessAt)} (\${formatRelative(data.metrics.lastSuccessAt)})</div>
                  <div class="muted">Last failure: \${formatTs(data.metrics.lastFailureAt)} (\${formatRelative(data.metrics.lastFailureAt)})</div>
                </div>
                <div class="card">
                  <h3>Top Errors</h3>
                  <ul>\${errorsHtml}</ul>
                </div>
                <div class="card">
                  <h3>Recent Runs</h3>
                  <div class="tables">
                    <table>
                      <thead><tr><th>started</th><th>status</th><th>duration</th><th>trace</th></tr></thead>
                      <tbody>\${recentHtml}</tbody>
                    </table>
                  </div>
                </div>
              \`
            );
          } catch (error) {
            alert(\`Route detail failed: \${String(error.message || error)}\`);
          }
        }

        async function openCronDetail(scheduleId) {
          if (!scheduleId) {
            return;
          }

          try {
            const data = await fetchJson(\`/api/cron-detail/\${encodeURIComponent(scheduleId)}\`);
            const recent = (data.recentRuns || []).map((run) => \`
              <tr>
                <td>\${formatTs(run.startedAt)}</td>
                <td>\${escapeText(run.status)}</td>
                <td>\${escapeText(run.duration || "-")}</td>
                <td class="mono">\${escapeText(run.traceId)}</td>
              </tr>
            \`).join("");
            const recentHtml = recent || '<tr><td colspan="4" class="muted">No runs</td></tr>';

            openDrawer(
              \`Cron \${scheduleId}\`,
              \`
                <div class="card">
                  <div class="label">Schedule</div>
                  <div class="mono">\${escapeText(data.schedule.cron)} (\${escapeText(data.schedule.timeZone)})</div>
                  <div class="mono" style="margin-top:4px;">\${escapeText(data.schedule.target)}</div>
                  <div style="margin-top:8px;" class="muted">Last run: \${formatTs(data.metrics.lastRunAt)} (\${formatRelative(data.metrics.lastRunAt)})</div>
                  <div class="muted">Next run: \${formatTs(data.metrics.nextRunAt)} (\${formatRelative(data.metrics.nextRunAt)})</div>
                  <div class="muted">Last success: \${formatTs(data.metrics.lastSuccessAt)} (\${formatRelative(data.metrics.lastSuccessAt)})</div>
                  <div class="muted">Last failure: \${formatTs(data.metrics.lastFailureAt)} (\${formatRelative(data.metrics.lastFailureAt)})</div>
                  <div class="muted">P95 duration: \${escapeText(data.metrics.p95Duration || "-")}</div>
                  <div class="error" style="margin-top:8px;">\${escapeText(data.metrics.lastFailureError || "")}</div>
                  <div style="margin-top:8px;"><button id="drawer-run-now" type="button">Run now</button></div>
                </div>
                <div class="card">
                  <h3>Recent Runs</h3>
                  <div class="tables">
                    <table>
                      <thead><tr><th>started</th><th>status</th><th>duration</th><th>trace</th></tr></thead>
                      <tbody>\${recentHtml}</tbody>
                    </table>
                  </div>
                </div>
              \`
            );

            const button = document.getElementById("drawer-run-now");
            if (button) {
              button.addEventListener("click", () => triggerCronRun(scheduleId, button));
            }
          } catch (error) {
            alert(\`Cron detail failed: \${String(error.message || error)}\`);
          }
        }

        async function triggerCronRun(scheduleId, button) {
          if (!scheduleId) {
            return;
          }

          const targetButton = button || { disabled: false };
          targetButton.disabled = true;
          try {
            const result = await fetchJson(\`/api/cron-run/\${encodeURIComponent(scheduleId)}\`, { method: "POST" });
            alert(\`Manual run queued. Trace: \${result.traceId}\`);
            await Promise.all([loadRuns(), loadCatalog(), loadSummary(), loadFailedRuns()]);
          } catch (error) {
            alert(\`Run now failed: \${String(error.message || error)}\`);
          } finally {
            targetButton.disabled = false;
          }
        }

        function renderTimeline(payload) {
          const items = payload.buckets || [];
          state.timeline.resolution = payload.bucket === "minute" ? "minute" : "hour";
          state.timeline.items = items;
          state.timeline.detailCache.clear();
          state.timeline.detailPending.clear();
          state.timeline.activeDetail = null;

          if (items.length === 0) {
            timelineChart.innerHTML = \`<div class="muted">No data in selected window.</div>\`;
            timelineLabels.innerHTML = "";
            renderTimelineDetail(null, "hover");
            hideTimelineTooltip();
            return;
          }

          const maxTotal = Math.max(1, ...items.map((item) => item.total));
          timelineChart.innerHTML = items.map((item) => {
            const succeededH = Math.round((item.succeeded / maxTotal) * 120);
            const failedH = Math.round((item.failed / maxTotal) * 120);
            const runningH = Math.round((item.running / maxTotal) * 120);
            const failRate = item.total > 0 ? item.failed / item.total : 0;
            const isAnomaly = item.total >= 4 && failRate >= 0.3;
            const title = escapeText(\`\${item.bucket}: ok=\${item.succeeded} fail=\${item.failed} running=\${item.running}\`);
            return \`
              <div class="timeline-bar \${isAnomaly ? "is-anomaly" : ""}" title="\${title}" data-bucket="\${escapeText(item.bucket)}">
                <button type="button" class="timeline-seg timeline-seg-running" data-bucket="\${escapeText(item.bucket)}" data-segment="running" style="height:\${runningH}px" aria-label="running"></button>
                <button type="button" class="timeline-seg timeline-seg-failed" data-bucket="\${escapeText(item.bucket)}" data-segment="failed" style="height:\${failedH}px" aria-label="failed"></button>
                <button type="button" class="timeline-seg timeline-seg-succeeded" data-bucket="\${escapeText(item.bucket)}" data-segment="succeeded" style="height:\${succeededH}px" aria-label="succeeded"></button>
              </div>
            \`;
          }).join("");

          timelineLabels.innerHTML = \`
            <span>\${escapeText(items[0].bucket)}</span>
            <span>\${escapeText(items[items.length - 1].bucket)}</span>
          \`;

          document.querySelectorAll(".timeline-seg").forEach((segment) => {
            segment.addEventListener("pointerenter", (event) => {
              const target = event.currentTarget;
              if (!(target instanceof HTMLElement)) return;
              const bucket = target.dataset.bucket || "";
              const segmentName = target.dataset.segment || "succeeded";
              focusTimelineBucket(bucket, segmentName, "hover", event);
            });
            segment.addEventListener("pointermove", (event) => {
              const target = event.currentTarget;
              if (!(target instanceof HTMLElement)) return;
              const bucket = target.dataset.bucket || "";
              const segmentName = target.dataset.segment || "succeeded";
              focusTimelineBucket(bucket, segmentName, "hover", event);
            });
          });

          document.querySelectorAll(".timeline-bar").forEach((bar) => {
            bar.addEventListener("click", async (event) => {
              const target = event.currentTarget;
              if (!(target instanceof HTMLElement)) return;
              const bucket = target.dataset.bucket || "";
              if (!bucket) return;

              if (state.timeline.pinnedBucket === bucket) {
                state.timeline.pinnedBucket = null;
                releaseTimelineHover();
                return;
              }

              await focusTimelineBucket(bucket, "failed", "pinned", event);
            });
          });

          timelineChart.onpointerleave = () => {
            releaseTimelineHover();
          };

          if (state.timeline.pinnedBucket && items.some((item) => item.bucket === state.timeline.pinnedBucket)) {
            void focusTimelineBucket(state.timeline.pinnedBucket, state.timeline.focusedSegment || "failed", "pinned", null);
          } else {
            state.timeline.pinnedBucket = null;
            state.timeline.focusedBucket = null;
            setTimelineFocusStyles();
            renderTimelineDetail(null, "hover");
          }
        }

        function renderErrorClusters(payload) {
          const clusters = payload.clusters || [];
          state.clusters = clusters;
          if (clusters.length === 0) {
            errorClusters.innerHTML = \`<div class="muted">No failures in window.</div>\`;
            incidentCards.innerHTML = "";
            if (state.timeline.activeDetail) {
              applyTimelineCrossHighlights(state.timeline.activeDetail);
            }
            renderIncidentKpis();
            return;
          }

          errorClusters.innerHTML = clusters.map((item) => \`
            <div class="card error-cluster-card" data-scope="\${escapeText(item.scope)}">
              <div><strong>\${escapeText(item.count)}</strong> failures</div>
              <div class="muted">Scope: \${escapeText(item.scope)}</div>
              <div class="muted">Latest: \${escapeText(formatRelative(item.latestAt))} (\${escapeText(formatTs(item.latestAt))})</div>
              <div class="error">\${escapeText(item.sample)}</div>
            </div>
          \`).join("");

          const top = clusters.slice(0, 4);
          incidentCards.innerHTML = top.map((item) => \`
            <article class="incident-card">
              <div class="incident-card-head">
                <h3 class="incident-card-title">Failure Cluster</h3>
                <span class="incident-card-count">\${escapeText(item.count)} hits</span>
              </div>
              <div class="incident-card-scope">
                <div class="label">Scope</div>
                <div class="mono">\${escapeText(item.scope)}</div>
              </div>
              <div class="muted">Latest: \${escapeText(formatRelative(item.latestAt))} (\${escapeText(formatTs(item.latestAt))})</div>
              <div class="incident-card-sample error">\${escapeText(item.sample)}</div>
            </article>
          \`).join("");

          if (state.timeline.activeDetail) {
            applyTimelineCrossHighlights(state.timeline.activeDetail);
          }

          renderIncidentKpis();
        }

        function renderSecretsHealth(payload) {
          if (!payload.available) {
            secretsHealth.innerHTML = \`<div class="muted">Secrets health unavailable: \${escapeText(payload.reason || "missing workflow binding")}</div>\`;
            return;
          }

          if (payload.ok) {
            secretsHealth.innerHTML = \`<div class="status-ok">Config health OK. No missing required secrets for enabled routes/schedules.</div>\`;
            return;
          }

          const lines = (payload.errors || []).map((item) => \`<li>\${escapeText(item)}</li>\`).join("");
          secretsHealth.innerHTML = \`
            <div class="status-bad">Missing configuration detected.</div>
            <ul>\${lines || "<li>No details</li>"}</ul>
          \`;
        }

        function applyPreset(name) {
          const status = document.getElementById("runs-status");
          const kind = document.getElementById("runs-kind");
          const route = document.getElementById("runs-route");
          const schedule = document.getElementById("runs-schedule");

          status.value = "";
          kind.value = "";
          route.value = "";
          schedule.value = "";

          if (name === "failed") {
            status.value = "failed";
          } else if (name === "http") {
            kind.value = "http_route";
          } else if (name === "cron") {
            kind.value = "scheduled_job";
          } else if (name === "running") {
            status.value = "started";
          }

          loadRuns();
        }

        function renderRuns(runs) {
          const safeRuns = Array.isArray(runs) ? runs : [];
          state.runs = safeRuns;
          runsCount.textContent = \`\${safeRuns.length} loaded\`;
          renderRunsKpis();

          if (!runs || runs.length === 0) {
            runsBody.innerHTML = \`<tr><td colspan="7" class="muted">No runs found for current filter.</td></tr>\`;
            if (state.timeline.activeDetail) {
              applyTimelineCrossHighlights(state.timeline.activeDetail);
            }
            return;
          }

          runsBody.innerHTML = runs.map((run) => {
            const target = escapeText(run.routePath || run.scheduleId || "-");
            const error = run.error ? \`<span class="error">\${escapeText(formatError(run.error))}</span>\` : "-";
            const rowClass = runRowClass(run.status);
            const scope = run.routePath || run.scheduleId || "";
            const isSelected = state.selectedRunTraceId && run.traceId === state.selectedRunTraceId;
            const selectedClass = isSelected ? "run-row-selected" : "";

            return \`
              <tr class="\${rowClass} \${selectedClass} run-click" data-trace-id="\${escapeText(run.traceId)}" data-started-at="\${escapeText(run.startedAt)}" data-scope="\${escapeText(scope)}">
                <td class="mono run-trace-cell">
                  <span class="run-trace-value" title="\${escapeText(run.traceId)}">\${escapeText(run.traceId)}</span>
                  <button class="copy-trace" data-trace="\${escapeText(run.traceId)}" type="button">copy</button>
                </td>
                <td>\${escapeText(run.kind)}</td>
                <td class="mono">\${target}</td>
                <td><span class="pill \${statusChipClass(run.status)}">\${escapeText(run.status)}</span></td>
                <td title="\${escapeText(formatTs(run.startedAt))}">\${escapeText(formatRelative(run.startedAt))}</td>
                <td>\${escapeText(run.duration || "-")}</td>
                <td>\${error}</td>
              </tr>
            \`;
          }).join("");

          document.querySelectorAll("#runs-body tr[data-trace-id]").forEach((row) => {
            row.addEventListener("click", (event) => {
              const target = event.target;
              if (target instanceof HTMLElement && target.closest(".copy-trace")) {
                return;
              }
              const traceId = row.dataset.traceId || "";
              void selectRun(traceId);
            });
          });

          document.querySelectorAll(".copy-trace").forEach((button) => {
            button.addEventListener("click", async (event) => {
              event.stopPropagation();
              const trace = button.dataset.trace || "";
              try {
                await navigator.clipboard.writeText(trace);
              } catch {
                // no-op fallback
              }
            });
          });

          if (state.timeline.activeDetail) {
            applyTimelineCrossHighlights(state.timeline.activeDetail);
          }
        }

        async function loadRuns() {
          const status = document.getElementById("runs-status").value.trim();
          const kind = document.getElementById("runs-kind").value.trim();
          const routePath = document.getElementById("runs-route").value.trim();
          const scheduleId = document.getElementById("runs-schedule").value.trim();
          const limit = document.getElementById("runs-limit").value.trim() || "50";

          const params = new URLSearchParams();
          if (status) params.set("status", status);
          if (kind) params.set("kind", kind);
          if (routePath) params.set("routePath", routePath);
          if (scheduleId) params.set("scheduleId", scheduleId);
          params.set("limit", limit);
          writeUiStateToUrl();

          const payload = await fetchJson(\`/api/runs?\${params.toString()}\`);
          const runs = payload.runs || [];
          renderRuns(runs);
          if (state.selectedRunTraceId) {
            const exists = runs.some((run) => run.traceId === state.selectedRunTraceId);
            if (!exists) {
              state.selectedRunTraceId = null;
              state.selectedRunDetail = null;
              renderRunInspector();
              writeUiStateToUrl();
            } else {
              const loadedTrace = state.selectedRunDetail?.run?.traceId;
              if (loadedTrace !== state.selectedRunTraceId) {
                await loadRunDetail(state.selectedRunTraceId);
              }
            }
          }
          return payload;
        }

        async function loadFailedRuns() {
          const payload = await fetchJson("/api/runs?status=failed&limit=20");
          state.failedRuns = payload.runs || [];
          renderFailedRuns();
          return payload;
        }

        async function retryTrace(traceId, button) {
          button.disabled = true;
          try {
            const result = await fetchJson(\`/api/retry/\${encodeURIComponent(traceId)}\`, { method: "POST" });
            alert(\`Retry queued. New trace: \${result.newTraceId}\`);
            await Promise.all([loadDeadLetters(), loadReplays(), loadRuns(), loadSummary(), loadFailedRuns()]);
          } catch (error) {
            alert(\`Retry failed: \${String(error.message || error)}\`);
          } finally {
            button.disabled = false;
          }
        }

        function renderDeadLetters(items) {
          if (!items || items.length === 0) {
            deadLettersBody.innerHTML = \`<tr><td colspan="5" class="muted">No dead letters.</td></tr>\`;
            return;
          }

          deadLettersBody.innerHTML = "";
          items.forEach((item) => {
            const row = document.createElement("tr");
            row.innerHTML = \`
              <td>\${escapeText(item.id)}</td>
              <td class="mono">\${escapeText(item.traceId)}</td>
              <td>\${escapeText(formatTs(item.createdAt))}</td>
              <td><span class="error">\${escapeText(formatError(item.error))}</span></td>
              <td><button type="button" data-trace-id="\${escapeText(item.traceId)}">Retry</button></td>
            \`;
            const button = row.querySelector("button");
            button.addEventListener("click", () => retryTrace(item.traceId, button));
            deadLettersBody.appendChild(row);
          });
        }

        async function loadDeadLetters() {
          const limit = document.getElementById("dead-letters-limit").value.trim() || "50";
          const payload = await fetchJson(\`/api/dead-letters?limit=\${encodeURIComponent(limit)}\`);
          renderDeadLetters(payload.deadLetters || []);
          return payload;
        }

        function renderReplays(payload) {
          if (payload.warning) {
            replaysBody.innerHTML = \`<tr><td colspan="5" class="muted">\${escapeText(payload.warning)}</td></tr>\`;
            return;
          }

          const chains = payload.chains || [];
          if (chains.length === 0) {
            replaysBody.innerHTML = \`<tr><td colspan="5" class="muted">No replay chains recorded yet.</td></tr>\`;
            return;
          }

          replaysBody.innerHTML = chains.map((chain) => {
            const attempts = chain.attempts || [];
            const latest = attempts[attempts.length - 1] || {};
            return \`
              <tr>
                <td class="mono">\${escapeText(chain.parentTraceId)}</td>
                <td>\${escapeText(attempts.length)}</td>
                <td class="mono">\${escapeText(latest.childTraceId || "-")}</td>
                <td><span class="pill \${statusChipClass(latest.childStatus || "")}">\${escapeText(latest.childStatus || "-")}</span></td>
                <td>\${formatTs(latest.createdAt)}</td>
              </tr>
            \`;
          }).join("");
        }

        async function loadReplays() {
          const limit = document.getElementById("replays-limit").value.trim() || "100";
          const payload = await fetchJson(\`/api/replays?limit=\${encodeURIComponent(limit)}\`);
          renderReplays(payload);
          return payload;
        }

        async function loadTimeline() {
          const bucket = document.getElementById("timeline-bucket").value;
          const payload = await fetchJson(\`/api/timeline?bucket=\${encodeURIComponent(bucket)}\`);
          renderTimeline(payload);
          return payload;
        }

        async function loadErrorClusters() {
          const payload = await fetchJson("/api/error-clusters?limit=20");
          renderErrorClusters(payload);
          return payload;
        }

        async function loadSecretsHealth() {
          const payload = await fetchJson("/api/secrets-health");
          renderSecretsHealth(payload);
          return payload;
        }

        async function loadSummary() {
          const payload = await fetchJson("/api/summary");
          state.summary = payload;
          renderSummary(payload);
          renderIncidentKpis();
          return payload;
        }

        async function refreshAll() {
          if (state.incidentMode) {
            document.getElementById("runs-status").value = "failed";
          }

          const jobs = [
            ["summary", loadSummary],
            ["catalog", loadCatalog],
            ["runs", loadRuns],
            ["dead letters", loadDeadLetters],
            ["replays", loadReplays],
            ["timeline", loadTimeline],
            ["error clusters", loadErrorClusters],
            ["secrets", loadSecretsHealth],
            ["incident failed runs", loadFailedRuns]
          ];

          setStatusBanner("Refreshing dashboard data...", "");

          const results = await Promise.allSettled(jobs.map((job) => job[1]()));
          const failedPanels = [];
          results.forEach((result, index) => {
            if (result.status === "rejected") {
              const name = jobs[index][0];
              const message = result.reason && result.reason.message
                ? result.reason.message
                : String(result.reason || "unknown error");
              failedPanels.push(\`\${name}: \${message}\`);
            }
          });

          updateLastRefresh();
          renderIncidentKpis();
          renderIncidentHotspots();

          if (failedPanels.length > 0) {
            setStatusBanner(\`Partial refresh. Failed panels: \${failedPanels.join(" | ")}\`, "error");
            return;
          }

          setStatusBanner("Dashboard is healthy. All panels refreshed.", "ok");
        }

        function wireEvents() {
          document.getElementById("refresh-all").addEventListener("click", refreshAll);
          document.getElementById("refresh-runs").addEventListener("click", loadRuns);
          document.getElementById("refresh-dead-letters").addEventListener("click", loadDeadLetters);
          document.getElementById("refresh-replays").addEventListener("click", loadReplays);
          document.getElementById("refresh-clusters").addEventListener("click", loadErrorClusters);
          document.getElementById("refresh-timeline").addEventListener("click", loadTimeline);
          document.getElementById("refresh-secrets-health").addEventListener("click", loadSecretsHealth);
          document.getElementById("refresh-routes").addEventListener("click", loadCatalog);
          document.getElementById("refresh-crons").addEventListener("click", loadCatalog);
          document.getElementById("refresh-incidents").addEventListener("click", async () => {
            await Promise.all([loadSummary(), loadCatalog(), loadErrorClusters(), loadFailedRuns()]);
            renderIncidentKpis();
            renderIncidentHotspots();
          });
          document.getElementById("drawer-close").addEventListener("click", closeDrawer);
          document.getElementById("timeline-bucket").addEventListener("change", () => {
            writeUiStateToUrl();
            loadTimeline();
          });

          ["runs-status", "runs-kind", "runs-route", "runs-schedule", "runs-limit"].forEach((id) => {
            const node = document.getElementById(id);
            if (!node) return;
            node.addEventListener("change", writeUiStateToUrl);
          });
          document.getElementById("runs-route").addEventListener("input", writeUiStateToUrl);
          document.getElementById("runs-schedule").addEventListener("input", writeUiStateToUrl);

          document.getElementById("tabs").addEventListener("click", (event) => {
            const target = event.target;
            if (!(target instanceof HTMLElement)) return;
            const button = target.closest(".tab-btn");
            if (!(button instanceof HTMLElement)) return;
            const tab = button.dataset.tab;
            if (!tab) return;
            setActiveTab(tab);
          });

          document.getElementById("inspector-tabs").addEventListener("click", (event) => {
            const target = event.target;
            if (!(target instanceof HTMLElement)) return;
            const button = target.closest(".inspector-tab");
            if (!(button instanceof HTMLElement)) return;
            const tab = button.dataset.tab;
            if (!tab) return;
            setInspectorTab(tab);
          });

          document.querySelectorAll(".preset-filter").forEach((button) => {
            button.addEventListener("click", () => applyPreset(button.dataset.preset || "all"));
          });

          document.getElementById("incident-toggle").addEventListener("change", (event) => {
            const target = event.target;
            state.incidentMode = Boolean(target && target.checked);
            if (state.incidentMode) {
              document.getElementById("runs-status").value = "failed";
            }
            refreshAll();
          });
        }

        applyUiStateFromUrl();
        wireEvents();
        setActiveTab(state.activeTab || "overview", false);
        setInspectorTab(state.inspectorTab || "overview");
        renderRunInspector();
        refreshAll();
      }
    </script>
  </body>
</html>`;
}

function extractInlineDashboardScript(html: string) {
  const match = html.match(/<script>\s*([\s\S]*?)\s*<\/script>/);
  return match?.[1] ?? "";
}

async function getSummary(url: URL, env: Env) {
  const range = resolveTimeRange(url);
  const workspaceId = readWorkspaceFilter(url);
  const runClauses = ["started_at >= ?1", "started_at <= ?2"];
  const runBindings: unknown[] = [range.since, range.until];
  withWorkspaceClause(runClauses, runBindings, workspaceId);
  const deadLetterClauses = ["created_at >= ?1", "created_at <= ?2"];
  const deadLetterBindings: unknown[] = [range.since, range.until];
  withWorkspaceClause(deadLetterClauses, deadLetterBindings, workspaceId);

  const statusRows = await env.DB
    .prepare(
       `SELECT status, COUNT(*) AS count
       FROM runs
       WHERE ${runClauses.join(" AND ")}
       GROUP BY status`
    )
    .bind(...runBindings)
    .all<SummaryStatusRow>();

  const topRoutesRows = await env.DB
    .prepare(
      `SELECT route_path AS routePath, COUNT(*) AS count
       FROM runs
       WHERE ${runClauses.join(" AND ")}
         AND route_path IS NOT NULL
         AND route_path != ''
       GROUP BY route_path
       ORDER BY count DESC, route_path ASC
       LIMIT 8`
    )
    .bind(...runBindings)
    .all<SummaryTopRouteRow>();

  const deadLetterRow = await env.DB
    .prepare(
      `SELECT COUNT(*) AS count
       FROM dead_letters
       WHERE ${deadLetterClauses.join(" AND ")}`
    )
    .bind(...deadLetterBindings)
    .first<{ count: number | string }>();

  const countsByStatus = new Map<string, number>();
  for (const row of statusRows.results) {
    countsByStatus.set(row.status, toCount(row.count));
  }

  const totalRuns = [...countsByStatus.values()].reduce((acc, value) => acc + value, 0);

  return json({
    windowHours: range.windowHours,
    since: range.since,
    until: range.until,
    workspaceId,
    totalRuns,
    succeededRuns: countsByStatus.get("succeeded") ?? 0,
    failedRuns: countsByStatus.get("failed") ?? 0,
    startedRuns: (countsByStatus.get("started") ?? 0) + (countsByStatus.get("running") ?? 0),
    deadLetters: toCount(deadLetterRow?.count),
    topRoutes: topRoutesRows.results.map((row) => ({
      routePath: row.routePath,
      count: toCount(row.count)
    }))
  });
}

async function getCatalog(url: URL, env: Env, routesManifest: RouteDefinition[], schedulesManifest: ScheduleDefinition[]) {
  const range = resolveTimeRange(url);
  const workspaceId = readWorkspaceFilter(url);
  const runClauses = ["started_at >= ?1", "started_at <= ?2"];
  const runBindings: unknown[] = [range.since, range.until];
  withWorkspaceClause(runClauses, runBindings, workspaceId);

  const routeRows = await env.DB
    .prepare(
      `SELECT
         route_path AS routePath,
         SUM(CASE WHEN status = 'succeeded' THEN 1 ELSE 0 END) AS succeeded,
         SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
         SUM(CASE WHEN status IN ('started', 'running') THEN 1 ELSE 0 END) AS started,
         COUNT(*) AS total
       FROM runs
       WHERE ${runClauses.join(" AND ")}
         AND route_path IS NOT NULL
         AND route_path != ''
       GROUP BY route_path`
    )
    .bind(...runBindings)
    .all<CatalogRouteCountRow>();

  const scheduleRows = await env.DB
    .prepare(
      `SELECT
         schedule_id AS scheduleId,
         SUM(CASE WHEN status = 'succeeded' THEN 1 ELSE 0 END) AS succeeded,
         SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
         SUM(CASE WHEN status IN ('started', 'running') THEN 1 ELSE 0 END) AS started,
         COUNT(*) AS total
       FROM runs
       WHERE ${runClauses.join(" AND ")}
         AND schedule_id IS NOT NULL
         AND schedule_id != ''
       GROUP BY schedule_id`
    )
    .bind(...runBindings)
    .all<CatalogScheduleCountRow>();

  const routeCounts = new Map(
    routeRows.results.map((item) => [
      item.routePath,
      {
        succeeded: toCount(item.succeeded),
        failed: toCount(item.failed),
        started: toCount(item.started),
        total: toCount(item.total)
      }
    ])
  );

  const scheduleCounts = new Map(
    scheduleRows.results.map((item) => [
      item.scheduleId,
      {
        succeeded: toCount(item.succeeded),
        failed: toCount(item.failed),
        started: toCount(item.started),
        total: toCount(item.total)
      }
    ])
  );

  const routes = routesManifest.map((route) => {
    const count = routeCounts.get(route.routePath) ?? { succeeded: 0, failed: 0, started: 0, total: 0 };
    return {
      routePath: route.routePath,
      requestType: route.requestType,
      flowPath: route.flowPath,
      wrapBody: route.wrapBody,
      ...count
    };
  });

  const schedules = schedulesManifest.map((schedule) => {
    const count = scheduleCounts.get(schedule.id) ?? { succeeded: 0, failed: 0, started: 0, total: 0 };
    return {
      id: schedule.id,
      cron: schedule.cron,
      target: schedule.target,
      timeZone: schedule.timeZone,
      enabled: schedule.enabled,
      ...count
    };
  });

  const flowMap = new Map<
    string,
    {
      flowPath: string;
      httpRoutes: string[];
      schedules: string[];
      succeeded: number;
      failed: number;
      started: number;
      total: number;
    }
  >();

  for (const route of routes) {
    const key = route.flowPath;
    const existing = flowMap.get(key) ?? {
      flowPath: key,
      httpRoutes: [],
      schedules: [],
      succeeded: 0,
      failed: 0,
      started: 0,
      total: 0
    };
    existing.httpRoutes.push(route.routePath);
    existing.succeeded += route.succeeded;
    existing.failed += route.failed;
    existing.started += route.started;
    existing.total += route.total;
    flowMap.set(key, existing);
  }

  for (const schedule of schedules) {
    const key = schedule.target;
    const existing = flowMap.get(key) ?? {
      flowPath: key,
      httpRoutes: [],
      schedules: [],
      succeeded: 0,
      failed: 0,
      started: 0,
      total: 0
    };
    existing.schedules.push(schedule.id);
    existing.succeeded += schedule.succeeded;
    existing.failed += schedule.failed;
    existing.started += schedule.started;
    existing.total += schedule.total;
    flowMap.set(key, existing);
  }

  const flows = [...flowMap.values()].sort((a, b) => b.failed - a.failed || b.total - a.total);

  return json({
    since: range.since,
    until: range.until,
    workspaceId,
    windowHours: range.windowHours,
    routes,
    schedules,
    flows
  });
}

async function getRuns(url: URL, env: Env) {
  const status = sanitizeFilterValue(url.searchParams.get("status"));
  const routePathFilter = sanitizeFilterValue(url.searchParams.get("routePath"));
  const scheduleIdFilter = sanitizeFilterValue(url.searchParams.get("scheduleId"));
  const kindFilter = sanitizeFilterValue(url.searchParams.get("kind"));
  const workspaceId = readWorkspaceFilter(url);
  const limit = parseLimit(url.searchParams.get("limit"));

  const clauses: string[] = [];
  const bindings: unknown[] = [];

  if (status) {
    clauses.push(`status = ?${bindings.length + 1}`);
    bindings.push(status);
  }

  if (routePathFilter) {
    clauses.push(`route_path = ?${bindings.length + 1}`);
    bindings.push(routePathFilter);
  }

  if (scheduleIdFilter) {
    clauses.push(`schedule_id = ?${bindings.length + 1}`);
    bindings.push(scheduleIdFilter);
  }

  if (kindFilter) {
    clauses.push(`kind = ?${bindings.length + 1}`);
    bindings.push(kindFilter);
  }

  withWorkspaceClause(clauses, bindings, workspaceId);

  let query = `
    SELECT
      trace_id AS traceId,
      workspace_id AS workspaceId,
      kind,
      route_path AS routePath,
      schedule_id AS scheduleId,
      status,
      started_at AS startedAt,
      finished_at AS finishedAt,
      output,
      error
    FROM runs`;

  if (clauses.length > 0) {
    query += ` WHERE ${clauses.join(" AND ")}`;
  }

  query += ` ORDER BY started_at DESC LIMIT ?${bindings.length + 1}`;
  bindings.push(limit);

  const rows = await env.DB.prepare(query).bind(...bindings).all<RunRow>();

  return json({
    limit,
    filters: {
      status: status ?? null,
      routePath: routePathFilter ?? null,
      scheduleId: scheduleIdFilter ?? null,
      kind: kindFilter ?? null,
      workspaceId
    },
    runs: rows.results.map((row) => ({
      traceId: row.traceId,
      workspaceId: row.workspaceId,
      kind: row.kind,
      routePath: row.routePath,
      scheduleId: row.scheduleId,
      status: row.status,
      startedAt: row.startedAt,
      finishedAt: row.finishedAt,
      duration: formatDuration(durationMs(row.startedAt, row.finishedAt)),
      output: row.output,
      error: row.error
    }))
  });
}

async function getRunDetail(traceId: string, env: Env) {
  const run = await env.DB
    .prepare(
      `SELECT
         trace_id AS traceId,
         workspace_id AS workspaceId,
         kind,
         route_path AS routePath,
         schedule_id AS scheduleId,
         status,
         started_at AS startedAt,
         finished_at AS finishedAt,
         output,
         error
       FROM runs
       WHERE trace_id = ?1
       LIMIT 1`
    )
    .bind(traceId)
    .first<RunRow>();

  if (!run) {
    return json({ error: "run not found", traceId }, { status: 404 });
  }

  const deadLetter = await env.DB
    .prepare(
      `SELECT
         id,
         workspace_id AS workspaceId,
         payload_json AS payloadJson,
         error,
         created_at AS createdAt
       FROM dead_letters
       WHERE trace_id = ?1
       ORDER BY id DESC
       LIMIT 1`
    )
    .bind(traceId)
    .first<{ id: number; workspaceId: string | null; payloadJson: string; error: string; createdAt: string }>();

  const retryChainRows = await env.DB
    .prepare(
      `SELECT
         rl.parent_trace_id AS parentTraceId,
         rl.child_trace_id AS childTraceId,
         rl.retry_count AS retryCount,
         rl.created_at AS createdAt,
         cr.status AS childStatus
       FROM replay_lineage rl
       LEFT JOIN runs cr ON cr.trace_id = rl.child_trace_id
       WHERE rl.parent_trace_id = ?1
          OR rl.child_trace_id = ?1
       ORDER BY rl.retry_count ASC, rl.created_at ASC`
    )
    .bind(traceId)
    .all<{
      parentTraceId: string;
      childTraceId: string;
      retryCount: number | string;
      createdAt: string;
      childStatus: string | null;
    }>();

  const parentTraceId = retryChainRows.results[0]?.parentTraceId ?? traceId;
  const attempts = retryChainRows.results.map((row) => ({
    parentTraceId: row.parentTraceId,
    childTraceId: row.childTraceId,
    retryCount: toCount(row.retryCount),
    createdAt: row.createdAt,
    childStatus: row.childStatus
  }));

  return json({
    traceId,
    run: {
      traceId: run.traceId,
      workspaceId: run.workspaceId,
      kind: run.kind,
      routePath: run.routePath,
      scheduleId: run.scheduleId,
      status: run.status,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      duration: formatDuration(durationMs(run.startedAt, run.finishedAt)),
      output: run.output,
      error: run.error
    },
    deadLetter: deadLetter
      ? {
          id: deadLetter.id,
          workspaceId: deadLetter.workspaceId,
          payloadJson: deadLetter.payloadJson,
          error: deadLetter.error,
          createdAt: deadLetter.createdAt
        }
      : null,
    retries: {
      parentTraceId,
      attempts
    }
  });
}

async function getDeadLetters(url: URL, env: Env) {
  const workspaceId = readWorkspaceFilter(url);
  const limit = parseLimit(url.searchParams.get("limit"));
  const clauses: string[] = [];
  const bindings: unknown[] = [];
  withWorkspaceClause(clauses, bindings, workspaceId);

  let query = `SELECT
    id,
    trace_id AS traceId,
    workspace_id AS workspaceId,
    payload_json AS payloadJson,
    error,
    created_at AS createdAt
   FROM dead_letters`;
  if (clauses.length > 0) {
    query += ` WHERE ${clauses.join(" AND ")}`;
  }
  query += ` ORDER BY created_at DESC LIMIT ?${bindings.length + 1}`;
  bindings.push(limit);

  const rows = await env.DB.prepare(query).bind(...bindings).all<DeadLetterRow>();

  return json({
    limit,
    workspaceId,
    deadLetters: rows.results.map((item) => ({
      id: item.id,
      traceId: item.traceId,
      workspaceId: item.workspaceId,
      createdAt: item.createdAt,
      error: item.error
    }))
  });
}

async function recordReplayLineage(
  env: Env,
  parentTraceId: string,
  childTraceId: string,
  sourceDeadLetterId: number
) {
  const countRow = await env.DB
    .prepare(
      `SELECT COALESCE(MAX(retry_count), 0) AS retryCount
       FROM replay_lineage
       WHERE parent_trace_id = ?1`
    )
    .bind(parentTraceId)
    .first<{ retryCount: number | string }>();

  const retryCount = toCount(countRow?.retryCount) + 1;
  const now = new Date().toISOString();

  await env.DB
    .prepare(
      `INSERT INTO replay_lineage (
         parent_trace_id,
         child_trace_id,
         source_dead_letter_id,
         retry_count,
         created_at,
         last_retry_at
       ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
    )
    .bind(parentTraceId, childTraceId, sourceDeadLetterId, retryCount, now, now)
    .run();

  return retryCount;
}

async function replayTaskFromDeadLetter(
  env: Env,
  traceId: string,
  routesManifest: RouteDefinition[],
  schedulesManifest: ScheduleDefinition[]
) {
  const deadLetter = await env.DB
    .prepare(
      `SELECT
         id,
         workspace_id AS workspaceId,
         payload_json AS payloadJson,
         created_at AS createdAt
       FROM dead_letters
       WHERE trace_id = ?1
       ORDER BY id DESC
       LIMIT 1`
    )
    .bind(traceId)
    .first<{ id: number; workspaceId: string | null; payloadJson: string; createdAt: string }>();

  if (!deadLetter) {
    return {
      ok: false as const,
      status: 404,
      body: { error: "dead letter not found", traceId }
    };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(deadLetter.payloadJson);
  } catch {
    return {
      ok: false as const,
      status: 422,
      body: { error: "dead letter payload is invalid JSON", traceId }
    };
  }

  if (!isQueueTask(payload)) {
    return {
      ok: false as const,
      status: 422,
      body: { error: "dead letter payload is not a queue task", traceId }
    };
  }

  const replayCheck = checkTaskReplayEnablement(payload, env, {
    routes: routesManifest,
    schedules: schedulesManifest
  });
  if (!replayCheck.enabled) {
    return {
      ok: false as const,
      status: 409,
      body: {
        error: "retry blocked",
        traceId,
        reason: replayCheck.reason
      }
    };
  }

  const retriedTask: QueueTask = {
    ...payload,
    traceId: crypto.randomUUID(),
    enqueuedAt: new Date().toISOString()
  };

  await env.AUTOMATION_QUEUE.send(retriedTask);

  let retryCount: number | null = null;
  try {
    retryCount = await recordReplayLineage(env, traceId, retriedTask.traceId, deadLetter.id);
  } catch {
    // If migration not yet applied, retry still succeeds.
    retryCount = null;
  }

  return {
    ok: true as const,
    status: 202,
    body: {
      accepted: true,
      retriedFromTraceId: traceId,
      workspaceId: deadLetter.workspaceId,
      deadLetterId: deadLetter.id,
      originalCreatedAt: deadLetter.createdAt,
      newTraceId: retriedTask.traceId,
      retryCount
    }
  };
}

async function retryDeadLetter(
  request: Request,
  requestPath: string,
  env: Env,
  routesManifest: RouteDefinition[],
  schedulesManifest: ScheduleDefinition[]
) {
  const traceId = retryTraceIdFromPath(requestPath);
  if (!traceId) {
    return json({ error: "invalid retry path" }, { status: 404 });
  }

  const replay = await replayTaskFromDeadLetter(env, traceId, routesManifest, schedulesManifest);
  if (!replay.ok) {
    return json(replay.body, { status: replay.status });
  }

  await safeAuditEvent(env, request, {
    workspaceId: replay.body.workspaceId ?? undefined,
    action: "retry_dead_letter",
    resourceType: "trace",
    resourceId: traceId,
    details: {
      newTraceId: replay.body.newTraceId,
      retryCount: replay.body.retryCount
    }
  });

  return json(replay.body, { status: replay.status });
}

async function replayFailedRun(
  request: Request,
  requestPath: string,
  env: Env,
  routesManifest: RouteDefinition[],
  schedulesManifest: ScheduleDefinition[]
) {
  const traceId = replayTraceIdFromPath(requestPath);
  if (!traceId) {
    return json({ error: "invalid replay path" }, { status: 404 });
  }

  const run = await env.DB
    .prepare(
      `SELECT status
       FROM runs
       WHERE trace_id = ?1
       LIMIT 1`
    )
    .bind(traceId)
    .first<{ status: string }>();

  if (!run) {
    return json({ error: "run not found", traceId }, { status: 404 });
  }

  if (run.status !== "failed") {
    return json({ error: "replay requires failed run", traceId, status: run.status }, { status: 409 });
  }

  const replay = await replayTaskFromDeadLetter(env, traceId, routesManifest, schedulesManifest);
  if (!replay.ok) {
    return json(replay.body, { status: replay.status });
  }

  await safeAuditEvent(env, request, {
    workspaceId: replay.body.workspaceId ?? undefined,
    action: "replay_failed_run",
    resourceType: "trace",
    resourceId: traceId,
    details: {
      newTraceId: replay.body.newTraceId
    }
  });

  return json(replay.body, { status: replay.status });
}

async function getReplays(url: URL, env: Env) {
  const limit = parseLimit(url.searchParams.get("limit"));

  let rows: ReplayRow[] = [];
  try {
    const result = await env.DB
      .prepare(
        `SELECT
           rl.parent_trace_id AS parentTraceId,
           rl.child_trace_id AS childTraceId,
           rl.source_dead_letter_id AS sourceDeadLetterId,
           rl.retry_count AS retryCount,
           rl.created_at AS createdAt,
           pr.status AS parentStatus,
           cr.status AS childStatus,
           cr.error AS childError
         FROM replay_lineage rl
         LEFT JOIN runs pr ON pr.trace_id = rl.parent_trace_id
         LEFT JOIN runs cr ON cr.trace_id = rl.child_trace_id
         ORDER BY rl.created_at DESC
         LIMIT ?1`
      )
      .bind(limit)
      .all<ReplayRow>();

    rows = result.results;
  } catch (error) {
    return json({
      limit,
      chains: [],
      warning: `Replay lineage unavailable: ${error instanceof Error ? error.message : String(error)}`
    });
  }

  const grouped = new Map<string, {
    parentTraceId: string;
    parentStatus: string | null;
    attempts: Array<{
      childTraceId: string;
      sourceDeadLetterId: number | null;
      retryCount: number;
      createdAt: string;
      childStatus: string | null;
      childError: string | null;
    }>;
  }>();

  for (const row of rows) {
    const existing = grouped.get(row.parentTraceId) ?? {
      parentTraceId: row.parentTraceId,
      parentStatus: row.parentStatus,
      attempts: []
    };

    existing.attempts.push({
      childTraceId: row.childTraceId,
      sourceDeadLetterId: row.sourceDeadLetterId,
      retryCount: toCount(row.retryCount),
      createdAt: row.createdAt,
      childStatus: row.childStatus,
      childError: row.childError
    });

    grouped.set(row.parentTraceId, existing);
  }

  const chains = [...grouped.values()].map((chain) => ({
    ...chain,
    attempts: chain.attempts.sort((a, b) => a.retryCount - b.retryCount)
  }));

  return json({
    limit,
    chains
  });
}

async function getRouteDetail(routePath: string, env: Env, routesManifest: RouteDefinition[]) {
  const route = routesManifest.find((item) => item.routePath === routePath);
  if (!route) {
    return json({ error: "route not found", routePath }, { status: 404 });
  }

  const rows = await env.DB
    .prepare(
      `SELECT
         trace_id AS traceId,
         status,
         started_at AS startedAt,
         finished_at AS finishedAt,
         error
       FROM runs
       WHERE route_path = ?1
       ORDER BY started_at DESC
       LIMIT 200`
    )
    .bind(routePath)
    .all<{
      traceId: string;
      status: string;
      startedAt: string;
      finishedAt: string | null;
      error: string | null;
    }>();

  const resultRows = rows.results;
  const durations = resultRows
    .map((item) => durationMs(item.startedAt, item.finishedAt))
    .filter((value): value is number => typeof value === "number");

  const failedRows = resultRows.filter((item) => item.status === "failed" && item.error);
  const clusterMap = new Map<string, { count: number; sample: string }>();
  for (const row of failedRows) {
    const key = normalizeErrorForCluster(row.error ?? "");
    const existing = clusterMap.get(key) ?? { count: 0, sample: row.error ?? "" };
    existing.count += 1;
    clusterMap.set(key, existing);
  }

  const lastSuccess = resultRows.find((item) => item.status === "succeeded");
  const lastFailure = resultRows.find((item) => item.status === "failed");

  return json({
    route,
    metrics: {
      total: resultRows.length,
      succeeded: resultRows.filter((item) => item.status === "succeeded").length,
      failed: resultRows.filter((item) => item.status === "failed").length,
      started: resultRows.filter((item) => item.status === "started" || item.status === "running").length,
      p95Duration: formatDuration(percentile(durations, 95)),
      lastSuccessAt: lastSuccess?.startedAt ?? null,
      lastFailureAt: lastFailure?.startedAt ?? null
    },
    errorClusters: [...clusterMap.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 8)
      .map((entry) => ({
        key: entry[0],
        count: entry[1].count,
        sample: entry[1].sample
      })),
    recentRuns: resultRows.slice(0, 50).map((item) => ({
      traceId: item.traceId,
      status: item.status,
      startedAt: item.startedAt,
      duration: formatDuration(durationMs(item.startedAt, item.finishedAt))
    }))
  });
}

async function getCronDetail(scheduleId: string, env: Env, schedulesManifest: ScheduleDefinition[]) {
  const schedule = schedulesManifest.find((item) => item.id === scheduleId);
  if (!schedule) {
    return json({ error: "schedule not found", scheduleId }, { status: 404 });
  }

  const rows = await env.DB
    .prepare(
      `SELECT
         trace_id AS traceId,
         status,
         started_at AS startedAt,
         finished_at AS finishedAt,
         error
       FROM runs
       WHERE schedule_id = ?1
       ORDER BY started_at DESC
       LIMIT 200`
    )
    .bind(scheduleId)
    .all<{
      traceId: string;
      status: string;
      startedAt: string;
      finishedAt: string | null;
      error: string | null;
    }>();

  const resultRows = rows.results;
  const durations = resultRows
    .map((item) => durationMs(item.startedAt, item.finishedAt))
    .filter((value): value is number => typeof value === "number");

  const lastRun = resultRows[0];
  const lastSuccess = resultRows.find((item) => item.status === "succeeded");
  const lastFailure = resultRows.find((item) => item.status === "failed");

  return json({
    schedule,
    metrics: {
      total: resultRows.length,
      succeeded: resultRows.filter((item) => item.status === "succeeded").length,
      failed: resultRows.filter((item) => item.status === "failed").length,
      started: resultRows.filter((item) => item.status === "started" || item.status === "running").length,
      p95Duration: formatDuration(percentile(durations, 95)),
      lastRunAt: lastRun?.startedAt ?? null,
      lastSuccessAt: lastSuccess?.startedAt ?? null,
      lastFailureAt: lastFailure?.startedAt ?? null,
      lastFailureError: lastFailure?.error ?? null,
      nextRunAt: computeNextRun(schedule.cron, schedule.timeZone)
    },
    recentRuns: resultRows.slice(0, 50).map((item) => ({
      traceId: item.traceId,
      status: item.status,
      startedAt: item.startedAt,
      duration: formatDuration(durationMs(item.startedAt, item.finishedAt))
    }))
  });
}

async function enqueueManualScheduleRun(
  request: Request,
  scheduleId: string,
  env: Env,
  schedulesManifest: ScheduleDefinition[]
) {
  const schedule = schedulesManifest.find((item) => item.id === scheduleId && item.enabled);
  if (!schedule) {
    return json({ error: "unknown or disabled schedule", scheduleId }, { status: 404 });
  }

  const now = new Date().toISOString();
  const traceId = crypto.randomUUID();
  const workspaceId = readWorkspaceId(request, env.DEFAULT_WORKSPACE_ID || DEFAULT_WORKSPACE);

  const task: QueueTask = {
    kind: "scheduled_job",
    traceId,
    workspaceId,
    scheduleId: schedule.id,
    payload: {
      target: schedule.target,
      cron: schedule.cron,
      timeZone: schedule.timeZone,
      scheduledTime: now,
      trigger: "manual_ops_dashboard"
    },
    enqueuedAt: now
  };

  await env.AUTOMATION_QUEUE.send(task);
  await safeAuditEvent(env, request, {
    workspaceId,
    action: "manual_schedule_run",
    resourceType: "schedule",
    resourceId: schedule.id,
    details: {
      traceId
    }
  });

  return json(
    {
      accepted: true,
      traceId,
      workspaceId,
      scheduleId: schedule.id,
      enqueuedAt: now,
      trigger: "manual_ops_dashboard"
    },
    { status: 202 }
  );
}

async function getTimeline(url: URL, env: Env) {
  const bucket = parseTimelineResolution(url.searchParams.get("bucket"));
  const range = resolveTimeRange(url);
  const workspaceId = readWorkspaceFilter(url);
  const clauses = ["started_at >= ?1", "started_at <= ?2"];
  const bindings: unknown[] = [range.since, range.until];
  withWorkspaceClause(clauses, bindings, workspaceId);

  const bucketExpr = getTimelineBucketExpr(bucket);

  const rows = await env.DB
    .prepare(
       `SELECT
         ${bucketExpr} AS bucket,
         status,
         COUNT(*) AS count
       FROM runs
       WHERE ${clauses.join(" AND ")}
       GROUP BY bucket, status
       ORDER BY bucket ASC`
    )
    .bind(...bindings)
    .all<TimelineRow>();

  const scopeRows = await env.DB
    .prepare(
      `SELECT
         ${bucketExpr} AS bucket,
         COALESCE(NULLIF(route_path, ''), NULLIF(schedule_id, ''), 'unknown') AS scope,
         COUNT(*) AS count
       FROM runs
       WHERE ${clauses.join(" AND ")}
         AND status = 'failed'
       GROUP BY bucket, scope
       ORDER BY bucket ASC, count DESC`
    )
    .bind(...bindings)
    .all<TimelineScopeRow>();

  const bucketMap = new Map<string, { bucket: string; succeeded: number; failed: number; running: number; total: number }>();
  for (const row of rows.results) {
    const key = row.bucket;
    const existing = bucketMap.get(key) ?? {
      bucket: key,
      succeeded: 0,
      failed: 0,
      running: 0,
      total: 0
    };

    const count = toCount(row.count);
    if (row.status === "succeeded") {
      existing.succeeded += count;
    } else if (row.status === "failed") {
      existing.failed += count;
    } else if (row.status === "started" || row.status === "running") {
      existing.running += count;
    }

    existing.total += count;
    bucketMap.set(key, existing);
  }

  const topScopeMap = new Map<string, { scope: string; count: number }>();
  for (const row of scopeRows.results) {
    const existing = topScopeMap.get(row.bucket);
    if (existing) {
      continue;
    }
    topScopeMap.set(row.bucket, {
      scope: row.scope,
      count: toCount(row.count)
    });
  }

  return json({
    bucket,
    since: range.since,
    until: range.until,
    workspaceId,
    buckets: [...bucketMap.values()].map((item) => {
      const topScope = topScopeMap.get(item.bucket);
      return {
        ...item,
        topFailureScope: topScope?.scope ?? null,
        topFailureCount: topScope?.count ?? 0
      };
    })
  });
}

async function getTimelineDetail(url: URL, env: Env) {
  const bucket = sanitizeFilterValue(url.searchParams.get("bucket"));
  if (!bucket) {
    return json({ error: "bucket query param is required" }, { status: 400 });
  }

  const resolution = parseTimelineResolution(url.searchParams.get("resolution"));
  const workspaceId = readWorkspaceFilter(url);
  const limit = parseLimit(url.searchParams.get("limit"));
  const range = timelineBucketRange(bucket, resolution);
  if (!range) {
    return json({ error: "invalid bucket format", bucket }, { status: 400 });
  }

  const clauses = ["started_at >= ?1", "started_at < ?2"];
  const bindings: unknown[] = [range.startIso, range.endIso];
  withWorkspaceClause(clauses, bindings, workspaceId);

  const statusRows = await env.DB
    .prepare(
      `SELECT status, COUNT(*) AS count
       FROM runs
       WHERE ${clauses.join(" AND ")}
       GROUP BY status`
    )
    .bind(...bindings)
    .all<TimelineDetailStatusRow>();

  const scopeRows = await env.DB
    .prepare(
       `SELECT
         COALESCE(NULLIF(route_path, ''), NULLIF(schedule_id, ''), 'unknown') AS scope,
         COUNT(*) AS count
       FROM runs
       WHERE ${clauses.join(" AND ")}
         AND status = 'failed'
       GROUP BY scope
       ORDER BY count DESC, scope ASC
       LIMIT 10`
    )
    .bind(...bindings)
    .all<{ scope: string; count: number | string }>();

  const runRows = await env.DB
    .prepare(
      `SELECT
         trace_id AS traceId,
         workspace_id AS workspaceId,
         kind,
         route_path AS routePath,
         schedule_id AS scheduleId,
         status,
         started_at AS startedAt,
         finished_at AS finishedAt,
         error
       FROM runs
       WHERE ${clauses.join(" AND ")}
       ORDER BY started_at DESC
       LIMIT ?${bindings.length + 1}`
    )
    .bind(...bindings, limit)
    .all<TimelineDetailRunRow>();

  const countsByStatus = new Map<string, number>();
  for (const row of statusRows.results) {
    countsByStatus.set(row.status, toCount(row.count));
  }
  const succeeded = countsByStatus.get("succeeded") ?? 0;
  const failed = countsByStatus.get("failed") ?? 0;
  const running = (countsByStatus.get("started") ?? 0) + (countsByStatus.get("running") ?? 0);
  const total = succeeded + failed + running;

  return json({
    bucket,
    resolution,
    window: {
      start: range.startIso,
      end: range.endIso
    },
    workspaceId,
    statusCounts: {
      succeeded,
      failed,
      running,
      total
    },
    topScopes: scopeRows.results.map((row) => ({
      scope: row.scope,
      count: toCount(row.count)
    })),
    runs: runRows.results.map((run) => ({
      traceId: run.traceId,
      workspaceId: run.workspaceId,
      kind: run.kind,
      routePath: run.routePath,
      scheduleId: run.scheduleId,
      status: run.status,
      startedAt: run.startedAt,
      duration: formatDuration(durationMs(run.startedAt, run.finishedAt)),
      error: run.error
    }))
  });
}

async function getErrorClusters(url: URL, env: Env) {
  const limit = parseLimit(url.searchParams.get("limit"));
  const range = resolveTimeRange(url);
  const workspaceId = readWorkspaceFilter(url);
  const clauses = ["started_at >= ?1", "started_at <= ?2", "status = 'failed'", "error IS NOT NULL", "error != ''"];
  const bindings: unknown[] = [range.since, range.until];
  withWorkspaceClause(clauses, bindings, workspaceId);

  const rows = await env.DB
    .prepare(
      `SELECT
         route_path AS routePath,
         schedule_id AS scheduleId,
         workspace_id AS workspaceId,
         error,
         started_at AS startedAt
       FROM runs
       WHERE ${clauses.join(" AND ")}
       ORDER BY started_at DESC
       LIMIT 1000`
    )
    .bind(...bindings)
    .all<FailureErrorRow>();

  const clusterMap = new Map<string, {
    count: number;
    sample: string;
    routePath: string | null;
    scheduleId: string | null;
    latestAt: string | null;
  }>();

  for (const row of rows.results) {
    const key = normalizeErrorForCluster(row.error);
    const existing = clusterMap.get(key) ?? {
      count: 0,
      sample: row.error,
      routePath: row.routePath,
      scheduleId: row.scheduleId,
      latestAt: row.startedAt
    };
    existing.count += 1;
    if (!existing.latestAt || Date.parse(row.startedAt) > Date.parse(existing.latestAt)) {
      existing.latestAt = row.startedAt;
      existing.sample = row.error;
      existing.routePath = row.routePath;
      existing.scheduleId = row.scheduleId;
    }
    clusterMap.set(key, existing);
  }

  const clusters = [...clusterMap.entries()]
    .map((entry) => ({
      key: entry[0],
      count: entry[1].count,
      sample: entry[1].sample,
      scope: entry[1].routePath ?? entry[1].scheduleId ?? "unknown",
      latestAt: entry[1].latestAt
    }))
    .sort((a, b) => {
      const aTs = Date.parse(a.latestAt ?? "");
      const bTs = Date.parse(b.latestAt ?? "");
      if (Number.isFinite(aTs) && Number.isFinite(bTs) && aTs !== bTs) {
        return bTs - aTs;
      }
      if (Number.isFinite(bTs) && !Number.isFinite(aTs)) {
        return 1;
      }
      if (Number.isFinite(aTs) && !Number.isFinite(bTs)) {
        return -1;
      }
      return b.count - a.count;
    })
    .slice(0, limit);

  return json({
    since: range.since,
    until: range.until,
    workspaceId,
    clusters
  });
}

async function getSecretsHealth(env: Env) {
  if (!env.WORKFLOW_SERVICE) {
    return json({
      available: false,
      reason: "workflow service binding is not configured on ops-dashboard"
    });
  }

  try {
    const response = await env.WORKFLOW_SERVICE.fetch("http://workflow.internal/health/config", {
      method: "GET"
    });

    if (!response.ok) {
      const errorText = await response.text();
      return json({
        available: false,
        reason: `workflow /health/config failed: ${response.status} ${errorText}`
      });
    }

    const payload = await response.json() as {
      ok: boolean;
      errors?: string[];
      env?: string;
      worker?: string;
    };

    const errors = payload.errors ?? [];
    const routeSecretMap = new Map<string, string[]>();
    for (const line of errors) {
      const match = line.match(/route "([^"]+)": .*Checked:\s*(.+)$/i);
      if (!match?.[1] || !match[2]) {
        continue;
      }
      const routePath = match[1];
      const checked = match[2]
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      routeSecretMap.set(routePath, checked);
    }

    const connectors = CONNECTOR_SECRETS.map((connector) => {
      const missingSecrets = new Set<string>();
      for (const routePath of connector.routes) {
        const checked = routeSecretMap.get(routePath);
        if (!checked) {
          continue;
        }
        for (const secretKey of checked) {
          missingSecrets.add(secretKey);
        }
      }
      const missing = [...missingSecrets];
      const required = connector.requiredSecrets;
      const present = required.filter((secretKey) => !missing.includes(secretKey));
      const status = missing.length === 0 ? "ready" : present.length > 0 ? "partial" : "missing";

      return {
        id: connector.id,
        status,
        requiredSecrets: required,
        missingSecrets: missing,
        presentSecrets: present,
        routes: connector.routes
      };
    });

    return json({
      available: true,
      ok: payload.ok,
      env: payload.env,
      worker: payload.worker,
      errors,
      connectors
    });
  } catch (error) {
    return json({
      available: false,
      reason: error instanceof Error ? error.message : String(error)
    });
  }
}

async function getTemplates() {
  return json({
    templates: WORKFLOW_TEMPLATES
  });
}

async function getOAuthTokens(url: URL, env: Env) {
  const workspaceId = readWorkspaceFilter(url);
  const tokens = await listOAuthTokens(env.DB, workspaceId ?? undefined);

  return json({
    workspaceId,
    tokens: tokens.map((token) => ({
      provider: token.provider,
      accountId: token.accountId,
      workspaceId: token.workspaceId,
      accessToken: redactToken(token.accessToken),
      refreshToken: redactToken(token.refreshToken),
      expiresAt: token.expiresAt,
      needsRefresh: oauthTokenNeedsRefresh(token.expiresAt),
      scopes: token.scopes,
      updatedAt: token.updatedAt,
      createdAt: token.createdAt
    }))
  });
}

async function upsertOAuthTokenEndpoint(request: Request, env: Env) {
  const body = await parseJsonBody(request);
  if (!body) {
    return json({ error: "invalid JSON body" }, { status: 400 });
  }

  const provider = typeof body.provider === "string" ? body.provider.trim() : "";
  const accountId = typeof body.accountId === "string" ? body.accountId.trim() : "";
  const accessToken = typeof body.accessToken === "string" ? body.accessToken.trim() : "";
  const refreshToken = typeof body.refreshToken === "string" ? body.refreshToken.trim() : null;
  const expiresAt = typeof body.expiresAt === "string" ? body.expiresAt.trim() : null;
  const scopes = Array.isArray(body.scopes) ? body.scopes.filter((item) => typeof item === "string") : [];
  const workspaceId =
    typeof body.workspaceId === "string" && body.workspaceId.trim().length > 0
      ? body.workspaceId.trim()
      : readWorkspaceId(request, env.DEFAULT_WORKSPACE_ID || DEFAULT_WORKSPACE);

  if (!provider || !accountId || !accessToken) {
    return json({ error: "provider, accountId, and accessToken are required" }, { status: 400 });
  }

  const stored = await upsertOAuthToken(env.DB, {
    provider,
    accountId,
    workspaceId,
    accessToken,
    refreshToken,
    expiresAt,
    scopes
  });

  await safeAuditEvent(env, request, {
    workspaceId: stored.workspaceId,
    action: "oauth_token_upsert",
    resourceType: "oauth_token",
    resourceId: `${stored.provider}:${stored.accountId}`,
    details: {
      expiresAt: stored.expiresAt,
      scopes: stored.scopes
    }
  });

  return json(
    {
      accepted: true,
      provider: stored.provider,
      accountId: stored.accountId,
      workspaceId: stored.workspaceId,
      accessToken: redactToken(stored.accessToken),
      refreshToken: redactToken(stored.refreshToken),
      expiresAt: stored.expiresAt,
      needsRefresh: oauthTokenNeedsRefresh(stored.expiresAt),
      scopes: stored.scopes
    },
    { status: 202 }
  );
}

async function getAuditEvents(url: URL, env: Env) {
  const workspaceId = readWorkspaceFilter(url);
  const limit = parseLimit(url.searchParams.get("limit"));
  const clauses: string[] = [];
  const bindings: unknown[] = [];
  withWorkspaceClause(clauses, bindings, workspaceId);

  let query = `SELECT
    id,
    workspace_id AS workspaceId,
    actor,
    action,
    resource_type AS resourceType,
    resource_id AS resourceId,
    details_json AS detailsJson,
    created_at AS createdAt
  FROM audit_events`;
  if (clauses.length > 0) {
    query += ` WHERE ${clauses.join(" AND ")}`;
  }
  query += ` ORDER BY created_at DESC LIMIT ?${bindings.length + 1}`;
  bindings.push(limit);

  const rows = await env.DB.prepare(query).bind(...bindings).all<{
    id: number;
    workspaceId: string;
    actor: string;
    action: string;
    resourceType: string;
    resourceId: string | null;
    detailsJson: string;
    createdAt: string;
  }>();

  return json({
    limit,
    workspaceId,
    events: rows.results.map((row) => {
      let details: unknown = {};
      try {
        details = JSON.parse(row.detailsJson || "{}");
      } catch {
        details = {};
      }
      return {
        id: row.id,
        workspaceId: row.workspaceId,
        actor: row.actor,
        action: row.action,
        resourceType: row.resourceType,
        resourceId: row.resourceId,
        details,
        createdAt: row.createdAt
      };
    })
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const pathname = routePath(url);

    if (pathname === "/health") {
      return json({ ok: true, env: env.ENV_NAME, worker: "ops-dashboard" });
    }

    if (request.method === "GET" && (pathname === "/favicon.svg" || pathname === "/favicon.ico")) {
      return new Response(FAVICON_SVG, {
        headers: {
          "content-type": "image/svg+xml; charset=utf-8",
          "cache-control": "public, max-age=86400"
        }
      });
    }

    if (request.method === "GET" && (pathname === "/app.js" || pathname === "/api/app.js")) {
      const html = buildDashboardHtml(env);
      const script = extractInlineDashboardScript(html);
      if (!script) {
        return json({ error: "dashboard script unavailable" }, { status: 500 });
      }
      return new Response(script, {
        headers: {
          "content-type": "application/javascript; charset=utf-8",
          "cache-control": "no-store"
        }
      });
    }

    if (request.method === "GET" && pathname === "/") {
      return new Response(buildDashboardHtml(env), {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store"
        }
      });
    }

    if (!pathname.startsWith("/api/")) {
      return json({ error: "not found" }, { status: 404 });
    }

    const access = dashboardAccess(request, env);
    if (access === "none") {
      return unauthorizedResponse();
    }

    if (request.method !== "GET" && access !== "write") {
      return forbiddenResponse();
    }

    const manifest = resolveRuntimeManifest(env);
    const routesManifest = manifest.routes;
    const schedulesManifest = manifest.schedules;
    const dashboardExtensions = readDashboardExtensions(env);

    if (request.method === "GET" && pathname === "/api/meta") {
      return json({
        env: env.ENV_NAME,
        worker: "ops-dashboard",
        manifestMode: manifest.mode,
        routes: routesManifest.length,
        schedules: schedulesManifest.length,
        extensions: dashboardExtensions.length,
        rateLimits: {
          defaultPerMinute: Number.parseInt(env.API_RATE_LIMIT_PER_MINUTE || "0", 10) || 0,
          byRoute: parseRouteRateLimitConfig(env)
        }
      });
    }

    if (request.method === "GET" && pathname === "/api/extensions") {
      return json({
        extensions: dashboardExtensions
      });
    }

    if (request.method === "GET" && pathname === "/api/templates") {
      return getTemplates();
    }

    if (request.method === "GET" && pathname === "/api/oauth-tokens") {
      return getOAuthTokens(url, env);
    }

    if (request.method === "POST" && pathname === "/api/oauth-tokens/upsert") {
      return upsertOAuthTokenEndpoint(request, env);
    }

    if (request.method === "GET" && pathname === "/api/audit-events") {
      return getAuditEvents(url, env);
    }

    if (request.method === "GET" && pathname === "/api/summary") {
      return getSummary(url, env);
    }

    if (request.method === "GET" && pathname === "/api/catalog") {
      return getCatalog(url, env, routesManifest, schedulesManifest);
    }

    if (request.method === "GET" && pathname === "/api/runs") {
      return getRuns(url, env);
    }

    if (request.method === "GET" && pathname.startsWith("/api/run-detail/")) {
      const traceId = traceIdFromRunDetailPath(pathname);
      if (!traceId) {
        return json({ error: "invalid run detail path" }, { status: 404 });
      }
      return getRunDetail(traceId, env);
    }

    if (request.method === "GET" && pathname === "/api/dead-letters") {
      return getDeadLetters(url, env);
    }

    if (request.method === "POST" && pathname.startsWith("/api/retry/")) {
      return retryDeadLetter(request, pathname, env, routesManifest, schedulesManifest);
    }

    if (request.method === "POST" && pathname.startsWith("/api/replay/")) {
      return replayFailedRun(request, pathname, env, routesManifest, schedulesManifest);
    }

    if (request.method === "GET" && pathname === "/api/replays") {
      return getReplays(url, env);
    }

    if (request.method === "GET" && pathname.startsWith("/api/route-detail/")) {
      const targetRoute = routePathFromDetailPath(pathname);
      if (!targetRoute) {
        return json({ error: "invalid route detail path" }, { status: 404 });
      }
      return getRouteDetail(targetRoute, env, routesManifest);
    }

    if (request.method === "GET" && pathname.startsWith("/api/cron-detail/")) {
      const scheduleId = scheduleIdFromDetailPath(pathname);
      if (!scheduleId) {
        return json({ error: "invalid cron detail path" }, { status: 404 });
      }
      return getCronDetail(scheduleId, env, schedulesManifest);
    }

    if (request.method === "POST" && pathname.startsWith("/api/cron-run/")) {
      const scheduleId = scheduleIdFromRunPath(pathname);
      if (!scheduleId) {
        return json({ error: "invalid cron run path" }, { status: 404 });
      }
      return enqueueManualScheduleRun(request, scheduleId, env, schedulesManifest);
    }

    if (request.method === "GET" && pathname === "/api/timeline") {
      return getTimeline(url, env);
    }

    if (request.method === "GET" && pathname === "/api/timeline-detail") {
      return getTimelineDetail(url, env);
    }

    if (request.method === "GET" && pathname === "/api/error-clusters") {
      return getErrorClusters(url, env);
    }

    if (request.method === "GET" && pathname === "/api/secrets-health") {
      return getSecretsHealth(env);
    }

    return json({ error: "not found" }, { status: 404 });
  }
};
