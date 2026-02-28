import { resolveRuntimeManifest as resolveRuntimeManifestCore } from "../../packages/core-runtime/src/manifest";

import { ROUTES } from "./routes";
import { SCHEDULES } from "./schedules";
import type { RouteDefinition, ScheduleDefinition } from "./types";

type ManifestEnv = {
  MANIFEST_MODE?: string;
  ROUTES_CONFIG_JSON?: string;
  SCHEDULES_CONFIG_JSON?: string;
};

type RuntimeManifest = {
  mode: "legacy" | "config";
  routes: RouteDefinition[];
  schedules: ScheduleDefinition[];
};

export function resolveRuntimeManifest(env?: ManifestEnv): RuntimeManifest {
  return resolveRuntimeManifestCore(env, ROUTES, SCHEDULES) as RuntimeManifest;
}
