import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { validateRoutePayload } from "../shared/route_validation";
import { ROUTES } from "../shared/routes";
import { SCHEDULES } from "../shared/schedules";
import type { Env, QueueTask } from "../shared/types";
import apiWorker from "../workers/api/src/index";
import schedulerWorker from "../workers/scheduler/src/index";
import { createMockD1, createQueueMock, jsonResponse } from "./helpers/d1";

function createRouteTestEnv() {
  const { db } = createMockD1();
  const { queue, tasks: queuedTasks } = createQueueMock();
  const syncTasks: QueueTask[] = [];

  const env: Env = {
    DB: db,
    AUTOMATION_QUEUE: queue,
    WORKFLOW_SERVICE: {
      async fetch(_url: string | URL | Request, init?: RequestInit) {
        const task = JSON.parse(String(init?.body ?? "{}")) as QueueTask;
        syncTasks.push(task);
        return jsonResponse({ ok: true, traceId: task.traceId, routePath: task.routePath });
      }
    } as unknown as Fetcher,
    ENV_NAME: "test",
    API_INGRESS_TOKEN: "fixture-ingress-token",
    WORKFLOW_INTERNAL_TOKEN: "fixture-workflow-internal-token"
  };

  return { env, queuedTasks, syncTasks };
}

function getFixtureBody(routePath: string) {
  switch (routePath) {
    case "chat_notify":
      return { text: "Fixture message" };
    case "slack_message":
      return { text: "Fixture Slack message" };
    case "github_issue_create":
      return { title: "Fixture issue", body: "Created by route fixture test" };
    case "openai_chat":
      return { prompt: "Summarize this fixture payload in one sentence." };
    case "lead_normalizer":
      return {
        firstName: "Ava",
        lastName: "Ng",
        email: "ava@example.com",
        phone: "555-111-2222",
        source: "fixtures"
      };
    case "stripe_payment_intent_create":
      return { amount: 1299, currency: "usd", description: "fixture payment" };
    case "stripe_customer_upsert":
      return { email: "fixture@example.com", name: "Fixture User" };
    case "notion_database_item_create":
      return {
        databaseId: "db_fixture",
        properties: { Name: { title: [{ text: { content: "Fixture row" } }] } }
      };
    case "notion_database_item_get":
      return { pageId: "notion-page-1" };
    case "hubspot_contact_upsert":
      return { email: "hubspot@example.com", properties: { firstname: "Hub", lastname: "Spot" } };
    case "hubspot_deal_upsert":
      return {
        idProperty: "workerflow_external_id",
        idValue: "deal-fixture-1",
        properties: { dealname: "Fixture deal" }
      };
    default:
      return { source: "route-fixture", routePath, value: "smoke" };
  }
}

function buildPostRequest(path: string, body: unknown, traceId: string) {
  return new Request(`https://api.example.com${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-trace-id": traceId,
      "x-api-token": "fixture-ingress-token",
      origin: "https://fixture-client.example"
    },
    body: JSON.stringify(body)
  });
}

describe("HTTP routes, payload validation, and cron scheduler fixtures", () => {
  it("handles health, preflight, 404/405, legacy disabled alerts, all registered routes, and duplicates", async () => {
    const { env, queuedTasks, syncTasks } = createRouteTestEnv();

    const healthResponse = await apiWorker.fetch(new Request("https://api.example.com/api/health"), env);
    assert.equal(healthResponse.status, 200);
    const health = (await healthResponse.json()) as Record<string, unknown>;
    assert.equal(health.worker, "api");

    const preflightResponse = await apiWorker.fetch(
      new Request("https://api.example.com/api/webhook_echo", {
        method: "OPTIONS",
        headers: { origin: "https://fixture-client.example" }
      }),
      env
    );
    assert.equal(preflightResponse.status, 204);
    assert.equal(preflightResponse.headers.get("access-control-allow-methods"), "POST, OPTIONS");

    const unknownRoute = await apiWorker.fetch(
      buildPostRequest("/api/not_a_real_route", { any: "payload" }, "fixture-unknown"),
      env
    );
    assert.equal(unknownRoute.status, 404);

    const methodNotAllowed = await apiWorker.fetch(
      new Request("https://api.example.com/api/webhook_echo", { method: "GET" }),
      env
    );
    assert.equal(methodNotAllowed.status, 405);

    const originalFetch = globalThis.fetch;
    const legacyAlerts: Array<{ url: string; payload: Record<string, unknown> }> = [];
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      legacyAlerts.push({ url, payload: JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown> });
      return jsonResponse({ ok: true });
    };

    try {
      env.GCHAT_ALERTS_WEBHOOK = {
        async get() {
          return "https://chat.googleapis.com/mock-alerts";
        }
      } as unknown as string;

      const legacyResponse = await apiWorker.fetch(
        buildPostRequest(
          "/api/r/example/legacy_flow",
          { source: "legacy-endpoint", payload: { example: "value" } },
          "fixture-legacy-trace"
        ),
        env
      );
      const legacyPayload = (await legacyResponse.json()) as Record<string, unknown>;
      assert.equal(legacyResponse.status, 404);
      assert.equal(legacyPayload.error, "legacy endpoint is disabled");
      assert.equal(legacyPayload.traceId, "fixture-legacy-trace");
      assert.equal(legacyPayload.routePath, "legacy_flow");

      assert.equal(legacyAlerts.length, 1);
      assert.equal(legacyAlerts[0]?.url, "https://chat.googleapis.com/mock-alerts");
      assert.match(String(legacyAlerts[0]?.payload.text), /LEGACY ENDPOINT HIT/);
      assert.match(String(legacyAlerts[0]?.payload.text), /route=legacy_flow/);
    } finally {
      globalThis.fetch = originalFetch;
    }

    for (const route of ROUTES) {
      const body = getFixtureBody(route.routePath);
      const traceId = `fixture-${route.routePath}`;
      const queueBefore = queuedTasks.length;
      const syncBefore = syncTasks.length;

      const response = await apiWorker.fetch(buildPostRequest(`/api/${route.routePath}`, body, traceId), env);
      const payload = (await response.json()) as Record<string, unknown>;
      assert.equal(response.headers.get("access-control-allow-origin"), "https://fixture-client.example");
      assert.equal(payload.traceId, traceId);

      const expectedPayload = route.wrapBody ? { body } : body;
      if (route.requestType === "async") {
        assert.equal(response.status, 202, `${route.routePath}: expected 202`);
        assert.equal(queuedTasks.length, queueBefore + 1);
        assert.equal(syncTasks.length, syncBefore);
        const task = queuedTasks.at(-1);
        assert.equal(task?.kind, "http_route");
        assert.equal(task?.routePath, route.routePath);
        assert.deepEqual(task?.payload, expectedPayload);
      } else {
        assert.equal(response.status, 200, `${route.routePath}: expected 200`);
        assert.equal(syncTasks.length, syncBefore + 1);
        assert.equal(queuedTasks.length, queueBefore);
        const task = syncTasks.at(-1);
        assert.equal(task?.kind, "http_route");
        assert.equal(task?.routePath, route.routePath);
        assert.deepEqual(task?.payload, expectedPayload);
      }

      const duplicate = await apiWorker.fetch(buildPostRequest(`/api/${route.routePath}`, body, traceId), env);
      const dupPayload = (await duplicate.json()) as Record<string, unknown>;
      assert.equal(duplicate.status, 202);
      assert.equal(dupPayload.duplicate, true);
    }
  });

  it("rejects malformed route payloads at ingress", async () => {
    assert.equal(validateRoutePayload("stripe_payment_intent_create", { body: { amount: 1200, currency: "usd" } }).ok, true);

    const invalid = validateRoutePayload("stripe_payment_intent_create", { body: { amount: "1200" } });
    assert.equal(invalid.ok, false);
    assert.ok(invalid.errors.some((item) => item.includes("amount")));

    const invalidNotion = validateRoutePayload("notion_database_item_create", {
      body: { databaseId: "", properties: [] }
    });
    assert.equal(invalidNotion.ok, false);
    assert.ok(invalidNotion.errors.length >= 1);

    const { env } = createRouteTestEnv();
    const response = await apiWorker.fetch(
      buildPostRequest("/api/stripe_payment_intent_create", { amount: "bad" }, "route-validation-1"),
      env
    );
    assert.equal(response.status, 400);
    const payload = (await response.json()) as Record<string, unknown>;
    assert.equal(payload.error, "invalid payload");
  });

  it("enqueues enabled cron schedules and skips unknown crons", async () => {
    const { queue, tasks: queued } = createQueueMock();
    const env = {
      DB: {} as D1Database,
      WORKFLOW_SERVICE: {} as Fetcher,
      ENV_NAME: "test",
      AUTOMATION_QUEUE: queue
    } as Env;

    const scheduledTimeMs = Date.parse("2026-02-28T12:00:00.000Z");
    const expectedIso = new Date(scheduledTimeMs).toISOString();
    const enabledSchedules = SCHEDULES.filter((item) => item.enabled);

    for (const cron of new Set(enabledSchedules.map((item) => item.cron))) {
      await schedulerWorker.scheduled({ cron, scheduledTime: scheduledTimeMs } as ScheduledController, env);
    }

    assert.equal(queued.length, enabledSchedules.length);
    const byScheduleId = new Map(queued.map((task) => [task.scheduleId ?? "", task]));
    for (const schedule of enabledSchedules) {
      const task = byScheduleId.get(schedule.id);
      assert.ok(task, `missing queued task for ${schedule.id}`);
      assert.equal(task?.kind, "scheduled_job");
      assert.ok(task?.traceId && task.traceId.length > 0);
      assert.ok(Number.isFinite(Date.parse(task?.enqueuedAt ?? "")));
      const payload = (task?.payload ?? {}) as Record<string, unknown>;
      assert.equal(payload.target, schedule.target);
      assert.equal(payload.cron, schedule.cron);
      assert.equal(payload.timeZone, schedule.timeZone);
      assert.equal(payload.scheduledTime, expectedIso);
    }

    const beforeUnknown = queued.length;
    await schedulerWorker.scheduled({ cron: "*/5 * * * *", scheduledTime: scheduledTimeMs } as ScheduledController, env);
    assert.equal(queued.length, beforeUnknown);
  });
});
