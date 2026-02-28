import type { Env } from "../../../../../shared/types";
import { createStripePaymentIntent } from "../../connectors/stripe";
import { unwrapBody } from "../../lib/payload";

type HandlerContext = {
  env: Env;
};

type StripePaymentIntentCreateResult = {
  ok: true;
  route: "stripe_payment_intent_create";
  paymentIntentId: string;
  status: string;
  clientSecret: string;
  amount: number;
  currency: string;
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

function asNumber(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return value;
}

function toMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const out: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "string" || typeof item === "number" || typeof item === "boolean") {
      out[key] = String(item);
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export async function handle(
  requestPayload: unknown,
  traceId: string,
  context?: HandlerContext
): Promise<StripePaymentIntentCreateResult> {
  const env = context?.env;
  if (!env) {
    throw new Error("Execution context missing env");
  }

  const body = asObject(unwrapBody(requestPayload));
  const apiKey = envString(env, "STRIPE_API_KEY");
  if (!apiKey) {
    throw new Error("STRIPE_API_KEY is required");
  }

  const amount = asNumber(body.amount);
  if (amount === null || amount <= 0) {
    throw new Error("stripe_payment_intent_create requires numeric body.amount > 0");
  }

  const currency = typeof body.currency === "string" && body.currency.trim() ? body.currency.trim() : "usd";
  const customerId = typeof body.customerId === "string" ? body.customerId.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const explicitIdempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey.trim() : "";

  const paymentIntent = await createStripePaymentIntent({
    apiKey,
    amount,
    currency,
    ...(customerId ? { customerId } : {}),
    ...(description ? { description } : {}),
    metadata: toMetadata(body.metadata),
    idempotencyKey: explicitIdempotencyKey || `workerflow-${traceId}-payment-intent`
  });

  return {
    ok: true,
    route: "stripe_payment_intent_create",
    paymentIntentId: paymentIntent.id,
    status: paymentIntent.status,
    clientSecret: paymentIntent.clientSecret,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency || currency
  };
}
