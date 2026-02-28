import { ROUTES } from "./routes";
import { SCHEDULES } from "./schedules";
import type { QueueTask, RouteDefinition, ScheduleDefinition } from "./types";

type RouteGateEnv = {
  ENABLED_HTTP_ROUTES?: string;
  DISABLED_HTTP_ROUTES?: string;
};

export function parseRouteSet(value: unknown) {
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

export function isRouteEnabled(routePath: string, env: RouteGateEnv) {
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

function hasKnownRoute(routePath: string, routes: RouteDefinition[]) {
  return routes.some((route) => route.routePath === routePath);
}

function hasEnabledSchedule(scheduleId: string, schedules: ScheduleDefinition[]) {
  return schedules.some((schedule) => schedule.id === scheduleId && schedule.enabled);
}

type ReplayManifestOptions = {
  routes?: RouteDefinition[];
  schedules?: ScheduleDefinition[];
};

export function checkTaskReplayEnablement(task: QueueTask, env: RouteGateEnv, manifest?: ReplayManifestOptions) {
  const routes = manifest?.routes ?? ROUTES;
  const schedules = manifest?.schedules ?? SCHEDULES;

  if (task.kind === "http_route") {
    if (!task.routePath) {
      return { enabled: false, reason: "http_route task missing routePath" };
    }

    if (!hasKnownRoute(task.routePath, routes)) {
      return { enabled: false, reason: `route "${task.routePath}" is not registered` };
    }

    if (!isRouteEnabled(task.routePath, env)) {
      return { enabled: false, reason: `route "${task.routePath}" is disabled` };
    }

    return { enabled: true as const };
  }

  if (task.kind === "scheduled_job") {
    if (!task.scheduleId) {
      return { enabled: false, reason: "scheduled_job task missing scheduleId" };
    }

    if (!hasEnabledSchedule(task.scheduleId, schedules)) {
      return { enabled: false, reason: `schedule "${task.scheduleId}" is not enabled` };
    }

    return { enabled: true as const };
  }

  return { enabled: false, reason: `task kind "${String((task as { kind?: unknown }).kind)}" is not supported` };
}
