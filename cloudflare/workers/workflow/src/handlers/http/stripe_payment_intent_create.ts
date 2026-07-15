import type { Env } from "../../../../../shared/types";
import { createStripePaymentIntent } from "../../connectors/stripe";
import { readEnvString, requireContextEnv, type EnvContext } from "../../lib/env";
import { toScalarMetadata, unwrapObjectBody } from "../../lib/payload";

type StripePaymentIntentCreateResult = {
  ok: true;
  route: "stripe_payment_intent_create";
  paymentIntentId: string;
  status: string;
  clientSecret: string;
  amount: number;
  currency: string;
};

function asNumber(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return value;
}

export async function handle(
  requestPayload: unknown,
  traceId: string,
  context?: EnvContext<Env>
): Promise<StripePaymentIntentCreateResult> {
  const env = requireContextEnv(context);
  const body = unwrapObjectBody(requestPayload);
  const apiKey = readEnvString(env, ["STRIPE_API_KEY"]);
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
    metadata: toScalarMetadata(body.metadata),
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
