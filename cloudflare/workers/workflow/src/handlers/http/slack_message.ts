import type { Env } from "../../../../../shared/types";
import { postSlackMessage } from "../../connectors/slack";
import { unwrapBody } from "../../lib/payload";

type HandlerContext = {
  env: Env;
};

type SlackMessageResult = {
  ok: true;
  route: "slack_message";
  delivered: boolean;
  endpointHost: string;
};

function asObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, unknown>;
  }
  return value as Record<string, unknown>;
}

function envString(env: Env, key: string) {
  const raw = (env as unknown as Record<string, unknown>)[key];
  return typeof raw === "string" ? raw.trim() : "";
}

export async function handle(requestPayload: unknown, traceId: string, context?: HandlerContext): Promise<SlackMessageResult> {
  const env = context?.env;
  if (!env) {
    throw new Error("Execution context missing env");
  }

  const body = asObject(unwrapBody(requestPayload));
  const message = typeof body.text === "string" && body.text.trim().length > 0 ? body.text.trim() : "Automation event";
  const bodyWebhook = typeof body.webhookUrl === "string" ? body.webhookUrl.trim() : "";
  const webhookUrl = bodyWebhook || envString(env, "SLACK_WEBHOOK_URL");

  if (!webhookUrl) {
    throw new Error("SLACK_WEBHOOK_URL is required");
  }

  await postSlackMessage({
    webhookUrl,
    text: `[WorkerFlow:${traceId}] ${message}`
  });

  return {
    ok: true,
    route: "slack_message",
    delivered: true,
    endpointHost: new URL(webhookUrl).host
  };
}
