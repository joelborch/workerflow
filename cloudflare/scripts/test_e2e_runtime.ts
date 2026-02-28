import assert from "node:assert/strict";

import type { Env, QueueTask } from "../shared/types";
import apiWorker from "../workers/api/src/index";
import queueWorker from "../workers/queue-consumer/src/index";
import workflowWorker from "../workers/workflow/src/index";

type RunRecord = {
  traceId: string;
  workspaceId: string;
  kind: string;
  routePath: string | null;
  scheduleId: string | null;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  output: string | null;
  error: string | null;
};

function buildMockDb() {
  const idempotency = new Set<string>();
  const runs = new Map<string, RunRecord>();
  const deadLetters: Array<{ traceId: string; workspaceId: string; error: string }> = [];

  const db = {
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
            return idempotency.has(traceId) ? ({ trace_id: traceId } as T) : null;
          }
          if (sql.includes("FROM dead_letters") && sql.includes("WHERE trace_id = ?1")) {
            const traceId = String(bound[0] ?? "");
            const error = String(bound[1] ?? "");
            const match = deadLetters.find((item) => item.traceId === traceId && item.error === error);
            return match ? ({ id: 1 } as T) : null;
          }
          return null;
        },
        async run() {
          if (sql.includes("INSERT OR IGNORE INTO idempotency_keys")) {
            idempotency.add(String(bound[0] ?? ""));
          } else if (sql.includes("INSERT INTO runs")) {
            const traceId = String(bound[0] ?? "");
            runs.set(traceId, {
              traceId,
              workspaceId: String(bound[1] ?? "default"),
              kind: String(bound[2] ?? ""),
              routePath: (bound[3] as string | null) ?? null,
              scheduleId: (bound[4] as string | null) ?? null,
              status: "started",
              startedAt: String(bound[5] ?? new Date().toISOString()),
              finishedAt: null,
              output: null,
              error: null
            });
          } else if (sql.includes("UPDATE runs") && sql.includes("status = 'succeeded'")) {
            const traceId = String(bound[0] ?? "");
            const run = runs.get(traceId);
            if (run) {
              run.status = "succeeded";
              run.finishedAt = String(bound[1] ?? "");
              run.output = (bound[2] as string | null) ?? null;
            }
          } else if (sql.includes("UPDATE runs") && sql.includes("status = 'failed'")) {
            const traceId = String(bound[0] ?? "");
            const run = runs.get(traceId);
            if (run) {
              run.status = "failed";
              run.finishedAt = String(bound[1] ?? "");
              run.error = String(bound[2] ?? "");
            }
          } else if (sql.includes("INSERT INTO dead_letters")) {
            deadLetters.push({
              traceId: String(bound[0] ?? ""),
              workspaceId: String(bound[1] ?? "default"),
              error: String(bound[3] ?? "")
            });
          }
          return { success: true };
        },
        async all<T>() {
          return { results: [] as T[] };
        }
      };
    }
  } as unknown as D1Database;

  return {
    db,
    runs,
    deadLetters
  };
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" }
  });
}

async function run() {
  const dbState = buildMockDb();
  const queue: QueueTask[] = [];

  const workflowEnv: Env = {
    DB: dbState.db,
    AUTOMATION_QUEUE: {
      async send(task: QueueTask) {
        queue.push(task);
      }
    } as unknown as Queue<QueueTask>,
    WORKFLOW_SERVICE: {} as Fetcher,
    ENV_NAME: "test",
    OPENAI_API_KEY: "fixture-openai"
  };

  const workflowService = {
    async fetch(input: string | URL | Request, init?: RequestInit) {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const path = new URL(url).pathname;
      if (path === "/health/config") {
        return workflowWorker.fetch(new Request("https://workflow.example/health/config"), workflowEnv);
      }
      if (path === "/run-sync" || path === "/run-async") {
        return workflowWorker.fetch(
          new Request(`https://workflow.example${path}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: String(init?.body ?? "{}")
          }),
          workflowEnv
        );
      }
      return jsonResponse({ error: "unknown workflow path" }, 404);
    }
  } as unknown as Fetcher;

  const apiEnv: Env = {
    DB: dbState.db,
    AUTOMATION_QUEUE: {
      async send(task: QueueTask) {
        queue.push(task);
      }
    } as unknown as Queue<QueueTask>,
    WORKFLOW_SERVICE: workflowService,
    ENV_NAME: "test"
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL) => {
    const requestUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const url = new URL(requestUrl);
    if (url.hostname === "api.openai.com") {
      return jsonResponse({
        choices: [{ message: { content: "E2E completion" } }]
      });
    }
    return jsonResponse({ ok: true });
  };

  try {
    const syncResponse = await apiWorker.fetch(
      new Request("https://api.example.com/api/openai_chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-trace-id": "e2e-sync-1"
        },
        body: JSON.stringify({
          prompt: "hello from e2e"
        })
      }),
      apiEnv
    );
    assert.equal(syncResponse.status, 200);

    const asyncResponse = await apiWorker.fetch(
      new Request("https://api.example.com/api/webhook_echo", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-trace-id": "e2e-async-1"
        },
        body: JSON.stringify({ hello: "async" })
      }),
      apiEnv
    );
    assert.equal(asyncResponse.status, 202);
    assert.equal(queue.length, 1);

    await queueWorker.queue(
      {
        messages: queue.splice(0, queue.length).map((task) => ({
          body: task,
          ack() {},
          retry() {}
        }))
      } as unknown as MessageBatch<QueueTask>,
      {
        DB: dbState.db,
        AUTOMATION_QUEUE: apiEnv.AUTOMATION_QUEUE,
        WORKFLOW_SERVICE: workflowService,
        ENV_NAME: "test"
      } as Env
    );

    const asyncRun = dbState.runs.get("e2e-async-1");
    assert.ok(asyncRun);
    assert.equal(asyncRun?.status, "succeeded");

    const failEnqueue = await apiWorker.fetch(
      new Request("https://api.example.com/api/slack_message", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-trace-id": "e2e-fail-1"
        },
        body: JSON.stringify({ text: "will fail due missing secret" })
      }),
      apiEnv
    );
    assert.equal(failEnqueue.status, 202);

    await queueWorker.queue(
      {
        messages: queue.splice(0, queue.length).map((task) => ({
          body: task,
          ack() {},
          retry() {}
        }))
      } as unknown as MessageBatch<QueueTask>,
      {
        DB: dbState.db,
        AUTOMATION_QUEUE: apiEnv.AUTOMATION_QUEUE,
        WORKFLOW_SERVICE: workflowService,
        ENV_NAME: "test"
      } as Env
    );

    const failedRun = dbState.runs.get("e2e-fail-1");
    assert.ok(failedRun);
    assert.equal(failedRun?.status, "failed");
    assert.equal(dbState.deadLetters.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }

  console.log("e2e runtime tests passed");
}

run().catch((error) => {
  console.error("e2e runtime tests failed", error);
  process.exitCode = 1;
});
