import type { Env } from "../../../../../shared/types";
import { unwrapBody } from "../../lib/payload";

type HandlerContext = {
  env: Env;
};

type ChatNotifyResult = {
  ok: true;
  route: "chat_notify";
  delivered: boolean;
  endpointHost: string;
};

function parseObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, unknown>;
  }
  return value as Record<string, unknown>;
}

function envString(env: Env, key: string) {
  const raw = (env as unknown as Record<string, unknown>)[key];
  if (typeof raw !== "string") {
    return "";
  }
  return raw.trim();
}

export async function handle(requestPayload: unknown, traceId: string, context?: HandlerContext): Promise<ChatNotifyResult> {
  const env = context?.env;
  if (!env) {
    throw new Error("Execution context missing env");
  }

  const webhookUrl =
    envString(env, "CHAT_WEBHOOK_URL") ||
    envString(env, "GCHAT_ALERTS_WEBHOOK_URL") ||
    envString(env, "GCHAT_ALERTS_WEBHOOK");

  if (!webhookUrl) {
    throw new Error("CHAT_WEBHOOK_URL is required");
  }

  const body = parseObject(unwrapBody(requestPayload));
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

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Chat webhook failed: ${response.status} ${response.statusText} ${errorText}`);
  }

  const endpointHost = new URL(webhookUrl).host;
  return {
    ok: true,
    route: "chat_notify",
    delivered: true,
    endpointHost
  };
}
