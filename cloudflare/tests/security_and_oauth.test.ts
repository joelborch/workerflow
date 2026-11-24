import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  listOAuthTokens,
  oauthTokenNeedsRefresh,
  readOAuthToken,
  redactToken,
  upsertOAuthToken
} from "../shared/oauth_tokens";
import type { Env } from "../shared/types";
import apiWorker from "../workers/api/src/index";
import { resolveConnectorOAuthToken } from "../workers/workflow/src/connectors/oauth";
import workflowWorker from "../workers/workflow/src/index";
import { createMockD1, createQueueMock, jsonResponse } from "./helpers/d1";

function createApiEnv(overrides: Partial<Env> = {}) {
  const { db } = createMockD1();
  const { queue, tasks } = createQueueMock();

  const env: Env = {
    DB: db,
    AUTOMATION_QUEUE: queue,
    WORKFLOW_SERVICE: {
      async fetch() {
        return jsonResponse({ ok: true });
      }
    } as unknown as Fetcher,
    ENV_NAME: "test",
    ...overrides
  };

  return { env, queuedTasks: tasks };
}

function makeApiRequest(path: string, body: string, traceId: string, headers: Record<string, string> = {}) {
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

async function sign(secret: string, payload: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

describe("ingress security, OAuth tokens, and workflow failure modes", () => {
  it("enforces ingress token auth, HMAC signatures, and global/route rate limits", async () => {
    const body = JSON.stringify({ hello: "world" });

    {
      const { env } = createApiEnv({ API_INGRESS_TOKEN: "secret-token" });
      const denied = await apiWorker.fetch(makeApiRequest("/api/webhook_echo", body, "security-token-1"), env);
      assert.equal(denied.status, 401);

      const allowed = await apiWorker.fetch(
        makeApiRequest("/api/webhook_echo", body, "security-token-2", { "x-api-token": "secret-token" }),
        env
      );
      assert.equal(allowed.status, 202);
    }

    {
      const hmacSecret = "hmac-secret";
      const { env } = createApiEnv({ API_HMAC_SECRET: hmacSecret });
      const timestamp = String(Math.floor(Date.now() / 1000));
      const validSig = await sign(hmacSecret, `${timestamp}.${body}`);

      const valid = await apiWorker.fetch(
        makeApiRequest("/api/webhook_echo", body, "security-hmac-1", {
          "x-signature-timestamp": timestamp,
          "x-signature": `v1=${validSig}`
        }),
        env
      );
      assert.equal(valid.status, 202);

      const invalid = await apiWorker.fetch(
        makeApiRequest("/api/webhook_echo", body, "security-hmac-2", {
          "x-signature-timestamp": timestamp,
          "x-signature": "v1=deadbeef"
        }),
        env
      );
      assert.equal(invalid.status, 401);
    }

    {
      const { env } = createApiEnv({
        API_RATE_LIMIT_PER_MINUTE: "1",
        API_INGRESS_TOKEN: "rate-limit-token"
      });

      const first = await apiWorker.fetch(
        makeApiRequest("/api/webhook_echo", body, "security-rate-1", {
          "cf-connecting-ip": "203.0.113.1",
          "x-api-token": "rate-limit-token"
        }),
        env
      );
      assert.equal(first.status, 202);

      const second = await apiWorker.fetch(
        makeApiRequest("/api/webhook_echo", body, "security-rate-2", {
          "cf-connecting-ip": "203.0.113.1",
          "x-api-token": "rate-limit-token"
        }),
        env
      );
      assert.equal(second.status, 429);
    }

    {
      const { env } = createApiEnv({
        API_RATE_LIMIT_PER_MINUTE: "10",
        API_INGRESS_TOKEN: "route-limit-token",
        API_ROUTE_LIMITS_JSON: JSON.stringify({
          webhook_echo: { rpm: 1, burst: 0 }
        })
      });

      const first = await apiWorker.fetch(
        makeApiRequest("/api/webhook_echo", body, "security-route-limit-1", {
          "cf-connecting-ip": "203.0.113.90",
          "x-api-token": "route-limit-token"
        }),
        env
      );
      assert.equal(first.status, 202);

      const blocked = await apiWorker.fetch(
        makeApiRequest("/api/webhook_echo", body, "security-route-limit-2", {
          "cf-connecting-ip": "203.0.113.90",
          "x-api-token": "route-limit-token"
        }),
        env
      );
      assert.equal(blocked.status, 429);

      const allowedOtherRoute = await apiWorker.fetch(
        makeApiRequest("/api/noop_ack", body, "security-route-limit-3", {
          "cf-connecting-ip": "203.0.113.90",
          "x-api-token": "route-limit-token"
        }),
        env
      );
      assert.equal(allowedOtherRoute.status, 202);
    }
  });

  it("stores, lists, redacts, and resolves OAuth tokens", async () => {
    const { db } = createMockD1();
    const soon = new Date(Date.now() + 60_000).toISOString();

    await upsertOAuthToken(db, {
      provider: "hubspot",
      accountId: "acct-1",
      workspaceId: "DentalOps",
      accessToken: "access-token-123456789",
      refreshToken: "refresh-token-123456789",
      expiresAt: soon,
      scopes: ["contacts", "deals"]
    });

    const token = await readOAuthToken(db, {
      provider: "hubspot",
      accountId: "acct-1",
      workspaceId: "dentalops"
    });
    assert.ok(token);
    assert.equal(token?.provider, "hubspot");
    assert.equal(token?.workspaceId, "dentalops");
    assert.equal(token?.scopes.length, 2);

    const listed = await listOAuthTokens(db, "dentalops");
    assert.equal(listed.length, 1);
    assert.equal(redactToken(listed[0]?.accessToken), "acce***6789");

    assert.equal(oauthTokenNeedsRefresh(soon, Date.now(), 300), true);
    assert.equal(oauthTokenNeedsRefresh(null), false);

    const resolved = await resolveConnectorOAuthToken(
      {
        DB: db,
        AUTOMATION_QUEUE: {} as Queue<unknown>,
        WORKFLOW_SERVICE: {} as Fetcher,
        ENV_NAME: "test"
      } as never,
      {
        provider: "hubspot",
        accountId: "acct-1",
        workspaceId: "dentalops"
      }
    );
    assert.ok(resolved);
    assert.equal(resolved?.needsRefresh, true);
  });

  it("returns 500 handler_error for unsupported task kinds and missing routes", async () => {
    const internalToken = "failure-modes-internal-token";
    const env = {
      DB: {} as D1Database,
      AUTOMATION_QUEUE: {} as Queue<unknown>,
      WORKFLOW_SERVICE: {} as Fetcher,
      ENV_NAME: "test",
      WORKFLOW_INTERNAL_TOKEN: internalToken
    } as unknown as Env;

    const unsupportedTaskResponse = await workflowWorker.fetch(
      new Request("https://workflow.example/run-sync", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-workflow-internal-token": internalToken
        },
        body: JSON.stringify({
          kind: "unsupported_kind",
          traceId: "trace-unsupported",
          enqueuedAt: new Date().toISOString()
        })
      }),
      env
    );
    assert.equal(unsupportedTaskResponse.status, 500);
    const unsupportedPayload = (await unsupportedTaskResponse.json()) as Record<string, unknown>;
    assert.equal(unsupportedPayload.error, "handler_error");

    const missingRouteResponse = await workflowWorker.fetch(
      new Request("https://workflow.example/run-sync", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-workflow-internal-token": internalToken
        },
        body: JSON.stringify({
          kind: "http_route",
          traceId: "trace-missing-route",
          enqueuedAt: new Date().toISOString()
        })
      }),
      env
    );
    assert.equal(missingRouteResponse.status, 500);
  });
});
