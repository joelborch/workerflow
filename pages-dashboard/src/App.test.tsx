import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import * as api from "./lib/api";

vi.mock("./lib/api", async () => {
  const actual = await vi.importActual<typeof import("./lib/api")>("./lib/api");
  return {
    ...actual,
    loadSummary: vi.fn(),
    loadTimeline: vi.fn(),
    loadCatalog: vi.fn(),
    loadRuns: vi.fn(),
    loadDeadLetters: vi.fn(),
    loadErrorClusters: vi.fn(),
    loadTimelineDetail: vi.fn(),
    loadRunDetail: vi.fn()
  };
});

const mockedApi = vi.mocked(api, true);

function renderApp() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  );
}

describe("App dashboard", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState(null, "", "/");

    mockedApi.loadSummary.mockResolvedValue({
      windowHours: 24,
      since: "2026-02-27T00:00:00.000Z",
      until: "2026-02-28T00:00:00.000Z",
      totalRuns: 1200,
      succeededRuns: 1140,
      failedRuns: 60,
      startedRuns: 8,
      deadLetters: 2,
      topRoutes: [{ routePath: "/hooks/leads", count: 400 }]
    });
    mockedApi.loadTimeline.mockResolvedValue({
      bucket: "hour",
      since: "2026-02-27T00:00:00.000Z",
      until: "2026-02-28T00:00:00.000Z",
      buckets: [
        {
          bucket: "10:00",
          succeeded: 80,
          failed: 2,
          running: 1,
          total: 83,
          topFailureScope: "/hooks/leads",
          topFailureCount: 2
        }
      ]
    });
    mockedApi.loadCatalog.mockResolvedValue({
      since: "2026-02-27T00:00:00.000Z",
      until: "2026-02-28T00:00:00.000Z",
      windowHours: 24,
      routes: [],
      schedules: [],
      flows: [
        {
          flowPath: "flows/leads/enrich.ts",
          httpRoutes: ["/hooks/leads"],
          schedules: [],
          succeeded: 500,
          failed: 4,
          started: 1,
          total: 505
        }
      ]
    });
    mockedApi.loadRuns.mockResolvedValue({
      limit: 30,
      runs: [
        {
          traceId: "trace-123",
          kind: "http_route",
          routePath: "/hooks/leads",
          scheduleId: null,
          status: "succeeded",
          startedAt: "2026-02-27T10:00:00.000Z",
          finishedAt: "2026-02-27T10:00:02.000Z",
          duration: "2s",
          output: null,
          error: null
        },
        {
          traceId: "trace-456",
          kind: "http_route",
          routePath: "/hooks/orders",
          scheduleId: null,
          status: "failed",
          startedAt: "2026-02-27T10:10:00.000Z",
          finishedAt: "2026-02-27T10:10:05.000Z",
          duration: "5s",
          output: null,
          error: "Gateway timeout 504 on upstream"
        }
      ]
    });
    mockedApi.loadDeadLetters.mockResolvedValue({
      limit: 20,
      deadLetters: []
    });
    mockedApi.loadErrorClusters.mockResolvedValue({
      since: "2026-02-27T00:00:00.000Z",
      clusters: []
    });
    mockedApi.loadTimelineDetail.mockResolvedValue({
      bucket: "10:00",
      resolution: "hour",
      window: {
        start: "2026-02-27T10:00:00.000Z",
        end: "2026-02-27T11:00:00.000Z"
      },
      statusCounts: { succeeded: 1, failed: 0, running: 0, total: 1 },
      topScopes: [],
      runs: []
    });
    mockedApi.loadRunDetail.mockImplementation(async (_token, traceId) => {
      if (traceId === "trace-456") {
        return {
          traceId: "trace-456",
          run: {
            traceId: "trace-456",
            kind: "http_route",
            routePath: "/hooks/orders",
            scheduleId: null,
            status: "failed",
            startedAt: "2026-02-27T10:10:00.000Z",
            finishedAt: "2026-02-27T10:10:05.000Z",
            duration: "5s",
            output: "{\"error\":\"timeout\"}",
            error: "Gateway timeout 504 on upstream"
          },
          deadLetter: null,
          retries: {
            parentTraceId: "trace-456",
            attempts: []
          }
        };
      }

      return {
        traceId: "trace-123",
        run: {
          traceId: "trace-123",
          kind: "http_route",
          routePath: "/hooks/leads",
          scheduleId: null,
          status: "succeeded",
          startedAt: "2026-02-27T10:00:00.000Z",
          finishedAt: "2026-02-27T10:00:02.000Z",
          duration: "2s",
          output: "{\"count\":1,\"result\":\"ok\"}",
          error: null
        },
        deadLetter: null,
        retries: {
          parentTraceId: "trace-123",
          attempts: []
        }
      };
    });
  });

  it("renders key dashboard sections from ops APIs", async () => {
    renderApp();

    expect(await screen.findByText("Automation Mission Control")).toBeInTheDocument();
    expect(await screen.findByText("Operational Snapshot")).toBeInTheDocument();
    expect(await screen.findByText("Runs Explorer")).toBeInTheDocument();
    expect(await screen.findByText("Flow Reliability Board")).toBeInTheDocument();
    expect(await screen.findByText("flows/leads/enrich.ts")).toBeInTheDocument();
  });

  it("persists ops token and reloads queries with token", async () => {
    renderApp();
    expect(await screen.findByText("Automation Mission Control")).toBeInTheDocument();

    const input = screen.getByLabelText("Ops Token (optional)");
    fireEvent.change(input, { target: { value: "token-123" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(window.localStorage.getItem("workerflow.ops.token")).toBe("token-123");
    expect(mockedApi.loadSummary).toHaveBeenLastCalledWith("token-123", expect.any(Object));
  });

  it("restores saved filters from local storage and keeps them updated", async () => {
    window.localStorage.setItem(
      "workerflow.ops.filters.v1",
      JSON.stringify({
        range: "7d",
        bucket: "minute",
        status: "",
        kind: "",
        routePath: "/hooks/saved",
        scheduleId: "",
        search: "",
        limit: 80,
        refreshSeconds: 30
      })
    );

    renderApp();

    const timeWindowSelect = (await screen.findByLabelText("Time Window")) as HTMLSelectElement;
    const routePathInput = screen.getByLabelText("Route Path") as HTMLInputElement;
    expect(timeWindowSelect.value).toBe("7d");
    expect(routePathInput.value).toBe("/hooks/saved");

    fireEvent.change(timeWindowSelect, { target: { value: "1h" } });
    const saved = JSON.parse(window.localStorage.getItem("workerflow.ops.filters.v1") || "{}") as {
      range?: string;
    };
    expect(saved.range).toBe("1h");
  });

  it("compares two runs side by side", async () => {
    renderApp();
    expect(await screen.findByText("Run Comparison")).toBeInTheDocument();
    expect(await screen.findByText("/hooks/leads")).toBeInTheDocument();
    expect(await screen.findByText("/hooks/orders")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /set comparison a trace-123/i }));
    fireEvent.click(screen.getByRole("button", { name: /set comparison b trace-456/i }));

    expect(await screen.findByText("object{count, result}")).toBeInTheDocument();
    expect(await screen.findByText("object{error}")).toBeInTheDocument();
    expect(await screen.findByText("2000")).toBeInTheDocument();
    expect(await screen.findByText("5000")).toBeInTheDocument();
  });
});
