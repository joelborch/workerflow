import type { Env } from "../../../../../shared/types";
import { createNotionDatabaseItem } from "../../connectors/notion";
import { readEnvString, requireContextEnv, type EnvContext } from "../../lib/env";
import { asObject, unwrapObjectBody } from "../../lib/payload";

type NotionDatabaseItemCreateResult = {
  ok: true;
  route: "notion_database_item_create";
  pageId: string;
  url: string;
  archived: boolean;
  createdTime: string;
};

export async function handle(
  requestPayload: unknown,
  _traceId: string,
  context?: EnvContext<Env>
): Promise<NotionDatabaseItemCreateResult> {
  const env = requireContextEnv(context);
  const body = unwrapObjectBody(requestPayload);
  const token = readEnvString(env, ["NOTION_TOKEN"]);
  if (!token) {
    throw new Error("NOTION_TOKEN is required");
  }

  const databaseId = typeof body.databaseId === "string" ? body.databaseId.trim() : "";
  if (!databaseId) {
    throw new Error("notion_database_item_create requires body.databaseId");
  }

  const properties = asObject(body.properties);
  if (Object.keys(properties).length === 0) {
    throw new Error("notion_database_item_create requires body.properties object");
  }

  const children = Array.isArray(body.children) ? body.children : undefined;
  const page = await createNotionDatabaseItem({
    token,
    databaseId,
    properties,
    children
  });

  return {
    ok: true,
    route: "notion_database_item_create",
    pageId: page.id,
    url: page.url,
    archived: page.archived,
    createdTime: page.createdTime
  };
}
