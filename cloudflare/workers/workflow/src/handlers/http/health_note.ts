import { unwrapBody } from "../../lib/payload";

type HealthNoteResult = {
  ok: true;
  route: "health_note";
  service: string;
  status: string;
  observedAt: string;
};

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

export function handle(requestPayload: unknown): HealthNoteResult {
  const body = asObject(unwrapBody(requestPayload));
  const service = typeof body.service === "string" && body.service.trim().length > 0 ? body.service.trim() : "unknown-service";
  const status = typeof body.status === "string" && body.status.trim().length > 0 ? body.status.trim() : "ok";

  return {
    ok: true,
    route: "health_note",
    service,
    status,
    observedAt: new Date().toISOString()
  };
}
