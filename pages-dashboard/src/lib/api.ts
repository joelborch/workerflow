import type {
  AuditEventsResponse,
  CatalogResponse,
  DeadLettersResponse,
  ErrorClustersResponse,
  RunDetailResponse,
  RunsResponse,
  SecretsHealthResponse,
  SummaryResponse,
  TemplatesResponse,
  TimelineDetailResponse,
  TimelineResponse
} from "../types";

const DEFAULT_API_BASE_URL = "http://127.0.0.1:8787";

export function getApiBaseUrl() {
  const raw = import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL;
  return raw.replace(/\/+$/, "");
}

export function getDefaultOpsToken() {
  return String(import.meta.env.VITE_OPS_DASHBOARD_TOKEN || "").trim();
}

type FetchOptions = {
  path: string;
  token?: string;
};

type JsonRequestOptions = FetchOptions & {
  method: "GET" | "POST";
  defaultError: (status: number) => string;
};

export type TimeWindowParams = {
  since?: string;
  until?: string;
  hours?: number;
};

export type RunsFilterParams = {
  status?: string;
  routePath?: string;
  scheduleId?: string;
  kind?: string;
  workspaceId?: string;
  limit?: number;
};

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function requestJson<T>({ path, token, method, defaultError }: JsonRequestOptions): Promise<T> {
  const url = `${getApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
  const headers: HeadersInit = { "content-type": "application/json" };
  if (token && token.trim().length > 0) {
    headers.authorization = `Bearer ${token.trim()}`;
  }

  const response = await fetch(url, { method, headers });
  const payload = await response.json().catch(() => null);
  if (response.ok) {
    return payload as T;
  }

  const message = payload && typeof payload === "object" && "error" in payload
    ? String((payload as { error: unknown }).error)
    : defaultError(response.status);
  throw new ApiError(message, response.status);
}

export async function apiGet<T>({ path, token }: FetchOptions): Promise<T> {
  try {
    return await requestJson<T>({ path, token, method: "GET", defaultError: (status) => `Request failed (${status})` });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    const url = `${getApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
    throw new ApiError(`Network request failed for ${url}`, 0);
  }
}

function buildQuery(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") {
      continue;
    }
    query.set(key, String(value));
  }
  const encoded = query.toString();
  return encoded ? `?${encoded}` : "";
}

export function loadSummary(token: string, window: TimeWindowParams = {}) {
  const path = `/api/ops/summary${buildQuery(window)}`;
  return apiGet<SummaryResponse>({ path, token });
}

export function loadTimeline(token: string, params: TimeWindowParams & { bucket?: "hour" | "minute" } = {}) {
  const query = buildQuery({
    bucket: params.bucket ?? "hour",
    since: params.since,
    until: params.until,
    hours: params.hours
  });
  return apiGet<TimelineResponse>({ path: `/api/ops/timeline${query}`, token });
}

export function loadCatalog(token: string, window: TimeWindowParams = {}) {
  const path = `/api/ops/catalog${buildQuery(window)}`;
  return apiGet<CatalogResponse>({ path, token });
}

export function loadRuns(token: string, filters: RunsFilterParams = {}) {
  const path = `/api/ops/runs${buildQuery({
    status: filters.status,
    routePath: filters.routePath,
    scheduleId: filters.scheduleId,
    kind: filters.kind,
    workspace: filters.workspaceId,
    limit: filters.limit ?? 80
  })}`;
  return apiGet<RunsResponse>({ path, token });
}

export function loadDeadLetters(token: string) {
  return apiGet<DeadLettersResponse>({ path: "/api/ops/dead-letters?limit=20", token });
}

export function loadErrorClusters(token: string, params: TimeWindowParams & { limit?: number } = {}) {
  const query = buildQuery({
    limit: params.limit ?? 12,
    since: params.since,
    until: params.until,
    hours: params.hours
  });
  return apiGet<ErrorClustersResponse>({ path: `/api/ops/error-clusters${query}`, token });
}

export function loadSecretsHealth(token: string) {
  return apiGet<SecretsHealthResponse>({ path: "/api/ops/secrets-health", token });
}

export function loadTemplates(token: string) {
  return apiGet<TemplatesResponse>({ path: "/api/ops/templates", token });
}

export function loadAuditEvents(token: string, params: { workspaceId?: string; limit?: number } = {}) {
  const query = buildQuery({
    workspace: params.workspaceId,
    limit: params.limit ?? 30
  });
  return apiGet<AuditEventsResponse>({ path: `/api/ops/audit-events${query}`, token });
}

export function loadTimelineDetail(
  token: string,
  params: { bucket: string; resolution: "hour" | "minute"; limit?: number }
) {
  const query = buildQuery({
    bucket: params.bucket,
    resolution: params.resolution,
    limit: params.limit ?? 16
  });
  return apiGet<TimelineDetailResponse>({ path: `/api/ops/timeline-detail${query}`, token });
}

export function loadRunDetail(token: string, traceId: string) {
  const encoded = encodeURIComponent(traceId);
  return apiGet<RunDetailResponse>({ path: `/api/ops/run-detail/${encoded}`, token });
}

export async function replayRun(token: string, traceId: string) {
  const encoded = encodeURIComponent(traceId);
  return requestJson<{
    accepted: boolean;
    retriedFromTraceId: string;
    newTraceId: string;
    retryCount: number | null;
  }>({
    path: `/api/ops/replay/${encoded}`,
    token,
    method: "POST",
    defaultError: (status) => `Replay request failed (${status})`
  });
}
