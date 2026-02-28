export type RequestMode = "sync" | "async";

export type RouteDefinition = {
  routePath: string;
  requestType: RequestMode;
  flowPath: string;
  wrapBody: boolean;
};

export type ScheduleDefinition = {
  id: string;
  cron: string;
  enabled: boolean;
  target: string;
  timeZone: string;
};

export type QueueTaskKind = "http_route" | "scheduled_job";

export type QueueTask = {
  kind: QueueTaskKind;
  traceId: string;
  workspaceId?: string;
  routePath?: string;
  scheduleId?: string;
  payload?: unknown;
  enqueuedAt: string;
};

export interface Env {
  DB: D1Database;
  AUTOMATION_QUEUE: Queue<QueueTask>;
  WORKFLOW_SERVICE: Fetcher;
  ENV_NAME: string;
  MANIFEST_MODE?: string;
  ROUTES_CONFIG_JSON?: string;
  SCHEDULES_CONFIG_JSON?: string;
  ENABLED_HTTP_ROUTES?: string;
  DISABLED_HTTP_ROUTES?: string;
  API_INGRESS_TOKEN?: string;
  API_HMAC_SECRET?: string;
  API_HMAC_MAX_SKEW_SECONDS?: string;
  API_RATE_LIMIT_PER_MINUTE?: string;
  API_ROUTE_LIMITS_JSON?: string;
  DEFAULT_WORKSPACE_ID?: string;
  LEGACY_ALERT_WEBHOOK_URL?: string;
  CHAT_WEBHOOK_URL?: string;
  FANOUT_SHARED_WEBHOOK_URL?: string;
  CLEANUP_SIGNING_SECRET?: string;
  LEAD_NORMALIZER_API_KEY?: string;
  GCHAT_ALERTS_WEBHOOK?: string;
  GCHAT_ALERTS_WEBHOOK_URL?: string;
  GOOGLEAI_API_KEY?: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  SLACK_WEBHOOK_URL?: string;
  GITHUB_TOKEN?: string;
  GITHUB_REPO?: string;
  STRIPE_API_KEY?: string;
  NOTION_TOKEN?: string;
  HUBSPOT_ACCESS_TOKEN?: string;
}

export type SyncHttpPassthrough = {
  responseType: "http_passthrough";
  status: number;
  headers?: Record<string, string>;
  body: string;
};

export function isSyncHttpPassthrough(value: unknown): value is SyncHttpPassthrough {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<SyncHttpPassthrough>;
  if (candidate.responseType !== "http_passthrough") {
    return false;
  }

  if (typeof candidate.status !== "number" || !Number.isInteger(candidate.status)) {
    return false;
  }

  if (typeof candidate.body !== "string") {
    return false;
  }

  if (candidate.headers !== undefined && (candidate.headers === null || typeof candidate.headers !== "object")) {
    return false;
  }

  return true;
}
