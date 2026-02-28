import type {
  CatalogResponse,
  DeadLettersResponse,
  ErrorClustersResponse,
  RunDetailResponse,
  RunsResponse,
  SummaryResponse,
  TimelineDetailResponse,
  TimelineResponse
} from "../types";

const DEFAULT_API_BASE_URL = "http://127.0.0.1:8787";
const FALLBACK_API_BASE_URL = "";

export function getApiBaseUrl() {
  const raw = import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL;
  return raw.replace(/\/+$/, "");
}

function getApiBaseUrls() {
  const primary = getApiBaseUrl();
  if (primary === DEFAULT_API_BASE_URL && FALLBACK_API_BASE_URL) {
    return [primary, FALLBACK_API_BASE_URL];
  }
  return [primary];
}

export function getDefaultOpsToken() {
  return String(import.meta.env.VITE_OPS_DASHBOARD_TOKEN || "").trim();
}

type FetchOptions = {
  path: string;
  token?: string;
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
  limit?: number;
};

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function apiGet<T>({ path, token }: FetchOptions): Promise<T> {
  const bases = getApiBaseUrls();
  let lastError: ApiError | null = null;

  for (let index = 0; index < bases.length; index += 1) {
    const base = bases[index];
    const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
    const headers: HeadersInit = {
      "content-type": "application/json"
    };

    if (token && token.trim().length > 0) {
      headers.authorization = `Bearer ${token.trim()}`;
    }

    try {
      const response = await fetch(url, {
        method: "GET",
        headers
      });

      const payload = await response.json().catch(() => null);

      if (response.ok) {
        return payload as T;
      }

      const message = payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error: unknown }).error)
        : `Request failed (${response.status})`;
      lastError = new ApiError(message, response.status);

      const contentType = response.headers.get("content-type") || "";
      const isBlockedHtml = response.status === 403 && contentType.includes("text/html");
      const hasFallback = index < bases.length - 1;
      if (isBlockedHtml && hasFallback) {
        continue;
      }
      throw lastError;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      const hasFallback = index < bases.length - 1;
      if (hasFallback) {
        continue;
      }
      throw new ApiError(`Network request failed for ${url}`, 0);
    }
  }

  throw lastError ?? new ApiError("Request failed", 0);
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
