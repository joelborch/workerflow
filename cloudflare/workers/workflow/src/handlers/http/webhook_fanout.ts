import type { Env } from "../../../../../shared/types";
import { readEnvString, requireContextEnv, type EnvContext } from "../../lib/env";
import { unwrapObjectBody } from "../../lib/payload";

type FanoutResult = {
  ok: true;
  route: "webhook_fanout";
  attempted: number;
  delivered: number;
  failed: number;
};

function asWebhookList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, 20);
}

export async function handle(requestPayload: unknown, _traceId: string, context?: EnvContext<Env>): Promise<FanoutResult> {
  const env = requireContextEnv(context);
  const body = unwrapObjectBody(requestPayload);
  const payload = body.payload ?? body;
  const targets = asWebhookList(body.webhooks);
  const fallback = readEnvString(env, ["FANOUT_SHARED_WEBHOOK_URL"]);
  const webhooks = targets.length > 0 ? targets : fallback ? [fallback] : [];

  let delivered = 0;
  let failed = 0;

  for (const webhookUrl of webhooks) {
    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        delivered += 1;
      } else {
        failed += 1;
      }
    } catch {
      failed += 1;
    }
  }

  return {
    ok: true,
    route: "webhook_fanout",
    attempted: webhooks.length,
    delivered,
    failed
  };
}
