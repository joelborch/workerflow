import { ROUTES } from "../shared/routes";
import { SCHEDULES } from "../shared/schedules";
import type { Env } from "../shared/types";
import { CRON_SCHEDULE_HANDLERS } from "../workers/workflow/src/handlers/cron";
import { HTTP_ROUTE_HANDLERS } from "../workers/workflow/src/handlers/http";

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function makeDefaultEnv(): Env & Record<string, unknown> {
  return {
    DB: {} as D1Database,
    AUTOMATION_QUEUE: {
      async send() {
        return;
      }
    } as unknown as Queue<unknown>,
    WORKFLOW_SERVICE: {
      async fetch() {
        return jsonResponse({ ok: true });
      }
    } as unknown as Fetcher,
    ENV_NAME: "smoke",
    GOOGLEAI_API_KEY: "smoke-google-ai",
    OPENAI_API_KEY: "smoke-openai",
    GITHUB_TOKEN: "smoke-github-token",
    GITHUB_REPO: "workerflow/example",
    CHAT_WEBHOOK_URL: "https://chat.example/incoming",
    SLACK_WEBHOOK_URL: "https://hooks.slack.com/services/T000/B000/smoke",
    FANOUT_SHARED_WEBHOOK_URL: "https://hooks.example/default",
    CLEANUP_SIGNING_SECRET: "smoke-cleanup-secret"
  } as Env & Record<string, unknown>;
}

function buildMockFetch() {
  return async (input: RequestInfo | URL, _init?: RequestInit) => {
    const requestUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const url = new URL(requestUrl);

    if (url.hostname === "api.openai.com" && url.pathname === "/v1/chat/completions") {
      return jsonResponse({
        choices: [{ message: { content: "smoke-openai-completion" } }]
      });
    }

    if (url.hostname === "api.github.com" && url.pathname.endsWith("/issues")) {
      return jsonResponse({
        number: 101,
        html_url: "https://github.com/workerflow/example/issues/101"
      }, 201);
    }

    return jsonResponse({ ok: true, accepted: true });
  };
}

const routePayloads: Record<string, unknown> = {
  webhook_echo: { source: "smoke", sample: true },
  chat_notify: { body: { text: "Smoke notification" } },
  slack_message: { body: { text: "Smoke Slack notification" } },
  github_issue_create: {
    body: {
      title: "Smoke issue title",
      body: "Smoke issue body",
      labels: ["smoke", "automation"]
    }
  },
  openai_chat: { body: { prompt: "Say hello from smoke test.", model: "gpt-4o-mini" } },
  lead_normalizer: {
    body: {
      firstName: "Smoke",
      lastName: "Lead",
      email: "Lead@Example.com",
      phone: "(555) 111-2222",
      source: "smoke"
    }
  },
  json_transform: {
    body: {
      data: { first_name: "Smoke", last_name: "Lead" },
      rename: { first_name: "firstName", last_name: "lastName" }
    }
  },
  text_extract: { body: { text: "alpha beta", pattern: "[a-z]+" } },
  payload_hash: { body: { value: "smoke" } },
  template_render: { body: { template: "Hi {{name}}", values: { name: "Smoke" } } },
  timestamp_enrich: { body: { event: "smoke" } },
  webhook_fanout: {
    body: {
      webhooks: ["https://hooks.example/a", "https://hooks.example/b"],
      payload: { event: "smoke" }
    }
  },
  incident_create: { body: { title: "Smoke Incident", severity: "high", details: "smoke" } },
  health_note: { body: { service: "api", status: "ok" } },
  noop_ack: { event: "noop" }
};

const cronPayloads: Record<string, unknown> = {
  heartbeat_hourly: {
    target: "f/examples/heartbeat_hourly"
  },
  cleanup_daily: {
    dryRun: true,
    retentionDays: 14
  },
  digest_daily: {
    channel: "ops"
  },
  retry_dead_letters_hourly: {
    maxRetries: 25,
    dryRun: true
  },
  usage_rollup_15m: {
    bucketMinutes: 15
  },
  config_snapshot_daily: {
    includeDisabled: true
  }
};

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

async function main() {
  const env = makeDefaultEnv();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = buildMockFetch();

  const failures: Array<{ id: string; kind: string; error: string }> = [];
  let passed = 0;

  try {
    for (const route of ROUTES) {
      const handler = HTTP_ROUTE_HANDLERS[route.routePath];
      if (!handler) {
        failures.push({ id: route.routePath, kind: "http", error: "handler not registered" });
        continue;
      }

      const payload = routePayloads[route.routePath] ?? { body: {} };
      try {
        await withTimeout(
          Promise.resolve((handler as (payload: unknown, traceId: string, context?: unknown) => unknown)(
            payload,
            `smoke-http-${route.routePath}`,
            { env }
          )),
          10_000
        );
        passed += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push({ id: route.routePath, kind: "http", error: message });
      }
    }

    for (const schedule of SCHEDULES) {
      const handler = CRON_SCHEDULE_HANDLERS[schedule.id];
      if (!handler) {
        failures.push({ id: schedule.id, kind: "cron", error: "handler not registered" });
        continue;
      }

      const payload = cronPayloads[schedule.id] ?? {};
      try {
        await withTimeout(
          Promise.resolve((handler as (payload: unknown, traceId: string, context?: unknown) => unknown)(
            payload,
            `smoke-cron-${schedule.id}`,
            { env, scheduleId: schedule.id }
          )),
          10_000
        );
        passed += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push({ id: schedule.id, kind: "cron", error: message });
      }
    }
  } finally {
    globalThis.fetch = originalFetch;
  }

  const total = ROUTES.length + SCHEDULES.length;
  console.log(`smoke handlers: passed=${passed} failed=${failures.length} total=${total}`);

  if (failures.length > 0) {
    console.log("failures:");
    for (const item of failures) {
      console.log(`- [${item.kind}] ${item.id}: ${item.error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log("smoke handlers passed");
}

main().catch((error) => {
  console.error("smoke handlers failed", error);
  process.exitCode = 1;
});
