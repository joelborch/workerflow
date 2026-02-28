import assert from "node:assert/strict";

import opsDashboardWorker from "../workers/ops-dashboard/src/index";

type RunRow = {
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

type DeadLetterRow = {
  id: number;
  traceId: string;
  workspaceId: string;
  payloadJson: string;
  error: string;
  createdAt: string;
};

function buildMockDb() {
  const runs: RunRow[] = [
    {
      traceId: "trace-default-1",
      workspaceId: "default",
      kind: "http_route",
      routePath: "webhook_echo",
      scheduleId: null,
      status: "succeeded",
      startedAt: "2026-02-28T00:00:00.000Z",
      finishedAt: "2026-02-28T00:00:01.000Z",
      output: "{}",
      error: null
    },
    {
      traceId: "trace-team-1",
      workspaceId: "team-a",
      kind: "http_route",
      routePath: "webhook_echo",
      scheduleId: null,
      status: "failed",
      startedAt: "2026-02-28T00:02:00.000Z",
      finishedAt: "2026-02-28T00:02:01.000Z",
      output: null,
      error: "boom"
    }
  ];

  const deadLetters: DeadLetterRow[] = [
    {
      id: 1,
      traceId: "trace-team-1",
      workspaceId: "team-a",
      payloadJson: "{}",
      error: "boom",
      createdAt: "2026-02-28T00:02:01.000Z"
    }
  ];

  return {
    prepare(sql: string) {
      let bound: unknown[] = [];
      return {
        bind(...args: unknown[]) {
          bound = args;
          return this;
        },
        async all<T>() {
          if (sql.includes("FROM runs")) {
            const workspace = sql.includes("workspace_id =")
              ? String(bound.find((item) => typeof item === "string" && (item === "default" || item === "team-a")) ?? "")
              : "";
            const selected = workspace ? runs.filter((row) => row.workspaceId === workspace) : runs;
            return {
              results: selected.map((row) => ({
                traceId: row.traceId,
                workspaceId: row.workspaceId,
                kind: row.kind,
                routePath: row.routePath,
                scheduleId: row.scheduleId,
                status: row.status,
                startedAt: row.startedAt,
                finishedAt: row.finishedAt,
                output: row.output,
                error: row.error
              })) as T[]
            };
          }
          if (sql.includes("FROM dead_letters")) {
            const workspace = sql.includes("workspace_id =")
              ? String(bound.find((item) => typeof item === "string" && (item === "default" || item === "team-a")) ?? "")
              : "";
            const selected = workspace ? deadLetters.filter((row) => row.workspaceId === workspace) : deadLetters;
            return {
              results: selected.map((row) => ({
                id: row.id,
                traceId: row.traceId,
                workspaceId: row.workspaceId,
                payloadJson: row.payloadJson,
                error: row.error,
                createdAt: row.createdAt
              })) as T[]
            };
          }
          return { results: [] as T[] };
        },
        async first<T>() {
          return null;
        },
        async run() {
          return { success: true };
        }
      };
    }
  } as unknown as D1Database;
}

async function run() {
  const env = {
    DB: buildMockDb(),
    AUTOMATION_QUEUE: {} as Queue<unknown>,
    ENV_NAME: "test"
  };

  const allRuns = await opsDashboardWorker.fetch(
    new Request("https://ops.example.com/api/runs?limit=20", { method: "GET" }),
    env as any
  );
  assert.equal(allRuns.status, 200);
  const allPayload = (await allRuns.json()) as { runs: unknown[] };
  assert.equal(allPayload.runs.length, 2);

  const teamRuns = await opsDashboardWorker.fetch(
    new Request("https://ops.example.com/api/runs?limit=20&workspace=team-a", { method: "GET" }),
    env as any
  );
  assert.equal(teamRuns.status, 200);
  const teamPayload = (await teamRuns.json()) as { runs: Array<{ workspaceId?: string }> };
  assert.equal(teamPayload.runs.length, 1);
  assert.equal(teamPayload.runs[0]?.workspaceId, "team-a");

  const teamDeadLetters = await opsDashboardWorker.fetch(
    new Request("https://ops.example.com/api/dead-letters?workspace=team-a", { method: "GET" }),
    env as any
  );
  assert.equal(teamDeadLetters.status, 200);
  const dlPayload = (await teamDeadLetters.json()) as { deadLetters: Array<{ workspaceId?: string }> };
  assert.equal(dlPayload.deadLetters.length, 1);
  assert.equal(dlPayload.deadLetters[0]?.workspaceId, "team-a");

  console.log("workspace isolation tests passed");
}

run().catch((error) => {
  console.error("workspace isolation tests failed", error);
  process.exitCode = 1;
});
