import assert from "node:assert/strict";

import { ROUTES } from "../shared/routes";
import type { Env, QueueTask } from "../shared/types";
import apiWorker from "../workers/api/src/index";

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

function buildMockDb() {
  const idempotency = new Set<string>();

  return {
    prepare(sql: string) {
      let bound: unknown[] = [];

      return {
        bind(...args: unknown[]) {
          bound = args;
          return this;
        },
        async first<T>() {
          if (sql.includes("FROM idempotency_keys")) {
            const traceId = String(bound[0] ?? "");
            if (idempotency.has(traceId)) {
              return { trace_id: traceId } as T;
            }
            return null;
          }
          return null;
        },
        async run() {
          if (sql.includes("INSERT OR IGNORE INTO idempotency_keys")) {
            const traceId = String(bound[0] ?? "");
            idempotency.add(traceId);
          }
          return { success: true };
        }
      };
    }
  } as unknown as D1Database;
}

function createTestEnv() {
  const queuedTasks: QueueTask[] = [];
  const syncTasks: QueueTask[] = [];

  const env: Env = {
    DB: buildMockDb(),
    AUTOMATION_QUEUE: {
      async send(task: QueueTask) {
        queuedTasks.push(task);
      }
    } as unknown as Queue<QueueTask>,
    WORKFLOW_SERVICE: {
      async fetch(_url: string | URL | Request, init?: RequestInit) {
        const raw = String(init?.body ?? "{}");
        const task = JSON.parse(raw) as QueueTask;
        syncTasks.push(task);
        return jsonResponse({
          ok: true,
          traceId: task.traceId,
          routePath: task.routePath
        });
      }
    } as unknown as Fetcher,
    ENV_NAME: "test"
  };

  return { env, queuedTasks, syncTasks };
}

function getFixtureBody(routePath: string) {
  const base = {
    source: "route-fixture",
    routePath,
    value: "smoke"
  };

  switch (routePath) {
    case "chat_notify":
      return { text: "Fixture message" };
    case "slack_message":
      return { text: "Fixture Slack message" };
    case "github_issue_create":
      return {
        title: "Fixture issue",
        body: "Created by route fixture test"
      };
    case "openai_chat":
      return {
        prompt: "Summarize this fixture payload in one sentence."
      };
    case "lead_normalizer":
      return {
        firstName: "Ava",
        lastName: "Ng",
        email: "ava@example.com",
        phone: "555-111-2222",
        source: "fixtures"
      };
    case "stripe_payment_intent_create":
      return {
        amount: 1299,
        currency: "usd",
        description: "fixture payment"
      };
    case "stripe_customer_upsert":
      return {
        email: "fixture@example.com",
        name: "Fixture User"
      };
    case "notion_database_item_create":
      return {
        databaseId: "db_fixture",
        properties: {
          Name: {
            title: [{ text: { content: "Fixture row" } }]
          }
        }
      };
    case "notion_database_item_get":
      return {
        pageId: "notion-page-1"
      };
    case "hubspot_contact_upsert":
      return {
        email: "hubspot@example.com",
        properties: {
          firstname: "Hub",
          lastname: "Spot"
        }
      };
    case "hubspot_deal_upsert":
      return {
        idProperty: "workerflow_external_id",
        idValue: "deal-fixture-1",
        properties: {
          dealname: "Fixture deal"
        }
      };
    default:
      return base;
  }
}

function buildPostRequest(path: string, body: unknown, traceId: string) {
  return new Request(`https://api.example.com${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-trace-id": traceId,
      origin: "https://fixture-client.example"
    },
    body: JSON.stringify(body)
  });
}

function buildOptionsRequest(path: string) {
  return new Request(`https://api.example.com${path}`, {
    method: "OPTIONS",
    headers: {
      origin: "https://fixture-client.example"
    }
  });
}

async function assertRouteFixture(
  env: Env,
  queuedTasks: QueueTask[],
  syncTasks: QueueTask[],
  route: (typeof ROUTES)[number]
) {
  const body = getFixtureBody(route.routePath);
  const traceId = `fixture-${route.routePath}`;
  const request = buildPostRequest(`/api/${route.routePath}`, body, traceId);

  const queueBefore = queuedTasks.length;
  const syncBefore = syncTasks.length;

  const response = await apiWorker.fetch(request, env);
  const payload = (await response.json()) as Record<string, unknown>;

  assert.equal(response.headers.get("access-control-allow-origin"), "https://fixture-client.example");
  assert.equal(payload.traceId, traceId);

  if (route.requestType === "async") {
    assert.equal(response.status, 202, `${route.routePath}: expected 202 async status`);
    assert.equal(queuedTasks.length, queueBefore + 1, `${route.routePath}: expected queued task`);
    assert.equal(syncTasks.length, syncBefore, `${route.routePath}: sync task should not run`);

    const task = queuedTasks.at(-1);
    assert.ok(task, `${route.routePath}: queued task missing`);
    assert.equal(task?.kind, "http_route");
    assert.equal(task?.routePath, route.routePath);
    assert.deepEqual(task?.payload, route.wrapBody ? { body } : body, `${route.routePath}: payload shape mismatch`);
  } else {
    assert.equal(response.status, 200, `${route.routePath}: expected 200 sync status`);
    assert.equal(syncTasks.length, syncBefore + 1, `${route.routePath}: expected sync workflow call`);
    assert.equal(queuedTasks.length, queueBefore, `${route.routePath}: should not enqueue async task`);

    const task = syncTasks.at(-1);
    assert.ok(task, `${route.routePath}: sync task missing`);
    assert.equal(task?.kind, "http_route");
    assert.equal(task?.routePath, route.routePath);
    assert.deepEqual(task?.payload, route.wrapBody ? { body } : body, `${route.routePath}: payload shape mismatch`);
  }

  const duplicateResponse = await apiWorker.fetch(buildPostRequest(`/api/${route.routePath}`, body, traceId), env);
  const duplicatePayload = (await duplicateResponse.json()) as Record<string, unknown>;
  assert.equal(duplicateResponse.status, 202, `${route.routePath}: duplicate should return 202`);
  assert.equal(duplicatePayload.duplicate, true, `${route.routePath}: duplicate marker missing`);
}

async function main() {
  const { env, queuedTasks, syncTasks } = createTestEnv();

  const healthResponse = await apiWorker.fetch(new Request("https://api.example.com/api/health"), env);
  assert.equal(healthResponse.status, 200);
  const health = (await healthResponse.json()) as Record<string, unknown>;
  assert.equal(health.worker, "api");

  const preflightResponse = await apiWorker.fetch(buildOptionsRequest("/api/webhook_echo"), env);
  assert.equal(preflightResponse.status, 204);
  assert.equal(preflightResponse.headers.get("access-control-allow-methods"), "POST, OPTIONS");

  const unknownRouteResponse = await apiWorker.fetch(
    buildPostRequest("/api/not_a_real_route", { any: "payload" }, "fixture-unknown"),
    env
  );
  assert.equal(unknownRouteResponse.status, 404);

  const methodNotAllowedResponse = await apiWorker.fetch(
    new Request("https://api.example.com/api/webhook_echo", { method: "GET" }),
    env
  );
  assert.equal(methodNotAllowedResponse.status, 405);

  const originalFetch = globalThis.fetch;
  const legacyAlerts: Array<{ url: string; payload: Record<string, unknown> }> = [];
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const payload = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
    legacyAlerts.push({ url, payload });
    return jsonResponse({ ok: true });
  };

  try {
    env.GCHAT_ALERTS_WEBHOOK = {
      async get() {
        return "https://chat.googleapis.com/mock-alerts";
      }
    } as unknown as string;
    const legacyRequest = buildPostRequest(
      "/api/r/example/legacy_flow",
      { source: "legacy-endpoint", payload: { example: "value" } },
      "fixture-legacy-trace"
    );
    const legacyResponse = await apiWorker.fetch(legacyRequest, env);
    const legacyPayload = (await legacyResponse.json()) as Record<string, unknown>;

    assert.equal(legacyResponse.status, 404);
    assert.equal(legacyPayload.error, "legacy endpoint is disabled");
    assert.equal(legacyPayload.traceId, "fixture-legacy-trace");
    assert.equal(legacyPayload.routePath, "legacy_flow");

    assert.equal(legacyAlerts.length, 1, "expected one legacy alert");
    assert.equal(legacyAlerts[0]?.url, "https://chat.googleapis.com/mock-alerts");
    assert.equal(typeof legacyAlerts[0]?.payload.text, "string");
    assert.match(String(legacyAlerts[0]?.payload.text), /LEGACY ENDPOINT HIT/);
    assert.match(String(legacyAlerts[0]?.payload.text), /route=legacy_flow/);
  } finally {
    globalThis.fetch = originalFetch;
  }

  for (const route of ROUTES) {
    await assertRouteFixture(env, queuedTasks, syncTasks, route);
  }

  console.log(
    `route fixture tests passed: routes=${ROUTES.length} asyncQueued=${queuedTasks.length} syncInvocations=${syncTasks.length}`
  );
}

main().catch((error) => {
  console.error("route fixture tests failed", error);
  process.exitCode = 1;
});
