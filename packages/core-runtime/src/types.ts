export type RequestMode = "sync" | "async";

export type CoreRouteDefinition = {
  routePath: string;
  requestType: RequestMode;
  flowPath: string;
  wrapBody: boolean;
};

export type CoreScheduleDefinition = {
  id: string;
  cron: string;
  enabled: boolean;
  target: string;
  timeZone: string;
};

export type CoreQueueTask = {
  kind: "http_route" | "scheduled_job" | string;
  traceId: string;
  routePath?: string;
  scheduleId?: string;
};
