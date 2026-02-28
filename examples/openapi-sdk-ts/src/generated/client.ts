/* eslint-disable */
/**
 * GENERATED FILE - DO NOT EDIT DIRECTLY
 * Source: cloudflare/openapi.json
 * Generated: 2026-02-28T20:37:22.280Z
 */

export type WorkerFlowClientOptions = {
  baseUrl: string;
  token?: string;
  fetchImpl?: typeof fetch;
};

export type HealthResponse = {
  worker: string;
  time: string;
};

export type ErrorResponse = {
  error: string;
  details?: Array<string>;
  traceId?: string;
  routePath?: string;
};

export type RouteInvokeRequest = {
  [key: string]: unknown;
};

export type RouteAcceptedResponse = {
  accepted: boolean;
  traceId: string;
  routePath: string;
  requestType: "sync" | "async";
  workspaceId: string;
};

export type RouteSyncResponse = {
  traceId: string;
  result: {
    [key: string]: unknown;
  };
};

export type TopRoute = {
  routePath: string;
  count: number;
};

export type SummaryResponse = {
  windowHours: number;
  since: string;
  until: string;
  totalRuns: number;
  succeededRuns: number;
  failedRuns: number;
  startedRuns: number;
  deadLetters: number;
  topRoutes: Array<TopRoute>;
};

export type RunListItem = {
  traceId: string;
  workspaceId: string;
  kind: string;
  routePath: string | null;
  scheduleId: string | null;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  duration: string | null;
  output: string | null;
  error: string | null;
};

export type RunsResponse = {
  limit: number;
  runs: Array<RunListItem>;
};

export type DeadLetterRecord = {
  id: number;
  traceId: string;
  workspaceId: string | null;
  error: string;
  createdAt: string;
  payloadJson: string;
};

export type DeadLettersResponse = {
  limit: number;
  deadLetters: Array<DeadLetterRecord>;
};

export type ReplayResponse = {
  accepted: boolean;
  retriedFromTraceId: string;
  newTraceId: string;
  retryCount: number | null;
};

export type GetApiHealthResponse = HealthResponse;
export type PostApiRoutePathResponse = RouteSyncResponse | RouteAcceptedResponse | ErrorResponse;
export type GetApiOpsSummaryResponse = SummaryResponse | ErrorResponse;
export type GetApiOpsRunsResponse = RunsResponse | ErrorResponse;
export type GetApiOpsDeadLettersResponse = DeadLettersResponse | ErrorResponse;
export type PostApiOpsReplayTraceIdResponse = ReplayResponse | ErrorResponse;

export type PostApiRoutePathRequest = RouteInvokeRequest;
export type GetApiOpsSummaryQuery = {
  since?: string;
  until?: string;
  hours?: number;
};
export type GetApiOpsRunsQuery = {
  status?: string;
  routePath?: string;
  scheduleId?: string;
  kind?: string;
  workspace?: string;
  limit?: number;
};
export type GetApiOpsDeadLettersQuery = {
  limit?: number;
};

export class WorkerFlowClient {
  private baseUrl: string;
  private token: string;
  private fetchImpl: typeof fetch;

  constructor(options: WorkerFlowClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.token = options.token?.trim() || "";
    this.fetchImpl = options.fetchImpl || fetch;
  }

  private toQueryString(query: Record<string, string | number | boolean | null | undefined>) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") {
        continue;
      }
      params.set(key, String(value));
    }
    const encoded = params.toString();
    return encoded ? `?${encoded}` : "";
  }

  private async request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    const headers: HeadersInit = {
      "content-type": "application/json"
    };

    if (this.token) {
      headers.authorization = `Bearer ${this.token}`;
    }

    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {})
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const errorMessage =
        payload && typeof payload === "object" && "error" in payload
          ? String((payload as { error: unknown }).error)
          : `WorkerFlow API request failed (${response.status})`;
      throw new Error(errorMessage);
    }

    return payload as T;
  }

  async getApiHealth(): Promise<GetApiHealthResponse> {
    return this.request<GetApiHealthResponse>("GET", `/api/health`);
  }

  async postApiRoutePath(routePath: string, body: PostApiRoutePathRequest): Promise<PostApiRoutePathResponse> {
    return this.request<PostApiRoutePathResponse>("POST", `/api/${encodeURIComponent(routePath)}`, body);
  }

  async getApiOpsSummary(query: GetApiOpsSummaryQuery = {}): Promise<GetApiOpsSummaryResponse> {
    return this.request<GetApiOpsSummaryResponse>("GET", `/api/ops/summary${this.toQueryString(query)}`);
  }

  async getApiOpsRuns(query: GetApiOpsRunsQuery = {}): Promise<GetApiOpsRunsResponse> {
    return this.request<GetApiOpsRunsResponse>("GET", `/api/ops/runs${this.toQueryString(query)}`);
  }

  async getApiOpsDeadLetters(query: GetApiOpsDeadLettersQuery = {}): Promise<GetApiOpsDeadLettersResponse> {
    return this.request<GetApiOpsDeadLettersResponse>("GET", `/api/ops/dead-letters${this.toQueryString(query)}`);
  }

  async postApiOpsReplayTraceId(traceId: string): Promise<PostApiOpsReplayTraceIdResponse> {
    return this.request<PostApiOpsReplayTraceIdResponse>("POST", `/api/ops/replay/${encodeURIComponent(traceId)}`);
  }
}
