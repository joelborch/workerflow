import { performance } from "node:perf_hooks";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import type { Env, QueueTask } from "../shared/types";
import apiWorker from "../workers/api/src/index";

type Scenario = {
  routePath: string;
  body: Record<string, unknown>;
};

type ScenarioResult = {
  routePath: string;
  requests: number;
  successes: number;
  failures: number;
  errorRatePct: number;
  meanMs: number;
  p50Ms: number;
  p95Ms: number;
  throughputRps: number;
};

type BenchmarkArgs = {
  iterations: number;
  runsPerDay: number;
  freeRequestsPerDay: number;
  outputPath: string;
};

const SCENARIOS: Scenario[] = [
  {
    routePath: "webhook_echo",
    body: { source: "benchmark", payload: { test: true } }
  },
  {
    routePath: "chat_notify",
    body: { text: "benchmark notification" }
  },
  {
    routePath: "lead_normalizer",
    body: {
      firstName: "Taylor",
      lastName: "Bench",
      email: "taylor.bench@example.com",
      phone: "555-222-1111",
      source: "benchmark"
    }
  },
  {
    routePath: "openai_chat",
    body: {
      prompt: "Reply with benchmark acknowledged."
    }
  }
];

function percentile(values: number[], target: number) {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((target / 100) * sorted.length) - 1));
  return sorted[index] ?? 0;
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }
  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

function buildMockDb() {
  const idempotency = new Set<string>();

  return {
    prepare(sql: string) {
      let bound: unknown[] = [];

      return {
        bind(...args: unknown[]) {
          bound = args;
          return this;
        },
        async first<T>() {
          if (sql.includes("FROM idempotency_keys")) {
            const traceId = String(bound[0] ?? "");
            if (idempotency.has(traceId)) {
              return { trace_id: traceId } as T;
            }
            return null;
          }
          return null;
        },
        async run() {
          if (sql.includes("INSERT OR IGNORE INTO idempotency_keys")) {
            const traceId = String(bound[0] ?? "");
            idempotency.add(traceId);
          }
          return { success: true };
        }
      };
    }
  } as unknown as D1Database;
}

function createBenchmarkEnv() {
  const queuedTasks: QueueTask[] = [];
  const syncTasks: QueueTask[] = [];

  const env: Env = {
    DB: buildMockDb(),
    AUTOMATION_QUEUE: {
      async send(task: QueueTask) {
        queuedTasks.push(task);
      }
    } as unknown as Queue<QueueTask>,
    WORKFLOW_SERVICE: {
      async fetch(_url: string | URL | Request, init?: RequestInit) {
        const raw = String(init?.body ?? "{}");
        const task = JSON.parse(raw) as QueueTask;
        syncTasks.push(task);
        return jsonResponse({
          ok: true,
          traceId: task.traceId,
          routePath: task.routePath,
          output: { acknowledged: true }
        });
      }
    } as unknown as Fetcher,
    ENV_NAME: "benchmark"
  };

  return { env, queuedTasks, syncTasks };
}

function parseArgs(argv: string[]): BenchmarkArgs {
  const args: BenchmarkArgs = {
    iterations: 200,
    runsPerDay: 50_000,
    freeRequestsPerDay: 100_000,
    outputPath: resolve(process.cwd(), "../docs/BENCHMARK_COST_PROFILE.md")
  };

  for (const raw of argv) {
    const [key, value] = raw.split("=");
    if (!key || value === undefined) {
      continue;
    }
    if (key === "--iterations") {
      const parsed = Number.parseInt(value, 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        args.iterations = parsed;
      }
    } else if (key === "--runs-per-day") {
      const parsed = Number.parseInt(value, 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        args.runsPerDay = parsed;
      }
    } else if (key === "--free-requests-per-day") {
      const parsed = Number.parseInt(value, 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        args.freeRequestsPerDay = parsed;
      }
    } else if (key === "--out") {
      args.outputPath = resolve(process.cwd(), value);
    }
  }

  return args;
}

function toFixed(value: number) {
  return value.toFixed(2);
}

async function runScenario(env: Env, scenario: Scenario, iterations: number) {
  const durationsMs: number[] = [];
  let successCount = 0;
  let failureCount = 0;
  const started = performance.now();

  for (let index = 0; index < iterations; index += 1) {
    const request = new Request(`https://benchmark.example.com/api/${scenario.routePath}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-trace-id": `bench-${scenario.routePath}-${index}`,
        origin: "https://benchmark.example.com"
      },
      body: JSON.stringify(scenario.body)
    });

    const t0 = performance.now();
    const response = await apiWorker.fetch(request, env);
    const elapsed = performance.now() - t0;
    durationsMs.push(elapsed);

    if (response.status < 400) {
      successCount += 1;
    } else {
      failureCount += 1;
    }
  }

  const totalElapsedMs = performance.now() - started;
  const requests = successCount + failureCount;
  const errorRatePct = requests > 0 ? (failureCount / requests) * 100 : 0;

  const result: ScenarioResult = {
    routePath: scenario.routePath,
    requests,
    successes: successCount,
    failures: failureCount,
    errorRatePct,
    meanMs: average(durationsMs),
    p50Ms: percentile(durationsMs, 50),
    p95Ms: percentile(durationsMs, 95),
    throughputRps: totalElapsedMs > 0 ? (requests / totalElapsedMs) * 1000 : 0
  };

  return result;
}

function renderReport(args: BenchmarkArgs, scenarioResults: ScenarioResult[]) {
  const generatedAt = new Date().toISOString();
  const totalRequests = scenarioResults.reduce((sum, item) => sum + item.requests, 0);
  const totalFailures = scenarioResults.reduce((sum, item) => sum + item.failures, 0);
  const weightedErrorRate = totalRequests > 0 ? (totalFailures / totalRequests) * 100 : 0;
  const monthlyRuns = args.runsPerDay * 30;
  const freeTierUtilization = args.freeRequestsPerDay > 0 ? (args.runsPerDay / args.freeRequestsPerDay) * 100 : 0;
  const overageRunsPerDay = Math.max(0, args.runsPerDay - args.freeRequestsPerDay);

  const scenarioRows = scenarioResults
    .map(
      (item) =>
        `| \`${item.routePath}\` | ${item.requests} | ${item.successes} | ${item.failures} | ${toFixed(item.errorRatePct)}% | ${toFixed(item.meanMs)} | ${toFixed(item.p50Ms)} | ${toFixed(item.p95Ms)} | ${toFixed(item.throughputRps)} |`
    )
    .join("\n");

  return `# WorkerFlow Benchmark And Cost Profile

Generated: \`${generatedAt}\`

## Benchmark Configuration

- iterations per scenario: **${args.iterations}**
- scenarios: ${scenarioResults.map((item) => `\`${item.routePath}\``).join(", ")}
- total requests: **${totalRequests}**
- weighted error rate: **${toFixed(weightedErrorRate)}%**

## Route Latency And Throughput

| Route | Requests | Successes | Failures | Error Rate | Mean (ms) | P50 (ms) | P95 (ms) | Throughput (req/s) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${scenarioRows}

## Run Volume Assumptions

| Assumption | Value |
| --- | ---: |
| Runs per day | ${args.runsPerDay} |
| Runs per month (30d) | ${monthlyRuns} |
| Free request allowance/day (assumed) | ${args.freeRequestsPerDay} |
| Free-tier utilization/day | ${toFixed(freeTierUtilization)}% |
| Estimated overage requests/day | ${overageRunsPerDay} |

## Interpretation Guidance

1. Treat latency numbers as comparative baselines, not production SLA guarantees.
2. A non-zero error rate in this synthetic benchmark indicates regressions worth investigating before deploy.
3. If free-tier utilization is consistently above 100%, run this benchmark with production-like payload sizes and model paid-plan overage.
4. Re-generate this report after runtime, connector, or rate-limit changes.
`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { env } = createBenchmarkEnv();
  const originalLog = console.log;

  const results: ScenarioResult[] = [];
  try {
    // Silence runtime structured logs while collecting benchmark metrics.
    console.log = () => {};
    for (const scenario of SCENARIOS) {
      const result = await runScenario(env, scenario, args.iterations);
      results.push(result);
    }
  } finally {
    console.log = originalLog;
  }

  const markdown = renderReport(args, results);
  mkdirSync(dirname(args.outputPath), { recursive: true });
  writeFileSync(args.outputPath, markdown, "utf8");
  originalLog(`benchmark report written: ${args.outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
