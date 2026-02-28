import { unwrapBody } from "../../lib/payload";

type ExtractResult = {
  ok: true;
  route: "text_extract";
  pattern: string;
  matchCount: number;
  matches: string[];
};

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

export function handle(requestPayload: unknown): ExtractResult {
  const body = asObject(unwrapBody(requestPayload));
  const text = typeof body.text === "string" ? body.text : "";
  const pattern = typeof body.pattern === "string" && body.pattern.trim().length > 0 ? body.pattern.trim() : "\\w+";
  const flags = typeof body.flags === "string" ? body.flags.replace(/[^gimsuy]/g, "") : "g";

  const regexp = new RegExp(pattern, flags.includes("g") ? flags : `${flags}g`);
  const matches = Array.from(text.matchAll(regexp)).map((match) => match[0] ?? "").filter(Boolean);

  return {
    ok: true,
    route: "text_extract",
    pattern,
    matchCount: matches.length,
    matches
  };
}
