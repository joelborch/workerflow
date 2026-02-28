import { fetchWithRetry } from "./http_retry";

type NotionRequestArgs = {
  token: string;
  method: "GET" | "POST";
  path: string;
  body?: unknown;
};

type NotionErrorResponse = {
  object?: unknown;
  status?: unknown;
  code?: unknown;
  message?: unknown;
};

type NotionPageResponse = {
  id?: unknown;
  url?: unknown;
  object?: unknown;
  archived?: unknown;
  created_time?: unknown;
  last_edited_time?: unknown;
  properties?: unknown;
};

type CreateDatabaseItemArgs = {
  token: string;
  databaseId: string;
  properties: Record<string, unknown>;
  children?: unknown[];
};

type GetDatabaseItemArgs = {
  token: string;
  pageId: string;
};

const NOTION_API_BASE = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

function asText(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, unknown>;
  }
  return value as Record<string, unknown>;
}

async function notionRequest<T>(args: NotionRequestArgs) {
  const response = await fetchWithRetry(`${NOTION_API_BASE}${args.path}`, {
    method: args.method,
    headers: {
      authorization: `Bearer ${args.token.trim()}`,
      "notion-version": NOTION_VERSION,
      "content-type": "application/json"
    },
    ...(args.body !== undefined ? { body: JSON.stringify(args.body) } : {})
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as NotionErrorResponse | null;
    const message = payload?.message ? String(payload.message) : "Unknown Notion error";
    const code = payload?.code ? String(payload.code) : "notion_error";
    throw new Error(`Notion request failed: ${response.status} ${code} ${message}`);
  }

  return (await response.json()) as T;
}

function normalizeNotionPage(data: NotionPageResponse) {
  return {
    id: asText(data.id),
    url: asText(data.url),
    object: asText(data.object),
    archived: Boolean(data.archived),
    createdTime: asText(data.created_time),
    lastEditedTime: asText(data.last_edited_time),
    properties: asObject(data.properties)
  };
}

export async function createNotionDatabaseItem(args: CreateDatabaseItemArgs) {
  const data = await notionRequest<NotionPageResponse>({
    token: args.token,
    method: "POST",
    path: "/pages",
    body: {
      parent: {
        database_id: args.databaseId
      },
      properties: args.properties,
      ...(Array.isArray(args.children) ? { children: args.children } : {})
    }
  });

  return normalizeNotionPage(data);
}

export async function getNotionDatabaseItem(args: GetDatabaseItemArgs) {
  const data = await notionRequest<NotionPageResponse>({
    token: args.token,
    method: "GET",
    path: `/pages/${encodeURIComponent(args.pageId)}`
  });

  return normalizeNotionPage(data);
}
