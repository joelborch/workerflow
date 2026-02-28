const DEFAULT_WORKSPACE_ID = "default";
const WORKSPACE_HEADER = "x-workspace-id";

function normalizeWorkspaceValue(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 64);
}

export function resolveWorkspaceId(value: unknown, fallback = DEFAULT_WORKSPACE_ID) {
  if (typeof value !== "string") {
    return fallback;
  }
  const normalized = normalizeWorkspaceValue(value);
  return normalized.length > 0 ? normalized : fallback;
}

export function readWorkspaceId(request: Request, fallback = DEFAULT_WORKSPACE_ID) {
  const raw = request.headers.get(WORKSPACE_HEADER);
  return resolveWorkspaceId(raw, fallback);
}

export function workspaceFilterValue(value: string | null, fallback: string | null = null) {
  if (!value) {
    return fallback;
  }
  const normalized = resolveWorkspaceId(value, "");
  return normalized || fallback;
}

export { DEFAULT_WORKSPACE_ID, WORKSPACE_HEADER };
