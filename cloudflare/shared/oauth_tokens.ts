import { resolveWorkspaceId } from "./workspace";

export type OAuthTokenRecord = {
  provider: string;
  accountId: string;
  workspaceId: string;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string | null;
  scopes: string[];
  updatedAt: string;
  createdAt: string;
};

type OAuthTokenRow = {
  provider: string;
  accountId: string;
  workspaceId: string;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string | null;
  scopesJson: string | null;
  updatedAt: string;
  createdAt: string;
};

function parseScopes(raw: string | null) {
  if (!raw) {
    return [] as string[];
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [] as string[];
    }
    return parsed.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function normalizeProvider(value: string) {
  return value.trim().toLowerCase();
}

function normalizeAccountId(value: string) {
  return value.trim();
}

export function oauthTokenNeedsRefresh(expiresAt: string | null, nowMs = Date.now(), thresholdSeconds = 300) {
  if (!expiresAt) {
    return false;
  }
  const expiryMs = Date.parse(expiresAt);
  if (!Number.isFinite(expiryMs)) {
    return false;
  }
  return expiryMs - nowMs <= thresholdSeconds * 1000;
}

export function redactToken(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length <= 8) {
    return `${trimmed.slice(0, 1)}***${trimmed.slice(-1)}`;
  }
  return `${trimmed.slice(0, 4)}***${trimmed.slice(-4)}`;
}

export async function upsertOAuthToken(
  db: D1Database,
  input: {
    provider: string;
    accountId: string;
    workspaceId?: string;
    accessToken: string;
    refreshToken?: string | null;
    expiresAt?: string | null;
    scopes?: string[];
  }
) {
  const provider = normalizeProvider(input.provider);
  const accountId = normalizeAccountId(input.accountId);
  const workspaceId = resolveWorkspaceId(input.workspaceId);
  const accessToken = input.accessToken.trim();
  const refreshToken = input.refreshToken?.trim() || null;
  const expiresAt = input.expiresAt?.trim() || null;
  const scopes = (input.scopes ?? []).map((scope) => scope.trim()).filter(Boolean);
  const now = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO oauth_tokens (
         provider,
         account_id,
         workspace_id,
         access_token,
         refresh_token,
         expires_at,
         scopes_json,
         updated_at,
         created_at
       ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
       ON CONFLICT(provider, account_id, workspace_id) DO UPDATE SET
         access_token = excluded.access_token,
         refresh_token = excluded.refresh_token,
         expires_at = excluded.expires_at,
         scopes_json = excluded.scopes_json,
         updated_at = excluded.updated_at`
    )
    .bind(provider, accountId, workspaceId, accessToken, refreshToken, expiresAt, JSON.stringify(scopes), now, now)
    .run();

  return {
    provider,
    accountId,
    workspaceId,
    accessToken,
    refreshToken,
    expiresAt,
    scopes
  };
}

export async function readOAuthToken(
  db: D1Database,
  input: { provider: string; accountId: string; workspaceId?: string }
) {
  const provider = normalizeProvider(input.provider);
  const accountId = normalizeAccountId(input.accountId);
  const workspaceId = resolveWorkspaceId(input.workspaceId);

  const row = await db
    .prepare(
      `SELECT
         provider,
         account_id AS accountId,
         workspace_id AS workspaceId,
         access_token AS accessToken,
         refresh_token AS refreshToken,
         expires_at AS expiresAt,
         scopes_json AS scopesJson,
         updated_at AS updatedAt,
         created_at AS createdAt
       FROM oauth_tokens
       WHERE provider = ?1
         AND account_id = ?2
         AND workspace_id = ?3
       LIMIT 1`
    )
    .bind(provider, accountId, workspaceId)
    .first<OAuthTokenRow>();

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
    scopes: parseScopes(row.scopesJson),
    updatedAt: row.updatedAt,
    createdAt: row.createdAt
  } as OAuthTokenRecord;
}

export async function listOAuthTokens(db: D1Database, workspaceId?: string) {
  const normalizedWorkspace = workspaceId ? resolveWorkspaceId(workspaceId) : null;
  const query =
    normalizedWorkspace === null
      ? `SELECT
           provider,
           account_id AS accountId,
           workspace_id AS workspaceId,
           access_token AS accessToken,
           refresh_token AS refreshToken,
           expires_at AS expiresAt,
           scopes_json AS scopesJson,
           updated_at AS updatedAt,
           created_at AS createdAt
         FROM oauth_tokens
         ORDER BY updated_at DESC`
      : `SELECT
           provider,
           account_id AS accountId,
           workspace_id AS workspaceId,
           access_token AS accessToken,
           refresh_token AS refreshToken,
           expires_at AS expiresAt,
           scopes_json AS scopesJson,
           updated_at AS updatedAt,
           created_at AS createdAt
         FROM oauth_tokens
         WHERE workspace_id = ?1
         ORDER BY updated_at DESC`;

  const rows =
    normalizedWorkspace === null
      ? await db.prepare(query).all<OAuthTokenRow>()
      : await db.prepare(query).bind(normalizedWorkspace).all<OAuthTokenRow>();

  return rows.results.map((row) => ({
    provider: row.provider,
    accountId: row.accountId,
    workspaceId: row.workspaceId,
    accessToken: row.accessToken,
    refreshToken: row.refreshToken,
    expiresAt: row.expiresAt,
    scopes: parseScopes(row.scopesJson),
    updatedAt: row.updatedAt,
    createdAt: row.createdAt
  }));
}
