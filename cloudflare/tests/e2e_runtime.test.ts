import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Env, QueueTask } from "../shared/types";
import apiWorker from "../workers/api/src/index";
import queueWorker from "../workers/queue-consumer/src/index";
import workflowWorker from "../workers/workflow/src/index";
import { createMockD1, createQueueMock, jsonResponse } from "./helpers/d1";

describe("end-to-end API, queue consumer, and workflow runtime", () => {
  it("runs sync routes, succeeds async queued routes, and dead-letters failing tasks", async () => {
    const dbState = createMockD1();
    const { queue: automationQueue, tasks: queued } = createQueueMock();
    const API_INGRESS_TOKEN = "e2e-ingress-token";
    const WORKFLOW_INTERNAL_TOKEN = "e2e-workflow-internal-token";

    const workflowEnv: Env = {
      DB: dbState.db,
      AUTOMATION_QUEUE: automationQueue,
      WORKFLOW_SERVICE: {} as Fetcher,
      ENV_NAME: "test",
      OPENAI_API_KEY: "fixture-openai",
      WORKFLOW_INTERNAL_TOKEN
    };

    const workflowService = {
      async fetch(input: string | URL | Request, init?: RequestInit) {
        const originalRequest = input instanceof Request ? input : undefined;
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        const path = new URL(url).pathname;
        const forwardedToken =
          (init?.headers as Record<string, string> | undefined)?.["x-workflow-internal-token"] ??
          originalRequest?.headers.get("x-workflow-internal-token") ??
          "";
        if (path === "/health/config") {
          return workflowWorker.fetch(
            new Request("https://workflow.example/health/config", {
              headers: { "x-workflow-internal-token": forwardedToken }
            }),
            workflowEnv
          );
        }
        if (path === "/run-sync" || path === "/run-async") {
          return workflowWorker.fetch(
            new Request(`https://workflow.example${path}`, {
              method: "POST",
              headers: {
                "content-type": "application/json",
                "x-workflow-internal-token": forwardedToken
              },
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
      AUTOMATION_QUEUE: automationQueue,
      WORKFLOW_SERVICE: workflowService,
      ENV_NAME: "test",
      API_INGRESS_TOKEN,
      WORKFLOW_INTERNAL_TOKEN
    };

    const queueConsumerEnv = {
      DB: dbState.db,
      AUTOMATION_QUEUE: automationQueue,
      WORKFLOW_SERVICE: workflowService,
      ENV_NAME: "test",
      WORKFLOW_INTERNAL_TOKEN
    } as Env;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input: RequestInfo | URL) => {
      const requestUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (new URL(requestUrl).hostname === "api.openai.com") {
        return jsonResponse({ choices: [{ message: { content: "E2E completion" } }] });
      }
      return jsonResponse({ ok: true });
    };

    try {
      const syncResponse = await apiWorker.fetch(
        new Request("https://api.example.com/api/openai_chat", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-trace-id": "e2e-sync-1",
            "x-api-token": API_INGRESS_TOKEN
          },
          body: JSON.stringify({ prompt: "hello from e2e" })
        }),
        apiEnv
      );
      assert.equal(syncResponse.status, 200);

      const asyncResponse = await apiWorker.fetch(
        new Request("https://api.example.com/api/webhook_echo", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-trace-id": "e2e-async-1",
            "x-api-token": API_INGRESS_TOKEN
          },
          body: JSON.stringify({ hello: "async" })
        }),
        apiEnv
      );
      assert.equal(asyncResponse.status, 202);
      assert.equal(queued.length, 1);

      await queueWorker.queue(
        {
          messages: queued.splice(0, queued.length).map((task) => ({
            body: task,
            ack() {},
            retry() {}
          }))
        } as unknown as MessageBatch<QueueTask>,
        queueConsumerEnv
      );

      const asyncRun = dbState.runs.get("e2e-async-1");
      assert.ok(asyncRun);
      assert.equal(asyncRun?.status, "succeeded");

      const failEnqueue = await apiWorker.fetch(
        new Request("https://api.example.com/api/slack_message", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-trace-id": "e2e-fail-1",
            "x-api-token": API_INGRESS_TOKEN
          },
          body: JSON.stringify({ text: "will fail due missing secret" })
        }),
        apiEnv
      );
      assert.equal(failEnqueue.status, 202);

      await queueWorker.queue(
        {
          messages: queued.splice(0, queued.length).map((task) => ({
            body: task,
            ack() {},
            retry() {}
          }))
        } as unknown as MessageBatch<QueueTask>,
        queueConsumerEnv
      );

      const failedRun = dbState.runs.get("e2e-fail-1");
      assert.ok(failedRun);
      assert.equal(failedRun?.status, "failed");
      assert.equal(dbState.deadLetters.length, 1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
