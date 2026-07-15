import type { Env } from "../../../../../shared/types";
import { postSlackMessage } from "../../connectors/slack";
import { readEnvString, requireContextEnv, type EnvContext } from "../../lib/env";
import { unwrapObjectBody } from "../../lib/payload";

type SlackMessageResult = {
  ok: true;
  route: "slack_message";
  delivered: boolean;
  endpointHost: string;
};

export async function handle(requestPayload: unknown, traceId: string, context?: EnvContext<Env>): Promise<SlackMessageResult> {
  const env = requireContextEnv(context);
  const body = unwrapObjectBody(requestPayload);
  const message = typeof body.text === "string" && body.text.trim().length > 0 ? body.text.trim() : "Automation event";
  const bodyWebhook = typeof body.webhookUrl === "string" ? body.webhookUrl.trim() : "";
  const webhookUrl = bodyWebhook || readEnvString(env, ["SLACK_WEBHOOK_URL"]);

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
