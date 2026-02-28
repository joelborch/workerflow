/* eslint-disable */
/**
 * GENERATED FILE - DO NOT EDIT DIRECTLY
 * Source: cloudflare/openapi.json
 * Generated: 2026-02-28T19:58:46.609Z
 */

export type WorkerFlowClientOptions = {
  baseUrl: string;
  token?: string;
  fetchImpl?: typeof fetch;
};

export type GetApiHealthResponse = unknown;
export type PostApiRoutePathResponse = unknown;
export type GetApiSummaryResponse = unknown;
export type GetApiExtensionsResponse = unknown;

export class WorkerFlowClient {
  private baseUrl: string;
  private token: string;
  private fetchImpl: typeof fetch;

  constructor(options: WorkerFlowClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.token = options.token?.trim() || "";
    this.fetchImpl = options.fetchImpl || fetch;
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

  async postApiRoutePath(routePath: string, body: unknown): Promise<PostApiRoutePathResponse> {
    return this.request<PostApiRoutePathResponse>("POST", `/api/${encodeURIComponent(routePath)}`, body);
  }

  async getApiSummary(): Promise<GetApiSummaryResponse> {
    return this.request<GetApiSummaryResponse>("GET", `/api/summary`);
  }

  async getApiExtensions(): Promise<GetApiExtensionsResponse> {
    return this.request<GetApiExtensionsResponse>("GET", `/api/extensions`);
  }
}
