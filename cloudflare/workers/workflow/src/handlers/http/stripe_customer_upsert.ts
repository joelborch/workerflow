import type { Env } from "../../../../../shared/types";
import { upsertStripeCustomer } from "../../connectors/stripe";
import { readEnvString, requireContextEnv, type EnvContext } from "../../lib/env";
import { toScalarMetadata, unwrapObjectBody } from "../../lib/payload";

type StripeCustomerUpsertResult = {
  ok: true;
  route: "stripe_customer_upsert";
  customerId: string;
  email: string;
  name: string;
  created: boolean;
};

export async function handle(requestPayload: unknown, traceId: string, context?: EnvContext<Env>): Promise<StripeCustomerUpsertResult> {
  const env = requireContextEnv(context);
  const body = unwrapObjectBody(requestPayload);
  const apiKey = readEnvString(env, ["STRIPE_API_KEY"]);
  if (!apiKey) {
    throw new Error("STRIPE_API_KEY is required");
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email) {
    throw new Error("stripe_customer_upsert requires body.email");
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const explicitIdempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey.trim() : "";

  const customer = await upsertStripeCustomer({
    apiKey,
    email,
    ...(name ? { name } : {}),
    ...(phone ? { phone } : {}),
    metadata: toScalarMetadata(body.metadata),
    idempotencyKey: explicitIdempotencyKey || `workerflow-${traceId}-stripe-customer`
  });

  return {
    ok: true,
    route: "stripe_customer_upsert",
    customerId: customer.id,
    email: customer.email || email,
    name: customer.name || name,
    created: customer.created
  };
}
