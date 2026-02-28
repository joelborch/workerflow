import { ROUTES } from "../../../shared/routes";
import { SCHEDULES } from "../../../shared/schedules";
import { isRouteEnabled } from "../../../shared/task_enablement";
import type { Env, QueueTask, RouteDefinition, ScheduleDefinition } from "../../../shared/types";

type RuntimeEnv = Record<string, unknown>;

function hasValue(env: RuntimeEnv, key: string) {
  const raw = env[key];
  if (raw === undefined || raw === null) {
    return false;
  }
  return String(raw).trim().length > 0;
}

function hasAnyValue(env: RuntimeEnv, keys: string[]) {
  return keys.some((key) => hasValue(env, key));
}

function requireAny(env: RuntimeEnv, errors: string[], context: string, label: string, keys: string[]) {
  if (hasAnyValue(env, keys)) {
    return;
  }
  errors.push(`${context}: missing ${label}. Checked: ${keys.join(", ")}`);
}

function validateHttpRoute(routePath: string, env: RuntimeEnv, errors: string[]) {
  const context = `route "${routePath}"`;

  switch (routePath) {
    case "chat_notify":
    case "incident_create":
      requireAny(env, errors, context, "chat webhook URL", [
        "CHAT_WEBHOOK_URL",
        "GCHAT_ALERTS_WEBHOOK_URL",
        "GCHAT_ALERTS_WEBHOOK"
      ]);
      return;
    case "slack_message":
      requireAny(env, errors, context, "Slack webhook URL", ["SLACK_WEBHOOK_URL"]);
      return;
    case "github_issue_create":
      requireAny(env, errors, context, "GitHub token", ["GITHUB_TOKEN"]);
      return;
    case "openai_chat":
      requireAny(env, errors, context, "OpenAI API key", ["OPENAI_API_KEY"]);
      return;
    case "lead_normalizer":
      requireAny(env, errors, context, "Google AI key", ["GOOGLEAI_API_KEY", "LEAD_NORMALIZER_API_KEY"]);
      return;
    default:
      return;
  }
}

function validateSchedule(scheduleId: string, env: RuntimeEnv, errors: string[]) {
  const context = `schedule "${scheduleId}"`;

  switch (scheduleId) {
    case "cleanup_daily":
      requireAny(env, errors, context, "cleanup signing secret", ["CLEANUP_SIGNING_SECRET"]);
      return;
    default:
      return;
  }
}

export function validateTaskConfig(task: QueueTask, env: Env) {
  const errors: string[] = [];
  const envRecord = env as unknown as RuntimeEnv;

  if (task.kind === "http_route" && task.routePath) {
    validateHttpRoute(task.routePath, envRecord, errors);
    return errors;
  }

  if (task.kind === "scheduled_job" && task.scheduleId) {
    validateSchedule(task.scheduleId, envRecord, errors);
    return errors;
  }

  return errors;
}

type ManifestValidationOptions = {
  routes?: RouteDefinition[];
  schedules?: ScheduleDefinition[];
};

export function validateEnabledManifestConfig(env: Env, manifest?: ManifestValidationOptions) {
  const errors: string[] = [];
  const envRecord = env as unknown as RuntimeEnv;
  const routes = manifest?.routes ?? ROUTES;
  const schedules = manifest?.schedules ?? SCHEDULES;

  for (const route of routes) {
    if (!isRouteEnabled(route.routePath, envRecord)) {
      continue;
    }
    validateHttpRoute(route.routePath, envRecord, errors);
  }

  for (const schedule of schedules) {
    if (!schedule.enabled) {
      continue;
    }
    validateSchedule(schedule.id, envRecord, errors);
  }

  return errors;
}
