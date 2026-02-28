import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  apiGet,
  getApiBaseUrl,
  getDefaultOpsToken,
  loadAuditEvents,
  loadCatalog,
  loadDeadLetters,
  loadErrorClusters,
  loadRunDetail,
  loadRuns,
  loadSecretsHealth,
  loadSummary,
  loadTemplates,
  loadTimelineDetail,
  loadTimeline,
  replayRun
} from "./api";

function mockResponse(init: { ok: boolean; status: number; body: unknown }): Response {
  return {
    ok: init.ok,
    status: init.status,
    headers: new Headers({ "content-type": "application/json; charset=utf-8" }),
    json: vi.fn().mockResolvedValue(init.body)
  } as unknown as Response;
}

describe("apiGet", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns base URL and default token without env overrides", () => {
    expect(getApiBaseUrl()).toBe("http://127.0.0.1:8787");
    expect(getDefaultOpsToken()).toBe("");
  });

  it("sends auth header when token is present", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockResponse({ ok: true, status: 200, body: { ok: true } })
    );

    await apiGet<{ ok: boolean }>({ path: "/api/ops/summary", token: "ops-token" });

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://127.0.0.1:8787/api/ops/summary",
      {
        method: "GET",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer ops-token"
        }
      }
    );
  });

  it("throws ApiError with API message on non-2xx responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockResponse({ ok: false, status: 401, body: { error: "unauthorized" } })
    );

    const promise = apiGet({ path: "/api/ops/summary", token: "" });
    await expect(promise).rejects.toBeInstanceOf(ApiError);
    await expect(promise).rejects.toMatchObject({
      message: "unauthorized",
      status: 401
    });
  });

  it("calls all ops loaders with expected API paths", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockResponse({ ok: true, status: 200, body: {} })
    );

    await Promise.all([
      loadSummary("ops", { since: "2026-02-27T00:00:00.000Z" }),
      loadTimeline("ops", { bucket: "minute", since: "2026-02-27T00:00:00.000Z" }),
      loadCatalog("ops", { since: "2026-02-27T00:00:00.000Z" }),
      loadRuns("ops", { status: "failed", limit: 120 }),
      loadDeadLetters("ops"),
      loadErrorClusters("ops", { since: "2026-02-27T00:00:00.000Z", limit: 24 }),
      loadSecretsHealth("ops"),
      loadTemplates("ops"),
      loadAuditEvents("ops", { workspaceId: "default", limit: 40 }),
      loadTimelineDetail("ops", { bucket: "2026-02-28T10:00:00.000Z", resolution: "hour", limit: 12 }),
      loadRunDetail("ops", "trace-123")
    ]);

    const urls = fetchSpy.mock.calls.map((call) => String(call[0]));
    expect(urls).toEqual([
      "http://127.0.0.1:8787/api/ops/summary?since=2026-02-27T00%3A00%3A00.000Z",
      "http://127.0.0.1:8787/api/ops/timeline?bucket=minute&since=2026-02-27T00%3A00%3A00.000Z",
      "http://127.0.0.1:8787/api/ops/catalog?since=2026-02-27T00%3A00%3A00.000Z",
      "http://127.0.0.1:8787/api/ops/runs?status=failed&limit=120",
      "http://127.0.0.1:8787/api/ops/dead-letters?limit=20",
      "http://127.0.0.1:8787/api/ops/error-clusters?limit=24&since=2026-02-27T00%3A00%3A00.000Z",
      "http://127.0.0.1:8787/api/ops/secrets-health",
      "http://127.0.0.1:8787/api/ops/templates",
      "http://127.0.0.1:8787/api/ops/audit-events?workspace=default&limit=40",
      "http://127.0.0.1:8787/api/ops/timeline-detail?bucket=2026-02-28T10%3A00%3A00.000Z&resolution=hour&limit=12",
      "http://127.0.0.1:8787/api/ops/run-detail/trace-123"
    ]);
  });

  it("uses default audit-event limit when none is provided", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockResponse({ ok: true, status: 200, body: {} })
    );

    await loadAuditEvents("ops");

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://127.0.0.1:8787/api/ops/audit-events?limit=30",
      {
        method: "GET",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer ops"
        }
      }
    );
  });

  it("returns ApiError when endpoint responds with Cloudflare HTML block", async () => {
    const blockedResponse = {
      ok: false,
      status: 403,
      headers: new Headers({ "content-type": "text/html; charset=UTF-8" }),
      json: vi.fn().mockRejectedValue(new Error("not json"))
    } as unknown as Response;
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(blockedResponse);

    await expect(apiGet<{ ok: boolean }>({ path: "/api/ops/summary", token: "" })).rejects.toBeInstanceOf(ApiError);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("replays a failed run with encoded trace id and auth header", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockResponse({
        ok: true,
        status: 200,
        body: { accepted: true, retriedFromTraceId: "trace old", newTraceId: "trace new", retryCount: 1 }
      })
    );

    await replayRun("ops-token", "trace old/1");

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://127.0.0.1:8787/api/ops/replay/trace%20old%2F1",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer ops-token"
        }
      }
    );
  });

  it("throws ApiError when replay fails with API error payload", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockResponse({ ok: false, status: 409, body: { error: "run is not failed" } })
    );

    await expect(replayRun("ops", "trace-456")).rejects.toMatchObject({
      message: "run is not failed",
      status: 409
    });
  });

  it("throws fallback ApiError message when replay fails without JSON payload", async () => {
    const badJsonResponse = {
      ok: false,
      status: 500,
      headers: new Headers({ "content-type": "application/json; charset=utf-8" }),
      json: vi.fn().mockRejectedValue(new Error("invalid json"))
    } as unknown as Response;
    vi.spyOn(globalThis, "fetch").mockResolvedValue(badJsonResponse);

    await expect(replayRun("", "trace-789")).rejects.toMatchObject({
      message: "Replay request failed (500)",
      status: 500
    });
  });
});
