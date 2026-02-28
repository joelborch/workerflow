import { json } from "../../../shared/http";
import { resolveRuntimeManifest } from "../../../shared/manifest";
import type { Env, QueueTask, SyncHttpPassthrough } from "../../../shared/types";
import { validateEnabledManifestConfig, validateTaskConfig } from "./config_validation";
import { CRON_SCHEDULE_HANDLERS } from "./handlers/cron";
import { HTTP_ROUTE_HANDLERS } from "./handlers/http";
import { errorContract } from "./lib/errors";
import { resolveWorkflowSecretsStore } from "./secrets_store";

type HttpHandlerContext = {
  env: Env;
};

type CronHandlerContext = {
  env: Env;
  scheduleId: string;
};

type HttpHandlerWithContext = (
  requestPayload: unknown,
  traceId: string,
  context?: HttpHandlerContext
) => unknown | Promise<unknown>;

async function runHttpRoute(task: QueueTask, env: Env): Promise<unknown | SyncHttpPassthrough> {
  const routePath = task.routePath;
  if (!routePath) {
    throw new Error("http_route task missing routePath");
  }

  const handler = HTTP_ROUTE_HANDLERS[routePath];
  if (!handler) {
    throw new Error(`No HTTP handler registered for route "${routePath}"`);
  }

  return await (handler as HttpHandlerWithContext)(task.payload, task.traceId, {
    env
  });
}

async function runScheduledJob(task: QueueTask, env: Env) {
  const scheduleId = task.scheduleId;
  if (!scheduleId) {
    throw new Error("scheduled_job task missing scheduleId");
  }

  const handler = CRON_SCHEDULE_HANDLERS[scheduleId];
  if (!handler) {
    throw new Error(`No cron handler registered for schedule "${scheduleId}"`);
  }

  return (
    handler as (payload: unknown, traceId: string, context?: CronHandlerContext) => unknown | Promise<unknown>
  )(
    task.payload,
    task.traceId,
    {
      env,
      scheduleId
    }
  );
}

async function executeTask(task: QueueTask, env: Env): Promise<unknown | SyncHttpPassthrough> {
  if (task.kind === "http_route") {
    return runHttpRoute(task, env);
  }
  if (task.kind === "scheduled_job") {
    return runScheduledJob(task, env);
  }
  throw new Error(`Unsupported task kind "${task.kind}"`);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const resolvedEnv = await resolveWorkflowSecretsStore(env);
    const manifest = resolveRuntimeManifest(resolvedEnv);
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return json({ ok: true, env: resolvedEnv.ENV_NAME, worker: "workflow" });
    }
    if (url.pathname === "/health/config") {
      const configErrors = validateEnabledManifestConfig(resolvedEnv, {
        routes: manifest.routes,
        schedules: manifest.schedules
      });
      return json({
        ok: configErrors.length === 0,
        env: resolvedEnv.ENV_NAME,
        worker: "workflow",
        manifestMode: manifest.mode,
        errors: configErrors
      });
    }

    if (request.method !== "POST") {
      return json({ error: "method not allowed" }, { status: 405 });
    }

    if (url.pathname !== "/run-sync" && url.pathname !== "/run-async") {
      return json({ error: "not found" }, { status: 404 });
    }

    const task = (await request.json()) as QueueTask;
    const configErrors = validateTaskConfig(task, resolvedEnv);
    if (configErrors.length > 0) {
      return json(
        {
          error: "missing required configuration",
          traceId: task.traceId,
          details: configErrors
        },
        { status: 500 }
      );
    }

    try {
      const result = await executeTask(task, resolvedEnv);
      return json(result);
    } catch (error) {
      const contract = errorContract(error);
      return json(
        {
          error: contract.code,
          message: contract.message,
          details: contract.details ?? null
        },
        { status: contract.status }
      );
    }
  }
};
