import type { Env } from "../../../../../shared/types";
import { getNotionDatabaseItem } from "../../connectors/notion";
import { readEnvString, requireContextEnv, type EnvContext } from "../../lib/env";
import { unwrapObjectBody } from "../../lib/payload";

type NotionDatabaseItemGetResult = {
  ok: true;
  route: "notion_database_item_get";
  pageId: string;
  url: string;
  archived: boolean;
  lastEditedTime: string;
  propertyCount: number;
};

export async function handle(
  requestPayload: unknown,
  _traceId: string,
  context?: EnvContext<Env>
): Promise<NotionDatabaseItemGetResult> {
  const env = requireContextEnv(context);
  const body = unwrapObjectBody(requestPayload);
  const token = readEnvString(env, ["NOTION_TOKEN"]);
  if (!token) {
    throw new Error("NOTION_TOKEN is required");
  }

  const pageIdFromBody = typeof body.pageId === "string" ? body.pageId.trim() : "";
  const pageIdFromAlias = typeof body.id === "string" ? body.id.trim() : "";
  const pageId = pageIdFromBody || pageIdFromAlias;
  if (!pageId) {
    throw new Error("notion_database_item_get requires body.pageId");
  }

  const page = await getNotionDatabaseItem({
    token,
    pageId
  });

  return {
    ok: true,
    route: "notion_database_item_get",
    pageId: page.id,
    url: page.url,
    archived: page.archived,
    lastEditedTime: page.lastEditedTime,
    propertyCount: Object.keys(page.properties).length
  };
}
