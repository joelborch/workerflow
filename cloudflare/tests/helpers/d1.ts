import type { QueueTask } from "../../shared/types";

export type MockRunRecord = {
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

export type MockDeadLetterRecord = {
  id: number;
  traceId: string;
  workspaceId: string;
  payloadJson: string;
  error: string;
  createdAt: string;
};

export type MockReplayLineageEntry = {
  parentTraceId: string;
  childTraceId: string;
  retryCount: number;
};

export type MockOAuthTokenRecord = {
  provider: string;
  accountId: string;
  workspaceId: string;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string | null;
  scopesJson: string;
  updatedAt: string;
  createdAt: string;
};

export type CreateMockD1Options = {
  runs?: MockRunRecord[];
  deadLetters?: MockDeadLetterRecord[];
};

function readBoundWorkspace(sql: string, bound: unknown[]) {
  const match = sql.match(/workspace_id\s*=\s*\?(\d+)/);
  if (!match) {
    return "";
  }
  const index = Number(match[1]) - 1;
  return String(bound[index] ?? "");
}

export function createMockD1(options: CreateMockD1Options = {}) {
  const idempotency = new Set<string>();
  const runs = new Map<string, MockRunRecord>((options.runs ?? []).map((row) => [row.traceId, { ...row }]));
  const deadLetters: MockDeadLetterRecord[] = (options.deadLetters ?? []).map((row) => ({ ...row }));
  const lineage: MockReplayLineageEntry[] = [];
  const oauthTokens = new Map<string, MockOAuthTokenRecord>();
  let nextDeadLetterId = deadLetters.reduce((max, item) => Math.max(max, item.id), 0) + 1;

  const db = {
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
            return idempotency.has(traceId) ? ({ trace_id: traceId } as T) : null;
          }
          if (sql.includes("FROM runs") && sql.includes("WHERE trace_id = ?1")) {
            const run = runs.get(String(bound[0] ?? ""));
            return run ? ({ ...run } as T) : null;
          }
          if (sql.includes("FROM dead_letters") && sql.includes("WHERE trace_id = ?1")) {
            const traceId = String(bound[0] ?? "");
            const hasErrorFilter = sql.includes("AND error =");
            const errorFilter = hasErrorFilter ? String(bound[1] ?? "") : "";
            const match = [...deadLetters]
              .reverse()
              .find((item) => item.traceId === traceId && (!hasErrorFilter || item.error === errorFilter));
            if (!match) {
              return null;
            }
            return (hasErrorFilter
              ? { id: match.id }
              : {
                  id: match.id,
                  workspaceId: match.workspaceId,
                  payloadJson: match.payloadJson,
                  createdAt: match.createdAt
                }) as T;
          }
          if (sql.includes("MAX(retry_count)")) {
            const parent = String(bound[0] ?? "");
            const max = lineage
              .filter((item) => item.parentTraceId === parent)
              .reduce((acc, item) => Math.max(acc, item.retryCount), 0);
            return ({ retryCount: max } as T);
          }
          if (sql.includes("FROM oauth_tokens")) {
            const key = `${String(bound[0])}:${String(bound[1])}:${String(bound[2])}`;
            const row = oauthTokens.get(key);
            return row ? ({ ...row } as T) : null;
          }
          return null;
        },
        async run() {
          if (sql.includes("INSERT OR IGNORE INTO idempotency_keys")) {
            idempotency.add(String(bound[0] ?? ""));
          } else if (sql.includes("INSERT INTO runs")) {
            const traceId = String(bound[0] ?? "");
            runs.set(traceId, {
              traceId,
              workspaceId: String(bound[1] ?? "default"),
              kind: String(bound[2] ?? ""),
              routePath: (bound[3] as string | null) ?? null,
              scheduleId: (bound[4] as string | null) ?? null,
              status: "started",
              startedAt: String(bound[5] ?? new Date().toISOString()),
              finishedAt: null,
              output: null,
              error: null
            });
          } else if (sql.includes("UPDATE runs") && sql.includes("status = 'succeeded'")) {
            const run = runs.get(String(bound[0] ?? ""));
            if (run) {
              run.status = "succeeded";
              run.finishedAt = String(bound[1] ?? "");
              run.output = (bound[2] as string | null) ?? null;
            }
          } else if (sql.includes("UPDATE runs") && sql.includes("status = 'failed'")) {
            const run = runs.get(String(bound[0] ?? ""));
            if (run) {
              run.status = "failed";
              run.finishedAt = String(bound[1] ?? "");
              run.error = String(bound[2] ?? "");
            }
          } else if (sql.includes("INSERT INTO dead_letters")) {
            deadLetters.push({
              id: nextDeadLetterId++,
              traceId: String(bound[0] ?? ""),
              workspaceId: String(bound[1] ?? "default"),
              payloadJson: String(bound[2] ?? "{}"),
              error: String(bound[3] ?? ""),
              createdAt: String(bound[4] ?? new Date().toISOString())
            });
          } else if (sql.includes("INSERT INTO replay_lineage")) {
            lineage.push({
              parentTraceId: String(bound[0] ?? ""),
              childTraceId: String(bound[1] ?? ""),
              retryCount: Number(bound[3] ?? 0)
            });
          } else if (sql.includes("INSERT INTO oauth_tokens")) {
            const key = `${String(bound[0])}:${String(bound[1])}:${String(bound[2])}`;
            const existing = oauthTokens.get(key);
            oauthTokens.set(key, {
              provider: String(bound[0]),
              accountId: String(bound[1]),
              workspaceId: String(bound[2]),
              accessToken: String(bound[3]),
              refreshToken: bound[4] ? String(bound[4]) : null,
              expiresAt: bound[5] ? String(bound[5]) : null,
              scopesJson: String(bound[6] ?? "[]"),
              updatedAt: String(bound[7]),
              createdAt: existing?.createdAt ?? String(bound[8])
            });
          }
          return { success: true };
        },
        async all<T>() {
          if (sql.includes("FROM runs")) {
            const workspace = readBoundWorkspace(sql, bound);
            const allRuns = [...runs.values()];
            const selected = workspace ? allRuns.filter((row) => row.workspaceId === workspace) : allRuns;
            return { results: selected.map((row) => ({ ...row })) as T[] };
          }
          if (sql.includes("FROM dead_letters")) {
            const workspace = readBoundWorkspace(sql, bound);
            const selected = workspace ? deadLetters.filter((row) => row.workspaceId === workspace) : deadLetters;
            return { results: selected.map((row) => ({ ...row })) as T[] };
          }
          if (sql.includes("FROM oauth_tokens")) {
            const workspace = sql.includes("WHERE workspace_id = ?1") ? String(bound[0] ?? "") : "";
            const allTokens = [...oauthTokens.values()];
            const selected = workspace ? allTokens.filter((row) => row.workspaceId === workspace) : allTokens;
            return { results: selected.map((row) => ({ ...row })) as T[] };
          }
          return { results: [] as T[] };
        }
      };
    }
  } as unknown as D1Database;

  return { db, runs, deadLetters, lineage, oauthTokens, idempotency };
}

export function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

export function createQueueMock() {
  const tasks: QueueTask[] = [];
  const queue = {
    async send(task: QueueTask) {
      tasks.push(task);
    }
  } as unknown as Queue<QueueTask>;
  return { queue, tasks };
}
