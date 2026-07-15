import type { Env } from "../../../../../shared/types";
import { requireOk } from "../../connectors/http_retry";
import { readEnvString, requireContextEnv, type EnvContext } from "../../lib/env";
import { unwrapObjectBody } from "../../lib/payload";

type ChatNotifyResult = {
  ok: true;
  route: "chat_notify";
  delivered: boolean;
  endpointHost: string;
};

export async function handle(requestPayload: unknown, traceId: string, context?: EnvContext<Env>): Promise<ChatNotifyResult> {
  const env = requireContextEnv(context);
  const webhookUrl = readEnvString(env, ["CHAT_WEBHOOK_URL", "GCHAT_ALERTS_WEBHOOK_URL", "GCHAT_ALERTS_WEBHOOK"]);

  if (!webhookUrl) {
    throw new Error("CHAT_WEBHOOK_URL is required");
  }

  const body = unwrapObjectBody(requestPayload);
  const textValue = body.text;
  const message = typeof textValue === "string" && textValue.trim() ? textValue.trim() : "Automation event";

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      text: `[WorkerFlow:${traceId}] ${message}`
    })
  });

  await requireOk(response, "Chat webhook failed");

  const endpointHost = new URL(webhookUrl).host;
  return {
    ok: true,
    route: "chat_notify",
    delivered: true,
    endpointHost
  };
}
