import assert from "node:assert/strict";

import { validateRoutePayload } from "../shared/route_validation";
import type { Env, QueueTask } from "../shared/types";
import apiWorker from "../workers/api/src/index";

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
            idempotency.add(String(bound[0] ?? ""));
          }
          return { success: true };
        }
      };
    }
  } as unknown as D1Database;
}

function env() {
  const queuedTasks: QueueTask[] = [];
  return {
    runtime: {
      DB: buildMockDb(),
      AUTOMATION_QUEUE: {
        async send(task: QueueTask) {
          queuedTasks.push(task);
        }
      } as unknown as Queue<QueueTask>,
      WORKFLOW_SERVICE: {
        async fetch() {
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "content-type": "application/json" }
          });
        }
      } as unknown as Fetcher,
      ENV_NAME: "test"
    } as Env,
    queuedTasks
  };
}

async function run() {
  const valid = validateRoutePayload("stripe_payment_intent_create", { body: { amount: 1200, currency: "usd" } });
  assert.equal(valid.ok, true);

  const invalid = validateRoutePayload("stripe_payment_intent_create", { body: { amount: "1200" } });
  assert.equal(invalid.ok, false);
  assert.ok(invalid.errors.some((item) => item.includes("amount")));

  const invalidNotion = validateRoutePayload("notion_database_item_create", {
    body: { databaseId: "", properties: [] }
  });
  assert.equal(invalidNotion.ok, false);
  assert.ok(invalidNotion.errors.length >= 1);

  const { runtime } = env();
  const response = await apiWorker.fetch(
    new Request("https://api.example.com/api/stripe_payment_intent_create", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-trace-id": "route-validation-1"
      },
      body: JSON.stringify({ amount: "bad" })
    }),
    runtime
  );
  assert.equal(response.status, 400);
  const payload = (await response.json()) as Record<string, unknown>;
  assert.equal(payload.error, "invalid payload");

  console.log("route validation tests passed");
}

run().catch((error) => {
  console.error("route validation tests failed", error);
  process.exitCode = 1;
});
