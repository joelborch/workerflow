import type { Env } from "../../../../../shared/types";
import { unwrapBody } from "../../lib/payload";

type HandlerContext = {
  env: Env;
};

type IncidentResult = {
  ok: true;
  route: "incident_create";
  severity: string;
  delivered: boolean;
};

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function envString(env: Env, key: string) {
  const raw = (env as unknown as Record<string, unknown>)[key];
  return typeof raw === "string" ? raw.trim() : "";
}

export async function handle(requestPayload: unknown, traceId: string, context?: HandlerContext): Promise<IncidentResult> {
  const env = context?.env;
  if (!env) {
    throw new Error("Execution context missing env");
  }

  const body = asObject(unwrapBody(requestPayload));
  const title = typeof body.title === "string" && body.title.trim().length > 0 ? body.title.trim() : "Incident";
  const severity = typeof body.severity === "string" && body.severity.trim().length > 0 ? body.severity.trim() : "info";
  const details = typeof body.details === "string" ? body.details : "No details provided";

  const webhookUrl =
    envString(env, "CHAT_WEBHOOK_URL") ||
    envString(env, "GCHAT_ALERTS_WEBHOOK_URL") ||
    envString(env, "GCHAT_ALERTS_WEBHOOK");

  if (!webhookUrl) {
    throw new Error("CHAT_WEBHOOK_URL is required");
  }

  const text = [`[WorkerFlow Incident]`, `trace=${traceId}`, `severity=${severity}`, `title=${title}`, `details=${details}`].join("\n");
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ text })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Incident webhook failed: ${response.status} ${response.statusText} ${errorText}`);
  }

  return {
    ok: true,
    route: "incident_create",
    severity,
    delivered: true
  };
}
