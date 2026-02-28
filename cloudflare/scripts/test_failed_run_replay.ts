import assert from "node:assert/strict";

import type { QueueTask } from "../shared/types";
import opsDashboardWorker from "../workers/ops-dashboard/src/index";

type ReplayLineageEntry = {
  parentTraceId: string;
  childTraceId: string;
  retryCount: number;
};

function buildMockDb() {
  const runs = new Map<string, { status: string }>();
  const deadLetters = new Map<string, { id: number; workspaceId: string; payloadJson: string; createdAt: string }>();
  const lineage: ReplayLineageEntry[] = [];

  runs.set("trace-failed", { status: "failed" });
  runs.set("trace-succeeded", { status: "succeeded" });
  deadLetters.set("trace-failed", {
    id: 11,
    workspaceId: "default",
    payloadJson: JSON.stringify({
      kind: "http_route",
      traceId: "trace-failed",
      workspaceId: "default",
      routePath: "webhook_echo",
      payload: { hello: "world" },
      enqueuedAt: "2026-02-28T00:00:00.000Z"
    }),
    createdAt: "2026-02-28T00:00:00.000Z"
  });

  return {
    db: {
      prepare(sql: string) {
        let bound: unknown[] = [];
        return {
          bind(...args: unknown[]) {
            bound = args;
            return this;
          },
          async first<T>() {
            if (sql.includes("FROM runs") && sql.includes("WHERE trace_id = ?1")) {
              const traceId = String(bound[0] ?? "");
              const run = runs.get(traceId);
              return run ? ({ status: run.status } as T) : null;
            }
            if (sql.includes("FROM dead_letters") && sql.includes("WHERE trace_id = ?1")) {
              const traceId = String(bound[0] ?? "");
              const dl = deadLetters.get(traceId);
              return dl
                ? ({
                    id: dl.id,
                    workspaceId: dl.workspaceId,
                    payloadJson: dl.payloadJson,
                    createdAt: dl.createdAt
                  } as T)
                : null;
            }
            if (sql.includes("MAX(retry_count)")) {
              const parent = String(bound[0] ?? "");
              const max = lineage
                .filter((item) => item.parentTraceId === parent)
                .reduce((acc, item) => Math.max(acc, item.retryCount), 0);
              return ({ retryCount: max } as T);
            }
            return null;
          },
          async run() {
            if (sql.includes("INSERT INTO replay_lineage")) {
              lineage.push({
                parentTraceId: String(bound[0] ?? ""),
                childTraceId: String(bound[1] ?? ""),
                retryCount: Number(bound[3] ?? 0)
              });
            }
            return { success: true };
          },
          async all<T>() {
            return { results: [] as T[] };
          }
        };
      }
    } as unknown as D1Database,
    lineage
  };
}

async function run() {
  const state = buildMockDb();
  const queued: QueueTask[] = [];
  const env = {
    DB: state.db,
    AUTOMATION_QUEUE: {
      async send(task: QueueTask) {
        queued.push(task);
      }
    } as unknown as Queue<QueueTask>,
    ENV_NAME: "test"
  };

  const successResponse = await opsDashboardWorker.fetch(
    new Request("https://ops.example.com/api/replay/trace-failed", {
      method: "POST"
    }),
    env as any
  );
  assert.equal(successResponse.status, 202);
  const successPayload = (await successResponse.json()) as Record<string, unknown>;
  assert.equal(successPayload.accepted, true);
  assert.equal(queued.length, 1);
  assert.equal(state.lineage.length, 1);

  const invalidResponse = await opsDashboardWorker.fetch(
    new Request("https://ops.example.com/api/replay/trace-succeeded", {
      method: "POST"
    }),
    env as any
  );
  assert.equal(invalidResponse.status, 409);
  const invalidPayload = (await invalidResponse.json()) as Record<string, unknown>;
  assert.equal(invalidPayload.error, "replay requires failed run");

  console.log("failed run replay tests passed");
}

run().catch((error) => {
  console.error("failed run replay tests failed", error);
  process.exitCode = 1;
});
