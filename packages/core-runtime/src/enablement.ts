import type { CoreQueueTask, CoreRouteDefinition, CoreScheduleDefinition } from "./types";

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

function hasKnownRoute(routePath: string, routes: CoreRouteDefinition[]) {
  return routes.some((route) => route.routePath === routePath);
}

function hasEnabledSchedule(scheduleId: string, schedules: CoreScheduleDefinition[]) {
  return schedules.some((schedule) => schedule.id === scheduleId && schedule.enabled);
}

export function checkTaskReplayEnablement(
  task: CoreQueueTask,
  env: RouteGateEnv,
  routes: CoreRouteDefinition[],
  schedules: CoreScheduleDefinition[]
) {
  if (task.kind === "http_route") {
    if (!task.routePath) {
      return { enabled: false as const, reason: "http_route task missing routePath" };
    }

    if (!hasKnownRoute(task.routePath, routes)) {
      return { enabled: false as const, reason: `route "${task.routePath}" is not registered` };
    }

    if (!isRouteEnabled(task.routePath, env)) {
      return { enabled: false as const, reason: `route "${task.routePath}" is disabled` };
    }

    return { enabled: true as const };
  }

  if (task.kind === "scheduled_job") {
    if (!task.scheduleId) {
      return { enabled: false as const, reason: "scheduled_job task missing scheduleId" };
    }

    if (!hasEnabledSchedule(task.scheduleId, schedules)) {
      return { enabled: false as const, reason: `schedule "${task.scheduleId}" is not enabled` };
    }

    return { enabled: true as const };
  }

  return { enabled: false as const, reason: `task kind "${String(task.kind)}" is not supported` };
}
