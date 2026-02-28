import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import {
  Activity,
  AlertTriangle,
  Database,
  KeyRound,
  Layers,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  Route,
  ShieldCheck
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import {
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
  loadTimeline,
  loadTimelineDetail,
  replayRun
} from "./lib/api";
import { clampText, compactNumber, fmtTs, pct } from "./lib/format";

const OPS_TOKEN_KEY = "workerflow.ops.token";
const FILTERS_STORAGE_KEY = "workerflow.ops.filters.v1";
const RUNS_PAGE_SIZE = 14;

type TimeRangePreset = "1h" | "6h" | "24h" | "7d";
type TimelineBucket = "hour" | "minute";
type RunsSortKey = "startedAt" | "status" | "scope";
type RunsSortDir = "asc" | "desc";
type SecretStatusFilter = "" | "ready" | "partial" | "missing";

type Filters = {
  range: TimeRangePreset;
  bucket: TimelineBucket;
  status: string;
  kind: string;
  workspaceId: string;
  routePath: string;
  scheduleId: string;
  search: string;
  limit: number;
  refreshSeconds: number;
};

const DEFAULT_FILTERS: Filters = {
  range: "24h",
  bucket: "hour",
  status: "",
  kind: "",
  workspaceId: "",
  routePath: "",
  scheduleId: "",
  search: "",
  limit: 80,
  refreshSeconds: 30
};

function initialToken() {
  const local = typeof window !== "undefined" ? window.localStorage.getItem(OPS_TOKEN_KEY) : "";
  if (local && local.trim().length > 0) {
    return local.trim();
  }
  return getDefaultOpsToken();
}

function readFiltersFromUrl(): Filters {
  if (typeof window === "undefined") {
    return DEFAULT_FILTERS;
  }
  const params = new URLSearchParams(window.location.search);
  const range = params.get("range");
  const bucket = params.get("bucket");
  const refreshSeconds = Number.parseInt(params.get("refresh") ?? "", 10);
  const limit = Number.parseInt(params.get("limit") ?? "", 10);

  return {
    range: range === "1h" || range === "6h" || range === "24h" || range === "7d" ? range : DEFAULT_FILTERS.range,
    bucket: bucket === "minute" ? "minute" : "hour",
    status: params.get("status") ?? "",
    kind: params.get("kind") ?? "",
    workspaceId: params.get("workspace") ?? "",
    routePath: params.get("routePath") ?? "",
    scheduleId: params.get("scheduleId") ?? "",
    search: params.get("search") ?? "",
    limit: Number.isFinite(limit) && limit > 0 ? Math.min(limit, 250) : DEFAULT_FILTERS.limit,
    refreshSeconds:
      Number.isFinite(refreshSeconds) && refreshSeconds > 0 ? Math.min(refreshSeconds, 300) : DEFAULT_FILTERS.refreshSeconds
  };
}

function readFiltersFromStorage(): Filters | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(FILTERS_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }

  const candidate = parsed as Partial<Filters>;
  const range = candidate.range;
  const bucket = candidate.bucket;
  const limit = Number(candidate.limit);
  const refreshSeconds = Number(candidate.refreshSeconds);

  return {
    range: range === "1h" || range === "6h" || range === "24h" || range === "7d" ? range : DEFAULT_FILTERS.range,
    bucket: bucket === "minute" ? "minute" : "hour",
    status: typeof candidate.status === "string" ? candidate.status : DEFAULT_FILTERS.status,
    kind: typeof candidate.kind === "string" ? candidate.kind : DEFAULT_FILTERS.kind,
    workspaceId: typeof candidate.workspaceId === "string" ? candidate.workspaceId : DEFAULT_FILTERS.workspaceId,
    routePath: typeof candidate.routePath === "string" ? candidate.routePath : DEFAULT_FILTERS.routePath,
    scheduleId: typeof candidate.scheduleId === "string" ? candidate.scheduleId : DEFAULT_FILTERS.scheduleId,
    search: typeof candidate.search === "string" ? candidate.search : DEFAULT_FILTERS.search,
    limit: Number.isFinite(limit) && limit > 0 ? Math.min(limit, 250) : DEFAULT_FILTERS.limit,
    refreshSeconds:
      Number.isFinite(refreshSeconds) && refreshSeconds > 0 ? Math.min(refreshSeconds, 300) : DEFAULT_FILTERS.refreshSeconds
  };
}

function writeFiltersToStorage(filters: Filters) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters));
}

function hasUrlFilterOverrides() {
  if (typeof window === "undefined") {
    return false;
  }
  const params = new URLSearchParams(window.location.search);
  return ["range", "bucket", "status", "kind", "workspace", "routePath", "scheduleId", "search", "limit", "refresh"].some(
    (key) => params.has(key)
  );
}

function readInitialFilters(): Filters {
  const urlFilters = readFiltersFromUrl();
  const saved = readFiltersFromStorage();
  if (hasUrlFilterOverrides()) {
    return urlFilters;
  }
  return saved ?? urlFilters;
}

function writeFiltersToUrl(filters: Filters, paused: boolean) {
  if (typeof window === "undefined") {
    return;
  }
  const params = new URLSearchParams();
  params.set("range", filters.range);
  params.set("bucket", filters.bucket);
  if (filters.status) {
    params.set("status", filters.status);
  }
  if (filters.kind) {
    params.set("kind", filters.kind);
  }
  if (filters.workspaceId) {
    params.set("workspace", filters.workspaceId);
  }
  if (filters.routePath) {
    params.set("routePath", filters.routePath);
  }
  if (filters.scheduleId) {
    params.set("scheduleId", filters.scheduleId);
  }
  if (filters.search) {
    params.set("search", filters.search);
  }
  params.set("limit", String(filters.limit));
  params.set("refresh", String(filters.refreshSeconds));
  if (paused) {
    params.set("paused", "1");
  }
  const next = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState(null, "", next);
}

function readPausedFromUrl() {
  if (typeof window === "undefined") {
    return false;
  }
  return new URLSearchParams(window.location.search).get("paused") === "1";
}

function isoSinceForRange(range: TimeRangePreset) {
  const now = Date.now();
  const rangeHours = range === "1h" ? 1 : range === "6h" ? 6 : range === "7d" ? 24 * 7 : 24;
  return new Date(now - rangeHours * 60 * 60 * 1000).toISOString();
}

type ChartClickState = {
  activePayload?: Array<{
    payload?: {
      routePath?: string;
      bucket?: string;
    };
  }>;
};

type ComparisonSlot = "A" | "B";

function normalizeErrorCluster(error: string | null) {
  if (!error || !error.trim()) {
    return "none";
  }

  return error
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, "{url}")
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi, "{uuid}")
    .replace(/\b\d{3,}\b/g, "{n}")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function inferPayloadShape(rawPayload: string | null) {
  if (!rawPayload) {
    return "none";
  }

  let parsed: unknown = rawPayload;
  if (typeof parsed === "string") {
    const trimmed = parsed.trim();
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      parsed = trimmed;
    }
  }

  if (Array.isArray(parsed)) {
    return `array(len=${parsed.length})`;
  }

  if (parsed && typeof parsed === "object") {
    const keys = Object.keys(parsed as Record<string, unknown>).sort();
    if (keys.length === 0) {
      return "object{}";
    }
    const preview = keys.slice(0, 6).join(", ");
    return keys.length > 6 ? `object{${preview}, ...}` : `object{${preview}}`;
  }

  return typeof parsed;
}

function latencyMs(startedAt: string, finishedAt: string | null) {
  if (!finishedAt) {
    return null;
  }
  const started = Date.parse(startedAt);
  const finished = Date.parse(finishedAt);
  if (!Number.isFinite(started) || !Number.isFinite(finished)) {
    return null;
  }
  return Math.max(0, finished - started);
}

function App() {
  const [tokenInput, setTokenInput] = useState(initialToken);
  const [opsToken, setOpsToken] = useState(initialToken);
  const [filters, setFilters] = useState<Filters>(readInitialFilters);
  const [paused, setPaused] = useState(readPausedFromUrl);
  const [selectedTimelineBucket, setSelectedTimelineBucket] = useState("");
  const [selectedTraceId, setSelectedTraceId] = useState("");
  const [compareTraceA, setCompareTraceA] = useState("");
  const [compareTraceB, setCompareTraceB] = useState("");
  const [runsSortKey, setRunsSortKey] = useState<RunsSortKey>("startedAt");
  const [runsSortDir, setRunsSortDir] = useState<RunsSortDir>("desc");
  const [runsPage, setRunsPage] = useState(1);
  const [secretStatusFilter, setSecretStatusFilter] = useState<SecretStatusFilter>("");

  const since = useMemo(() => isoSinceForRange(filters.range), [filters.range]);
  const refetchInterval = paused ? false : filters.refreshSeconds * 1000;

  useEffect(() => {
    writeFiltersToUrl(filters, paused);
    writeFiltersToStorage(filters);
  }, [filters, paused]);

  const summaryQuery = useQuery({
    queryKey: ["ops", opsToken, "summary", since],
    queryFn: () => loadSummary(opsToken, { since }),
    refetchInterval
  });

  const timelineQuery = useQuery({
    queryKey: ["ops", opsToken, "timeline", filters.bucket, since],
    queryFn: () => loadTimeline(opsToken, { bucket: filters.bucket, since }),
    refetchInterval
  });

  const catalogQuery = useQuery({
    queryKey: ["ops", opsToken, "catalog", since],
    queryFn: () => loadCatalog(opsToken, { since }),
    refetchInterval
  });

  const runsQuery = useQuery({
    queryKey: [
      "ops",
      opsToken,
      "runs",
      filters.status,
      filters.kind,
      filters.workspaceId,
      filters.routePath,
      filters.scheduleId,
      filters.limit
    ],
    queryFn: () =>
      loadRuns(opsToken, {
        status: filters.status || undefined,
        kind: filters.kind || undefined,
        workspaceId: filters.workspaceId || undefined,
        routePath: filters.routePath || undefined,
        scheduleId: filters.scheduleId || undefined,
        limit: filters.limit
      }),
    refetchInterval
  });

  const runDetailQuery = useQuery({
    queryKey: ["ops", opsToken, "run-detail", selectedTraceId],
    queryFn: () => loadRunDetail(opsToken, selectedTraceId),
    enabled: selectedTraceId.length > 0,
    refetchInterval
  });

  const compareRunAQuery = useQuery({
    queryKey: ["ops", opsToken, "run-compare", "a", compareTraceA],
    queryFn: () => loadRunDetail(opsToken, compareTraceA),
    enabled: compareTraceA.length > 0,
    refetchInterval
  });

  const compareRunBQuery = useQuery({
    queryKey: ["ops", opsToken, "run-compare", "b", compareTraceB],
    queryFn: () => loadRunDetail(opsToken, compareTraceB),
    enabled: compareTraceB.length > 0,
    refetchInterval
  });

  const deadLettersQuery = useQuery({
    queryKey: ["ops", opsToken, "deadletters"],
    queryFn: () => loadDeadLetters(opsToken),
    refetchInterval
  });

  const clustersQuery = useQuery({
    queryKey: ["ops", opsToken, "clusters", since],
    queryFn: () => loadErrorClusters(opsToken, { since, limit: 20 }),
    refetchInterval
  });

  const secretsHealthQuery = useQuery({
    queryKey: ["ops", opsToken, "secrets-health"],
    queryFn: () => loadSecretsHealth(opsToken),
    refetchInterval
  });

  const templatesQuery = useQuery({
    queryKey: ["ops", opsToken, "templates"],
    queryFn: () => loadTemplates(opsToken),
    refetchInterval: false
  });

  const auditEventsQuery = useQuery({
    queryKey: ["ops", opsToken, "audit-events", filters.workspaceId],
    queryFn: () => loadAuditEvents(opsToken, { workspaceId: filters.workspaceId || undefined, limit: 25 }),
    refetchInterval
  });

  const queries = [
    summaryQuery,
    timelineQuery,
    catalogQuery,
    runsQuery,
    deadLettersQuery,
    clustersQuery,
    secretsHealthQuery,
    templatesQuery,
    auditEventsQuery
  ];
  const loading = queries.some((query) => query.isLoading);
  const error = queries.map((query) => query.error).find(Boolean);

  const summary = summaryQuery.data;
  const timeline = timelineQuery.data;
  const catalog = catalogQuery.data;
  const runs = useMemo(() => runsQuery.data?.runs ?? [], [runsQuery.data]);
  const deadLetters = deadLettersQuery.data?.deadLetters ?? [];
  const clusters = clustersQuery.data?.clusters ?? [];
  const templates = templatesQuery.data?.templates ?? [];
  const auditEvents = auditEventsQuery.data?.events ?? [];
  const connectorSecrets = useMemo(() => secretsHealthQuery.data?.connectors ?? [], [secretsHealthQuery.data]);
  const filteredConnectorSecrets = useMemo(
    () => (secretStatusFilter ? connectorSecrets.filter((item) => item.status === secretStatusFilter) : connectorSecrets),
    [connectorSecrets, secretStatusFilter]
  );

  const failRate = summary ? pct(summary.failedRuns, summary.totalRuns) : "0.0";

  const effectiveTimelineBucket = useMemo(() => {
    const buckets = timeline?.buckets ?? [];
    if (buckets.length === 0) {
      return "";
    }
    if (selectedTimelineBucket && buckets.some((item) => item.bucket === selectedTimelineBucket)) {
      return selectedTimelineBucket;
    }
    return buckets[buckets.length - 1]?.bucket ?? "";
  }, [timeline, selectedTimelineBucket]);

  const timelineDetailQuery = useQuery({
    queryKey: ["ops", opsToken, "timeline-detail", effectiveTimelineBucket, filters.bucket],
    queryFn: () => loadTimelineDetail(opsToken, { bucket: effectiveTimelineBucket, resolution: filters.bucket, limit: 16 }),
    enabled: effectiveTimelineBucket.length > 0,
    refetchInterval
  });

  const timelineDetail = timelineDetailQuery.data;

  const flowLeaders = useMemo(() => {
    if (!catalog) {
      return [] as Array<{ flowPath: string; failed: number; total: number; schedules: number; routes: number }>;
    }
    return catalog.flows
      .map((flow) => ({
        flowPath: flow.flowPath,
        failed: flow.failed,
        total: flow.total,
        schedules: flow.schedules.length,
        routes: flow.httpRoutes.length
      }))
      .sort((a, b) => b.failed - a.failed || b.total - a.total)
      .slice(0, 10);
  }, [catalog]);

  const routeCatalogRows = useMemo(() => catalog?.routes ?? [], [catalog]);
  const scheduleCatalogRows = useMemo(() => catalog?.schedules ?? [], [catalog]);

  const filteredRuns = useMemo(() => {
    const needle = filters.search.trim().toLowerCase();
    const searched = needle
      ? runs.filter((run) =>
          [run.traceId, run.routePath ?? "", run.scheduleId ?? "", run.error ?? ""].some((value) =>
            value.toLowerCase().includes(needle)
          )
        )
      : runs;

    const sorted = [...searched].sort((a, b) => {
      let left: string;
      let right: string;
      if (runsSortKey === "startedAt") {
        left = a.startedAt;
        right = b.startedAt;
      } else if (runsSortKey === "status") {
        left = a.status;
        right = b.status;
      } else {
        left = a.routePath ?? a.scheduleId ?? "";
        right = b.routePath ?? b.scheduleId ?? "";
      }
      const result = left.localeCompare(right);
      return runsSortDir === "asc" ? result : -result;
    });
    return sorted;
  }, [runs, filters.search, runsSortKey, runsSortDir]);

  const totalRunPages = Math.max(1, Math.ceil(filteredRuns.length / RUNS_PAGE_SIZE));
  const safeRunsPage = Math.min(runsPage, totalRunPages);
  const paginatedRuns = filteredRuns.slice((safeRunsPage - 1) * RUNS_PAGE_SIZE, safeRunsPage * RUNS_PAGE_SIZE);

  const compareStats = useMemo(() => {
    const left = compareRunAQuery.data;
    const right = compareRunBQuery.data;

    const leftRun = left?.run ?? null;
    const rightRun = right?.run ?? null;

    return {
      left: leftRun
        ? {
            traceId: leftRun.traceId,
            status: leftRun.status,
            latencyMs: latencyMs(leftRun.startedAt, leftRun.finishedAt),
            errorCluster: normalizeErrorCluster(leftRun.error),
            payloadShape: inferPayloadShape(left?.deadLetter?.payloadJson ?? leftRun.output)
          }
        : null,
      right: rightRun
        ? {
            traceId: rightRun.traceId,
            status: rightRun.status,
            latencyMs: latencyMs(rightRun.startedAt, rightRun.finishedAt),
            errorCluster: normalizeErrorCluster(rightRun.error),
            payloadShape: inferPayloadShape(right?.deadLetter?.payloadJson ?? rightRun.output)
          }
        : null
    };
  }, [compareRunAQuery.data, compareRunBQuery.data]);

  function updateFilters(next: Partial<Filters>) {
    setFilters((prev) => ({ ...prev, ...next }));
    setRunsPage(1);
  }

  function clearFilters() {
    setFilters(DEFAULT_FILTERS);
    setRunsPage(1);
  }

  function restoreSavedFilters() {
    const saved = readFiltersFromStorage();
    if (!saved) {
      return;
    }
    setFilters(saved);
    setRunsPage(1);
  }

  function refreshAll() {
    void summaryQuery.refetch();
    void timelineQuery.refetch();
    void timelineDetailQuery.refetch();
    void catalogQuery.refetch();
    void runsQuery.refetch();
    void runDetailQuery.refetch();
    void deadLettersQuery.refetch();
    void clustersQuery.refetch();
    void secretsHealthQuery.refetch();
    void templatesQuery.refetch();
    void auditEventsQuery.refetch();
  }

  function saveToken() {
    const next = tokenInput.trim();
    if (typeof window !== "undefined") {
      if (next) {
        window.localStorage.setItem(OPS_TOKEN_KEY, next);
      } else {
        window.localStorage.removeItem(OPS_TOKEN_KEY);
      }
    }
    setOpsToken(next);
  }

  function onRouteBarClick(state: unknown) {
    const routePath = (state as ChartClickState).activePayload?.[0]?.payload?.routePath;
    if (!routePath) {
      return;
    }
    updateFilters({ routePath });
  }

  function applyRouteFilter(routePath: string) {
    updateFilters({ routePath, scheduleId: "" });
  }

  function applyScheduleFilter(scheduleId: string) {
    updateFilters({ scheduleId, routePath: "" });
  }

  function assignRunToComparison(slot: ComparisonSlot, traceId: string) {
    if (slot === "A") {
      setCompareTraceA(traceId);
      return;
    }
    setCompareTraceB(traceId);
  }

  function onTimelineBucketClick(state: unknown) {
    const bucket = (state as ChartClickState).activePayload?.[0]?.payload?.bucket;
    if (!bucket) {
      return;
    }
    setSelectedTimelineBucket(bucket);
  }

  async function replaySelectedRun() {
    if (!selectedTraceId) {
      return;
    }
    await replayRun(opsToken, selectedTraceId);
    await Promise.all([
      runsQuery.refetch(),
      runDetailQuery.refetch(),
      deadLettersQuery.refetch(),
      auditEventsQuery.refetch()
    ]);
  }

  return (
    <div className="app-shell">
      <div className="background-mesh" />
      <header className="hero">
        <div className="hero-brand">
          <p className="eyebrow">WorkerFlow</p>
          <h1>Automation Mission Control</h1>
          <p className="subtitle">
            Interactive telemetry cockpit for Cloudflare automation: filter runs, drill into failures, and trace retries.
          </p>
        </div>
        <div className="hero-actions">
          <div className="token-panel">
            <label htmlFor="ops-token">
              <KeyRound size={14} /> Ops Token (optional)
            </label>
            <div className="token-row">
              <input
                id="ops-token"
                value={tokenInput}
                onChange={(event) => setTokenInput(event.target.value)}
                placeholder="Paste OPS_DASHBOARD_TOKEN"
              />
              <button type="button" onClick={saveToken}>
                Apply
              </button>
            </div>
          </div>
          <button type="button" className="refresh-btn" onClick={refreshAll}>
            <RefreshCw size={16} /> Refresh
          </button>
          <button type="button" className="refresh-btn ghost" onClick={() => setPaused((value) => !value)}>
            {paused ? <PlayCircle size={16} /> : <PauseCircle size={16} />}
            {paused ? "Resume" : "Pause"}
          </button>
        </div>
      </header>

      <section className="panel filter-panel">
        <div className="filter-grid">
          <label>
            Time Window
            <select value={filters.range} onChange={(event) => updateFilters({ range: event.target.value as TimeRangePreset })}>
              <option value="1h">Last 1h</option>
              <option value="6h">Last 6h</option>
              <option value="24h">Last 24h</option>
              <option value="7d">Last 7d</option>
            </select>
          </label>
          <label>
            Timeline Bucket
            <select value={filters.bucket} onChange={(event) => updateFilters({ bucket: event.target.value as TimelineBucket })}>
              <option value="hour">Hourly</option>
              <option value="minute">Minute</option>
            </select>
          </label>
          <label>
            Status
            <select value={filters.status} onChange={(event) => updateFilters({ status: event.target.value })}>
              <option value="">All</option>
              <option value="succeeded">Succeeded</option>
              <option value="failed">Failed</option>
              <option value="started">Running/Started</option>
            </select>
          </label>
          <label>
            Kind
            <select value={filters.kind} onChange={(event) => updateFilters({ kind: event.target.value })}>
              <option value="">All</option>
              <option value="http_route">HTTP Route</option>
              <option value="scheduled_job">Scheduled Job</option>
            </select>
          </label>
          <label>
            Workspace
            <input
              value={filters.workspaceId}
              onChange={(event) => updateFilters({ workspaceId: event.target.value })}
              placeholder="default"
            />
          </label>
          <label>
            Route Path
            <input
              value={filters.routePath}
              onChange={(event) => updateFilters({ routePath: event.target.value })}
              placeholder="journee_purchased_on_shopify"
            />
          </label>
          <label>
            Schedule ID
            <input
              value={filters.scheduleId}
              onChange={(event) => updateFilters({ scheduleId: event.target.value })}
              placeholder="digest_daily"
            />
          </label>
          <label>
            Search Runs
            <input value={filters.search} onChange={(event) => updateFilters({ search: event.target.value })} placeholder="trace, route, error" />
          </label>
          <label>
            API Limit
            <input
              type="number"
              min={10}
              max={250}
              value={filters.limit}
              onChange={(event) => updateFilters({ limit: Number.parseInt(event.target.value, 10) || 80 })}
            />
          </label>
          <label>
            Refresh (sec)
            <select
              value={String(filters.refreshSeconds)}
              onChange={(event) => updateFilters({ refreshSeconds: Number.parseInt(event.target.value, 10) || 30 })}
            >
              <option value="15">15</option>
              <option value="30">30</option>
              <option value="60">60</option>
              <option value="120">120</option>
            </select>
          </label>
        </div>
        <div className="filter-actions">
          <button type="button" className="refresh-btn ghost" onClick={clearFilters}>
            Clear Filters
          </button>
          <button type="button" className="refresh-btn ghost" onClick={restoreSavedFilters}>
            Restore Saved
          </button>
          <span className="muted">
            URL-synced filters are shareable and auto-saved locally. Window since:{" "}
            <span className="mono">{clampText(since, 24)}</span>
          </span>
        </div>
      </section>

      {error ? (
        <section className="state-card error" role="alert">
          <AlertTriangle size={16} />
          <span>Dashboard request failed: {String((error as Error).message || error)}</span>
        </section>
      ) : null}

      {loading && !summary ? (
        <section className="state-card">
          <Activity size={16} />
          <span>Loading live telemetry...</span>
        </section>
      ) : null}

      <main className="content-grid">
        <section className="panel kpi-panel">
          <h2>Operational Snapshot</h2>
          <div className="kpi-grid">
            <KpiCard label="Total Runs" value={compactNumber(summary?.totalRuns ?? 0)} icon={<Activity size={16} />} />
            <KpiCard label="Fail Rate" value={`${failRate}%`} icon={<AlertTriangle size={16} />} tone="warn" />
            <KpiCard label="Running" value={compactNumber(summary?.startedRuns ?? 0)} icon={<Layers size={16} />} />
            <KpiCard label="Dead Letters" value={compactNumber(summary?.deadLetters ?? 0)} icon={<Database size={16} />} tone="bad" />
            <KpiCard label="Succeeded" value={compactNumber(summary?.succeededRuns ?? 0)} icon={<ShieldCheck size={16} />} tone="ok" />
            <KpiCard label="Failed" value={compactNumber(summary?.failedRuns ?? 0)} icon={<AlertTriangle size={16} />} tone="bad" />
          </div>
        </section>

        <section className="panel table-panel">
          <div className="panel-head">
            <h2>Connector Secrets</h2>
            <span>{filteredConnectorSecrets.length}/{connectorSecrets.length} connectors</span>
          </div>
          <div className="run-toolbar">
            <label>
              Secret Status
              <select
                value={secretStatusFilter}
                onChange={(event) => setSecretStatusFilter(event.target.value as SecretStatusFilter)}
              >
                <option value="">All</option>
                <option value="ready">Ready</option>
                <option value="partial">Partial</option>
                <option value="missing">Missing</option>
              </select>
            </label>
          </div>
          <ul className="flow-list">
            {filteredConnectorSecrets.map((connector) => (
              <li key={connector.id} className={clsx({ bad: connector.status !== "ready" })}>
                <div className="flow-title">
                  <ShieldCheck size={14} />
                  <span>{connector.id}</span>
                </div>
                <div className="flow-stats">
                  <span>status: {connector.status}</span>
                  <span>required: {connector.requiredSecrets.join(", ") || "-"}</span>
                  <span>missing: {connector.missingSecrets.join(", ") || "none"}</span>
                </div>
              </li>
            ))}
            {filteredConnectorSecrets.length === 0 ? <li className="muted">No connector secret data yet.</li> : null}
          </ul>
        </section>

        <section className="panel table-panel">
          <div className="panel-head">
            <h2>Template Gallery</h2>
            <span>{templates.length} templates</span>
          </div>
          <ul className="flow-list">
            {templates.map((template) => (
              <li key={template.id}>
                <div className="flow-title">
                  <Route size={14} />
                  <span>{template.name}</span>
                </div>
                <div className="flow-stats">
                  <span>category: {template.category}</span>
                  <span>routes: {template.routes.join(", ") || "-"}</span>
                  <span>schedules: {template.schedules.join(", ") || "-"}</span>
                </div>
                <p className="muted">{template.description}</p>
              </li>
            ))}
            {templates.length === 0 ? <li className="muted">No templates returned.</li> : null}
          </ul>
        </section>

        <section className="panel chart-panel">
          <h2>Run Timeline</h2>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={timeline?.buckets ?? []} onClick={onTimelineBucketClick}>
                <CartesianGrid strokeDasharray="2 4" stroke="rgba(139,110,78,0.28)" />
                <XAxis dataKey="bucket" tick={{ fontSize: 12, fill: "#5f4e3a" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "#5f4e3a" }} tickLine={false} axisLine={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="succeeded" stackId="runs" fill="#1f7a37" radius={[4, 4, 0, 0]} />
                <Bar dataKey="failed" stackId="runs" fill="#cc372d" radius={[4, 4, 0, 0]} />
                <Bar dataKey="running" stackId="runs" fill="#a35d00" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="timeline-meta">
            <span>Selected bucket: {effectiveTimelineBucket || "-"}</span>
            <span>{timeline?.buckets.length ?? 0} buckets</span>
          </div>
        </section>

        <section className="panel chart-panel">
          <h2>Top Routes</h2>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={summary?.topRoutes ?? []} layout="vertical" margin={{ left: 16, right: 16 }} onClick={onRouteBarClick}>
                <CartesianGrid strokeDasharray="2 4" stroke="rgba(139,110,78,0.28)" />
                <XAxis type="number" tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="routePath" width={160} tick={{ fontSize: 12, fill: "#5f4e3a" }} />
                <Tooltip />
                <Bar dataKey="count" fill="#9f3416" radius={[4, 4, 4, 4]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="muted">Click a route bar to apply it as a run filter.</p>
        </section>

        <section className="panel table-panel">
          <div className="panel-head">
            <h2>Catalog: HTTP Routes</h2>
            <span>{routeCatalogRows.length} definitions</span>
          </div>
          <p className="muted">Source: route definitions plus activity in the selected time window.</p>
          <table>
            <thead>
              <tr>
                <th>Route</th>
                <th>Type</th>
                <th>Flow</th>
                <th>24h/Window Activity</th>
              </tr>
            </thead>
            <tbody>
              {routeCatalogRows.slice(0, 20).map((route) => (
                <tr key={route.routePath} className="clickable-row" onClick={() => applyRouteFilter(route.routePath)}>
                  <td className="mono">{route.routePath}</td>
                  <td>{route.requestType}</td>
                  <td>{clampText(route.flowPath, 36)}</td>
                  <td>
                    {route.succeeded}/{route.failed}/{route.started} ({route.total})
                    {route.total === 0 ? <span className="catalog-tag">defined, no activity</span> : null}
                  </td>
                </tr>
              ))}
              {routeCatalogRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="muted">No routes defined in runtime manifest.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>

        <section className="panel table-panel">
          <div className="panel-head">
            <h2>Catalog: Cron Schedules</h2>
            <span>{scheduleCatalogRows.length} definitions</span>
          </div>
          <p className="muted">Source: schedule definitions plus activity in the selected time window.</p>
          <table>
            <thead>
              <tr>
                <th>Schedule</th>
                <th>Cron</th>
                <th>Target</th>
                <th>Enabled</th>
                <th>24h/Window Activity</th>
              </tr>
            </thead>
            <tbody>
              {scheduleCatalogRows.slice(0, 20).map((schedule) => (
                <tr key={schedule.id} className="clickable-row" onClick={() => applyScheduleFilter(schedule.id)}>
                  <td className="mono">{schedule.id}</td>
                  <td>{schedule.cron}</td>
                  <td>{clampText(schedule.target, 30)}</td>
                  <td>{schedule.enabled ? "yes" : "no"}</td>
                  <td>
                    {schedule.succeeded}/{schedule.failed}/{schedule.started} ({schedule.total})
                    {schedule.total === 0 ? <span className="catalog-tag">defined, no activity</span> : null}
                  </td>
                </tr>
              ))}
              {scheduleCatalogRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="muted">No schedules defined in runtime manifest.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>

        <section className="panel table-panel">
          <div className="panel-head">
            <h2>Timeline Bucket Detail</h2>
            <span>{timelineDetailQuery.isLoading ? "Loading..." : effectiveTimelineBucket || "No bucket selected"}</span>
          </div>
          {timelineDetail ? (
            <div className="detail-stack">
              <div className="detail-kpis">
                <span>total: {timelineDetail.statusCounts.total}</span>
                <span>succeeded: {timelineDetail.statusCounts.succeeded}</span>
                <span>failed: {timelineDetail.statusCounts.failed}</span>
                <span>running: {timelineDetail.statusCounts.running}</span>
              </div>
              <ul className="cluster-list compact">
                {timelineDetail.runs.slice(0, 6).map((run) => (
                  <li key={run.traceId}>
                    <div>
                      <strong className="mono">{clampText(run.traceId, 18)}</strong>
                      <p>{run.routePath ?? run.scheduleId ?? "-"}</p>
                    </div>
                    <div className="cluster-meta">
                      <span>{run.status}</span>
                      <small>{fmtTs(run.startedAt)}</small>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="muted">Click a timeline bar to inspect this bucket.</p>
          )}
        </section>

        <section className="panel table-panel wide">
          <div className="panel-head">
            <h2>Runs Explorer</h2>
            <span>
              {filteredRuns.length} matches • page {safeRunsPage}/{totalRunPages}
            </span>
          </div>
          <div className="run-toolbar">
            <label>
              Sort
              <select value={runsSortKey} onChange={(event) => setRunsSortKey(event.target.value as RunsSortKey)}>
                <option value="startedAt">Started</option>
                <option value="status">Status</option>
                <option value="scope">Scope</option>
              </select>
            </label>
            <label>
              Direction
              <select value={runsSortDir} onChange={(event) => setRunsSortDir(event.target.value as RunsSortDir)}>
                <option value="desc">Desc</option>
                <option value="asc">Asc</option>
              </select>
            </label>
            <button type="button" className="refresh-btn ghost" onClick={() => setRunsPage((page) => Math.max(1, page - 1))}>
              Prev
            </button>
            <button
              type="button"
              className="refresh-btn ghost"
              onClick={() => setRunsPage((page) => Math.min(totalRunPages, page + 1))}
            >
              Next
            </button>
          </div>
          <table>
            <thead>
              <tr>
                <th>Trace</th>
                <th>Workspace</th>
                <th>Scope</th>
                <th>Status</th>
                <th>Kind</th>
                <th>Started</th>
                <th>Duration</th>
                <th>Compare</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRuns.map((run) => (
                <tr
                  key={run.traceId}
                  className={clsx("clickable-row", { selected: selectedTraceId === run.traceId })}
                  onClick={() => setSelectedTraceId(run.traceId)}
                >
                  <td className="mono">{clampText(run.traceId, 14)}</td>
                  <td>{run.workspaceId ?? "-"}</td>
                  <td>{run.routePath ?? run.scheduleId ?? "-"}</td>
                  <td>
                    <span className={clsx("pill", `pill-${String(run.status).toLowerCase()}`)}>{run.status}</span>
                  </td>
                  <td>{run.kind}</td>
                  <td>{fmtTs(run.startedAt)}</td>
                  <td>{run.duration ?? "-"}</td>
                  <td>
                    <div className="compare-actions">
                      <button
                        type="button"
                        className="compare-slot-btn"
                        onClick={(event) => {
                          event.stopPropagation();
                          assignRunToComparison("A", run.traceId);
                        }}
                        aria-label={`Set comparison A ${run.traceId}`}
                      >
                        Set A
                      </button>
                      <button
                        type="button"
                        className="compare-slot-btn"
                        onClick={(event) => {
                          event.stopPropagation();
                          assignRunToComparison("B", run.traceId);
                        }}
                        aria-label={`Set comparison B ${run.traceId}`}
                      >
                        Set B
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {paginatedRuns.length === 0 ? (
                <tr>
                  <td colSpan={8} className="muted">
                    No matching runs.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>

        <section className="panel table-panel">
          <div className="panel-head">
            <h2>Run Detail</h2>
            <span>{selectedTraceId ? clampText(selectedTraceId, 18) : "Select a run"}</span>
          </div>
          <div className="run-toolbar">
            <button
              type="button"
              className="refresh-btn ghost"
              onClick={() => void replaySelectedRun()}
              disabled={!selectedTraceId || runDetailQuery.data?.run.status !== "failed"}
            >
              Replay Failed Run
            </button>
          </div>
          {runDetailQuery.data ? (
            <div className="detail-stack">
              <div className="detail-kpis">
                <span>status: {runDetailQuery.data.run.status}</span>
                <span>workspace: {runDetailQuery.data.run.workspaceId ?? "-"}</span>
                <span>scope: {runDetailQuery.data.run.routePath ?? runDetailQuery.data.run.scheduleId ?? "-"}</span>
                <span>duration: {runDetailQuery.data.run.duration ?? "-"}</span>
              </div>
              {runDetailQuery.data.run.error ? <p className="muted">error: {clampText(runDetailQuery.data.run.error, 240)}</p> : null}
              {runDetailQuery.data.deadLetter ? (
                <p className="muted">
                  dead letter #{runDetailQuery.data.deadLetter.id} at {fmtTs(runDetailQuery.data.deadLetter.createdAt)}
                </p>
              ) : (
                <p className="muted">No dead letter linked.</p>
              )}
              <p className="muted">retry attempts: {runDetailQuery.data.retries.attempts.length}</p>
            </div>
          ) : (
            <p className="muted">Click a run row to inspect payload/error lineage.</p>
          )}
        </section>

        <section className="panel table-panel wide">
          <div className="panel-head">
            <h2>Run Comparison</h2>
            <span>
              {compareTraceA ? clampText(compareTraceA, 12) : "A unset"} vs {compareTraceB ? clampText(compareTraceB, 12) : "B unset"}
            </span>
          </div>
          <p className="muted">
            Compare status, latency, normalized error cluster, and payload shape. Use <strong>Set A</strong>/<strong>Set B</strong> in Runs
            Explorer.
          </p>
          <div className="compare-grid">
            <article className="compare-card">
              <h3>Slot A</h3>
              <p className="mono">{compareTraceA || "No run selected"}</p>
              <p className="muted">{compareRunAQuery.isLoading ? "Loading..." : compareStats.left?.status ?? "-"}</p>
            </article>
            <article className="compare-card">
              <h3>Slot B</h3>
              <p className="mono">{compareTraceB || "No run selected"}</p>
              <p className="muted">{compareRunBQuery.isLoading ? "Loading..." : compareStats.right?.status ?? "-"}</p>
            </article>
          </div>
          <table className="compare-table">
            <thead>
              <tr>
                <th>Metric</th>
                <th>Run A</th>
                <th>Run B</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Status</td>
                <td>{compareStats.left?.status ?? "-"}</td>
                <td>{compareStats.right?.status ?? "-"}</td>
              </tr>
              <tr>
                <td>Latency (ms)</td>
                <td>{compareStats.left?.latencyMs ?? "-"}</td>
                <td>{compareStats.right?.latencyMs ?? "-"}</td>
              </tr>
              <tr>
                <td>Error Cluster</td>
                <td>{compareStats.left?.errorCluster ?? "-"}</td>
                <td>{compareStats.right?.errorCluster ?? "-"}</td>
              </tr>
              <tr>
                <td>Payload Shape</td>
                <td>{compareStats.left?.payloadShape ?? "-"}</td>
                <td>{compareStats.right?.payloadShape ?? "-"}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="panel table-panel">
          <div className="panel-head">
            <h2>Error Clusters</h2>
            <span>{clusters.length} clusters</span>
          </div>
          <ul className="cluster-list">
            {clusters.slice(0, 10).map((cluster) => (
              <li key={cluster.key}>
                <div>
                  <strong>{cluster.scope}</strong>
                  <p>{clampText(cluster.sample, 110)}</p>
                </div>
                <div className="cluster-meta">
                  <span>{cluster.count}x</span>
                  <small>{fmtTs(cluster.latestAt)}</small>
                </div>
              </li>
            ))}
            {clusters.length === 0 ? <li className="muted">No failures in current window.</li> : null}
          </ul>
        </section>

        <section className="panel table-panel">
          <div className="panel-head">
            <h2>Dead Letters</h2>
            <span>{deadLetters.length}</span>
          </div>
          <ul className="cluster-list">
            {deadLetters.slice(0, 10).map((item) => (
              <li key={String(item.id)}>
                <div>
                  <strong className="mono">{clampText(item.traceId, 18)}</strong>
                  <p>{clampText(item.error, 90)}</p>
                </div>
                <div className="cluster-meta">
                  <span>#{item.id}</span>
                  <small>{fmtTs(item.createdAt)}</small>
                </div>
              </li>
            ))}
            {deadLetters.length === 0 ? <li className="muted">No dead letters in queue.</li> : null}
          </ul>
        </section>

        <section className="panel table-panel">
          <div className="panel-head">
            <h2>Audit Events</h2>
            <span>{auditEvents.length} events</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Workspace</th>
                <th>Action</th>
                <th>Resource</th>
                <th>Actor</th>
              </tr>
            </thead>
            <tbody>
              {auditEvents.slice(0, 20).map((event) => (
                <tr key={String(event.id)}>
                  <td>{fmtTs(event.createdAt)}</td>
                  <td>{event.workspaceId}</td>
                  <td>{event.action}</td>
                  <td>{event.resourceType}:{event.resourceId ?? "-"}</td>
                  <td>{clampText(event.actor, 36)}</td>
                </tr>
              ))}
              {auditEvents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="muted">No audit events recorded.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>

        <section className="panel table-panel wide">
          <div className="panel-head">
            <h2>Flow Reliability Board</h2>
            <span>{flowLeaders.length} ranked</span>
          </div>
          <ul className="flow-list">
            {flowLeaders.map((flow) => {
              const bad = flow.failed > 0;
              return (
                <li key={flow.flowPath} className={clsx({ bad })}>
                  <div className="flow-title">
                    <Route size={14} />
                    <span>{flow.flowPath}</span>
                  </div>
                  <div className="flow-stats">
                    <span>{flow.total} runs</span>
                    <span>{flow.failed} failed</span>
                    <span>{flow.routes} routes</span>
                    <span>{flow.schedules} schedules</span>
                  </div>
                </li>
              );
            })}
            {flowLeaders.length === 0 ? <li className="muted">No catalog activity in this window.</li> : null}
          </ul>
        </section>
      </main>
    </div>
  );
}

type KpiCardProps = {
  label: string;
  value: string;
  icon: ReactNode;
  tone?: "ok" | "warn" | "bad";
};

function KpiCard({ label, value, icon, tone }: KpiCardProps) {
  return (
    <article className={clsx("kpi-card", tone ? `tone-${tone}` : undefined)}>
      <div className="kpi-icon">{icon}</div>
      <div>
        <p>{label}</p>
        <h3>{value}</h3>
      </div>
    </article>
  );
}

export default App;
