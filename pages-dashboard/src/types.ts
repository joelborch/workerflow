export type SummaryResponse = {
  windowHours: number;
  since: string;
  until?: string;
  totalRuns: number;
  succeededRuns: number;
  failedRuns: number;
  startedRuns: number;
  deadLetters: number;
  topRoutes: Array<{ routePath: string; count: number }>;
};

export type TimelineResponse = {
  bucket: "hour" | "minute";
  since: string;
  until?: string;
  buckets: Array<{
    bucket: string;
    succeeded: number;
    failed: number;
    running: number;
    total: number;
    topFailureScope: string | null;
    topFailureCount: number;
  }>;
};

export type RunsResponse = {
  limit: number;
  filters?: {
    status: string | null;
    routePath: string | null;
    scheduleId: string | null;
    kind: string | null;
    workspaceId?: string | null;
  };
  runs: Array<{
    traceId: string;
    workspaceId?: string | null;
    kind: string;
    routePath: string | null;
    scheduleId: string | null;
    status: string;
    startedAt: string;
    finishedAt: string | null;
    duration: string | null;
    output: string | null;
    error: string | null;
  }>;
};

export type CatalogResponse = {
  since: string;
  until?: string;
  windowHours: number;
  routes: Array<{
    routePath: string;
    requestType: "sync" | "async";
    flowPath: string;
    wrapBody: boolean;
    succeeded: number;
    failed: number;
    started: number;
    total: number;
  }>;
  schedules: Array<{
    id: string;
    cron: string;
    target: string;
    timeZone: string;
    enabled: boolean;
    succeeded: number;
    failed: number;
    started: number;
    total: number;
  }>;
  flows: Array<{
    flowPath: string;
    httpRoutes: string[];
    schedules: string[];
    succeeded: number;
    failed: number;
    started: number;
    total: number;
  }>;
};

export type DeadLettersResponse = {
  limit: number;
  workspaceId?: string | null;
  deadLetters: Array<{
    id: number;
    traceId: string;
    workspaceId?: string | null;
    createdAt: string;
    error: string;
  }>;
};

export type ErrorClustersResponse = {
  since: string;
  until?: string;
  workspaceId?: string | null;
  clusters: Array<{
    key: string;
    count: number;
    sample: string;
    scope: string;
    latestAt: string | null;
  }>;
};

export type TimelineDetailResponse = {
  bucket: string;
  resolution: "hour" | "minute";
  workspaceId?: string | null;
  window: {
    start: string;
    end: string;
  };
  statusCounts: {
    succeeded: number;
    failed: number;
    running: number;
    total: number;
  };
  topScopes: Array<{
    scope: string;
    count: number;
  }>;
  runs: Array<{
    traceId: string;
    workspaceId?: string | null;
    kind: string;
    routePath: string | null;
    scheduleId: string | null;
    status: string;
    startedAt: string;
    duration: string | null;
    error: string | null;
  }>;
};

export type RunDetailResponse = {
  traceId: string;
  run: {
    traceId: string;
    workspaceId?: string | null;
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
  deadLetter: {
    id: number;
    workspaceId?: string | null;
    payloadJson: string;
    error: string;
    createdAt: string;
  } | null;
  retries: {
    parentTraceId: string;
    attempts: Array<{
      parentTraceId: string;
      childTraceId: string;
      retryCount: number;
      createdAt: string;
      childStatus: string | null;
    }>;
  };
};

export type SecretsHealthResponse = {
  available: boolean;
  ok?: boolean;
  env?: string;
  worker?: string;
  reason?: string;
  errors?: string[];
  connectors?: Array<{
    id: string;
    status: "ready" | "partial" | "missing";
    requiredSecrets: string[];
    missingSecrets: string[];
    presentSecrets: string[];
    routes: string[];
  }>;
};

export type TemplatesResponse = {
  templates: Array<{
    id: string;
    name: string;
    category: string;
    description: string;
    routes: string[];
    schedules: string[];
  }>;
};

export type AuditEventsResponse = {
  limit: number;
  workspaceId?: string | null;
  events: Array<{
    id: number;
    workspaceId: string;
    actor: string;
    action: string;
    resourceType: string;
    resourceId: string | null;
    details: Record<string, unknown>;
    createdAt: string;
  }>;
};
