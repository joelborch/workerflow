import {
  checkTaskReplayEnablement as checkTaskReplayEnablementCore,
  isRouteEnabled as isRouteEnabledCore,
  parseRouteSet as parseRouteSetCore
} from "../../packages/core-runtime/src/enablement";

import { ROUTES } from "./routes";
import { SCHEDULES } from "./schedules";
import type { QueueTask, RouteDefinition, ScheduleDefinition } from "./types";

type RouteGateEnv = {
  ENABLED_HTTP_ROUTES?: string;
  DISABLED_HTTP_ROUTES?: string;
};

export function parseRouteSet(value: unknown) {
  return parseRouteSetCore(value);
}

export function isRouteEnabled(routePath: string, env: RouteGateEnv) {
  return isRouteEnabledCore(routePath, env);
}

type ReplayManifestOptions = {
  routes?: RouteDefinition[];
  schedules?: ScheduleDefinition[];
};

export function checkTaskReplayEnablement(task: QueueTask, env: RouteGateEnv, manifest?: ReplayManifestOptions) {
  const routes = manifest?.routes ?? ROUTES;
  const schedules = manifest?.schedules ?? SCHEDULES;
  return checkTaskReplayEnablementCore(task, env, routes, schedules);
}
