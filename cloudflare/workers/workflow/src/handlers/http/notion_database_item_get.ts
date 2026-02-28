import type { Env } from "../../../../../shared/types";
import { getNotionDatabaseItem } from "../../connectors/notion";
import { unwrapBody } from "../../lib/payload";

type HandlerContext = {
  env: Env;
};

type NotionDatabaseItemGetResult = {
  ok: true;
  route: "notion_database_item_get";
  pageId: string;
  url: string;
  archived: boolean;
  lastEditedTime: string;
  propertyCount: number;
};

function asObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, unknown>;
  }
  return value as Record<string, unknown>;
}

function envString(env: Env, key: string) {
  const raw = (env as unknown as Record<string, unknown>)[key];
  return typeof raw === "string" ? raw.trim() : "";
}

export async function handle(
  requestPayload: unknown,
  _traceId: string,
  context?: HandlerContext
): Promise<NotionDatabaseItemGetResult> {
  const env = context?.env;
  if (!env) {
    throw new Error("Execution context missing env");
  }

  const body = asObject(unwrapBody(requestPayload));
  const token = envString(env, "NOTION_TOKEN");
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
