import { recordAuditEvent } from "../../../shared/db";
import { decodePathParameter, json } from "../../../shared/http";
import { resolveRuntimeManifest } from "../../../shared/manifest";
import { parseRouteRateLimits } from "../../../shared/runtime_config";
import { timingSafeStringEqual } from "../../../shared/security";
import { listRuntimeConnectorSecrets } from "../../../shared/connector_registry";
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
  WORKFLOW_INTERNAL_TOKEN?: string;
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

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;
const MAX_TIME_WINDOW_MS = 31 * 24 * 60 * 60 * 1000;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 250;
const MAX_FILTER_LEN = 120;
const DEFAULT_WORKSPACE = "default";
const CONNECTOR_SECRETS: Array<{ id: string; requiredSecrets: string[]; routes: string[] }> = listRuntimeConnectorSecrets();

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

function runRangeContext(url: URL, additionalClauses: string[] = []) {
  const range = resolveTimeRange(url);
  const workspaceId = readWorkspaceFilter(url);
  const clauses = ["started_at >= ?1", "started_at <= ?2", ...additionalClauses];
  const bindings: unknown[] = [range.since, range.until];
  withWorkspaceClause(clauses, bindings, workspaceId);
  return { range, workspaceId, clauses, bindings };
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
    console.error("Ops dashboard tokens are not configured — denying all access");
    return "none";
  }

  const providedToken = readAuthToken(request);
  if (!providedToken) {
    return "none";
  }

  if (writeToken && timingSafeStringEqual(providedToken, writeToken)) {
    return "write";
  }

  if (readToken && timingSafeStringEqual(providedToken, readToken)) {
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

function mapRunRow(row: RunRow) {
  return {
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
  };
}

function countRowsByStatus(rows: Array<{ status: string; count: number | string }>) {
  return new Map(rows.map((row) => [row.status, toCount(row.count)]));
}

function routePath(url: URL) {
  const normalized = url.pathname.replace(/\/+$/, "");
  return normalized.length === 0 ? "/" : normalized;
}

function retryTraceIdFromPath(pathname: string) {
  return decodePathParameter(pathname, /^\/api\/retry\/([^/]+)$/);
}

function replayTraceIdFromPath(pathname: string) {
  return decodePathParameter(pathname, /^\/api\/replay\/([^/]+)$/);
}

function routePathFromDetailPath(pathname: string) {
  return decodePathParameter(pathname, /^\/api\/route-detail\/([^/]+)$/);
}

function scheduleIdFromDetailPath(pathname: string) {
  return decodePathParameter(pathname, /^\/api\/cron-detail\/([^/]+)$/);
}

function scheduleIdFromRunPath(pathname: string) {
  return decodePathParameter(pathname, /^\/api\/cron-run\/([^/]+)$/);
}

function traceIdFromRunDetailPath(pathname: string) {
  return decodePathParameter(pathname, /^\/api\/run-detail\/([^/]+)$/);
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

async function getSummary(url: URL, env: Env) {
  const { range, workspaceId, clauses: runClauses, bindings: runBindings } = runRangeContext(url);
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

  const countsByStatus = countRowsByStatus(statusRows.results);

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
  const { range, workspaceId, clauses: runClauses, bindings: runBindings } = runRangeContext(url);

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
    runs: rows.results.map(mapRunRow)
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
    run: mapRunRow(run),
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

type ScopeRunRow = {
  traceId: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  error: string | null;
};

async function fetchScopeRuns(env: Env, column: "route_path" | "schedule_id", id: string) {
  const rows = await env.DB
    .prepare(
      `SELECT
         trace_id AS traceId,
         status,
         started_at AS startedAt,
         finished_at AS finishedAt,
         error
       FROM runs
       WHERE ${column} = ?1
       ORDER BY started_at DESC
       LIMIT 200`
    )
    .bind(id)
    .all<ScopeRunRow>();
  const resultRows = rows.results;
  const durations = resultRows
    .map((item) => durationMs(item.startedAt, item.finishedAt))
    .filter((value): value is number => typeof value === "number");
  const lastSuccess = resultRows.find((item) => item.status === "succeeded");
  const lastFailure = resultRows.find((item) => item.status === "failed");
  const metrics = {
    total: resultRows.length,
    succeeded: resultRows.filter((item) => item.status === "succeeded").length,
    failed: resultRows.filter((item) => item.status === "failed").length,
    started: resultRows.filter((item) => item.status === "started" || item.status === "running").length,
    p95Duration: formatDuration(percentile(durations, 95)),
    lastSuccessAt: lastSuccess?.startedAt ?? null,
    lastFailureAt: lastFailure?.startedAt ?? null
  };
  const recentRuns = resultRows.slice(0, 50).map((item) => ({
    traceId: item.traceId,
    status: item.status,
    startedAt: item.startedAt,
    duration: formatDuration(durationMs(item.startedAt, item.finishedAt))
  }));
  return { resultRows, lastFailure, metrics, recentRuns };
}

async function getRouteDetail(routePath: string, env: Env, routesManifest: RouteDefinition[]) {
  const route = routesManifest.find((item) => item.routePath === routePath);
  if (!route) {
    return json({ error: "route not found", routePath }, { status: 404 });
  }

  const { resultRows, metrics, recentRuns } = await fetchScopeRuns(env, "route_path", routePath);
  const clusterMap = new Map<string, { count: number; sample: string }>();
  for (const row of resultRows) {
    if (row.status !== "failed" || !row.error) continue;
    const key = normalizeErrorForCluster(row.error);
    const existing = clusterMap.get(key) ?? { count: 0, sample: row.error };
    existing.count += 1;
    clusterMap.set(key, existing);
  }

  return json({
    route,
    metrics,
    errorClusters: [...clusterMap.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 8)
      .map((entry) => ({
        key: entry[0],
        count: entry[1].count,
        sample: entry[1].sample
      })),
    recentRuns
  });
}

async function getCronDetail(scheduleId: string, env: Env, schedulesManifest: ScheduleDefinition[]) {
  const schedule = schedulesManifest.find((item) => item.id === scheduleId);
  if (!schedule) {
    return json({ error: "schedule not found", scheduleId }, { status: 404 });
  }

  const { resultRows, lastFailure, metrics, recentRuns } = await fetchScopeRuns(env, "schedule_id", scheduleId);
  return json({
    schedule,
    metrics: {
      ...metrics,
      lastRunAt: resultRows[0]?.startedAt ?? null,
      lastFailureError: lastFailure?.error ?? null,
      nextRunAt: computeNextRun(schedule.cron, schedule.timeZone)
    },
    recentRuns
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
  const { range, workspaceId, clauses, bindings } = runRangeContext(url);

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

  const countsByStatus = countRowsByStatus(statusRows.results);
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
  const { range, workspaceId, clauses, bindings } = runRangeContext(url, [
    "status = 'failed'",
    "error IS NOT NULL",
    "error != ''"
  ]);

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
    const internalToken = env.WORKFLOW_INTERNAL_TOKEN?.trim();
    if (!internalToken) {
      return json({
        available: false,
        reason: "WORKFLOW_INTERNAL_TOKEN is not configured on ops-dashboard"
      });
    }
    const response = await env.WORKFLOW_SERVICE.fetch("http://workflow.internal/health/config", {
      method: "GET",
      headers: {
        "x-workflow-internal-token": internalToken
      }
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

    if (request.method === "GET" && pathname === "/") {
      return json({
        service: "workerflow-ops-dashboard",
        mode: "headless",
        endpoints: [
          "/health",
          "/api/meta",
          "/api/summary",
          "/api/catalog",
          "/api/runs",
          "/api/run-detail/{traceId}",
          "/api/dead-letters",
          "/api/retry/{traceId}",
          "/api/replay/{traceId}",
          "/api/replays",
          "/api/route-detail/{routePath}",
          "/api/cron-detail/{scheduleId}",
          "/api/cron-run/{scheduleId}",
          "/api/timeline",
          "/api/timeline-detail",
          "/api/error-clusters",
          "/api/secrets-health",
          "/api/oauth-tokens",
          "/api/audit-events"
        ]
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

    if (request.method === "GET" && pathname === "/api/meta") {
      return json({
        env: env.ENV_NAME,
        worker: "ops-dashboard",
        mode: "headless",
        manifestMode: manifest.mode,
        routes: routesManifest.length,
        schedules: schedulesManifest.length,
        rateLimits: {
          defaultPerMinute: Number.parseInt(env.API_RATE_LIMIT_PER_MINUTE || "0", 10) || 0,
          byRoute: parseRouteRateLimits(env.API_ROUTE_LIMITS_JSON)
        }
      });
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
