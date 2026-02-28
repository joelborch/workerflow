import type { Env } from "../../../../../shared/types";
import { unwrapBody } from "../../lib/payload";

type HandlerContext = {
  env: Env;
};

type FanoutResult = {
  ok: true;
  route: "webhook_fanout";
  attempted: number;
  delivered: number;
  failed: number;
};

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

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

function envString(env: Env, key: string) {
  const raw = (env as unknown as Record<string, unknown>)[key];
  return typeof raw === "string" ? raw.trim() : "";
}

export async function handle(requestPayload: unknown, _traceId: string, context?: HandlerContext): Promise<FanoutResult> {
  const env = context?.env;
  if (!env) {
    throw new Error("Execution context missing env");
  }

  const body = asObject(unwrapBody(requestPayload));
  const payload = body.payload ?? body;
  const targets = asWebhookList(body.webhooks);
  const fallback = envString(env, "FANOUT_SHARED_WEBHOOK_URL");
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
