import assert from "node:assert/strict";

import {
  listOAuthTokens,
  oauthTokenNeedsRefresh,
  readOAuthToken,
  redactToken,
  upsertOAuthToken
} from "../shared/oauth_tokens";
import { resolveConnectorOAuthToken } from "../workers/workflow/src/connectors/oauth";

type TokenRecord = {
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

function buildMockDb() {
  const rows = new Map<string, TokenRecord>();

  return {
    prepare(sql: string) {
      let bound: unknown[] = [];
      return {
        bind(...args: unknown[]) {
          bound = args;
          return this;
        },
        async run() {
          if (sql.includes("INSERT INTO oauth_tokens")) {
            const key = `${String(bound[0])}:${String(bound[1])}:${String(bound[2])}`;
            const existing = rows.get(key);
            const createdAt = existing?.createdAt ?? String(bound[8]);
            rows.set(key, {
              provider: String(bound[0]),
              accountId: String(bound[1]),
              workspaceId: String(bound[2]),
              accessToken: String(bound[3]),
              refreshToken: bound[4] ? String(bound[4]) : null,
              expiresAt: bound[5] ? String(bound[5]) : null,
              scopesJson: String(bound[6] ?? "[]"),
              updatedAt: String(bound[7]),
              createdAt
            });
          }
          return { success: true };
        },
        async first<T>() {
          if (sql.includes("FROM oauth_tokens")) {
            const key = `${String(bound[0])}:${String(bound[1])}:${String(bound[2])}`;
            const row = rows.get(key);
            if (!row) {
              return null;
            }
            return {
              provider: row.provider,
              accountId: row.accountId,
              workspaceId: row.workspaceId,
              accessToken: row.accessToken,
              refreshToken: row.refreshToken,
              expiresAt: row.expiresAt,
              scopesJson: row.scopesJson,
              updatedAt: row.updatedAt,
              createdAt: row.createdAt
            } as T;
          }
          return null;
        },
        async all<T>() {
          if (sql.includes("FROM oauth_tokens")) {
            if (sql.includes("WHERE workspace_id = ?1")) {
              const workspace = String(bound[0]);
              return {
                results: [...rows.values()]
                  .filter((item) => item.workspaceId === workspace)
                  .map((item) => ({
                    provider: item.provider,
                    accountId: item.accountId,
                    workspaceId: item.workspaceId,
                    accessToken: item.accessToken,
                    refreshToken: item.refreshToken,
                    expiresAt: item.expiresAt,
                    scopesJson: item.scopesJson,
                    updatedAt: item.updatedAt,
                    createdAt: item.createdAt
                  })) as T[]
              };
            }
            return {
              results: [...rows.values()].map((item) => ({
                provider: item.provider,
                accountId: item.accountId,
                workspaceId: item.workspaceId,
                accessToken: item.accessToken,
                refreshToken: item.refreshToken,
                expiresAt: item.expiresAt,
                scopesJson: item.scopesJson,
                updatedAt: item.updatedAt,
                createdAt: item.createdAt
              })) as T[]
            };
          }
          return { results: [] as T[] };
        }
      };
    }
  } as unknown as D1Database;
}

async function run() {
  const db = buildMockDb();

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
    } as any,
    {
      provider: "hubspot",
      accountId: "acct-1",
      workspaceId: "dentalops"
    }
  );
  assert.ok(resolved);
  assert.equal(resolved?.needsRefresh, true);

  console.log("oauth token tests passed");
}

run().catch((error) => {
  console.error("oauth token tests failed", error);
  process.exitCode = 1;
});
