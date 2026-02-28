import type { Env } from "../../../../shared/types";
import { oauthTokenNeedsRefresh, readOAuthToken } from "../../../../shared/oauth_tokens";

export async function resolveConnectorOAuthToken(
  env: Env,
  input: {
    provider: string;
    accountId: string;
    workspaceId?: string;
  }
) {
  const record = await readOAuthToken(env.DB, input);
  if (!record) {
    return null;
  }

  return {
    provider: record.provider,
    accountId: record.accountId,
    workspaceId: record.workspaceId,
    accessToken: record.accessToken,
    refreshToken: record.refreshToken,
    expiresAt: record.expiresAt,
    needsRefresh: oauthTokenNeedsRefresh(record.expiresAt)
  };
}
