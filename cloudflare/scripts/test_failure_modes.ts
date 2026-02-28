import assert from "node:assert/strict";

import type { Env } from "../shared/types";
import workflowWorker from "../workers/workflow/src/index";

function env(): Env {
  return {
    DB: {} as D1Database,
    AUTOMATION_QUEUE: {} as Queue<unknown>,
    WORKFLOW_SERVICE: {} as Fetcher,
    ENV_NAME: "test"
  } as unknown as Env;
}

async function run() {
  const unsupportedTaskResponse = await workflowWorker.fetch(
    new Request("https://workflow.example/run-sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind: "unsupported_kind",
        traceId: "trace-unsupported",
        enqueuedAt: new Date().toISOString()
      })
    }),
    env()
  );

  assert.equal(unsupportedTaskResponse.status, 500);
  const unsupportedPayload = (await unsupportedTaskResponse.json()) as Record<string, unknown>;
  assert.equal(unsupportedPayload.error, "handler_error");

  const missingRouteResponse = await workflowWorker.fetch(
    new Request("https://workflow.example/run-sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind: "http_route",
        traceId: "trace-missing-route",
        enqueuedAt: new Date().toISOString()
      })
    }),
    env()
  );

  assert.equal(missingRouteResponse.status, 500);

  console.log("failure mode tests passed");
}

run().catch((error) => {
  console.error("failure mode tests failed", error);
  process.exitCode = 1;
});
