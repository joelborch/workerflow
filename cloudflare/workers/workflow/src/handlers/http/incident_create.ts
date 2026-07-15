import type { Env } from "../../../../../shared/types";
import { requireOk } from "../../connectors/http_retry";
import { readEnvString, requireContextEnv, type EnvContext } from "../../lib/env";
import { unwrapObjectBody } from "../../lib/payload";

type IncidentResult = {
  ok: true;
  route: "incident_create";
  severity: string;
  delivered: boolean;
};

export async function handle(requestPayload: unknown, traceId: string, context?: EnvContext<Env>): Promise<IncidentResult> {
  const env = requireContextEnv(context);
  const body = unwrapObjectBody(requestPayload);
  const title = typeof body.title === "string" && body.title.trim().length > 0 ? body.title.trim() : "Incident";
  const severity = typeof body.severity === "string" && body.severity.trim().length > 0 ? body.severity.trim() : "info";
  const details = typeof body.details === "string" ? body.details : "No details provided";

  const webhookUrl = readEnvString(env, ["CHAT_WEBHOOK_URL", "GCHAT_ALERTS_WEBHOOK_URL", "GCHAT_ALERTS_WEBHOOK"]);

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

  await requireOk(response, "Incident webhook failed");

  return {
    ok: true,
    route: "incident_create",
    severity,
    delivered: true
  };
}
