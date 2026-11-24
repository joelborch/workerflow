import assert from "node:assert/strict";
import { describe, it } from "node:test";

import opsDashboardWorker from "../workers/ops-dashboard/src/index";
import { createMockD1, createQueueMock } from "./helpers/d1";

describe("headless ops-dashboard API", () => {
  it("serves headless JSON discovery at GET / and rejects retired UI routes with 404", async () => {
    const token = "ops-headless-token";
    const env = {
      DB: createMockD1().db,
      AUTOMATION_QUEUE: {} as Queue<unknown>,
      ENV_NAME: "test",
      OPS_DASHBOARD_TOKEN: token,
      OPS_DASHBOARD_READ_TOKEN: token,
      OPS_DASHBOARD_WRITE_TOKEN: token
    };

    const rootResponse = await opsDashboardWorker.fetch(new Request("https://ops.example.com/"), env as never);
    assert.equal(rootResponse.status, 200);
    assert.match(rootResponse.headers.get("content-type") ?? "", /application\/json/);
    const rootJson = (await rootResponse.json()) as {
      service: string;
      mode: string;
      endpoints: string[];
    };
    assert.equal(rootJson.service, "workerflow-ops-dashboard");
    assert.equal(rootJson.mode, "headless");
    assert.ok(rootJson.endpoints.includes("/api/runs"));

    const authHeaders = { authorization: `Bearer ${token}` };
    for (const path of ["/app.js", "/favicon.svg", "/api/app.js", "/api/templates", "/api/extensions"]) {
      const response = await opsDashboardWorker.fetch(
        new Request(`https://ops.example.com${path}`, { headers: authHeaders }),
        env as never
      );
      assert.equal(response.status, 404, `expected retired UI path ${path} to return 404`);
    }
  });

  it("isolates runs and dead letters by workspace filter", async () => {
    const state = createMockD1({
      runs: [
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
      ],
      deadLetters: [
        {
          id: 1,
          traceId: "trace-team-1",
          workspaceId: "team-a",
          payloadJson: "{}",
          error: "boom",
          createdAt: "2026-02-28T00:02:01.000Z"
        }
      ]
    });

    const token = "workspace-isolation-token";
    const env = {
      DB: state.db,
      AUTOMATION_QUEUE: {} as Queue<unknown>,
      ENV_NAME: "test",
      OPS_DASHBOARD_TOKEN: token,
      OPS_DASHBOARD_READ_TOKEN: token,
      OPS_DASHBOARD_WRITE_TOKEN: token
    };
    const authHeaders = { authorization: `Bearer ${token}` };

    const allRuns = await opsDashboardWorker.fetch(
      new Request("https://ops.example.com/api/runs?limit=20", { headers: authHeaders }),
      env as never
    );
    assert.equal(allRuns.status, 200);
    assert.equal(((await allRuns.json()) as { runs: unknown[] }).runs.length, 2);

    const teamRuns = await opsDashboardWorker.fetch(
      new Request("https://ops.example.com/api/runs?limit=20&workspace=team-a", { headers: authHeaders }),
      env as never
    );
    assert.equal(teamRuns.status, 200);
    const teamPayload = (await teamRuns.json()) as { runs: Array<{ workspaceId?: string }> };
    assert.equal(teamPayload.runs.length, 1);
    assert.equal(teamPayload.runs[0]?.workspaceId, "team-a");

    const teamDeadLetters = await opsDashboardWorker.fetch(
      new Request("https://ops.example.com/api/dead-letters?workspace=team-a", { headers: authHeaders }),
      env as never
    );
    assert.equal(teamDeadLetters.status, 200);
    const dlPayload = (await teamDeadLetters.json()) as { deadLetters: Array<{ workspaceId?: string }> };
    assert.equal(dlPayload.deadLetters.length, 1);
    assert.equal(dlPayload.deadLetters[0]?.workspaceId, "team-a");
  });

  it("replays failed runs and rejects replay of succeeded runs with 409", async () => {
    const state = createMockD1({
      runs: [
        {
          traceId: "trace-failed",
          workspaceId: "default",
          kind: "http_route",
          routePath: "webhook_echo",
          scheduleId: null,
          status: "failed",
          startedAt: "2026-02-28T00:00:00.000Z",
          finishedAt: "2026-02-28T00:00:01.000Z",
          output: null,
          error: "boom"
        },
        {
          traceId: "trace-succeeded",
          workspaceId: "default",
          kind: "http_route",
          routePath: "webhook_echo",
          scheduleId: null,
          status: "succeeded",
          startedAt: "2026-02-28T00:00:00.000Z",
          finishedAt: "2026-02-28T00:00:01.000Z",
          output: "{}",
          error: null
        }
      ],
      deadLetters: [
        {
          id: 11,
          traceId: "trace-failed",
          workspaceId: "default",
          payloadJson: JSON.stringify({
            kind: "http_route",
            traceId: "trace-failed",
            workspaceId: "default",
            routePath: "webhook_echo",
            payload: { hello: "world" },
            enqueuedAt: "2026-02-28T00:00:00.000Z"
          }),
          error: "boom",
          createdAt: "2026-02-28T00:00:00.000Z"
        }
      ]
    });

    const { queue, tasks: queued } = createQueueMock();
    const token = "failed-run-replay-token";
    const env = {
      DB: state.db,
      AUTOMATION_QUEUE: queue,
      ENV_NAME: "test",
      OPS_DASHBOARD_TOKEN: token,
      OPS_DASHBOARD_READ_TOKEN: token,
      OPS_DASHBOARD_WRITE_TOKEN: token
    };
    const authHeaders = { authorization: `Bearer ${token}` };

    const successResponse = await opsDashboardWorker.fetch(
      new Request("https://ops.example.com/api/replay/trace-failed", { method: "POST", headers: authHeaders }),
      env as never
    );
    assert.equal(successResponse.status, 202);
    const successPayload = (await successResponse.json()) as Record<string, unknown>;
    assert.equal(successPayload.accepted, true);
    assert.equal(queued.length, 1);
    assert.equal(state.lineage.length, 1);

    const invalidResponse = await opsDashboardWorker.fetch(
      new Request("https://ops.example.com/api/replay/trace-succeeded", { method: "POST", headers: authHeaders }),
      env as never
    );
    assert.equal(invalidResponse.status, 409);
    const invalidPayload = (await invalidResponse.json()) as Record<string, unknown>;
    assert.equal(invalidPayload.error, "replay requires failed run");
  });
});
