import assert from "node:assert/strict";

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
            idempotency.add(String(bound[0] ?? ""));
          }
          return { success: true };
        }
      };
    }
  } as unknown as D1Database;
}

function createTestEnv(overrides: Partial<Env> = {}) {
  const queuedTasks: QueueTask[] = [];

  const env: Env = {
    DB: buildMockDb(),
    AUTOMATION_QUEUE: {
      async send(task: QueueTask) {
        queuedTasks.push(task);
      }
    } as unknown as Queue<QueueTask>,
    WORKFLOW_SERVICE: {
      async fetch() {
        return jsonResponse({ ok: true });
      }
    } as unknown as Fetcher,
    ENV_NAME: "test",
    ...overrides
  };

  return { env, queuedTasks };
}

function makeRequest(path: string, body: string, traceId: string, headers: Record<string, string> = {}) {
  return new Request(`https://api.example.com${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-trace-id": traceId,
      ...headers
    },
    body
  });
}

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sign(secret: string, payload: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return toHex(digest);
}

async function run() {
  const body = JSON.stringify({ hello: "world" });

  {
    const { env } = createTestEnv({ API_INGRESS_TOKEN: "secret-token" });
    const denied = await apiWorker.fetch(makeRequest("/api/webhook_echo", body, "security-token-1"), env);
    assert.equal(denied.status, 401);

    const allowed = await apiWorker.fetch(
      makeRequest("/api/webhook_echo", body, "security-token-2", { "x-api-token": "secret-token" }),
      env
    );
    assert.equal(allowed.status, 202);
  }

  {
    const hmacSecret = "hmac-secret";
    const { env } = createTestEnv({ API_HMAC_SECRET: hmacSecret });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const validSig = await sign(hmacSecret, `${timestamp}.${body}`);

    const valid = await apiWorker.fetch(
      makeRequest("/api/webhook_echo", body, "security-hmac-1", {
        "x-signature-timestamp": timestamp,
        "x-signature": `v1=${validSig}`
      }),
      env
    );
    assert.equal(valid.status, 202);

    const invalid = await apiWorker.fetch(
      makeRequest("/api/webhook_echo", body, "security-hmac-2", {
        "x-signature-timestamp": timestamp,
        "x-signature": "v1=deadbeef"
      }),
      env
    );
    assert.equal(invalid.status, 401);
  }

  {
    const { env } = createTestEnv({ API_RATE_LIMIT_PER_MINUTE: "1" });

    const first = await apiWorker.fetch(
      makeRequest("/api/webhook_echo", body, "security-rate-1", { "cf-connecting-ip": "203.0.113.1" }),
      env
    );
    assert.equal(first.status, 202);

    const second = await apiWorker.fetch(
      makeRequest("/api/webhook_echo", body, "security-rate-2", { "cf-connecting-ip": "203.0.113.1" }),
      env
    );
    assert.equal(second.status, 429);
  }

  {
    const { env } = createTestEnv({
      API_RATE_LIMIT_PER_MINUTE: "10",
      API_ROUTE_LIMITS_JSON: JSON.stringify({
        webhook_echo: {
          rpm: 1,
          burst: 0
        }
      })
    });

    const first = await apiWorker.fetch(
      makeRequest("/api/webhook_echo", body, "security-route-limit-1", { "cf-connecting-ip": "203.0.113.90" }),
      env
    );
    assert.equal(first.status, 202);

    const blocked = await apiWorker.fetch(
      makeRequest("/api/webhook_echo", body, "security-route-limit-2", { "cf-connecting-ip": "203.0.113.90" }),
      env
    );
    assert.equal(blocked.status, 429);

    const allowedOtherRoute = await apiWorker.fetch(
      makeRequest("/api/noop_ack", body, "security-route-limit-3", { "cf-connecting-ip": "203.0.113.90" }),
      env
    );
    assert.equal(allowedOtherRoute.status, 202);
  }

  console.log("ingress security tests passed");
}

run().catch((error) => {
  console.error("ingress security tests failed", error);
  process.exitCode = 1;
});
