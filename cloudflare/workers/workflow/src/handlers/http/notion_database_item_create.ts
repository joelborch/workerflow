import type { Env } from "../../../../../shared/types";
import { createNotionDatabaseItem } from "../../connectors/notion";
import { unwrapBody } from "../../lib/payload";

type HandlerContext = {
  env: Env;
};

type NotionDatabaseItemCreateResult = {
  ok: true;
  route: "notion_database_item_create";
  pageId: string;
  url: string;
  archived: boolean;
  createdTime: string;
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
): Promise<NotionDatabaseItemCreateResult> {
  const env = context?.env;
  if (!env) {
    throw new Error("Execution context missing env");
  }

  const body = asObject(unwrapBody(requestPayload));
  const token = envString(env, "NOTION_TOKEN");
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
