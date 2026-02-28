import { unwrapBody } from "../../lib/payload";

type RenderResult = {
  ok: true;
  route: "template_render";
  rendered: string;
};

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

export function handle(requestPayload: unknown): RenderResult {
  const body = asObject(unwrapBody(requestPayload));
  const template = typeof body.template === "string" ? body.template : "Hello {{name}}";
  const values = asObject(body.values);

  const rendered = template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_full, key) => {
    const value = values[key];
    if (value === undefined || value === null) {
      return "";
    }
    return String(value);
  });

  return {
    ok: true,
    route: "template_render",
    rendered
  };
}
