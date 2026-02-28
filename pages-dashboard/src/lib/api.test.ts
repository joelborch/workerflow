import { describe, expect, it, vi } from "vitest";
import {
  ApiError,
  apiGet,
  getApiBaseUrl,
  getDefaultOpsToken,
  loadCatalog,
  loadDeadLetters,
  loadErrorClusters,
  loadRunDetail,
  loadRuns,
  loadSummary,
  loadTimelineDetail,
  loadTimeline
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
      "http://127.0.0.1:8787/api/ops/timeline-detail?bucket=2026-02-28T10%3A00%3A00.000Z&resolution=hour&limit=12",
      "http://127.0.0.1:8787/api/ops/run-detail/trace-123"
    ]);
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
});
