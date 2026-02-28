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

function isRouteDefinition(value: unknown): value is RouteDefinition {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<RouteDefinition>;
  return (
    typeof candidate.routePath === "string" &&
    (candidate.requestType === "sync" || candidate.requestType === "async") &&
    typeof candidate.flowPath === "string" &&
    typeof candidate.wrapBody === "boolean"
  );
}

function isScheduleDefinition(value: unknown): value is ScheduleDefinition {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<ScheduleDefinition>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.cron === "string" &&
    typeof candidate.enabled === "boolean" &&
    typeof candidate.target === "string" &&
    typeof candidate.timeZone === "string"
  );
}

function parseJsonArray<T>(
  raw: string | undefined,
  fallback: T[],
  validator: (value: unknown) => value is T,
  label: string
) {
  if (!raw || raw.trim().length === 0) {
    return fallback;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON array`);
  }

  const invalidIndex = parsed.findIndex((item) => !validator(item));
  if (invalidIndex >= 0) {
    throw new Error(`${label} has invalid item at index ${invalidIndex}`);
  }

  return parsed as T[];
}

export function resolveRuntimeManifest(env?: ManifestEnv): RuntimeManifest {
  const mode = env?.MANIFEST_MODE?.trim().toLowerCase() === "config" ? "config" : "legacy";

  if (mode === "legacy") {
    return {
      mode,
      routes: ROUTES,
      schedules: SCHEDULES
    };
  }

  return {
    mode,
    routes: parseJsonArray(env?.ROUTES_CONFIG_JSON, ROUTES, isRouteDefinition, "ROUTES_CONFIG_JSON"),
    schedules: parseJsonArray(
      env?.SCHEDULES_CONFIG_JSON,
      SCHEDULES,
      isScheduleDefinition,
      "SCHEDULES_CONFIG_JSON"
    )
  };
}
