import { unwrapBody } from "../../lib/payload";

type TransformRequest = {
  data?: unknown;
  pick?: unknown;
  rename?: unknown;
};

type TransformResult = {
  ok: true;
  route: "json_transform";
  transformed: Record<string, unknown>;
};

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function stringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

export function handle(requestPayload: unknown): TransformResult {
  const body = asObject(unwrapBody(requestPayload)) as TransformRequest;
  const source = asObject(body.data ?? body);
  const pick = stringArray(body.pick);
  const rename = asObject(body.rename);

  const base: Record<string, unknown> = pick.length > 0
    ? Object.fromEntries(pick.filter((key) => key in source).map((key) => [key, source[key]]))
    : { ...source };

  const transformed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(base)) {
    const renamed = typeof rename[key] === "string" && String(rename[key]).trim().length > 0
      ? String(rename[key]).trim()
      : key;
    transformed[renamed] = value;
  }

  return {
    ok: true,
    route: "json_transform",
    transformed
  };
}
